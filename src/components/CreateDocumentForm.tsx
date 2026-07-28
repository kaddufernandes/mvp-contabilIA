import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Upload,
  Building2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Download,
  Copy,
  RefreshCw,
  FolderOpen,
  ArrowRight,
  FileCode2,
  Wand2,
  Printer,
  ChevronRight,
  ShieldCheck,
  Building,
} from 'lucide-react';
import { EmpresaData } from '../types';
import { getAuthHeaders } from '../lib/apiClient';
import { jsPDF } from 'jspdf';

interface CreateDocumentFormProps {
  onNavigate?: (path: string) => void;
  initialCompany?: EmpresaData | null;
}

export const CreateDocumentForm: React.FC<CreateDocumentFormProps> = ({
  onNavigate,
  initialCompany,
}) => {
  // Step State
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Companies List State
  const [companies, setCompanies] = useState<EmpresaData[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState<boolean>(false);
  const [selectedCompany, setSelectedCompany] = useState<EmpresaData | null>(
    initialCompany || null
  );

  // File Upload State
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);

  // AI Generation & Editor State
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isRefining, setIsRefining] = useState<boolean>(false);
  const [generatedText, setGeneratedText] = useState<string>('');
  const [customInstructions, setCustomInstructions] = useState<string>('');
  const [refinementPrompt, setRefinementPrompt] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load companies from API on mount
  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    setLoadingCompanies(true);
    try {
      const res = await fetch('/api/companies', {
        headers: {
          ...getAuthHeaders(),
        },
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.companies)) {
        setCompanies(data.companies);
        if (!selectedCompany && data.companies.length > 0) {
          setSelectedCompany(data.companies[0]);
        }
      }
    } catch (err) {
      console.warn('Erro ao carregar lista de empresas:', err);
    } finally {
      setLoadingCompanies(false);
    }
  };

  // Drag & drop handlers
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
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'pdf' && ext !== 'txt' && ext !== 'doc' && ext !== 'docx') {
      setErrorMsg('Por favor, selecione um arquivo de modelo nos formatos PDF ou TXT.');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setErrorMsg('O arquivo excede o limite máximo de 15MB.');
      return;
    }

    setErrorMsg(null);
    setTemplateFile(file);
    // Proceed to Step 3 for generation
    setCurrentStep(3);
  };

  // Call Gemini AI Endpoint
  const handleGenerateContract = async () => {
    if (!selectedCompany) {
      setErrorMsg('Selecione uma empresa no Passo 1 antes de continuar.');
      return;
    }
    if (!templateFile) {
      setErrorMsg('Faça upload do modelo de documento no Passo 2.');
      return;
    }

    setIsGenerating(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const formData = new FormData();
      formData.append('templateFile', templateFile);
      formData.append('companyData', JSON.stringify(selectedCompany));
      if (customInstructions) {
        formData.append('customInstructions', customInstructions);
      }

      const res = await fetch('/api/generate-contract', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data?.error || `Erro ao gerar documento (Status ${res.status})`);
      }

      setGeneratedText(data.generatedContract || '');
      setSuccessMsg(
        `Contrato reescrito com sucesso para "${selectedCompany.razao_social}"! Você pode fazer edições adicionais abaixo.`
      );
    } catch (err: any) {
      console.error('Erro na geração de contrato:', err);
      setErrorMsg(err.message || 'Falha ao processar e reescrever o contrato com a IA.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Call Gemini AI Refinement Endpoint
  const handleRefineDocument = async () => {
    if (!generatedText || !generatedText.trim()) {
      setErrorMsg('Não há texto no editor para ser ajustado.');
      return;
    }
    if (!refinementPrompt || !refinementPrompt.trim()) {
      setErrorMsg('Digite a instrução de alteração desejada (ex: "Adicione uma cláusula de alteração de nome empresarial para...").');
      return;
    }

    setIsRefining(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/refine-contract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentText: generatedText,
          customInstruction: refinementPrompt,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data?.error || `Erro ao refinhar contrato (Status ${res.status})`);
      }

      setGeneratedText(data.refinedContract || generatedText);
      setRefinementPrompt('');
      setSuccessMsg('Alteração aplicada com sucesso pela IA Paralegal no documento!');
    } catch (err: any) {
      console.error('Erro no refinamento via IA:', err);
      setErrorMsg(err.message || 'Falha ao aplicar alteração com IA.');
    } finally {
      setIsRefining(false);
    }
  };

  // Auto-trigger contract generation when entering Step 3 with file & company
  useEffect(() => {
    if (currentStep === 3 && templateFile && selectedCompany && !generatedText && !isGenerating) {
      handleGenerateContract();
    }
  }, [currentStep, templateFile, selectedCompany]);

  // Export to PDF function using jsPDF
  const handleExportPdf = () => {
    if (!generatedText) {
      setErrorMsg('Nenhum texto disponível para exportação.');
      return;
    }

    try {
      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 18; // 18mm margin
      const printableWidth = pageWidth - margin * 2;

      // Clean title header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42); // slate-900

      const title = (selectedCompany?.razao_social || 'DOCUMENTO SOCIETÁRIO').toUpperCase();
      doc.text(title, margin, 20);

      doc.setDrawColor(203, 213, 225); // slate-300
      doc.setLineWidth(0.4);
      doc.line(margin, 24, pageWidth - margin, 24);

      // Body Text
      doc.setFont('times', 'normal');
      doc.setFontSize(10.5);
      doc.setTextColor(30, 41, 59); // slate-800

      const lines = doc.splitTextToSize(generatedText, printableWidth);
      const lineHeight = 5.2;
      let cursorY = 32;

      lines.forEach((line: string) => {
        if (cursorY + lineHeight > pageHeight - 20) {
          doc.addPage();
          cursorY = 22;
        }
        doc.text(line, margin, cursorY);
        cursorY += lineHeight;
      });

      // Footer with page numbers
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(
          `Página ${i} de ${totalPages} • Gerado via Contabil.IA`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        );
      }

      const safeName = (selectedCompany?.razao_social || 'empresa')
        .replace(/[^a-zA-Z0-9]/g, '_')
        .toLowerCase();
      const filename = `contrato_${safeName}.pdf`;

      doc.save(filename);
      setSuccessMsg(`PDF "${filename}" exportado e baixado com sucesso!`);
    } catch (err: any) {
      console.error('Erro ao gerar PDF com jsPDF:', err);
      setErrorMsg('Falha ao exportar PDF. Verifique o conteúdo do editor.');
    }
  };

  const handleCopyText = () => {
    if (!generatedText) return;
    navigator.clipboard.writeText(generatedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 animate-fadeIn">
      {/* Header Title Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 p-6 sm:p-8 rounded-3xl text-white shadow-xl relative overflow-hidden border border-slate-700/80">
        <div className="absolute top-0 right-0 transform translate-x-8 -translate-y-8 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-3">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-emerald-500/20 rounded-full border border-emerald-400/30 text-emerald-300 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Inteligência Artificial Paralegal</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Criar e Reescrever Documentos com IA
          </h2>

          <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
            Anexe um contrato ou minuta modelo. O Gemini IA reescreverá o documento adaptando rigorosamente a qualificação das partes, qualificações dos sócios, endereço e capital social aos dados da empresa selecionada.
          </p>
        </div>
      </div>

      {/* Stepper Navigation */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
        <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center">
          {/* Step 1 */}
          <button
            type="button"
            onClick={() => setCurrentStep(1)}
            className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center space-y-1 sm:space-y-0 sm:space-x-2.5 ${
              currentStep === 1
                ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-bold ring-2 ring-emerald-500/20'
                : selectedCompany
                ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                : 'bg-slate-50 border-slate-200 text-slate-400'
            }`}
          >
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                currentStep === 1
                  ? 'bg-emerald-600 text-white'
                  : selectedCompany
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              1
            </div>
            <div className="text-left hidden sm:block">
              <span className="text-xs block font-bold">1. Empresa</span>
              <span className="text-[10px] text-slate-500 truncate max-w-[120px] block">
                {selectedCompany ? selectedCompany.razao_social : 'Selecionar'}
              </span>
            </div>
            <span className="text-[11px] font-bold sm:hidden">Empresa</span>
          </button>

          {/* Step 2 */}
          <button
            type="button"
            onClick={() => {
              if (selectedCompany) setCurrentStep(2);
            }}
            disabled={!selectedCompany}
            className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row items-center justify-center space-y-1 sm:space-y-0 sm:space-x-2.5 ${
              currentStep === 2
                ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-bold ring-2 ring-emerald-500/20'
                : templateFile
                ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer'
                : 'bg-slate-50 border-slate-200 text-slate-400 disabled:opacity-60 disabled:cursor-not-allowed'
            }`}
          >
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                currentStep === 2
                  ? 'bg-emerald-600 text-white'
                  : templateFile
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              2
            </div>
            <div className="text-left hidden sm:block">
              <span className="text-xs block font-bold">2. Modelo</span>
              <span className="text-[10px] text-slate-500 truncate max-w-[120px] block">
                {templateFile ? templateFile.name : 'Upload PDF/TXT'}
              </span>
            </div>
            <span className="text-[11px] font-bold sm:hidden">Modelo</span>
          </button>

          {/* Step 3 */}
          <button
            type="button"
            onClick={() => {
              if (selectedCompany && templateFile) setCurrentStep(3);
            }}
            disabled={!selectedCompany || !templateFile}
            className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row items-center justify-center space-y-1 sm:space-y-0 sm:space-x-2.5 ${
              currentStep === 3
                ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-bold ring-2 ring-emerald-500/20'
                : generatedText
                ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer'
                : 'bg-slate-50 border-slate-200 text-slate-400 disabled:opacity-60 disabled:cursor-not-allowed'
            }`}
          >
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                currentStep === 3
                  ? 'bg-emerald-600 text-white'
                  : generatedText
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              3
            </div>
            <div className="text-left hidden sm:block">
              <span className="text-xs block font-bold">3. Editor & PDF</span>
              <span className="text-[10px] text-slate-500 block">Revisar & Exportar</span>
            </div>
            <span className="text-[11px] font-bold sm:hidden">Revisar</span>
          </button>
        </div>
      </div>

      {/* Global Alert Messages */}
      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start space-x-3 text-red-800 text-xs animate-fadeIn">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold">Atenção</h4>
            <p className="mt-0.5">{errorMsg}</p>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start space-x-3 text-emerald-900 text-xs animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold">Sucesso</h4>
            <p className="mt-0.5">{successMsg}</p>
          </div>
        </div>
      )}

      {/* PASSO 1: SELEÇÃO DA EMPRESA */}
      {currentStep === 1 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6 animate-fadeIn">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Building2 className="w-5 h-5 text-emerald-600" />
              <span>Passo 1: Selecione a Empresa para o Contrato</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Escolha uma empresa cadastrada no banco de dados cujas informações serão injetadas no novo contrato.
            </p>
          </div>

          {loadingCompanies ? (
            <div className="p-8 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
              <p className="text-xs text-slate-500 font-semibold">Carregando cadastros societários...</p>
            </div>
          ) : companies.length > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {companies.map((comp, idx) => {
                  const isSelected = selectedCompany?.cnpj === comp.cnpj || selectedCompany?.razao_social === comp.razao_social;
                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedCompany(comp)}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50/60 shadow-md ring-2 ring-emerald-500/20'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <h4 className="text-xs font-black text-slate-900">{comp.razao_social}</h4>
                          <p className="text-[11px] font-mono text-slate-600 font-semibold">
                            CNPJ: {comp.cnpj || 'Não informado'}
                          </p>
                        </div>
                        {isSelected && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-100/80 text-[11px] text-slate-500 flex flex-wrap items-center justify-between gap-1">
                        <span>{comp.endereco?.municipio ? `${comp.endereco.municipio}/${comp.endereco.uf}` : 'Sem cidade'}</span>
                        <span className="font-bold text-emerald-700">
                          {comp.qsa && comp.qsa.length > 0 ? `${comp.qsa.length} sócio(s)` : 'Sem QSA'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {selectedCompany && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center space-x-2 text-xs font-bold text-slate-800">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Empresa Selecionada: {selectedCompany.razao_social}</span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Capital Social: <strong>R$ {Number(selectedCompany.capital_social || 0).toLocaleString('pt-BR')}</strong> •
                    Endereço: {selectedCompany.endereco?.logradouro}, {selectedCompany.endereco?.numero} - {selectedCompany.endereco?.municipio}/{selectedCompany.endereco?.uf}
                  </p>
                </div>
              )}

              <div className="pt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  disabled={!selectedCompany}
                  className="inline-flex items-center px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 rounded-xl transition-all cursor-pointer shadow-xs"
                >
                  <span>Avançar para Passo 2 (Upload do Modelo)</span>
                  <ArrowRight className="w-4 h-4 ml-2" />
                </button>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 space-y-3">
              <Building className="w-10 h-10 text-slate-400 mx-auto" />
              <h4 className="text-xs font-bold text-slate-800">Nenhuma Empresa Cadastrada</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Para reescrever um documento, você precisa ter ao menos uma empresa cadastrada no sistema.
              </p>
              <button
                type="button"
                onClick={() => onNavigate && onNavigate('/cadastro-empresa')}
                className="px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl hover:bg-emerald-700 transition-colors"
              >
                Cadastrar Nova Empresa
              </button>
            </div>
          )}
        </div>
      )}

      {/* PASSO 2: UPLOAD DO MODELO BASE (PDF OU TXT) */}
      {currentStep === 2 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6 animate-fadeIn">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <FolderOpen className="w-5 h-5 text-emerald-600" />
              <span>Passo 2: Upload do Modelo de Documento (PDF ou TXT)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Envie a minuta ou contrato original. A IA lerá a estrutura jurídica e adaptará para os dados de <strong className="text-slate-800">{selectedCompany?.razao_social}</strong>.
            </p>
          </div>

          {/* Area Drag and Drop */}
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all cursor-pointer ${
              dragActive
                ? 'border-emerald-500 bg-emerald-50/80 scale-[1.01]'
                : templateFile
                ? 'border-emerald-400 bg-emerald-50/30'
                : 'border-slate-300 bg-slate-50/60 hover:bg-slate-100/80 hover:border-slate-400'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.doc,.docx"
              onChange={handleFileChange}
              className="hidden"
            />

            {templateFile ? (
              <div className="space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-md">
                  <FileCode2 className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">{templateFile.name}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {(templateFile.size / 1024).toFixed(1)} KB • Pronto para processamento com IA
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTemplateFile(null);
                  }}
                  className="text-xs text-red-600 font-bold hover:underline cursor-pointer"
                >
                  Remover e escolher outro
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-slate-200 text-slate-600 flex items-center justify-center mx-auto">
                  <Upload className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-800">
                    Arraste e solte o modelo aqui ou <span className="text-emerald-700 underline">procure no seu computador</span>
                  </h4>
                  <p className="text-xs text-slate-500">
                    Suporta arquivos <strong>PDF (.pdf)</strong>, <strong>Texto (.txt)</strong> ou minutas contratuais (Até 15MB)
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Campo opcional de instruções adicionais */}
          <div className="space-y-2 pt-2">
            <label className="text-xs font-bold text-slate-700 block">
              Instruções Adicionais para a IA (Opcional):
            </label>
            <input
              type="text"
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder="Ex: Adicionar cláusula de foro da comarca de São Paulo, alterar capital social para 100% em moeda corrente..."
              className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            />
          </div>

          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Voltar ao Passo 1
            </button>

            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              disabled={!templateFile}
              className="inline-flex items-center px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 rounded-xl transition-all cursor-pointer shadow-xs"
            >
              <span>Avançar para Passo 3 (Gerar Contrato)</span>
              <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          </div>
        </div>
      )}

      {/* PASSO 3: EDITOR DE REVISÃO E EXPORTAÇÃO PDF */}
      {currentStep === 3 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6 animate-fadeIn">
          <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Wand2 className="w-5 h-5 text-emerald-600" />
                <span>Passo 3: Editor de Revisão & Exportação PDF</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Revise, edite ou ajuste qualquer cláusula gerada pela IA para <strong className="text-slate-800">{selectedCompany?.razao_social}</strong> antes de baixar o PDF final.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="text-xs text-emerald-700 font-bold hover:underline cursor-pointer self-start sm:self-auto"
            >
              Trocar Modelo
            </button>
          </div>

          {isGenerating ? (
            <div className="p-12 text-center space-y-4">
              <RefreshCw className="w-10 h-10 text-emerald-600 animate-spin mx-auto" />
              <div>
                <h4 className="text-sm font-bold text-slate-800">IA Paralegal Reescrevendo o Contrato...</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Mapeando cláusulas jurídicas e adaptando qualificações societárias para {selectedCompany?.razao_social}...
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Toolbar do Editor */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex items-center space-x-3 text-xs text-slate-600 font-semibold">
                  <span>
                    Palavras: <strong>{generatedText ? generatedText.trim().split(/\s+/).length : 0}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Caracteres: <strong>{generatedText.length}</strong>
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handleGenerateContract}
                    title="Regerar Contrato via IA"
                    className="inline-flex items-center px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                    Regerar
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyText}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5 mr-1.5 text-slate-600" />
                    {copied ? 'Copiado!' : 'Copiar Texto'}
                  </button>
                </div>
              </div>

              {/* EDITOR GRANDE DE TEXTO */}
              <div className="relative">
                <textarea
                  value={generatedText}
                  onChange={(e) => setGeneratedText(e.target.value)}
                  placeholder="O texto do contrato gerado pela IA aparecerá aqui para você ler e editar..."
                  className="w-full h-112 p-5 text-xs sm:text-sm font-mono leading-relaxed bg-slate-900 text-slate-100 border border-slate-800 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden resize-y shadow-inner"
                />
              </div>

              {/* CARD DE AJUSTE FINO VIA IA (PROMPT CUSTOMIZADO) */}
              <div className="p-4 bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 rounded-2xl border border-emerald-800/60 shadow-md text-white space-y-3">
                <div className="flex items-center space-x-2 text-xs font-bold text-emerald-300">
                  <Wand2 className="w-4 h-4 text-emerald-400" />
                  <span>Ajuste Fino via IA (Instrução Customizada)</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Precisa incluir uma nova cláusula ou alterar algo específico no texto atual? Digite a instrução abaixo para a IA refinar o documento.
                </p>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="text"
                    value={refinementPrompt}
                    onChange={(e) => setRefinementPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !isRefining) {
                        e.preventDefault();
                        handleRefineDocument();
                      }
                    }}
                    placeholder="Ex: Adicione uma cláusula de alteração de nome empresarial para..."
                    className="flex-1 text-xs p-3 bg-slate-800 text-slate-100 placeholder-slate-400 border border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />

                  <button
                    type="button"
                    onClick={handleRefineDocument}
                    disabled={isRefining || !refinementPrompt.trim()}
                    className="inline-flex items-center justify-center px-5 py-3 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 rounded-xl transition-all cursor-pointer shadow-sm shrink-0"
                  >
                    {isRefining ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin text-emerald-200" />
                        <span>Aplicando...</span>
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4 mr-2 text-emerald-300" />
                        <span>Aplicar Alteração com IA</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Ações Finais: Exportar PDF */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleExportPdf}
                  disabled={!generatedText}
                  className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 rounded-xl shadow-lg hover:shadow-xl transition-all cursor-pointer ring-2 ring-emerald-500/30"
                >
                  <Download className="w-5 h-5 mr-2" />
                  Exportar como PDF
                </button>

                <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setTemplateFile(null);
                      setGeneratedText('');
                      setCurrentStep(2);
                    }}
                    className="px-4 py-3 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition-colors cursor-pointer"
                  >
                    Criar Outro Documento
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
