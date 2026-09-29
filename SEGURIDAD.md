# Seguridad: cambios realizados y pasos pendientes

## Problemas encontrados

| # | Problema | Gravedad | Estado |
|---|----------|----------|--------|
| 1 | La app no tiene login: el historial se guarda en `patients/<código aleatorio>` y cualquiera que tenga el código puede leerlo o "restaurarlo". | Crítica | Módulo nuevo `src/lib/secureFirebase.ts` (falta integrarlo, ver abajo) |
| 2 | Las reglas de Firestore están abiertas: con la `apiKey` pública se puede listar, leer y borrar la colección `patients` completa (así funcionaba `clearFirebase.ts`). | Crítica | `firestore.rules` nuevo (falta desplegarlo) |
| 3 | `/api/parse-lab-report` sin autenticación ni límite: cualquiera puede consumir la cuota de Gemini. | Alta | Corregido en `server.ts` |
| 4 | Los errores del servidor devolvían `error.message` al navegador. | Media | Corregido |
| 5 | Sin cabeceras de seguridad (CSP, HSTS, etc.). | Media | Corregido con `helmet` |
| 6 | 9 vulnerabilidades en dependencias (3 altas). | Media | Corregido: `npm audit` → 0 |
| 7 | Datos de salud sin cifrar en `localStorage`. | Media | Se borran al cerrar sesión (`logout()`) |
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

### 3. Integrar el módulo en la interfaz (`src/`)

El código fuente de la interfaz (`src/`) no estaba en el archivo recibido, así que estos cambios
hay que hacerlos en el componente principal (o pedírselos a Claude después de subir `src/`):

```tsx
import {
  watchUser, signInWithGoogle, logout,
  saveHealthRecord, loadHealthRecord, parseLabReport,
} from "./lib/secureFirebase";

// 1. Mostrar una pantalla de login si no hay usuario
const [user, setUser] = useState<User | null | undefined>(undefined);
useEffect(() => watchUser(setUser), []);
if (user === undefined) return <p>Cargando…</p>;
if (!user) return <button onClick={signInWithGoogle}>Ingresar con Google</button>;

// 2. Copia en la nube: reemplazar la función que escribía en "patients/<código>"
await saveHealthRecord({ personalData, events, sideEffects, metrics });

// 3. Restaurar: reemplazar "restaurar por código" por
const record = await loadHealthRecord();

// 4. Análisis de laboratorio: reemplazar el fetch("/api/parse-lab-report", …) por
const data = await parseLabReport({ fileData, mimeType, textContent });

// 5. Botón "Cerrar sesión" (también borra los datos del localStorage)
<button onClick={logout}>Cerrar sesión</button>
```

Además:
- Elimine el código que genera `JUAN-SALUD-xxxxxx`, la clave `juan_health_patient_id` y el campo
  para ingresar un código de paciente.
- Elimine los datos personales fijos en el código (el bloque que pone `age=70`, `weight=93`, etc.
  si el nombre es "Juan"). Esos datos deben vivir solo en la base.

### 4. Migrar y borrar los datos viejos

1. Ya con sesión iniciada, use "Guardar en la nube" una vez: sus datos locales se copian a `users/<su uid>`.
2. Compruebe que se ven al restaurar.
3. En la consola de Firestore, borre la colección `patients`, que tiene la copia vieja y expuesta.

### 5. Recomendado

- Google Cloud Console → **APIs y servicios → Credenciales**: restrinja la API key del navegador a
  los dominios de su app (restricción por *HTTP referrer*).
- Firebase → **App Check**: impide que se usen sus APIs desde fuera de su app.
- Revise en Google AI Studio si su cuenta de Gemini permite usar los datos enviados para entrenamiento;
  para datos médicos conviene un plan que no lo haga.
