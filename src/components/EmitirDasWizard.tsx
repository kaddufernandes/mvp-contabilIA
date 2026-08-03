import React, { useState } from 'react';
import {
  Calendar,
  DollarSign,
  Briefcase,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Bot,
  Sparkles,
  RefreshCw,
  FileText,
  Building2,
  AlertCircle,
  CheckCheck,
  Calculator,
  RotateCcw,
  Download,
  Send,
  Printer,
  FileCheck,
  History,
  Database,
} from 'lucide-react';
import { getAuthHeaders } from '../lib/apiClient';
import { salvarHistoricoApuracao } from '../lib/firebase';
import { HistoricoApuracoesDrawer } from './HistoricoApuracoesDrawer';

export interface EmitirDasWizardProps {
  cnpj: string;
  cpf: string;
  codigoAcesso: string;
  companyName?: string;
  onNavigate?: (path: string) => void;
  onAuthError?: (msg: string) => void; 
}

export interface AtividadeOption {
  id: string;
  code: string;
  title: string;
  anexo: string;
  description: string;
  default?: boolean;
}

const ATIVIDADES_DISPONIVEIS: AtividadeOption[] = [
  {
    id: 'anexo_iii_proprio_municipio',
    code: '3.1.1',
    title: 'Prestação de Serviços (Anexo III) - ISS Próprio Município',
    anexo: 'Anexo III',
    description:
      'Prestação de Serviços, exceto para o exterior - Não sujeitos ao fator "r" e tributados pelo Anexo III, sem retenção/substituição tributária de ISS, com ISS devido ao próprio Município do estabelecimento.',
    default: true,
  },
  {
    id: 'anexo_iii_outro_municipio',
    code: '3.1.3',
    title: 'Prestação de Serviços (Anexo III) - ISS Outro Município',
    anexo: 'Anexo III',
    description:
      'Não sujeitos ao fator "r" e tributados pelo Anexo III, sem retenção/substituição tributária de ISS, com ISS devido a outro(s) Município(s).',
    default: false,
  },
  {
    id: 'anexo_iii_retencao_iss',
    code: '3.1.2',
    title: 'Prestação de Serviços (Anexo III) - Com Retenção de ISS',
    anexo: 'Anexo III',
    description:
      'Prestação de Serviços, exceto para o exterior - Tributados pelo Anexo III, com retenção tributária ou substituição do ISS.',
    default: false,
  },
  {
    id: 'anexo_v_fator_r',
    code: '5.1.1',
    title: 'Prestação de Serviços (Anexo V - Fator r)',
    anexo: 'Anexo V',
    description:
      'Prestação de Serviços sujeitos ao fator "r" (folha de salários / receita bruta menor que 28%).',
    default: false,
  },
  {
    id: 'anexo_i_comercio',
    code: '1.1.1',
    title: 'Comércio e Revenda de Mercadorias (Anexo I)',
    anexo: 'Anexo I',
    description:
      'Revenda de mercadorias sem substituição tributária (exceto para o exterior).',
    default: false,
  },
];

const LISTA_UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN',
  'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'
];

const MUNICIPIOS_POR_UF: Record<string, string[]> = {
  SP: ['CAMPINAS', 'SAO PAULO', 'GUARULHOS', 'SANTO ANDRE', 'OSASCO', 'SOROCABA', 'SANTOS', 'S JOSE DOS CAMPOS', 'BERNARDO DO CAMPO', 'RIBEIRAO PRETO'],
  RJ: ['RIO DE JANEIRO', 'NITEROI', 'DUQUE DE CAXIAS', 'NOVA IGUACU', 'SAO GONCALO', 'PETROPOLIS', 'VOLTA REDONDA'],
  MG: ['BELO HORIZONTE', 'UBERLANDIA', 'CONTAGEM', 'JUIZ DE FORA', 'BETIM', 'MONTES CLAROS'],
  PR: ['CURITIBA', 'LONDRINA', 'MARINGA', 'PONTA GROSSA', 'CASCAVEL'],
};

