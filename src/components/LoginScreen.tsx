import { useState } from 'react';
import { HeartPulse, LogIn, ShieldCheck } from 'lucide-react';
import { signInWithGoogle } from '../firebase';

// Mensajes para los errores de configuración más comunes, para saber qué ajustar en Firebase.
const LOGIN_ERRORS: Record<string, string> = {
  'auth/unauthorized-domain':
    `Este dominio (${window.location.hostname}) no está autorizado. En Firebase → Authentication → Settings → Authorized domains, agréguelo.`,
  'auth/operation-not-allowed':
    'El inicio de sesión con Google no está habilitado. En Firebase → Authentication → Sign-in method, active Google.',
  'auth/configuration-not-found':
    'Firebase Authentication no está activado en el proyecto. En Firebase → Authentication, pulse "Get started" y active Google.',
  'auth/popup-blocked':
    'El navegador bloqueó la ventana de Google. Permita las ventanas emergentes para este sitio e intente de nuevo.',
  'auth/network-request-failed':
    'Sin conexión con Google. Revise su conexión a internet.',
};

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (e: any) {
      // Cerrar el popup no es un error que haya que mostrar.
      if (e?.code !== 'auth/popup-closed-by-user' && e?.code !== 'auth/cancelled-popup-request') {
        console.error(e);
        setError(LOGIN_ERRORS[e?.code] ?? `No se pudo iniciar sesión (${e?.code || 'error desconocido'}). Intente de nuevo.`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans antialiased">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 max-w-sm w-full text-center space-y-6">
        <div className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center text-white mx-auto shadow-sm">
          <HeartPulse className="w-7 h-7" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-extrabold text-slate-900">Mi Bitácora de Salud</h1>
          <p className="text-sm text-slate-500">
            Inicia sesión para acceder a tu historia clínica.
          </p>
        </div>

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
          id="btn-login-google"
        >
          <LogIn className="w-4 h-4" />
          {loading ? 'Abriendo Google…' : 'Ingresar con Google'}
        </button>

        {error && <p className="text-xs text-red-600 font-medium">{error}</p>}

        <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-green-600" />
          Solo tu cuenta puede ver tus datos.
        </p>
      </div>
    </div>
  );
}
