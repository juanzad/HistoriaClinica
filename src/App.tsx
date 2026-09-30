/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  defaultPersonalData, 
  defaultEvents, 
  defaultSideEffects, 
  defaultMetrics 
} from './defaultData';
import { PersonalData, MedicalEvent, SideEffectEntry, MetricEntry } from './types';
import type { User } from 'firebase/auth';
import { saveHealthRecord, loadHealthRecord, watchUser, logout } from './firebase';
import { loadLocalRecord, saveLocalRecord, clearLocalRecord } from './utils/localStore';
import { downloadBackupFile, readBackupFile, mergeById } from './utils/backupFile';
import { generateMedicalReportPDF } from './utils/pdfGenerator';
import { safeFormatDate } from './utils/dateHelper';

import ClinicalTimeline from './components/ClinicalTimeline';
import SideEffectsTracker from './components/SideEffectsTracker';
import PersonalDataPanel from './components/PersonalDataPanel';
import MetricCharts from './components/MetricCharts';
import BackupPanel from './components/BackupPanel';
import LabComparisonPanel from './components/LabComparisonPanel';
import LabPdfParserModal from './components/LabPdfParserModal';
import LoginScreen from './components/LoginScreen';

import { 
  FileText, 
  Clock, 
  Heart, 
  Scale, 
  Cloud, 
  Activity, 
  Download,
  ShieldCheck,
  Stethoscope,
  HeartPulse,
  Edit,
  Check,
  X,
  Sparkles,
  LogOut
} from 'lucide-react';

// Solo se muestra el historial con una sesión de Google iniciada.
export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => watchUser(setUser), []);

  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 text-sm text-slate-500">
        Cargando…
      </div>
    );
  }
  if (!user) return <LoginScreen />;
  return <HealthApp key={user.uid} user={user} />;
}

