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
(ver `.github/workflows/pages.yml`). La lectura de exámenes con IA usa Firebase AI Logic desde el
navegador (`src/labAi.ts`), así que no necesita servidor.

Requisitos (una sola vez):
1. GitHub → Settings → Pages → **Source: GitHub Actions**.
2. Firebase → Authentication → Settings → Authorized domains → agregar `juanzad.github.io`.
3. Firebase → Servicios de IA → AI Logic → Comenzar → Gemini Developer API (para leer exámenes con IA).
