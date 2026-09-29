import { PersonalData, MedicalEvent, SideEffectEntry, MetricEntry } from './types';

// Valores iniciales vacíos. Los datos reales del paciente viven solo en el
// navegador y en Firestore (users/{uid}), nunca en el código fuente.
export const defaultPersonalData: PersonalData = {
  fullName: "Paciente Nuevo",
  birthDate: "",
  age: 0,
  weight: 0,
  height: 0,
  bloodType: "A+",
  allergies: "",
  diagnosis: "",
  treatment: ""
};

export const defaultEvents: MedicalEvent[] = [];

export const defaultSideEffects: SideEffectEntry[] = [];

export const defaultMetrics: MetricEntry[] = [];
