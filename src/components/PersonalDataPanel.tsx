import React, { useState } from 'react';
import { PersonalData, MetricEntry } from '../types';
import { safeFormatDate } from '../utils/dateHelper';
import { 
  User, 
  Settings, 
  Weight, 
  Scale, 
  Heart, 
  Layers, 
  Calendar,
  AlertOctagon,
  ClipboardList,
  Plus,
  Trash2,
  Bookmark,
  X
} from 'lucide-react';

interface PersonalDataPanelProps {
  personalData: PersonalData;
  onUpdatePersonalData: (newData: PersonalData) => void;
  metrics: MetricEntry[];
  onAddMetric: (newMetric: MetricEntry) => void;
  onDeleteMetric: (id: string) => void;
}

export default function PersonalDataPanel({ 
  personalData, 
  onUpdatePersonalData, 
  metrics, 
  onAddMetric, 
  onDeleteMetric 
}: PersonalDataPanelProps) {
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [showAddMetric, setShowAddMetric] = useState(false);
  
  // Estado para confirmación de borrado seguro dentro de iframes
  const [deleteMetricConfirmId, setDeleteMetricConfirmId] = useState<string | null>(null);

  // Formulario Perfil
  const [fullName, setFullName] = useState(personalData.fullName);
  const [birthDate, setBirthDate] = useState(personalData.birthDate);
  const [age, setAge] = useState(personalData.age);
  const [height, setHeight] = useState(personalData.height);
  const [weight, setWeight] = useState(personalData.weight);
  const [bloodType, setBloodType] = useState(personalData.bloodType);
  const [allergies, setAllergies] = useState(personalData.allergies);
  const [diagnosis, setDiagnosis] = useState(personalData.diagnosis);
  const [treatment, setTreatment] = useState(personalData.treatment);

  // Sincronizar el estado local con la prop personalData cuando esta cambie
  React.useEffect(() => {
    setFullName(personalData.fullName || '');
    setBirthDate(personalData.birthDate || '');
    setAge(personalData.age || 0);
    setHeight(personalData.height || 0);
    setWeight(personalData.weight || 0);
    setBloodType(personalData.bloodType || 'A+');
    setAllergies(personalData.allergies || '');
    setDiagnosis(personalData.diagnosis || '');
    setTreatment(personalData.treatment || '');
  }, [personalData]);

  // Cálculos bidireccionales de fecha de nacimiento y edad
  const handleBirthDateChange = (dateVal: string) => {
    setBirthDate(dateVal);
    if (dateVal) {
      const birth = new Date(dateVal);
      const today = new Date();
      let computedAge = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        computedAge--;
      }
      if (computedAge >= 0) {
        setAge(computedAge);
      }
    }
  };

  const handleAgeChange = (ageVal: number) => {
    setAge(ageVal);
    if (ageVal && ageVal > 0) {
      const currentYear = new Date().getFullYear();
      const birthYear = currentYear - ageVal;
      setBirthDate(`${birthYear}-01-01`);
    }
  };

  // Formulario Métrica
  const [metricDate, setMetricDate] = useState(new Date().toISOString().split('T')[0]);
  const [metricWeight, setMetricWeight] = useState(personalData.weight);
  const [systolic, setSystolic] = useState(120);
  const [diastolic, setDiastolic] = useState(80);
  const [heartRate, setHeartRate] = useState(75);
  const [metricNotes, setMetricNotes] = useState('');

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdatePersonalData({
      fullName,
      birthDate,
      age: Number(age),
      weight: Number(weight),
      height: Number(height),
      bloodType,
      allergies,
      diagnosis,
      treatment
    });
    setIsEditingProfile(false);
  };

  const handleMetricSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Cálculo del IMC (Fórmula: peso / altura_en_metros ^ 2)
    const heightInMeters = height / 100;
    const bmi = Number((metricWeight / (heightInMeters * heightInMeters)).toFixed(1));

    const newMetric: MetricEntry = {
      id: 'metric-' + Math.random().toString(36).substr(2, 9),
      date: metricDate,
      weight: Number(metricWeight),
      systolic: Number(systolic),
      diastolic: Number(diastolic),
      heartRate: Number(heartRate),
      notes: metricNotes || undefined,
      bmi
    };

    onAddMetric(newMetric);

    // Actualizar el peso del perfil de forma sutil
    onUpdatePersonalData({
      ...personalData,
      weight: Number(metricWeight)
    });

    // Resetear formulario
    setMetricDate(new Date().toISOString().split('T')[0]);
    setMetricNotes('');
    setShowAddMetric(false);
  };

  // Clasificación de IMC (OMS)
  const getBmiStatus = (bmi: number) => {
    if (bmi < 18.5) return { label: "Bajo peso", color: "text-amber-600 bg-amber-50" };
    if (bmi < 25) return { label: "Peso normal", color: "text-green-600 bg-green-50" };
    if (bmi < 30) return { label: "Sobrepeso", color: "text-amber-600 bg-amber-50" };
    return { label: "Obesidad", color: "text-red-600 bg-red-50" };
  };

  return (
    <div className="space-y-6" id="personal-data-section">
      {/* 1. SECCIÓN DE PERFIL PERSONAL */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-sans font-bold text-lg text-slate-800">Ficha de Datos Personales</h3>
              <p className="text-xs text-slate-500 font-medium">Información de cabecera rápida de consultar.</p>
            </div>
          </div>
          <button
            onClick={() => setIsEditingProfile(!isEditingProfile)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            id="btn-edit-profile-toggle"
          >
            <Settings className="w-3.5 h-3.5" />
            {isEditingProfile ? 'Cancelar' : 'Editar Ficha'}
          </button>
        </div>

        {isEditingProfile ? (
          <form onSubmit={handleProfileSubmit} className="space-y-4" id="form-edit-profile">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nombre Completo</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Fecha de Nacimiento</label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => handleBirthDateChange(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Edad</label>
                  <input
                    type="number"
                    value={age || ''}
                    onChange={(e) => handleAgeChange(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Grupo Sanguíneo</label>
                  <input
                    type="text"
                    value={bloodType}
                    onChange={(e) => setBloodType(e.target.value)}
                    placeholder="Ej: A+"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Altura (cm)</label>
                <input
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Peso de Referencia (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={weight}
                  onChange={(e) => setWeight(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Alergias Conocidas</label>
                <input
                  type="text"
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Diagnóstico Principal</label>
                <textarea
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Tratamiento Actual</label>
                <textarea
                  value={treatment}
                  onChange={(e) => setTreatment(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-sm transition-colors cursor-pointer"
            >
              Guardar Cambios del Perfil
            </button>
          </form>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">Nombre Paciente</span>
              <p className="text-sm font-bold text-slate-700">{personalData.fullName}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">Edad y Nacimiento</span>
              <p className="text-sm font-bold text-slate-700">
                {personalData.age} años ({safeFormatDate(personalData.birthDate)})
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">Estatura y Peso</span>
              <p className="text-sm font-bold text-slate-700">{personalData.height} cm / {personalData.weight} kg</p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">Grupo Sanguíneo</span>
              <p className="text-sm font-bold text-slate-700">{personalData.bloodType}</p>
            </div>

            <div className="sm:col-span-2 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                <AlertOctagon className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                Alergias
              </span>
              <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 font-medium">
                {personalData.allergies || "Ninguna registrada."}
              </p>
            </div>

            <div className="sm:col-span-2 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                <ClipboardList className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                Diagnóstico Base
              </span>
              <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 font-medium">
                {personalData.diagnosis || "No indicado."}
              </p>
            </div>

            <div className="sm:col-span-4 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">Tratamiento Actual y Monitoreo</span>
              <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 font-semibold text-blue-800">
                {personalData.treatment || "No especificado."}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 2. REGISTRO DE MÉTRICAS */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-sans font-bold text-lg text-slate-800">Control de Signos Vitales y Peso</h3>
              <p className="text-xs text-slate-500 font-medium">Lleva un seguimiento estricto de tu peso, tensión arterial y pulso.</p>
            </div>
          </div>
          <button
            onClick={() => setShowAddMetric(!showAddMetric)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
            id="btn-add-metric-toggle"
          >
            {showAddMetric ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {showAddMetric ? 'Cancelar' : 'Registrar Medición'}
          </button>
        </div>

        {showAddMetric && (
          <form onSubmit={handleMetricSubmit} className="bg-slate-50 rounded-xl p-5 border border-slate-100 space-y-4 mb-6" id="form-add-metric">
            <h4 className="font-sans font-semibold text-sm text-slate-800 pb-2 border-b border-slate-200">Nueva Medición Física</h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Fecha de la Toma *</label>
                <input
                  type="date"
                  value={metricDate}
                  onChange={(e) => setMetricDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-rose-500/20"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Peso Corporal (kg) *</label>
                <input
                  type="number"
                  step="0.1"
                  value={metricWeight}
                  onChange={(e) => setMetricWeight(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Tensión Sistólica (mmHg) *</label>
                <input
                  type="number"
                  value={systolic}
                  onChange={(e) => setSystolic(Number(e.target.value))}
                  placeholder="Ej: 120"
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Tensión Diastólica (mmHg) *</label>
                <input
                  type="number"
                  value={diastolic}
                  onChange={(e) => setDiastolic(Number(e.target.value))}
                  placeholder="Ej: 80"
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-hidden"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Frecuencia Cardíaca (lpm) *</label>
                <input
                  type="number"
                  value={heartRate}
                  onChange={(e) => setHeartRate(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Observaciones / Síntomas asociados</label>
                <input
                  type="text"
                  placeholder="Ej: En ayunas, después de caminar, dolor de cabeza leve..."
                  value={metricNotes}
                  onChange={(e) => setMetricNotes(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-hidden"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl text-sm transition-colors cursor-pointer"
            >
              Registrar Medición Corporal
            </button>
          </form>
        )}

        {/* Tabla histórica de mediciones */}
        <div className="overflow-x-auto border border-slate-100 rounded-xl">
          <table className="w-full text-left border-collapse" id="table-metrics-history">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Peso (kg)</th>
                <th className="px-4 py-3">IMC (Estado)</th>
                <th className="px-4 py-3">Tensión Arterial</th>
                <th className="px-4 py-3">Ritmo Cardíaco</th>
                <th className="px-4 py-3">Observación</th>
                <th className="px-4 py-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
              {metrics.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400 italic">
                    No hay mediciones físicas registradas.
                  </td>
                </tr>
              ) : (
                metrics.map((m) => {
                  const bmiStatus = getBmiStatus(m.bmi);
                  return (
                    <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-700">
                        {safeFormatDate(m.date, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-800">{m.weight} kg</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold">{m.bmi.toFixed(1)}</span>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${bmiStatus.color}`}>
                            {bmiStatus.label}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono font-medium text-slate-700">
                        {m.systolic}/{m.diastolic} <span className="text-[10px] text-slate-400">mmHg</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1">
                          <Heart className="w-3 h-3 text-rose-500 fill-rose-50" />
                          {m.heartRate} lpm
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[150px] truncate italic text-slate-500" title={m.notes}>
                        {m.notes || "-"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {deleteMetricConfirmId === m.id ? (
                          <div className="inline-flex items-center gap-1.5 bg-rose-50 border border-rose-150 px-2 py-1 rounded-md text-right">
                            <span className="text-[10px] font-bold text-rose-700">¿Borrar?</span>
                            <button
                              onClick={() => {
                                onDeleteMetric(m.id);
                                setDeleteMetricConfirmId(null);
                              }}
                              className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-1.5 py-0.5 rounded text-[9px] cursor-pointer"
                            >
                              Sí
                            </button>
                            <button
                              onClick={() => setDeleteMetricConfirmId(null)}
                              className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-1.5 py-0.5 rounded text-[9px] cursor-pointer"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteMetricConfirmId(m.id)}
                            className="text-slate-400 hover:text-red-600 p-1 rounded transition-colors cursor-pointer"
                            title="Eliminar medición"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
