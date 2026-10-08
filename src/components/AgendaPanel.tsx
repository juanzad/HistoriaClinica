import React, { useMemo, useState } from 'react';
import {
  CalendarDays, CalendarPlus, Plus, Clock, MapPin, User, Pencil, Trash2, CheckCircle2, XCircle,
  ChevronLeft, ChevronRight, AlertTriangle, X, History, RefreshCw, Loader2, Link2,
} from 'lucide-react';
import { Appointment } from '../types';
import { appointmentStart, openInCalendar } from '../utils/ics';
import { CALENDAR_NAME } from '../utils/googleCalendar';
import type { GoogleCalendarState } from '../utils/useGoogleCalendar';

interface AgendaPanelProps {
  appointments: Appointment[];
  onAdd: (appointments: Appointment[]) => void;
  onUpdate: (appointment: Appointment) => void;
  onDelete: (id: string) => void;
  /** Marca el turno como realizado y lo pasa a la línea de tiempo. */
  onMarkDone: (appointment: Appointment) => void;
  onAddedToCalendar: (ids: string[]) => void;
  googleCalendar?: GoogleCalendarState;
}

const REMINDERS = [
  { value: 0, label: 'Sin aviso' },
  { value: 60, label: '1 hora antes' },
  { value: 120, label: '2 horas antes' },
  { value: 1440, label: '1 día antes' },
  { value: 2880, label: '2 días antes' },
];
const DEFAULT_REMINDER = 1440;

const COLORS = ['#2563eb', '#db2777', '#059669', '#d97706', '#7c3aed', '#0891b2', '#dc2626', '#4d7c0f'];
const colorFor = (specialty: string) => {
  let h = 0;
  for (const ch of specialty.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
};

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const addDays = (date: string, days: number) => {
  const [y, m, d] = date.split('-').map(Number);
  const r = new Date(y, m - 1, d + days);
  return `${r.getFullYear()}-${String(r.getMonth() + 1).padStart(2, '0')}-${String(r.getDate()).padStart(2, '0')}`;
};
const longDate = (a: Appointment) => {
  const text = appointmentStart(a).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return text.charAt(0).toUpperCase() + text.slice(1);
};

function whenLabel(a: Appointment) {
  const start = appointmentStart(a);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(start);
  day.setHours(0, 0, 0, 0);
  const days = Math.round((day.getTime() - today.getTime()) / 86_400_000);
  if (days === 0) return `Hoy ${a.time}`;
  if (days === 1) return `Mañana ${a.time}`;
  if (days > 1) return `En ${days} días`;
  return `Hace ${-days} ${days === -1 ? 'día' : 'días'}`;
}

const changedSinceCalendar = (a: Appointment) => Boolean(a.calendarAddedAt && a.updatedAt > a.calendarAddedAt);

type Repeat = 'none' | 'dates' | 'every';

interface FormState {
  specialty: string;
  title: string;
  date: string;
  time: string;
  durationMin: number;
  professional: string;
  location: string;
  notes: string;
  reminderMinutes: number;
  repeat: Repeat;
  extraDates: string[];
  everyDays: number;
  count: number;
}

const emptyForm = (): FormState => ({
  specialty: '', title: '', date: todayStr(), time: '09:00', durationMin: 60, professional: '', location: '',
  notes: '', reminderMinutes: DEFAULT_REMINDER, repeat: 'none', extraDates: [], everyDays: 21, count: 4,
});

function GoogleCalendarBox({ g }: { g: GoogleCalendarState }) {
  const [confirmOff, setConfirmOff] = useState(false);
  if (g.status === 'loading') return null;
  const connected = Boolean(g.calendarId);
  const busy = g.status === 'syncing';
  return (
    <div className="border border-slate-200 rounded-xl p-4 space-y-2 bg-slate-50/60" id="google-calendar-box">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-bold text-slate-800">Google Calendar</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {!connected ? (
            <button onClick={g.sync} disabled={busy} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white flex items-center gap-1 cursor-pointer" id="btn-google-connect">
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CalendarPlus className="w-3.5 h-3.5" />} Conectar Google Calendar
            </button>
          ) : (
            <>
              <button onClick={g.sync} disabled={busy} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white flex items-center gap-1 cursor-pointer" id="btn-google-sync">
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} {busy ? 'Sincronizando…' : 'Sincronizar ahora'}
              </button>
              {confirmOff ? (
                <span className="flex items-center gap-1 text-xs">
                  <span className="text-slate-600">¿Desconectar?</span>
                  <button onClick={() => { g.disconnect(); setConfirmOff(false); }} className="font-bold px-2 py-1 rounded bg-slate-700 text-white cursor-pointer" id="btn-google-disconnect-yes">Sí</button>
                  <button onClick={() => setConfirmOff(false)} className="font-bold px-2 py-1 rounded bg-slate-200 cursor-pointer">No</button>
                </span>
              ) : (
                <button onClick={() => setConfirmOff(true)} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-white text-slate-600 cursor-pointer" id="btn-google-disconnect">Desconectar</button>
              )}
            </>
          )}
        </div>
      </div>
      <p className="text-xs text-slate-600" id="google-status">
        {!connected
          ? `Crea el calendario "${CALENDAR_NAME}" en tu cuenta de Google y mantiene ahí tus turnos, con el aviso elegido. Si tu iPhone tiene la cuenta de Google agregada, también los ves en su Calendario. La app solo puede manejar ese calendario: no ve los demás.`
          : g.status === 'ok'
            ? `✓ Turnos sincronizados con el calendario "${CALENDAR_NAME}". Los cambios se envían solos durante la próxima hora.`
            : g.status === 'syncing'
              ? 'Enviando los turnos a Google Calendar…'
              : g.status === 'error'
                ? ''
                : `Vinculado con el calendario "${CALENDAR_NAME}". ${g.pending > 0 ? `Hay ${g.pending} ${g.pending === 1 ? 'turno con cambios' : 'turnos con cambios'} por enviar: ` : ''}toca "Sincronizar ahora" (Google pide confirmar el acceso cada hora).`}
      </p>
      {g.message && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-2 py-1 flex items-start gap-1" id="google-error">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />{g.message}
        </p>
      )}
    </div>
  );
}

