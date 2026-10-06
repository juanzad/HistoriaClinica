import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  initializeFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  writeBatch,
  deleteDoc,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { PersonalData, MedicalEvent, SideEffectEntry, MetricEntry, MedicalFile, Appointment } from './types';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// ignoreUndefinedProperties: los campos opcionales vacíos (p. ej. notes: undefined) se omiten
// en lugar de hacer fallar todo el respaldo.
export const db = initializeFirestore(app, { ignoreUndefinedProperties: true }, firebaseConfig.firestoreDatabaseId);

export interface HealthRecord {
  personalData: PersonalData;
  events: MedicalEvent[];
  sideEffects: SideEffectEntry[];
  metrics: MetricEntry[];
  appointments: Appointment[];
}

const SUBCOLLECTIONS = ['events', 'sideEffects', 'metrics', 'appointments'] as const;
const MAX_BATCH_WRITES = 450; // Firestore admite hasta 500 escrituras por lote.

export function signInWithGoogle() {
  return signInWithPopup(auth, new GoogleAuthProvider());
}

export function logout() {
  return signOut(auth);
}

export function watchUser(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

function requireUser(): User {
  const user = auth.currentUser;
  if (!user) throw new Error('Debe iniciar sesión.');
  return user;
}

// Los adjuntos (PDF/imágenes en base64) no entran en un documento de Firestore (máx. 1 MB),
// así que se guardan aparte, partidos en trozos:
//   users/{uid}/files/{fileId}              → { id, total }   (se escribe al final: marca "completo")
//   users/{uid}/fileChunks/{fileId}_{i}     → { id, fileId, index, data }
// Los eventos guardan solo los datos del adjunto (nombre, tipo, tamaño), sin el contenido.
const CHUNK_SIZE = 900_000;

const chunkId = (fileId: string, index: number) => `${fileId}_${index}`;

async function uploadFile(uid: string, file: MedicalFile) {
  // Cada adjunto tiene un id único y no cambia: si ya está completo en la nube, no se vuelve a subir.
  if ((await getDoc(doc(db, 'users', uid, 'files', file.id))).exists()) return;

  const total = Math.max(1, Math.ceil(file.data.length / CHUNK_SIZE));
  for (let i = 0; i < total; i++) {
    const id = chunkId(file.id, i);
    await setDoc(doc(db, 'users', uid, 'fileChunks', id), {
      id,
      fileId: file.id,
      index: i,
      data: file.data.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
    });
  }
  await setDoc(doc(db, 'users', uid, 'files', file.id), { id: file.id, total });
}

async function downloadFile(uid: string, file: MedicalFile): Promise<MedicalFile> {
  const meta = await getDoc(doc(db, 'users', uid, 'files', file.id));
  if (!meta.exists()) return { ...file, data: '' };
  const total = meta.data().total as number;
  const chunks = await Promise.all(
    Array.from({ length: total }, (_, i) => getDoc(doc(db, 'users', uid, 'fileChunks', chunkId(file.id, i))))
  );
  return { ...file, data: chunks.map((c) => (c.data()?.data as string) ?? '').join('') };
}

async function deleteFile(uid: string, fileId: string) {
  const meta = await getDoc(doc(db, 'users', uid, 'files', fileId));
  const total = meta.exists() ? (meta.data().total as number) : 0;
  await deleteDoc(doc(db, 'users', uid, 'files', fileId));
  for (let i = 0; i < total; i++) {
    await deleteDoc(doc(db, 'users', uid, 'fileChunks', chunkId(fileId, i)));
  }
}

async function writeInBatches(ops: Array<(batch: ReturnType<typeof writeBatch>) => void>) {
  for (let i = 0; i < ops.length; i += MAX_BATCH_WRITES) {
    const batch = writeBatch(db);
    for (const op of ops.slice(i, i + MAX_BATCH_WRITES)) op(batch);
    await batch.commit();
  }
}

// Un respaldo automático nunca borra de la nube más de esta cantidad de registros de una vez:
// un borrado grande (p. ej. "Reiniciar desde cero") solo se aplica con "Respaldar" manual.
const MAX_AUTO_DELETES = 3;

export interface SaveResult {
  /** Momento de la copia guardada (se toma al empezar, así un cambio hecho durante el guardado queda pendiente). */
  updatedAt: string;
  /**
   * Si es mayor que 0, NO se guardó nada: la app tiene esa cantidad de registros menos que la nube
   * (más que MAX_AUTO_DELETES) y el borrado debe confirmarse con un respaldo manual.
   */
  blockedDeletes: number;
}

/** Fecha del último respaldo completo en la nube, o null si nunca se respaldó. */
export async function getCloudUpdatedAt(): Promise<string | null> {
  const { uid } = requireUser();
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? ((snap.data().updatedAt as string) ?? null) : null;
}

/**
 * Guarda todo el historial en users/{uid}. Las reglas de Firestore solo permiten
 * que cada usuario lea y escriba su propio documento. Lo que se borró en la app
 * también se borra de la nube, salvo que sean más de MAX_AUTO_DELETES registros y
 * no se haya pedido explícitamente (allowBulkDelete).
 */
export async function saveHealthRecord(
  data: HealthRecord,
  { allowBulkDelete = true }: { allowBulkDelete?: boolean } = {}
): Promise<SaveResult> {
  const { uid } = requireUser();
  const updatedAt = new Date().toISOString();

  const stripped = data.events.map((e) =>
    e.files ? { ...e, files: e.files.map(({ data: _data, ...meta }) => meta) } : e
  );
  const current = { events: stripped, sideEffects: data.sideEffects, metrics: data.metrics, appointments: data.appointments };

  // 1. Primero se calcula qué habría que borrar de la nube. Si es un borrado grande y no fue pedido
  //    a mano, no se escribe nada: la nube queda intacta hasta que el usuario lo confirme.
  const deletions: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];
  for (const name of SUBCOLLECTIONS) {
    const keep = new Set(current[name].map((item) => item.id));
    const existing = await getDocs(collection(db, 'users', uid, name));
    for (const d of existing.docs) {
      if (!keep.has(d.id)) deletions.push((batch) => batch.delete(d.ref));
    }
  }
  if (!allowBulkDelete && deletions.length > MAX_AUTO_DELETES) {
    return { updatedAt, blockedDeletes: deletions.length };
  }

  // 2. Adjuntos: antes que los eventos, para que ningún evento apunte a un archivo inexistente.
  const files = data.events.flatMap((e) => e.files ?? []).filter((f) => f.data);
  for (const file of files) await uploadFile(uid, file);

  // 3. Eventos (sin el contenido de los adjuntos), efectos y métricas.
  await writeInBatches(
    SUBCOLLECTIONS.flatMap((name) =>
      current[name].map((item) => (batch: ReturnType<typeof writeBatch>) =>
        batch.set(doc(db, 'users', uid, name, item.id), item)
      )
    )
  );

  // 4. Borrados.
  await writeInBatches(deletions);
  const keepFiles = new Set(data.events.flatMap((e) => e.files ?? []).map((f) => f.id));
  const storedFiles = await getDocs(collection(db, 'users', uid, 'files'));
  for (const d of storedFiles.docs) {
    if (!keepFiles.has(d.id)) await deleteFile(uid, d.id);
  }

  // 5. Al final, la fecha: si algo falló antes, la nube no aparenta tener una copia completa más nueva.
  await setDoc(doc(db, 'users', uid), { personalData: data.personalData, updatedAt });

  return { updatedAt, blockedDeletes: 0 };
}

