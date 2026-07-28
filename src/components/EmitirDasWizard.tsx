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
  RS: ['PORTO ALEGRE', 'CAXIAS DO SUL', 'CANOAS', 'PELOTAS', 'SANTA MARIA'],
  SC: ['FLORIANOPOLIS', 'JOINVILLE', 'BLUMENAU', 'CHAPECO', 'CRICIUIRA'],
  BA: ['SALVADOR', 'FEIRA DE SANTANA', 'VITORIA DA CONQUISTA'],
  PE: ['RECIFE', 'JABOATAO DOS GUARARAPES', 'OLINDA', 'CARUARU'],
  CE: ['FORTALEZA', 'CAUCAIA', 'JUAZEIRO DO NORTE'],
  GO: ['GOIANIA', 'APARECIDA DE GOIANIA', 'ANAPOLIS'],
  DF: ['BRASILIA'],
  ES: ['VITORIA', 'VILA VELHA', 'SERRA'],
  AM: ['MANAUS'],
  PA: ['BELEM', 'ANANINDEUA'],
  MT: ['CUIABA', 'VARZEA GRANDE'],
  MS: ['CAMPO GRANDE', 'DOURADOS'],
  MA: ['SAO LUIS'],
  PB: ['JOAO PESSOA', 'CAMPINA GRANDE'],
  RN: ['NATAL', 'MOSSORO'],
  AL: ['MACEIO'],
  SE: ['ARACAJU'],
  PI: ['TERESINA'],
  TO: ['PALMAS'],
  RO: ['PORTO VELHO'],
  AC: ['RIO BRANCO'],
  AP: ['MACAPA'],
  RR: ['BOA VISTA'],
};

