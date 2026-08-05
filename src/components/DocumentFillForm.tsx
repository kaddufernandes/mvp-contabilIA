import React, { useState, useEffect } from 'react';
import {
  FileText, Building2, Upload, Download, CheckCircle2,
  RefreshCw, AlertCircle, ShieldCheck
} from 'lucide-react';
import { EmpresaData } from '../types';
import { getCompaniesStore } from '../lib/companiesStore';

export const DocumentFillForm: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [companies, setCompanies] = useState<EmpresaData[]>([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState<boolean>(true);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedCompany, setSelectedCompany] = useState<EmpresaData | null>(null);

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);

  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [mappedFields, setMappedFields] = useState<any[]>([]);

  const base64ToBlobUrl = (base64: string, mimeType = 'application/pdf'): string => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });
    return URL.createObjectURL(blob);
  };

  const fetchCompanies = async () => {
    setIsLoadingCompanies(true);
    try {
      const data = await getCompaniesStore();
      setCompanies(data || []);
    } catch (err) {
      setErrorMsg('Não foi possível carregar as empresas.');
    } finally {
      setIsLoadingCompanies(false);
    }
  };

  useEffect(() => { fetchCompanies(); }, []);

  const handleCompanySelect = (companyId: string) => {
    setSelectedCompanyId(companyId);
    const company = companies.find(c => c.id === companyId || c.cnpj === companyId);
    if (company) {
      setSelectedCompany(company);
      setErrorMsg(null);
      if (currentStep === 1) setCurrentStep(2);
    } else {
      setSelectedCompany(null);
    }
  };

  const handleFileChange = (file: File) => {
    if (!file) return;
    setPdfFile(file);
    setErrorMsg(null);
    setMappedFields([]);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFileChange(e.dataTransfer.files[0]);
  };

  // LÊ O PDF E VAI DIRETO PARA O MAPEAMENTO / EDIÇÃO (PASSO 3)
  const handleParsePdf = async (fileToParse = pdfFile) => {
    if (!selectedCompany || !fileToParse) return;
    setIsParsing(true);
    setErrorMsg(null);

    try {
      const formData = new FormData();
      formData.append('pdfFile', fileToParse);
      formData.append('companyData', JSON.stringify(selectedCompany));

      const res = await fetch('/api/fill-pdf', { method: 'POST', body: formData });
      const data = await res.json();
      
      if (!res.ok || !data.success) throw new Error(data?.error);

      setMappedFields(data.mappedFields || []);
      setCurrentStep(3); // Direto para Edição & Download!
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao analisar o formulário PDF.');
      setCurrentStep(2); 
    } finally {
      setIsParsing(false);
    }
  };

  const handleFieldChange = (pdfFieldName: string, newValue: string | boolean) => {
    setMappedFields((prev) =>
      prev.map((item) => (item.pdfField === pdfFieldName ? { ...item, value: newValue } : item))
    );
  };

  const handleGenerateAndDownloadPdf = async () => {
    if (!pdfFile || mappedFields.length === 0) return;
    setIsGenerating(true);
    setErrorMsg(null);

    try {
      const formData = new FormData();
      formData.append('pdfFile', pdfFile);
      formData.append('editedFields', JSON.stringify(mappedFields));

      const res = await fetch('/api/generate-pdf', { method: 'POST', body: formData });
      const data = await res.json();
      
      if (!res.ok || !data.success) throw new Error(data?.error);

      if (data.pdfBase64) {
        const url = base64ToBlobUrl(data.pdfBase64);
        const filename = `Documento_Pronto_${selectedCompany?.cnpj || 'empresa'}.pdf`;
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao gerar o documento.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fadeIn pb-12">
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl"><FileText className="w-6 h-6 text-emerald-600" /></div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Preenchimento Automático</h2>
        </div>
      </div>

      {/* Stepper (3 passos simples) */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div onClick={() => setCurrentStep(1)} className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center space-x-3 ${currentStep === 1 ? 'bg-emerald-50 border-emerald-500' : 'bg-slate-50'}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${selectedCompany ? 'bg-emerald-600 text-white' : 'bg-slate-200'}`}>1</div>
            <div><span className="text-[10px] uppercase font-bold text-slate-400 block">Passo 1</span><span className="font-bold text-xs block truncate w-40">{selectedCompany ? selectedCompany.razao_social : 'Selecionar Empresa'}</span></div>
          </div>
          <div onClick={() => { if (selectedCompany) setCurrentStep(2); }} className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center space-x-3 ${currentStep === 2 ? 'bg-emerald-50 border-emerald-500' : 'bg-slate-50'}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${pdfFile ? 'bg-emerald-600 text-white' : 'bg-slate-200'}`}>2</div>
            <div><span className="text-[10px] uppercase font-bold text-slate-400 block">Passo 2</span><span className="font-bold text-xs block truncate w-40">{pdfFile ? pdfFile.name : 'Upload do PDF'}</span></div>
          </div>
          <div className={`p-3 rounded-xl border flex items-center space-x-3 ${currentStep === 3 ? 'bg-emerald-50 border-emerald-500' : 'bg-slate-50 opacity-50'}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${mappedFields.length > 0 ? 'bg-emerald-600 text-white' : 'bg-slate-200'}`}>3</div>
            <div><span className="text-[10px] uppercase font-bold text-slate-400 block">Passo 3</span><span className="font-bold text-xs block truncate">Edição & Download</span></div>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs flex justify-between">
          <div className="flex items-center space-x-2"><AlertCircle className="w-5 h-5 text-rose-600" /><span>{errorMsg}</span></div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-600 font-bold hover:underline">Fechar</button>
        </div>
      )}

      {/* Passo 1: Selecionar Empresa */}
      {currentStep === 1 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
          <label className="block text-xs font-bold text-slate-800">Escolha a Empresa Cadastrada:</label>
          <select value={selectedCompanyId} onChange={(e) => handleCompanySelect(e.target.value)} className="w-full text-xs p-3.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 cursor-pointer">
            <option value="">-- Selecione uma Empresa --</option>
            {companies.map((c) => (
              <option key={c.id || c.cnpj} value={c.id || c.cnpj}>{c.razao_social}</option>
            ))}
          </select>
        </div>
      )}

      {/* Passo 2: Upload e Leitura do PDF */}
      {currentStep === 2 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
          <div onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop} className={`border-2 border-dashed rounded-2xl p-8 text-center ${dragActive ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 bg-slate-50'}`}>
            <input type="file" id="pdfFileInput" accept=".pdf" onChange={(e) => { if (e.target.files && e.target.files[0]) handleFileChange(e.target.files[0]); }} className="hidden" />
            <label htmlFor="pdfFileInput" className="cursor-pointer block space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto"><FileText className="w-7 h-7" /></div>
              {pdfFile ? (
                <div><p className="text-xs font-bold text-emerald-900">Arquivo Selecionado:</p><p className="text-sm font-extrabold text-slate-900 mt-0.5">{pdfFile.name}</p></div>
              ) : (
                <p className="text-xs font-bold text-slate-800">Arraste o arquivo PDF aqui ou <span className="text-emerald-600 underline">clique para selecionar</span></p>
              )}
            </label>
          </div>
          
          <button onClick={() => handleParsePdf()} disabled={!pdfFile || isParsing} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center font-bold">
            {isParsing ? <RefreshCw className="w-5 h-5 mr-2 animate-spin" /> : null}
            Mapear Arquivo Enviado
          </button>
        </div>
      )}

      {/* Passo 3: EDIÇÃO DOS CAMPOS MAPEADOS & DOWNLOAD */}
      {currentStep === 3 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 uppercase flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-600"/> Campos Identificados no PDF ({mappedFields.length})</h4>
            </div>
            
            {mappedFields.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {mappedFields.map((item, idx) => (
                  <div key={idx} className="bg-white p-3 rounded-xl border border-slate-200">
                    <label className="block text-[11px] font-bold text-slate-700 mb-2 uppercase tracking-wide truncate" title={item.pdfField}>
                      {item.label} <span className="text-slate-400 font-normal ml-1">({item.pdfField})</span>
                    </label>
                    
                    {item.type === 'checkbox' ? (
                      <label className="inline-flex items-center space-x-2 cursor-pointer">
                        <input type="checkbox" checked={Boolean(item.value)} onChange={(e) => handleFieldChange(item.pdfField, e.target.checked)} className="w-5 h-5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer" />
                        <span className="text-xs font-bold">{item.value ? 'Marcado (Sim)' : 'Desmarcado (Não)'}</span>
                      </label>
                    ) : item.type === 'radio' || item.type === 'dropdown' ? (
                        <select value={String(item.value)} onChange={(e) => handleFieldChange(item.pdfField, e.target.value)} className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500">
                          <option value="">Selecione...</option>
                          {item.options?.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                    ) : (
                      <input type="text" value={String(item.value ?? '')} onChange={(e) => handleFieldChange(item.pdfField, e.target.value)} className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500" />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">Nenhum campo editável foi localizado neste arquivo.</p>
            )}
          </div>

          <div className="flex justify-center gap-3">
            <button onClick={handleGenerateAndDownloadPdf} disabled={isGenerating} className="px-6 py-3 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md cursor-pointer flex items-center">
              {isGenerating ? <RefreshCw className="w-5 h-5 mr-2 animate-spin" /> : <Download className="w-5 h-5 mr-2" />}
              Gerar e Baixar Documento Final
            </button>
          </div>
        </div>
      )}
    </div>
  );
};