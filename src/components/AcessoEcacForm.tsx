import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Key,
  Lock,
  Eye,
  EyeOff,
  Building2,
  AlertTriangle,
  ArrowLeft,
  Bot,
  User,
  XCircle,
  X,
  ArrowRight,
  Edit3
} from 'lucide-react';
import { EmpresaData } from '../types';
import { EmitirDasWizard } from './EmitirDasWizard';
import { getCompaniesStore } from '../lib/companiesStore';

interface AcessoEcacFormProps {
  onNavigate?: (path: string) => void;
}

export const AcessoEcacForm: React.FC<AcessoEcacFormProps> = ({ onNavigate }) => {
  const [companies, setCompanies] = useState<EmpresaData[]>([]);
  const [selectedCompanyCnpj, setSelectedCompanyCnpj] = useState<string>('');
  const [cpf, setCpf] = useState<string>('');
  const [codigoAcesso, setCodigoAcesso] = useState<string>('');
  const [showCodigo, setShowCodigo] = useState<boolean>(false);

  const [isCredentialsLocked, setIsCredentialsLocked] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 1. Carregar Empresas
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const data = await getCompaniesStore();
        if (data && Array.isArray(data) && data.length > 0) {
          setCompanies(data);
          setSelectedCompanyCnpj(data[0].cnpj || '');
          return;
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

  // Avançar instantaneamente (Sem chamada de API)
  const handleAdvanceToWizard = (e: React.FormEvent) => {
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

    // Libera a tela do Wizard instantaneamente
    setIsCredentialsLocked(true);
  };

  const handleEditCredentials = () => {
    setIsCredentialsLocked(false);
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
              Insira as credenciais da empresa. O robô utilizará estes dados ao final do preenchimento para emitir a guia no portal.
            </p>
          </div>
        </div>
      </div>

      {/* Card do Formulário */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Key className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-800">Credenciais de Acesso (PGDAS-D)</h3>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">Dados armazenados localmente</span>
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
                  setIsCredentialsLocked(false);
                  setErrorMessage(null);
                }}
                disabled={isCredentialsLocked}
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
                  A empresa selecionada (<strong>{selectedCompany.razao_social}</strong>) não é optante pelo Simples Nacional.
                </p>
              </div>
            </div>
          )}

          {/* Exibir o formulário somente se for Simples Nacional */}
          {isSimplesNacional && (
            <form onSubmit={handleAdvanceToWizard} className="space-y-5 animate-fadeIn">
              
              {/* Mensagem de Erro das Credenciais (Mostrado aqui no topo!) */}
              {errorMessage && (
                <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl text-rose-900 text-xs flex items-start justify-between animate-fadeIn shadow-sm">
                  <div className="flex items-start space-x-3.5">
                    <div className="p-2 bg-rose-600 text-white rounded-xl shrink-0 mt-0.5 shadow-xs">
                      <XCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-rose-950 text-sm">Atenção aos dados</h4>
                      <p className="mt-1 text-xs text-rose-800 font-bold leading-relaxed">{errorMessage}</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => setErrorMessage(null)} className="p-1.5 text-rose-400 hover:text-rose-800 cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Grid dos Campos de Entrada */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* 1. CNPJ */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">CNPJ da Empresa</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400"><Building2 className="w-4 h-4" /></div>
                    <input type="text" readOnly disabled value={selectedCompany?.cnpj || selectedCompanyCnpj || '00.000.000/0000-00'} className="w-full pl-9 pr-4 py-2.5 bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 cursor-not-allowed select-none" />
                  </div>
                </div>

                {/* 2. CPF do Representante */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">CPF do Representante</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400"><User className="w-4 h-4" /></div>
                    <input type="text" value={cpf} onChange={handleCpfChange} disabled={isCredentialsLocked} placeholder="000.000.000-00" maxLength={14} className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:opacity-60" />
                  </div>
                </div>

                {/* 3. Código de Acesso */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Código de Acesso</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400"><Lock className="w-4 h-4" /></div>
                    <input type={showCodigo ? 'text' : 'password'} value={codigoAcesso} onChange={(e) => setCodigoAcesso(e.target.value)} disabled={isCredentialsLocked} placeholder="Código de Acesso" className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:opacity-60" />
                    <button type="button" onClick={() => setShowCodigo(!showCodigo)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer">
                      {showCodigo ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="pt-2 flex justify-end">
                {!isCredentialsLocked ? (
                  <button type="submit" className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer space-x-2">
                    <span>Prosseguir para Apuração</span>
                    <ArrowRight className="w-4 h-4 text-white" />
                  </button>
                ) : (
                  <button type="button" onClick={handleEditCredentials} className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer space-x-2">
                    <Edit3 className="w-4 h-4 text-slate-500" />
                    <span>Editar Credenciais</span>
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Exibir o Wizard apenas se as credenciais foram validadas localmente */}
      {isCredentialsLocked && selectedCompany && (
        <div className="animate-fadeIn mt-6">
          <EmitirDasWizard
            cnpj={selectedCompany.cnpj}
            cpf={cpf}
            codigoAcesso={codigoAcesso}
            companyName={selectedCompany.razao_social}
            onNavigate={onNavigate}
            onAuthError={(msg) => {
              // A MÁGICA ACONTECE AQUI: Destrava os campos e joga o erro pra cima!
              setIsCredentialsLocked(false);
              setErrorMessage(msg);
            }}
          />
        </div>
      )}
    </div>
  );
};