function HealthApp({ user }: { user: User }) {
  // --- ESTADOS PRINCIPALES ---
  const [personalData, setPersonalData] = useState<PersonalData>(defaultPersonalData);
  const [events, setEvents] = useState<MedicalEvent[]>([]);
  const [sideEffects, setSideEffects] = useState<SideEffectEntry[]>([]);
  const [metrics, setMetrics] = useState<MetricEntry[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'timeline' | 'effects' | 'metrics' | 'labs' | 'backup'>('timeline');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | null }>({ message: '', type: null });
  const [isPdfParserOpen, setIsPdfParserOpen] = useState(false);

  // --- ESTADOS DE EDICIÓN DEL SIDEBAR ---
  const [isEditingSidebar, setIsEditingSidebar] = useState(false);
  const [sidebarName, setSidebarName] = useState('');
  const [sidebarBirthDate, setSidebarBirthDate] = useState('');
  const [sidebarAge, setSidebarAge] = useState<number>(0);
  const [sidebarBloodType, setSidebarBloodType] = useState('A+');
  const [sidebarHeight, setSidebarHeight] = useState<number>(0);
  const [sidebarWeight, setSidebarWeight] = useState<number>(0);
  const [sidebarDiagnosis, setSidebarDiagnosis] = useState('');
  const [sidebarTreatment, setSidebarTreatment] = useState('');
  const [sidebarAllergies, setSidebarAllergies] = useState('');

  const startSidebarEditing = () => {
    setSidebarName(personalData.fullName);
    setSidebarBirthDate(personalData.birthDate || '');
    setSidebarAge(personalData.age);
    setSidebarBloodType(personalData.bloodType || 'A+');
    setSidebarHeight(personalData.height);
    setSidebarWeight(personalData.weight);
    setSidebarDiagnosis(personalData.diagnosis || '');
    setSidebarTreatment(personalData.treatment || '');
    setSidebarAllergies(personalData.allergies || '');
    setIsEditingSidebar(true);
  };

  const handleSidebarBirthDateChange = (dateVal: string) => {
    setSidebarBirthDate(dateVal);
    if (dateVal) {
      const birth = new Date(dateVal);
      const today = new Date();
      let computedAge = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        computedAge--;
      }
      if (computedAge >= 0) {
        setSidebarAge(computedAge);
      }
    }
  };

  const handleSidebarAgeChange = (ageVal: number) => {
    setSidebarAge(ageVal);
    if (ageVal && ageVal > 0) {
      const currentYear = new Date().getFullYear();
      const birthYear = currentYear - ageVal;
      setSidebarBirthDate(`${birthYear}-01-01`);
    }
  };

  const saveSidebarData = () => {
    const updatedData: PersonalData = {
      fullName: sidebarName,
      birthDate: sidebarBirthDate,
      age: sidebarAge,
      bloodType: sidebarBloodType,
      height: sidebarHeight,
      weight: sidebarWeight,
      diagnosis: sidebarDiagnosis || personalData.diagnosis,
      treatment: sidebarTreatment || personalData.treatment,
      allergies: sidebarAllergies || personalData.allergies,
    };
    setPersonalData(updatedData);
    setIsEditingSidebar(false);
    triggerNotification('Perfil de salud actualizado correctamente.', 'success');
  };

  // --- CARGA INICIAL ---
  // Primero la copia local de este usuario; si no hay, se intenta traer el respaldo de la nube.
  useEffect(() => {
    const local = loadLocalRecord(user.uid);
    const hasLocal = Boolean(local.personalData || local.events || local.sideEffects || local.metrics);

    const applyRecord = (record: typeof local) => {
      setPersonalData(record.personalData ?? defaultPersonalData);
      setEvents(record.events ?? defaultEvents);
      setSideEffects(record.sideEffects ?? defaultSideEffects);
      setMetrics(record.metrics ?? defaultMetrics);
      setIsLoaded(true);
    };

    if (hasLocal) {
      applyRecord(local);
      return;
    }

    let cancelled = false;
    loadHealthRecord()
      .then((cloud) => {
        if (!cancelled) applyRecord(cloud ?? {});
      })
      .catch((e) => {
        console.error('Error al cargar el respaldo de la nube:', e);
        if (!cancelled) applyRecord({});
      });
    return () => {
      cancelled = true;
    };
  }, [user.uid]);

  // --- PERSISTENCIA AUTOMÁTICA EN LOCALSTORAGE ---
  useEffect(() => {
    if (isLoaded) {
      saveLocalRecord(user.uid, { personalData, events, sideEffects, metrics });
    }
  }, [personalData, events, sideEffects, metrics, isLoaded, user.uid]);

  // Mostrar notificaciones temporales
  const triggerNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification({ message: '', type: null });
    }, 4000);
  };

  // --- MANEJADORES DE DATOS ---
  
  // Agregar un evento
  const handleAddEvent = (newEvent: MedicalEvent) => {
    const updated = [newEvent, ...events].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setEvents(updated);
    triggerNotification('Evento médico añadido con éxito a tu cronología.', 'success');
  };

  // Actualizar un evento existente
  const handleUpdateEvent = (updatedEvent: MedicalEvent) => {
    const updated = events.map(e => e.id === updatedEvent.id ? updatedEvent : e)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setEvents(updated);
    triggerNotification('Registro médico actualizado correctamente.', 'success');
  };

  // Eliminar un evento
  const handleDeleteEvent = (id: string) => {
    setEvents(events.filter(e => e.id !== id));
    triggerNotification('Evento médico eliminado.', 'success');
  };

  // Agregar un efecto secundario
  const handleAddSideEffect = (newEntry: SideEffectEntry) => {
    const updated = [newEntry, ...sideEffects].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setSideEffects(updated);
    triggerNotification('Reporte de efecto secundario registrado.', 'success');
  };

  // Eliminar un efecto secundario
  const handleDeleteSideEffect = (id: string) => {
    setSideEffects(sideEffects.filter(s => s.id !== id));
    triggerNotification('Registro de efecto secundario eliminado.', 'success');
  };

  // Agregar métrica corporal
  const handleAddMetric = (newMetric: MetricEntry) => {
    const updated = [newMetric, ...metrics].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setMetrics(updated);
    triggerNotification('Nueva medición corporal registrada con éxito.', 'success');
  };

  // Eliminar métrica corporal
  const handleDeleteMetric = (id: string) => {
    setMetrics(metrics.filter(m => m.id !== id));
    triggerNotification('Medición eliminada.', 'success');
  };

  // Actualizar datos personales
  const handleUpdatePersonalData = (newData: PersonalData) => {
    setPersonalData(newData);
    triggerNotification('Perfil de salud actualizado.', 'success');
  };

  // --- OPERACIONES FIRESTORE EN LA NUBE ---
  
  // Subir respaldo
  const triggerCloudBackup = async () => {
    await saveHealthRecord({
      personalData,
      events,
      sideEffects,
      metrics
    });
    triggerNotification('Copia de seguridad guardada con éxito en la nube de Firebase.', 'success');
  };

  // Restaurar respaldo de la cuenta conectada
  const triggerCloudRestore = async (): Promise<boolean> => {
    const cloudData = await loadHealthRecord();
    if (!cloudData) return false;

    setPersonalData(cloudData.personalData);
    setEvents(cloudData.events);
    setSideEffects(cloudData.sideEffects);
    setMetrics(cloudData.metrics);

    triggerNotification('Se ha restaurado el historial clínico guardado en tu cuenta.', 'success');
    return true;
  };

  // Descargar una copia completa en un archivo .json
  const handleExportFile = () => {
    downloadBackupFile({ personalData, events, sideEffects, metrics });
    triggerNotification('Copia del historial descargada en un archivo.', 'success');
  };

  // Importar un archivo .json: agrega los registros que no estén ya cargados.
  const handleImportFile = async (file: File) => {
    const imported = await readBackupFile(file);
    const ev = mergeById(events, imported.events);
    const se = mergeById(sideEffects, imported.sideEffects);
    const mt = mergeById(metrics, imported.metrics);

    const replacePersonal = imported.personalData && window.confirm(
      `¿Reemplazar también los datos personales por los del archivo (${imported.personalData.fullName})?`
    );

    setEvents(ev.merged);
    setSideEffects(se.merged);
    setMetrics(mt.merged);
    if (replacePersonal && imported.personalData) setPersonalData(imported.personalData);

    return { events: ev.added, sideEffects: se.added, metrics: mt.added };
  };

  // Cerrar sesión. En un dispositivo compartido conviene borrar también la copia local.
  const handleLogout = async () => {
    const clearLocal = window.confirm(
      '¿Borrar también los datos guardados en este dispositivo?\n\n' +
      'Acepta si es una computadora compartida (asegúrate antes de haber respaldado en la nube). ' +
      'Cancela para conservarlos aquí.'
    );
    if (clearLocal) clearLocalRecord(user.uid);
    await logout();
  };

  // Reiniciar todo desde cero
  const handleResetAllData = () => {
    const emptyPersonal: PersonalData = {
      fullName: "Paciente Nuevo",
      birthDate: "",
      age: 0,
      weight: 0,
      height: 0,
      bloodType: "A+",
      allergies: "",
      diagnosis: "",
      treatment: ""
    };
    
    setPersonalData(emptyPersonal);
    setEvents([]);
    setSideEffects([]);
    setMetrics([]);
    
    triggerNotification('Base de datos local reiniciada. Puedes empezar a ingresar registros desde cero.', 'success');
  };

  // --- GENERACIÓN DE REPORTE PDF ---
  const handleGeneratePDF = () => {
    try {
      generateMedicalReportPDF(personalData, events, sideEffects, metrics);
      triggerNotification('Reporte clínico PDF generado y descargado.', 'success');
    } catch (e) {
      console.error(e);
      triggerNotification('Error al estructurar el PDF clínico.', 'error');
    }
  };

  // Hitos de tratamiento (cirugías, quimio, radio) en orden cronológico, tomados de la línea de tiempo.
  const treatmentHistory = events
    .filter(e => ['Cirugía', 'Quimioterapia', 'Radioterapia'].includes(e.type))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map(e => e.title)
    .join(' • ');

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .filter(Boolean)
      .map(n => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'MB';
  };

  return (
    <div className="min-h-screen lg:h-screen bg-slate-100 text-[#1E293B] overflow-x-hidden lg:overflow-hidden font-sans flex flex-col lg:border-8 lg:border-[#CBD5E1] antialiased">
      {/* BANNER NOTIFICACIONES */}
      {notification.message && (
        <div className="bg-slate-900 text-white text-xs font-semibold py-2 px-6 text-center shadow-md animate-fade-in transition-all z-50 shrink-0">
          <div className="max-w-4xl mx-auto flex items-center justify-center gap-2">
            {notification.type === 'success' ? (
              <ShieldCheck className="w-4 h-4 text-green-400" />
            ) : (
              <Heart className="w-4 h-4 text-red-400" />
            )}
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden min-h-0">
        {/* LEFT SIDEBAR: PATIENT PROFILE & METRICS */}
        <aside className="w-full lg:w-[300px] bg-white border-b lg:border-b-0 lg:border-r border-[#CBD5E1] flex flex-col shrink-0 overflow-y-auto">
          {/* Ficha principal */}
          <div className="p-6 border-b border-[#E2E8F0] bg-slate-50/50 flex justify-between items-start">
            <div className="min-w-0 flex-1">
              <div className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center text-white text-xl font-bold mb-3 shadow-sm select-none">
                {getInitials(personalData.fullName)}
              </div>
              <h1 className="text-lg font-extrabold text-slate-900 leading-tight truncate" title={personalData.fullName}>
                {personalData.fullName}
              </h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mt-1">
                {user.email}
              </p>
            </div>
            {!isEditingSidebar && (
              <button
                onClick={startSidebarEditing}
                className="text-slate-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                title="Editar datos del paciente"
                id="btn-edit-patient-sidebar"
              >
                <Edit className="w-4 h-4" />
              </button>
            )}
          </div>
          
          {isEditingSidebar ? (
            <div className="p-5 space-y-4 border-b border-slate-100">
              <div className="bg-blue-50/50 p-2.5 rounded-lg border border-blue-100 mb-2">
                <p className="text-[10px] text-blue-700 font-bold leading-normal">
                  💡 Puedes editar la edad o la fecha de nacimiento; se recalcularán entre sí de manera bidireccional.
                </p>
              </div>

              <div>
                <label className="block text-[10px] uppercase text-slate-400 font-bold mb-1">Nombre Completo</label>
                <input
                  type="text"
                  value={sidebarName}
                  onChange={(e) => setSidebarName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-md px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold text-slate-800"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] uppercase text-slate-400 font-bold mb-1">Edad</label>
                  <input
                    type="number"
                    value={sidebarAge || ''}
                    onChange={(e) => handleSidebarAgeChange(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-slate-400 font-bold mb-1">Nacimiento</label>
                  <input
                    type="date"
                    value={sidebarBirthDate}
                    onChange={(e) => handleSidebarBirthDateChange(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] uppercase text-slate-400 font-bold mb-1">Sangre</label>
                  <select
                    value={sidebarBloodType}
                    onChange={(e) => setSidebarBloodType(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold text-slate-800"
                  >
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-slate-400 font-bold mb-1">Altura (cm)</label>
                  <input
                    type="number"
                    value={sidebarHeight || ''}
                    onChange={(e) => setSidebarHeight(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase text-slate-400 font-bold mb-1">Peso (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={sidebarWeight || ''}
                  onChange={(e) => setSidebarWeight(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-md px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold text-slate-800"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={saveSidebarData}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-1.5 px-3 rounded-md text-xs shadow-xs flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  Guardar
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingSidebar(false)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-1.5 px-3 rounded-md text-xs flex items-center justify-center gap-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            /* Grid de Datos del Paciente */
            <div className="p-5 space-y-5">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                  <p className="text-[9px] uppercase text-slate-400 font-bold mb-0.5">Edad</p>
                  <p className="font-bold text-slate-800">{personalData.age} años</p>
                </div>
                <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                  <p className="text-[9px] uppercase text-slate-400 font-bold mb-0.5">Nacimiento</p>
                  <p className="font-bold text-slate-800 truncate" title={personalData.birthDate}>
                    {safeFormatDate(personalData.birthDate)}
                  </p>
                </div>
                <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                  <p className="text-[9px] uppercase text-slate-400 font-bold mb-0.5">Tipo Sangre</p>
                  <p className="font-bold text-red-600">{personalData.bloodType || 'A+'}</p>
                </div>
                <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                  <p className="text-[9px] uppercase text-slate-400 font-bold mb-0.5">Altura</p>
                  <p className="font-bold text-slate-800">{personalData.height} cm</p>
                </div>
                <div className="col-span-2 p-2.5 bg-slate-50 rounded border border-slate-200">
                  <p className="text-[9px] uppercase text-slate-400 font-bold mb-0.5">Peso Actual</p>
                  <p className="font-bold text-slate-800">{personalData.weight} kg</p>
                </div>
              </div>

              {/* Métricas corporales dinámicas */}
              <div className="pt-2">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Métricas Corporales (6m)</h3>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-medium text-slate-700">
                      <span>Peso de referencia</span>
                      <span className="font-mono text-slate-500 font-semibold">{personalData.weight}kg</span>
                    </div>
                    <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="bg-blue-500 h-full rounded-full" style={{ width: `${Math.min(100, Math.max(20, (personalData.weight / 120) * 100))}%` }}></div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-medium text-slate-700">
                      <span>Último Estado de Energía</span>
                      <span className="font-mono text-green-600 font-bold">
                        {sideEffects[0] ? `${sideEffects[0].energyLevel * 10}%` : '50%'}
                      </span>
                    </div>
                    <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="bg-green-500 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${sideEffects[0] ? sideEffects[0].energyLevel * 10 : 50}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Acciones de sincronización y PDF del pie */}
          <div className="mt-auto p-5 border-t border-slate-200 bg-slate-50/70 space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Sesión segura · Firebase</span>
            </div>
            
            <button
              onClick={() => triggerCloudBackup().catch((e) => {
                console.error(e);
                triggerNotification('No se pudo respaldar en la nube. Revise su conexión e intente de nuevo.', 'error');
              })}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-lg text-xs shadow-xs hover:shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
              title="Sincronizar y respaldar todo en la nube"
            >
              <Cloud className="w-3.5 h-3.5" />
              Respaldar en la Nube
            </button>
            
            <button
              onClick={handleGeneratePDF}
              className="w-full bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold py-2 px-3 rounded-lg text-xs shadow-xs hover:shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
              title="Descargar historial clínico completo en PDF"
            >
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              Generar Reporte PDF
            </button>
          </div>
        </aside>

        {/* MAIN CONTENT: TABS AND INFORMATION */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
          {/* Top Header / Navigation Tabular */}
          <header className="bg-white border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between px-6 py-2 sm:h-16 gap-3 shrink-0">
            <nav className="flex flex-wrap gap-1 sm:gap-2">
              <button
                onClick={() => setActiveTab('timeline')}
                className={`py-1.5 px-3.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                  activeTab === 'timeline'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
                id="tab-btn-timeline"
              >
                Línea de Tiempo
              </button>

              <button
                onClick={() => setActiveTab('labs')}
                className={`py-1.5 px-3.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                  activeTab === 'labs'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
                id="tab-btn-labs"
              >
                Análisis de Laboratorio
              </button>

              <button
                onClick={() => setActiveTab('effects')}
                className={`py-1.5 px-3.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                  activeTab === 'effects'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
                id="tab-btn-effects"
              >
                Efectos Inmunoterapia
              </button>

              <button
                onClick={() => setActiveTab('metrics')}
                className={`py-1.5 px-3.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                  activeTab === 'metrics'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
                id="tab-btn-metrics"
              >
                Métricas y Ficha
              </button>

              <button
                onClick={() => setActiveTab('backup')}
                className={`py-1.5 px-3.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                  activeTab === 'backup'
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
                id="tab-btn-backup"
              >
                Ajustes Nube
              </button>
            </nav>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <span className="text-xs font-semibold text-slate-500 truncate max-w-[200px]" title={user.email ?? ''}>{user.email}</span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
                id="btn-logout"
              >
                <LogOut className="w-3.5 h-3.5" />
                Salir
              </button>
            </div>
          </header>

          {/* Main Data Area */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
            {/* Resumen Clínico Oncológico siempre visible arriba o en un formato destacado */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 md:p-5">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Stethoscope className="w-4 h-4 text-blue-600" />
                Resumen de Tratamiento Oncológico
              </h3>
              <div className="bg-slate-900 text-slate-100 p-4 rounded-lg font-mono text-[11px] leading-relaxed relative overflow-hidden shadow-inner">
                {/* Fondo sutil tipo cuadrícula */}
                <div className="absolute inset-0 bg-radial-gradient from-slate-800/10 to-transparent pointer-events-none" />
                <p className="mb-1.5"><span className="text-blue-400 font-bold">DIAGNÓSTICO:</span> {personalData.diagnosis || "Sin especificar"}</p>
                <p className="mb-1.5"><span className="text-blue-400 font-bold">HISTORIAL TTO:</span> {treatmentHistory || "Sin tratamientos registrados"}</p>
                <p className="mb-1.5"><span className="text-blue-400 font-bold">STATUS ACTUAL:</span> {personalData.treatment || "Sin especificar"}</p>
                <div className="mt-3 pt-2 border-t border-slate-800 text-slate-400 italic text-[10px]">
                  Este resumen consolida automáticamente los hitos clínicos clave para agilizar futuras interconsultas.
                </div>
              </div>
            </div>

            {/* CONTENIDO PRINCIPAL SEGÚN PESTAÑA */}
            <div className="min-h-0 animate-fade-in">
              {activeTab === 'timeline' && (
                <ClinicalTimeline 
                  events={events} 
                  onAddEvent={handleAddEvent}
                  onUpdateEvent={handleUpdateEvent}
                  onDeleteEvent={handleDeleteEvent}
                  onOpenPdfParser={() => setIsPdfParserOpen(true)}
                />
              )}

              {activeTab === 'labs' && (
                <LabComparisonPanel 
                  events={events} 
                  onOpenPdfParser={() => setIsPdfParserOpen(true)}
                />
              )}

              {activeTab === 'effects' && (
                <SideEffectsTracker 
                  sideEffects={sideEffects}
                  onAddSideEffect={handleAddSideEffect}
                  onDeleteSideEffect={handleDeleteSideEffect}
                />
              )}

              {activeTab === 'metrics' && (
                <div className="grid grid-cols-1 gap-6">
                  <MetricCharts metrics={metrics} />
                  <PersonalDataPanel 
                    personalData={personalData}
                    onUpdatePersonalData={handleUpdatePersonalData}
                    metrics={metrics}
                    onAddMetric={handleAddMetric}
                    onDeleteMetric={handleDeleteMetric}
                  />
                </div>
              )}

              {activeTab === 'backup' && (
                <BackupPanel 
                  userEmail={user.email ?? ''}
                  onTriggerBackup={triggerCloudBackup}
                  onTriggerRestore={triggerCloudRestore}
                  onExportFile={handleExportFile}
                  onImportFile={handleImportFile}
                  onResetAllData={handleResetAllData}
                />
              )}
            </div>

            {/* Modal para lectura e interpretación de examenes PDF con Gemini IA */}
            <LabPdfParserModal
              isOpen={isPdfParserOpen}
              onClose={() => setIsPdfParserOpen(false)}
              onAddEvent={handleAddEvent}
            />

            {/* PIE DE PÁGINA */}
            <footer className="py-4 text-center text-[11px] text-slate-400 border-t border-slate-200 mt-6 font-medium">
              <p>🩺 Bitácora Médica Personalizada — Diseñada para el seguimiento y acompañamiento oncológico.</p>
              <p className="mt-1 text-slate-400">Tus datos se guardan en este dispositivo y, al respaldar, en tu cuenta de Firebase (solo accesible con tu usuario).</p>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}
