import React from 'react';

interface State {
  error: Error | null;
}

// Si un error inesperado rompe la pantalla, React la deja en blanco. Esto muestra en cambio
// qué pasó y cómo seguir. Los datos no se pierden: siguen guardados en este dispositivo.
export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Error en la pantalla:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4" id="error-screen">
          <h1 className="font-bold text-lg text-slate-800">Algo falló al mostrar la pantalla</h1>
          <p className="text-sm text-slate-600">
            Tus datos siguen guardados en este dispositivo. Recarga la página para volver a la app.
          </p>
          <p className="text-[11px] font-mono text-red-600 bg-red-50 border border-red-100 rounded-lg p-2 break-words">
            {error.message || String(error)}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm cursor-pointer"
          >
            Recargar
          </button>
        </div>
      </div>
    );
  }
}
