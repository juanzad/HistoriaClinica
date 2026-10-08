import { LabValue } from '../types';
import { findParam, keyFor } from './labCatalog';

// Lector de informes de laboratorio en PDF, sin IA y sin enviar nada fuera del dispositivo.
// Trabaja sobre el texto del PDF con su posición: cada fila tiene el nombre a la izquierda,
// el valor y la unidad al centro y el rango de referencia a la derecha (formato de
// Diagnóstico Maipú y de la mayoría de los laboratorios). Lo leído siempre se revisa antes de guardar.

export interface PdfTextItem {
  str: string;
  x: number;
  y: number;
  page: number;
}

export interface ParsedLabValue extends LabValue {
  /** Parámetro del catálogo (comparable entre informes). */
  known: boolean;
}

export interface ParsedLabReport {
  date?: string;        // YYYY-MM-DD
  doctor?: string;
  laboratory?: string;
  observations: string[];
  values: ParsedLabValue[];
}

// Columnas (en puntos; una página A4/carta mide ~595 de ancho).
const NAME_MAX_X = 150;
const RANGE_MIN_X = 400;
const ROW_TOLERANCE = 3;

const VALUE_RE = /^(menor de|menor a|mayor de|mayor a|<|>)?\s*(\d[\d.,]*)$/i;
const SKIP_NAME_RE = /^(m[eé]todo|metodo|muestra|sustrato|paciente|documento|fecha de nac|instituci[oó]n|p[aá]gina|-{5,}|diferencial leucocitario|laboratorio adherido|estimad|ante cualquier|la linea directa|lunes a viernes|mail:)/i;
const VALUE_HOLDER_RE = /^(m[eé]todo|metodo|muestra|resultado|interpretaci[oó]n)/i;

/** "13,4" → 13.4 · "4570000" → 4570000 · "4.570.000" → 4570000 · "0.15" → 0.15 */
export function toNumber(text: string): number | undefined {
  const t = text.trim();
  if (!/\d/.test(t)) return undefined;
  const normalized = /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t) ? t.replace(/\./g, '').replace(',', '.') : t.replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : undefined;
}

function parseValue(text: string): { value: number; qualifier?: '<' | '>' } | undefined {
  const m = text.trim().match(VALUE_RE);
  if (!m) return undefined;
  const value = toNumber(m[2]);
  if (value === undefined) return undefined;
  const q = m[1]?.toLowerCase();
  return { value, qualifier: q ? (q.startsWith('menor') || q === '<' ? '<' : '>') : undefined };
}

/** Rango de una línea: "13,2-16,8", "0.27 a 4.20", "hasta 71", "Menor de 200", "Adultos:41-69 %". */
export function parseRange(line: string): { refLow?: number; refHigh?: number } | undefined {
  const t = line.replace(/^(adultos|deseable|valor normal|v\.?\s*r\.?|referencia|negativo|no reactivo)\s*:?\s*/i, '').trim();
  const between = t.match(/(\d[\d.,]*)\s*(?:-|–|a)\s*(\d[\d.,]*)/);
  if (between) {
    const low = toNumber(between[1]);
    const high = toNumber(between[2]);
    if (low !== undefined && high !== undefined && low <= high) return { refLow: low, refHigh: high };
  }
  const upTo = t.match(/^(?:hasta|menor de|menor a|inferior a|<)\s*(\d[\d.,]*)/i);
  if (upTo) return { refHigh: toNumber(upTo[1]) };
  const from = t.match(/^(?:desde|mayor de|mayor a|superior a|>)\s*(\d[\d.,]*)/i);
  if (from) return { refLow: toNumber(from[1]) };
  return undefined;
}

/** Elige la línea de referencia de adultos (o la "deseable") entre las del informe. */
function chooseRange(lines: string[]): { refLow?: number; refHigh?: number; refText?: string } {
  const candidates = [
    ...lines.filter((l) => /^adultos/i.test(l)),
    ...lines.filter((l) => /deseable/i.test(l)),
    ...lines.filter((l) => /^(negativo|no reactivo)/i.test(l)),
    ...lines.filter((l) => !/ni[nñ]os|meses|d[ií]as:|indeterminado|positivo|^reactivo|zona gris/i.test(l)),
  ];
  for (const line of candidates) {
    const r = parseRange(line);
    if (r) return { ...r, refText: line.trim() };
  }
  return lines.length ? { refText: lines.join(' · ') } : {};
}

interface Cell {
  text: string;
  x: number;
}

function toRows(items: PdfTextItem[]): Cell[][] {
  const rows: Array<{ page: number; y: number; cells: Cell[] }> = [];
  const sorted = items
    .filter((i) => i.str.trim())
    .sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x);
  for (const it of sorted) {
    const row = rows.find((r) => r.page === it.page && Math.abs(r.y - it.y) <= ROW_TOLERANCE);
    if (row) row.cells.push({ text: it.str.trim(), x: it.x });
    else rows.push({ page: it.page, y: it.y, cells: [{ text: it.str.trim(), x: it.x }] });
  }
  return rows
    .sort((a, b) => a.page - b.page || b.y - a.y)
    .map((r) => r.cells.sort((a, b) => a.x - b.x));
}

const cleanName = (name: string) => name.replace(/[:\s]+$/, '').replace(/\s+/g, ' ').trim();

