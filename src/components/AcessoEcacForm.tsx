import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Key,
  Lock,
  Eye,
  EyeOff,
  Building2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
  Bot,
  User,
  CheckCheck,
  XCircle,
  X,
} from 'lucide-react';
import { EmpresaData } from '../types';
import { getAuthHeaders } from '../lib/apiClient';
import { EmitirDasWizard } from './EmitirDasWizard';

interface AcessoEcacFormProps {
  onNavigate?: (path: string) => void;
}

export const AcessoEcacForm: React.FC<AcessoEcacFormProps> = ({ onNavigate }) => {
  const [companies, setCompanies] = useState<EmpresaData[]>([]);
  const [selectedCompanyCnpj, setSelectedCompanyCnpj] = useState<string>('');
  const [cpf, setCpf] = useState<string>('');
  const [codigoAcesso, setCodigoAcesso] = useState<string>('');
  const [showCodigo, setShowCodigo] = useState<boolean>(false);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    timestamp: string;
    cnpj: string;
    companyName: string;
    cpfFormatted: string;
    comprovanteTexto?: string;
    urlLogada?: string;
    messages?: Array<{
      id: string;
      data: string;
      assunto: string;
      remetente: string;
      lida: boolean;
    }>;
  } | null>(null);

  // Carregar empresas disponíveis para vinculação
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const res = await fetch('/api/companies', {
          headers: { ...getAuthHeaders() },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.companies && Array.isArray(data.companies)) {
            setCompanies(data.companies);
            if (data.companies.length > 0) {
              setSelectedCompanyCnpj(data.companies[0].cnpj || '');
            }
            return;
          }
        }
      } catch (err) {
        console.warn('Erro ao carregar empresas do banco:', err);
      }

      // Fallback para localStorage
      try {
        const stored = localStorage.getItem('contabil_empresas');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setCompanies(parsed);
            setSelectedCompanyCnpj(parsed[0].cnpj || '');
          }
        }
      } catch (e) {
        console.warn('Erro ao ler localStorage:', e);
      }
    };

    fetchCompanies();
  }, []);

  // Máscara de CPF (000.000.000-00)
  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 11);
    let formatted = raw;
    if (raw.length > 9) {
      formatted = `${raw.slice(0, 3)}.${raw.slice(3, 6)}.${raw.slice(6, 9)}-${raw.slice(9)}`;
    } else if (raw.length > 6) {
      formatted = `${raw.slice(0, 3)}.${raw.slice(3, 6)}.${raw.slice(6)}`;
    } else if (raw.length > 3) {
      formatted = `${raw.slice(0, 3)}.${raw.slice(3)}`;
    }
    setCpf(formatted);
  };

  const selectedCompany = companies.find(
    (c) => c.cnpj?.replace(/\D/g, '') === selectedCompanyCnpj.replace(/\D/g, '')
  );

  // Verificação de Regime Tributário (Deve ser Simples Nacional)
  const regimeTributarioStr = (
    selectedCompany?.regime_tributario ||
    (selectedCompany as any)?.regimeTributario ||
    'Simples Nacional'
  ).trim();

  const isSimplesNacional =
    !selectedCompany ||
    regimeTributarioStr.toLowerCase().includes('simples') ||
    regimeTributarioStr === '';

  // Função para envio do formulário
  const handleTestConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedCompany) {
      setErrorMessage('Por favor, selecione uma empresa válida.');
      return;
    }

    if (!isSimplesNacional) {
      setErrorMessage('Acesso indisponível: A empresa selecionada não é optante pelo Simples Nacional.');
      return;
    }

    const cleanCnpj = (selectedCompany.cnpj || selectedCompanyCnpj || '').replace(/\D/g, '');
    const cleanCpf = cpf.replace(/\D/g, '');
    const cleanCodigo = codigoAcesso.trim();

    if (!cleanCpf || cleanCpf.length !== 11) {
      setErrorMessage('Por favor, informe um CPF do Representante válido com 11 dígitos.');
      return;
    }

    if (!cleanCodigo) {
      setErrorMessage('Por favor, insira o Código de Acesso do Simples Nacional.');
      return;
    }

    setIsLoading(true);
    setIsSuccess(false);
    setSuccessData(null);

    try {
      // Tenta enviar para a rota de teste de conexão (/api/rpa/testar-conexao)
      const res = await fetch('/api/rpa/testar-conexao', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          cnpj: cleanCnpj,
          cpf: cleanCpf,
          codigoAcesso: cleanCodigo,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.sucesso === false || data.success === false) {
        setIsLoading(false);
        setIsSuccess(false);
        setSuccessData(null);
        setErrorMessage(
          data.mensagem || data.error || 'Erro PGDAS: Código de acesso inválido ou não confere.'
        );
        return;
      }

      setIsLoading(false);
      setIsSuccess(true);
      setSuccessData({
        timestamp: new Date(data.timestamp || Date.now()).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        cnpj: selectedCompany.cnpj || cleanCnpj,
        companyName: selectedCompany.razao_social || data.razaoSocial || 'Empresa Optante pelo Simples',
        cpfFormatted: cpf,
        comprovanteTexto: data.comprovanteTexto || 'Simples Nacional - Área Restrita Autenticada',
        urlLogada: data.urlLogada || 'https://www8.receita.fazenda.gov.br/SimplesNacional/Servicos/Grupo.aspx',
        messages: Array.isArray(data.messages) ? data.messages : [],
      });
    } catch (err: any) {
      console.error('Erro na conexão com o servidor:', err);
      setIsLoading(false);
      setIsSuccess(false);
      setErrorMessage('Falha na comunicação com o servidor. Verifique sua conexão e tente novamente.');
    }
  };

  const handleReset = () => {
    setIsSuccess(false);
    setSuccessData(null);
    setErrorMessage(null);
  };

  return (
    <div className="space-y-6 animate-fadeIn max-w-4xl mx-auto">
      {/* Botão de Retorno e Breadcrumb */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => (onNavigate ? onNavigate('/fiscal/simulacao') : window.history.back())}
          className="inline-flex items-center text-xs font-bold text-slate-600 hover:text-emerald-700 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Voltar para Simulação Fiscal
        </button>

        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <Bot className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Automação Simples Nacional
        </span>
      </div>

      {/* Header Principal da Página */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-6 rounded-2xl shadow-lg border border-slate-700/80">
        <div className="flex items-start space-x-4">
          <div className="p-3 bg-emerald-600/30 border border-emerald-500/40 rounded-xl text-emerald-400 shrink-0">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
              Acesso Direto - Simples Nacional
              <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                Portal Oficial
              </span>
            </h2>
            <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
              Insira o Código de Acesso e credenciais do representante para testarmos a comunicação automatizada direta com o portal do Simples Nacional.
            </p>
          </div>
        </div>
      </div>

      {/* Card do Formulário */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Key className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-800">Credenciais do Portal do Simples Nacional</h3>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">Conexão Direta RPA</span>
        </div>

        <div className="p-6 space-y-5">
          {/* Seleção da Empresa */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Empresa Selecionada (CNPJ)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Building2 className="w-4 h-4" />
              </div>
              <select
                value={selectedCompanyCnpj}
                onChange={(e) => {
                  setSelectedCompanyCnpj(e.target.value);
                  setIsSuccess(false);
                  setErrorMessage(null);
                }}
                disabled={isLoading}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all cursor-pointer disabled:opacity-60"
              >
                {companies.length === 0 ? (
                  <option value="">Nenhuma empresa cadastrada</option>
                ) : (
                  companies.map((comp) => (
                    <option key={comp.id || comp.cnpj} value={comp.cnpj}>
                      {comp.razao_social || 'Empresa Sem Razão Social'} — CNPJ: {comp.cnpj} ({comp.regime_tributario || 'Simples Nacional'})
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Banner Amarelo se a empresa selecionada NÃO for Simples Nacional */}
          {!isSimplesNacional && selectedCompany && (
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl text-amber-900 text-xs flex items-start space-x-3 shadow-xs animate-fadeIn">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-amber-900 text-sm">Acesso indisponível</h4>
                <p className="mt-1 text-amber-800 font-medium leading-relaxed">
                  A empresa selecionada (<strong>{selectedCompany.razao_social}</strong>) não é optante pelo Simples Nacional (Regime cadastrado: <i>{regimeTributarioStr}</i>).
                </p>
                <p className="mt-1.5 text-[11px] text-amber-700">
                  Por favor, selecione uma empresa enquadrada no Simples Nacional para utilizar o Robô de Acesso Direto.
                </p>
              </div>
            </div>
          )}

          {/* Exibir o formulário somente se for Simples Nacional */}
          {isSimplesNacional && (
            <form onSubmit={handleTestConnection} className="space-y-5 animate-fadeIn">
              {/* Mensagem de Erro (Card Vermelho / Alert Danger) */}
              {errorMessage && (
                <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl text-rose-900 text-xs flex items-start justify-between animate-fadeIn shadow-sm">
                  <div className="flex items-start space-x-3.5">
                    <div className="p-2 bg-rose-600 text-white rounded-xl shrink-0 mt-0.5 shadow-xs">
                      <XCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-rose-950 text-sm flex items-center gap-1.5">
                        Falha na Autenticação (PGDAS-D)
                      </h4>
                      <p className="mt-1 text-xs text-rose-800 font-bold leading-relaxed">
                        {errorMessage}
                      </p>
                      <p className="mt-1 text-[11px] text-rose-700">
                        Verifique o Código de Acesso, CNPJ e CPF do representante legal e tente novamente.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setErrorMessage(null)}
                    className="p-1.5 text-rose-400 hover:text-rose-800 hover:bg-rose-100/80 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                    title="Fechar erro"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Grid dos Campos de Entrada */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* 1. CNPJ (Desabilitado / Read-only) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    CNPJ da Empresa
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      readOnly
                      disabled
                      value={selectedCompany?.cnpj || selectedCompanyCnpj || '00.000.000/0000-00'}
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 cursor-not-allowed select-none"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">Preenchido automaticamente</span>
                </div>

                {/* 2. CPF do Representante */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    CPF do Representante
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={cpf}
                      onChange={handleCpfChange}
                      disabled={isLoading}
                      placeholder="000.000.000-00"
                      maxLength={14}
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all disabled:opacity-60"
                    />
                  </div>
                </div>

                {/* 3. Código de Acesso */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Código de Acesso
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showCodigo ? 'text' : 'password'}
                      value={codigoAcesso}
                      onChange={(e) => setCodigoAcesso(e.target.value)}
                      disabled={isLoading}
                      placeholder="Código de Acesso"
                      className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all disabled:opacity-60"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCodigo(!showCodigo)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    >
                      {showCodigo ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Botão de Ação */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full inline-flex items-center justify-center px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed space-x-2"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>Conectando ao Simples Nacional...</span>
                    </>
                  ) : (
                    <>
                      <Key className="w-4 h-4 text-white" />
                      <span>Testar Conexão</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Banner de Sucesso (Card Verde) */}
          {isSuccess && successData && (
            <div className="mt-6 bg-emerald-50 border border-emerald-200 rounded-2xl p-5 shadow-xs animate-fadeIn">
              <div className="flex items-start space-x-3.5">
                <div className="p-2 bg-emerald-600 text-white rounded-xl shrink-0 mt-0.5">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="space-y-3 flex-1">
                  <div>
                    <h4 className="text-sm font-bold text-emerald-900 flex items-center gap-2">
                      Prova de Vida Concluída com Sucesso!
                    </h4>
                    <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
                      O robô autenticou no portal do Simples Nacional e extraiu o comprovante da área logada para confirmar o acesso.
                    </p>
                  </div>

                  <div className="bg-white/80 border border-emerald-200/80 rounded-xl p-3.5 text-xs text-slate-700 space-y-2 font-mono">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-sans font-semibold">Empresa:</span>
                      <span className="font-bold text-slate-800">{successData.companyName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-sans font-semibold">CNPJ Enviado:</span>
                      <span className="font-bold text-slate-800">{successData.cnpj}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-sans font-semibold">CPF Representante:</span>
                      <span className="font-bold text-slate-800">{successData.cpfFormatted}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-sans font-semibold">Comprovante (Breadcrumb):</span>
                      <span className="font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded border border-emerald-200">
                        {successData.comprovanteTexto || 'área restrita logada'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-sans font-semibold">URL Autenticada:</span>
                      <span className="font-semibold text-slate-700 truncate max-w-[280px]" title={successData.urlLogada}>
                        {successData.urlLogada}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-sans font-semibold">Horário da Execução:</span>
                      <span className="font-bold text-emerald-700">{successData.timestamp}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-emerald-100">
                      <span className="text-slate-500 font-sans font-semibold">Status do Acesso:</span>
                      <span className="inline-flex items-center font-bold text-emerald-700">
                        <CheckCheck className="w-3.5 h-3.5 mr-1" /> 200 OK (Sessão Ativa - Prova de Vida OK)
                      </span>
                    </div>
                  </div>

                  {/* Extrato de Mensagens DTE Extraídas */}
                  {successData.messages && successData.messages.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <h5 className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center justify-between">
                        <span>Últimas Comunicações DTE-SN ({successData.messages.length})</span>
                        <span className="text-[10px] text-emerald-700 font-normal">Extraído via Playwright Headless</span>
                      </h5>
                      <div className="space-y-2">
                        {successData.messages.map((msg, idx) => (
                          <div
                            key={msg.id || idx}
                            className="bg-white p-3 rounded-xl border border-emerald-200/80 shadow-2xs space-y-1"
                          >
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-bold text-slate-800">{msg.assunto}</span>
                              <span className="text-slate-500 font-mono text-[10px] bg-slate-100 px-2 py-0.5 rounded-md">
                                {msg.data}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-slate-500">
                              <span>Remetente: {msg.remetente}</span>
                              <span className={msg.lida ? 'text-slate-400' : 'text-emerald-700 font-bold'}>
                                {msg.lida ? 'Lida' : '● Não Lida'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-1 flex justify-end">
                    <button
                      type="button"
                      onClick={handleReset}
                      className="inline-flex items-center px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Re-testar Acesso
                    </button>
                  </div>
                </div>
              </div>

              {/* FLUXO PASSO A PASSO (WIZARD DE EMISSÃO DE DAS) */}
              <div className="mt-8 border-t border-emerald-200/80 pt-6">
                <EmitirDasWizard
                  cnpj={successData.cnpj}
                  cpf={successData.cpfFormatted}
                  codigoAcesso={codigoAcesso}
                  companyName={successData.companyName}
                  onNavigate={onNavigate}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
