import React, { useState, useEffect } from 'react';
import {
  Building2, Plus, Search, RefreshCw, MapPin, Eye, CheckCircle2, Sparkles, AlertCircle, Trash2, ShieldCheck, Users,
} from 'lucide-react';
import { EmpresaData, Role } from '../types';
import { validateEmpresaCompleta } from '../lib/schemas/empresaSchema';
import { getCompaniesStore, deleteCompanyStore } from '../lib/companiesStore';
import { useAuth } from '../context/AuthContext';

interface EmpresasDashboardProps {
  onNavigate: (path: string) => void;
  onSelectEmpresa?: (empresa: EmpresaData) => void;
}

export const isCadastroCompleto = (c: EmpresaData): boolean => {
  return validateEmpresaCompleta(c);
};

const getCompanyStatusColor = (c: EmpresaData): string => {
  const situacao = (c.situacao_cadastral || (c as any).situacaoCadastral || (c as any).status || '').trim().toUpperCase();
  if (situacao !== 'ATIVA') return 'bg-red-500';
  if (!isCadastroCompleto(c)) return 'bg-amber-500';
  return 'bg-emerald-500';
};

const getCompanyStatusTitle = (c: EmpresaData): string => {
  const situacao = (c.situacao_cadastral || (c as any).situacaoCadastral || (c as any).status || 'ATIVA').trim();
  if (situacao.toUpperCase() !== 'ATIVA') return `Irregular / Inativa (${situacao})`;
  if (!isCadastroCompleto(c)) return 'Cadastro Incompleto (campos obrigatórios pendentes)';
  return 'Ativa e Completa';
};

