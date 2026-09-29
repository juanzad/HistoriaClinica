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
