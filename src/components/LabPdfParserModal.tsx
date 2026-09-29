import { useState } from 'react';
import { Upload, FileText, Sparkles, Check, AlertCircle, X, Loader2, ArrowRight, ShieldCheck, FileUp } from 'lucide-react';
import { MedicalEvent, LabResults } from '../types';
import { parseLabReport } from '../firebase';

interface LabPdfParserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddEvent: (event: MedicalEvent) => void;
}

export default function LabPdfParserModal({ isOpen, onClose, onAddEvent }: LabPdfParserModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string>('');
  const [mimeType, setMimeType] = useState<string>('');
  const [textContent, setTextContent] = useState<string>('');
  const [activeMode, setActiveMode] = useState<'file' | 'text'>('file');

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<{
    date?: string;
    title?: string;
    institution?: string;
    professional?: string;
    description?: string;
    notes?: string;
    evolutionAnalysis?: string;
    labResults?: LabResults;
  } | null>(null);

  if (!isOpen) return null;

  // La versión publicada en GitHub Pages no tiene servidor: el análisis con IA
  // solo funciona en la versión con servidor (AI Studio / Cloud Run).
  if (import.meta.env.VITE_DISABLE_AI === 'true') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-center">
          <Sparkles className="w-8 h-8 text-blue-500 mx-auto" />
          <h3 className="font-sans font-bold text-lg text-slate-900">Lectura con IA no disponible</h3>
          <p className="text-sm text-slate-500 leading-relaxed">
            En esta versión web el análisis automático de exámenes está desactivado.
            Puede cargar el examen con "Agregar Evento Manual".
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold cursor-pointer"
          >
            Entendido
          </button>
        </div>
      </div>
    );
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (selectedFile.size > 15 * 1024 * 1024) {
      setError('El archivo supera el tamaño máximo permitido de 15MB.');
      return;
    }

    setFile(selectedFile);
    setMimeType(selectedFile.type);
    setError(null);

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Extraer solo la parte base64 descartando "data:application/pdf;base64,"
      const base64Data = result.split(',')[1];
      setFileBase64(base64Data);
    };
    reader.onerror = () => {
      setError('Error al leer el archivo seleccionado.');
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleProcess = async () => {
    if (activeMode === 'file' && !fileBase64) {
      setError('Por favor seleccione un archivo PDF o imagen de sus análisis.');
      return;
    }
    if (activeMode === 'text' && !textContent.trim()) {
      setError('Por favor pegue el texto de su informe de laboratorio.');
      return;
    }

    setLoading(true);
    setError(null);
    setParsedData(null);

    try {
      const data = await parseLabReport({
        fileData: activeMode === 'file' ? fileBase64 : undefined,
        mimeType: activeMode === 'file' ? mimeType : undefined,
        textContent: activeMode === 'text' ? textContent : undefined,
      });

      setParsedData(data);
    } catch (err: any) {
      setError(err.message || 'Error al comunicarse con el servicio de lectura de exámenes.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToTimeline = () => {
    if (!parsedData) return;

    // Sin id el evento no se puede borrar ni respaldar en Firestore.
    const newEvent: MedicalEvent = {
      id: 'event-' + crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      date: parsedData.date || new Date().toISOString().split('T')[0],
      title: parsedData.title || 'Análisis de Laboratorio',
      type: 'Laboratorio',
      description: parsedData.description || 'Resultados de examen clínico analizados por IA.',
      institution: parsedData.institution || '',
      professional: parsedData.professional || '',
      notes: parsedData.notes || '',
      labResults: parsedData.labResults,
    };

    onAddEvent(newEvent);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 relative space-y-5 my-8">
        
        {/* Botón Cerrar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Encabezado Modal */}
        <div className="space-y-1 pr-6">
          <div className="flex items-center gap-2 text-blue-600">
            <Sparkles className="w-5 h-5 text-blue-500" />
            <span className="text-xs font-bold uppercase tracking-wider">Lector Inteligente de Exámenes</span>
          </div>
          <h3 className="font-sans font-bold text-xl text-slate-900">
            Lectura e Interpretación de Resultados PDF
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Cargue su informe PDF o foto de análisis de laboratorio. La IA de Google Gemini extraera automáticamente la fecha, marcadores tumorales (CEA) y conteos sanguíneos, generando una comparativa de evolución.
          </p>
        </div>

        {/* Pestañas de Método de Carga */}
        <div className="flex border-b border-slate-200 gap-4">
          <button
            onClick={() => { setActiveMode('file'); setError(null); }}
            className={`pb-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeMode === 'file' 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileUp className="w-4 h-4" />
            Cargar PDF / Imagen
          </button>
          <button
            onClick={() => { setActiveMode('text'); setError(null); }}
            className={`pb-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeMode === 'text' 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            Pegar Texto del Examen
          </button>
        </div>

        {/* Formulario de Carga */}
        {!parsedData && (
          <div className="space-y-4">
            {activeMode === 'file' ? (
              <div className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-xl p-6 text-center bg-slate-50/50 hover:bg-blue-50/20 transition-all cursor-pointer relative">
                <input
                  type="file"
                  accept="application/pdf,image/png,image/jpeg,image/webp"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Upload className="w-6 h-6" />
                </div>
                {file ? (
                  <div>
                    <p className="text-xs font-bold text-slate-800">{file.name}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{(file.size / (1024 * 1024)).toFixed(2)} MB • Listo para analizar</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-bold text-slate-700">Haga clic o arrastre su archivo PDF o foto aquí</p>
                    <p className="text-[10px] text-slate-400 mt-1">Soporta PDFs de laboratorio, imágenes JPG o PNG (máx. 15MB)</p>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Texto o transcripción del análisis de laboratorio:
                </label>
                <textarea
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="Ejemplo: Paciente Nombre Apellido. Fecha: 15/05/2026. CEA: 1.8 ng/mL, Glóbulos Blancos: 6.8 x10³/µL, Neutrófilos: 4.2 x10³/µL, Hemoglobina: 13.8 g/dL, Plaquetas: 220 x10³/µL..."
                  className="w-full h-32 p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={handleProcess}
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Analizando documento con IA Gemini...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Analizar Resultados y Generar Comparativa</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Muestra de Resultados Extraídos */}
        {parsedData && (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="bg-green-50/60 border border-green-200 rounded-xl p-3 flex items-center justify-between text-xs text-green-800">
              <span className="flex items-center gap-1.5 font-bold">
                <ShieldCheck className="w-4 h-4 text-green-600" />
                ¡Documento leído exitosamente por Gemini!
              </span>
              <button
                onClick={() => setParsedData(null)}
                className="text-[10px] text-slate-500 underline hover:text-slate-800 cursor-pointer"
              >
                Cargar otro archivo
              </button>
            </div>

            {/* Datos básicos */}
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Estudio</span>
                <p className="font-bold text-slate-800">{parsedData.title}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Fecha</span>
                <p className="font-bold text-slate-800">{parsedData.date || 'Sin fecha'}</p>
              </div>
              {parsedData.institution && (
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Institución</span>
                  <p className="text-slate-700">{parsedData.institution}</p>
                </div>
              )}
              {parsedData.professional && (
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Profesional</span>
                  <p className="text-slate-700">{parsedData.professional}</p>
                </div>
              )}
            </div>

            {/* Análisis Evolución de IA */}
            {parsedData.evolutionAnalysis && (
              <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-3 text-xs text-blue-900 space-y-1">
                <span className="font-bold text-[11px] text-blue-800 uppercase flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  Interpretación Evolutiva de la IA:
                </span>
                <p className="leading-relaxed">{parsedData.evolutionAnalysis}</p>
              </div>
            )}

            {/* Valores numéricos de laboratorio extraídos */}
            {parsedData.labResults && (
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block">
                  Valores Analíticos Extraídos:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {parsedData.labResults.cea !== undefined && (
                    <div className="p-2.5 bg-red-50/50 border border-red-100 rounded-lg">
                      <span className="text-[9px] font-bold text-red-700 uppercase block">Marcador CEA</span>
                      <span className="text-sm font-bold text-slate-800">{parsedData.labResults.cea} <span className="text-[9px] font-normal text-slate-400">ng/mL</span></span>
                    </div>
                  )}
                  {parsedData.labResults.wbc !== undefined && (
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                      <span className="text-[9px] font-bold text-slate-500 uppercase block">Glóbulos Blancos</span>
                      <span className="text-sm font-bold text-slate-800">{parsedData.labResults.wbc} <span className="text-[9px] font-normal text-slate-400">x10³</span></span>
                    </div>
                  )}
                  {parsedData.labResults.neutrophils !== undefined && (
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                      <span className="text-[9px] font-bold text-slate-500 uppercase block">Neutrófilos</span>
                      <span className="text-sm font-bold text-slate-800">{parsedData.labResults.neutrophils} <span className="text-[9px] font-normal text-slate-400">x10³</span></span>
                    </div>
                  )}
                  {parsedData.labResults.hemoglobin !== undefined && (
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                      <span className="text-[9px] font-bold text-slate-500 uppercase block">Hemoglobina</span>
                      <span className="text-sm font-bold text-slate-800">{parsedData.labResults.hemoglobin} <span className="text-[9px] font-normal text-slate-400">g/dL</span></span>
                    </div>
                  )}
                  {parsedData.labResults.platelets !== undefined && (
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                      <span className="text-[9px] font-bold text-slate-500 uppercase block">Plaquetas</span>
                      <span className="text-sm font-bold text-slate-800">{parsedData.labResults.platelets} <span className="text-[9px] font-normal text-slate-400">x10³</span></span>
                    </div>
                  )}
                  {parsedData.labResults.creatinine !== undefined && (
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                      <span className="text-[9px] font-bold text-slate-500 uppercase block">Creatinina</span>
                      <span className="text-sm font-bold text-slate-800">{parsedData.labResults.creatinine} <span className="text-[9px] font-normal text-slate-400">mg/dL</span></span>
                    </div>
                  )}
                  {parsedData.labResults.alt_gpt !== undefined && (
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                      <span className="text-[9px] font-bold text-slate-500 uppercase block">TGP / ALT</span>
                      <span className="text-sm font-bold text-slate-800">{parsedData.labResults.alt_gpt} <span className="text-[9px] font-normal text-slate-400">U/L</span></span>
                    </div>
                  )}
                  {parsedData.labResults.ast_got !== undefined && (
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                      <span className="text-[9px] font-bold text-slate-500 uppercase block">TGO / AST</span>
                      <span className="text-sm font-bold text-slate-800">{parsedData.labResults.ast_got} <span className="text-[9px] font-normal text-slate-400">U/L</span></span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Resumen explicativo */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed">
              <span className="font-bold block text-[10px] uppercase text-slate-400 mb-0.5">Resumen Clínico Extraído:</span>
              <p>{parsedData.description}</p>
            </div>

            {/* Acciones */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setParsedData(null)}
                className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 font-bold text-xs text-slate-700 rounded-xl transition-all cursor-pointer"
              >
                Volver a Cargar
              </button>
              <button
                onClick={handleSaveToTimeline}
                className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Incorporar a la Línea de Tiempo y Comparativa</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
