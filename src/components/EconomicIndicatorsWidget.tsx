import React, { useEffect, useState } from 'react';
import { TrendingUp, Activity, AlertCircle } from 'lucide-react';

interface Taxa {
  nome: string;
  valor: number;
}

export const EconomicIndicatorsWidget: React.FC = () => {
  const [taxas, setTaxas] = useState<Taxa[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    const fetchTaxas = async () => {
      try {
        const response = await fetch('https://brasilapi.com.br/api/taxas/v1');
        if (!response.ok) throw new Error('Falha na requisição');
        
        const data: Taxa[] = await response.json();
        // Filtra apenas os indicadores principais para o dashboard
        const mainIndicators = data.filter(t => 
          ['Selic', 'CDI', 'IPCA'].includes(t.nome)
        );
        
        setTaxas(mainIndicators);
      } catch (err) {
        console.error('[EconomicIndicators] Erro ao buscar taxas:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchTaxas();
  }, []);

  if (error) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 flex items-center space-x-3 text-slate-400">
        <AlertCircle className="w-5 h-5 text-red-400" />
        <span className="text-sm">Falha ao carregar indicadores econômicos.</span>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-lg">
      <div className="flex items-center space-x-2 mb-6">
        <TrendingUp className="w-5 h-5 text-emerald-400" />
        <h2 className="text-lg font-bold text-white">Indicadores Econômicos</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-slate-800 rounded-2xl p-4 animate-pulse">
                <div className="h-4 bg-slate-700 rounded w-1/2 mb-3"></div>
                <div className="h-8 bg-slate-700 rounded w-3/4"></div>
              </div>
            ))
          : taxas.map((taxa) => (
              <div 
                key={taxa.nome} 
                className="bg-slate-800 border border-slate-700 rounded-2xl p-4 flex flex-col hover:border-emerald-500/30 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {taxa.nome}
                  </span>
                  <Activity className="w-3.5 h-3.5 text-emerald-500/70" />
                </div>
                <div className="flex items-baseline space-x-1">
                  <span className="text-2xl font-black text-white">
                    {taxa.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-sm font-bold text-emerald-400">%</span>
                </div>
              </div>
            ))}
      </div>
      
      <div className="mt-4 text-[10px] text-slate-500 text-right">
        Fonte: Banco Central do Brasil / IBGE
      </div>
    </div>
  );
};