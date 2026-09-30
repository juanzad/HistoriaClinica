# Seguridad: cambios realizados y pasos pendientes

## Problemas encontrados

| # | Problema | Gravedad | Estado |
|---|----------|----------|--------|
| 1 | La app no tiene login: el historial se guarda en `patients/<código aleatorio>` y cualquiera que tenga el código puede leerlo o "restaurarlo". | Crítica | Corregido: login con Google y datos en `users/{uid}` |
| 2 | Las reglas de Firestore están abiertas: con la `apiKey` pública se puede listar, leer y borrar la colección `patients` completa (así funcionaba `clearFirebase.ts`). | Crítica | `firestore.rules` nuevo (falta desplegarlo) |
| 3 | `/api/parse-lab-report` sin autenticación ni límite: cualquiera puede consumir la cuota de Gemini. | Alta | Corregido en `server.ts` |
| 4 | Los errores del servidor devolvían `error.message` al navegador. | Media | Corregido |
| 5 | Sin cabeceras de seguridad (CSP, HSTS, etc.). | Media | Corregido con `helmet` |
| 6 | 9 vulnerabilidades en dependencias (3 altas). | Media | Corregido: `npm audit` → 0 |
| 7 | Datos de salud sin cifrar en `localStorage`, compartidos entre quienes usen el navegador. | Media | Separados por usuario; opción de borrarlos al cerrar sesión |
| 9 | Historia clínica real escrita en el código (`defaultData.ts`, `App.tsx`). | Alta | Eliminada: el repositorio es público |
| 10 | Los eventos creados por el análisis con IA se guardaban sin `id` (no se podían borrar y el respaldo fallaba). | Media | Corregido; los existentes se reparan al cargar |
| 8 | `clearFirebase.ts` borra todos los pacientes sin credenciales. | Alta | No se incluyó en el repositorio. Bórrelo también de su PC. |

## Servidor e IA

- La lectura de exámenes con IA se quitó (antes: Gemini desde `server.ts` y luego Firebase AI Logic).
  La app no envía datos de salud a servicios de IA; "Informe para IA" solo arma un texto que el
  usuario decide si copia y dónde lo pega (anónimo por defecto).
- `server.ts` solo sirve la app (para desarrollo local o AI Studio), con cabeceras `helmet`.

## Respaldo automático

- Cada cambio se guarda solo en la nube a los pocos segundos (y al ocultar/cerrar la pestaña).
- Nunca borra más de 3 registros de la nube de una vez: un borrado grande (p. ej. "Reiniciar desde
  cero") pausa el respaldo automático sin tocar la nube, hasta confirmarlo con "Respaldar".
- Si la nube tiene cambios más nuevos de otro dispositivo, se cargan; si además hay cambios sin
  respaldar en este, se pausa y se pide elegir. Si la nube no responde al abrir, también se pausa.
- La barra lateral muestra el estado y cuándo fue la última copia en archivo (se recomienda cada 2 semanas).

## Pasos pendientes (en este orden)

### 1. Proyecto de Firebase propio

La app usa el proyecto `historiaclinica-df503` (ver `firebase-applet-config.json`), del que usted
es propietario. El proyecto que creó AI Studio (`giga-yolk-fk8sk`) no permitía autorizar dominios
ni garantizaba poder publicar reglas, así que se dejó de usar.

En la consola de Firebase → **Firestore Database** → **Reglas**, pegue el contenido de
`firestore.rules` y publique. Con la CLI de Firebase:
`npx firebase-tools deploy --only firestore:rules,storage`.

### 2. Activar el login con Google

1. Firebase → **Authentication** → **Método de acceso** → habilite **Google**.
2. **Authentication → Configuración → Dominios autorizados**: agregue `juanzad.github.io`
   (y la URL de Cloud Run si también publica la app desde AI Studio).
3. Si usa el servidor (AI Studio / Cloud Run), agregue en **Secrets** `ALLOWED_EMAILS` con su email.

### 3. Interfaz (ya hecho)

La interfaz ya pide iniciar sesión con Google (`src/components/LoginScreen.tsx`), guarda y
restaura el respaldo de la cuenta conectada (`src/firebase.ts`) y envía el token al análisis
con IA. Se quitaron el "código de respaldo" `JUAN-SALUD-xxxxxx` y los datos personales fijos
en el código.

La primera vez que inicie sesión, los datos que la versión anterior dejó en el navegador se
pasan automáticamente a su usuario (`src/utils/localStore.ts`).

### 4. Migrar y borrar los datos viejos

1. Abra la app **en el mismo navegador que venía usando**, inicie sesión y use "Respaldar en la Nube" una vez: sus datos locales se copian a `users/<su uid>`.
2. Compruebe que se ven al restaurar.
3. En el proyecto viejo de AI Studio (`giga-yolk-fk8sk`) → Firestore, borre la colección
   `patients`, que tiene la copia vieja y expuesta.

### 5. Recomendado

- Los archivos adjuntos (PDF/imágenes) se guardan dentro de cada evento en base64. Firestore
  admite hasta 1 MB por documento, así que un evento con adjuntos grandes no se podrá respaldar.
  La solución es subir los archivos a Firebase Storage (con reglas por usuario, como las de Firestore).
- Si deja de usar GitHub Pages, haga **privado** el repositorio (Settings → General → Danger Zone →
  Change visibility). Pages gratuito requiere repositorio público.
- Google Cloud Console → **APIs y servicios → Credenciales**: restrinja la API key del navegador a
  los dominios de su app (restricción por *HTTP referrer*).
- Firebase → **App Check**: impide que se usen sus APIs desde fuera de su app.
- Revise en Google AI Studio si su cuenta de Gemini permite usar los datos enviados para entrenamiento;
  para datos médicos conviene un plan que no lo haga.