export default function AgendaPanel({ appointments, onAdd, onUpdate, onDelete, onMarkDone, onAddedToCalendar, googleCalendar }: AgendaPanelProps) {
  const [form, setForm] = useState<FormState | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const specialties = useMemo(
    () => Array.from(new Set(appointments.map((a) => a.specialty))).sort((a, b) => a.localeCompare(b)),
    [appointments]
  );
  const sorted = useMemo(
    () => [...appointments].sort((a, b) => appointmentStart(a).getTime() - appointmentStart(b).getTime()),
    [appointments]
  );
  const now = Date.now();
  const toConfirm = sorted.filter((a) => a.status === 'Programado' && appointmentStart(a).getTime() < now);
  const upcoming = sorted.filter((a) => a.status === 'Programado' && appointmentStart(a).getTime() >= now);
  const history = sorted.filter((a) => a.status !== 'Programado').reverse();

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => (f ? { ...f, [key]: value } : f));

  const startNew = () => {
    setEditingId(null);
    setForm(emptyForm());
  };
  const startEdit = (a: Appointment) => {
    setEditingId(a.id);
    setForm({
      ...emptyForm(),
      specialty: a.specialty, title: a.title, date: a.date, time: a.time, durationMin: a.durationMin,
      professional: a.professional ?? '', location: a.location ?? '', notes: a.notes ?? '', reminderMinutes: a.reminderMinutes,
    });
  };

  const formDates = (f: FormState) => {
    if (f.repeat === 'dates') return [f.date, ...f.extraDates.filter(Boolean)];
    if (f.repeat === 'every') return Array.from({ length: Math.max(1, f.count) }, (_, i) => addDays(f.date, i * Math.max(1, f.everyDays)));
    return [f.date];
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || !form.specialty.trim() || !form.title.trim() || !form.date) return;
    const ts = new Date().toISOString();
    const base = {
      specialty: form.specialty.trim(),
      title: form.title.trim(),
      time: form.time,
      durationMin: form.durationMin,
      professional: form.professional.trim() || undefined,
      location: form.location.trim() || undefined,
      notes: form.notes.trim() || undefined,
      reminderMinutes: form.reminderMinutes,
    };
    if (editingId) {
      const original = appointments.find((a) => a.id === editingId);
      if (original) onUpdate({ ...original, ...base, date: form.date, updatedAt: ts });
    } else {
      const dates = Array.from(new Set(formDates(form))).sort();
      const seriesId = dates.length > 1 ? `serie-${crypto.randomUUID()}` : undefined;
      onAdd(dates.map((date) => ({
        ...base, id: `turno-${crypto.randomUUID()}`, date, status: 'Programado', seriesId, createdAt: ts, updatedAt: ts,
      })));
    }
    setForm(null);
    setEditingId(null);
  };

  const addToCalendar = (list: Appointment[], fileName: string) => {
    openInCalendar(list, fileName);
    onAddedToCalendar(list.map((a) => a.id));
  };

  const card = (a: Appointment, mode: 'upcoming' | 'confirm' | 'history') => {
    const color = colorFor(a.specialty);
    const seriesPending = a.seriesId ? upcoming.filter((x) => x.seriesId === a.seriesId) : [];
    return (
      <div key={a.id} className="bg-white border border-slate-200 rounded-xl p-4 flex gap-3" style={{ borderLeft: `4px solid ${color}` }} data-testid="appointment-card">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-white" style={{ background: color }}>{a.specialty}</span>
            <span className="text-xs font-bold text-slate-500">{whenLabel(a)}</span>
            {a.status !== 'Programado' && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${a.status === 'Realizado' ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}>{a.status}</span>
            )}
          </div>
          <p className="font-bold text-slate-900 text-sm">{a.title}</p>
          <p className="text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-0.5">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{longDate(a)} · {a.time}</span>
            {a.professional && <span className="flex items-center gap-1"><User className="w-3 h-3" />{a.professional}</span>}
            {a.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{a.location}</span>}
          </p>
          {a.notes && <p className="text-xs text-slate-600 bg-slate-50 rounded-lg px-2 py-1">{a.notes}</p>}
          {mode === 'upcoming' && changedSinceCalendar(a) && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 flex items-start gap-1">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
              Cambió después de agregarlo al calendario: vuelve a agregarlo y borra el anterior del iPhone.
            </p>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            {mode === 'confirm' && (
              <>
                <button onClick={() => onMarkDone(a)} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white flex items-center gap-1 cursor-pointer" data-testid="btn-done">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Se realizó
                </button>
                <button onClick={() => onUpdate({ ...a, status: 'Cancelado', updatedAt: new Date().toISOString() })} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center gap-1 cursor-pointer">
                  <XCircle className="w-3.5 h-3.5" /> No se realizó
                </button>
              </>
            )}
            {mode === 'upcoming' && (
              <>
                <button onClick={() => addToCalendar([a], 'turno')} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1 cursor-pointer" data-testid="btn-add-calendar">
                  <CalendarPlus className="w-3.5 h-3.5" /> {a.calendarAddedAt && !changedSinceCalendar(a) ? 'Agregar de nuevo' : 'Agregar al calendario'}
                </button>
                {seriesPending.length > 1 && seriesPending[0].id === a.id && (
                  <button onClick={() => addToCalendar(seriesPending, 'tratamiento')} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 flex items-center gap-1 cursor-pointer" data-testid="btn-add-series">
                    <CalendarPlus className="w-3.5 h-3.5" /> Agregar todo el tratamiento ({seriesPending.length})
                  </button>
                )}
                <button onClick={() => onUpdate({ ...a, status: 'Cancelado', updatedAt: new Date().toISOString() })} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer">
                  Cancelar turno
                </button>
              </>
            )}
            {mode !== 'history' && (
              <button onClick={() => startEdit(a)} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 flex items-center gap-1 cursor-pointer">
                <Pencil className="w-3.5 h-3.5" /> Editar
              </button>
            )}
            {confirmDeleteId === a.id ? (
              <span className="flex items-center gap-1 text-xs">
                <span className="text-red-700 font-semibold">¿Eliminar?</span>
                <button onClick={() => { onDelete(a.id); setConfirmDeleteId(null); }} className="font-bold px-2 py-1 rounded bg-red-600 text-white cursor-pointer">Sí</button>
                <button onClick={() => setConfirmDeleteId(null)} className="font-bold px-2 py-1 rounded bg-slate-200 cursor-pointer">No</button>
              </span>
            ) : (
              <button onClick={() => setConfirmDeleteId(a.id)} className="text-xs font-semibold px-2 py-1.5 rounded-lg text-slate-400 hover:text-red-600 cursor-pointer" title="Eliminar turno">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // --- Calendario mensual ---
  const monthDays = useMemo(() => {
    const first = new Date(month);
    const offset = (first.getDay() + 6) % 7; // semana empieza el lunes
    const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const cells: Array<string | null> = Array(offset).fill(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(`${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
    return cells;
  }, [month]);
  const byDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of sorted) if (a.status !== 'Cancelado') map.set(a.date, [...(map.get(a.date) ?? []), a]);
    return map;
  }, [sorted]);

  const input = 'w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/20';
  const labelCls = 'text-[11px] font-bold text-slate-500 uppercase tracking-wider';

  return (
    <div className="space-y-6" id="agenda-panel">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl"><CalendarDays className="w-6 h-6" /></div>
            <div>
              <h2 className="font-bold text-lg text-slate-800">Agenda de Turnos</h2>
              <p className="text-xs text-slate-500">Turnos pasados, de hoy y futuros. "Agregar al calendario" los suma al Calendario del iPhone con aviso.</p>
            </div>
          </div>
          {!form && (
            <button onClick={startNew} className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm flex items-center gap-2 cursor-pointer" id="btn-new-appointment">
              <Plus className="w-4 h-4" /> Nuevo turno
            </button>
          )}
        </div>

        {googleCalendar && <GoogleCalendarBox g={googleCalendar} />}

        {form && (
          <form onSubmit={submit} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4" id="appointment-form">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm">{editingId ? 'Editar turno' : 'Nuevo turno'}</h3>
              <button type="button" onClick={() => { setForm(null); setEditingId(null); }} className="text-slate-400 hover:text-slate-600 cursor-pointer" aria-label="Cerrar"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className={labelCls}>Especialidad *</span>
                <input list="specialty-options" required value={form.specialty} onChange={(e) => set('specialty', e.target.value)} placeholder="Ej: Odontología" className={input} name="specialty" />
                <datalist id="specialty-options">{specialties.map((s) => <option key={s} value={s} />)}</datalist>
              </label>
              <label className="space-y-1">
                <span className={labelCls}>Motivo *</span>
                <input required value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Ej: Control, Implante – 1.ª sesión" className={input} name="title" />
              </label>
              <label className="space-y-1">
                <span className={labelCls}>Fecha *</span>
                <input type="date" required value={form.date} onChange={(e) => set('date', e.target.value)} className={input} name="date" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className={labelCls}>Hora *</span>
                  <input type="time" required value={form.time} onChange={(e) => set('time', e.target.value)} className={input} name="time" />
                </label>
                <label className="space-y-1">
                  <span className={labelCls}>Duración</span>
                  <select value={form.durationMin} onChange={(e) => set('durationMin', Number(e.target.value))} className={input}>
                    {[15, 30, 45, 60, 90, 120, 180, 240].map((m) => <option key={m} value={m}>{m < 60 ? `${m} min` : `${m / 60} h`}</option>)}
                  </select>
                </label>
              </div>
              <label className="space-y-1">
                <span className={labelCls}>Profesional</span>
                <input value={form.professional} onChange={(e) => set('professional', e.target.value)} placeholder="Ej: Dra. Nombre Apellido" className={input} name="professional" />
              </label>
              <label className="space-y-1">
                <span className={labelCls}>Lugar</span>
                <input value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="Ej: Hospital, consultorio, dirección" className={input} name="location" />
              </label>
              <label className="space-y-1 sm:col-span-2">
                <span className={labelCls}>Notas</span>
                <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} placeholder="Ej: ir en ayunas, llevar estudios" className={input} name="notes" />
              </label>
              <label className="space-y-1">
                <span className={labelCls}>Aviso en el calendario</span>
                <select value={form.reminderMinutes} onChange={(e) => set('reminderMinutes', Number(e.target.value))} className={input} name="reminder">
                  {REMINDERS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </label>
            </div>

            {!editingId && (
              <div className="space-y-2 border-t border-slate-200 pt-3">
                <span className={labelCls}>¿Más de una fecha?</span>
                <div className="flex flex-wrap gap-2">
                  {([['none', 'Una sola fecha'], ['dates', 'Varias fechas (un tratamiento)'], ['every', 'Se repite cada N días']] as const).map(([value, label]) => (
                    <button type="button" key={value} onClick={() => set('repeat', value)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg border cursor-pointer ${form.repeat === value ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'}`}
                      data-testid={`repeat-${value}`}>
                      {label}
                    </button>
                  ))}
                </div>
                {form.repeat === 'dates' && (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500">La primera fecha es la de arriba. Agrega las demás (misma hora; después puedes editar cada una):</p>
                    {form.extraDates.map((d, i) => (
                      <div key={i} className="flex gap-2">
                        <input type="date" value={d} onChange={(e) => set('extraDates', form.extraDates.map((x, j) => (j === i ? e.target.value : x)))} className={input} data-testid="extra-date" />
                        <button type="button" onClick={() => set('extraDates', form.extraDates.filter((_, j) => j !== i))} className="px-2 text-slate-400 hover:text-red-600 cursor-pointer" aria-label="Quitar fecha"><X className="w-4 h-4" /></button>
                      </div>
                    ))}
                    <button type="button" onClick={() => set('extraDates', [...form.extraDates, ''])} className="text-xs font-bold text-blue-600 flex items-center gap-1 cursor-pointer" id="btn-add-extra-date">
                      <Plus className="w-3.5 h-3.5" /> Agregar otra fecha
                    </button>
                  </div>
                )}
                {form.repeat === 'every' && (
                  <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                    Cada <input type="number" min={1} value={form.everyDays} onChange={(e) => set('everyDays', Number(e.target.value))} className="w-20 bg-white border border-slate-200 rounded-lg px-2 py-1" name="everyDays" /> días,
                    <input type="number" min={1} max={52} value={form.count} onChange={(e) => set('count', Number(e.target.value))} className="w-20 bg-white border border-slate-200 rounded-lg px-2 py-1" name="count" /> turnos en total
                  </div>
                )}
                {form.repeat !== 'none' && (
                  <p className="text-xs text-slate-500">Se crearán {new Set(formDates(form).filter(Boolean)).size} turnos.</p>
                )}
              </div>
            )}

            <button type="submit" className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm cursor-pointer" id="btn-save-appointment">
              {editingId ? 'Guardar cambios' : 'Guardar turno'}
            </button>
          </form>
        )}
      </div>

      {toConfirm.length > 0 && (
        <section className="space-y-3" id="agenda-to-confirm">
          <h3 className="text-sm font-bold text-amber-700 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Turnos pasados para confirmar ({toConfirm.length})</h3>
          <p className="text-xs text-slate-500 -mt-2">"Se realizó" lo agrega a tu línea de tiempo como evento clínico.</p>
          {toConfirm.map((a) => card(a, 'confirm'))}
        </section>
      )}

      <section className="space-y-3" id="agenda-upcoming">
        <h3 className="text-sm font-bold text-slate-700">Próximos turnos ({upcoming.length})</h3>
        {upcoming.length === 0 ? (
          <p className="text-sm text-slate-400 bg-white border border-dashed border-slate-200 rounded-xl p-6 text-center">No hay turnos próximos. Toca "Nuevo turno" para agregar uno.</p>
        ) : upcoming.map((a) => card(a, 'upcoming'))}
      </section>

      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3" id="agenda-month">
        <div className="flex items-center justify-between">
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer" aria-label="Mes anterior"><ChevronLeft className="w-4 h-4" /></button>
          <h3 className="text-sm font-bold text-slate-700 capitalize">{month.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}</h3>
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer" aria-label="Mes siguiente"><ChevronRight className="w-4 h-4" /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 uppercase">
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {monthDays.map((day, i) => {
            if (!day) return <div key={i} />;
            const items = byDay.get(day) ?? [];
            const isToday = day === todayStr();
            return (
              <div key={day} className={`min-h-[64px] rounded-lg border p-1 text-left ${isToday ? 'border-blue-400 bg-blue-50/50' : 'border-slate-100'}`}>
                <div className={`text-[10px] font-bold ${isToday ? 'text-blue-700' : 'text-slate-400'}`}>{Number(day.slice(8))}</div>
                {items.map((a) => (
                  <div key={a.id} title={`${a.time} ${a.specialty} – ${a.title}`} className="text-[9px] leading-tight text-white rounded px-1 py-0.5 mt-0.5 truncate" style={{ background: colorFor(a.specialty), opacity: a.status === 'Realizado' ? 0.55 : 1 }}>
                    {a.time} {a.specialty}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </section>

      {history.length > 0 && (
        <section className="space-y-3">
          <button onClick={() => setShowHistory(!showHistory)} className="text-sm font-bold text-slate-600 flex items-center gap-2 cursor-pointer" id="btn-toggle-history">
            <History className="w-4 h-4" /> Historial de turnos ({history.length}) {showHistory ? '▲' : '▼'}
          </button>
          {showHistory && history.map((a) => card(a, 'history'))}
        </section>
      )}
    </div>
  );
}
