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

## Cambios en el servidor (`server.ts`)

- `/api/parse-lab-report` exige `Authorization: Bearer <ID token de Firebase>`. El token se verifica
  con `firebase-admin` y el email tiene que estar verificado y en la variable `ALLOWED_EMAILS`.
- Límite de 20 solicitudes cada 15 minutos por IP.
- Solo acepta PDF, PNG, JPEG, WEBP y HEIC. El texto está limitado a 50.000 caracteres y el cuerpo a 20 MB (antes 25 MB en todas las rutas).
- Errores genéricos hacia el cliente: el detalle queda solo en el log del servidor.
- Cabeceras `helmet`: CSP en producción, HSTS, `nosniff`, sin `X-Powered-By`.

## Pasos pendientes (en este orden)

### 1. Cerrar la base de datos (hacerlo ya)

Antes de cambiar nada, guarde una copia: en la app, exporte el PDF o copie los datos. La app
también los tiene en el `localStorage` del navegador.

En la consola de Firebase → **Firestore Database** → base `ai-studio-39098175-…` → **Reglas**,
pegue el contenido de `firestore.rules` y publique. Haga lo mismo en la base `(default)` si existe.
Con la CLI de Firebase: `npx firebase-tools deploy --only firestore:rules,storage`.

Desde ese momento, la "copia en la nube" y la "restauración por código" dejan de funcionar
hasta completar el paso 3. Los datos locales de la app siguen funcionando.

### 2. Activar el login con Google

1. Firebase → **Authentication** → **Sign-in method** → habilite **Google**.
2. **Authentication → Settings → Authorized domains**: agregue el dominio donde está publicada la
   app (la URL de Cloud Run de AI Studio).
3. En AI Studio → **Secrets**, agregue `ALLOWED_EMAILS` con su email (por ejemplo `su-email@gmail.com`).

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
3. En la consola de Firestore, borre la colección `patients`, que tiene la copia vieja y expuesta.

### 5. Recomendado

- Los archivos adjuntos (PDF/imágenes) se guardan dentro de cada evento en base64. Firestore
  admite hasta 1 MB por documento, así que un evento con adjuntos grandes no se podrá respaldar.
  La solución es subir los archivos a Firebase Storage (con reglas por usuario, como las de Firestore).
- Haga **privado** el repositorio de GitHub (Settings → General → Danger Zone → Change visibility).

- Google Cloud Console → **APIs y servicios → Credenciales**: restrinja la API key del navegador a
  los dominios de su app (restricción por *HTTP referrer*).
- Firebase → **App Check**: impide que se usen sus APIs desde fuera de su app.
- Revise en Google AI Studio si su cuenta de Gemini permite usar los datos enviados para entrenamiento;
  para datos médicos conviene un plan que no lo haga.
