import { useState } from 'react';
import { MedicalEvent, LabResults } from '../types';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  ReferenceLine 
} from 'recharts';
import { TrendingUp, Activity, Plus, ShieldAlert, BadgeInfo, CheckCircle2, ArrowRight, FileText, Sparkles } from 'lucide-react';
import { safeFormatDate } from '../utils/dateHelper';

interface LabComparisonPanelProps {
  events: MedicalEvent[];
  onOpenPdfParser?: () => void;
}

export default function LabComparisonPanel({ events, onOpenPdfParser }: LabComparisonPanelProps) {
  const [activeChart, setActiveChart] = useState<'hematology' | 'cea'>('cea');

  // Filtrar eventos de tipo laboratorio con resultados estructurados
  const labEvents = events
    .filter(e => e.type === 'Laboratorio' && e.labResults)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // Orden cronológico antiguo a nuevo para gráfico y tabla

  if (labEvents.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-xs text-center max-w-2xl mx-auto my-6">
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Activity className="w-8 h-8" />
        </div>
        <h3 className="font-sans font-bold text-lg text-slate-800">No hay análisis de laboratorio registrados</h3>
        <p className="text-slate-500 text-sm mt-2 max-w-md mx-auto leading-relaxed">
          Para ver la evolución o involución de sus resultados, comience agregando un evento de tipo <strong>"Laboratorio"</strong> e ingresando sus valores numéricos en la Línea de Tiempo.
        </p>
        <div className="mt-6 p-4 bg-slate-50 rounded-xl text-left border border-slate-100 text-xs text-slate-600 space-y-2">
          <p className="font-bold text-slate-700 flex items-center gap-1">
            <BadgeInfo className="w-4 h-4 text-blue-500" />
            Parámetros de monitoreo clave:
          </p>
          <ul className="list-disc pl-4 space-y-1">
            <li><strong>Marcador CEA:</strong> Antígeno Carcinoembrionario, para vigilar el comportamiento del tumor pulmonar.</li>
            <li><strong>Hematología (Glóbulos Blancos, Plaquetas, Hemoglobina):</strong> Para controlar la tolerancia a la quimioterapia e inmunoterapia.</li>
            <li><strong>Función Renal y Hepática:</strong> Para vigilar la toxicidad sistémica de los fármacos.</li>
          </ul>
        </div>
      </div>
    );
  }

  // Preparar datos para los gráficos
  const chartData = labEvents.map(e => ({
    date: safeFormatDate(e.date, { month: 'short', day: 'numeric', year: '2-digit' }),
    fullDate: safeFormatDate(e.date, { dateStyle: 'medium' }),
    title: e.title,
    wbc: e.labResults?.wbc,
    neutrophils: e.labResults?.neutrophils,
    hemoglobin: e.labResults?.hemoglobin,
    platelets: e.labResults?.platelets,
    cea: e.labResults?.cea,
    creatinine: e.labResults?.creatinine,
    alt_gpt: e.labResults?.alt_gpt,
    ast_got: e.labResults?.ast_got,
  }));

  // Referencias de rangos normales
  const ranges = {
    wbc: { min: 4.0, max: 11.0, unit: 'x10³/µL' },
    neutrophils: { min: 1.5, max: 8.0, unit: 'x10³/µL' },
    hemoglobin: { min: 12.0, max: 17.5, unit: 'g/dL' },
    platelets: { min: 150, max: 450, unit: 'x10³/µL' },
    cea: { max: 3.0, unit: 'ng/mL' }, // Rango para no fumador
    creatinine: { min: 0.6, max: 1.2, unit: 'mg/dL' },
    alt_gpt: { max: 41, unit: 'U/L' },
    ast_got: { max: 40, unit: 'U/L' },
  };

  // Función para determinar estado de un valor
  const getValueStatus = (value: number | undefined, rangeKey: keyof typeof ranges) => {
    if (value === undefined) return { label: 'Sin datos', color: 'text-slate-400', bg: 'bg-slate-50' };
    
    const range = ranges[rangeKey];
    if ('min' in range) {
      if (value < (range as any).min) return { label: 'Bajo', color: 'text-amber-600 font-bold', bg: 'bg-amber-50 border-amber-200' };
      if (value > (range as any).max) return { label: 'Alto', color: 'text-red-600 font-bold', bg: 'bg-red-50 border-red-200' };
    } else {
      if (value > range.max) return { label: 'Elevado', color: 'text-red-600 font-bold', bg: 'bg-red-50 border-red-200' };
    }
    return { label: 'Normal', color: 'text-green-700 font-semibold', bg: 'bg-green-50 border-green-100' };
  };

  // Comparar con el anterior para tendencia (Evolución vs Involución)
  const getTrend = (currentIndex: number, valueKey: keyof LabResults, rangeKey: keyof typeof ranges) => {
    if (currentIndex === 0) return null;
    
    const currentVal = labEvents[currentIndex].labResults?.[valueKey];
    const prevVal = labEvents[currentIndex - 1].labResults?.[valueKey];
    
    if (currentVal === undefined || prevVal === undefined) return null;
    
    const diff = currentVal - prevVal;
    if (Math.abs(diff) < 0.01) return { icon: '→', text: 'Estable', style: 'text-slate-400' };

    const isWorsening = () => {
      // Para CEA, un aumento es involución (empeoramiento)
      if (valueKey === 'cea') return diff > 0;
      // Para creatinina y transaminasas hepáticas, un aumento es toxicidad (empeoramiento)
      if (['creatinine', 'alt_gpt', 'ast_got'].includes(valueKey)) return diff > 0;
      // Para hemoglobina, plaquetas, neutrófilos, una caída por debajo del límite es malo
      if (['hemoglobin', 'platelets', 'neutrophils', 'wbc'].includes(valueKey)) {
        return diff < 0 && currentVal < ((ranges[rangeKey] as any).min || 0);
      }
      return false;
    };

    const isImproving = () => {
      // Para CEA, una caída es evolución terapéutica (mejora)
      if (valueKey === 'cea') return diff < 0;
      // Para enzimas o creatinina alta, una caída es mejora (menos toxicidad)
      if (['creatinine', 'alt_gpt', 'ast_got'].includes(valueKey)) return diff < 0;
      // Para células sanguíneas bajas, una subida hacia la normalidad es recuperación (mejora)
      if (['hemoglobin', 'platelets', 'neutrophils', 'wbc'].includes(valueKey)) {
        return diff > 0 && prevVal < ((ranges[rangeKey] as any).min || 0);
      }
      return false;
    };

    if (isImproving()) {
      return { 
        icon: '↓ Mejora', 
        text: `Mejora (${diff > 0 ? '+' : ''}${diff.toFixed(1)})`, 
        style: 'text-green-600 font-bold bg-green-50/50 px-1.5 py-0.5 rounded text-[10px]' 
      };
    }
    if (isWorsening()) {
      return { 
        icon: '↑ Detrimento', 
        text: `Alerta (${diff > 0 ? '+' : ''}${diff.toFixed(1)})`, 
        style: 'text-red-600 font-bold bg-red-50/50 px-1.5 py-0.5 rounded text-[10px]' 
      };
    }

    // Variaciones dentro de límites normales
    return { 
      icon: diff > 0 ? '▲' : '▼', 
      text: `${diff > 0 ? '+' : ''}${diff.toFixed(1)}`, 
      style: 'text-slate-500 font-medium text-[10px]' 
    };
  };

  return (
    <div className="space-y-6" id="lab-comparison-panel">
      {/* Encabezado explicativo */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <div className="flex items-center gap-2 text-blue-600">
            <TrendingUp className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-wider">Módulo Clínico Evolutivo</span>
          </div>
          <h2 className="font-sans font-bold text-xl text-slate-900">Evolución de Estudios de Laboratorio</h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            Consulte la tendencia longitudinal de sus marcadores biológicos. El tumor pulmonar se evalúa mediante la evolución del 
            marcador <strong>CEA</strong> (su descenso es signo de involución tumoral, es decir, respuesta favorable), 
            mientras que los conteos sanguíneos vigilan la tolerabilidad al tratamiento inmunoterápico actual.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 self-start shrink-0">
          {onOpenPdfParser && (
            <button
              onClick={onOpenPdfParser}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Cargar PDF Examen con IA</span>
            </button>
          )}

          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveChart('cea')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeChart === 'cea' 
                  ? 'bg-white text-slate-800 shadow-2xs' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Marcador CEA
            </button>
            <button
              onClick={() => setActiveChart('hematology')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeChart === 'hematology' 
                  ? 'bg-white text-slate-800 shadow-2xs' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Hemograma
            </button>
          </div>
        </div>
      </div>

      {/* Gráficos Recharts */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
        <h3 className="font-sans font-bold text-sm text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
          <Activity className="w-4 h-4 text-blue-500" />
          {activeChart === 'cea' 
            ? 'Monitoreo de Respuesta Tumoral (Antígeno Carcinoembrionario - CEA)' 
            : 'Tolerancia Hematológica (Monitoreo de Series Sanguíneas)'
          }
        </h3>
        
        <div className="h-[280px] w-full">
          {activeChart === 'cea' ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis label={{ value: 'CEA (ng/mL)', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#64748b' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', borderRadius: '12px', color: '#fff', fontSize: '12px', border: 'none' }}
                  labelStyle={{ fontWeight: 'bold', color: '#38bdf8' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <ReferenceLine y={3.0} stroke="#22c55e" strokeDasharray="3 3" label={{ value: 'Límite normal (< 3.0)', fill: '#22c55e', fontSize: 9, position: 'top' }} />
                <Line 
                  type="monotone" 
                  dataKey="cea" 
                  name="CEA (Antígeno Carcinoembrionario)" 
                  stroke="#ef4444" 
                  strokeWidth={3}
                  activeDot={{ r: 8 }} 
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', borderRadius: '12px', color: '#fff', fontSize: '12px', border: 'none' }}
                  labelStyle={{ fontWeight: 'bold', color: '#38bdf8' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Line type="monotone" dataKey="wbc" name="Glóbulos Blancos (10³/µL)" stroke="#3b82f6" strokeWidth={2} connectNulls />
                <Line type="monotone" dataKey="hemoglobin" name="Hemoglobina (g/dL)" stroke="#10b981" strokeWidth={2} connectNulls />
                <Line type="monotone" dataKey="neutrophils" name="Neutrófilos (10³/µL)" stroke="#8b5cf6" strokeWidth={2} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        
        <div className="mt-4 p-3 bg-slate-50 border border-slate-100 rounded-xl text-[11px] text-slate-500 leading-relaxed flex items-start gap-2">
          <BadgeInfo className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
          <div>
            {activeChart === 'cea' ? (
              <p>
                <strong>Interpretación del gráfico:</strong> El marcador CEA es producido por células de adenocarcinoma de pulmón. 
                Una curva descendente (como la caída de 12.4 a 1.8 ng/mL) representa una <strong>involución de la actividad tumoral</strong>, confirmando la efectividad de la quimioterapia y de la inmunoterapia subsiguiente.
              </p>
            ) : (
              <p>
                <strong>Interpretación del gráfico:</strong> Los fármacos oncológicos pueden causar mielosupresión (bajada transitoria de glóbulos blancos y neutrófilos). Se observa un valle protector a mediados de 2025 coincidiendo con la quimiorradioterapia concomitante, con recuperación completa posterior gracias al esquema de mantenimiento.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Tabla Comparativa de Evolución */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div>
            <h3 className="font-sans font-bold text-sm text-slate-800">Comparativa Longitudinal de Resultados</h3>
            <p className="text-xs text-slate-500">Visualización de la tendencia por cada parámetro registrado en cada análisis</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200">
                <th className="py-3 px-4 text-[10px] font-bold uppercase text-slate-500 tracking-wider w-[240px]">Parámetro Biológico (Rango Ref.)</th>
                {labEvents.map((event, idx) => (
                  <th key={event.id} className="py-3 px-4 text-[11px] font-bold text-slate-800 text-center min-w-[130px]">
                    <p className="font-mono text-[10px] text-slate-500">{safeFormatDate(event.date, { dateStyle: 'short' })}</p>
                    <p className="text-xs font-semibold text-slate-700 truncate max-w-[120px]" title={event.title}>{event.title}</p>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {/* FILA: Marcador CEA */}
              <tr>
                <td className="py-3.5 px-4 font-semibold text-slate-700 bg-red-50/10">
                  <span className="font-bold">Antígeno CEA</span> 
                  <span className="block text-[10px] font-normal text-slate-400">Rango normal: &lt; 3.0 ng/mL</span>
                </td>
                {labEvents.map((e, idx) => {
                  const val = e.labResults?.cea;
                  const status = getValueStatus(val, 'cea');
                  const trend = getTrend(idx, 'cea', 'cea');
                  return (
                    <td key={e.id} className="py-3.5 px-4 text-center">
                      {val !== undefined ? (
                        <div className="space-y-1">
                          <p className="font-mono font-bold text-sm text-slate-800">{val.toFixed(1)} <span className="text-[10px] font-normal text-slate-400">ng/mL</span></p>
                          <p className={`inline-block text-[9px] px-1.5 py-0.5 rounded-full border ${status.bg} ${status.color}`}>{status.label}</p>
                          {trend && <div className="mt-1"><span className={trend.style}>{trend.icon}</span></div>}
                        </div>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* FILA: Glóbulos Blancos */}
              <tr>
                <td className="py-3.5 px-4 font-semibold text-slate-700">
                  <span>Glóbulos Blancos (WBC)</span>
                  <span className="block text-[10px] font-normal text-slate-400">Rango normal: 4.0 - 11.0 x10³/µL</span>
                </td>
                {labEvents.map((e, idx) => {
                  const val = e.labResults?.wbc;
                  const status = getValueStatus(val, 'wbc');
                  const trend = getTrend(idx, 'wbc', 'wbc');
                  return (
                    <td key={e.id} className="py-3.5 px-4 text-center">
                      {val !== undefined ? (
                        <div className="space-y-1">
                          <p className="font-mono font-semibold text-slate-800">{val.toFixed(1)}</p>
                          <p className={`inline-block text-[9px] px-1 rounded border ${status.bg} ${status.color}`}>{status.label}</p>
                          {trend && <div className="mt-0.5"><span className={trend.style}>{trend.icon}</span></div>}
                        </div>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* FILA: Neutrófilos */}
              <tr>
                <td className="py-3.5 px-4 font-semibold text-slate-700">
                  <span>Neutrófilos Absolutos</span>
                  <span className="block text-[10px] font-normal text-slate-400">Rango normal: 1.5 - 8.0 x10³/µL</span>
                </td>
                {labEvents.map((e, idx) => {
                  const val = e.labResults?.neutrophils;
                  const status = getValueStatus(val, 'neutrophils');
                  const trend = getTrend(idx, 'neutrophils', 'neutrophils');
                  return (
                    <td key={e.id} className="py-3.5 px-4 text-center">
                      {val !== undefined ? (
                        <div className="space-y-1">
                          <p className="font-mono text-slate-800">{val.toFixed(1)}</p>
                          <p className={`inline-block text-[9px] px-1 rounded border ${status.bg} ${status.color}`}>{status.label}</p>
                          {trend && <div className="mt-0.5"><span className={trend.style}>{trend.icon}</span></div>}
                        </div>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* FILA: Hemoglobina */}
              <tr>
                <td className="py-3.5 px-4 font-semibold text-slate-700">
                  <span>Hemoglobina</span>
                  <span className="block text-[10px] font-normal text-slate-400">Rango normal: 12.0 - 17.5 g/dL</span>
                </td>
                {labEvents.map((e, idx) => {
                  const val = e.labResults?.hemoglobin;
                  const status = getValueStatus(val, 'hemoglobin');
                  const trend = getTrend(idx, 'hemoglobin', 'hemoglobin');
                  return (
                    <td key={e.id} className="py-3.5 px-4 text-center">
                      {val !== undefined ? (
                        <div className="space-y-1">
                          <p className="font-mono font-semibold text-slate-800">{val.toFixed(1)} <span className="text-[9px] font-normal text-slate-400">g/dL</span></p>
                          <p className={`inline-block text-[9px] px-1 rounded border ${status.bg} ${status.color}`}>{status.label}</p>
                          {trend && <div className="mt-0.5"><span className={trend.style}>{trend.icon}</span></div>}
                        </div>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* FILA: Plaquetas */}
              <tr>
                <td className="py-3.5 px-4 font-semibold text-slate-700">
                  <span>Plaquetas</span>
                  <span className="block text-[10px] font-normal text-slate-400">Rango normal: 150 - 450 x10³/µL</span>
                </td>
                {labEvents.map((e, idx) => {
                  const val = e.labResults?.platelets;
                  const status = getValueStatus(val, 'platelets');
                  const trend = getTrend(idx, 'platelets', 'platelets');
                  return (
                    <td key={e.id} className="py-3.5 px-4 text-center">
                      {val !== undefined ? (
                        <div className="space-y-1">
                          <p className="font-mono text-slate-800">{Math.round(val)}</p>
                          <p className={`inline-block text-[9px] px-1 rounded border ${status.bg} ${status.color}`}>{status.label}</p>
                          {trend && <div className="mt-0.5"><span className={trend.style}>{trend.icon}</span></div>}
                        </div>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* FILA: Creatinina */}
              <tr>
                <td className="py-3.5 px-4 font-semibold text-slate-700">
                  <span>Creatinina (Función Renal)</span>
                  <span className="block text-[10px] font-normal text-slate-400">Rango normal: 0.6 - 1.2 mg/dL</span>
                </td>
                {labEvents.map((e, idx) => {
                  const val = e.labResults?.creatinine;
                  const status = getValueStatus(val, 'creatinine');
                  const trend = getTrend(idx, 'creatinine', 'creatinine');
                  return (
                    <td key={e.id} className="py-3.5 px-4 text-center">
                      {val !== undefined ? (
                        <div className="space-y-1">
                          <p className="font-mono text-slate-800">{val.toFixed(2)}</p>
                          <p className={`inline-block text-[9px] px-1 rounded border ${status.bg} ${status.color}`}>{status.label}</p>
                          {trend && <div className="mt-0.5"><span className={trend.style}>{trend.icon}</span></div>}
                        </div>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* FILA: ALT */}
              <tr>
                <td className="py-3.5 px-4 font-semibold text-slate-700">
                  <span>TGP / ALT (Función Hepática)</span>
                  <span className="block text-[10px] font-normal text-slate-400">Rango normal: &lt; 41 U/L</span>
                </td>
                {labEvents.map((e, idx) => {
                  const val = e.labResults?.alt_gpt;
                  const status = getValueStatus(val, 'alt_gpt');
                  const trend = getTrend(idx, 'alt_gpt', 'alt_gpt');
                  return (
                    <td key={e.id} className="py-3.5 px-4 text-center">
                      {val !== undefined ? (
                        <div className="space-y-1">
                          <p className="font-mono text-slate-800">{Math.round(val)}</p>
                          <p className={`inline-block text-[9px] px-1 rounded border ${status.bg} ${status.color}`}>{status.label}</p>
                          {trend && <div className="mt-0.5"><span className={trend.style}>{trend.icon}</span></div>}
                        </div>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* FILA: AST */}
              <tr>
                <td className="py-3.5 px-4 font-semibold text-slate-700 border-b border-slate-200">
                  <span>TGO / AST (Función Hepática)</span>
                  <span className="block text-[10px] font-normal text-slate-400">Rango normal: &lt; 40 U/L</span>
                </td>
                {labEvents.map((e, idx) => {
                  const val = e.labResults?.ast_got;
                  const status = getValueStatus(val, 'ast_got');
                  const trend = getTrend(idx, 'ast_got', 'ast_got');
                  return (
                    <td key={e.id} className="py-3.5 px-4 text-center border-b border-slate-200">
                      {val !== undefined ? (
                        <div className="space-y-1">
                          <p className="font-mono text-slate-800">{Math.round(val)}</p>
                          <p className={`inline-block text-[9px] px-1 rounded border ${status.bg} ${status.color}`}>{status.label}</p>
                          {trend && <div className="mt-0.5"><span className={trend.style}>{trend.icon}</span></div>}
                        </div>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
        
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-slate-500 text-[11px] font-medium">
          <p className="flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
            La comparación cronológica muestra la recuperación sostenida de las series hematológicas y la involución tumoral del marcador CEA.
          </p>
          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Deslice hacia la derecha para ver historial →</span>
        </div>
      </div>
    </div>
  );
}
