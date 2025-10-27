import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { AlertCircle, TrendingUp, DollarSign, Zap, CheckCircle } from 'lucide-react';

const CostMonitoringDashboard = () => {
  const [costData, setCostData] = useState({
    currentMonth: 8.45,
    budget: 50,
    aiCalls: 2134,
    cachedResponses: 12876,
    cacheHitRate: 85.8,
    dailyCosts: [
      { date: '1 Oct', cost: 0.15, calls: 89 },
      { date: '5 Oct', cost: 0.28, calls: 134 },
      { date: '10 Oct', cost: 0.35, calls: 156 },
      { date: '15 Oct', cost: 0.42, calls: 178 },
      { date: '20 Oct', cost: 0.38, calls: 165 },
      { date: '25 Oct', cost: 0.45, calls: 187 }
    ],
    byContext: [
      { name: 'Chatbot', calls: 892, cost: 3.24, cached: 89 },
      { name: 'Scanner', calls: 567, cost: 2.87, cached: 76 },
      { name: 'Búsqueda', calls: 445, cost: 1.56, cached: 92 },
      { name: 'Work Orders', calls: 230, cost: 0.78, cached: 68 }
    ]
  });

  const getStatusColor = (percentage) => {
    if (percentage < 50) return 'text-green-600';
    if (percentage < 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getBudgetStatus = () => {
    const percentage = (costData.currentMonth / costData.budget) * 100;
    if (percentage < 50) return { text: 'Óptimo', icon: CheckCircle, color: 'green' };
    if (percentage < 80) return { text: 'Monitoreando', icon: AlertCircle, color: 'yellow' };
    return { text: 'Crítico', icon: AlertCircle, color: 'red' };
  };

  const status = getBudgetStatus();
  const budgetPercentage = ((costData.currentMonth / costData.budget) * 100).toFixed(1);
  const projectedMonthEnd = (costData.currentMonth / 25 * 30).toFixed(2); // Proyección día 25 → 30

  const totalCalls = costData.aiCalls + costData.cachedResponses;
  const savingsFromCache = (costData.cachedResponses * 0.002).toFixed(2); // ~$0.002 por llamada

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Monitoreo de Costos AI
          </h1>
          <p className="text-gray-600">
            Control en tiempo real de gastos en servicios de inteligencia artificial
          </p>
        </div>

        {/* Alert Banner */}
        {parseFloat(budgetPercentage) > 80 && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded">
            <div className="flex items-center">
              <AlertCircle className="text-red-600 mr-3" size={24} />
              <div>
                <p className="font-semibold text-red-800">
                  Alerta: Presupuesto al {budgetPercentage}%
                </p>
                <p className="text-red-700 text-sm">
                  Considera aumentar el cache hit rate o reducir consultas AI directas
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Current Cost */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <DollarSign className={`text-${getStatusColor(parseFloat(budgetPercentage))}`} size={32} />
              <status.icon className={`text-${status.color}-600`} size={24} />
            </div>
            <h3 className="text-gray-500 text-sm font-medium mb-1">Costo Mes Actual</h3>
            <p className="text-3xl font-bold text-gray-900">${costData.currentMonth}</p>
            <p className="text-sm text-gray-600 mt-2">
              de ${costData.budget} presupuesto ({budgetPercentage}%)
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
              <div
                className={`bg-${status.color}-600 h-2 rounded-full transition-all`}
                style={{ width: `${Math.min(parseFloat(budgetPercentage), 100)}%` }}
              />
            </div>
          </div>

          {/* Projected Cost */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <TrendingUp className="text-blue-600" size={32} />
            </div>
            <h3 className="text-gray-500 text-sm font-medium mb-1">Proyección Fin de Mes</h3>
            <p className="text-3xl font-bold text-gray-900">${projectedMonthEnd}</p>
            <p className="text-sm text-gray-600 mt-2">
              Basado en tendencia actual
            </p>
            <p className={`text-xs mt-2 ${parseFloat(projectedMonthEnd) > costData.budget ? 'text-red-600' : 'text-green-600'}`}>
              {parseFloat(projectedMonthEnd) > costData.budget ? '⚠️ Excede presupuesto' : '✓ Dentro de presupuesto'}
            </p>
          </div>

          {/* AI Calls */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <Zap className="text-purple-600" size={32} />
            </div>
            <h3 className="text-gray-500 text-sm font-medium mb-1">Llamadas AI</h3>
            <p className="text-3xl font-bold text-gray-900">{costData.aiCalls.toLocaleString()}</p>
            <p className="text-sm text-gray-600 mt-2">
              {costData.cachedResponses.toLocaleString()} desde cache
            </p>
            <p className="text-xs text-green-600 mt-2">
              Total consultas: {totalCalls.toLocaleString()}
            </p>
          </div>

          {/* Cache Hit Rate */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <CheckCircle className="text-green-600" size={32} />
            </div>
            <h3 className="text-gray-500 text-sm font-medium mb-1">Cache Hit Rate</h3>
            <p className="text-3xl font-bold text-gray-900">{costData.cacheHitRate}%</p>
            <p className="text-sm text-gray-600 mt-2">
              Ahorro: ${savingsFromCache}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Objetivo: >70%
            </p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Daily Cost Trend */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Tendencia de Costos Diarios
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={costData.dailyCosts}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis label={{ value: 'USD', angle: -90, position: 'insideLeft' }} />
                <Tooltip formatter={(value) => `${value}`} />
                <Legend />
                <Line type="monotone" dataKey="cost" stroke="#8b5cf6" strokeWidth={2} name="Costo" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Calls by Context */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Llamadas por Contexto
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={costData.byContext}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="calls" fill="#3b82f6" name="Llamadas AI" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Detailed Breakdown */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Detalle por Contexto
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Contexto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Llamadas AI
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Costo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Cache Hit %
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Eficiencia
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {costData.byContext.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{item.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{item.calls.toLocaleString()}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">${item.cost}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{item.cached}%</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        item.cached >= 80 ? 'bg-green-100 text-green-800' :
                        item.cached >= 60 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {item.cached >= 80 ? 'Excelente' : item.cached >= 60 ? 'Buena' : 'Mejorar'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recommendations */}
        <div className="mt-8 bg-blue-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">
            💡 Recomendaciones
          </h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>El cache hit rate de {costData.cacheHitRate}% es {costData.cacheHitRate >= 70 ? 'excelente' : 'mejorable'}. {costData.cacheHitRate < 70 && 'Considera aumentar TTLs para consultas frecuentes.'}</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Scanner tiene el menor cache hit rate ({costData.byContext[1].cached}%). Implementa pre-caching de repuestos más consultados.</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Proyección indica ${projectedMonthEnd} al fin de mes. {parseFloat(projectedMonthEnd) > costData.budget ? 'Activa rate limiting más estricto.' : 'Presupuesto bajo control.'}</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Ahorro actual por cache: ${savingsFromCache}/mes. Cada 10% de mejora = ${(parseFloat(savingsFromCache) * 0.1).toFixed(2)} adicionales ahorrados.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default CostMonitoringDashboard;