import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { initializeApp as initializeAdminApp } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import firebaseConfig from "./firebase-applet-config.json";

dotenv.config();

// Solo hace falta el projectId para verificar los ID tokens de Firebase Auth
// (se validan contra las claves públicas de Google, sin credenciales de servicio).
initializeAdminApp({ projectId: firebaseConfig.projectId });

// Emails autorizados a usar la IA (separados por coma). Si está vacío, nadie puede usarla.
const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const MAX_TEXT_LENGTH = 50_000;

// Verifica el ID token de Firebase enviado en "Authorization: Bearer <token>"
// y que el email esté verificado y en la lista de autorizados.
async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer (.+)$/);
  if (!match) {
    return res.status(401).json({ error: "Debe iniciar sesión." });
  }
  try {
    const decoded = await getAdminAuth().verifyIdToken(match[1]);
    const email = (decoded.email || "").toLowerCase();
    if (!decoded.email_verified || !ALLOWED_EMAILS.includes(email)) {
      return res.status(403).json({ error: "Usuario no autorizado." });
    }
    res.locals.uid = decoded.uid;
    next();
  } catch {
    return res.status(401).json({ error: "Sesión inválida o expirada." });
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  const isProduction = process.env.NODE_ENV === "production";

  app.disable("x-powered-by");
  // Cloud Run está detrás de un proxy: necesario para que el rate limit vea la IP real.
  app.set("trust proxy", 1);

  // Cabeceras de seguridad. La CSP solo se aplica en producción porque Vite
  // inyecta scripts inline en desarrollo.
  app.use(
    helmet({
      contentSecurityPolicy: isProduction
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'", "https://apis.google.com"],
              styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
              imgSrc: ["'self'", "data:", "blob:", "https:"],
              fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
              connectSrc: [
                "'self'",
                "https://*.googleapis.com",
                "https://*.firebaseio.com",
                "wss://*.firebaseio.com",
                "https://*.firebaseapp.com",
              ],
              frameSrc: ["'self'", "https://*.firebaseapp.com", "https://accounts.google.com"],
              objectSrc: ["'none'"],
              frameAncestors: ["'self'", "https://aistudio.google.com", "https://*.aistudio.google.com"],
            },
          }
        : false,
      // Se usa frame-ancestors de la CSP en su lugar: AI Studio muestra la app en un iframe.
      xFrameOptions: false,
      // Necesario para el popup de inicio de sesión con Google.
      crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    })
  );

  // Límite de peticiones a la IA: evita que alguien agote la cuota de Gemini.
  const aiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Demasiadas solicitudes. Intente de nuevo en unos minutos." },
  });

  // Inicializar Gemini AI
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  // API Route para analizar PDF / imagen / texto de examen de laboratorio
  // El JSON solo se acepta en esta ruta (PDF/imagen en base64, ~15 MB de archivo).
  app.post("/api/parse-lab-report", aiLimiter, requireAuth, express.json({ limit: "20mb" }), async (req, res) => {
    try {
      const { fileData, mimeType, textContent } = req.body || {};

      if (!fileData && !textContent) {
        return res.status(400).json({ error: "Se requiere un archivo (PDF/imagen) o texto del examen." });
      }
      if (fileData !== undefined && (typeof fileData !== "string" || !ALLOWED_MIME_TYPES.has(mimeType))) {
        return res.status(400).json({ error: "Tipo de archivo no permitido. Use PDF, PNG, JPEG o WEBP." });
      }
      if (textContent !== undefined && (typeof textContent !== "string" || textContent.length > MAX_TEXT_LENGTH)) {
        return res.status(400).json({ error: "El texto del informe es demasiado largo." });
      }

      const systemInstruction = `
Eres un asistente médico experto en oncología y análisis de laboratorio clínico.
Tu tarea es analizar un documento (PDF, imagen o texto) de un examen de laboratorio o informe clínico.

Extrae con precisión en formato JSON la siguiente información:
1. "date": Fecha del estudio (formato YYYY-MM-DD). Si no hay año explícito, asume el año actual o más reciente probable.
2. "title": Título descriptivo del examen (ej. "Análisis de Sangre y Marcadores Tumorales", "Hemograma Completo", "Perfil Renal y Hepático").
3. "institution": Centro médico o laboratorio donde se realizó.
4. "professional": Médico solicitante o bioquímico responsable (si figura).
5. "description": Breve resumen de los hallazgos principales en lenguaje claro.
6. "notes": Conclusiones o notas relevantes sobre valores fuera de rango.
7. "labResults": Objeto numérico con los valores encontrados (deja undefined/omitido si no están en el reporte):
   - "wbc": Glóbulos blancos (x10³/µL o mil/mm³)
   - "neutrophils": Neutrófilos absolutos (x10³/µL)
   - "hemoglobin": Hemoglobina (g/dL)
   - "platelets": Plaquetas (x10³/µL)
   - "cea": Marcador Antígeno Carcinoembrionario CEA (ng/mL)
   - "creatinine": Creatinina (mg/dL)
   - "alt_gpt": TGP / ALT (U/L)
   - "ast_got": TGO / AST (U/L)
8. "evolutionAnalysis": Análisis de la evolución o involución que muestra este examen en comparación con valores normales y significancia clínica (ej. "Involución tumoral observada por caída de CEA a niveles normales" o "Evolución favorable de la serie blanca sin mielosupresión").
`;

      const contents: any[] = [];

      if (fileData && mimeType) {
        contents.push({
          inlineData: {
            mimeType: mimeType, // e.g. "application/pdf", "image/png", "image/jpeg"
            data: fileData,
          },
        });
      }

      contents.push({
        text: textContent 
          ? `Por favor analiza este texto de reporte de laboratorio y extrae la información en JSON:\n${textContent}`
          : `Analiza el documento PDF/imagen adjunto y extrae todos los datos de laboratorio en el esquema JSON solicitado.`,
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              date: { type: Type.STRING },
              title: { type: Type.STRING },
              institution: { type: Type.STRING },
              professional: { type: Type.STRING },
              description: { type: Type.STRING },
              notes: { type: Type.STRING },
              evolutionAnalysis: { type: Type.STRING },
              labResults: {
                type: Type.OBJECT,
                properties: {
                  wbc: { type: Type.NUMBER },
                  neutrophils: { type: Type.NUMBER },
                  hemoglobin: { type: Type.NUMBER },
                  platelets: { type: Type.NUMBER },
                  cea: { type: Type.NUMBER },
                  creatinine: { type: Type.NUMBER },
                  alt_gpt: { type: Type.NUMBER },
                  ast_got: { type: Type.NUMBER },
                },
              },
            },
            required: ["title", "description"],
          },
        },
      });

      const jsonText = response.text || "{}";
      const parsedData = JSON.parse(jsonText);

      return res.json({ success: true, data: parsedData });
    } catch (error: any) {
      // El detalle queda en el log del servidor; al cliente solo un mensaje genérico.
      console.error("Error al procesar reporte con Gemini:", error?.message || error);
      return res.status(500).json({ error: "No se pudo procesar el archivo o lectura de IA." });
    }
  });

  // Vite middleware for development
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