export function parseLabItems(items: PdfTextItem[]): ParsedLabReport {
  const report: ParsedLabReport = { observations: [], values: [] };
  const allText = items.map((i) => i.str).join(' ');
  if (/diagnosticomaipu|diagn[oó]stico maip[uú]/i.test(allText)) report.laboratory = 'Diagnóstico Maipú';

  // Resultados en armado: cada uno junta las líneas de rango que le siguen.
  type Pending = { name: string; value: number; qualifier?: '<' | '>'; unit?: string; refLines: string[]; kind?: 'pct' | 'abs' };
  const results: Pending[] = [];
  let current: Pending[] = [];
  let pendingName: string | undefined;

  for (const cells of toRows(items)) {
    const rowText = cells.map((c) => c.text).join(' ');

    // Encabezado: fecha, profesional.
    const date = rowText.match(/Fecha(?: y Orden)?\s*:?\s*(\d{2})\/(\d{2})\/(\d{4})/i);
    if (date && !/nac/i.test(rowText)) {
      report.date ??= `${date[3]}-${date[2]}-${date[1]}`;
      continue;
    }
    const doctor = rowText.match(/Dr\.?\s*\/\s*Dra\.?\s*:\s*(.+)/i);
    if (doctor) {
      report.doctor ??= doctor[1].trim();
      continue;
    }

    const nameCells = cells.filter((c) => c.x < NAME_MAX_X);
    const midCells = cells.filter((c) => c.x >= NAME_MAX_X && c.x < RANGE_MIN_X);
    const rangeCells = cells.filter((c) => c.x >= RANGE_MIN_X).map((c) => c.text);
    const name = cleanName(nameCells.map((c) => c.text).join(' '));

    const obs = name.match(/^Observaciones\s*:?\s*(.*)$/i);
    if (obs) {
      const text = [obs[1], ...midCells.map((c) => c.text), ...rangeCells].join(' ').trim();
      if (text) report.observations.push(text);
      current = [];
      continue;
    }

    // Valores numéricos de la columna central (con su unidad a la derecha).
    const values: Array<{ value: number; qualifier?: '<' | '>'; unit?: string }> = [];
    for (let i = 0; i < midCells.length; i++) {
      const v = parseValue(midCells[i].text);
      if (!v) continue;
      const next = midCells[i + 1];
      const unit = next && !parseValue(next.text) ? next.text : undefined;
      values.push({ ...v, unit });
    }

    const holderRow = !name || VALUE_HOLDER_RE.test(name);
    const resultName = name && !holderRow && !SKIP_NAME_RE.test(name) ? name : holderRow && values.length ? pendingName : undefined;

    if (resultName && values.length) {
      // Fórmula leucocitaria: "Neutrófilos  55,0 %  3014 /mm3" → porcentaje y absolutos.
      if (values.length >= 2 && values[0].unit?.includes('%')) {
        current = [
          { name: `${resultName} %`, ...values[0], refLines: [], kind: 'pct' },
          { name: `${resultName} absolutos`, ...values[1], refLines: [], kind: 'abs' },
        ];
      } else {
        current = [{ name: resultName, ...values[0], refLines: [] }];
      }
      results.push(...current);
      pendingName = undefined;
    } else if (name && !holderRow && !SKIP_NAME_RE.test(name)) {
      // Nombre sin valor: título de sección o parámetro cuyo valor viene en la fila siguiente.
      pendingName = name;
      current = [];
    }

    // Líneas de rango (pueden ocupar varias filas debajo del resultado).
    for (const line of rangeCells) {
      if (current.length === 2) {
        const target = /\/mm3|\/µl|\/ul/i.test(line) ? current[1] : /%/.test(line) ? current[0] : undefined;
        target?.refLines.push(line.replace(/\/mm3\.?$/i, '').trim());
      } else if (current.length === 1) {
        current[0].refLines.push(line);
      }
    }
  }

  const seen = new Set<string>();
  for (const r of results) {
    const key = keyFor(r.name);
    if (seen.has(key)) continue;
    seen.add(key);
    const range = chooseRange(r.refLines);
    report.values.push({
      key,
      name: r.name,
      value: r.value,
      qualifier: r.qualifier,
      unit: r.unit,
      refLow: range.refLow,
      refHigh: range.refHigh,
      refText: range.refText,
      known: Boolean(findParam(r.name)),
    });
  }
  return report;
}

/** Lee un PDF en el navegador (pdf.js) y devuelve sus valores. El archivo no sale del dispositivo. */
export async function readLabPdf(file: File): Promise<ParsedLabReport> {
  // Versión "legacy" de pdf.js: incluye compatibilidad con navegadores no tan nuevos (p. ej. Safari de iPhone).
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const worker = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const items: PdfTextItem[] = [];
  for (let page = 1; page <= pdf.numPages; page++) {
    const content = await (await pdf.getPage(page)).getTextContent();
    for (const it of content.items) {
      if ('str' in it && it.str.trim()) items.push({ str: it.str, x: it.transform[4], y: it.transform[5], page });
    }
  }
  if (items.length === 0) {
    throw new Error('El PDF no tiene texto (parece una foto o un escaneo). Por ahora solo se leen PDFs descargados del laboratorio.');
  }
  return parseLabItems(items);
}