export const EmitirDasWizard: React.FC<EmitirDasWizardProps> = ({
  cnpj,
  cpf,
  codigoAcesso,
  companyName = 'Empresa Optante pelo Simples Nacional',
}) => {
  // Step State: 1 | 2 | 3 | 4 | 5 (5 is Robot Calculation Result)
  const [step, setStep] = useState<number>(1);

  // Card 1: Período de Apuração
  const [periodoApuracao, setPeriodoApuracao] = useState<string>('06/2026');

  // Card 2: Receitas Brutas
  const [receitaMercadoInterno, setReceitaMercadoInterno] = useState<string>('1500,00');
  const [receitaMercadoExterna, setReceitaMercadoExterna] = useState<string>('0,00');

  // Card 3: Atividade Econômica Selecionada e Destino ISS
  const [atividadeSelecionada, setAtividadeSelecionada] = useState<string>('anexo_iii_proprio_municipio');
  const [ufIss, setUfIss] = useState<string>('SP');
  const [municipioIss, setMunicipioIss] = useState<string>('CAMPINAS');

  // Execution & Robot Result States
  const [isLoadingRobot, setIsLoadingRobot] = useState<boolean>(false);
  const [isTransmitting, setIsTransmitting] = useState<boolean>(false);
  const [robotError, setRobotError] = useState<string | null>(null);
  const [robotResult, setRobotResult] = useState<any>(null);
  const [transmittedResult, setTransmittedResult] = useState<any>(null);

  // Retificação Modal States
  const [showRetificacaoModal, setShowRetificacaoModal] = useState<boolean>(false);
  const [retificacaoMensagem, setRetificacaoMensagem] = useState<string>('');

  // Card 1 Validation & Rectification States
  const [isValidatingPa, setIsValidatingPa] = useState<boolean>(false);
  const [deveRetificar, setDeveRetificar] = useState<boolean>(false);
  const [paValidationError, setPaValidationError] = useState<string | null>(null);

  // Firestore History Drawer State
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
    return num.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const handleReceitaInternaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setReceitaMercadoInterno(formatCurrencyInput(e.target.value));
  };

  const handleReceitaExternaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setReceitaMercadoExterna(formatCurrencyInput(e.target.value));
  };

  // Step Validations
  const isStep1Valid = periodoApuracao.length === 7 && /^\d{2}\/\d{4}$/.test(periodoApuracao);
  const isStep2Valid = Boolean(receitaMercadoInterno.trim());
  const isStep3Valid =
    Boolean(atividadeSelecionada) &&
    (atividadeSelecionada !== 'anexo_iii_outro_municipio' ||
      (Boolean(ufIss) && Boolean(municipioIss.trim())));

  // Selected Atividade Detail
  const selectedAtividadeObj = ATIVIDADES_DISPONIVEIS.find((a) => a.id === atividadeSelecionada) || ATIVIDADES_DISPONIVEIS[0];

  // Card 1 Validation & PA Check API
  const handleValidarPaAndAdvance = async (e?: React.SyntheticEvent) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    if (!isStep1Valid) return;

    setIsValidatingPa(true);
    setPaValidationError(null);
    setShowRetificacaoModal(false);

    const cleanCnpj = cnpj.replace(/\D/g, '');
    const cleanCpf = cpf.replace(/\D/g, '');
    const cleanCodigo = codigoAcesso.trim();

    try {
      const response = await fetch('/api/rpa/verificar-pa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          cnpj: String(cleanCnpj),
          cpf: String(cleanCpf),
          codigoAcesso: String(cleanCodigo),
          periodoApuracao: String(periodoApuracao),
        }),
      });

      const data = await response.json();

      if (response.status === 503 || data.status === 'sistema_governo_indisponivel') {
        const govMsg = data.mensagem || data.message || data.error || 'O sistema do Simples Nacional está fora do ar. Retorno da Receita: Sistema indisponível no momento.';
        setPaValidationError(govMsg);
        return;
      }

      if (data.jaDeclarado === true || data.status === 'requer_retificacao' || data.status === 'requer_confirmacao_retificacao') {
        setShowRetificacaoModal(true);
        setRetificacaoMensagem(
          data.mensagem || data.message || 'Já existe uma declaração transmitida para este PA. Você deseja retificar a declaração anterior?'
        );
        return;
      }

      if (!response.ok || data.status === 'erro' || (data.success === false && data.sucesso === false)) {
        throw new Error(data.error || data.mensagem || data.message || 'Erro ao verificar Período de Apuração no PGDAS-D.');
      }

      // Se jaDeclarado === false (status "ok"), avança direto para o Card 2 (primeira declaração)
      setDeveRetificar(false);
      setStep(2);
    } catch (err: any) {
      console.error('Erro na validação do PA:', err);
      setPaValidationError(err.message || 'Erro ao consultar status do PA no portal do Simples Nacional.');
    } finally {
      setIsValidatingPa(false);
    }
  };

  // Submit to RPA API
  const handleCalculateAndEmit = async (arg1?: React.SyntheticEvent | boolean) => {
    if (arg1 && typeof (arg1 as any).preventDefault === 'function') {
      (arg1 as any).preventDefault();
    }

    setIsLoadingRobot(true);
    setRobotError(null);
    setRobotResult(null);
    setShowRetificacaoModal(false);

    const cleanCnpj = cnpj.replace(/\D/g, '');
    const cleanCpf = cpf.replace(/\D/g, '');
    const cleanCodigo = codigoAcesso.trim();
    const isRetificarFinal = typeof arg1 === 'boolean' ? arg1 : Boolean(deveRetificar);

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
        deveRetificar: Boolean(isRetificarFinal),
        confirmouRetificacao: Boolean(isRetificarFinal),
        retificar: Boolean(isRetificarFinal),
      };

      const response = await fetch('/api/rpa/emitir-das', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(cleanPayload),
      });

      const data = await response.json();

      if (response.status === 503 || data.status === 'sistema_governo_indisponivel') {
        const govMsg = data.mensagem || data.message || data.error || 'O sistema do Simples Nacional está fora do ar. Retorno da Receita: Sistema indisponível no momento.';
        setRobotError(govMsg);
        return;
      }

      if (data.status === 'requer_confirmacao_retificacao' || data.status === 'requer_retificacao') {
        setShowRetificacaoModal(true);
        setRetificacaoMensagem(data.mensagem || data.message || 'Já existe uma declaração transmitida para este PA. Você deseja retificar a declaração anterior?');
        return;
      }

      if (!response.ok || (!data.success && !data.sucesso)) {
        throw new Error(data.error || data.mensagem || data.message || 'Erro ao executar o robô de apuração no PGDAS-D.');
      }

      setRobotResult(data);
      setTransmittedResult(null);
      setStep(5); // Advance to Result view

      // Salvar histórico no Firestore
      salvarHistoricoApuracao({
        cnpj: cleanCnpj,
        nomeEmpresa: data.nomeEmpresa || data.razaoSocial || companyName,
        periodoApuracao: String(periodoApuracao),
        valorReceita: String(receitaMercadoInterno),
        atividadeSelecionada: String(selectedAtividadeObj.title || atividadeSelecionada),
        foiRetificadora: Boolean(isRetificarFinal),
        status: 'Calculado com Sucesso',
        valorDas: data.valorTotalDas || data.valorDas || '',
        mensagem: 'Apuração calculada e gerada com sucesso no PGDAS-D',
      }).catch((fErr) => console.warn('Erro ao salvar no Firestore:', fErr));
    } catch (err: any) {
      console.error('Erro na chamada do RPA de Emissão do DAS:', err);
      setRobotError(err.message || 'Falha ao executar a apuração no portal do Simples Nacional.');

      // Salvar falha no Firestore
      salvarHistoricoApuracao({
        cnpj: cleanCnpj,
        nomeEmpresa: companyName,
        periodoApuracao: String(periodoApuracao),
        valorReceita: String(receitaMercadoInterno),
        atividadeSelecionada: String(selectedAtividadeObj.title || atividadeSelecionada),
        foiRetificadora: Boolean(isRetificarFinal),
        status: 'Erro no Cálculo',
        mensagem: err.message || 'Erro ao executar o robô de apuração',
      }).catch((fErr) => console.warn('Erro ao salvar no Firestore:', fErr));
    } finally {
      setIsLoadingRobot(false);
    }
  };

  // Transmit and Download DAS
  const handleTransmitAndGenerateDas = async (arg1?: React.SyntheticEvent | boolean) => {
    if (arg1 && typeof (arg1 as any).preventDefault === 'function') {
      (arg1 as any).preventDefault();
    }

    setIsTransmitting(true);
    setRobotError(null);
    setShowRetificacaoModal(false);

    const cleanCnpj = cnpj.replace(/\D/g, '');
    const cleanCpf = cpf.replace(/\D/g, '');
    const cleanCodigo = codigoAcesso.trim();
    const isRetificarFinal = typeof arg1 === 'boolean' ? arg1 : Boolean(deveRetificar);

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
        transmitir: true,
        deveRetificar: Boolean(isRetificarFinal),
        confirmouRetificacao: Boolean(isRetificarFinal),
        retificar: Boolean(isRetificarFinal),
      };

      const response = await fetch('/api/rpa/transmitir-das', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(cleanPayload),
      });

      const data = await response.json();

      if (response.status === 503 || data.status === 'sistema_governo_indisponivel') {
        const govMsg = data.mensagem || data.message || data.error || 'O sistema do Simples Nacional está fora do ar. Retorno da Receita: Sistema indisponível no momento.';
        setRobotError(govMsg);
        return;
      }

      if (data.status === 'requer_confirmacao_retificacao' || data.status === 'requer_retificacao') {
        setShowRetificacaoModal(true);
        setRetificacaoMensagem(data.mensagem || data.message || 'Já existe uma declaração transmitida para este PA. Você deseja retificar a declaração anterior?');
        return;
      }

      if (!response.ok || (!data.sucesso && !data.success)) {
        throw new Error(data.mensagem || data.message || data.error || 'Erro ao transmitir declaração no PGDAS-D.');
      }

      setTransmittedResult(data);

      // Salvar transmissão no Firestore
      salvarHistoricoApuracao({
        cnpj: cleanCnpj,
        nomeEmpresa: data.nomeEmpresa || data.razaoSocial || companyName,
        periodoApuracao: String(periodoApuracao),
        valorReceita: String(receitaMercadoInterno),
        atividadeSelecionada: String(selectedAtividadeObj.title || atividadeSelecionada),
        foiRetificadora: Boolean(isRetificarFinal),
        status: 'Transmitido com Sucesso',
        valorDas: data.valorTotalDas || data.valorDas || '',
        mensagem: 'O processamento final chegou até a tela de sucesso.',
      }).catch((fErr) => console.warn('Erro ao salvar no Firestore:', fErr));
    } catch (err: any) {
      console.error('Erro na transmissão do DAS:', err);
      setRobotError(err.message || 'Falha ao transmitir a declaração no portal do Simples Nacional.');

      // Salvar falha no Firestore
      salvarHistoricoApuracao({
        cnpj: cleanCnpj,
        nomeEmpresa: companyName,
        periodoApuracao: String(periodoApuracao),
        valorReceita: String(receitaMercadoInterno),
        atividadeSelecionada: String(selectedAtividadeObj.title || atividadeSelecionada),
        foiRetificadora: Boolean(isRetificarFinal),
        status: 'Erro na Transmissão',
        mensagem: err.message || 'Erro ao transmitir declaração',
      }).catch((fErr) => console.warn('Erro ao salvar no Firestore:', fErr));
    } finally {
      setIsTransmitting(false);
    }
  };

  // Download PDF file
  const handleDownloadPdf = (pdfBase64?: string) => {
    const pdfData = pdfBase64 || transmittedResult?.pdfBase64 || robotResult?.pdfBase64;
    if (!pdfData) return;

    const link = document.createElement('a');
    link.href = pdfData;
    link.download = `DAS_SimplesNacional_${cnpj.replace(/\D/g, '')}_${periodoApuracao.replace('/', '')}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setIsHistoricoOpen(true)}
            className="inline-flex items-center px-3 py-1.5 text-xs font-semibold bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40 rounded-xl transition-all cursor-pointer"
          >
            <History className="w-3.5 h-3.5 mr-1 text-emerald-400" />
            Histórico Firestore
          </button>

          {step <= 4 && (
            <div className="text-xs text-slate-400 hidden md:flex items-center gap-1 font-mono">
              <Bot className="w-4 h-4 text-emerald-400" /> Playwright
            </div>
          )}
        </div>
      </div>

      {/* Stepper Progress Bar */}
      {step <= 4 && (
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3">
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div
              className={`p-2 rounded-lg border font-semibold transition-all flex items-center justify-center gap-1.5 ${
                step === 1
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                  : step > 1
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-white text-slate-400 border-slate-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">1. Período (PA)</span>
              <span className="sm:hidden">1. PA</span>
            </div>

            <div
              className={`p-2 rounded-lg border font-semibold transition-all flex items-center justify-center gap-1.5 ${
                step === 2
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                  : step > 2
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-white text-slate-400 border-slate-200'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">2. Receitas</span>
              <span className="sm:hidden">2. Rec.</span>
            </div>

            <div
              className={`p-2 rounded-lg border font-semibold transition-all flex items-center justify-center gap-1.5 ${
                step === 3
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                  : step > 3
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-white text-slate-400 border-slate-200'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">3. Atividades</span>
              <span className="sm:hidden">3. Ativ.</span>
            </div>

            <div
              className={`p-2 rounded-lg border font-semibold transition-all flex items-center justify-center gap-1.5 ${
                step === 4
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                  : 'bg-white text-slate-400 border-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">4. Resumo</span>
              <span className="sm:hidden">4. Resumo</span>
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo dos Cards */}
      <div className="p-6">
        {/* CARD 1: PERÍODO DE APURAÇÃO (PA) */}
        {step === 1 && (
          <div className="space-y-6 max-w-lg mx-auto animate-fadeIn">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
                <Calendar className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-slate-900">
                Card 1: Informe o Período de Apuração (PA)
              </h4>
              <p className="text-xs text-slate-500">
                Selecione o mês e ano correspondente ao faturamento a ser declarado no PGDAS-D.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4 shadow-2xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Período de Apuração (Mês/Ano) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={periodoApuracao}
                    onChange={handlePaChange}
                    placeholder="MM/AAAA (ex: 06/2026)"
                    maxLength={7}
                    className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Formato esperado: <code className="text-emerald-700 font-bold">MM/AAAA</code> (exemplo: 06/2026).
                </p>
              </div>

              {paValidationError && (
                <div className={`p-4 rounded-xl text-xs flex items-start space-x-3 animate-fadeIn border ${
                  paValidationError.includes('fora do ar') || paValidationError.includes('indisponível') || paValidationError.includes('MSG_E')
                    ? 'bg-amber-50 border-amber-300 text-amber-950 shadow-xs'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                  <AlertCircle className={`w-5 h-5 shrink-0 mt-0.5 ${
                    paValidationError.includes('fora do ar') || paValidationError.includes('indisponível') || paValidationError.includes('MSG_E')
                      ? 'text-amber-600'
                      : 'text-rose-600'
                  }`} />
                  <div className="space-y-1">
                    {(paValidationError.includes('fora do ar') || paValidationError.includes('indisponível') || paValidationError.includes('MSG_E')) && (
                      <span className="block font-black text-amber-900 text-xs uppercase tracking-wider">
                        ⚠️ Portal do Governo Indisponível (PGDAS-D)
                      </span>
                    )}
                    <span className="block font-medium leading-relaxed">{paValidationError}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                type="button"
                disabled={!isStep1Valid || isValidatingPa}
                onClick={(e) => {
                  e.preventDefault();
                  handleValidarPaAndAdvance(e);
                }}
                className="inline-flex items-center px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-xs hover:shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed space-x-2"
              >
                {isValidatingPa ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Validando PA no PGDAS-D...</span>
                  </>
                ) : (
                  <>
                    <span>Próximo Passo</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* CARD 2: RECEITAS BRUTAS */}
        {step === 2 && (
          <div className="space-y-6 max-w-lg mx-auto animate-fadeIn">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
                <DollarSign className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-slate-900">
                Card 2: Informe os Valores de Receita Bruta (PA {periodoApuracao})
              </h4>
              <p className="text-xs text-slate-500">
                Preencha os valores faturados no mercado interno e mercado externo para o mês de apuração.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4 shadow-2xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Receita no Mercado Interno (R$) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-bold text-xs">
                    R$
                  </div>
                  <input
                    type="text"
                    value={receitaMercadoInterno}
                    onChange={handleReceitaInternaChange}
                    placeholder="0,00"
                    className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Valor bruto recebido de clientes dentro do Brasil.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Receita no Mercado Externo (R$)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-bold text-xs">
                    R$
                  </div>
                  <input
                    type="text"
                    value={receitaMercadoExterna}
                    onChange={handleReceitaExternaChange}
                    placeholder="0,00"
                    className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Exportações e faturamento no exterior (deixar 0,00 se não houver).
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer space-x-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar</span>
              </button>

              <button
                type="button"
                disabled={!isStep2Valid}
                onClick={() => setStep(3)}
                className="inline-flex items-center px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-xs hover:shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed space-x-2"
              >
                <span>Próximo Passo</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* CARD 3: ATIVIDADES ECONÔMICAS */}
        {step === 3 && (
          <div className="space-y-6 max-w-xl mx-auto animate-fadeIn">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
                <Briefcase className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-slate-900">
                Card 3: Selecione a Atividade Econômica
              </h4>
              <p className="text-xs text-slate-500">
                Escolha o enquadramento tributário correspondente aos serviços prestados.
              </p>
            </div>

            <div className="space-y-3">
              {ATIVIDADES_DISPONIVEIS.map((atv) => {
                const isSelected = atividadeSelecionada === atv.id;
                return (
                  <label
                    key={atv.id}
                    onClick={() => setAtividadeSelecionada(atv.id)}
                    className={`block p-4 border rounded-2xl cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-emerald-50/90 border-emerald-500 ring-2 ring-emerald-500/30 shadow-xs'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <input
                        type="radio"
                        name="atividade"
                        value={atv.id}
                        checked={isSelected}
                        onChange={() => setAtividadeSelecionada(atv.id)}
                        className="mt-1 text-emerald-600 focus:ring-emerald-500 h-4 w-4 border-slate-300"
                      />
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900">{atv.title}</span>
                          <span className="text-[10px] font-bold font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                            {atv.anexo}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-relaxed">{atv.description}</p>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            {/* CONDITIONAL UF AND MUNICIPIO SELECTS FOR OUTRO MUNICIPIO */}
            {atividadeSelecionada === 'anexo_iii_outro_municipio' && (
              <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-2xl space-y-3 animate-fadeIn shadow-2xs">
                <div className="flex items-center space-x-2 text-xs font-bold text-emerald-950">
                  <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Informe a UF e o Município de Destino do ISS</span>
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  Para serviços tributados no Anexo III com ISS devido a outro município, selecione o local onde o serviço foi prestado.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      UF de Destino (ISS) <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={ufIss}
                      onChange={(e) => {
                        const newUf = e.target.value;
                        setUfIss(newUf);
                        const cities = MUNICIPIOS_POR_UF[newUf];
                        if (cities && cities.length > 0) {
                          setMunicipioIss(cities[0]);
                        }
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all cursor-pointer"
                    >
                      {LISTA_UFS.map((uf) => (
                        <option key={uf} value={uf}>
                          {uf}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Município de Destino (ISS) <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={municipioIss}
                      onChange={(e) => setMunicipioIss(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all cursor-pointer"
                    >
                      {(MUNICIPIOS_POR_UF[ufIss] || ['CAMPINAS', 'SAO PAULO']).map((muni) => (
                        <option key={muni} value={muni}>
                          {muni}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="inline-flex items-center px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer space-x-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar</span>
              </button>

              <button
                type="button"
                disabled={!isStep3Valid}
                onClick={() => setStep(4)}
                className="inline-flex items-center px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-xs hover:shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed space-x-2"
              >
                <span>Avançar para Resumo</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* CARD 4: RESUMO E CONFIRMAÇÃO */}
        {step === 4 && (
          <div className="space-y-6 max-w-xl mx-auto animate-fadeIn">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
                <FileText className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-slate-900">
                Card 4: Resumo e Confirmação da Apuração
              </h4>
              <p className="text-xs text-slate-500">
                Confira os dados abaixo antes de disparar o preenchimento automatizado no PGDAS-D.
              </p>
            </div>

            {/* Quadro de Resumo Consolidado */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3 text-xs text-slate-700 font-mono shadow-2xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-slate-500 font-sans font-semibold">Empresa / CNPJ:</span>
                <span className="font-bold text-slate-800 font-sans">{companyName} ({cnpj})</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-sans font-semibold">Período de Apuração (PA):</span>
                <span className="font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                  {periodoApuracao}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-sans font-semibold">Receita Mercado Interno:</span>
                <span className="font-bold text-slate-800">R$ {receitaMercadoInterno}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-sans font-semibold">Receita Mercado Externo:</span>
                <span className="font-bold text-slate-800">R$ {receitaMercadoExterna}</span>
              </div>

              {atividadeSelecionada === 'anexo_iii_outro_municipio' && (
                <div className="flex items-center justify-between bg-emerald-50/80 p-2 rounded-lg border border-emerald-200">
                  <span className="text-emerald-900 font-sans font-semibold">Destino do ISS (UF/Município):</span>
                  <span className="font-bold text-emerald-950 font-mono">
                    {ufIss} - {municipioIss}
                  </span>
                </div>
              )}

              <div className="pt-2 border-t border-slate-200">
                <span className="text-slate-500 font-sans font-semibold block mb-1">Atividade Econômica Selecionada:</span>
                <div className="p-2.5 bg-white border border-slate-200 rounded-xl text-[11px] font-sans font-medium text-slate-800 leading-relaxed">
                  <strong className="text-emerald-700 block mb-0.5">{selectedAtividadeObj.title}</strong>
                  {selectedAtividadeObj.description}
                </div>
              </div>
            </div>

            {/* Banner de Aviso do Robô */}
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-start space-x-2.5">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed text-[11px]">
                <strong>Atenção:</strong> Ao clicar no botão abaixo, o robô executará a apuração no PGDAS-D e irá parar na tela de <strong>Resumo</strong> sem realizar a transmissão final.
              </p>
            </div>

            {robotError && (
              <div className={`p-4 rounded-xl text-xs flex items-start justify-between animate-fadeIn border ${
                robotError.includes('fora do ar') || robotError.includes('indisponível') || robotError.includes('MSG_E')
                  ? 'bg-amber-50 border-amber-300 text-amber-950 shadow-xs'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}>
                <div className="flex items-start space-x-3">
                  <AlertCircle className={`w-5 h-5 shrink-0 mt-0.5 ${
                    robotError.includes('fora do ar') || robotError.includes('indisponível') || robotError.includes('MSG_E')
                      ? 'text-amber-600'
                      : 'text-rose-600'
                  }`} />
                  <div className="space-y-1">
                    {(robotError.includes('fora do ar') || robotError.includes('indisponível') || robotError.includes('MSG_E')) && (
                      <span className="block font-black text-amber-900 text-xs uppercase tracking-wider">
                        ⚠️ Portal do Governo Indisponível (PGDAS-D)
                      </span>
                    )}
                    <span className="block font-medium leading-relaxed">{robotError}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setRobotError(null)}
                  className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer ml-2"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="inline-flex items-center px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer space-x-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar e Corrigir</span>
              </button>

              <button
                type="button"
                disabled={isLoadingRobot}
                onClick={(e) => {
                  e.preventDefault();
                  handleCalculateAndEmit();
                }}
                className="inline-flex items-center px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed space-x-2"
              >
                {isLoadingRobot ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Executando Robô no PGDAS-D...</span>
                  </>
                ) : (
                  <>
                    <Bot className="w-4 h-4 text-white" />
                    <span>Calcular e Emitir DAS via Robô</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* RESULTADO (STEP 5): EXIBIÇÃO DOS TRIBUTOS CALCULADOS E BOTÃO DE TRANSMISSÃO */}
        {step === 5 && robotResult && (
          <div className="space-y-6 max-w-xl mx-auto animate-fadeIn">
            {robotError && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start space-x-3 text-xs text-rose-800 animate-fadeIn">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <h5 className="font-bold text-rose-900 mb-0.5">Erro durante a Transmissão</h5>
                  <p>{robotError}</p>
                </div>
              </div>
            )}

            {/* STATUS BANNER */}
            {transmittedResult ? (
              <div className="p-5 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-start space-x-3 shadow-sm animate-fadeIn">
                <div className="p-2.5 bg-emerald-600 text-white rounded-xl shrink-0 mt-0.5">
                  <CheckCheck className="w-6 h-6" />
                </div>
                <div className="space-y-1.5">
                  <h4 className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                    DECLARAÇÃO TRANSMITIDA COM SUCESSO!
                    <span className="text-[10px] font-bold bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded border border-emerald-300 uppercase">
                      Simples Nacional
                    </span>
                  </h4>
                  <p className="text-xs text-emerald-800 leading-relaxed">
                    {transmittedResult.mensagem || 'Declaração transmitida com sucesso.'} A apuração do PA <strong>{periodoApuracao}</strong> foi enviada à Receita Federal.
                  </p>
                  <div className="p-3 bg-white/80 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-1 mt-2">
                    <p className="font-bold flex items-center gap-1.5 text-emerald-950">
                      <FileCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      Emissão Manual da Guia (DAS):
                    </p>
                    <p className="text-[11px] text-emerald-800 leading-relaxed">
                      A declaração foi devidamente transmitida. Para gerar a guia de pagamento (DAS), acesse o portal do Simples Nacional ou o portal e-CAC da Receita Federal.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start space-x-3 shadow-xs">
                <div className="p-2 bg-emerald-600 text-white rounded-xl shrink-0 mt-0.5">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-emerald-900 flex items-center gap-2">
                    Apuração Calculada no PGDAS-D!
                    <span className="text-[10px] font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded border border-amber-300">
                      {robotResult.etapa || 'Aguardando Transmissão'}
                    </span>
                  </h4>
                  <p className="text-xs text-emerald-700 leading-relaxed">
                    Confira o demonstrativo abaixo dos impostos apurados. Clique em <strong>"Confirmar e Transmitir"</strong> para finalizar a transmissão da declaração.
                  </p>
                </div>
              </div>
            )}

            {/* Tabela de Resumo de Tributos Extraídos */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-emerald-600" />
                  Demonstrativo do Valor Devido por Tributo
                </h5>
                <span className="text-[10px] text-slate-500 font-mono">PA: {robotResult.periodoApuracao}</span>
              </div>

              {robotResult.dadosCalculados && (
                <div className="space-y-2 font-mono text-xs">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                    <span className="text-slate-600">IRPJ (Imposto de Renda PJ):</span>
                    <span className="font-bold text-slate-800">{robotResult.dadosCalculados.irpj || 'R$ 0,00'}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                    <span className="text-slate-600">CSLL (Contribuição Social):</span>
                    <span className="font-bold text-slate-800">{robotResult.dadosCalculados.csll || 'R$ 0,00'}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                    <span className="text-slate-600">COFINS:</span>
                    <span className="font-bold text-slate-800">{robotResult.dadosCalculados.cofins || 'R$ 0,00'}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                    <span className="text-slate-600">PIS / PASEP:</span>
                    <span className="font-bold text-slate-800">{robotResult.dadosCalculados.pis || 'R$ 0,00'}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                    <span className="text-slate-600">INSS / CPP:</span>
                    <span className="font-bold text-slate-800">{robotResult.dadosCalculados.inss || 'R$ 0,00'}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                    <span className="text-slate-600">ISS (Imposto Sobre Serviços):</span>
                    <span className="font-bold text-slate-800">{robotResult.dadosCalculados.iss || 'R$ 0,00'}</span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-100 text-emerald-950 font-bold border border-emerald-200 mt-3 text-sm">
                    <span className="font-sans">VALOR TOTAL DO DAS:</span>
                    <span className="text-emerald-900">{robotResult.dadosCalculados.total || 'R$ 0,00'}</span>
                  </div>
                </div>
              )}

              <div className="pt-2 text-[11px] text-slate-500 font-sans leading-relaxed border-t border-slate-100">
                <p>
                  {transmittedResult ? (
                    <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                      <CheckCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      Declaração transmitida com sucesso no portal do PGDAS-D.
                    </span>
                  ) : (
                    <span><strong>Atenção:</strong> Ao clicar em "Confirmar e Transmitir", a declaração será efetivamente transmitida à Receita Federal no portal do PGDAS-D.</span>
                  )}
                </p>
              </div>
            </div>

            {/* BOTÕES DE AÇÃO DO PASSO 5 */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setTransmittedResult(null);
                }}
                className="inline-flex items-center px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer space-x-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Nova Apuração / Recomeçar</span>
              </button>

              {transmittedResult ? (
                <div className="inline-flex items-center px-5 py-2.5 bg-emerald-100 border border-emerald-300 text-emerald-900 font-bold text-xs rounded-xl space-x-2">
                  <FileCheck className="w-4 h-4 text-emerald-600" />
                  <span>Declaração Transmitida</span>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={isTransmitting}
                  onClick={(e) => {
                    e.preventDefault();
                    handleTransmitAndGenerateDas();
                  }}
                  className="inline-flex items-center px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg hover:shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed space-x-2 transform active:scale-98"
                >
                  {isTransmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>Transmitindo Declaração no PGDAS-D...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 text-white" />
                      <span>Confirmar e Transmitir</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal de Confirmação de Retificação */}
      {showRetificacaoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-slate-200">
            <div className="flex items-start space-x-3.5">
              <div className="p-3 bg-amber-100 text-amber-800 rounded-xl shrink-0 mt-0.5">
                <AlertCircle className="w-6 h-6 text-amber-600" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  Aviso de Declaração Existente
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {retificacaoMensagem || 'Já existe uma declaração transmitida para este PA. Você deseja retificar a declaração anterior?'}
                </p>
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed">
              <strong>Atenção:</strong> Ao confirmar, a declaração anterior do período de apuração <strong>{periodoApuracao}</strong> será substituída (retificada) no portal do Simples Nacional.
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setShowRetificacaoModal(false);
                  if (step === 1) {
                    setDeveRetificar(false);
                    setPeriodoApuracao('');
                  }
                }}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Não / Cancelar
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setDeveRetificar(true);
                  setShowRetificacaoModal(false);
                  if (step === 1) {
                    setStep(2);
                  } else if (step === 5 && robotResult) {
                    handleTransmitAndGenerateDas(true);
                  } else {
                    handleCalculateAndEmit(true);
                  }
                }}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center space-x-1.5"
              >
                <span>Sim, Retificar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drawer do Histórico de Apurações (Firebase Firestore) */}
      <HistoricoApuracoesDrawer
        isOpen={isHistoricoOpen}
        onClose={() => setIsHistoricoOpen(false)}
        currentCnpj={cnpj}
      />
    </div>
  );
};