export const EmitirDasWizard: React.FC<EmitirDasWizardProps> = ({
  cnpj,
  cpf,
  codigoAcesso,
  companyName = 'Empresa Optante pelo Simples Nacional',
  onAuthError,
}) => {
  // Step State
  const [step, setStep] = useState<number>(1);

  // Card 1: Período de Apuração
  const [periodoApuracao, setPeriodoApuracao] = useState<string>('06/2026');

  // Card 2: Receitas Brutas
  const [receitaMercadoInterno, setReceitaMercadoInterno] = useState<string>('1500,00');
  const [receitaMercadoExterna, setReceitaMercadoExterna] = useState<string>('0,00');

  // Card 3: Atividade Econômica
  const [atividadeSelecionada, setAtividadeSelecionada] = useState<string>('anexo_iii_proprio_municipio');
  const [ufIss, setUfIss] = useState<string>('SP');
  const [municipioIss, setMunicipioIss] = useState<string>('CAMPINAS');

  // Execution States
  const [isLoadingRobot, setIsLoadingRobot] = useState<boolean>(false);
  const [robotError, setRobotError] = useState<string | null>(null);
  const [robotResult, setRobotResult] = useState<any>(null);

  // Retificação State
  const [deveRetificar, setDeveRetificar] = useState<boolean>(false);

  // Firestore History
  const [isHistoricoOpen, setIsHistoricoOpen] = useState<boolean>(false);

  // Formatters & Masks
  const handlePaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 6); // MMYYYY
    if (digits.length > 2) {
      setPeriodoApuracao(`${digits.slice(0, 2)}/${digits.slice(2)}`);
    } else {
      setPeriodoApuracao(digits);
    }
  };

  const formatCurrencyInput = (value: string): string => {
    const rawDigits = value.replace(/\D/g, '');
    if (!rawDigits) return '0,00';
    const num = parseInt(rawDigits, 10) / 100;
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleReceitaInternaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setReceitaMercadoInterno(formatCurrencyInput(e.target.value));
  };

  const handleReceitaExternaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setReceitaMercadoExterna(formatCurrencyInput(e.target.value));
  };

  const isStep1Valid = periodoApuracao.length === 7 && /^\d{2}\/\d{4}$/.test(periodoApuracao);
  const isStep2Valid = Boolean(receitaMercadoInterno.trim());
  const isStep3Valid = Boolean(atividadeSelecionada) && (atividadeSelecionada !== 'anexo_iii_outro_municipio' || (Boolean(ufIss) && Boolean(municipioIss.trim())));
  const selectedAtividadeObj = ATIVIDADES_DISPONIVEIS.find((a) => a.id === atividadeSelecionada) || ATIVIDADES_DISPONIVEIS[0];

  const handleValidarPaAndAdvance = (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    if (isStep1Valid) setStep(2);
  };

  // ==========================================================
  // EXECUÇÃO COMPLETA DO ROBÔ NO PGDAS-D
  // ==========================================================
  const handleCalculateAndEmit = async (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();

    setIsLoadingRobot(true);
    setRobotError(null);
    setRobotResult(null);

    const cleanCnpj = cnpj.replace(/\D/g, '');
    const cleanCpf = cpf.replace(/\D/g, '');
    const cleanCodigo = codigoAcesso.trim();

    try {
      const cleanPayload = {
        cnpj: String(cleanCnpj),
        cpf: String(cleanCpf),
        codigoAcesso: String(cleanCodigo),
        periodoApuracao: String(periodoApuracao),
        receitaMercadoInterno: String(receitaMercadoInterno),
        receitaMercadoExterna: String(receitaMercadoExterna),
        atividadeSelecionada: String(atividadeSelecionada),
        ufIss: atividadeSelecionada === 'anexo_iii_outro_municipio' ? String(ufIss) : undefined,
        municipioIss: atividadeSelecionada === 'anexo_iii_outro_municipio' ? String(municipioIss) : undefined,
        valorReceita: String(receitaMercadoInterno),
        transmitir: false, 
        deveRetificar: Boolean(deveRetificar),
      };

      const response = await fetch('/api/rpa/emitir-das', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(cleanPayload),
      });

      const data = await response.json();

      if (response.status === 503 || data.status === 'sistema_governo_indisponivel') {
        setRobotError(data.mensagem || data.message || data.error || 'O sistema do Simples Nacional está fora do ar.');
        setIsLoadingRobot(false);
        return;
      }

      if (!response.ok || (!data.success && !data.sucesso)) {
        throw new Error(data.error || data.mensagem || data.message || 'Erro desconhecido na apuração.');
      }

      setRobotResult(data);
      setStep(5);

      salvarHistoricoApuracao({
        cnpj: cleanCnpj,
        nomeEmpresa: data.nomeEmpresa || data.razaoSocial || companyName,
        periodoApuracao: String(periodoApuracao),
        valorReceita: String(receitaMercadoInterno),
        atividadeSelecionada: String(selectedAtividadeObj.title || atividadeSelecionada),
        foiRetificadora: Boolean(deveRetificar),
        status: 'Calculado com Sucesso',
        valorDas: data.valorTotalDas || data.valorDas || '',
        mensagem: 'Apuração extraída com sucesso',
      }).catch(() => {});

    } catch (err: any) {
      console.error('Erro na chamada do RPA:', err);
      const errorMsg = err.message || 'Falha ao executar a apuração no portal.';

      // A MÁGICA DO DESTRAVAMENTO ESTÁ AQUI
      // Se a mensagem do erro for sobre credenciais, desfaz o Wizard e solta o erro lá no topo
      const isAuthError = 
        errorMsg.toLowerCase().includes('acesso negado') || 
        errorMsg.toLowerCase().includes('inválido') || 
        errorMsg.toLowerCase().includes('cpf') || 
        errorMsg.toLowerCase().includes('código') ||
        errorMsg.toLowerCase().includes('não cadastrado');

      if (isAuthError) {
        setIsLoadingRobot(false);
        if (onAuthError) {
          onAuthError(errorMsg); 
          return;
        }
      }

      // Se for um erro que não seja de login (ex: erro no Período de Apuração), mostra embaixo normal
      setRobotError(errorMsg);
    } finally {
      setIsLoadingRobot(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden animate-fadeIn">
      {/* Header do Wizard */}
      <div className="bg-slate-900 text-white p-5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-emerald-600/30 text-emerald-400 rounded-xl border border-emerald-500/30">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              PGDAS-D — Wizard de Apuração & Emissão do DAS
              <span className="text-[10px] font-mono font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                Etapa {step} de 4
              </span>
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Empresa: <strong className="text-white">{companyName}</strong> (CNPJ: {cnpj})
            </p>
          </div>
        </div>

        <button type="button" onClick={() => setIsHistoricoOpen(true)} className="inline-flex items-center px-3 py-1.5 text-xs font-semibold bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40 rounded-xl transition-all cursor-pointer">
          <History className="w-3.5 h-3.5 mr-1 text-emerald-400" /> Histórico Firestore
        </button>
      </div>

      {/* Stepper Progress Bar */}
      {step <= 4 && (
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3">
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className={`p-2 rounded-lg border font-semibold transition-all flex items-center justify-center gap-1.5 ${step === 1 ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs' : step > 1 ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-white text-slate-400 border-slate-200'}`}>
              <Calendar className="w-3.5 h-3.5" /><span className="hidden sm:inline">1. Período (PA)</span><span className="sm:hidden">1. PA</span>
            </div>
            <div className={`p-2 rounded-lg border font-semibold transition-all flex items-center justify-center gap-1.5 ${step === 2 ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs' : step > 2 ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-white text-slate-400 border-slate-200'}`}>
              <DollarSign className="w-3.5 h-3.5" /><span className="hidden sm:inline">2. Receitas</span><span className="sm:hidden">2. Rec.</span>
            </div>
            <div className={`p-2 rounded-lg border font-semibold transition-all flex items-center justify-center gap-1.5 ${step === 3 ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs' : step > 3 ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-white text-slate-400 border-slate-200'}`}>
              <Briefcase className="w-3.5 h-3.5" /><span className="hidden sm:inline">3. Atividades</span><span className="sm:hidden">3. Ativ.</span>
            </div>
            <div className={`p-2 rounded-lg border font-semibold transition-all flex items-center justify-center gap-1.5 ${step === 4 ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs' : 'bg-white text-slate-400 border-slate-200'}`}>
              <FileText className="w-3.5 h-3.5" /><span className="hidden sm:inline">4. Resumo</span><span className="sm:hidden">4. Resumo</span>
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo dos Cards */}
      <div className="p-6">
        {/* CARD 1: PA */}
        {step === 1 && (
          <div className="space-y-6 max-w-lg mx-auto animate-fadeIn">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto shadow-xs"><Calendar className="w-6 h-6" /></div>
              <h4 className="text-base font-bold text-slate-900">Card 1: Informe o Período de Apuração (PA)</h4>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4 shadow-2xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Período de Apuração (Mês/Ano) <span className="text-rose-500">*</span></label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400"><Calendar className="w-4 h-4" /></div>
                  <input type="text" value={periodoApuracao} onChange={handlePaChange} placeholder="MM/AAAA (ex: 06/2026)" maxLength={7} className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 transition-all" />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200">
                <label className="block text-xs font-bold text-slate-700 mb-2.5">Esta é uma declaração Retificadora?</label>
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <label className="inline-flex items-center gap-2 font-semibold text-slate-800 cursor-pointer">
                    <input type="radio" checked={!deveRetificar} onChange={() => setDeveRetificar(false)} className="w-4 h-4 text-emerald-600 cursor-pointer" />
                    <span>Não (Declaração Original)</span>
                  </label>
                  <label className="inline-flex items-center gap-2 font-semibold text-slate-800 cursor-pointer">
                    <input type="radio" checked={deveRetificar} onChange={() => setDeveRetificar(true)} className="w-4 h-4 text-emerald-600 cursor-pointer" />
                    <span>Sim (Retificar declaração anterior)</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end pt-2">
              <button type="button" disabled={!isStep1Valid} onClick={handleValidarPaAndAdvance} className="inline-flex items-center px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-50 space-x-2">
                <span>Próximo Passo</span><ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* CARD 2: RECEITAS */}
        {step === 2 && (
          <div className="space-y-6 max-w-lg mx-auto animate-fadeIn">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto shadow-xs"><DollarSign className="w-6 h-6" /></div>
              <h4 className="text-base font-bold text-slate-900">Card 2: Informe os Valores de Receita Bruta</h4>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4 shadow-2xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Receita no Mercado Interno (R$) *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-bold text-xs">R$</div>
                  <input type="text" value={receitaMercadoInterno} onChange={handleReceitaInternaChange} className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-800" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Receita no Mercado Externo (R$)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-bold text-xs">R$</div>
                  <input type="text" value={receitaMercadoExterna} onChange={handleReceitaExternaChange} className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-800" />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button type="button" onClick={() => setStep(1)} className="inline-flex items-center px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer space-x-1.5"><ArrowLeft className="w-4 h-4" /><span>Voltar</span></button>
              <button type="button" disabled={!isStep2Valid} onClick={() => setStep(3)} className="inline-flex items-center px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-50 space-x-2"><span>Próximo Passo</span><ArrowRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}

        {/* CARD 3: ATIVIDADES */}
        {step === 3 && (
          <div className="space-y-6 max-w-xl mx-auto animate-fadeIn">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto shadow-xs"><Briefcase className="w-6 h-6" /></div>
              <h4 className="text-base font-bold text-slate-900">Card 3: Selecione a Atividade Econômica</h4>
            </div>

            <div className="space-y-3">
              {ATIVIDADES_DISPONIVEIS.map((atv) => {
                const isSelected = atividadeSelecionada === atv.id;
                return (
                  <label key={atv.id} onClick={() => setAtividadeSelecionada(atv.id)} className={`block p-4 border rounded-2xl cursor-pointer transition-all ${isSelected ? 'bg-emerald-50/90 border-emerald-500 ring-2 ring-emerald-500/30 shadow-xs' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                    <div className="flex items-start space-x-3">
                      <input type="radio" checked={isSelected} readOnly className="mt-1 text-emerald-600 focus:ring-emerald-500 h-4 w-4" />
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900">{atv.title}</span>
                          <span className="text-[10px] font-bold font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded">{atv.anexo}</span>
                        </div>
                        <p className="text-[11px] text-slate-600">{atv.description}</p>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            {atividadeSelecionada === 'anexo_iii_outro_municipio' && (
              <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-2xl space-y-3 shadow-2xs">
                <div className="flex items-center space-x-2 text-xs font-bold text-emerald-950">
                  <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Informe a UF e o Município de Destino do ISS</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">UF de Destino *</label>
                    <select value={ufIss} onChange={(e) => { setUfIss(e.target.value); setMunicipioIss(MUNICIPIOS_POR_UF[e.target.value]?.[0] || ''); }} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800">
                      {LISTA_UFS.map((uf) => (<option key={uf} value={uf}>{uf}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Município de Destino *</label>
                    <select value={municipioIss} onChange={(e) => setMunicipioIss(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800">
                      {(MUNICIPIOS_POR_UF[ufIss] || ['CAMPINAS']).map((muni) => (<option key={muni} value={muni}>{muni}</option>))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <button type="button" onClick={() => setStep(2)} className="inline-flex items-center px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer space-x-1.5"><ArrowLeft className="w-4 h-4" /><span>Voltar</span></button>
              <button type="button" disabled={!isStep3Valid} onClick={() => setStep(4)} className="inline-flex items-center px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl cursor-pointer space-x-2"><span>Avançar para Resumo</span><ArrowRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}

        {/* CARD 4: RESUMO E EXECUÇÃO */}
        {step === 4 && (
          <div className="space-y-6 max-w-xl mx-auto animate-fadeIn">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto shadow-xs"><FileText className="w-6 h-6" /></div>
              <h4 className="text-base font-bold text-slate-900">Card 4: Resumo da Apuração</h4>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3 text-xs text-slate-700 font-mono shadow-2xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200"><span className="text-slate-500 font-sans font-semibold">Empresa / CNPJ:</span><span className="font-bold text-slate-800 font-sans">{companyName} ({cnpj})</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-500 font-sans font-semibold">Período de Apuração (PA):</span><span className="font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">{periodoApuracao} {deveRetificar && "(Retificadora)"}</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-500 font-sans font-semibold">Receita Mercado Interno:</span><span className="font-bold text-slate-800">R$ {receitaMercadoInterno}</span></div>
              <div className="pt-2 border-t border-slate-200"><span className="text-slate-500 font-sans font-semibold block mb-1">Atividade Selecionada:</span><div className="p-2.5 bg-white border border-slate-200 rounded-xl text-[11px] font-sans font-medium text-slate-800"><strong className="text-emerald-700 block mb-0.5">{selectedAtividadeObj.title}</strong></div></div>
            </div>

            {robotError && (
              <div className="p-4 rounded-xl text-xs flex items-start space-x-3 border bg-rose-50 border-rose-200 text-rose-800">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
                <span className="block font-medium">{robotError}</span>
                <button type="button" onClick={() => setRobotError(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer ml-auto">✕</button>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <button type="button" onClick={() => setStep(3)} className="inline-flex items-center px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer space-x-1.5"><ArrowLeft className="w-4 h-4" /><span>Voltar e Corrigir</span></button>
              <button type="button" disabled={isLoadingRobot} onClick={handleCalculateAndEmit} className="inline-flex items-center px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer disabled:opacity-60 space-x-2">
                {isLoadingRobot ? <><RefreshCw className="w-4 h-4 animate-spin" /><span>Executando Robô...</span></> : <><Bot className="w-4 h-4" /><span>Testar Preenchimento no Robô</span></>}
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: RESULTADOS */}
        {step === 5 && robotResult && (
          <div className="space-y-6 max-w-xl mx-auto animate-fadeIn">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start space-x-3 shadow-xs">
              <div className="p-2 bg-emerald-600 text-white rounded-xl shrink-0 mt-0.5"><CheckCircle2 className="w-6 h-6" /></div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-emerald-900">Preenchimento Concluído com Sucesso!</h4>
                <p className="text-xs text-emerald-700">O robô preencheu as telas, aguardou sua auditoria visual de 10 segundos e extraiu os tributos abaixo.</p>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <h5 className="text-xs font-bold text-slate-800 uppercase flex items-center gap-2"><Calculator className="w-4 h-4 text-emerald-600" /> Tributos Extraídos da Receita</h5>
                <span className="text-[10px] text-slate-500 font-mono">PA: {robotResult.periodoApuracao}</span>
              </div>
              {robotResult.dadosCalculados && (
                <div className="space-y-2 font-mono text-xs">
                  {Object.entries(robotResult.dadosCalculados).map(([key, value]) => {
                    if (key === 'total') return null;
                    return (
                      <div key={key} className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                        <span className="text-slate-600 uppercase">{key}:</span>
                        <span className="font-bold text-slate-800">{value as string}</span>
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-100 text-emerald-950 font-bold border border-emerald-200 mt-3 text-sm">
                    <span className="font-sans">VALOR TOTAL DO DAS:</span>
                    <span className="text-emerald-900">{robotResult.dadosCalculados.total || 'R$ 0,00'}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button type="button" onClick={() => setStep(1)} className="inline-flex items-center px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer space-x-1.5"><RotateCcw className="w-4 h-4" /><span>Nova Apuração</span></button>
            </div>
          </div>
        )}
      </div>

      <HistoricoApuracoesDrawer isOpen={isHistoricoOpen} onClose={() => setIsHistoricoOpen(false)} currentCnpj={cnpj} />
    </div>
  );
};