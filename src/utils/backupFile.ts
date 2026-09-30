import { PersonalData, MedicalEvent, SideEffectEntry, MetricEntry, EventType } from '../types';

// Copia completa del historial en un archivo .json, para guardarla fuera de la app
// o para importar datos recuperados (por ejemplo, de un PDF de la versión anterior).

const APP_ID = 'historia-clinica';
const FORMAT_VERSION = 1;

const EVENT_TYPES: EventType[] = [
  'Cirugía', 'Quimioterapia', 'Radioterapia', 'Inmunoterapia', 'Estudio', 'Consulta', 'Laboratorio', 'Otro',
];
const SEVERITIES: SideEffectEntry['severity'][] = ['Leve', 'Moderado', 'Severo'];

export interface BackupFile {
  personalData?: PersonalData;
  events: MedicalEvent[];
  sideEffects: SideEffectEntry[];
  metrics: MetricEntry[];
}

export function downloadBackupFile(data: Required<BackupFile>) {
  const payload = { app: APP_ID, version: FORMAT_VERSION, exportedAt: new Date().toISOString(), ...data };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `historia-clinica-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

const isObject = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isDate = (v: unknown) => typeof v === 'string' && !Number.isNaN(new Date(v).getTime());
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

// Solo se aceptan registros con la forma esperada: el archivo puede venir de cualquier lado.
function parseEvent(v: unknown): MedicalEvent | null {
  if (!isObject(v) || !str(v.id) || !isDate(v.date) || !EVENT_TYPES.includes(v.type)) return null;
  return {
    id: v.id,
    date: v.date,
    type: v.type,
    title: str(v.title) || 'Sin título',
    description: str(v.description),
    professional: str(v.professional),
    institution: str(v.institution),
    notes: str(v.notes) || undefined,
    labResults: isObject(v.labResults) ? v.labResults : undefined,
    files: Array.isArray(v.files) ? v.files : undefined,
    createdAt: str(v.createdAt) || new Date().toISOString(),
  };
}

function parseSideEffect(v: unknown): SideEffectEntry | null {
  if (!isObject(v) || !str(v.id) || !isDate(v.date) || !SEVERITIES.includes(v.severity)) return null;
  return {
    id: v.id,
    date: v.date,
    severity: v.severity,
    symptoms: Array.isArray(v.symptoms) ? v.symptoms.filter((s: unknown) => typeof s === 'string') : [],
    customSymptoms: str(v.customSymptoms) || undefined,
    notes: str(v.notes),
    energyLevel: num(v.energyLevel),
    createdAt: str(v.createdAt) || new Date().toISOString(),
  };
}

function parseMetric(v: unknown): MetricEntry | null {
  if (!isObject(v) || !str(v.id) || !isDate(v.date)) return null;
  return {
    id: v.id,
    date: v.date,
    weight: num(v.weight),
    systolic: num(v.systolic),
    diastolic: num(v.diastolic),
    heartRate: num(v.heartRate),
    bmi: num(v.bmi),
    notes: str(v.notes) || undefined,
  };
}

function parsePersonalData(v: unknown): PersonalData | undefined {
  if (!isObject(v) || !str(v.fullName)) return undefined;
  return {
    fullName: v.fullName,
    birthDate: str(v.birthDate),
    age: num(v.age),
    weight: num(v.weight),
    height: num(v.height),
    bloodType: str(v.bloodType) || 'A+',
    allergies: str(v.allergies),
    diagnosis: str(v.diagnosis),
    treatment: str(v.treatment),
  };
}

export async function readBackupFile(file: File): Promise<BackupFile> {
  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    throw new Error('El archivo no es un respaldo válido (.json).');
  }
  if (!isObject(raw) || raw.app !== APP_ID) {
    throw new Error('El archivo no es un respaldo de esta aplicación.');
  }
  const list = <T,>(v: unknown, parse: (x: unknown) => T | null) =>
    (Array.isArray(v) ? v : []).map(parse).filter((x): x is T => x !== null);

  return {
    personalData: parsePersonalData(raw.personalData),
    events: list(raw.events, parseEvent),
    sideEffects: list(raw.sideEffects, parseSideEffect),
    metrics: list(raw.metrics, parseMetric),
  };
}

/** Agrega los registros nuevos sin duplicar los que ya existen (mismo id). */
export function mergeById<T extends { id: string; date: string }>(current: T[], incoming: T[]) {
  const ids = new Set(current.map((x) => x.id));
  const added = incoming.filter((x) => !ids.has(x.id));
  const merged = [...current, ...added].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return { merged, added: added.length };
}
