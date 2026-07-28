import React, { useState } from 'react';
import {
  Building2,
  FileText,
  MapPin,
  Briefcase,
  Users,
  Plus,
  Trash2,
  Sparkles,
  Save,
  Download,
  HelpCircle,
  CheckCircle2,
  ShieldCheck,
  Receipt,
  Landmark,
} from 'lucide-react';
import { EmpresaData, Socio } from '../types';

export type TabType = 'receita' | 'junta' | 'estadual' | 'municipal';

interface EmpresaFormProps {
  empresa: EmpresaData;
  setEmpresa: React.Dispatch<React.SetStateAction<EmpresaData>>;
  onSave: () => void;
  onExportJson: () => void;
  activeTab?: TabType;
  setActiveTab?: (tab: TabType) => void;
}

export const EmpresaForm: React.FC<EmpresaFormProps> = ({
  empresa,
  setEmpresa,
  onSave,
  onExportJson,
  activeTab: propActiveTab,
  setActiveTab: propSetActiveTab,
}) => {
  const [internalActiveTab, setInternalActiveTab] = useState<TabType>('receita');
  const activeTab = propActiveTab !== undefined ? propActiveTab : internalActiveTab;

  const handleTabChange = (tab: TabType) => {
    if (propSetActiveTab) {
      propSetActiveTab(tab);
    } else {
      setInternalActiveTab(tab);
    }
  };

  // Atualizar campo simples do objeto empresa
  const handleSimpleChange = (field: keyof EmpresaData, value: any) => {
    setEmpresa((prev) => ({
      ...prev,
      [field]: value,
      fonte_dados: {
        ...prev.fonte_dados,
        modificado_manual: true,
      },
    }));
  };

  // Atualizar campo de endereço
  const handleEnderecoChange = (field: keyof EmpresaData['endereco'], value: string) => {
    setEmpresa((prev) => ({
      ...prev,
      endereco: {
        ...prev.endereco,
        [field]: value,
      },
      fonte_dados: {
        ...prev.fonte_dados,
        modificado_manual: true,
      },
    }));
  };

  // CNAE Principal
  const handleCnaePrincipalChange = (field: 'codigo' | 'descricao', value: string) => {
    setEmpresa((prev) => ({
      ...prev,
      cnae_principal: {
        ...prev.cnae_principal,
        [field]: value,
      },
    }));
  };

  // CNAE Secundário - Adicionar
  const handleAddCnaeSecundario = () => {
    setEmpresa((prev) => ({
      ...prev,
      cnaes_secundarios: [
        ...prev.cnaes_secundarios,
        { codigo: '', descricao: '' },
      ],
    }));
  };

  // CNAE Secundário - Modificar
  const handleCnaeSecundarioChange = (index: number, field: 'codigo' | 'descricao', value: string) => {
    setEmpresa((prev) => {
      const updated = [...prev.cnaes_secundarios];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, cnaes_secundarios: updated };
    });
  };

  // CNAE Secundário - Remover
  const handleRemoveCnaeSecundario = (index: number) => {
    setEmpresa((prev) => ({
      ...prev,
      cnaes_secundarios: prev.cnaes_secundarios.filter((_, i) => i !== index),
    }));
  };

  // Sócio - Adicionar
  const handleAddSocio = () => {
    setEmpresa((prev) => ({
      ...prev,
      qsa: [
        ...prev.qsa,
        { nome: '', qualificacao: 'Sócio-Administrador', cpf_cnpj: '', percentual_capital: '' },
      ],
    }));
  };

  // Sócio - Modificar
  const handleSocioChange = (index: number, field: keyof Socio, value: string) => {
    setEmpresa((prev) => {
      const updated = [...prev.qsa];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, qsa: updated };
    });
  };

  // Sócio - Remover
  const handleRemoveSocio = (index: number) => {
    setEmpresa((prev) => ({
      ...prev,
      qsa: prev.qsa.filter((_, i) => i !== index),
    }));
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
      {/* Tab Navigation Bar - APENAS 4 ABAS PRINCIPAIS */}
      <div className="border-b border-slate-200 bg-slate-50/70 p-2 flex flex-wrap gap-1">
        {/* Aba 1: Receita Federal */}
        <button
          type="button"
          onClick={() => handleTabChange('receita')}
          className={`flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeTab === 'receita'
              ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Landmark className="w-4 h-4 text-blue-600" />
          <span>Receita Federal (API)</span>
          {empresa.fonte_dados?.cnpj_api && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 ml-1"></span>
          )}
        </button>

        {/* Aba 2: Junta Comercial */}
        <button
          type="button"
          onClick={() => handleTabChange('junta')}
          className={`flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeTab === 'junta'
              ? 'bg-white text-purple-700 shadow-xs border border-slate-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-4 h-4 text-purple-600" />
          <span>Junta Comercial (OCR)</span>
          {empresa.nire && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 ml-1"></span>
          )}
        </button>

        {/* Aba 3: Inscrição Estadual (Cadesp) */}
        <button
          type="button"
          onClick={() => handleTabChange('estadual')}
          className={`flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeTab === 'estadual'
              ? 'bg-white text-emerald-700 shadow-xs border border-slate-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Inscrição Estadual (Cadesp)</span>
          {empresa.inscricao_estadual && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 ml-1"></span>
          )}
        </button>

        {/* Aba 4: Inscrição Municipal (FDC) */}
        <button
          type="button"
          onClick={() => handleTabChange('municipal')}
          className={`flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeTab === 'municipal'
              ? 'bg-white text-amber-700 shadow-xs border border-slate-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Receipt className="w-4 h-4 text-amber-600" />
          <span>Inscrição Municipal (FDC)</span>
          {empresa.inscricao_municipal && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 ml-1"></span>
          )}
        </button>
      </div>

      {/* FORM BODY */}
      <div className="p-6">
        {/* ======================================================== */}
        {/* ABA 1: RECEITA FEDERAL (IDENTIFICAÇÃO E CNAE) */}
        {/* ======================================================== */}
        {activeTab === 'receita' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-800 flex items-center">
                  <Landmark className="w-5 h-5 text-blue-600 mr-2" />
                  Dados da Receita Federal (Esfera Federal - BrasilAPI)
                </h3>
                <p className="text-xs text-slate-500">
                  Identificação, situação cadastral e atividades econômicas (CNAE)
                </p>
              </div>
              {empresa.fonte_dados?.cnpj_api && (
                <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Sincronizado via Receita Federal
                </span>
              )}
            </div>

            {/* SEÇÃO 1: IDENTIFICAÇÃO DA EMPRESA */}
            <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200 space-y-4">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center text-blue-900">
                <Building2 className="w-4 h-4 mr-1.5 text-blue-600" />
                1. Identificação e Situação Cadastral
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    CNPJ
                  </label>
                  <input
                    type="text"
                    value={empresa.cnpj || ''}
                    onChange={(e) => handleSimpleChange('cnpj', e.target.value)}
                    placeholder="00.000.000/0000-00"
                    className="w-full text-xs font-mono p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-semibold"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Razão Social <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={empresa.razao_social || ''}
                    onChange={(e) => handleSimpleChange('razao_social', e.target.value)}
                    placeholder="Nome oficial da empresa registrado na Receita Federal"
                    className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nome Fantasia
                  </label>
                  <input
                    type="text"
                    value={empresa.nome_fantasia || ''}
                    onChange={(e) => handleSimpleChange('nome_fantasia', e.target.value)}
                    placeholder="Nome comercial/marca da empresa"
                    className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Data de Abertura
                  </label>
                  <input
                    type="text"
                    value={empresa.data_abertura || ''}
                    onChange={(e) => handleSimpleChange('data_abertura', e.target.value)}
                    placeholder="AAAA-MM-DD ou DD/MM/AAAA"
                    className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Capital Social (R$)
                  </label>
                  <input
                    type="text"
                    value={empresa.capital_social ?? ''}
                    onChange={(e) => handleSimpleChange('capital_social', e.target.value)}
                    placeholder="Ex: 50000.00"
                    className="w-full text-xs font-mono p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Situação Cadastral
                  </label>
                  <select
                    value={empresa.situacao_cadastral || 'Ativa'}
                    onChange={(e) => handleSimpleChange('situacao_cadastral', e.target.value)}
                    className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium"
                  >
                    <option value="Ativa">Ativa</option>
                    <option value="Suspensa">Suspensa</option>
                    <option value="Inapta">Inapta</option>
                    <option value="Baixada">Baixada</option>
                    <option value="Nula">Nula</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Regime Tributário
                  </label>
                  <select
                    value={empresa.regime_tributario || 'Simples Nacional'}
                    onChange={(e) => handleSimpleChange('regime_tributario', e.target.value)}
                    className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Simples Nacional">Simples Nacional</option>
                    <option value="Lucro Presumido">Lucro Presumido</option>
                    <option value="Lucro Real">Lucro Real</option>
                    <option value="MEI">MEI (Microempreendedor)</option>
                  </select>
                </div>

                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Natureza Jurídica
                  </label>
                  <input
                    type="text"
                    value={empresa.natureza_juridica || ''}
                    onChange={(e) => handleSimpleChange('natureza_juridica', e.target.value)}
                    placeholder="Ex: 206-2 - Sociedade Empresária Limitada"
                    className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* SEÇÃO 2: ATIVIDADES ECONÔMICAS (CNAE) */}
            <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200 space-y-4">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center text-blue-900">
                <Briefcase className="w-4 h-4 mr-1.5 text-blue-600" />
                2. Atividades Econômicas (CNAE)
              </h4>

              {/* CNAE Principal */}
              <div className="p-3.5 bg-white border border-blue-200 rounded-xl space-y-3">
                <span className="text-xs font-bold text-blue-900 block">
                  CNAE Principal (Atividade Primária)
                </span>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Código CNAE
                    </label>
                    <input
                      type="text"
                      value={empresa.cnae_principal.codigo || ''}
                      onChange={(e) => handleCnaePrincipalChange('codigo', e.target.value)}
                      placeholder="Ex: 6920-6/01"
                      className="w-full text-xs font-mono p-2 bg-white border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Descrição da Atividade
                    </label>
                    <input
                      type="text"
                      value={empresa.cnae_principal.descricao || ''}
                      onChange={(e) => handleCnaePrincipalChange('descricao', e.target.value)}
                      placeholder="Ex: Atividades de contabilidade"
                      className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* CNAEs Secundários */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    CNAEs Secundários ({empresa.cnaes_secundarios.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleAddCnaeSecundario}
                    className="inline-flex items-center text-xs text-blue-600 font-semibold hover:underline cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar Atividade Secundária
                  </button>
                </div>

                {empresa.cnaes_secundarios.length === 0 ? (
                  <p className="text-xs text-slate-400 italic bg-white p-3 rounded-lg border border-slate-200">
                    Nenhuma atividade secundária cadastrada.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {empresa.cnaes_secundarios.map((cnae, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200">
                        <input
                          type="text"
                          value={cnae.codigo || ''}
                          onChange={(e) => handleCnaeSecundarioChange(idx, 'codigo', e.target.value)}
                          placeholder="Código CNAE"
                          className="w-32 text-xs font-mono p-2 bg-white border border-slate-300 rounded-lg"
                        />
                        <input
                          type="text"
                          value={cnae.descricao || ''}
                          onChange={(e) => handleCnaeSecundarioChange(idx, 'descricao', e.target.value)}
                          placeholder="Descrição da atividade secundária"
                          className="flex-1 text-xs p-2 bg-white border border-slate-300 rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveCnaeSecundario(idx)}
                          className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Remover CNAE"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* ABA 2: JUNTA COMERCIAL (REGISTRO, ENDEREÇO E QSA VIA OCR) */}
        {/* ======================================================== */}
        {activeTab === 'junta' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center">
                  Dados da Junta Comercial (Esfera Estadual - OCR / Contrato Social)
                </h3>
                <p className="text-xs text-slate-500">
                  NIRE, Objeto Social, Endereço Comercial Sede e Quadro de Sócios (QSA)
                </p>
              </div>

              {empresa.fonte_dados?.ocr_ia && (
                <span className="text-[11px] font-semibold bg-purple-100 text-purple-800 px-2.5 py-1 rounded-full border border-purple-200 flex items-center">
                  <Sparkles className="w-3.5 h-3.5 mr-1" /> Extraído via OCR / IA
                </span>
              )}
            </div>

            <div className="p-3.5 bg-purple-50/80 border border-purple-200 rounded-xl text-xs text-purple-900 flex items-start space-x-2">
              <HelpCircle className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Origem dos Dados (Junta Comercial):</p>
                <p>
                  O <strong>NIRE</strong>, <strong>Objeto Social</strong>, <strong>Endereço Comercial</strong> e o <strong>Quadro de Sócios (QSA)</strong> são extraídos da Ficha Cadastral Simplificada ou Contrato Social enviado via upload de PDF (OCR).
                </p>
              </div>
            </div>

            {/* SEÇÃO 1: REGISTRO SOCIETÁRIO */}
            <div className="p-4 bg-purple-50/30 rounded-xl border border-purple-100 space-y-4">
              <h4 className="text-xs font-bold text-purple-900 uppercase tracking-wider flex items-center">
                <FileText className="w-4 h-4 mr-1.5 text-purple-600" />
                1. Identificação Societária (NIRE e Objeto Social)
              </h4>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      NIRE (Número de Identificação do Registro de Empresas)
                    </label>
                    {empresa.nire && (
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-mono font-bold">
                        Identificado
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={empresa.nire || ''}
                    onChange={(e) => handleSimpleChange('nire', e.target.value)}
                    placeholder="Ex: 35212345678 (11 dígitos da Junta Comercial)"
                    className="w-full text-xs font-mono p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 font-semibold text-purple-950"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      Objeto Social (Atividades detalhadas conforme Estatuto/Contrato)
                    </label>
                    {empresa.objeto_social && (
                      <span className="text-[10px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-semibold">
                        Cláusula Registrada
                      </span>
                    )}
                  </div>
                  <textarea
                    rows={4}
                    value={empresa.objeto_social || ''}
                    onChange={(e) => handleSimpleChange('objeto_social', e.target.value)}
                    placeholder="Descreva o objeto social completo registrado na Junta Comercial..."
                    className="w-full text-xs p-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 leading-relaxed font-sans"
                  />
                </div>
              </div>
            </div>

            {/* SEÇÃO 2: ENDEREÇO COMERCIAL / SEDE DA EMPRESA */}
            <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200 space-y-4">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center text-purple-900">
                <MapPin className="w-4 h-4 mr-1.5 text-purple-600" />
                2. Endereço Comercial / Sede da Empresa (Junta Comercial)
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    CEP
                  </label>
                  <input
                    type="text"
                    value={empresa.endereco.cep || ''}
                    onChange={(e) => handleEnderecoChange('cep', e.target.value)}
                    placeholder="00000-000"
                    className="w-full text-xs font-mono p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Logradouro (Rua, Avenida, Alameda)
                  </label>
                  <input
                    type="text"
                    value={empresa.endereco.logradouro || ''}
                    onChange={(e) => handleEnderecoChange('logradouro', e.target.value)}
                    placeholder="Ex: Av. Paulista"
                    className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Número
                  </label>
                  <input
                    type="text"
                    value={empresa.endereco.numero || ''}
                    onChange={(e) => handleEnderecoChange('numero', e.target.value)}
                    placeholder="Ex: 1000 ou S/N"
                    className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Complemento
                  </label>
                  <input
                    type="text"
                    value={empresa.endereco.complemento || ''}
                    onChange={(e) => handleEnderecoChange('complemento', e.target.value)}
                    placeholder="Ex: Sala 101, Bloco B"
                    className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Bairro
                  </label>
                  <input
                    type="text"
                    value={empresa.endereco.bairro || ''}
                    onChange={(e) => handleEnderecoChange('bairro', e.target.value)}
                    placeholder="Ex: Centro"
                    className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Município
                  </label>
                  <input
                    type="text"
                    value={empresa.endereco.municipio || ''}
                    onChange={(e) => handleEnderecoChange('municipio', e.target.value)}
                    placeholder="Ex: São Paulo"
                    className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    UF (Estado)
                  </label>
                  <input
                    type="text"
                    value={empresa.endereco.uf || ''}
                    onChange={(e) => handleEnderecoChange('uf', e.target.value.toUpperCase())}
                    placeholder="SP"
                    maxLength={2}
                    className="w-full text-xs uppercase font-mono p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
            </div>

            {/* SEÇÃO 3: QUADRO DE SÓCIOS E ADMINISTRADORES (QSA) */}
            <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between pb-1">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center text-purple-900">
                  <Users className="w-4 h-4 mr-1.5 text-purple-600" />
                  3. Quadro de Sócios e Administradores (QSA)
                </h4>

                <button
                  type="button"
                  onClick={handleAddSocio}
                  className="inline-flex items-center px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar Sócio
                </button>
              </div>

              {empresa.qsa.length === 0 ? (
                <div className="text-center p-6 bg-white rounded-xl border border-dashed border-slate-300">
                  <Users className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs text-slate-600 font-medium">Nenhum sócio informado no quadro societário.</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Envie a Ficha Cadastral Simplificada ou Contrato Social em PDF para extrair os sócios via OCR.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto bg-white rounded-lg border border-slate-200">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-semibold">
                        <th className="p-2.5 border-b border-slate-200">Nome do Sócio / Titular</th>
                        <th className="p-2.5 border-b border-slate-200">Qualificação / Cargo</th>
                        <th className="p-2.5 border-b border-slate-200">CPF / CNPJ</th>
                        <th className="p-2.5 border-b border-slate-200">% Capital</th>
                        <th className="p-2.5 border-b border-slate-200 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {empresa.qsa.map((socio, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80">
                          <td className="p-2">
                            <input
                              type="text"
                              value={socio.nome || ''}
                              onChange={(e) => handleSocioChange(idx, 'nome', e.target.value)}
                              placeholder="Nome Completo do Sócio"
                              className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 font-medium"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={socio.qualificacao || ''}
                              onChange={(e) => handleSocioChange(idx, 'qualificacao', e.target.value)}
                              placeholder="Ex: Sócio-Administrador"
                              className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={socio.cpf_cnpj || ''}
                              onChange={(e) => handleSocioChange(idx, 'cpf_cnpj', e.target.value)}
                              placeholder="000.000.000-00"
                              className="w-full text-xs font-mono p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                            />
                          </td>
                          <td className="p-2 w-28">
                            <input
                              type="text"
                              value={socio.percentual_capital || ''}
                              onChange={(e) => handleSocioChange(idx, 'percentual_capital', e.target.value)}
                              placeholder="Ex: 50%"
                              className="w-full text-xs font-mono p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                            />
                          </td>
                          <td className="p-2 text-center w-12">
                            <button
                              type="button"
                              onClick={() => handleRemoveSocio(idx)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Remover sócio"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* ABA 3: INSCRIÇÃO ESTADUAL (CADESP / FISCAL ESTADUAL) */}
        {/* ======================================================== */}
        {activeTab === 'estadual' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center">
                  Inscrição Estadual (Esfera Estadual - Cadesp / SEFAZ)
                </h3>
                <p className="text-xs text-slate-500">
                  Dados do Cadastro de Contribuintes do ICMS do Estado
                </p>
              </div>

              <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center">
                <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Cadesp
              </span>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 flex items-start space-x-2">
              <HelpCircle className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
              <p>
                Informações tributárias do ICMS para emissão de Notas Fiscais Eletrônicas de Mercadorias (NF-e). Podem ser preenchidas via OCR do comprovante do CADESP.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Inscrição Estadual (IE)
                </label>
                <input
                  type="text"
                  value={empresa.inscricao_estadual || ''}
                  onChange={(e) => handleSimpleChange('inscricao_estadual', e.target.value)}
                  placeholder="Ex: 123.456.789.000 ou ISENTO"
                  className="w-full text-xs font-mono p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Situação Cadastral (IE)
                </label>
                <select
                  value={empresa.ie_situacao_cadastral || 'Ativa'}
                  onChange={(e) => handleSimpleChange('ie_situacao_cadastral', e.target.value)}
                  className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="Ativa">Ativa</option>
                  <option value="Inativa / Baixada">Inativa / Baixada</option>
                  <option value="Suspensa">Suspensa</option>
                  <option value="Cassada / Cancelada">Cassada / Cancelada</option>
                  <option value="Isento de IE">Isento de IE</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Regime de Apuração
                </label>
                <input
                  type="text"
                  value={empresa.ie_regime_apuracao || ''}
                  onChange={(e) => handleSimpleChange('ie_regime_apuracao', e.target.value)}
                  placeholder="Ex: RPA, Simples Nacional, MEI"
                  className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Data da Situação Cadastral (IE)
                </label>
                <input
                  type="text"
                  value={empresa.ie_data_situacao || ''}
                  onChange={(e) => handleSimpleChange('ie_data_situacao', e.target.value)}
                  placeholder="DD/MM/AAAA"
                  className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* ABA 4: INSCRIÇÃO MUNICIPAL (FDC / PREFEITURA) */}
        {/* ======================================================== */}
        {activeTab === 'municipal' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center">
                  Inscrição Municipal (Esfera Municipal - FDC / CCM)
                </h3>
                <p className="text-xs text-slate-500">
                  Dados do Cadastro de Contribuintes Mobiliários da Prefeitura
                </p>
              </div>

              <span className="text-[11px] font-semibold bg-amber-50 text-amber-800 px-2.5 py-1 rounded-full border border-amber-200 flex items-center">
                <Receipt className="w-3.5 h-3.5 mr-1 text-amber-600" /> FDC / CCM
              </span>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 flex items-start space-x-2">
              <HelpCircle className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
              <p>
                Inscrição referente ao ISS (Imposto Sobre Serviços) e Alvará de Funcionamento da Prefeitura. Podem ser preenchidas via OCR da Ficha de Dados Cadastrais (FDC).
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Inscrição Municipal (IM / CCM)
                </label>
                <input
                  type="text"
                  value={empresa.inscricao_municipal || ''}
                  onChange={(e) => handleSimpleChange('inscricao_municipal', e.target.value)}
                  placeholder="Ex: 9.876.543-2 ou CCM"
                  className="w-full text-xs font-mono p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 font-semibold text-amber-950"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Última Atualização Cadastral (FDC)
                </label>
                <input
                  type="text"
                  value={empresa.data_atualizacao_ccm || empresa.im_ultima_atualizacao || ''}
                  onChange={(e) => {
                    handleSimpleChange('data_atualizacao_ccm', e.target.value);
                    handleSimpleChange('im_ultima_atualizacao', e.target.value);
                  }}
                  placeholder="DD/MM/AAAA ou Exercício Corrente"
                  className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* FORM FOOTER & SAVE ACTIONS */}
      <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-500 flex items-center space-x-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>
            {empresa.razao_social
              ? `Empresa: ${empresa.razao_social.slice(0, 35)}...`
              : 'Nenhuma empresa selecionada'}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={onExportJson}
            className="inline-flex items-center px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" /> Exportar JSON
          </button>

          <button
            type="button"
            onClick={onSave}
            className="inline-flex items-center px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm hover:shadow transition-all cursor-pointer"
          >
            <Save className="w-4 h-4 mr-1.5" /> Salvar Cadastro da Empresa
          </button>
        </div>
      </div>
    </div>
  );
};
