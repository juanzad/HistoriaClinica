import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceArea, ReferenceLine,
} from 'recharts';
import { FlaskConical, FileUp, ChevronDown, ChevronRight, ArrowUpRight, ArrowDownRight, Minus, AlertTriangle, Info } from 'lucide-react';
import { MedicalEvent } from '../types';
import { buildLabSeries, LabSeries, Evolution, LAB_GROUPS } from '../utils/labCatalog';
import LabImportModal, { LabImportItem } from './LabImportModal';

interface Props {
  events: MedicalEvent[];
  onImport: (items: LabImportItem[]) => void;
}

const TREATMENT_TYPES = ['Cirugía', 'Quimioterapia', 'Radioterapia', 'Inmunoterapia'];
const SERIES_COLOR = '#2563eb';
const OUT_COLOR = '#c2410c';
const BAND_COLOR = '#16a34a';

const fmt = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: n >= 100 ? 0 : 2 });
const fmtDate = (d: string) => d.split('-').reverse().join('/');
const shortDate = (t: number) => new Date(t).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' });
const dayTime = (d: string) => new Date(`${d}T12:00:00`).getTime();
const signedPct = (p?: number) => (p === undefined ? '—' : `${p > 0 ? '+' : ''}${p.toFixed(1).replace('.', ',')} %`);

const EVOLUTION_VIEW: Record<Evolution, { text: string; cls: string }> = {
  'en rango': { text: 'En rango', cls: 'text-slate-500' },
  'volvió al rango': { text: '✓ Volvió al rango', cls: 'text-green-700 font-semibold' },
  'salió del rango': { text: '⚠ Salió del rango', cls: 'text-orange-700 font-semibold' },
  'mejora': { text: '↗ Se acerca al rango', cls: 'text-green-700' },
  'empeora': { text: '↘ Se aleja del rango', cls: 'text-orange-700' },
  'sin cambios': { text: 'Fuera de rango, sin cambios', cls: 'text-orange-700' },
  'primer valor': { text: 'Primer valor', cls: 'text-slate-400' },
  'sin rango': { text: 'Sin rango de referencia', cls: 'text-slate-400' },
};

function rangeLabel(s: LabSeries) {
  if (s.refLow !== undefined && s.refHigh !== undefined) return `${fmt(s.refLow)} – ${fmt(s.refHigh)}`;
  if (s.refHigh !== undefined) return `hasta ${fmt(s.refHigh)}`;
  if (s.refLow !== undefined) return `desde ${fmt(s.refLow)}`;
  return '—';
}

function StatusBadge({ s }: { s: LabSeries }) {
  if (s.status === 'bajo' || s.status === 'alto') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-800">
        <AlertTriangle className="w-3 h-3" />{s.status === 'bajo' ? 'Bajo' : 'Alto'}
      </span>
    );
  }
  return null;
}

function TrendIcon({ s }: { s: LabSeries }) {
  if (s.trend === 'sube') return <span className="inline-flex items-center gap-0.5 text-slate-600"><ArrowUpRight className="w-3.5 h-3.5" />Sube</span>;
  if (s.trend === 'baja') return <span className="inline-flex items-center gap-0.5 text-slate-600"><ArrowDownRight className="w-3.5 h-3.5" />Baja</span>;
  if (s.trend === 'estable') return <span className="inline-flex items-center gap-0.5 text-slate-500"><Minus className="w-3.5 h-3.5" />Estable</span>;
  return <span className="text-slate-300">—</span>;
}

