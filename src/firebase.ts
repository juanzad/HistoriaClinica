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
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { PersonalData, MedicalEvent, SideEffectEntry, MetricEntry } from './types';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export interface HealthRecord {
  personalData: PersonalData;
  events: MedicalEvent[];
  sideEffects: SideEffectEntry[];
  metrics: MetricEntry[];
}

const SUBCOLLECTIONS = ['events', 'sideEffects', 'metrics'] as const;
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

/**
 * Guarda todo el historial en users/{uid}. Las reglas de Firestore solo permiten
 * que cada usuario lea y escriba su propio documento.
 */
export async function saveHealthRecord(data: HealthRecord): Promise<void> {
  const { uid } = requireUser();

  await setDoc(doc(db, 'users', uid), {
    personalData: data.personalData,
    updatedAt: new Date().toISOString(),
  });

  const writes = SUBCOLLECTIONS.flatMap((name) =>
    data[name].map((item) => ({ ref: doc(db, 'users', uid, name, item.id), item }))
  );
  for (let i = 0; i < writes.length; i += MAX_BATCH_WRITES) {
    const batch = writeBatch(db);
    for (const { ref, item } of writes.slice(i, i + MAX_BATCH_WRITES)) {
      batch.set(ref, item);
    }
    await batch.commit();
  }
}

/** Recupera el historial del usuario conectado, o null si todavía no guardó nada. */
export async function loadHealthRecord(): Promise<HealthRecord | null> {
  const { uid } = requireUser();

  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;

  const loadAll = async <T,>(name: (typeof SUBCOLLECTIONS)[number]) => {
    const docs = await getDocs(collection(db, 'users', uid, name));
    return docs.docs.map((d) => d.data() as T);
  };
  const [events, sideEffects, metrics] = await Promise.all([
    loadAll<MedicalEvent>('events'),
    loadAll<SideEffectEntry>('sideEffects'),
    loadAll<MetricEntry>('metrics'),
  ]);

  const byDateDesc = (a: { date: string }, b: { date: string }) =>
    new Date(b.date).getTime() - new Date(a.date).getTime();

  return {
    personalData: snap.data().personalData as PersonalData,
    events: events.sort(byDateDesc),
    sideEffects: sideEffects.sort(byDateDesc),
    metrics: metrics.sort(byDateDesc),
  };
}

/** Llama a /api/parse-lab-report con el token de sesión que exige el servidor. */
export async function parseLabReport(body: { fileData?: string; mimeType?: string; textContent?: string }) {
  const token = await requireUser().getIdToken();
  const response = await fetch('/api/parse-lab-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const resData = await response.json().catch(() => ({}));
  if (!response.ok || !resData.success) {
    throw new Error(resData.error || 'No se pudo analizar el informe.');
  }
  return resData.data;
}
