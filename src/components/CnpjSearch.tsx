import React, { useState } from 'react';
import { Search, Building2, Sparkles, CheckCircle2, AlertCircle, RefreshCw, Copy } from 'lucide-react';
import { EmpresaData } from '../types';

interface CnpjSearchProps {
  onDataLoaded: (data: Partial<EmpresaData>, source: 'api' | 'manual') => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  setErrorMsg: (msg: string | null) => void;
}

// Exemplos de CNPJs reais para facilitar o teste imediato pelo usuário
const QUICK_CNPJS = [
  { label: 'Petrobras', cnpj: '33.000.167/0001-01' },
  { label: 'Banco do Brasil', cnpj: '00.000.000/0001-91' },
  { label: 'Magalu', cnpj: '47.960.950/0001-21' },
  { label: 'Natura', cnpj: '71.673.990/0001-77' },
];

export const CnpjSearch: React.FC<CnpjSearchProps> = ({
  onDataLoaded,
  isLoading,
  setIsLoading,
  setErrorMsg,
}) => {
  const [cnpjInput, setCnpjInput] = useState('');
  const [searchSuccess, setSearchSuccess] = useState<string | null>(null);

  // Aplica máscara de CNPJ à medida que o usuário digita: XX.XXX.XXX/XXXX-XX
  const formatCnpj = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 14);
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
    if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
    if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCnpjInput(formatCnpj(e.target.value));
    setSearchSuccess(null);
    setErrorMsg(null);
  };

  const handleSearch = async (cnpjToSearch?: string) => {
    const targetCnpj = cnpjToSearch || cnpjInput;
    const cleanDigits = targetCnpj.replace(/\D/g, '');

    if (cleanDigits.length !== 14) {
      setErrorMsg('Por favor, informe um CNPJ válido com 14 dígitos (ex: 33.000.167/0001-01).');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSearchSuccess(null);

    try {
      const response = await fetch(`/api/cnpj/${cleanDigits}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Falha ao consultar CNPJ na Receita Federal.');
      }

      onDataLoaded(result.data, 'api');
      setSearchSuccess(`Dados de "${result.data.razao_social}" carregados com sucesso via Receita Federal!`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao conectar à API da Receita Federal.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickSelect = (cnpj: string) => {
    setCnpjInput(cnpj);
    handleSearch(cnpj);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 transition-all">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-800">
              Fluxo 1: Busca Automática por CNPJ
            </h2>
            <p className="text-xs text-slate-500">
              Consulta direta à base oficial da Receita Federal (BrasilAPI)
            </p>
          </div>
        </div>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          Oficial & Gratuito
        </span>
      </div>

      <div className="mt-4">
        <label htmlFor="cnpj-input" className="block text-xs font-medium text-slate-700 mb-1">
          Informe o CNPJ da Empresa
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <input
              id="cnpj-input"
              type="text"
              value={cnpjInput}
              onChange={handleInputChange}
              placeholder="00.000.000/0000-00"
              maxLength={18}
              className="w-full pl-3 pr-10 py-2.5 text-sm bg-slate-50/50 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
            />
            {cnpjInput && (
              <button
                type="button"
                onClick={() => setCnpjInput('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                title="Limpar campo"
              >
                ✕
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => handleSearch()}
            disabled={isLoading || cnpjInput.replace(/\D/g, '').length !== 14}
            className="inline-flex items-center justify-center px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-medium text-sm rounded-lg shadow-sm hover:shadow transition-all duration-150 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Consultando Receita...
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                Buscar CNPJ
              </>
            )}
          </button>
        </div>
      </div>

      {/* Atalhos para CNPJs de Teste Rápido */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-medium text-slate-500 mr-1 flex items-center">
          <Sparkles className="w-3 h-3 mr-1 text-amber-500" /> Teste rápido:
        </span>
        {QUICK_CNPJS.map((item) => (
          <button
            key={item.cnpj}
            type="button"
            onClick={() => handleQuickSelect(item.cnpj)}
            disabled={isLoading}
            className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 rounded-md transition-colors border border-slate-200 cursor-pointer font-medium"
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Mensagem de sucesso */}
      {searchSuccess && (
        <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center space-x-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{searchSuccess}</span>
        </div>
      )}
    </div>
  );
};