export const EmpresasDashboard: React.FC<EmpresasDashboardProps> = ({
  onNavigate, onSelectEmpresa,
}) => {
  const { data: session } = useAuth();
  const currentUserId = session?.user?.id;
  const currentRole = (session?.user?.role || 'USER') as Role;

  // Permissões derivadas do role
  const isAdmin = currentRole === 'ADMIN';
  const isContador = currentRole === 'CONTADOR';
  const canManage = isAdmin || isContador; // pode ver carteira e ações em lote

  const [companies, setCompanies] = useState<EmpresaData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ title: string; desc: string; type: 'success' | 'error' } | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedEmpresaModal, setSelectedEmpresaModal] = useState<EmpresaData | null>(null);
  const [empresaToDelete, setEmpresaToDelete] = useState<EmpresaData | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Busca empresas respeitando o RBAC
  const fetchCompanies = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await getCompaniesStore(currentUserId, currentRole);
      setCompanies(data || []);
    } catch (err: any) {
      console.error('Erro ao buscar empresas:', err);
      setErrorMsg('Não foi possível carregar as empresas do banco de dados.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Re-busca quando o role/userId mudar (ex: após login)
    fetchCompanies();
  }, [currentUserId, currentRole]);

  useEffect(() => {
    if (toastMsg) {
      const timer = setTimeout(() => setToastMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMsg]);

  // EXCLUSÃO DIRETA NO FIREBASE BYPASSANDO A API
  const handleConfirmDelete = async () => {
    if (!empresaToDelete) return;
    setIsDeleting(true);
    const targetId = empresaToDelete.id || empresaToDelete.cnpj.replace(/\D/g, '');
    try {
      await deleteCompanyStore(targetId);
      
      setCompanies((prev) =>
        prev.filter((c) => (c.id && c.id !== empresaToDelete.id) || c.cnpj !== empresaToDelete.cnpj)
      );
      setToastMsg({
        title: 'Empresa Excluída',
        desc: `O cadastro da empresa "${empresaToDelete.razao_social}" foi removido com sucesso.`,
        type: 'success',
      });
    } catch (err: any) {
      console.error('Erro ao excluir empresa:', err);
      setToastMsg({
        title: 'Erro ao Excluir',
        desc: err.message || 'Falha ao excluir o registro no servidor.',
        type: 'error',
      });
    } finally {
      setIsDeleting(false);
      setEmpresaToDelete(null);
    }
  };

  const filteredCompanies = companies.filter((c) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    const cleanCnpj = c.cnpj ? c.cnpj.replace(/\D/g, '') : '';
    const cleanTerm = term.replace(/\D/g, '');
    return (
      c.razao_social.toLowerCase().includes(term) ||
      (c.nome_fantasia && c.nome_fantasia.toLowerCase().includes(term)) ||
      (cleanCnpj && cleanTerm && cleanCnpj.includes(cleanTerm)) ||
      (c.cnpj && c.cnpj.toLowerCase().includes(term)) ||
      (c.endereco?.municipio && c.endereco.municipio.toLowerCase().includes(term)) ||
      (c.endereco?.uf && c.endereco.uf.toLowerCase().includes(term))
    );
  });

  const handleOpenEdit = (emp: EmpresaData) => {
    if (onSelectEmpresa) {
      onSelectEmpresa(emp);
    } else {
      onNavigate('/cadastro-empresa');
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* PAGE HEADER */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg">
              <Building2 className="w-5 h-5 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">
              {isAdmin ? 'Gestão Global de Empresas' : isContador ? 'Carteira de Clientes' : 'Minha Empresa'}
            </h2>
            <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full border border-slate-200">
              {companies.length} Cadastrada{companies.length !== 1 ? 's' : ''}
            </span>
            {/* Badge de Role */}
            <span className={`hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              isAdmin
                ? 'bg-purple-50 text-purple-700 border-purple-200'
                : isContador
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}>
              <ShieldCheck className="w-3 h-3" />
              {currentRole}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {isAdmin
              ? 'Visão global — todas as empresas do sistema'
              : isContador
              ? 'Empresas da sua carteira de clientes'
              : 'Cadastro societário e fiscal da sua empresa'}
          </p>
        </div>

        {/* PROMINENT ACTION BUTTON */}
        <div className="flex items-center space-x-3 shrink-0">
          <button
            type="button"
            onClick={fetchCompanies}
            disabled={isLoading}
            className="p-2.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            title="Atualizar lista"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {/* Botão de adicionar empresa: apenas ADMIN e CONTADOR */}
          {canManage && (
            <button
              type="button"
              onClick={() => onNavigate('/cadastro-empresa')}
              className="inline-flex items-center px-4 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm hover:shadow transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              + Adicionar Nova Empresa
            </button>
          )}
        </div>
      </div>

      {/* SEARCH AND FILTERS */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por CNPJ, Razão Social ou Município..."
              className="w-full text-xs pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-500 shrink-0">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <span>Ativa e Completa</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-amber-500"></div>
              <span>Cadastro Incompleto</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              <span>Irregular / Inativa</span>
            </div>
          </div>
        </div>

        {searchTerm && (
          <div className="text-xs text-slate-500 shrink-0">
            Exibindo <span className="font-bold text-slate-800">{filteredCompanies.length}</span> de{' '}
            <span className="font-bold text-slate-800">{companies.length}</span> resultados
          </div>
        )}
      </div>

      {/* TOAST NOTIFICATION BANNER */}
      {toastMsg && (
        <div
          className={`p-4 rounded-xl text-xs font-medium border flex items-center justify-between shadow-xs animate-fadeIn ${
            toastMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center space-x-2">
            {toastMsg.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <div>
              <strong className="block font-bold">{toastMsg.title}</strong>
              <span>{toastMsg.desc}</span>
            </div>
          </div>
          <button type="button" onClick={() => setToastMsg(null)} className="text-slate-400 hover:text-slate-600 text-sm font-bold ml-4 cursor-pointer">✕</button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button type="button" onClick={fetchCompanies} className="text-xs font-bold text-rose-700 underline cursor-pointer">
            Tentar Novamente
          </button>
        </div>
      )}

      {/* TABLE DATA DISPLAY */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
            <p className="text-xs font-medium">Carregando empresas cadastradas...</p>
          </div>
        ) : filteredCompanies.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                {searchTerm ? 'Nenhuma empresa encontrada para essa busca' : 'Nenhuma empresa cadastrada no banco de dados'}
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {searchTerm
                  ? 'Tente pesquisar por outro CNPJ ou nome de empresa.'
                  : 'Comece adicionando uma nova empresa via formulário ou consulta de CNPJ/OCR.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/cadastro-empresa')}
              className="inline-flex items-center px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              + Adicionar Primeira Empresa
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <th className="p-3.5 pl-5">CNPJ</th>
                  <th className="p-3.5">Razão Social / Nome Fantasia</th>
                  <th className="p-3.5">Município / UF</th>
                  <th className="p-3.5">Responsável</th>
                  <th className="p-3.5 text-center pr-5">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredCompanies.map((c, idx) => {
                  const municipioUf = [c.endereco?.municipio, c.endereco?.uf].filter(Boolean).join(' / ');
                  // Verifica se o usuário atual pode editar/excluir esta empresa
                  const podeEditar = isAdmin || c.vinculoAtual === 'DONO' || isContador;
                  const podeExcluir = isAdmin || c.vinculoAtual === 'DONO';

                  return (
                    <tr key={c.id || c.cnpj || idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 pl-5 font-mono font-bold text-slate-900 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${getCompanyStatusColor(c)}`} title={getCompanyStatusTitle(c)} />
                          <span className="text-emerald-700">{c.cnpj || 'Não Informado'}</span>
                        </div>
                      </td>

                      <td className="p-3.5 font-medium max-w-xs">
                        <div className="font-semibold text-slate-900 truncate">
                          {c.razao_social || 'Sem Razão Social'}
                        </div>
                        {c.nome_fantasia && (
                          <div className="text-[11px] text-slate-500 truncate">
                            {c.nome_fantasia}
                          </div>
                        )}
                        {/* Badge de vínculo */}
                        {c.vinculoAtual && (
                          <span className={`mt-1 inline-flex text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                            c.vinculoAtual === 'DONO'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}>
                            {c.vinculoAtual}
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-slate-600 whitespace-nowrap">
                        <div className="flex items-center space-x-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{municipioUf || 'Não Informado'}</span>
                        </div>
                        {c.endereco?.logradouro && (
                          <div className="text-[11px] text-slate-400 truncate max-w-[180px]">
                            {c.endereco.logradouro}
                            {c.endereco.numero ? `, ${c.endereco.numero}` : ''}
                          </div>
                        )}
                      </td>

                      <td className="p-3.5 whitespace-nowrap">
                        <span className="text-xs text-slate-500 font-medium">
                          {c.user?.name || 'Sistema'}
                        </span>
                      </td>

                      <td className="p-3.5 text-center pr-5 whitespace-nowrap">
                        <div className="flex items-center justify-center space-x-2">
                          {/* Ver detalhes: todos os roles podem ver */}
                          <button
                            type="button"
                            onClick={() => setSelectedEmpresaModal(c)}
                            className="p-1.5 text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Ver Detalhes"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Editar: ADMIN, CONTADOR ou DONO */}
                          {podeEditar && (
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(c)}
                              className="px-2.5 py-1 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
                            >
                              Editar
                            </button>
                          )}

                          {/* Excluir: somente ADMIN ou DONO */}
                          {podeExcluir && (
                            <button
                              type="button"
                              onClick={() => setEmpresaToDelete(c)}
                              className="p-1.5 text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                              title="Excluir Empresa"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL DE DETALHES COMPLETO DA EMPRESA */}
      {selectedEmpresaModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-xl overflow-hidden border border-slate-200 max-h-[90vh] flex flex-col">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-emerald-600 rounded-xl">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-sm leading-tight text-white">
                    {selectedEmpresaModal.razao_social}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    CNPJ: {selectedEmpresaModal.cnpj}
                  </p>
                </div>
              </div>

              <button type="button" onClick={() => setSelectedEmpresaModal(null)} className="text-slate-400 hover:text-white text-lg font-bold p-1 cursor-pointer">✕</button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-800 uppercase text-[11px] tracking-wider text-emerald-800">
                  Identificação Federal (Receita)
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <span className="text-slate-500 block">Razão Social:</span>
                    <span className="font-semibold text-slate-800">{selectedEmpresaModal.razao_social}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Nome Fantasia:</span>
                    <span className="font-medium text-slate-800">{selectedEmpresaModal.nome_fantasia || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Situação Cadastral:</span>
                    <span className="font-semibold text-emerald-700">{selectedEmpresaModal.situacao_cadastral}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setSelectedEmpresaModal(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {empresaToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-slate-200 p-6 space-y-4">
            <div className="flex items-start space-x-3">
              <div className="p-3 bg-rose-100 text-rose-700 rounded-xl shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  Excluir Empresa?
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Tem certeza que deseja excluir o cadastro desta empresa?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEmpresaToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};