import { Appointment } from '../types';

// Archivo de calendario (.ics, estándar iCalendar) para agregar turnos al Calendario del iPhone,
// Google Calendar u Outlook. El aviso lo da el calendario del teléfono, sin servidor propio.

const pad = (n: number) => String(n).padStart(2, '0');

/** Fecha/hora en UTC (formato iCalendar). La hora del turno se interpreta en la zona horaria del navegador. */
function toUtcStamp(date: Date) {
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}00Z`
  );
}

export function appointmentStart(a: Pick<Appointment, 'date' | 'time'>) {
  const [y, m, d] = a.date.split('-').map(Number);
  const [hh, mm] = (a.time || '09:00').split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

/** Escapa texto según RFC 5545 (barra, punto y coma, coma y saltos de línea). */
function escapeText(text: string) {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Corta líneas largas (máx. 75 octetos) como pide el estándar, sin partir caracteres UTF-8. */
function fold(line: string) {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = '';
  let bytes = 0;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    const limit = parts.length === 0 ? 75 : 74; // las líneas de continuación empiezan con un espacio
    if (bytes + size > limit) {
      parts.push(current);
      current = '';
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

/** Título detallado: "Odontología – Implante 2.ª sesión (Dra. Pérez)". */
export function calendarTitle(a: Appointment) {
  return `${a.specialty} – ${a.title}${a.professional ? ` (${a.professional})` : ''}`;
}

function vevent(a: Appointment, now: Date) {
  const start = appointmentStart(a);
  const end = new Date(start.getTime() + (a.durationMin || 60) * 60_000);
  const description = [a.notes, 'Agregado desde Mi Bitácora de Salud'].filter(Boolean).join('\n\n');
  const lines = [
    'BEGIN:VEVENT',
    `UID:${a.id}@historiaclinica`,
    `DTSTAMP:${toUtcStamp(now)}`,
    `DTSTART:${toUtcStamp(start)}`,
    `DTEND:${toUtcStamp(end)}`,
    `SUMMARY:${escapeText(calendarTitle(a))}`,
    a.location ? `LOCATION:${escapeText(a.location)}` : '',
    `DESCRIPTION:${escapeText(description)}`,
    a.status === 'Cancelado' ? 'STATUS:CANCELLED' : 'STATUS:CONFIRMED',
  ];
  if (a.reminderMinutes > 0) {
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText(calendarTitle(a))}`,
      `TRIGGER:-PT${a.reminderMinutes}M`,
      'END:VALARM'
    );
  }
  lines.push('END:VEVENT');
  return lines.filter(Boolean);
}

export function buildIcs(appointments: Appointment[], now = new Date()) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Mi Bitacora de Salud//Agenda//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...appointments.flatMap((a) => vevent(a, now)),
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/**
 * Abre el turno en el calendario del dispositivo. En iPhone/iPad, Safari muestra
 * "Agregar al Calendario"; en computadoras se descarga el archivo .ics para abrirlo.
 */
export function openInCalendar(appointments: Appointment[], fileName = 'turno') {
  const ics = buildIcs(appointments);
  if (isIOS()) {
    window.location.href = `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
    return;
  }
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileName}.ics`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
