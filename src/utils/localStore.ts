import { PersonalData, MedicalEvent, SideEffectEntry, MetricEntry } from '../types';

// Copia local del historial en el navegador, separada por usuario (uid) para que
// dos cuentas que usen el mismo dispositivo no vean los datos de la otra.

const FIELDS = ['personal', 'events', 'side_effects', 'metrics'] as const;
type Field = (typeof FIELDS)[number];

// Claves de la versión anterior (sin login). Se migran una sola vez al primer usuario que entra.
const LEGACY_PREFIX = 'juan_health_';
const LEGACY_PATIENT_ID_KEY = 'juan_health_patient_id';

export interface LocalRecord {
  personalData?: PersonalData;
  events?: MedicalEvent[];
  sideEffects?: SideEffectEntry[];
  metrics?: MetricEntry[];
}

const keyFor = (uid: string, field: Field) => `hc_${uid}_${field}`;

function readJson<T>(key: string): T | undefined {
  const raw = localStorage.getItem(key);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    console.error(`Error leyendo ${key}:`, e);
    return undefined;
  }
}

/** Mueve los datos guardados por la versión sin login a las claves de este usuario. */
function migrateLegacy(uid: string) {
  if (FIELDS.some((f) => localStorage.getItem(keyFor(uid, f)) !== null)) return;
  for (const field of FIELDS) {
    const legacy = localStorage.getItem(LEGACY_PREFIX + field);
    if (legacy !== null) localStorage.setItem(keyFor(uid, field), legacy);
  }
  for (const field of FIELDS) localStorage.removeItem(LEGACY_PREFIX + field);
  localStorage.removeItem(LEGACY_PATIENT_ID_KEY);
}

// Versiones anteriores guardaban eventos del análisis con IA sin id, lo que impedía
// borrarlos y hacía fallar el respaldo en Firestore.
function withIds<T extends { id: string }>(items: T[] | undefined, prefix: string): T[] | undefined {
  return items?.map((item) => (item.id ? item : { ...item, id: `${prefix}-${crypto.randomUUID()}` }));
}

export function loadLocalRecord(uid: string): LocalRecord {
  migrateLegacy(uid);
  return {
    personalData: readJson<PersonalData>(keyFor(uid, 'personal')),
    events: withIds(readJson<MedicalEvent[]>(keyFor(uid, 'events')), 'event'),
    sideEffects: withIds(readJson<SideEffectEntry[]>(keyFor(uid, 'side_effects')), 'effect'),
    metrics: withIds(readJson<MetricEntry[]>(keyFor(uid, 'metrics')), 'metric'),
  };
}

/**
 * Devuelve false si el navegador no tiene lugar (el localStorage admite ~5 MB y los
 * adjuntos ocupan mucho). En ese caso los datos siguen en la app y en la nube.
 */
export function saveLocalRecord(uid: string, record: Required<LocalRecord>): boolean {
  try {
    localStorage.setItem(keyFor(uid, 'personal'), JSON.stringify(record.personalData));
    localStorage.setItem(keyFor(uid, 'events'), JSON.stringify(record.events));
    localStorage.setItem(keyFor(uid, 'side_effects'), JSON.stringify(record.sideEffects));
    localStorage.setItem(keyFor(uid, 'metrics'), JSON.stringify(record.metrics));
    return true;
  } catch (e) {
    console.error('No se pudo guardar la copia local:', e);
    return false;
  }
}

/**
 * Estado de sincronización de este dispositivo:
 * - changedAt: último cambio hecho aquí.
 * - syncedAt: fecha de la copia en la nube que este dispositivo tiene (la última que guardó o cargó).
 * - exportedAt: última vez que se exportó a archivo.
 */
export interface SyncMeta {
  changedAt?: string;
  syncedAt?: string;
  exportedAt?: string;
}

const metaKey = (uid: string) => `hc_${uid}_sync`;

export function getSyncMeta(uid: string): SyncMeta {
  return readJson<SyncMeta>(metaKey(uid)) ?? {};
}

export function updateSyncMeta(uid: string, changes: SyncMeta) {
  try {
    localStorage.setItem(metaKey(uid), JSON.stringify({ ...getSyncMeta(uid), ...changes }));
  } catch (e) {
    console.error('No se pudo guardar el estado de sincronización:', e);
  }
}

/** Borra la copia local de este usuario (al cerrar sesión en un dispositivo compartido). */
export function clearLocalRecord(uid: string) {
  for (const field of FIELDS) localStorage.removeItem(keyFor(uid, field));
  localStorage.removeItem(metaKey(uid));
}
