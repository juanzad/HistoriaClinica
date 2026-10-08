import { Appointment } from '../types';
import { appointmentStart, calendarTitle } from './ics';

// Conexión con Google Calendar, directamente desde el navegador (sin servidor propio).
// Permiso pedido: "calendar.app.created" → la app solo puede crear calendarios propios y
// manejar los eventos de esos calendarios. No puede ver ni tocar tus otros calendarios.

export const GOOGLE_CLIENT_ID = '571029449619-hgvjr856qtul16gru41uaou2bojsgoe1.apps.googleusercontent.com';
const SCOPE = 'https://www.googleapis.com/auth/calendar.app.created';
const API = 'https://www.googleapis.com/calendar/v3';
export const CALENDAR_NAME = 'Turnos médicos';
/** Marca de los eventos creados por la app (para no tocar eventos que el usuario cargue a mano). */
const APP_KEY = 'hcAppointmentId';

declare global {
  interface Window {
    google?: any;
  }
}

/** Hace falta volver a autorizar (permiso vencido o retirado). */
export class GoogleAuthNeeded extends Error {
  constructor() {
    super('Hace falta volver a autorizar el acceso a Google Calendar.');
  }
}

let gisPromise: Promise<void> | null = null;

/** Carga la librería de Google (Google Identity Services). Conviene llamarla antes del clic. */
export function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  gisPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gisPromise = null;
      reject(new Error('No se pudo cargar el acceso de Google. Revisa la conexión a internet.'));
    };
    document.head.appendChild(script);
  });
  return gisPromise;
}

// El permiso dura una hora y queda solo en memoria (no se guarda en el dispositivo ni en la nube).
let token: { value: string; expiresAt: number } | null = null;

export const hasGoogleToken = () => Boolean(token && token.expiresAt > Date.now() + 60_000);

/**
 * Pide permiso con la ventana de Google. Debe llamarse desde un clic: si la librería ya está
 * cargada, la ventana se abre en el mismo clic y el navegador no la bloquea.
 */
export function authorizeGoogle(email?: string | null): Promise<void> {
  if (!window.google?.accounts?.oauth2) return loadGoogleScript().then(() => authorizeGoogle(email));
  return new Promise<void>((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPE,
      login_hint: email ?? undefined,
      callback: (resp: any) => {
        if (resp.error) {
          reject(new Error(resp.error === 'access_denied' ? 'No se dio permiso para usar Google Calendar.' : `Google no dio acceso (${resp.error}).`));
          return;
        }
        if (!window.google.accounts.oauth2.hasGrantedAllScopes(resp, SCOPE)) {
          reject(new Error('Hay que tildar el permiso de calendario en la ventana de Google.'));
          return;
        }
        token = { value: resp.access_token, expiresAt: Date.now() + Number(resp.expires_in || 3600) * 1000 };
        resolve();
      },
      error_callback: (err: any) => {
        reject(new Error(
          err?.type === 'popup_failed_to_open'
            ? 'El navegador bloqueó la ventana de Google. Permite ventanas emergentes para esta página e intenta de nuevo.'
            : 'Se cerró la ventana de Google antes de terminar.'
        ));
      },
    });
    client.requestAccessToken({ prompt: '' });
  });
}

/** Retira el permiso dado a la app (el calendario y sus eventos quedan en Google). */
export function revokeGoogle() {
  if (token && window.google?.accounts?.oauth2) window.google.accounts.oauth2.revoke(token.value, () => {});
  token = null;
}

