export interface PersonalData {
  fullName: string;
  birthDate: string;
  age: number;
  weight: number; // Current weight
  height: number; // Current height in cm
  bloodType: string;
  allergies: string;
  diagnosis: string;
  treatment: string;
}

export type EventType = 
  | 'Cirugía' 
  | 'Quimioterapia' 
  | 'Radioterapia' 
  | 'Inmunoterapia' 
  | 'Estudio' 
  | 'Consulta' 
  | 'Laboratorio'
  | 'Otro';

export interface LabResults {
  wbc?: number;        // Glóbulos blancos (leucocitos) en x10³/µL (Rango normal: ~4.0 - 11.0)
  neutrophils?: number; // Neutrófilos absolutos o % (Rango normal: ~1.5 - 8.0 o 40% - 75%)
  hemoglobin?: number;  // Hemoglobina en g/dL (Rango normal: ~12.0 - 17.5)
  platelets?: number;   // Plaquetas en x10³/µL (Rango normal: ~150 - 450)
  cea?: number;         // Antígeno Carcinoembrionario en ng/mL (Rango normal en no fumadores: < 3.0, fumadores < 5.0) - Marcador de cáncer de pulmón
  creatinine?: number;  // Creatinina sérica en mg/dL (Rango normal: ~0.6 - 1.2)
  alt_gpt?: number;     // TGP / ALT en U/L (Hígado)
  ast_got?: number;     // TGO / AST en U/L (Hígado)
}

/** Un valor de laboratorio leído del informe (o cargado a mano), con su unidad y rango. */
export interface LabValue {
  key: string;            // clave canónica (p. ej. "hemoglobina"), para comparar entre informes
  name: string;           // nombre como figura en el informe
  value: number;
  unit?: string;
  refLow?: number;
  refHigh?: number;
  refText?: string;       // rango tal como figura en el informe
  qualifier?: '<' | '>';  // "Menor de 0.15" → value 0.15, qualifier "<"
}

export interface MedicalFile {
  id: string;
  name: string;
  type: string; // 'image/*' or 'application/pdf' or 'text/*'
  size: number;
  data: string; // Base64 string for file preview/consultation
}

export interface MedicalEvent {
  id: string;
  date: string; // YYYY-MM-DD
  type: EventType;
  title: string;
  description: string;
  professional: string;
  institution?: string;
  files?: MedicalFile[];
  notes?: string;
  labResults?: LabResults; // Optional structured lab values
  labValues?: LabValue[];  // Todos los valores del informe (lector de PDF de laboratorio)
  createdAt: string;
}

export interface SideEffectEntry {
  id: string;
  date: string;
  severity: 'Leve' | 'Moderado' | 'Severo';
  symptoms: string[];
  customSymptoms?: string;
  notes: string;
  energyLevel: number; // 1 to 10
  createdAt: string;
}

export interface MetricEntry {
  id: string;
  date: string;
  weight: number; // kg
  systolic: number; // mmHg
  diastolic: number; // mmHg
  heartRate: number; // bpm
  notes?: string;
  bmi: number; // derived but stored for history
}

export type AppointmentStatus = 'Programado' | 'Realizado' | 'Cancelado';

/** Turno de la agenda (pasado, presente o futuro). */
export interface Appointment {
  id: string;
  date: string;          // YYYY-MM-DD
  time: string;          // HH:MM (hora local)
  durationMin: number;
  specialty: string;     // libre: Odontología, Oncología, Inmunología… (se agregan a medida que se usan)
  title: string;         // motivo: "Control", "Implante – 2.ª sesión"…
  professional?: string;
  location?: string;
  notes?: string;
  status: AppointmentStatus;
  reminderMinutes: number; // aviso en el calendario; 0 = sin aviso
  seriesId?: string;       // turnos de un mismo tratamiento cargados juntos
  linkedEventId?: string;  // evento de la línea de tiempo creado al marcarlo "Realizado"
  createdAt: string;
  updatedAt: string;
  calendarAddedAt?: string; // última vez que se agregó al calendario (para avisar si cambió después)
  googleSyncedVersion?: string; // updatedAt de la versión que quedó en Google Calendar
}
