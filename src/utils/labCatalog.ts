import { LabResults, LabValue, MedicalEvent } from '../types';

// Catálogo de parámetros: unifica los nombres que usa cada laboratorio ("Recuento de Plaquetas",
// "Plaquetas"…) en una clave, para poder comparar informes de distintas fechas o laboratorios.

export interface LabParam {
  key: string;
  label: string;
  group: string;
  match: RegExp;              // se prueba contra el nombre normalizado (minúsculas, sin acentos)
  legacy?: keyof LabResults;  // campo de la versión anterior de la app
  legacyFactor?: number;      // valor_actual = legacy × factor (p. ej. x10³/µL → /mm3)
}

export const LAB_GROUPS = ['Hemograma', 'Fórmula leucocitaria', 'Química', 'Hepatograma', 'Tiroides', 'Marcadores', 'Otros'];

export const LAB_PARAMS: LabParam[] = [
  { key: 'hematies', label: 'Hematíes', group: 'Hemograma', match: /^(hematies|globulos rojos|eritrocitos|recuento de globulos rojos)/ },
  { key: 'hemoglobina', label: 'Hemoglobina', group: 'Hemograma', match: /^hemoglobina(?! (glicosilada|corpuscular))/, legacy: 'hemoglobin', legacyFactor: 1 },
  { key: 'hematocrito', label: 'Hematocrito', group: 'Hemograma', match: /^hematocrito/ },
  { key: 'vcm', label: 'VCM', group: 'Hemograma', match: /^(v\.?c\.?m|volumen corpuscular medio)/ },
  { key: 'hcm', label: 'HCM', group: 'Hemograma', match: /^(h\.?c\.?m(?!\.?c)|hemoglobina corpuscular media)/ },
  { key: 'chcm', label: 'CHCM', group: 'Hemograma', match: /^(c\.?h\.?c\.?m|concentracion de hemoglobina corpuscular)/ },
  { key: 'ade', label: 'ADE (RDW)', group: 'Hemograma', match: /^(ade|rdw)/ },
  { key: 'plaquetas', label: 'Plaquetas', group: 'Hemograma', match: /^(recuento de plaquetas|plaquetas)/, legacy: 'platelets', legacyFactor: 1000 },
  { key: 'leucocitos', label: 'Leucocitos', group: 'Hemograma', match: /^(leucocitos|globulos blancos|recuento de leucocitos)/, legacy: 'wbc', legacyFactor: 1000 },

  { key: 'neutrofilos_pct', label: 'Neutrófilos (%)', group: 'Fórmula leucocitaria', match: /^neutrofilos( segmentados)? %$/ },
  { key: 'neutrofilos_abs', label: 'Neutrófilos (absolutos)', group: 'Fórmula leucocitaria', match: /^neutrofilos( segmentados)? absolutos$/, legacy: 'neutrophils', legacyFactor: 1000 },
  { key: 'linfocitos_pct', label: 'Linfocitos (%)', group: 'Fórmula leucocitaria', match: /^linfocitos %$/ },
  { key: 'linfocitos_abs', label: 'Linfocitos (absolutos)', group: 'Fórmula leucocitaria', match: /^linfocitos absolutos$/ },
  { key: 'monocitos_pct', label: 'Monocitos (%)', group: 'Fórmula leucocitaria', match: /^monocitos %$/ },
  { key: 'monocitos_abs', label: 'Monocitos (absolutos)', group: 'Fórmula leucocitaria', match: /^monocitos absolutos$/ },
  { key: 'eosinofilos_pct', label: 'Eosinófilos (%)', group: 'Fórmula leucocitaria', match: /^eosinofilos %$/ },
  { key: 'eosinofilos_abs', label: 'Eosinófilos (absolutos)', group: 'Fórmula leucocitaria', match: /^eosinofilos absolutos$/ },
  { key: 'basofilos_pct', label: 'Basófilos (%)', group: 'Fórmula leucocitaria', match: /^basofilos %$/ },
  { key: 'basofilos_abs', label: 'Basófilos (absolutos)', group: 'Fórmula leucocitaria', match: /^basofilos absolutos$/ },

  { key: 'glucemia', label: 'Glucemia', group: 'Química', match: /^(glucemia|glucosa)/ },
  { key: 'urea', label: 'Urea', group: 'Química', match: /^urea/ },
  { key: 'creatinina', label: 'Creatinina', group: 'Química', match: /^creatinina(?! en orina)/, legacy: 'creatinine', legacyFactor: 1 },
  { key: 'colesterol_total', label: 'Colesterol total', group: 'Química', match: /^colesterol total/ },
  { key: 'proteinas_totales', label: 'Proteínas totales', group: 'Química', match: /^proteinas totales/ },

  { key: 'bilirrubina_total', label: 'Bilirrubina total', group: 'Hepatograma', match: /^bilirrubina total/ },
  { key: 'bilirrubina_directa', label: 'Bilirrubina directa', group: 'Hepatograma', match: /^bilirrubina directa/ },
  { key: 'fosfatasa_alcalina', label: 'Fosfatasa alcalina', group: 'Hepatograma', match: /^fosfatasa alcalina/ },
  { key: 'tgo', label: 'TGO / AST', group: 'Hepatograma', match: /^(tgo|got|ast|aspartato)/, legacy: 'ast_got', legacyFactor: 1 },
  { key: 'tgp', label: 'TGP / ALT', group: 'Hepatograma', match: /^(tgp|gpt|alt|alanina)/, legacy: 'alt_gpt', legacyFactor: 1 },

  { key: 'tsh', label: 'TSH', group: 'Tiroides', match: /^(tirotrofina|tsh)/ },
  { key: 'cea', label: 'Antígeno CEA', group: 'Marcadores', match: /^(cea|antigeno carcinoembrionario)/, legacy: 'cea', legacyFactor: 1 },
];

