import React, { useState } from 'react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';
import { MetricEntry } from '../types';
import { safeFormatDate } from '../utils/dateHelper';
import { TrendingDown, Activity, Heart, Scale } from 'lucide-react';

interface MetricChartsProps {
  metrics: MetricEntry[];
}

export default function MetricCharts({ metrics }: MetricChartsProps) {
  const [activeTab, setActiveTab] = useState<'weight' | 'bloodPressure'>('weight');

  // Ordenar de más antiguo a más reciente para graficar en orden cronológico
  const chartData = [...metrics]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map(m => {
      // Formatear fecha legible
      const formattedDate = safeFormatDate(m.date, {
        month: 'short',
        year: '2-digit'
      });
      return {
        ...m,
        formattedDate,
        systolic: m.systolic,
        diastolic: m.diastolic,
        weight: m.weight,
        heartRate: m.heartRate
      };
    });

  if (metrics.length === 0) {
    return (
      <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-8 text-center text-slate-500">
        <Activity className="w-10 h-10 mx-auto text-slate-400 mb-2" />
        <p>No hay suficientes datos cargados para generar gráficos de tendencia.</p>
      </div>
    );
  }

  // Métricas calculadas para tarjetas de resumen
  const latestMetric = metrics[0]; // Las métricas vienen ordenadas de más reciente a más antigua en la lista principal
  const oldestMetric = metrics[metrics.length - 1];
  const weightDiff = (latestMetric?.weight || 0) - (oldestMetric?.weight || 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6" id="metric-charts-section">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="font-sans font-semibold text-lg text-slate-900">Gráficos de Evolución a Largo Plazo</h3>
          <p className="text-xs text-slate-500">Visualiza el comportamiento de tus métricas corporales clave.</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl self-start">
          <button
            onClick={() => setActiveTab('weight')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'weight'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            id="tab-weight-chart"
          >
            <Scale className="w-4 h-4" />
            Peso (kg)
          </button>
          <button
            onClick={() => setActiveTab('bloodPressure')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'bloodPressure'
                ? 'bg-white text-rose-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            id="tab-bp-chart"
          >
            <Heart className="w-4 h-4" />
            Presión / Pulso
          </button>
        </div>
      </div>

      {/* Resumen Superior */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Peso Actual</p>
            <p className="text-lg font-bold text-slate-800">{latestMetric?.weight} kg</p>
            <span className="text-[10px] font-mono text-slate-400">IMC: {latestMetric?.bmi?.toFixed(1)}</span>
          </div>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center gap-3">
          <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
            <Heart className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Última Presión</p>
            <p className="text-lg font-bold text-slate-800">
              {latestMetric?.systolic}/{latestMetric?.diastolic} <span className="text-xs text-slate-400 font-normal">mmHg</span>
            </p>
            <span className="text-[10px] font-mono text-slate-400">Pulso: {latestMetric?.heartRate} lpm</span>
          </div>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center gap-3">
          <div className="p-2 bg-teal-50 text-teal-600 rounded-lg">
            <TrendingDown className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Diferencia de Peso</p>
            <p className={`text-lg font-bold ${weightDiff < 0 ? 'text-teal-600' : 'text-slate-800'}`}>
              {weightDiff > 0 ? `+${weightDiff.toFixed(1)}` : `${weightDiff.toFixed(1)}`} kg
            </p>
            <span className="text-[10px] text-slate-400 font-mono">Desde el inicio de registros</span>
          </div>
        </div>
      </div>

      {/* Gráfico */}
      <div className="h-[300px] w-full">
        {activeTab === 'weight' ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="formattedDate" 
                tickLine={false} 
                axisLine={false}
                tick={{ fill: '#64748b', fontSize: 11 }}
              />
              <YAxis 
                domain={['dataMin - 3', 'dataMax + 3']} 
                tickLine={false} 
                axisLine={false}
                tick={{ fill: '#64748b', fontSize: 11 }}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}
                labelStyle={{ fontWeight: 'bold', color: '#1e293b', fontSize: 12 }}
                itemStyle={{ color: '#2563eb', fontSize: 12 }}
                formatter={(value: any) => [`${value} kg`, 'Peso']}
              />
              <Line 
                type="monotone" 
                dataKey="weight" 
                stroke="#2563eb" 
                strokeWidth={3} 
                dot={{ r: 5, fill: '#2563eb', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 7 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="formattedDate" 
                tickLine={false} 
                axisLine={false}
                tick={{ fill: '#64748b', fontSize: 11 }}
              />
              <YAxis 
                domain={['dataMin - 10', 'dataMax + 10']}
                tickLine={false} 
                axisLine={false}
                tick={{ fill: '#64748b', fontSize: 11 }}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}
                labelStyle={{ fontWeight: 'bold', color: '#1e293b', fontSize: 12 }}
                itemStyle={{ fontSize: 12 }}
              />
              <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
              <Line 
                type="monotone" 
                dataKey="systolic" 
                name="Presión Sistólica (Sistólica)"
                stroke="#e11d48" 
                strokeWidth={2} 
                dot={{ r: 4, fill: '#e11d48' }}
              />
              <Line 
                type="monotone" 
                dataKey="diastolic" 
                name="Presión Diastólica (Diastólica)"
                stroke="#f59e0b" 
                strokeWidth={2} 
                dot={{ r: 4, fill: '#f59e0b' }}
              />
              <Line 
                type="monotone" 
                dataKey="heartRate" 
                name="Ritmo Cardíaco (lpm)"
                stroke="#0d9488" 
                strokeWidth={1.5} 
                strokeDasharray="4 4"
                dot={{ r: 3, fill: '#0d9488' }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
