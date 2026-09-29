import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware para JSON con limite incrementado para PDFs/imágenes en base64
  app.use(express.json({ limit: "25mb" }));

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
  app.post("/api/parse-lab-report", async (req, res) => {
    try {
      const { fileData, mimeType, textContent } = req.body;

      if (!fileData && !textContent) {
        return res.status(400).json({ error: "Se requiere un archivo (PDF/imagen) o texto del examen." });
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
      console.error("Error al procesar reporte con Gemini:", error);
      return res.status(500).json({ 
        error: "No se pudo procesar el archivo o lectura de IA.", 
        details: error.message || String(error) 
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
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