async function call(method: string, path: string, body?: unknown) {
  if (!hasGoogleToken()) throw new GoogleAuthNeeded();
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${token!.value}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    token = null;
    throw new GoogleAuthNeeded();
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

function apiError(r: { status: number; data: any }) {
  const reason = r.data?.error?.message;
  if (r.status === 403 && /has not been used|is disabled/i.test(reason ?? '')) {
    return new Error('La Google Calendar API no está habilitada en el proyecto de Google Cloud de la credencial.');
  }
  return new Error(`Google Calendar respondió con un error (${r.status})${reason ? `: ${reason}` : ''}.`);
}

const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Argentina/Buenos_Aires';

/** Devuelve el calendario "Turnos médicos" de la app; lo crea si no existe (o si fue borrado en Google). */
export async function ensureCalendar(knownId?: string | null): Promise<string> {
  if (knownId) {
    const r = await call('GET', `/calendars/${encodeURIComponent(knownId)}`);
    if (r.ok) return knownId;
    if (r.status !== 404 && r.status !== 403 && r.status !== 410) throw apiError(r);
  }
  const r = await call('POST', '/calendars', {
    summary: CALENDAR_NAME,
    description: 'Turnos cargados en Mi Bitácora de Salud. Los cambios se hacen desde la app.',
    timeZone: timeZone(),
  });
  if (!r.ok) throw apiError(r);
  return r.data.id as string;
}

/** Id del evento en Google derivado del turno (Google solo acepta letras a-v y números). */
export const googleEventId = (appointmentId: string) => 'hc' + appointmentId.toLowerCase().replace(/[^a-v0-9]/g, '');

const pad = (n: number) => String(n).padStart(2, '0');
const localDateTime = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;

export function eventBody(a: Appointment) {
  const start = appointmentStart(a);
  const end = new Date(start.getTime() + (a.durationMin || 60) * 60_000);
  const tz = timeZone();
  return {
    id: googleEventId(a.id),
    summary: calendarTitle(a),
    location: a.location || undefined,
    description: [a.notes, 'Turno de Mi Bitácora de Salud.'].filter(Boolean).join('\n\n'),
    start: { dateTime: localDateTime(start), timeZone: tz },
    end: { dateTime: localDateTime(end), timeZone: tz },
    status: 'confirmed',
    reminders: { useDefault: false, overrides: a.reminderMinutes > 0 ? [{ method: 'popup', minutes: a.reminderMinutes }] : [] },
    extendedProperties: { private: { [APP_KEY]: a.id } },
  };
}

async function upsertEvent(calendarId: string, a: Appointment) {
  const cal = encodeURIComponent(calendarId);
  const id = googleEventId(a.id);
  const body = eventBody(a);
  // Primero se actualiza (también "revive" un evento borrado); si no existe, se crea.
  let r = await call('PUT', `/calendars/${cal}/events/${id}`, body);
  if (r.status === 404) r = await call('POST', `/calendars/${cal}/events`, body);
  if (!r.ok) throw apiError(r);
}

async function deleteEvent(calendarId: string, eventId: string) {
  const r = await call('DELETE', `/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`);
  if (!r.ok && r.status !== 404 && r.status !== 410) throw apiError(r);
}

export interface SyncResult {
  /** id del turno → versión (updatedAt) que quedó en Google. */
  synced: Record<string, string>;
  written: number;
  removed: number;
}

/**
 * Deja el calendario de Google igual a la agenda: crea o actualiza los turnos que cambiaron,
 * borra los cancelados y los que se eliminaron de la app. Solo toca eventos creados por la app.
 * `force` reenvía todo (calendario nuevo).
 */
export async function syncAppointments(calendarId: string, appointments: Appointment[], force = false): Promise<SyncResult> {
  const result: SyncResult = { synced: {}, written: 0, removed: 0 };
  for (const a of appointments) {
    if (!force && a.googleSyncedVersion === a.updatedAt) continue;
    if (a.status === 'Cancelado') {
      // Si nunca llegó a Google no hay nada que borrar.
      if (a.googleSyncedVersion || force) {
        await deleteEvent(calendarId, googleEventId(a.id));
        result.removed++;
      }
    } else {
      await upsertEvent(calendarId, a);
      result.written++;
    }
    result.synced[a.id] = a.updatedAt;
  }

  // Turnos eliminados de la app: se borran de Google. Con la agenda vacía no se borra nada
  // (podría ser un dispositivo que todavía no cargó los datos).
  if (appointments.length > 0) {
    const keep = new Set(appointments.filter((a) => a.status !== 'Cancelado').map((a) => googleEventId(a.id)));
    let pageToken: string | undefined;
    do {
      const r = await call('GET', `/calendars/${encodeURIComponent(calendarId)}/events?maxResults=2500${pageToken ? `&pageToken=${pageToken}` : ''}`);
      if (!r.ok) throw apiError(r);
      for (const ev of r.data.items ?? []) {
        if (ev.status !== 'cancelled' && ev.extendedProperties?.private?.[APP_KEY] && !keep.has(ev.id)) {
          await deleteEvent(calendarId, ev.id);
          result.removed++;
        }
      }
      pageToken = r.data.nextPageToken;
    } while (pageToken);
  }
  return result;
}