/** Recupera el historial del usuario conectado, o null si todavía no guardó nada. */
export async function loadHealthRecord(): Promise<(HealthRecord & { updatedAt: string | null }) | null> {
  const { uid } = requireUser();

  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;

  const loadAll = async <T,>(name: (typeof SUBCOLLECTIONS)[number]) => {
    const docs = await getDocs(collection(db, 'users', uid, name));
    return docs.docs.map((d) => d.data() as T);
  };
  const [storedEvents, sideEffects, metrics, appointments] = await Promise.all([
    loadAll<MedicalEvent>('events'),
    loadAll<SideEffectEntry>('sideEffects'),
    loadAll<MetricEntry>('metrics'),
    loadAll<Appointment>('appointments'),
  ]);

  // Reconstruir el contenido de los adjuntos a partir de sus trozos.
  const events = await Promise.all(
    storedEvents.map(async (e) =>
      e.files ? { ...e, files: await Promise.all(e.files.map((f) => downloadFile(uid, f))) } : e
    )
  );

  const byDateDesc = (a: { date: string }, b: { date: string }) =>
    new Date(b.date).getTime() - new Date(a.date).getTime();

  return {
    personalData: snap.data().personalData as PersonalData,
    updatedAt: (snap.data().updatedAt as string) ?? null,
    events: events.sort(byDateDesc),
    sideEffects: sideEffects.sort(byDateDesc),
    metrics: metrics.sort(byDateDesc),
    appointments,
  };
}
