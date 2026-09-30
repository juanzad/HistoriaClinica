import { useMemo, useState } from 'react';
import { Bot, Copy, Download, EyeOff, X, CheckCircle2 } from 'lucide-react';
import { buildAiReport, AiReportInput } from '../utils/aiReport';

interface AiReportModalProps {
  data: AiReportInput;
  onClose: () => void;
}

export default function AiReportModal({ data, onClose }: AiReportModalProps) {
  const [anonymous, setAnonymous] = useState(true);
  const [copied, setCopied] = useState(false);
  const report = useMemo(() => buildAiReport(data, anonymous), [data, anonymous]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      alert('No se pudo copiar automáticamente. Seleccione el texto y cópielo a mano (Ctrl + C).');
    }
  };

  const handleDownload = () => {
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `informe-para-ia-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 relative space-y-4 my-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
          aria-label="Cerrar"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-1 pr-8">
          <div className="flex items-center gap-2 text-blue-600">
            <Bot className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-wider">Informe para revisar con IA</span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            La app no envía tus datos a ninguna IA. Copia este texto y pégalo tú en el chat que prefieras
            (por ejemplo: "Analiza la evolución de mis marcadores y dime qué preguntarle a mi oncóloga").
            Antes, revisa en la configuración de privacidad de esa IA que no use tus conversaciones para entrenar.
          </p>
        </div>

        <label className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3 cursor-pointer">
          <input
            type="checkbox"
            checked={anonymous}
            onChange={(e) => setAnonymous(e.target.checked)}
            className="mt-0.5"
            id="chk-ai-report-anonymous"
          />
          <span className="text-xs text-slate-700">
            <span className="font-bold flex items-center gap-1.5"><EyeOff className="w-3.5 h-3.5" /> Anónimo</span>
            Sin tu nombre, fecha de nacimiento, médicos ni instituciones. Las descripciones y notas se incluyen
            tal como las escribiste: revísalas si mencionan nombres.
          </span>
        </label>

        <textarea
          readOnly
          value={report}
          className="w-full h-72 font-mono text-[11px] leading-relaxed bg-slate-900 text-slate-100 rounded-xl p-3 resize-y"
          id="ai-report-text"
        />

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleCopy}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2 cursor-pointer"
            id="btn-copy-ai-report"
          >
            {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copiado' : 'Copiar texto'}
          </button>
          <button
            onClick={handleDownload}
            className="flex-1 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl text-sm flex items-center justify-center gap-2 cursor-pointer"
            id="btn-download-ai-report"
          >
            <Download className="w-4 h-4" />
            Descargar (.txt)
          </button>
        </div>
      </div>
    </div>
  );
}