export const normalizeName = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[:;]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();

export function findParam(name: string): LabParam | undefined {
  const n = normalizeName(name);
  return LAB_PARAMS.find((p) => p.match.test(n));
}

/** Clave canónica: la del catálogo o, si el parámetro no está, una derivada del nombre. */
export function keyFor(name: string) {
  return findParam(name)?.key ?? normalizeName(name).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export function paramInfo(key: string, fallbackName: string) {
  const p = LAB_PARAMS.find((x) => x.key === key);
  return { label: p?.label ?? fallbackName, group: p?.group ?? 'Otros' };
}

/** Completa los campos de la versión anterior (labResults) para que el resto de la app siga funcionando. */
export function legacyResults(values: LabValue[]): LabResults {
  const out: LabResults = {};
  for (const p of LAB_PARAMS) {
    if (!p.legacy) continue;
    const v = values.find((x) => x.key === p.key);
    if (v) out[p.legacy] = Math.round((v.value / (p.legacyFactor ?? 1)) * 1000) / 1000;
  }
  return out;
}

/** Valores de un evento: los del lector de PDF o, en eventos viejos, los de labResults. */
export function eventLabValues(e: MedicalEvent): LabValue[] {
  if (e.labValues?.length) return e.labValues;
  if (!e.labResults) return [];
  return LAB_PARAMS.flatMap((p) => {
    const raw = p.legacy ? e.labResults?.[p.legacy] : undefined;
    return typeof raw === 'number' ? [{ key: p.key, name: p.label, value: raw * (p.legacyFactor ?? 1) }] : [];
  });
}

// ---------------------------------------------------------------------------
// Evolución de cada parámetro
// ---------------------------------------------------------------------------

export interface LabPoint {
  date: string;
  value: number;
  qualifier?: '<' | '>';
  eventId: string;
}

export type RangeStatus = 'normal' | 'bajo' | 'alto' | 'sin rango';
export type Evolution = 'en rango' | 'volvió al rango' | 'salió del rango' | 'mejora' | 'empeora' | 'sin cambios' | 'primer valor' | 'sin rango';
export type Trend = 'sube' | 'baja' | 'estable' | '—';

export interface LabSeries {
  key: string;
  label: string;
  group: string;
  unit?: string;
  refLow?: number;
  refHigh?: number;
  refText?: string;
  points: LabPoint[]; // de la más antigua a la más reciente
  last: LabPoint;
  prev?: LabPoint;
  first: LabPoint;
  min: number;
  max: number;
  changePrevPct?: number;
  changeFirstPct?: number;
  status: RangeStatus;
  evolution: Evolution;
  trend: Trend;
}

const rangeStatus = (v: number, low?: number, high?: number): RangeStatus => {
  if (low === undefined && high === undefined) return 'sin rango';
  if (low !== undefined && v < low) return 'bajo';
  if (high !== undefined && v > high) return 'alto';
  return 'normal';
};

/** Cuánto se aleja del rango, relativo al valor de referencia (0 = dentro del rango). */
const distance = (v: number, low?: number, high?: number) => {
  if (low !== undefined && v < low) return (low - v) / Math.max(Math.abs(low), 1e-9);
  if (high !== undefined && v > high) return (v - high) / Math.max(Math.abs(high), 1e-9);
  return 0;
};

const pct = (a: number, b: number) => (b === 0 ? undefined : ((a - b) / Math.abs(b)) * 100);

export function buildLabSeries(events: MedicalEvent[]): LabSeries[] {
  const byKey = new Map<string, { name: string; unit?: string; refLow?: number; refHigh?: number; refText?: string; points: LabPoint[] }>();
  const labs = events.filter((e) => e.type === 'Laboratorio').sort((a, b) => a.date.localeCompare(b.date));
  for (const e of labs) {
    for (const v of eventLabValues(e)) {
      const entry = byKey.get(v.key) ?? { name: v.name, points: [] };
      entry.points.push({ date: e.date, value: v.value, qualifier: v.qualifier, eventId: e.id });
      // Unidad y rango: los del informe más reciente que los traiga.
      if (v.unit) entry.unit = v.unit;
      if (v.refLow !== undefined || v.refHigh !== undefined) {
        entry.refLow = v.refLow;
        entry.refHigh = v.refHigh;
        entry.refText = v.refText;
      }
      byKey.set(v.key, entry);
    }
  }

  return Array.from(byKey.entries()).map(([key, s]) => {
    const { label, group } = paramInfo(key, s.name);
    const points = s.points;
    const last = points[points.length - 1];
    const prev = points.length > 1 ? points[points.length - 2] : undefined;
    const first = points[0];
    const values = points.map((p) => p.value);
    const status = rangeStatus(last.value, s.refLow, s.refHigh);

    let evolution: Evolution;
    if (!prev) evolution = status === 'sin rango' ? 'sin rango' : 'primer valor';
    else if (status === 'sin rango') evolution = 'sin rango';
    else {
      const dNow = distance(last.value, s.refLow, s.refHigh);
      const dPrev = distance(prev.value, s.refLow, s.refHigh);
      if (dNow === 0 && dPrev === 0) evolution = 'en rango';
      else if (dNow === 0) evolution = 'volvió al rango';
      else if (dPrev === 0) evolution = 'salió del rango';
      else if (dNow < dPrev - 0.01) evolution = 'mejora';
      else if (dNow > dPrev + 0.01) evolution = 'empeora';
      else evolution = 'sin cambios';
    }

    // Tendencia de todo el período: cambio según la recta de mínimos cuadrados. Se considera
    // "estable" si es menor al 10 % del ancho del rango normal (o al 5 % del promedio si no hay rango):
    // así un valor que se mueve en un rango estrecho, como la hemoglobina, no parece estable cuando baja.
    let trend: Trend = '—';
    if (points.length >= 2) {
      const xs = points.map((p) => new Date(p.date).getTime() / 86_400_000);
      const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
      const my = values.reduce((a, b) => a + b, 0) / values.length;
      const den = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
      const slope = den === 0 ? 0 : xs.reduce((a, x, i) => a + (x - mx) * (values[i] - my), 0) / den;
      const totalChange = slope * (xs[xs.length - 1] - xs[0]);
      const width = s.refLow !== undefined && s.refHigh !== undefined ? s.refHigh - s.refLow : s.refHigh ?? undefined;
      const threshold = width && width > 0 ? width * 0.1 : Math.abs(my) * 0.05;
      trend = Math.abs(totalChange) < threshold ? 'estable' : totalChange > 0 ? 'sube' : 'baja';
    }

    return {
      key, label, group, unit: s.unit, refLow: s.refLow, refHigh: s.refHigh, refText: s.refText,
      points, last, prev, first,
      min: Math.min(...values), max: Math.max(...values),
      // Con "menor de"/"mayor de" no hay un valor exacto: no se calcula el porcentaje.
      changePrevPct: prev && !last.qualifier && !prev.qualifier ? pct(last.value, prev.value) : undefined,
      changeFirstPct: points.length > 1 && !last.qualifier && !first.qualifier ? pct(last.value, first.value) : undefined,
      status, evolution, trend,
    };
  }).sort((a, b) => {
    const g = LAB_GROUPS.indexOf(a.group) - LAB_GROUPS.indexOf(b.group);
    if (g !== 0) return g;
    const ia = LAB_PARAMS.findIndex((p) => p.key === a.key);
    const ib = LAB_PARAMS.findIndex((p) => p.key === b.key);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib) || a.label.localeCompare(b.label);
  });
}
