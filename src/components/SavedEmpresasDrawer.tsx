import React from 'react';
import { Building2, Download, Trash2, Edit3, X, CheckCircle2, FileJson } from 'lucide-react';
import { EmpresaData } from '../types';

interface SavedEmpresasDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  empresas: EmpresaData[];
  onSelectEmpresa: (empresa: EmpresaData) => void;
  onDeleteEmpresa: (cnpj: string) => void;
}

export const SavedEmpresasDrawer: React.FC<SavedEmpresasDrawerProps> = ({
  isOpen,
  onClose,
  empresas,
  onSelectEmpresa,
  onDeleteEmpresa,
}) => {
  if (!isOpen) return null;

  const downloadSingleJson = (empresa: EmpresaData) => {
    const filename = `Empresa_${empresa.cnpj.replace(/\D/g, '') || 'Cadastro'}.json`;
    const jsonStr = JSON.stringify(empresa, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex justify-end animate-fadeIn">
      <div className="bg-white w-full max-w-md h-full flex flex-col shadow-2xl border-l border-slate-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Building2 className="w-5 h-5 text-blue-400" />
            <div>
              <h3 className="text-sm font-bold">Empresas Cadastradas ({empresas.length})</h3>
              <p className="text-[11px] text-slate-400">
                Histórico local de cadastros contábeis efetuados
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List of Companies */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {empresas.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Building2 className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-xs font-semibold text-slate-600">Nenhuma empresa salva ainda</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Realize uma busca de CNPJ ou extração de PDF e clique em "Salvar Cadastro"
              </p>
            </div>
          ) : (
            empresas.map((emp, index) => (
              <div
                key={emp.cnpj || index}
                className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl hover:border-blue-300 transition-all space-y-2 text-xs"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-slate-800 line-clamp-1">{emp.razao_social || 'Sem Razão Social'}</h4>
                    <span className="font-mono text-slate-500 font-semibold">{emp.cnpj}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    {emp.situacao_cadastral || 'Ativa'}
                  </span>
                </div>

                <div className="text-[11px] text-slate-600 space-y-1">
                  {emp.nire && (
                    <p className="flex items-center text-purple-700 font-mono">
                      <span className="font-semibold mr-1">NIRE:</span> {emp.nire}
                    </p>
                  )}
                  {emp.endereco?.municipio && (
                    <p className="text-slate-500">
                      {emp.endereco.municipio} / {emp.endereco.uf}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectEmpresa(emp);
                      onClose();
                    }}
                    className="inline-flex items-center text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5 mr-1" /> Editar no Formulário
                  </button>

                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => downloadSingleJson(emp)}
                      className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-200 rounded cursor-pointer"
                      title="Download JSON"
                    >
                      <FileJson className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteEmpresa(emp.cnpj)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                      title="Excluir cadastro"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white font-medium text-xs rounded-lg transition-colors cursor-pointer"
          >
            Fechar Painel
          </button>
        </div>
      </div>
    </div>
  );
};