function SeriesChart({ s, treatments }: { s: LabSeries; treatments: MedicalEvent[] }) {
  const data = s.points.map((p) => ({ t: dayTime(p.date), value: p.value, date: p.date, qualifier: p.qualifier }));
  const t0 = data[0].t;
  const t1 = data[data.length - 1].t;
  const pad = Math.max((t1 - t0) * 0.06, 86_400_000 * 5);
  const domain: [number, number] = [t0 - pad, t1 + pad];
  const marks = treatments.filter((e) => {
    const t = dayTime(e.date);
    return t >= domain[0] && t <= domain[1];
  });
  const outOfRange = (v: number) => (s.refLow !== undefined && v < s.refLow) || (s.refHigh !== undefined && v > s.refHigh);

  return (
    <div className="space-y-1" data-testid="lab-chart">
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 18, right: 16, bottom: 4, left: 4 }}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="t" type="number" domain={domain} scale="time" tickFormatter={shortDate} tick={{ fontSize: 10, fill: '#64748b' }} stroke="#cbd5e1" />
            {/* Escala automática con valores redondos; la franja del rango normal la amplía si hace falta. */}
            <YAxis domain={['auto', 'auto']} tickFormatter={(v) => fmt(v)} tick={{ fontSize: 10, fill: '#64748b' }} stroke="#cbd5e1" width={56} />
            {(s.refLow !== undefined || s.refHigh !== undefined) && (
              <ReferenceArea y1={s.refLow ?? 0} y2={s.refHigh} fill={BAND_COLOR} fillOpacity={0.09} stroke="none" ifOverflow="extendDomain" />
            )}
            {marks.map((e) => (
              <ReferenceLine key={e.id} x={dayTime(e.date)} stroke="#94a3b8" strokeDasharray="4 3"
                label={{ value: e.type === 'Inmunoterapia' ? 'Inmuno' : e.type === 'Quimioterapia' ? 'Quimio' : e.type === 'Radioterapia' ? 'Radio' : 'Cirugía', position: 'top', fontSize: 9, fill: '#64748b' }} />
            ))}
            <Tooltip
              labelFormatter={(t) => fmtDate(new Date(Number(t)).toISOString().slice(0, 10))}
              formatter={(v: number, _n, item: any) => [`${item?.payload?.qualifier ?? ''}${fmt(v)} ${s.unit ?? ''}${outOfRange(v) ? ' (fuera de rango)' : ''}`, s.label]}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Line
              type="linear" dataKey="value" stroke={SERIES_COLOR} strokeWidth={2} isAnimationActive={false}
              dot={(props: any) => {
                const out = outOfRange(props.payload.value);
                return <circle key={props.index} cx={props.cx} cy={props.cy} r={out ? 5 : 4} fill={out ? OUT_COLOR : SERIES_COLOR} stroke="#fff" strokeWidth={2} />;
              }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[10px] text-slate-500 flex flex-wrap gap-x-4">
        <span><span className="inline-block w-3 h-2 align-middle mr-1" style={{ background: BAND_COLOR, opacity: 0.25 }} />Rango normal ({s.refText || rangeLabel(s)})</span>
        <span><span className="inline-block w-2 h-2 rounded-full align-middle mr-1" style={{ background: OUT_COLOR }} />Fuera de rango</span>
        {marks.length > 0 && <span>Líneas punteadas: tratamientos</span>}
      </p>
    </div>
  );
}

