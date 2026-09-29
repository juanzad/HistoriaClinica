import React, { useState } from 'react';
import { SideEffectEntry } from '../types';
import { safeFormatDate } from '../utils/dateHelper';
import { 
  Heart, 
  AlertTriangle, 
  Plus, 
  X, 
  Smile, 
  Meh, 
  Frown, 
  Clock, 
  Activity,
  Zap,
  Trash2
} from 'lucide-react';

interface SideEffectsTrackerProps {
  sideEffects: SideEffectEntry[];
  onAddSideEffect: (newEntry: SideEffectEntry) => void;
  onDeleteSideEffect: (id: string) => void;
}

export default function SideEffectsTracker({ sideEffects, onAddSideEffect, onDeleteSideEffect }: SideEffectsTrackerProps) {
  const [showAddForm, setShowAddForm] = useState(false);

  // Campos formulario
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [severity, setSeverity] = useState<'Leve' | 'Moderado' | 'Severo'>('Moderado');
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [customSymptoms, setCustomSymptoms] = useState('');
  const [notes, setNotes] = useState('');
  const [energyLevel, setEnergyLevel] = useState<number>(5);

  // Estado para confirmación de borrado seguro dentro de iframes
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const symptomOptions = [
    "Fatiga Extrema",
    "Dolor Articular (Rodillas/Hombros)",
    "Prurito / Picazón de Piel",
    "Falta de Aire Leve",
    "Náuseas / Falta de apetito",
    "Dolor de Cabeza / Cefalea",
    "Insomnio / Dificultad para dormir",
    "Dolor Muscular",
    "Fiebre / Escalofríos"
  ];

  const handleSymptomToggle = (symptom: string) => {
    if (selectedSymptoms.includes(symptom)) {
      setSelectedSymptoms((prev) => prev.filter(s => s !== symptom));
    } else {
      setSelectedSymptoms((prev) => [...prev, symptom]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSymptoms.length === 0 && !customSymptoms) {
      alert('Por favor seleccione al menos un síntoma o escriba un detalle personalizado.');
      return;
    }

    const newEntry: SideEffectEntry = {
      id: 'se-' + Math.random().toString(36).substr(2, 9),
      date,
      severity,
      symptoms: selectedSymptoms,
      customSymptoms: customSymptoms || undefined,
      notes,
      energyLevel,
      createdAt: new Date().toISOString()
    };

    onAddSideEffect(newEntry);

    // Resetear formulario
    setDate(new Date().toISOString().split('T')[0]);
    setSeverity('Moderado');
    setSelectedSymptoms([]);
    setCustomSymptoms('');
    setNotes('');
    setEnergyLevel(5);
    setShowAddForm(false);
  };

  // Retorna color de acuerdo a severidad
  const getSeverityColors = (sev: 'Leve' | 'Moderado' | 'Severo') => {
    switch (sev) {
      case 'Leve':
        return {
          bg: 'bg-green-50 border-green-200 text-green-800',
          indicator: 'bg-green-500',
          text: 'text-green-700'
        };
      case 'Moderado':
        return {
          bg: 'bg-amber-50 border-amber-200 text-amber-800',
          indicator: 'bg-amber-500',
          text: 'text-amber-700'
        };
      case 'Severo':
        return {
          bg: 'bg-red-50 border-red-200 text-red-800',
          indicator: 'bg-red-500',
          text: 'text-red-700'
        };
    }
  };

  // Icono según nivel de energía
  const getEnergyIcon = (level: number) => {
    if (level >= 8) return <Smile className="w-5 h-5 text-green-600" />;
    if (level >= 4) return <Meh className="w-5 h-5 text-amber-600" />;
    return <Frown className="w-5 h-5 text-red-600" />;
  };

  return (
    <div className="space-y-6" id="side-effects-tracker-section">
      {/* Encabezado y acción principal */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="font-sans font-bold text-xl text-slate-800 flex items-center gap-2">
            <Heart className="w-6 h-6 text-red-500 shrink-0" />
            Efectos de la Inmunoterapia
          </h2>
          <p className="text-xs text-slate-500">Registra de cerca las reacciones y síntomas adversos para consultarlo con tu oncólogo.</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold shadow-xs transition-colors cursor-pointer w-full sm:w-auto justify-center"
          id="btn-add-side-effect-toggle"
        >
          {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showAddForm ? 'Cancelar' : 'Registrar Malestar / Efecto'}
        </button>
      </div>

      {/* Formulario nuevo registro */}
      {showAddForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4" id="form-add-side-effect">
          <h3 className="font-sans font-bold text-base text-slate-800 pb-2 border-b border-slate-100">Registrar Nuevo Síntoma o Reacción</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Fecha del Registro</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-red-500/20"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Grado de Severidad</label>
              <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg">
                {(['Leve', 'Moderado', 'Severo'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSeverity(s)}
                    className={`py-1 text-xs font-semibold rounded-md transition-all ${
                      severity === s 
                        ? s === 'Leve' ? 'bg-green-600 text-white shadow-xs' : s === 'Moderado' ? 'bg-amber-500 text-white shadow-xs' : 'bg-red-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nivel de Energía General ({energyLevel}/10)</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={energyLevel}
                  onChange={(e) => setEnergyLevel(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-600"
                />
                <span className="shrink-0">{getEnergyIcon(energyLevel)}</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">Selecciona los Síntomas Presentes</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {symptomOptions.map((symptom) => {
                const isChecked = selectedSymptoms.includes(symptom);
                return (
                  <label
                    key={symptom}
                    className={`flex items-center gap-3 p-2.5 rounded-lg border text-xs font-medium cursor-pointer transition-all select-none ${
                      isChecked 
                        ? 'bg-red-50/50 border-red-300 text-red-800' 
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleSymptomToggle(symptom)}
                      className="rounded-md border-slate-300 text-red-600 focus:ring-red-500/20 w-4 h-4 cursor-pointer"
                    />
                    <span>{symptom}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Otros síntomas (Detalle extra)</label>
              <input
                type="text"
                placeholder="Ej: Sabor metálico en la boca, picor ocular..."
                value={customSymptoms}
                onChange={(e) => setCustomSymptoms(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-red-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Notas personales (¿Qué hiciste para aliviarlo?)</label>
              <input
                type="text"
                placeholder="Ej: Tomé paracetamol de 500mg, me hidraté la piel con crema..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-red-500/20"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-sm shadow-xs transition-colors cursor-pointer"
          >
            Guardar Reporte de Síntoma
          </button>
        </form>
      )}

      {/* Listado de síntomas registrados en formato Bitácora Compacta */}
      {sideEffects.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center shadow-sm">
          <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
          <p className="text-slate-600 font-medium">Aún no registraste efectos secundarios</p>
          <p className="text-sm text-slate-400 mt-1">Lleva un seguimiento de tu inmunoterapia haciendo clic en 'Registrar Malestar'.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {sideEffects.map((effect) => {
            const colors = getSeverityColors(effect.severity);
            const cardBg = effect.severity === 'Severo' ? 'bg-red-50/50' : effect.severity === 'Moderado' ? 'bg-amber-50/40' : 'bg-green-50/40';
            const leftBorderColor = effect.severity === 'Severo' ? 'border-l-red-400' : effect.severity === 'Moderado' ? 'border-l-amber-400' : 'border-l-green-400';

            return (
              <div 
                key={effect.id} 
                className={`bg-white border border-slate-200 rounded-lg shadow-sm p-4 flex flex-col md:flex-row md:items-start justify-between gap-4 relative border-l-4 ${leftBorderColor} ${cardBg} transition-colors`}
                id={`side-effect-card-${effect.id}`}
              >
                <div className="space-y-2.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {safeFormatDate(effect.date, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                    <span className={`px-2 py-0.5 border text-[9px] uppercase font-bold rounded-md ${colors.bg}`}>
                      Grado {effect.severity}
                    </span>
                    <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 text-[9px] text-slate-600 font-bold rounded-md flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-amber-500" />
                      Energía: {effect.energyLevel}/10
                    </span>
                  </div>

                  {/* Síntomas listados */}
                  <div className="flex flex-wrap gap-1.5">
                    {effect.symptoms.map((sym, idx) => (
                      <span key={idx} className="bg-white border border-slate-200 text-slate-700 px-2 py-0.5 rounded-md text-[11px] font-semibold">
                        {sym}
                      </span>
                    ))}
                    {effect.customSymptoms && (
                      <span className="bg-red-100/50 border border-red-200 text-red-900 px-2 py-0.5 rounded-md text-[11px] font-semibold italic">
                        {effect.customSymptoms}
                      </span>
                    )}
                  </div>

                  {/* Notas */}
                  {effect.notes && (
                    <div className="text-xs bg-white/70 border border-slate-200/60 p-2.5 rounded-md text-slate-700 leading-relaxed">
                      <strong className="text-slate-800 text-[10px] uppercase block mb-0.5">Acción paliativa / Nota:</strong>
                      <span className="italic text-slate-600">"{effect.notes}"</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-row md:flex-col items-center justify-between md:justify-start md:items-end gap-3 shrink-0 border-t md:border-t-0 md:border-l border-slate-200/50 pt-2.5 md:pt-0 md:pl-4">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-slate-400 font-medium">Ánimo:</span>
                    {getEnergyIcon(effect.energyLevel)}
                  </div>
                  
                  {deleteConfirmId === effect.id ? (
                    <div className="flex flex-col items-end gap-1.5 bg-red-50 border border-red-100 p-2 rounded-lg text-right max-w-[180px]">
                      <span className="text-[10px] font-bold text-red-700">¿Deseas borrar este reporte?</span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            onDeleteSideEffect(effect.id);
                            setDeleteConfirmId(null);
                          }}
                          className="bg-red-600 hover:bg-red-700 text-white font-bold px-2 py-0.5 rounded text-[9px] cursor-pointer"
                        >
                          Sí
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-2 py-0.5 rounded text-[9px] cursor-pointer"
                        >
                          No
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirmId(effect.id)}
                      className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-red-600 font-semibold transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Borrar Reporte
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
