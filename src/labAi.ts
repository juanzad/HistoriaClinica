import { getAI, getGenerativeModel, GoogleAIBackend, Schema, AIError, type Part } from 'firebase/ai';
import type { FirebaseApp } from 'firebase/app';

// Lectura de exámenes con Gemini a través de Firebase AI Logic, dentro del propio proyecto
// de Firebase: no hace falta servidor (sirve en GitHub Pages) ni guardar una API key en el código.
// El examen solo se envía para leerlo; lo que se guarda es el evento que el usuario confirma.

const MODEL = 'gemini-3.6-flash';

const SYSTEM_INSTRUCTION = `
Eres un asistente médico experto en oncología y análisis de laboratorio clínico.
Tu tarea es analizar un documento (PDF, imagen o texto) de un examen de laboratorio o informe clínico.

Extrae con precisión en formato JSON la siguiente información:
1. "date": Fecha del estudio (formato YYYY-MM-DD). Si no hay año explícito, asume el año actual o más reciente probable.
2. "title": Título descriptivo del examen (ej. "Análisis de Sangre y Marcadores Tumorales", "Hemograma Completo", "Perfil Renal y Hepático").
3. "institution": Centro médico o laboratorio donde se realizó.
4. "professional": Médico solicitante o bioquímico responsable (si figura).
5. "description": Breve resumen de los hallazgos principales en lenguaje claro.
6. "notes": Conclusiones o notas relevantes sobre valores fuera de rango.
7. "labResults": Objeto numérico con los valores encontrados (omitir los que no estén en el reporte):
   - "wbc": Glóbulos blancos (x10³/µL o mil/mm³)
   - "neutrophils": Neutrófilos absolutos (x10³/µL)
   - "hemoglobin": Hemoglobina (g/dL)
   - "platelets": Plaquetas (x10³/µL)
   - "cea": Marcador Antígeno Carcinoembrionario CEA (ng/mL)
   - "creatinine": Creatinina (mg/dL)
   - "alt_gpt": TGP / ALT (U/L)
   - "ast_got": TGO / AST (U/L)
8. "evolutionAnalysis": Análisis de la evolución o involución que muestra este examen en comparación con valores normales y significancia clínica.
`;

const LAB_KEYS = ['wbc', 'neutrophils', 'hemoglobin', 'platelets', 'cea', 'creatinine', 'alt_gpt', 'ast_got'];
const OPTIONAL_TEXT = ['date', 'institution', 'professional', 'notes', 'evolutionAnalysis'];

const RESPONSE_SCHEMA = Schema.object({
  properties: {
    date: Schema.string(),
    title: Schema.string(),
    institution: Schema.string(),
    professional: Schema.string(),
    description: Schema.string(),
    notes: Schema.string(),
    evolutionAnalysis: Schema.string(),
    labResults: Schema.object({
      properties: Object.fromEntries(LAB_KEYS.map((k) => [k, Schema.number()])),
      optionalProperties: LAB_KEYS,
    }),
  },
  optionalProperties: [...OPTIONAL_TEXT, 'labResults'],
});

const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif']);
const MAX_TEXT_LENGTH = 50_000;

export async function parseLabReportWithAI(
  app: FirebaseApp,
  { fileData, mimeType, textContent }: { fileData?: string; mimeType?: string; textContent?: string }
) {
  const parts: Part[] = [];
  if (fileData) {
    if (!mimeType || !ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new Error('Tipo de archivo no permitido. Use PDF, PNG, JPEG o WEBP.');
    }
    parts.push({ inlineData: { mimeType, data: fileData } });
  }
  if (textContent && textContent.length > MAX_TEXT_LENGTH) {
    throw new Error('El texto del informe es demasiado largo.');
  }
  parts.push({
    text: textContent
      ? `Por favor analiza este texto de reporte de laboratorio y extrae la información en JSON:\n${textContent}`
      : 'Analiza el documento PDF/imagen adjunto y extrae todos los datos de laboratorio en el esquema JSON solicitado.',
  });

  const model = getGenerativeModel(getAI(app, { backend: new GoogleAIBackend() }), {
    model: MODEL,
    systemInstruction: SYSTEM_INSTRUCTION,
    generationConfig: { responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA },
  });

  try {
    const result = await model.generateContent(parts);
    return JSON.parse(result.response.text() || '{}');
  } catch (e) {
    console.error('Error al leer el examen con IA:', e);
    if (e instanceof AIError && e.code === 'api-not-enabled') {
      throw new Error('La lectura con IA no está activada. En Firebase → Servicios de IA → AI Logic, pulse "Comenzar".');
    }
    throw new Error('No se pudo leer el examen con IA. Intente de nuevo o cárguelo manualmente.');
  }
}
