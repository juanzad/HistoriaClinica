// Acceso seguro a Firebase: inicio de sesión con Google y datos guardados bajo el uid del usuario.
//
// Reemplaza el esquema anterior "patients/<código aleatorio>", que no tenía login y dependía
// de reglas de Firestore abiertas. Ver SEGURIDAD.md para integrarlo en la app.

import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Claves de localStorage que usaba la app; se borran al cerrar sesión.
const LOCAL_STORAGE_KEYS = [
  "juan_health_patient_id",
  "juan_health_personal",
  "juan_health_events",
  "juan_health_side_effects",
  "juan_health_metrics",
];

const SUBCOLLECTIONS = ["events", "sideEffects", "metrics"] as const;
const MAX_BATCH_WRITES = 450; // Firestore admite hasta 500 escrituras por lote.

export interface HealthRecord {
  personalData: Record<string, unknown>;
  events: Array<{ id: string; date?: string } & Record<string, unknown>>;
  sideEffects: Array<{ id: string; date?: string } & Record<string, unknown>>;
  metrics: Array<{ id: string; date?: string } & Record<string, unknown>>;
}

export function signInWithGoogle() {
  return signInWithPopup(auth, new GoogleAuthProvider());
}

export async function logout() {
  await signOut(auth);
  for (const key of LOCAL_STORAGE_KEYS) localStorage.removeItem(key);
}

export function watchUser(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

function requireUser(): User {
  const user = auth.currentUser;
  if (!user) throw new Error("Debe iniciar sesión.");
  return user;
}

/** Guarda el historial completo en users/{uid}. Reemplaza a la antigua copia por código. */
export async function saveHealthRecord(record: HealthRecord) {
  const { uid } = requireUser();
  await setDoc(doc(db, "users", uid), {
    personalData: record.personalData,
    updatedAt: new Date().toISOString(),
  });

  const writes = SUBCOLLECTIONS.flatMap((name) =>
    record[name].map((item) => ({ ref: doc(db, "users", uid, name, item.id), item }))
  );
  for (let i = 0; i < writes.length; i += MAX_BATCH_WRITES) {
    const batch = writeBatch(db);
    for (const { ref, item } of writes.slice(i, i + MAX_BATCH_WRITES)) batch.set(ref, item);
    await batch.commit();
  }
}

/** Carga el historial del usuario conectado, o null si todavía no guardó nada. */
export async function loadHealthRecord(): Promise<HealthRecord | null> {
  const { uid } = requireUser();
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;

  const byDateDesc = (a: { date?: string }, b: { date?: string }) =>
    new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime();

  const [events, sideEffects, metrics] = await Promise.all(
    SUBCOLLECTIONS.map(async (name) => {
      const docs = await getDocs(collection(db, "users", uid, name));
      return docs.docs.map((d) => d.data() as HealthRecord["events"][number]);
    })
  );

  return {
    personalData: snap.data().personalData ?? {},
    events: events.sort(byDateDesc),
    sideEffects: sideEffects.sort(byDateDesc),
    metrics: metrics.sort(byDateDesc),
  };
}

/** Llama a /api/parse-lab-report enviando el token de sesión que exige el servidor. */
export async function parseLabReport(body: { fileData?: string; mimeType?: string; textContent?: string }) {
  const token = await requireUser().getIdToken();
  const res = await fetch("/api/parse-lab-report", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "No se pudo procesar el informe.");
  return json.data;
}
