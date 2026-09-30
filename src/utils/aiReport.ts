import { PersonalData, MedicalEvent, SideEffectEntry, MetricEntry, LabResults } from '../types';

// Informe en texto para pegar en un chat de IA elegido por el usuario. La app no envía nada:
// el usuario decide qué compartir y dónde. En modo anónimo se omiten nombre, fecha de
// nacimiento, profesionales, instituciones y nombres de archivos.

const LAB_ROWS: Array<{ key: keyof LabResults; name: string; unit: string; range: string }> = [
  { key: 'cea', name: 'Antígeno CEA', unit: 'ng/mL', range: '< 3.0' },
  { key: 'wbc', name: 'Glóbulos blancos', unit: 'x10³/µL', range: '4.0 - 11.0' },
  { key: 'neutrophils', name: 'Neutrófilos absolutos', unit: 'x10³/µL', range: '1.5 - 8.0' },
  { key: 'hemoglobin', name: 'Hemoglobina', unit: 'g/dL', range: '12.0 - 17.5' },
  { key: 'platelets', name: 'Plaquetas', unit: 'x10³/µL', range: '150 - 450' },
  { key: 'creatinine', name: 'Creatinina', unit: 'mg/dL', range: '0.6 - 1.2' },
  { key: 'alt_gpt', name: 'TGP / ALT', unit: 'U/L', range: '< 41' },
  { key: 'ast_got', name: 'TGO / AST', unit: 'U/L', range: '< 40' },
];

const byDateAsc = (a: { date: string }, b: { date: string }) =>
  new Date(a.date).getTime() - new Date(b.date).getTime();

const oneLine = (text?: string) => (text ?? '').replace(/\s*\n\s*/g, ' ').trim();

export interface AiReportInput {
  personalData: PersonalData;
  events: MedicalEvent[];
  sideEffects: SideEffectEntry[];
  metrics: MetricEntry[];
}

export function buildAiReport({ personalData: p, events, sideEffects, metrics }: AiReportInput, anonymous: boolean): string {
  const out: string[] = [];
  const today = new Date().toISOString().slice(0, 10);

  out.push(`# Informe de seguimiento de salud (${today})`);
  out.push('Datos registrados por el propio paciente en su bitácora. Fechas en formato AAAA-MM-DD, de la más antigua a la más reciente.');
  out.push('');

  out.push('## Paciente');
  if (!anonymous) {
    out.push(`- Nombre: ${p.fullName || 'no indicado'}`);
    if (p.birthDate) out.push(`- Fecha de nacimiento: ${p.birthDate}`);
  }
  if (p.age) out.push(`- Edad: ${p.age} años`);
  if (p.weight || p.height) out.push(`- Peso / altura: ${p.weight || '?'} kg / ${p.height || '?'} cm`);
  if (p.bloodType) out.push(`- Grupo sanguíneo: ${p.bloodType}`);
  if (p.diagnosis) out.push(`- Diagnóstico: ${oneLine(p.diagnosis)}`);
  if (p.treatment) out.push(`- Tratamiento actual: ${oneLine(p.treatment)}`);
  if (p.allergies) out.push(`- Alergias: ${oneLine(p.allergies)}`);
  out.push('');

  const nonLab = events.filter((e) => e.type !== 'Laboratorio').sort(byDateAsc);
  out.push(`## Eventos clínicos (${nonLab.length})`);
  if (nonLab.length === 0) out.push('Sin eventos registrados.');
  for (const e of nonLab) {
    const who = anonymous ? '' : [e.professional, e.institution].filter(Boolean).join(', ');
    out.push(`- ${e.date} · ${e.type} · ${oneLine(e.title)}${who ? ` (${who})` : ''}`);
    if (e.description) out.push(`  - Descripción: ${oneLine(e.description)}`);
    if (e.notes) out.push(`  - Notas: ${oneLine(e.notes)}`);
  }
  out.push('');

  const labs = events.filter((e) => e.type === 'Laboratorio').sort(byDateAsc);
  out.push(`## Análisis de laboratorio (${labs.length})`);
  if (labs.length === 0) out.push('Sin análisis registrados.');
  for (const e of labs) {
    out.push(`- ${e.date} · ${oneLine(e.title)}${!anonymous && e.institution ? ` (${e.institution})` : ''}`);
    const values = LAB_ROWS.filter((r) => typeof e.labResults?.[r.key] === 'number').map(
      (r) => `${r.name}: ${e.labResults![r.key]} ${r.unit} (ref. ${r.range})`
    );
    if (values.length) out.push(`  - Valores: ${values.join('; ')}`);
    if (e.description) out.push(`  - Resumen: ${oneLine(e.description)}`);
    if (e.notes) out.push(`  - Notas: ${oneLine(e.notes)}`);
  }
  out.push('');

  const effects = [...sideEffects].sort(byDateAsc);
  out.push(`## Efectos secundarios (${effects.length})`);
  if (effects.length === 0) out.push('Sin registros.');
  for (const s of effects) {
    const symptoms = [...s.symptoms, s.customSymptoms].filter(Boolean).join(', ') || 'sin síntomas indicados';
    out.push(`- ${s.date} · Severidad ${s.severity} · Energía ${s.energyLevel}/10 · ${symptoms}`);
    if (s.notes) out.push(`  - Notas: ${oneLine(s.notes)}`);
  }
  out.push('');

  const ms = [...metrics].sort(byDateAsc);
  out.push(`## Métricas corporales (${ms.length})`);
  if (ms.length === 0) out.push('Sin registros.');
  for (const m of ms) {
    out.push(
      `- ${m.date} · Peso ${m.weight} kg · IMC ${m.bmi} · Presión ${m.systolic}/${m.diastolic} mmHg · FC ${m.heartRate} lpm` +
        (m.notes ? ` · ${oneLine(m.notes)}` : '')
    );
  }

  return out.join('\n');
}