export default function LabEvolutionPanel({ events, onImport }: Props) {
  const [showImport, setShowImport] = useState(false);
  const [onlyOut, setOnlyOut] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const series = useMemo(() => buildLabSeries(events), [events]);
  const labEvents = events.filter((e) => e.type === 'Laboratorio' && (e.labValues?.length || e.labResults));
  const treatments = events.filter((e) => TREATMENT_TYPES.includes(e.type));
  const lastDate = series.reduce((d, s) => (s.last.date > d ? s.last.date : d), '');
  const outNow = series.filter((s) => s.last.date === lastDate && (s.status === 'bajo' || s.status === 'alto'));
  const visible = onlyOut ? series.filter((s) => s.status === 'bajo' || s.status === 'alto') : series;
  const groups = LAB_GROUPS.map((g) => ({ g, items: visible.filter((s) => s.group === g) })).filter((x) => x.items.length);

  return (
    <div className="space-y-6" id="lab-evolution">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl"><FlaskConical className="w-6 h-6" /></div>
            <div>
              <h2 className="font-bold text-lg text-slate-800">Evolución de Laboratorio</h2>
              <p className="text-xs text-slate-500">Historial y estadística de cada valor, comparado con su rango normal y con tus tratamientos.</p>
            </div>
          </div>
          <button onClick={() => setShowImport(true)} className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm flex items-center gap-2 cursor-pointer" id="btn-open-lab-import">
            <FileUp className="w-4 h-4" /> Cargar PDF de laboratorio
          </button>
        </div>

        {series.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" id="lab-summary">
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Análisis cargados</p>
              <p className="text-2xl font-bold text-slate-900">{labEvents.length}</p>
              <p className="text-xs text-slate-500">{series.length} parámetros seguidos</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Último análisis</p>
              <p className="text-2xl font-bold text-slate-900">{fmtDate(lastDate)}</p>
            </div>
            <div className={`rounded-xl p-4 ${outNow.length ? 'bg-orange-50' : 'bg-green-50'}`}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Fuera de rango en el último</p>
              <p className="text-2xl font-bold text-slate-900">{outNow.length}</p>
              <p className="text-xs text-slate-600">{outNow.length ? outNow.map((s) => `${s.label} ${s.status === 'bajo' ? '↓' : '↑'}`).join(' · ') : 'Todos dentro del rango'}</p>
            </div>
          </div>
        )}
      </div>

      {series.length === 0 ? (
        <p className="text-sm text-slate-500 bg-white border border-dashed border-slate-200 rounded-xl p-8 text-center">
          Todavía no hay valores de laboratorio. Toca "Cargar PDF de laboratorio" para leer tus informes.
        </p>
      ) : (
        <>
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer w-fit">
            <input type="checkbox" checked={onlyOut} onChange={(e) => setOnlyOut(e.target.checked)} id="chk-only-out" />
            Mostrar solo los valores fuera de rango en su último análisis
          </label>

          {groups.map(({ g, items }) => (
            <section key={g} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden" data-testid="lab-group">
              <h3 className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 bg-slate-50 border-b border-slate-100">{g}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-[10px] uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="p-2 pl-4 text-left">Parámetro</th>
                      <th className="p-2 text-right">Último</th>
                      <th className="p-2 text-left">Rango</th>
                      <th className="p-2 text-right">vs. anterior</th>
                      <th className="p-2 text-right">vs. primero</th>
                      <th className="p-2 text-right">Mín – máx</th>
                      <th className="p-2 text-left">Tendencia</th>
                      <th className="p-2 text-left">Evolución</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((s) => (
                      <React.Fragment key={s.key}>
                        <tr
                          className="border-t border-slate-100 hover:bg-blue-50/40 cursor-pointer"
                          onClick={() => setOpen((o) => ({ ...o, [s.key]: !o[s.key] }))}
                          data-testid="lab-series-row" data-key={s.key}
                        >
                          <td className="p-2 pl-4 font-semibold text-slate-800 whitespace-nowrap">
                            {open[s.key] ? <ChevronDown className="w-3.5 h-3.5 inline mr-1" /> : <ChevronRight className="w-3.5 h-3.5 inline mr-1" />}
                            {s.label} <span className="text-slate-400 font-normal">({s.points.length})</span>
                          </td>
                          <td className="p-2 text-right whitespace-nowrap">
                            <span className="font-bold text-slate-900">{s.last.qualifier ?? ''}{fmt(s.last.value)}</span> <span className="text-slate-400">{s.unit}</span>{' '}
                            <StatusBadge s={s} />
                            <div className="text-[10px] text-slate-400">{fmtDate(s.last.date)}</div>
                          </td>
                          <td className="p-2 text-slate-500 whitespace-nowrap">{rangeLabel(s)}</td>
                          <td className="p-2 text-right text-slate-600 whitespace-nowrap">{signedPct(s.changePrevPct)}</td>
                          <td className="p-2 text-right text-slate-600 whitespace-nowrap">{signedPct(s.changeFirstPct)}</td>
                          <td className="p-2 text-right text-slate-500 whitespace-nowrap">{fmt(s.min)} – {fmt(s.max)}</td>
                          <td className="p-2 whitespace-nowrap"><TrendIcon s={s} /></td>
                          <td className={`p-2 whitespace-nowrap ${EVOLUTION_VIEW[s.evolution].cls}`}>{EVOLUTION_VIEW[s.evolution].text}</td>
                        </tr>
                        {open[s.key] && (
                          <tr className="bg-slate-50/50">
                            <td colSpan={8} className="p-4">
                              <SeriesChart s={s} treatments={treatments} />
                              <table className="mt-2 text-[11px] text-slate-600">
                                <tbody>
                                  {[...s.points].reverse().map((p) => (
                                    <tr key={p.eventId + p.date}><td className="pr-4">{fmtDate(p.date)}</td><td className="text-right font-mono">{p.qualifier ?? ''}{fmt(p.value)} {s.unit}</td></tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}

          <p className="text-[11px] text-slate-500 flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
            "Evolución" compara el último valor con el anterior respecto de su rango normal; "Tendencia" mira todos los análisis.
            Son cálculos sobre tus datos, no una interpretación médica: consulta siempre con tu médico.
          </p>
        </>
      )}

      {showImport && (
        <LabImportModal
          events={events}
          onClose={() => setShowImport(false)}
          onImport={(items) => { onImport(items); setShowImport(false); }}
        />
      )}
    </div>
  );
}
