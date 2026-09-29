import React, { useState } from 'react';
import { Cloud, CheckCircle2, AlertTriangle, RefreshCw, UserCircle, ShieldCheck, Trash2 } from 'lucide-react';

interface BackupPanelProps {
  userEmail: string;
  onTriggerBackup: () => Promise<void>;
  onTriggerRestore: () => Promise<boolean>;
  onResetAllData?: () => void;
}

export default function BackupPanel({ 
  userEmail,
  onTriggerBackup, 
  onTriggerRestore,
  onResetAllData
}: BackupPanelProps) {
  const [backupStatus, setBackupStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [restoreStatus, setRestoreStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleBackup = async () => {
    setBackupStatus('loading');
    try {
      await onTriggerBackup();
      setBackupStatus('success');
      // Resetear estado después de unos segundos
      setTimeout(() => setBackupStatus('idle'), 5000);
    } catch (e: any) {
      console.error(e);
      setBackupStatus('error');
      setErrorMsg(e.message || 'Error desconocido al respaldar.');
    }
  };

  const handleRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.confirm('Se reemplazarán los datos de este dispositivo por los del último respaldo. ¿Continuar?')) return;

    setRestoreStatus('loading');
    try {
      const success = await onTriggerRestore();
      if (success) {
        setRestoreStatus('success');
        setTimeout(() => setRestoreStatus('idle'), 5000);
      } else {
        setRestoreStatus('error');
        setErrorMsg('Todavía no hay ningún respaldo guardado en tu cuenta.');
      }
    } catch (e: any) {
      console.error(e);
      setRestoreStatus('error');
      setErrorMsg(e.message || 'Ocurrió un error al intentar restaurar.');
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6" id="backup-panel-section">
      <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
        <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
          <Cloud className="w-6 h-6" />
        </div>
        <div>
          <h2 className="font-sans font-bold text-lg text-slate-800">Copia de Seguridad y Gestión de Base de Datos</h2>
          <p className="text-xs text-slate-500 font-medium">Guarda tu historia clínica en la nube o reinicia la base de datos para comenzar desde cero.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* COLUMNA 1: CREAR RESPALDO */}
        <div className="space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col justify-between">
          <div className="space-y-2">
            <h3 className="font-sans font-bold text-sm text-slate-800 flex items-center gap-2">
              <ShieldCheck className="w-4.5 h-4.5 text-blue-600" />
              Tu Cuenta de Respaldo
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              El respaldo se guarda en tu cuenta. Para recuperarlo en otro teléfono o computadora, solo inicia sesión con la misma cuenta de Google.
            </p>

            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-3 mt-3">
              <UserCircle className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-sm font-bold text-blue-700 truncate" id="backup-account-email">{userEmail}</span>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200/50 mt-4">
            {backupStatus === 'loading' ? (
              <button
                disabled
                className="w-full py-3 bg-blue-400 text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4 animate-spin" />
                Guardando en la Nube...
              </button>
            ) : backupStatus === 'success' ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2 text-green-800 text-xs font-semibold">
                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                <span>Copia de seguridad guardada con éxito en Firestore.</span>
              </div>
            ) : backupStatus === 'error' ? (
              <div className="space-y-2">
                <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-start gap-2 text-red-800 text-xs">
                  <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Error al respaldar</p>
                    <p className="text-[10px] text-red-600 font-mono mt-0.5">{errorMsg}</p>
                  </div>
                </div>
                <button
                  onClick={handleBackup}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Reintentar Respaldo
                </button>
              </div>
            ) : (
              <button
                onClick={handleBackup}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
                id="btn-trigger-backup"
              >
                <Cloud className="w-4 h-4" />
                Respaldar Ahora en la Nube
              </button>
            )}
          </div>
        </div>

        {/* COLUMNA 2: RESTAURAR RESPALDO */}
        <div className="space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col justify-between">
          <div className="space-y-2">
            <h3 className="font-sans font-bold text-sm text-slate-800 flex items-center gap-2">
              <RefreshCw className="w-4.5 h-4.5 text-rose-600" />
              Restaurar Copia de Seguridad
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              ¿Quieres traer a este dispositivo el último respaldo de tu cuenta? Se recuperarán tus informes, registros de inmunoterapia y métricas.
            </p>

            <form onSubmit={handleRestore} className="space-y-3 mt-3">
              {restoreStatus === 'loading' ? (
                <button
                  disabled
                  className="w-full py-2.5 bg-slate-400 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Descargando de Firestore...
                </button>
              ) : restoreStatus === 'success' ? (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2 text-green-800 text-xs font-semibold">
                  <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                  <span>Historial descargado y restaurado con éxito.</span>
                </div>
              ) : restoreStatus === 'error' ? (
                <div className="space-y-2">
                  <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-start gap-2 text-red-800 text-xs">
                    <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs cursor-pointer"
                  >
                    Intentar de Nuevo
                  </button>
                </div>
              ) : (
                <button
                  type="submit"
                  className="w-full py-2.5 font-semibold rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                  id="btn-trigger-restore"
                >
                  Restaurar desde mi Cuenta
                </button>
              )}
            </form>
          </div>

          <div className="text-[10px] text-slate-400 italic text-center mt-4">
            * Al restaurar, se reemplazarán los datos temporales actuales con la información de la copia de seguridad.
          </div>
        </div>
      </div>

      {/* SECCIÓN REINICIAR TODO DESDE CERO */}
      {onResetAllData && (
        <div className="pt-6 border-t border-rose-100">
          <div className="bg-rose-50/70 border border-rose-200/80 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
                <Trash2 className="w-4 h-4" />
                <span>Iniciar Base de Datos Vacía (Desde Cero)</span>
              </div>
              <p className="text-xs text-rose-600/80">
                Borra todos los registros guardados en esta aplicación para comenzar a ingresar una nueva historia clínica desde cero.
              </p>
            </div>
            <button
              onClick={() => {
                if (window.confirm("¿Estás seguro de borrar todos los datos locales y comenzar una base de datos nueva desde cero?")) {
                  onResetAllData();
                }
              }}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Reiniciar Datos desde Cero
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

