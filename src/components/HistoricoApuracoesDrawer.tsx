import React, { useState } from 'react';
import {
  X,
  History,
  Calendar,
  DollarSign,
  Briefcase,
  CheckCircle2,
  AlertCircle,
  FileCheck2,
  Search,
  Database,
  RefreshCw,
  Tag,
} from 'lucide-react';
import { useHistoricoApuracoes, ApuracaoHistoricoItem } from '../lib/firebase';

interface HistoricoApuracoesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentCnpj?: string;
}

export const HistoricoApuracoesDrawer: React.FC<HistoricoApuracoesDrawerProps> = ({
  isOpen,
  onClose,
  currentCnpj,
}) => {
  const { historico, loading, error } = useHistoricoApuracoes();
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  const filteredHistory = historico.filter((item) => {
    const term = searchTerm.toLowerCase();
    const matchPa = item.periodoApuracao?.toLowerCase().includes(term);
    const matchCnpj = item.cnpj?.toLowerCase().includes(term);
    const matchStatus = item.status?.toLowerCase().includes(term);
    const matchAtividade = item.atividadeSelecionada?.toLowerCase().includes(term);
    return matchPa || matchCnpj || matchStatus || matchAtividade;
  });

  const getStatusBadge = (status: string) => {
    if (status.includes('Transmitido')) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
          {status}
        </span>
      );
    }
    if (status.includes('Calculado')) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
          <FileCheck2 className="w-3 h-3 mr-1 text-blue-600" />
          {status}
        </span>
      );
    }
    if (status.includes('Erro')) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
          <AlertCircle className="w-3 h-3 mr-1 text-rose-600" />
          {status}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
        <RefreshCw className="w-3 h-3 mr-1 text-amber-600" />
        {status}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end animate-fadeIn">
      <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col transform transition-transform duration-300">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Histórico de Apurações
                <span className="text-xs font-normal px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Firebase Firestore
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Registros de apurações e transmissões salvas no banco de dados
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por PA (ex: 06/2026), CNPJ, Atividade ou Status..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
              <p className="text-xs font-medium">Carregando histórico do Firestore...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
              <span>Erro ao carregar histórico: {error}</span>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="text-center py-12 px-4 border-2 border-dashed border-slate-200 rounded-xl space-y-3">
              <History className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-xs font-bold text-slate-600">Nenhum registro encontrado no Firestore</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Realize apurações ou transmissões no assistente PGDAS-D para salvar o histórico no banco de dados.
              </p>
            </div>
          ) : (
            filteredHistory.map((item: ApuracaoHistoricoItem) => (
              <div
                key={item.id}
                className="p-4 bg-white border border-slate-200 hover:border-emerald-300 rounded-xl shadow-2xs transition-all space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-1 bg-slate-900 text-white font-mono text-xs font-bold rounded-md flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-emerald-400" />
                      PA {item.periodoApuracao}
                    </span>

                    {item.foiRetificadora ? (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-md border border-amber-200">
                        RETIFICADORA
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-medium rounded-md">
                        ORIGINAL
                      </span>
                    )}
                  </div>

                  {getStatusBadge(item.status)}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                      Receita Declarada
                    </span>
                    <span className="font-semibold text-slate-800 flex items-center gap-1">
                      <DollarSign className="w-3 h-3 text-emerald-600" />
                      R$ {item.valorReceita}
                    </span>
                  </div>

                  {item.nomeEmpresa && (
                    <div className="col-span-2">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                        Empresa
                      </span>
                      <span className="font-semibold text-slate-800 text-[11px] truncate block">{item.nomeEmpresa}</span>
                    </div>
                  )}

                  {item.cnpj && (
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                        CNPJ
                      </span>
                      <span className="font-mono font-medium text-slate-700">{item.cnpj}</span>
                    </div>
                  )}

                  <div className="col-span-2">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                      Atividade
                    </span>
                    <span className="text-slate-600 truncate block text-[11px] flex items-center gap-1">
                      <Briefcase className="w-3 h-3 text-slate-400 shrink-0" />
                      {item.atividadeSelecionada}
                    </span>
                  </div>
                </div>

                {item.mensagem && (
                  <div className="text-[11px] bg-slate-50 p-2 rounded-lg text-slate-600 border border-slate-100">
                    {item.mensagem}
                  </div>
                )}

                <div className="text-[10px] text-slate-400 pt-1 flex justify-between items-center border-t border-slate-100">
                  <span>Data: {new Date(item.dataHora).toLocaleString('pt-BR')}</span>
                  {item.valorDas && <span className="font-bold text-emerald-700">DAS: {item.valorDas}</span>}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>Total de registros: {filteredHistory.length}</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
