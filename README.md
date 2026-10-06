<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/39098175-57c7-4cd3-840d-f23709d808b3

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` and `ALLOWED_EMAILS` in [.env.local](.env.local) (see `.env.example`)
3. Run the app:
   `npm run dev`

## Seguridad

Ver [SEGURIDAD.md](SEGURIDAD.md): cambios realizados y pasos pendientes (reglas de Firestore, login con Google).

## Versión web (GitHub Pages)

Cada cambio en `main` se publica automáticamente en https://juanzad.github.io/HistoriaClinica/
(ver `.github/workflows/pages.yml`).

La app no envía datos de salud a ninguna IA. "Informe para IA" genera un texto (anónimo por
defecto) que el usuario copia y pega, si quiere, en el chat que elija.

Requisitos (una sola vez):
1. GitHub → Settings → Pages → **Source: GitHub Actions**.
2. Firebase → Authentication → Settings → Authorized domains → agregar `juanzad.github.io`.

## Agenda de turnos

Pestaña "Agenda": turnos pasados, de hoy y futuros, con tratamientos de varias fechas, turnos que
se repiten cada N días y confirmación de los turnos pasados ("Se realizó" lo agrega a la línea de
tiempo). "Agregar al calendario" genera un archivo iCalendar (`src/utils/ics.ts`) con aviso: en el
iPhone, Safari ofrece agregarlo al Calendario, que es quien envía la notificación. No hay servidor
de avisos. Los turnos se guardan en `users/{uid}/appointments` (incluido en `firestore.rules`).
