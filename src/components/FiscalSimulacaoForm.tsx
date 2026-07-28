import React, { useState, useEffect } from 'react';
import {
  Calculator,
  Building2,
  UploadCloud,
  FileText,
  DollarSign,
  TrendingUp,
  Receipt,
  Lock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  RefreshCw,
  FileSpreadsheet,
} from 'lucide-react';
import { EmpresaData } from '../types';
import { getAuthHeaders } from '../lib/apiClient';

interface FiscalSimulacaoFormProps {
  onNavigate?: (path: string) => void;
}

export interface GuiaImposto {
  nome: string;
  valor: number;
}

export interface ResultadoImpostos {
  regime: string;
  guias: GuiaImposto[];
  total: number;
  tipoGuia: string;
  aliquotaEfetiva: number;
  descricaoAliquota: string;
  avisoVisual?: string;
}

export const FiscalSimulacaoForm: React.FC<FiscalSimulacaoFormProps> = ({ onNavigate }) => {
  const [companies, setCompanies] = useState<EmpresaData[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);

  // Input Method: 'file' | 'manual'
  const [inputMethod, setInputMethod] = useState<'file' | 'manual'>('manual');

  // File Upload State
  const [tipoImportacao, setTipoImportacao] = useState<'saida' | 'entrada'>('saida');
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const [clienteDetectado, setClienteDetectado] = useState<string>('');

  // Manual Form Inputs
  const [receitaServicos, setReceitaServicos] = useState<string>('');
  const [receitaComercio, setReceitaComercio] = useState<string>('');
  const [despesasEntradas, setDespesasEntradas] = useState<string>('');
  const [competencia, setCompetencia] = useState<string>('2026-07');

  // Preview Result State
  const [isCalculated, setIsCalculated] = useState<boolean>(false);
  const [resultadoImpostos, setResultadoImpostos] = useState<ResultadoImpostos | null>(null);
  const [calculating, setCalculating] = useState<boolean>(false);

  // Alerta Visual de Auditoria / Validação de CNPJ
  const [auditAlert, setAuditAlert] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  // 1. Função de Máscara de Digitação Livre (BRL)
  const formatCurrency = (value: string): string => {
    if (!value) return '';
    let cleaned = value.replace(/[^\d,]/g, '');

    const commaIndex = cleaned.indexOf(',');
    if (commaIndex !== -1) {
      cleaned = cleaned.substring(0, commaIndex + 1) + cleaned.substring(commaIndex + 1).replace(/,/g, '');
    }

    const parts = cleaned.split(',');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');

    if (parts[1] !== undefined) {
      parts[1] = parts[1].substring(0, 2);
    }

    return parts.join(',');
  };

  // 4. Correção do Cálculo Matemático (Parser)
  const parseCurrencyToNumber = (value: string): number => {
    if (!value) return 0;
    const num = Number(value.replace(/\./g, '').replace(',', '.'));
    return isNaN(num) ? 0 : num;
  };

  // Cálculo Reativo
  const faturamentoServicos = parseCurrencyToNumber(receitaServicos);
  const faturamentoComercio = parseCurrencyToNumber(receitaComercio);
  const valorDespesasEntradas = parseCurrencyToNumber(despesasEntradas);
  const faturamentoTotal = faturamentoServicos + faturamentoComercio;

  // Motor de Regras Tributárias Baseado no Regime da Empresa Selecionada
  const calcularImposto = (
    servicos: number,
    comercio: number,
    despesas: number = 0,
    regime: string = ''
  ): ResultadoImpostos => {
    const totalReceita = servicos + comercio;
    const regimeLower = (regime || '').toLowerCase();

    if (regimeLower.includes('simples')) {
      // Simples Nacional: 6% para Serviços (Anexo III) + 4% para Comércio (Anexo I)
      const valServ = servicos * 0.06;
      const valCom = comercio * 0.04;
      const totalImposto = valServ + valCom;
      const aliqEfetiva = totalReceita > 0 ? (totalImposto / totalReceita) * 100 : 6.0;

      return {
        regime: 'Simples Nacional',
        guias: [
          { nome: 'DAS', valor: totalImposto },
        ],
        total: totalImposto,
        tipoGuia: 'Estimativa do DAS',
        aliquotaEfetiva: aliqEfetiva,
        descricaoAliquota: 'Anexo III (6,00% Serv) / Anexo I (4,00% Com)',
        avisoVisual: despesas > 0
          ? `Despesas/Entradas registradas: R$ ${despesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (Apuração no Simples Nacional e incidência sobre o faturamento bruto).`
          : undefined,
      };
    } else if (regimeLower.includes('presumido') || regimeLower.includes('real')) {
      const isReal = regimeLower.includes('real');
      if (isReal) {
        // Lucro Real: Abatimento de Entradas e Crédito do PIS/COFINS
        const lucroApurado = Math.max(0, totalReceita - despesas);
        const pisDebito = totalReceita * 0.0165;
        const pisCredito = despesas * 0.0165;
        const calc_pis = Math.max(0, pisDebito - pisCredito);

        const cofinsDebito = totalReceita * 0.076;
        const cofinsCredito = despesas * 0.076;
        const calc_cofins = Math.max(0, cofinsDebito - cofinsCredito);

        const calc_irpj = lucroApurado * 0.15;
        const calc_csll = lucroApurado * 0.09;

        const totalImposto = calc_pis + calc_cofins + calc_irpj + calc_csll;
        const aliqEfetiva = totalReceita > 0 ? (totalImposto / totalReceita) * 100 : 0;

        return {
          regime: 'Lucro Real',
          guias: [
            { nome: 'DARF - PIS (com crédito de entradas)', valor: calc_pis },
            { nome: 'DARF - COFINS (com crédito de entradas)', valor: calc_cofins },
            { nome: 'DARF - IRPJ (sobre Lucro Real)', valor: calc_irpj },
            { nome: 'DARF - CSLL (sobre Lucro Real)', valor: calc_csll },
          ],
          total: totalImposto,
          tipoGuia: 'Estimativa de Impostos Federais (Lucro Real)',
          aliquotaEfetiva: aliqEfetiva,
          descricaoAliquota: 'PIS (1,65%) / COFINS (7,60%) não-cumulativos com crédito + IRPJ (15%) / CSLL (9%)',
          avisoVisual: despesas > 0
            ? `Créditos e deduções de R$ ${despesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} aplicados sobre notas de entrada.`
            : 'Nota: No Lucro Real, IRPJ e CSLL dependem do balanço do período.',
        };
      } else {
        // Lucro Presumido
        const calc_pis = totalReceita * 0.0065;
        const calc_cofins = totalReceita * 0.03;
        const calc_irpj = totalReceita * 0.048;
        const calc_csll = totalReceita * 0.0288;
        const totalImposto = calc_pis + calc_cofins + calc_irpj + calc_csll;
        const aliqEfetiva = totalReceita > 0 ? (totalImposto / totalReceita) * 100 : 11.33;

        return {
          regime: 'Lucro Presumido',
          guias: [
            { nome: 'DARF - PIS', valor: calc_pis },
            { nome: 'DARF - COFINS', valor: calc_cofins },
            { nome: 'DARF - IRPJ', valor: calc_irpj },
            { nome: 'DARF - CSLL', valor: calc_csll },
          ],
          total: totalImposto,
          tipoGuia: 'Estimativa de Impostos Federais (DARF)',
          aliquotaEfetiva: aliqEfetiva,
          descricaoAliquota: 'PIS (0,65%) + COFINS (3,00%) + IRPJ (4,80%) + CSLL (2,88%)',
          avisoVisual: despesas > 0
            ? `Notas de entrada registradas: R$ ${despesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`
            : undefined,
        };
      }
    } else {
      const totalImposto = totalReceita * 0.06;
      const aliqEfetiva = 6.0;

      return {
        regime: regime || 'Não Informado',
        guias: [
          { nome: 'Guia Única de Impostos', valor: totalImposto },
        ],
        total: totalImposto,
        tipoGuia: 'Estimativa Fiscal (Regime Indefinido)',
        aliquotaEfetiva: aliqEfetiva,
        descricaoAliquota: 'Alíquota Padrão Estimada (6,00%)',
        avisoVisual: 'Atualize o regime tributário no cadastro da empresa para apuração exata.',
      };
    }
  };

  // Fetch user companies
  useEffect(() => {
    async function loadCompanies() {
      setIsLoadingCompanies(true);
      try {
        const res = await fetch('/api/companies', {
          headers: { ...getAuthHeaders() },
        });
        const data = await res.json();
        if (data.success && Array.isArray(data.companies) && data.companies.length > 0) {
          setCompanies(data.companies);
          setSelectedCompanyId(data.companies[0].id || data.companies[0].cnpj);
        } else {
          // Fallback mock companies if user has no saved company yet
          const fallbackList: EmpresaData[] = [
            {
              id: 'mock_1',
              cnpj: '00.360.305/0001-04',
              razao_social: 'CAIXA ECONOMICA FEDERAL',
              regime_tributario: 'Simples Nacional',
            } as any,
            {
              id: 'mock_2',
              cnpj: '11.222.333/0001-44',
              razao_social: 'Empresa Exemplo Contábil LTDA',
              regime_tributario: 'Lucro Presumido',
            } as any,
            {
              id: 'mock_3',
              cnpj: '22.333.444/0001-55',
              razao_social: 'Indústria & Tecnologia S.A.',
              regime_tributario: 'Lucro Real',
            } as any,
          ];
          setCompanies(fallbackList);
          setSelectedCompanyId('mock_1');
        }
      } catch (err) {
        console.error('Erro ao carregar empresas para simulação fiscal:', err);
      } finally {
        setIsLoadingCompanies(false);
      }
    }
    loadCompanies();
  }, []);

  const selectedCompany = companies.find(
    (c) => c.id === selectedCompanyId || c.cnpj === selectedCompanyId
  );
  const regimeEmpresa = selectedCompany?.regime_tributario || 'Simples Nacional';

  // Requisito: Parser do Arquivo TXT via Servidor Backend (/api/fiscal/parse-txt)
  const processTxtFile = async (file: File) => {
    setAuditAlert(null);

    // 1. Captura Dinâmica do CNPJ da Empresa Selecionada
    const targetCnpj = selectedCompany?.cnpj ? selectedCompany.cnpj.replace(/\D/g, '') : '';

    if (!targetCnpj) {
      setAuditAlert({
        type: 'error',
        message: 'Por favor, selecione uma empresa válida antes de importar o arquivo.',
      });
      const fileInput = document.getElementById('txt-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('cnpj', selectedCompany.cnpj);
      formData.append('tipoImportacao', tipoImportacao);

      const res = await fetch('/api/fiscal/parse-txt', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
        },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setReceitaServicos('');
        setReceitaComercio('');
        setDespesasEntradas('');
        setClienteDetectado('');
        setIsCalculated(false);
        setResultadoImpostos(null);
        setUploadedFile(null);

        const fileInput = document.getElementById('txt-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';

        setAuditAlert({
          type: 'error',
          message: data.error || `ERRO: O CNPJ ${selectedCompany.cnpj} não foi localizado no arquivo TXT.`,
        });
        return;
      }

      // 2. Sucesso na resposta do Servidor
      setUploadedFile(file);
      const valNum = typeof data.valorTotal === 'number' ? data.valorTotal : parseFloat(data.valorTotal || 0);
      const formattedValue = formatCurrency(valNum.toFixed(2).replace('.', ','));

      if (tipoImportacao === 'saida') {
        setReceitaServicos(formattedValue);
      } else {
        setDespesasEntradas(formattedValue);
      }

      setClienteDetectado(data.contraparte || '');
      setIsCalculated(false);
      setResultadoImpostos(null);

      setAuditAlert({
        type: 'success',
        message: data.message || `Arquivo de ${tipoImportacao === 'saida' ? 'Saída' : 'Entrada'} processado no servidor com sucesso. Montante: R$ ${formattedValue}`,
      });
    } catch (err: any) {
      console.error('Erro ao enviar TXT para o servidor:', err);
      setUploadedFile(null);
      setAuditAlert({
        type: 'error',
        message: 'Falha de conexão com o servidor ao processar o arquivo TXT. Tente novamente.',
      });
    }
  };

  // Handle Drag & Drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processTxtFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processTxtFile(e.target.files[0]);
    }
  };

  // Manual inputs handlers com máscara BRL
  const handleReceitaServicosChange = (val: string) => {
    const formatted = formatCurrency(val);
    setReceitaServicos(formatted);
    setIsCalculated(false);
    setResultadoImpostos(null);
  };

  const handleReceitaComercioChange = (val: string) => {
    const formatted = formatCurrency(val);
    setReceitaComercio(formatted);
    setIsCalculated(false);
    setResultadoImpostos(null);
  };

  const handleDespesasEntradasChange = (val: string) => {
    const formatted = formatCurrency(val);
    setDespesasEntradas(formatted);
    setIsCalculated(false);
    setResultadoImpostos(null);
  };

  // Perform Calculation on Button Click
  const handleCalcularImpostos = () => {
    setCalculating(true);
    setTimeout(() => {
      const serv = parseCurrencyToNumber(receitaServicos);
      const com = parseCurrencyToNumber(receitaComercio);
      const desp = parseCurrencyToNumber(despesasEntradas);
      const reg = selectedCompany?.regime_tributario || 'Simples Nacional';
      const res = calcularImposto(serv, com, desp, reg);
      setResultadoImpostos(res);
      setIsCalculated(true);
      setCalculating(false);
    }, 300);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8 animate-fadeIn">
      {/* 1. CABEÇALHO */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-xs relative overflow-hidden text-slate-900">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-full text-xs font-bold">
              <Receipt className="w-3.5 h-3.5 text-emerald-600" />
              <span>Módulo Fiscal & Tributário</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Simulação e Auditoria do DAS / DARF
            </h2>
            <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
              Calcule impostos do Simples Nacional, Lucro Presumido ou Lucro Real, importe faturamentos da prefeitura e pré-visualize o valor da guia com auditoria inteligente.
            </p>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center space-x-3 shrink-0">
            <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center font-bold">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <span className="block text-[10px] text-slate-500 uppercase font-bold">Competência</span>
              <input
                type="month"
                value={competencia}
                onChange={(e) => setCompetencia(e.target.value)}
                className="bg-transparent text-xs font-bold text-emerald-700 focus:outline-hidden cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. SELEÇÃO DE CONTEXTO (EMPRESA) */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-4 shadow-xs text-slate-900">
        <div className="flex items-center space-x-2.5 text-sm font-bold text-slate-800">
          <Building2 className="w-4 h-4 text-emerald-600" />
          <span>Selecione a Empresa Contribuinte</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div className="md:col-span-2">
            <select
              value={selectedCompanyId}
              onChange={(e) => {
                setSelectedCompanyId(e.target.value);
                setIsCalculated(false);
                setResultadoImpostos(null);
                setUploadedFile(null);
                setAuditAlert(null);
                setReceitaServicos('');
                setReceitaComercio('');
                setClienteDetectado('');
              }}
              disabled={isLoadingCompanies}
              className="w-full px-4 py-3 bg-slate-50 text-slate-900 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white focus:outline-hidden cursor-pointer"
            >
              {companies.map((company) => (
                <option key={company.id || company.cnpj} value={company.id || company.cnpj}>
                  {company.razao_social} ({company.cnpj}) - {company.regime_tributario || 'Simples Nacional'}
                </option>
              ))}
            </select>
          </div>

          {selectedCompany && (
            <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-xs space-y-0.5">
              <span className="text-[10px] text-slate-500 block font-bold uppercase">CNPJ Selecionado</span>
              <p className="font-bold text-emerald-800 truncate">{selectedCompany.cnpj}</p>
            </div>
          )}
        </div>
      </div>

      {/* 3. MÉTODO DE ENTRADA (TABS / CARDS DE ENTRADA DE DADOS) */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-6 shadow-xs text-slate-900">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Método de Lançamento de Faturamento</h3>
            <p className="text-xs text-slate-500">Escolha como deseja alimentar os valores de receita do mês</p>
          </div>

          {/* Toggle Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setInputMethod('manual')}
              className={`flex-1 sm:flex-initial px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center space-x-2 ${
                inputMethod === 'manual'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Digitar Manualmente</span>
            </button>
            <button
              type="button"
              onClick={() => setInputMethod('file')}
              className={`flex-1 sm:flex-initial px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center space-x-2 ${
                inputMethod === 'file'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Importar Arquivo TXT</span>
            </button>
          </div>
        </div>

        {/* ALERTA DE AUDITORIA DE CNPJ (NOTIFICAÇÃO VISUAL DE ERRO OU SUCESSO) */}
        {auditAlert && (
          <div
            className={`p-4 rounded-xl border flex items-center space-x-3 text-xs font-semibold animate-fadeIn ${
              auditAlert.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-900 shadow-xs'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900 shadow-xs'
            }`}
          >
            {auditAlert.type === 'error' ? (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            )}
            <div className="flex-1">
              <span className="font-bold block">{auditAlert.message}</span>
            </div>
          </div>
        )}

        {/* OPÇÃO A: UPLOAD DE ARQUIVO TXT / PREFEITURA */}
        {inputMethod === 'file' ? (
          <div className="space-y-4">
            {/* SELETOR DE TIPO DE ARQUIVO (SAÍDA / ENTRADA) */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-emerald-600" />
                <span>Tipo de Arquivo a Importar:</span>
              </span>
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <label className="inline-flex items-center gap-2 font-semibold text-slate-800 cursor-pointer">
                  <input
                    type="radio"
                    name="tipoImportacao"
                    value="saida"
                    checked={tipoImportacao === 'saida'}
                    onChange={() => {
                      setTipoImportacao('saida');
                      setAuditAlert(null);
                      if (uploadedFile) {
                        setUploadedFile(null);
                        setReceitaServicos('');
                        setClienteDetectado('');
                      }
                    }}
                    className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span>Nota de Saída (Faturamento / Prestados)</span>
                </label>
                <label className="inline-flex items-center gap-2 font-semibold text-slate-800 cursor-pointer">
                  <input
                    type="radio"
                    name="tipoImportacao"
                    value="entrada"
                    checked={tipoImportacao === 'entrada'}
                    onChange={() => {
                      setTipoImportacao('entrada');
                      setAuditAlert(null);
                      if (uploadedFile) {
                        setUploadedFile(null);
                        setReceitaServicos('');
                        setClienteDetectado('');
                      }
                    }}
                    className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span>Nota de Entrada (Despesas / Tomados)</span>
                </label>
              </div>
            </div>

            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
                dragActive
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-slate-300 bg-slate-50/80 hover:border-slate-400 hover:bg-slate-100/50'
              }`}
            >
              <input
                type="file"
                id="txt-upload"
                accept=".txt,.csv,.xml"
                onChange={handleFileInputChange}
                className="hidden"
              />
              <label htmlFor="txt-upload" className="cursor-pointer space-y-3 block">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto border border-emerald-200">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">
                    Arraste o arquivo TXT/NF-e da Prefeitura aqui
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Formatos aceitos: Extrato MENSAL da Prefeitura (.TXT), Sped Fiscal (.TXT) ou XMLs de NF-e
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => document.getElementById('txt-upload')?.click()}
                  className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-xs font-bold rounded-xl text-slate-700 shadow-xs transition-colors inline-flex items-center space-x-2 cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Selecionar Arquivo no Computador</span>
                </button>
              </label>
            </div>

            {uploadedFile && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-fadeIn">
                <div className="flex items-center space-x-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <p className="font-bold text-emerald-900">{uploadedFile.name}</p>
                    <p className="text-[10px] text-slate-500">
                      {(uploadedFile.size / 1024).toFixed(1)} KB • {tipoImportacao === 'saida' ? 'Faturamento extraído' : 'Despesa/Entrada extraída'}: <strong className="text-emerald-700">R$ {(tipoImportacao === 'saida' ? faturamentoServicos : valorDespesasEntradas).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                    </p>
                  </div>
                </div>
                {clienteDetectado && (
                  <div className="px-3 py-1.5 bg-emerald-100/80 border border-emerald-300/80 text-emerald-900 rounded-lg text-[11px] font-bold flex items-center space-x-1.5">
                    <Building2 className="w-3.5 h-3.5 text-emerald-700" />
                    <span>{tipoImportacao === 'saida' ? 'Tomador' : 'Prestador/Emissor'}: {clienteDetectado}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* OPÇÃO B: DIGITAR VALORES MANUALMENTE */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                <span>Receita de Serviços (Saída)</span>
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 font-bold text-xs">
                  R$
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={receitaServicos}
                  onChange={(e) => handleReceitaServicosChange(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 text-slate-900 border border-slate-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white focus:outline-hidden"
                />
              </div>
              <span className="text-[10px] text-slate-500 block">Ex: NFS-e Emitidas / Prestadas</span>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                <DollarSign className="w-3.5 h-3.5 text-teal-600" />
                <span>Receita de Comércio (Saída)</span>
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 font-bold text-xs">
                  R$
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={receitaComercio}
                  onChange={(e) => handleReceitaComercioChange(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 text-slate-900 border border-slate-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white focus:outline-hidden"
                />
              </div>
              <span className="text-[10px] text-slate-500 block">Ex: Vendas / DANFE / Cupons</span>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                <DollarSign className="w-3.5 h-3.5 text-amber-600" />
                <span>Despesas / Compras (Entrada)</span>
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 font-bold text-xs">
                  R$
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={despesasEntradas}
                  onChange={(e) => handleDespesasEntradasChange(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 text-slate-900 border border-slate-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:bg-white focus:outline-hidden"
                />
              </div>
              <span className="text-[10px] text-slate-500 block">Ex: NF-e de Entrada / Tomados</span>
            </div>
          </div>
        )}

        {/* BOTÃO DE AÇÃO REPOSICIONADO NO FLUXO DE ENTRADA */}
        <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2 text-xs text-slate-500">
            <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Regime Tributário: <strong className="text-slate-800">{regimeEmpresa}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={handleCalcularImpostos}
            disabled={calculating}
            className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center space-x-2"
          >
            {calculating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Calculando Impostos...</span>
              </>
            ) : (
              <>
                <Calculator className="w-4 h-4" />
                <span>Calcular Impostos</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 4. RESUMO DA SIMULAÇÃO (CARD DE PRÉVIA - EXIBIDO APENAS SE isCalculated) */}
      {isCalculated && resultadoImpostos && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-6 shadow-xs text-slate-900 relative overflow-hidden animate-fadeIn">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div className="flex items-center space-x-2.5">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              <h3 className="text-base font-bold text-slate-900">{resultadoImpostos.tipoGuia}</h3>
            </div>
            <span className="px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-[10px] font-bold flex items-center space-x-1">
              <Sparkles className="w-3 h-3 text-emerald-600" />
              <span>Simulado com Sucesso</span>
            </span>
          </div>

          {/* AUDITORIA VISUAL: CLIENTE DETECTADO */}
          {clienteDetectado && (
            <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-center space-x-2 text-xs text-emerald-900 animate-fadeIn">
              <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <span className="font-bold text-[10px] uppercase text-emerald-700 block">Tomador / Cliente Detectado na Auditoria:</span>
                <span className="font-extrabold text-xs text-emerald-900">{clienteDetectado}</span>
              </div>
            </div>
          )}

          {/* AVISO DE AUDITORIA DO REGIME */}
          {resultadoImpostos.avisoVisual && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start space-x-2.5 text-xs text-amber-900 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">{resultadoImpostos.avisoVisual}</p>
            </div>
          )}

          {/* METRICS CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Metric 1: Faturamento Total */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Faturamento Total (Mês)
              </span>
              <p className="text-2xl font-black text-slate-900">
                {faturamentoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
              <p className="text-[10px] text-slate-500">Soma de Serviços + Comércio</p>
            </div>

            {/* Metric 2: Alíquota Estimada */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Alíquota Efetiva Estimada
              </span>
              <p className="text-2xl font-black text-emerald-600">
                {`${resultadoImpostos.aliquotaEfetiva.toFixed(2)}%`}
              </p>
              <p className="text-[10px] text-slate-500 truncate">{resultadoImpostos.descricaoAliquota}</p>
            </div>

            {/* Metric 3: Total de Impostos */}
            <div className="p-4 bg-emerald-50/80 border border-emerald-200/80 rounded-2xl space-y-1">
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block truncate">
                Total de Impostos Estimados
              </span>
              <p className="text-2xl font-black text-emerald-700">
                {resultadoImpostos.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
              <p className="text-[10px] text-emerald-800/80">Regime: {resultadoImpostos.regime}</p>
            </div>
          </div>

          {/* LISTA E DETALHAMENTO DAS GUIAS (MAP) */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-2">
              <Receipt className="w-4 h-4 text-emerald-600" />
              <span>Detalhamento das Guias de Impostos</span>
            </h4>

            <div className="bg-slate-50 border border-slate-200 rounded-xl divide-y divide-slate-200 overflow-hidden">
              {resultadoImpostos.guias.map((guia, index) => (
                <div key={index} className="p-3.5 flex items-center justify-between text-xs hover:bg-slate-100/50 transition-colors">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                    <span className="font-semibold text-slate-800">{guia.nome}</span>
                  </div>
                  <span className="font-mono font-bold text-slate-900">
                    {guia.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
              ))}

              {/* LINHA DE DESTAQUE NO FINAL COM O TOTAL */}
              <div className="p-4 bg-slate-900 text-white flex items-center justify-between text-xs font-bold">
                <span className="uppercase tracking-wider">Total de Impostos Estimados</span>
                <span className="text-sm font-mono text-emerald-400">
                  {resultadoImpostos.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            </div>
          </div>

          {/* 5. AÇÕES FINAIS */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-4">
            <button
              type="button"
              disabled
              className="w-full sm:w-auto px-6 py-3.5 bg-slate-100 text-slate-400 border border-slate-200 font-bold text-xs rounded-xl cursor-not-allowed flex items-center justify-center space-x-2 opacity-80"
            >
              <Lock className="w-4 h-4 text-amber-500" />
              <span>Transmitir para o e-CAC (Bloqueado)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
