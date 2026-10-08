import React, { useMemo, useState } from 'react';
import { FileUp, X, Loader2, AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { MedicalEvent, MedicalFile } from '../types';
import { readLabPdf, toNumber, ParsedLabReport, ParsedLabValue } from '../utils/labPdfParser';
import { eventLabValues } from '../utils/labCatalog';

export interface LabImportItem {
  report: ParsedLabReport & { date: string };
  values: ParsedLabValue[];
  file: MedicalFile;
  /** Evento de laboratorio existente del mismo día, que se completa en lugar de duplicarlo. */
  mergeIntoEventId?: string;
}

interface Props {
  events: MedicalEvent[];
  onImport: (items: LabImportItem[]) => void;
  onClose: () => void;
}

interface Draft {
  fileName: string;
  file: MedicalFile;
  report: ParsedLabReport;
  date: string;
  checked: Record<string, boolean>;
  edited: Record<string, string>;
  error?: string;
}

const fmt = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 3 });

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

function statusOf(v: ParsedLabValue, value: number) {
  if (v.refLow !== undefined && value < v.refLow) return 'bajo';
  if (v.refHigh !== undefined && value > v.refHigh) return 'alto';
  return v.refLow === undefined && v.refHigh === undefined ? '' : 'normal';
}

export default function LabImportModal({ events, onImport, onClose }: Props) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(false);

  const historyKeys = useMemo(
    () => new Set(events.filter((e) => e.type === 'Laboratorio').flatMap((e) => eventLabValues(e).map((v) => v.key))),
    [events]
  );

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;
    setLoading(true);
    const parsed: Draft[] = [];
    for (const f of files) {
      try {
        const report = await readLabPdf(f);
        const data = await readAsDataUrl(f);
        parsed.push({
          fileName: f.name,
          file: { id: 'file-' + crypto.randomUUID(), name: f.name, type: f.type || 'application/pdf', size: f.size, data },
          report,
          date: report.date ?? '',
          checked: {},
          edited: {},
          error: report.values.length === 0 ? 'No se encontraron valores en este PDF.' : undefined,
        });
      } catch (err: any) {
        parsed.push({
          fileName: f.name, file: { id: '', name: f.name, type: '', size: 0, data: '' },
          report: { values: [], observations: [] }, date: '', checked: {}, edited: {},
          error: err?.message || 'No se pudo leer el PDF.',
        });
      }
    }
    // Selección inicial: parámetros conocidos, los que ya están en el historial o los que se repiten
    // entre los archivos cargados. Lo que aparece en un solo estudio especial queda sin marcar.
    const all = [...drafts, ...parsed];
    const countByKey = new Map<string, number>();
    for (const d of all) for (const v of d.report.values) countByKey.set(v.key, (countByKey.get(v.key) ?? 0) + 1);
    for (const d of parsed) {
      for (const v of d.report.values) {
        d.checked[v.key] = v.known || historyKeys.has(v.key) || (countByKey.get(v.key) ?? 0) > 1;
      }
    }
    setDrafts(all);
    setLoading(false);
  };

  const update = (i: number, change: Partial<Draft>) => setDrafts((ds) => ds.map((d, j) => (j === i ? { ...d, ...change } : d)));

  const sameDayEvent = (date: string) =>
    events.find((e) => e.type === 'Laboratorio' && e.date === date);

  const valid = drafts.filter((d) => !d.error && d.date && Object.values(d.checked).some(Boolean));

  const confirm = () => {
    onImport(valid.map((d) => {
      const values = d.report.values
        .filter((v) => d.checked[v.key])
        .map((v) => {
          const edited = d.edited[v.key];
          const n = edited !== undefined ? toNumber(edited) : v.value;
          return { ...v, value: n ?? v.value };
        });
      return { report: { ...d.report, date: d.date }, values, file: d.file, mergeIntoEventId: sameDayEvent(d.date)?.id };
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 my-6" id="lab-import-modal">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-bold text-lg text-slate-900">Cargar análisis desde PDF</h3>
            <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-green-600" />
              El PDF se lee en este dispositivo: no se envía a ningún servicio. Revisa los valores antes de guardar.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer" aria-label="Cerrar"><X className="w-5 h-5" /></button>
        </div>

        <label className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-xl p-5 cursor-pointer text-sm font-semibold text-slate-600" id="lab-pdf-input">
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileUp className="w-5 h-5 text-blue-600" />}
          {loading ? 'Leyendo…' : drafts.length ? 'Agregar más PDFs' : 'Elegir uno o varios PDFs del laboratorio'}
          <input type="file" accept="application/pdf,.pdf" multiple className="hidden" onChange={handleFiles} />
        </label>

        {drafts.map((d, i) => {
          const merge = d.date ? sameDayEvent(d.date) : undefined;
          const selected = Object.values(d.checked).filter(Boolean).length;
          return (
            <section key={i} className="border border-slate-200 rounded-xl overflow-hidden" data-testid="lab-draft">
              <div className="bg-slate-50 px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                <span className="font-bold text-slate-800 truncate max-w-[240px]" title={d.fileName}>{d.fileName}</span>
                {!d.error && (
                  <>
                    <label className="flex items-center gap-1.5 text-xs text-slate-600">
                      Fecha
                      <input type="date" value={d.date} onChange={(e) => update(i, { date: e.target.value })} className="border border-slate-200 rounded-lg px-2 py-1 bg-white" />
                    </label>
                    {d.report.laboratory && <span className="text-xs text-slate-500">{d.report.laboratory}</span>}
                    {d.report.doctor && <span className="text-xs text-slate-500">Dr/a. {d.report.doctor}</span>}
                    <span className="text-xs font-semibold text-slate-600">{selected} de {d.report.values.length} valores marcados</span>
                  </>
                )}
                <button onClick={() => setDrafts((ds) => ds.filter((_, j) => j !== i))} className="ml-auto text-xs text-slate-400 hover:text-red-600 cursor-pointer">Quitar</button>
              </div>
              {d.error ? (
                <p className="px-4 py-3 text-sm text-red-700 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{d.error}</p>
              ) : (
                <>
                  {merge && (
                    <p className="px-4 py-2 text-xs text-blue-800 bg-blue-50 border-b border-blue-100" data-testid="merge-note">
                      Ya hay un análisis del {d.date.split('-').reverse().join('/')} en tu historial ("{merge.title}"): se completará con estos valores en lugar de duplicarlo.
                    </p>
                  )}
                  {!d.date && <p className="px-4 py-2 text-xs text-amber-800 bg-amber-50">No se encontró la fecha en el PDF: complétala arriba.</p>}
                  <div className="flex gap-3 px-4 pt-2 text-xs">
                    <button onClick={() => update(i, { checked: Object.fromEntries(d.report.values.map((v) => [v.key, true])) })} className="font-semibold text-blue-600 cursor-pointer">Marcar todos</button>
                    <button onClick={() => update(i, { checked: Object.fromEntries(d.report.values.map((v) => [v.key, false])) })} className="font-semibold text-slate-500 cursor-pointer">Desmarcar todos</button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="text-slate-400 uppercase tracking-wider text-[10px]">
                        <tr><th className="p-2 w-8"></th><th className="p-2 text-left">Parámetro</th><th className="p-2 text-right">Valor</th><th className="p-2 text-left">Unidad</th><th className="p-2 text-left">Referencia</th><th className="p-2"></th></tr>
                      </thead>
                      <tbody>
                        {d.report.values.map((v) => {
                          const shown = d.edited[v.key] ?? fmt(v.value);
                          const st = statusOf(v, toNumber(shown) ?? v.value);
                          return (
                            <tr key={v.key} className={`border-t border-slate-100 ${d.checked[v.key] ? '' : 'opacity-50'}`} data-testid="lab-row" data-key={v.key}>
                              <td className="p-2 text-center">
                                <input type="checkbox" checked={!!d.checked[v.key]} onChange={(e) => update(i, { checked: { ...d.checked, [v.key]: e.target.checked } })} aria-label={`Incluir ${v.name}`} />
                              </td>
                              <td className="p-2 font-semibold text-slate-700">{v.name}{!v.known && <span className="ml-1 text-[10px] font-normal text-slate-400">(nuevo)</span>}</td>
                              <td className="p-2 text-right">
                                <span className="text-slate-400">{v.qualifier ?? ''}</span>
                                <input value={shown} onChange={(e) => update(i, { edited: { ...d.edited, [v.key]: e.target.value } })} className="w-24 text-right border border-slate-200 rounded px-1.5 py-0.5 font-mono" />
                              </td>
                              <td className="p-2 text-slate-500">{v.unit}</td>
                              <td className="p-2 text-slate-500">{v.refText}</td>
                              <td className="p-2">
                                {(st === 'bajo' || st === 'alto') && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">{st === 'bajo' ? '↓ Bajo' : '↑ Alto'}</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {d.report.observations.length > 0 && (
                    <p className="px-4 py-2 text-xs text-slate-600 border-t border-slate-100">Observaciones: {d.report.observations.join(' · ')}</p>
                  )}
                </>
              )}
            </section>
          );
        })}

        {drafts.length > 0 && (
          <button
            onClick={confirm}
            disabled={valid.length === 0}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 cursor-pointer"
            id="btn-confirm-lab-import"
          >
            <CheckCircle2 className="w-4 h-4" />
            Guardar {valid.length} {valid.length === 1 ? 'análisis' : 'análisis'} en mi historial
          </button>
        )}
      </div>
    </div>
  );
}
