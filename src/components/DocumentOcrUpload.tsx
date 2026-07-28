import React, { useState, useRef } from 'react';
import {
  Upload,
  FileText,
  Sparkles,
  CheckCircle,
  AlertCircle,
  FileCheck,
  ArrowRight,
  RefreshCw,
  Trash2,
  Check,
  ShieldCheck,
  Receipt,
  Building2,
  FileSearch,
  Filter,
  MapPin,
  Users,
} from 'lucide-react';
import { OcrResponseData, EmpresaData } from '../types';

export type ExtractionType = 'junta' | 'cadesp' | 'municipal';

interface DocumentOcrUploadProps {
  onOcrExtracted: (ocrData: OcrResponseData) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  setErrorMsg: (msg: string | null) => void;
  currentEmpresa: EmpresaData;
  extractionType?: ExtractionType;
  setExtractionType?: (type: ExtractionType) => void;
}

export const DocumentOcrUpload: React.FC<DocumentOcrUploadProps> = ({
  onOcrExtracted,
  isLoading,
  setIsLoading,
  setErrorMsg,
  currentEmpresa,
  extractionType: propExtractionType,
  setExtractionType: propSetExtractionType,
}) => {
  const [internalExtractionType, setInternalExtractionType] = useState<ExtractionType>('junta');
  const activeExtractionType = propExtractionType !== undefined ? propExtractionType : internalExtractionType;

  const handleSelectExtractionType = (type: ExtractionType) => {
    if (propSetExtractionType) {
      propSetExtractionType(type);
    } else {
      setInternalExtractionType(type);
    }
  };

  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractedPreview, setExtractedPreview] = useState<OcrResponseData | null>(null);
  const [isReviewing, setIsReviewing] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const processFile = (file: File) => {
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.type.startsWith('image/')) {
      setErrorMsg('Por favor, envie um arquivo nos formatos PDF, PNG, JPG ou WEBP.');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setErrorMsg('O arquivo deve ter no máximo 20MB.');
      return;
    }

    setSelectedFile(file);
    setErrorMsg(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  // Envia o arquivo para a API de OCR
  const handleOcrProcess = async () => {
    if (!selectedFile) return;

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const base64Data = await convertFileToBase64(selectedFile);
      const response = await fetch('/api/ocr-document', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileBase64: base64Data,
          mimeType: selectedFile.type || 'application/pdf',
          fileName: selectedFile.name,
          extractionType: activeExtractionType,
        }),
      });

      const result: OcrResponseData = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Falha ao processar o documento via IA.');
      }

      setExtractedPreview(result);
      setIsReviewing(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao processar extração por IA.');
    } finally {
      setIsLoading(false);
    }
  };

  // Confirmar e aplicar dados extraídos no formulário principal
  const handleConfirmAndApply = () => {
    if (extractedPreview) {
      onOcrExtracted(extractedPreview);
      setExtractedPreview(null);
      setIsReviewing(false);
    }
  };

  // Descartar pré-visualização e voltar
  const handleDiscardPreview = () => {
    setExtractedPreview(null);
    setIsReviewing(false);
  };

  const getExtractionLabel = (type: ExtractionType) => {
    switch (type) {
      case 'junta':
        return 'Junta Comercial (NIRE e Objeto Social)';
      case 'cadesp':
        return 'Inscrição Estadual (Cadesp)';
      case 'municipal':
        return 'Inscrição Municipal (FDC)';
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 transition-all">
      {/* Header do Card Fluxo 2 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-800">
              Fluxo 2: Extração Direcionada via IA (OCR PDF)
            </h2>
            <p className="text-xs text-slate-500">
              Extraia informações societárias ou tributárias do Contrato Social, CADESP ou FDC com pré-visualização
            </p>
          </div>
        </div>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
          Gemini 3.6 Flash
        </span>
      </div>

      {/* ======================================================== */}
      {/* MODO UPLOAD: Quando NÃO estamos em modo de pré-visualização */}
      {/* ======================================================== */}
      {!isReviewing && (
        <div className="space-y-4 animate-fadeIn">
          {/* Seletor de Tipo de Extração Direcionada */}
          <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80">
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center">
              <Filter className="w-3.5 h-3.5 mr-1.5 text-purple-600" />
              O que você deseja extrair deste documento?
            </label>
            <select
              value={activeExtractionType}
              onChange={(e) => handleSelectExtractionType(e.target.value as ExtractionType)}
              className="w-full text-xs font-medium p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 cursor-pointer text-slate-800"
            >
              <option value="junta">Junta Comercial (NIRE e Objeto Social)</option>
              <option value="cadesp">Inscrição Estadual (Cadesp)</option>
              <option value="municipal">Inscrição Municipal (FDC)</option>
            </select>
          </div>

          {/* Área de Drag & Drop */}
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${
              dragActive
                ? 'border-purple-500 bg-purple-50/50 scale-[0.99]'
                : selectedFile
                ? 'border-emerald-400 bg-emerald-50/20'
                : 'border-slate-300 hover:border-purple-400 bg-slate-50/40 hover:bg-slate-50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,image/png,image/jpeg,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />

            {selectedFile ? (
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-2">
                  <FileCheck className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-slate-800">{selectedFile.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB • {selectedFile.type || 'PDF'}
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                  }}
                  className="mt-2 text-xs text-rose-600 hover:underline cursor-pointer"
                >
                  Remover ou escolher outro arquivo
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center mb-2">
                  <Upload className="w-5 h-5" />
                </div>
                <p className="text-sm font-medium text-slate-700">
                  Arraste e solte seu arquivo PDF aqui, ou{' '}
                  <span className="text-purple-600 font-semibold underline">clique para navegar</span>
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Suporta Contrato Social, Ficha Cadastral da Junta Comercial, Cadesp ou FDC (PDF, PNG, JPG)
                </p>
              </div>
            )}
          </div>

          {/* Botões de Ação do Upload */}
          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={handleOcrProcess}
              disabled={isLoading || !selectedFile}
              className="inline-flex items-center px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 text-white font-medium text-xs rounded-lg shadow-xs hover:shadow transition-all duration-150 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Processando via IA...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Analisar e Extrair Dados
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* CARD DE REVISÃO (PREVIEW): Quando isReviewing for true */}
      {/* ======================================================== */}
      {isReviewing && extractedPreview && (
        <div className="space-y-4 animate-slideUp">
          <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-purple-200/80">
              <div className="flex items-center space-x-2">
                <FileSearch className="w-5 h-5 text-purple-700" />
                <div>
                  <h3 className="text-sm font-bold text-purple-950">
                    Pré-visualização dos Dados Extraídos
                  </h3>
                  <p className="text-xs text-purple-700">
                    Confira os dados identificados no documento antes de aplicar ao formulário
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-semibold bg-purple-100 text-purple-800 px-2.5 py-1 rounded-full border border-purple-200">
                Alvo: {getExtractionLabel(activeExtractionType)}
              </span>
            </div>

            {/* Resumo da Extração */}
            {extractedPreview.resumo_extracao && (
              <div className="text-xs bg-white p-3 rounded-lg border border-purple-100 text-slate-700">
                <span className="font-semibold text-purple-900 block mb-0.5">
                  Resumo da Leitura pela IA:
                </span>
                <p>{extractedPreview.resumo_extracao}</p>
              </div>
            )}

            {/* Grade de Campos Extraídos conforme o tipo selecionado */}
            <div className="space-y-3">
              {/* Seção 1: Junta Comercial */}
              {activeExtractionType === 'junta' && (
                <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
                  <span className="text-xs font-bold text-purple-900 flex items-center border-b border-slate-100 pb-1">
                    <Building2 className="w-3.5 h-3.5 mr-1 text-purple-600" /> Junta Comercial
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500 block">NIRE:</span>
                      <span className="font-mono font-bold text-purple-800 bg-purple-50 px-2 py-0.5 rounded inline-block">
                        {extractedPreview.nire || 'Não encontrado'}
                      </span>
                    </div>
                    <div className="md:col-span-2">
                      <span className="text-slate-500 block">Objeto Social:</span>
                      <p className="text-slate-800 font-medium line-clamp-3 bg-slate-50 p-2 rounded text-[11px]">
                        {extractedPreview.objeto_social || 'Não encontrado'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Seção 2: Endereço Encontrado (Condicional - Junta Comercial) */}
              {activeExtractionType === 'junta' && (() => {
                const end = extractedPreview.endereco || (extractedPreview as any);
                const logradouro = end?.logradouro || (extractedPreview as any).logradouro;
                const cep = end?.cep || (extractedPreview as any).cep;
                const numero = end?.numero !== undefined && end?.numero !== null ? String(end.numero) : ((extractedPreview as any).numero || '');
                const complemento = end?.complemento || (extractedPreview as any).complemento || '';
                const bairro = end?.bairro || (extractedPreview as any).bairro || '';
                const municipio = end?.municipio || (extractedPreview as any).municipio || '';
                const uf = end?.uf || (extractedPreview as any).uf || '';

                const hasEndereco = Boolean(logradouro || cep || municipio || bairro);

                if (!hasEndereco) return null;

                return (
                  <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
                    <span className="text-xs font-bold text-slate-800 flex items-center border-b border-slate-100 pb-1">
                      <MapPin className="w-3.5 h-3.5 mr-1 text-purple-600" /> Endereço Encontrado
                    </span>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                      <div>
                        <span className="text-slate-500 block">CEP:</span>
                        <span className="font-mono font-medium text-slate-800">{cep || '-'}</span>
                      </div>
                      <div className="md:col-span-2">
                        <span className="text-slate-500 block">Logradouro:</span>
                        <span className="font-medium text-slate-800">{logradouro || '-'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Número:</span>
                        <span className="font-medium text-slate-800">{numero || '-'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Complemento:</span>
                        <span className="font-medium text-slate-800">{complemento || '-'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Bairro:</span>
                        <span className="font-medium text-slate-800">{bairro || '-'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Município:</span>
                        <span className="font-medium text-slate-800">{municipio || '-'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">UF:</span>
                        <span className="font-mono font-semibold text-slate-800">{uf || '-'}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Seção 3: Sócios Encontrados (Condicional - Junta Comercial) */}
              {activeExtractionType === 'junta' && extractedPreview.socios && extractedPreview.socios.length > 0 && (
                <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
                  <span className="text-xs font-bold text-slate-800 flex items-center border-b border-slate-100 pb-1">
                    <Users className="w-3.5 h-3.5 mr-1 text-purple-600" /> Sócios Encontrados ({extractedPreview.socios.length})
                  </span>
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-12 gap-2 text-[11px] font-semibold text-slate-500 pb-1 border-b border-slate-100">
                      <div className="col-span-5">Nome do Sócio / Titular</div>
                      <div className="col-span-4">Documento (CPF/CNPJ)</div>
                      <div className="col-span-3">Qualificação / Capital</div>
                    </div>
                    {extractedPreview.socios.map((socio, idx) => {
                      const doc = socio.cpf_cnpj || (socio as any).documento || '-';
                      return (
                        <div key={idx} className="grid grid-cols-12 gap-2 text-xs py-1 items-center">
                          <div className="col-span-5 font-medium text-slate-800">
                            {socio.nome || 'Sócio sem nome'}
                          </div>
                          <div className="col-span-4 font-mono text-slate-600">
                            {doc}
                          </div>
                          <div className="col-span-3 text-slate-500 text-[11px]">
                            {socio.qualificacao || 'Sócio'}{socio.percentual_capital ? ` (${socio.percentual_capital})` : ''}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Seção 2: Inscrição Estadual (Cadesp) */}
              {activeExtractionType === 'cadesp' && (
                <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
                  <span className="text-xs font-bold text-emerald-900 flex items-center border-b border-slate-100 pb-1">
                    <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Inscrição Estadual (Cadesp)
                  </span>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500 block">Inscrição Estadual (IE):</span>
                      <span className="font-mono font-bold text-slate-800">
                        {extractedPreview.inscricao_estadual || 'Não encontrada'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Situação Cadastral:</span>
                      <span className="font-semibold text-slate-800">
                        {extractedPreview.ie_situacao_cadastral || 'Ativa'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Regime de Apuração:</span>
                      <span className="font-medium text-slate-800">
                        {extractedPreview.ie_regime_apuracao || 'RPA'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Data da Situação:</span>
                      <span className="font-medium text-slate-800">
                        {extractedPreview.ie_data_situacao || 'Não informada'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Seção 3: Inscrição Municipal (FDC) */}
              {activeExtractionType === 'municipal' && (
                <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
                  <span className="text-xs font-bold text-amber-900 flex items-center border-b border-slate-100 pb-1">
                    <Receipt className="w-3.5 h-3.5 mr-1 text-amber-600" /> Inscrição Municipal (FDC)
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500 block">Inscrição Municipal (IM / CCM):</span>
                      <span className="font-mono font-bold text-slate-800">
                        {extractedPreview.inscricao_municipal || 'Não encontrada'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Última Atualização Cadastral:</span>
                      <span className="font-medium text-slate-800">
                        {extractedPreview.data_atualizacao_ccm || extractedPreview.im_ultima_atualizacao || 'Exercício Corrente'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Botões de Ação da Pré-visualização */}
          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={handleDiscardPreview}
              className="inline-flex items-center px-4 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Descartar
            </button>

            <button
              type="button"
              onClick={handleConfirmAndApply}
              className="inline-flex items-center px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs hover:shadow transition-all cursor-pointer"
            >
              <Check className="w-4 h-4 mr-1.5" />
              Confirmar e Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

