import React, { useState, useEffect } from 'react';
import {
  FileText,
  Building2,
  Upload,
  Download,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Sparkles,
  FileCheck2,
  Search,
  ChevronRight,
  ShieldCheck,
  FileSpreadsheet,
} from 'lucide-react';
import { EmpresaData } from '../types';
import { getAuthHeaders } from '../lib/apiClient';

interface DocumentFillFormProps {
  onNavigate?: (path: string) => void;
}

export const DocumentFillForm: React.FC<DocumentFillFormProps> = ({ onNavigate }) => {
  // Stepper state
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Companies state
  const [companies, setCompanies] = useState<EmpresaData[]>([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState<boolean>(true);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedCompany, setSelectedCompany] = useState<EmpresaData | null>(null);

  // File upload state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);

  // Processing & result state
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadFilename, setDownloadFilename] = useState<string>('documento_preenchido.pdf');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [mappedFields, setMappedFields] = useState<
    Array<{ pdfField: string; type: 'text' | 'checkbox'; value: string | boolean }>
  >([]);

  // Helper to convert base64 to Blob URL
  const base64ToBlobUrl = (base64: string, mimeType = 'application/pdf'): string => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });
    return URL.createObjectURL(blob);
  };

  // 1. Fetch companies from database
  const fetchCompanies = async () => {
    setIsLoadingCompanies(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/companies', {
        headers: {
          ...getAuthHeaders(),
        },
      });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.companies)) {
        setCompanies(data.companies);
      } else if (Array.isArray(data)) {
        setCompanies(data);
      } else {
        setCompanies([]);
      }
    } catch (err: any) {
      console.error('Erro ao carregar empresas para preenchimento:', err);
      setErrorMsg('Não foi possível carregar as empresas do banco de dados.');
    } finally {
      setIsLoadingCompanies(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  // Handle company selection
  const handleCompanySelect = (companyId: string) => {
    setSelectedCompanyId(companyId);
    const company = companies.find(
      (c) => c.id === companyId || c.cnpj === companyId || c.cnpj.replace(/\D/g, '') === companyId
    );

    if (company) {
      setSelectedCompany(company);
      setErrorMsg(null);
      // Avançar para o Passo 2 automaticamente se ainda estiver no Passo 1
      if (currentStep === 1) {
        setCurrentStep(2);
      }
    } else {
      setSelectedCompany(null);
    }
  };

  // Handle file drop & upload
  const handleFileChange = (file: File) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setErrorMsg('Por favor, selecione um arquivo PDF válido (.pdf).');
      return;
    }

    setPdfFile(file);
    setErrorMsg(null);
    setDownloadUrl(null);
    setSuccessMsg(null);
    setMappedFields([]);
    // Ir para passo 3 de edição/processamento
    setCurrentStep(3);
  };

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
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  // ETAPA 1: PARSE / LEITURA DOS CAMPOS DO PDF
  const handleParsePdf = async () => {
    if (!selectedCompany) {
      setErrorMsg('Selecione uma empresa no Passo 1 antes de prosseguir.');
      return;
    }
    if (!pdfFile) {
      setErrorMsg('Selecione um arquivo PDF de formulário no Passo 2.');
      return;
    }

    setIsParsing(true);
    setErrorMsg(null);
    setDownloadUrl(null);
    setSuccessMsg(null);

    try {
      const formData = new FormData();
      formData.append('pdfFile', pdfFile);
      formData.append('companyData', JSON.stringify(selectedCompany));

      const res = await fetch('/api/fill-pdf', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data?.error || `Erro no servidor ao ler PDF (Status ${res.status})`);
      }

      const fields = data.mappedFields || [];
      setMappedFields(fields);
    } catch (err: any) {
      console.error('Erro ao analisar campos do PDF:', err);
      setErrorMsg(err.message || 'Falha ao analisar o formulário PDF.');
    } finally {
      setIsParsing(false);
    }
  };

  // Atualizar valor do campo no formulário interativo
  const handleFieldChange = (pdfFieldName: string, newValue: string | boolean) => {
    setMappedFields((prev) =>
      prev.map((item) =>
        item.pdfField === pdfFieldName ? { ...item, value: newValue } : item
      )
    );
    // Limpar o URL de download antigo para incentivar nova geração
    setDownloadUrl(null);
  };

  // ETAPA 2: GERAÇÃO E DOWNLOAD DO PDF FINAL COM OS DADOS EDITADOS
  const handleGenerateAndDownloadPdf = async () => {
    if (!pdfFile) {
      setErrorMsg('Nenhum arquivo PDF carregado.');
      return;
    }

    setIsGenerating(true);
    setErrorMsg(null);

    try {
      const formData = new FormData();
      formData.append('pdfFile', pdfFile);
      formData.append('editedFields', JSON.stringify(mappedFields));

      const res = await fetch('/api/generate-pdf', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data?.error || `Erro ao gerar PDF final (Status ${res.status})`);
      }

      if (data.pdfBase64) {
        const url = base64ToBlobUrl(data.pdfBase64);
        setDownloadUrl(url);

        const safeName = (selectedCompany?.razao_social || 'empresa')
          .replace(/[^a-zA-Z0-9]/g, '_')
          .toLowerCase();
        const filename = `documento_preenchido_${safeName}.pdf`;

        setDownloadFilename(filename);

        // Disparar o download automático
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        setSuccessMsg(
          `Documento PDF gerado e baixado com sucesso (${mappedFields.length} campos processados)!`
        );
      }
    } catch (err: any) {
      console.error('Erro ao gerar e baixar PDF:', err);
      setErrorMsg(err.message || 'Falha ao gerar o documento PDF final.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Disparar o Parse da Etapa 1 ao entrar no Passo 3 com arquivo & empresa
  useEffect(() => {
    if (currentStep === 3 && pdfFile && selectedCompany && mappedFields.length === 0 && !isParsing) {
      handleParsePdf();
    }
  }, [currentStep, pdfFile, selectedCompany]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fadeIn pb-12">
      {/* HEADER TÍTULO DA PÁGINA */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl">
              <FileText className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Preenchimento Automático de Documentos PDF
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Mapeie e preencha formulários cadastrais, contratos e guias com 1 clique utilizando dados do banco de dados
              </p>
            </div>
          </div>
        </div>

        {onNavigate && (
          <button
            type="button"
            onClick={() => onNavigate('/empresas')}
            className="inline-flex items-center px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer shrink-0"
          >
            <Building2 className="w-4 h-4 mr-1.5 text-slate-500" />
            Ver Empresas
          </button>
        )}
      </div>

      {/* STEPPER INDICATOR */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* PASSO 1 */}
          <div
            onClick={() => setCurrentStep(1)}
            className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center space-x-3.5 ${
              currentStep === 1
                ? 'bg-emerald-50/80 border-emerald-500 text-emerald-950 ring-2 ring-emerald-500/20 shadow-xs'
                : selectedCompany
                ? 'bg-slate-50 border-emerald-200 text-slate-800'
                : 'bg-slate-50 border-slate-200 text-slate-400 opacity-80'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                selectedCompany
                  ? 'bg-emerald-600 text-white'
                  : currentStep === 1
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              {selectedCompany ? <CheckCircle2 className="w-5 h-5" /> : '1'}
            </div>
            <div className="overflow-hidden">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                Passo 1
              </span>
              <span className="font-bold text-xs block truncate text-slate-800">
                {selectedCompany ? selectedCompany.razao_social : 'Selecionar Empresa'}
              </span>
            </div>
          </div>

          {/* PASSO 2 */}
          <div
            onClick={() => {
              if (selectedCompany) setCurrentStep(2);
            }}
            className={`p-4 rounded-xl border transition-all flex items-center space-x-3.5 ${
              !selectedCompany
                ? 'bg-slate-50 border-slate-200 opacity-50 cursor-not-allowed'
                : currentStep === 2
                ? 'bg-emerald-50/80 border-emerald-500 text-emerald-950 ring-2 ring-emerald-500/20 shadow-xs cursor-pointer'
                : pdfFile
                ? 'bg-slate-50 border-emerald-200 text-slate-800 cursor-pointer'
                : 'bg-slate-50 border-slate-200 text-slate-600 cursor-pointer'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                pdfFile
                  ? 'bg-emerald-600 text-white'
                  : currentStep === 2
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              {pdfFile ? <CheckCircle2 className="w-5 h-5" /> : '2'}
            </div>
            <div className="overflow-hidden">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                Passo 2
              </span>
              <span className="font-bold text-xs block truncate text-slate-800">
                {pdfFile ? pdfFile.name : 'Upload do Formulário PDF'}
              </span>
            </div>
          </div>

          {/* PASSO 3 */}
          <div
            onClick={() => {
              if (selectedCompany && pdfFile) setCurrentStep(3);
            }}
            className={`p-4 rounded-xl border transition-all flex items-center space-x-3.5 ${
              !selectedCompany || !pdfFile
                ? 'bg-slate-50 border-slate-200 opacity-50 cursor-not-allowed'
                : currentStep === 3
                ? 'bg-emerald-50/80 border-emerald-500 text-emerald-950 ring-2 ring-emerald-500/20 shadow-xs cursor-pointer'
                : downloadUrl
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900 cursor-pointer'
                : 'bg-slate-50 border-slate-200 text-slate-600 cursor-pointer'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                downloadUrl
                  ? 'bg-emerald-600 text-white'
                  : currentStep === 3
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              {downloadUrl ? <CheckCircle2 className="w-5 h-5" /> : '3'}
            </div>
            <div className="overflow-hidden">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                Passo 3
              </span>
              <span className="font-bold text-xs block truncate text-slate-800">
                {downloadUrl ? 'Documento Pronto!' : 'Preenchimento & Download'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ERROR BANNER */}
      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs flex items-center justify-between shadow-xs animate-fadeIn">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-rose-600 font-bold hover:underline cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      {/* STEP 1 CONTENT: SELECIONAR EMPRESA */}
      {currentStep === 1 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6 animate-fadeIn">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Building2 className="w-5 h-5 text-emerald-600" />
              <span>Passo 1: Selecione a Empresa para o Preenchimento</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Selecione uma das empresas cadastradas no banco de dados. Os dados societários, fiscais (IE/IM) e endereço serão injetados no documento.
            </p>
          </div>

          {isLoadingCompanies ? (
            <div className="p-8 text-center text-slate-500 space-y-2">
              <RefreshCw className="w-6 h-6 text-emerald-600 animate-spin mx-auto" />
              <p className="text-xs font-medium">Carregando lista de empresas do banco...</p>
            </div>
          ) : companies.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 space-y-3">
              <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
              <p className="text-xs font-bold text-slate-800">
                Nenhuma empresa cadastrada no banco de dados.
              </p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Para utilizar o preenchimento automático, cadastre primeiro uma empresa no sistema.
              </p>
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate('/cadastro-empresa')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                >
                  + Cadastrar Nova Empresa
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <label className="block text-xs font-bold text-slate-800">
                Escolha a Empresa Cadastrada:
              </label>

              <select
                value={selectedCompanyId}
                onChange={(e) => handleCompanySelect(e.target.value)}
                className="w-full text-xs font-semibold p-3.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden cursor-pointer"
              >
                <option value="">-- Selecione uma Empresa --</option>
                {companies.map((c) => (
                  <option key={c.id || c.cnpj} value={c.id || c.cnpj}>
                    {c.razao_social} ({c.cnpj || 'Sem CNPJ'}) - {c.endereco?.municipio || ''}/{c.endereco?.uf || ''}
                  </option>
                ))}
              </select>

              {/* CARD RESUMO DA EMPRESA SELECIONADA */}
              {selectedCompany && (
                <div className="p-4 bg-emerald-50/70 rounded-xl border border-emerald-200 space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center">
                      <CheckCircle2 className="w-4 h-4 mr-1 text-emerald-600" /> Empresa Selecionada
                    </span>
                    <span className="text-[10px] font-mono font-bold bg-white px-2 py-0.5 rounded border border-emerald-200 text-emerald-800">
                      CNPJ: {selectedCompany.cnpj}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-slate-700">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Razão Social:</span>
                      <span className="font-bold text-slate-900">{selectedCompany.razao_social}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Inscrição Estadual:</span>
                      <span className="font-semibold text-slate-800">{selectedCompany.inscricao_estadual || 'ISENTO'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Inscrição Municipal:</span>
                      <span className="font-semibold text-slate-800">{selectedCompany.inscricao_municipal || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-emerald-200/60 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(2)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center space-x-1"
                    >
                      <span>Avançar para Upload do PDF</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* STEP 2 CONTENT: UPLOAD DO PDF */}
      {currentStep === 2 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6 animate-fadeIn">
          <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Upload className="w-5 h-5 text-emerald-600" />
                <span>Passo 2: Upload do Formulário ou Contrato PDF</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Envie qualquer arquivo PDF com campos interativos ou formulários oficiais para que o sistema injete os dados de <strong className="text-slate-800">{selectedCompany?.razao_social}</strong>.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="text-xs text-emerald-700 font-bold hover:underline cursor-pointer"
            >
              Trocar Empresa
            </button>
          </div>

          {/* DRAG AND DROP AREA */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
              dragActive
                ? 'border-emerald-500 bg-emerald-50/80 scale-[1.01]'
                : pdfFile
                ? 'border-emerald-400 bg-emerald-50/30'
                : 'border-slate-300 bg-slate-50/60 hover:bg-slate-50'
            }`}
          >
            <input
              type="file"
              id="pdfFileInput"
              accept=".pdf,application/pdf"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileChange(e.target.files[0]);
                }
              }}
              className="hidden"
            />

            <label htmlFor="pdfFileInput" className="cursor-pointer block space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-inner">
                <FileText className="w-7 h-7" />
              </div>

              {pdfFile ? (
                <div>
                  <p className="text-xs font-bold text-emerald-900">Arquivo Selecionado:</p>
                  <p className="text-sm font-extrabold text-slate-900 mt-0.5">{pdfFile.name}</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {(pdfFile.size / 1024).toFixed(1)} KB • Clique para escolher outro
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-xs font-bold text-slate-800">
                    Arraste o arquivo PDF aqui ou <span className="text-emerald-600 underline">clique para selecionar</span>
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Formato aceito: .pdf (Formulários cadastrais, guias, contratos, ficha FDC)
                  </p>
                </div>
              )}
            </label>
          </div>

          {/* DICA E MODELO DEMO */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-start space-x-3 text-xs text-slate-600">
            <Sparkles className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-slate-800">Mapeamento Inteligente de Campos</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                O motor `pdf-lib` do Contabil.IA identifica automaticamente campos de texto no PDF (ex: `razao_social`, `cnpj`, `logradouro`, `inscricao_estadual`, `cidade`, `uf`) e substitui seus valores diretamente no arquivo original.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3 CONTENT: PROCESSAMENTO, EDIÇÃO E DOWNLOAD */}
      {currentStep === 3 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6 animate-fadeIn">
          <div className="border-b border-slate-100 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <FileCheck2 className="w-5 h-5 text-emerald-600" />
                <span>Passo 3: Formulário Editável & Geração do PDF</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Revise e edite as informações extraídas de <strong className="text-slate-800">{selectedCompany?.razao_social}</strong> antes de gerar o documento final.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="text-xs text-emerald-700 font-bold hover:underline cursor-pointer self-start md:self-auto"
            >
              Trocar PDF
            </button>
          </div>

          {isParsing ? (
            <div className="p-12 text-center space-y-4">
              <RefreshCw className="w-10 h-10 text-emerald-600 animate-spin mx-auto" />
              <div>
                <h4 className="text-sm font-bold text-slate-800">Lendo e Mapeando Campos do PDF...</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Identificando campos de texto e checkboxes no arquivo {pdfFile?.name}...
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* SUCESSO OU STATUS DE MAPEAMENTO */}
              {successMsg && (
                <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between text-xs text-emerald-950 animate-fadeIn">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span className="font-bold">{successMsg}</span>
                  </div>
                  {downloadUrl && (
                    <a
                      href={downloadUrl}
                      download={downloadFilename}
                      className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg text-xs transition-colors shrink-0"
                    >
                      Baixar Novamente
                    </a>
                  )}
                </div>
              )}

              {/* TABELA EDITÁVEL DOS CAMPOS (AUDITORIA E EDIÇÃO DE CONTEÚDO) */}
              <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200/90 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center space-x-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Campos do PDF Identificados para Edição
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Altere qualquer valor abaixo. As edições serão gravadas no PDF gerado.
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/90 px-3 py-1 rounded-full border border-emerald-200">
                    {mappedFields.length} {mappedFields.length === 1 ? 'campo localizado' : 'campos localizados'}
                  </span>
                </div>

                {mappedFields.length > 0 ? (
                  <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-2xs">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead className="bg-slate-100/80 text-slate-600 font-bold border-b border-slate-200 uppercase text-[10px]">
                        <tr>
                          <th className="px-3.5 py-2.5 w-1/3">Campo no Documento (PDF)</th>
                          <th className="px-3.5 py-2.5 w-24">Tipo</th>
                          <th className="px-3.5 py-2.5">Informação Inserida (Editável)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {mappedFields.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-3.5 py-2.5 font-mono text-slate-800 font-medium text-[11px]">
                              {item.pdfField}
                            </td>
                            <td className="px-3.5 py-2.5">
                              <span
                                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border uppercase ${
                                  item.type === 'checkbox'
                                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                                    : 'bg-blue-50 text-blue-700 border-blue-200'
                                }`}
                              >
                                {item.type === 'checkbox' ? 'Checkbox' : 'Texto'}
                              </span>
                            </td>
                            <td className="px-3.5 py-2">
                              {item.type === 'checkbox' ? (
                                <label className="inline-flex items-center space-x-2.5 cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(item.value)}
                                    onChange={(e) =>
                                      handleFieldChange(item.pdfField, e.target.checked)
                                    }
                                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                                  />
                                  <span
                                    className={`text-xs font-bold ${
                                      item.value ? 'text-emerald-700' : 'text-slate-500'
                                    }`}
                                  >
                                    {item.value ? 'Sim / Marcado' : 'Não / Desmarcado'}
                                  </span>
                                </label>
                              ) : (
                                <input
                                  type="text"
                                  value={String(item.value ?? '')}
                                  onChange={(e) =>
                                    handleFieldChange(item.pdfField, e.target.value)
                                  }
                                  className="w-full text-xs font-semibold px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-hidden transition-all text-slate-900"
                                  placeholder="Digite a informação..."
                                />
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start space-x-3 text-amber-900 text-xs">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-amber-950">Aviso de Compatibilidade de Campos</p>
                      <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                        Nenhum campo interativo foi detectado neste PDF. Ao gerar o documento, um carimbo cadastral com as informações selecionadas será estampado no topo da primeira página.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* BOTÕES DE AÇÃO PRINCIPAIS DE GERAÇÃO E DOWNLOAD */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleGenerateAndDownloadPdf}
                  disabled={isGenerating}
                  className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer ring-2 ring-emerald-500/30"
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                      Gerando PDF Final...
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5 mr-2" />
                      Baixar Documento Preenchido
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPdfFile(null);
                    setDownloadUrl(null);
                    setMappedFields([]);
                    setCurrentStep(2);
                  }}
                  className="w-full sm:w-auto px-4 py-3 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition-colors cursor-pointer"
                >
                  Preencher Outro PDF
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
