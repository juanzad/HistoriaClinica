import { useCallback, useEffect, useRef, useState } from 'react';
import { Appointment } from '../types';
import { loadGoogleCalendarId, saveGoogleCalendarId } from '../firebase';
import {
  authorizeGoogle, ensureCalendar, GoogleAuthNeeded, hasGoogleToken, loadGoogleScript, revokeGoogle, syncAppointments,
} from './googleCalendar';

export type GoogleSyncStatus = 'loading' | 'off' | 'needs-auth' | 'syncing' | 'ok' | 'error';

export interface GoogleCalendarState {
  status: GoogleSyncStatus;
  calendarId: string | null;
  /** Turnos con cambios que todavía no están en Google. */
  pending: number;
  lastSyncAt?: string;
  message?: string;
  /** Conecta (la primera vez) o sincroniza ahora. Debe llamarse desde un clic. */
  sync: () => void;
  disconnect: () => void;
}

const localKey = (uid: string) => `hc_${uid}_gcal`;

/**
 * Mantiene el calendario "Turnos médicos" de Google igual a la agenda. Mientras el permiso
 * de Google esté vigente (1 hora desde el último clic en Conectar/Sincronizar), cada cambio
 * se envía solo; si venció, queda indicado y se envía con "Sincronizar".
 */
export function useGoogleCalendar(
  uid: string,
  email: string | null,
  appointments: Appointment[],
  isLoaded: boolean,
  onSynced: (versions: Record<string, string>) => void
): GoogleCalendarState {
  const [calendarId, setCalendarId] = useState<string | null>(() => {
    try { return localStorage.getItem(localKey(uid)); } catch { return null; }
  });
  const [status, setStatus] = useState<GoogleSyncStatus>('loading');
  const [message, setMessage] = useState<string>();
  const [lastSyncAt, setLastSyncAt] = useState<string>();
  const latest = useRef({ appointments, calendarId, onSynced });
  latest.current = { appointments, calendarId, onSynced };
  const running = useRef(false);
  const again = useRef(false);

  const rememberCalendar = (id: string | null) => {
    setCalendarId(id);
    try {
      if (id) localStorage.setItem(localKey(uid), id);
      else localStorage.removeItem(localKey(uid));
    } catch { /* sin almacenamiento local: queda en la nube */ }
  };

  // Calendario vinculado desde otro dispositivo.
  useEffect(() => {
    let cancelled = false;
    loadGoogleCalendarId()
      .then((id) => {
        if (cancelled) return;
        if (id) rememberCalendar(id);
        setStatus((s) => (s === 'loading' ? ((id ?? latest.current.calendarId) ? 'needs-auth' : 'off') : s));
      })
      .catch(() => !cancelled && setStatus((s) => (s === 'loading' ? (latest.current.calendarId ? 'needs-auth' : 'off') : s)));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  // Con el calendario vinculado se precarga la librería de Google, así la ventana abre en el mismo clic.
  useEffect(() => {
    if (calendarId) loadGoogleScript().catch(() => {});
  }, [calendarId]);

  const run = useCallback(async () => {
    if (running.current) { again.current = true; return; }
    running.current = true;
    setStatus('syncing');
    setMessage(undefined);
    try {
      do {
        again.current = false;
        const known = latest.current.calendarId;
        const id = await ensureCalendar(known);
        const isNew = id !== known;
        if (isNew) {
          rememberCalendar(id);
          await saveGoogleCalendarId(id).catch(() => false);
        }
        const result = await syncAppointments(id, latest.current.appointments, isNew);
        if (Object.keys(result.synced).length) latest.current.onSynced(result.synced);
      } while (again.current);
      setLastSyncAt(new Date().toISOString());
      setStatus('ok');
    } catch (err: any) {
      if (err instanceof GoogleAuthNeeded) setStatus('needs-auth');
      else {
        setStatus('error');
        setMessage(err?.message || 'No se pudo sincronizar con Google Calendar.');
      }
    } finally {
      running.current = false;
    }
  }, []);

  const sync = useCallback(() => {
    setMessage(undefined);
    if (hasGoogleToken()) { run(); return; }
    authorizeGoogle(email)
      .then(run)
      .catch((err: any) => {
        setStatus(latest.current.calendarId ? 'needs-auth' : 'off');
        setMessage(err?.message);
      });
  }, [email, run]);

  const disconnect = useCallback(() => {
    revokeGoogle();
    rememberCalendar(null);
    saveGoogleCalendarId(null).catch(() => {});
    setStatus('off');
    setMessage(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Envío automático de cada cambio mientras el permiso está vigente.
  const signature = appointments.map((a) => `${a.id}:${a.updatedAt}`).sort().join('|');
  useEffect(() => {
    if (!isLoaded || !calendarId || !hasGoogleToken()) return;
    const t = setTimeout(run, 1500);
    return () => clearTimeout(t);
  }, [signature, calendarId, isLoaded, run]);

  const pending = calendarId
    ? appointments.filter((a) => a.googleSyncedVersion !== a.updatedAt && !(a.status === 'Cancelado' && !a.googleSyncedVersion)).length
    : 0;

  return { status, calendarId, pending, lastSyncAt, message, sync, disconnect };
}
