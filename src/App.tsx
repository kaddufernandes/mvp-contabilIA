import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { HomePage } from './components/HomePage';
import { CnpjSearch } from './components/CnpjSearch';
import { DocumentOcrUpload, ExtractionType } from './components/DocumentOcrUpload';
import { EmpresaForm, TabType } from './components/EmpresaForm';
import { ToastNotification, ToastMessage } from './components/ToastNotification';
import { SavedEmpresasDrawer } from './components/SavedEmpresasDrawer';
import { EmpresasDashboard } from './components/EmpresasDashboard';
import { DocumentFillForm } from './components/DocumentFillForm';
import { CreateDocumentForm } from './components/CreateDocumentForm';
import { FiscalSimulacaoForm } from './components/FiscalSimulacaoForm';
import { AcessoEcacForm } from './components/AcessoEcacForm';
import { HrSimulatorForm } from './components/HrSimulatorForm';
import { UsersManagement } from './components/UsersManagement';
import { LoginModal } from './components/LoginModal';
import { Providers } from './components/Providers';
import { useAuth } from './context/AuthContext';
import { getAuthHeaders } from './lib/apiClient';
import { salvarCadastroEmpresa } from './lib/firebase';
import { EmpresaData, OcrResponseData } from './types';
import { AlertCircle, FolderCheck, Plus } from 'lucide-react';

const INITIAL_EMPRESA_STATE: EmpresaData = {
  cnpj: '',
  razao_social: '',
  nome_fantasia: '',
  situacao_cadastral: 'Ativa',
  data_abertura: '',
  capital_social: '',
  natureza_juridica: '',
  regime_tributario: 'Simples Nacional',
  inscricao_estadual: '',
  ie_situacao_cadastral: 'Ativa',
  ie_regime_apuracao: 'Atribuição Normal - RPA',
  ie_data_situacao: '',
  inscricao_municipal: '',
  data_atualizacao_ccm: '',
  im_ultima_atualizacao: '',
  cnae_principal: {
    codigo: '',
    descricao: '',
  },
  cnaes_secundarios: [],
  nire: '',
  objeto_social: '',
  endereco: {
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    municipio: '',
    uf: '',
  },
  qsa: [],
  fonte_dados: {
    cnpj_api: false,
    ocr_ia: false,
  },
};

function AppContent() {
  const { status, data: session, openLoginModal } = useAuth();
  const isAuthenticated = status === 'authenticated' && !!session?.user;

  const [currentPath, setCurrentPath] = useState<string>(
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );
  const [empresa, setEmpresa] = useState<EmpresaData>(INITIAL_EMPRESA_STATE);
  const [savedEmpresas, setSavedEmpresas] = useState<EmpresaData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('receita');
  const [extractionType, setExtractionType] = useState<ExtractionType>('junta');

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    if (tab === 'junta') {
      setExtractionType('junta');
    } else if (tab === 'estadual') {
      setExtractionType('cadesp');
    } else if (tab === 'municipal') {
      setExtractionType('municipal');
    }
  };

  const handleExtractionTypeChange = (type: ExtractionType) => {
    setExtractionType(type);
    if (type === 'junta') {
      setActiveTab('junta');
    } else if (type === 'cadesp') {
      setActiveTab('estadual');
    } else if (type === 'municipal') {
      setActiveTab('municipal');
    }
  };

  // Protective Route Guarding
  useEffect(() => {
    if (status !== 'loading' && !isAuthenticated && currentPath !== '/') {
      window.history.pushState({}, '', '/');
      setCurrentPath('/');
      openLoginModal('Acesso Restrito: Faça login para acessar as ferramentas do sistema.');
    }
  }, [currentPath, isAuthenticated, status]);

  // Listener para navegação no histórico do navegador
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleNavigate = (path: string) => {
    if (!isAuthenticated && path !== '/') {
      openLoginModal(`Faça login para acessar "${path}".`);
      return;
    }

    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', path);
      setCurrentPath(path);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Carregar cadastros salvos previamente no localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('contabil_empresas');
      if (stored) {
        setSavedEmpresas(JSON.parse(stored));
      }
    } catch (e) {
      console.warn('Não foi possível ler cadastros do localStorage:', e);
    }
  }, []);

  // Salvar cadastros no localStorage ao atualizar
  const persistSavedEmpresas = (list: EmpresaData[]) => {
    setSavedEmpresas(list);
    try {
      localStorage.setItem('contabil_empresas', JSON.stringify(list));
    } catch (e) {
      console.warn('Erro ao salvar no localStorage:', e);
    }
  };

  const addToast = (title: string, message?: string, type: 'success' | 'error' | 'info' = 'success') => {
    const newToast: ToastMessage = {
      id: String(Date.now()),
      title,
      message,
      type,
    };
    setToasts((prev) => [...prev, newToast]);

    // Auto dismiss em 5 segundos
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
    }, 5000);
  };

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Callback ao carregar dados do CNPJ na Receita Federal (BrasilAPI)
  const handleCnpjDataLoaded = (data: Partial<EmpresaData>) => {
    setEmpresa((prev) => ({
      ...prev,
      ...data,
      // Preservar NIRE e Objeto Social se o usuário já tiver extraído via OCR previamente
      nire: prev.nire || data.nire || '',
      objeto_social: prev.objeto_social || data.objeto_social || '',
      endereco: {
        cep: data.endereco?.cep || (data as any).cep || prev.endereco.cep || '',
        logradouro: data.endereco?.logradouro || (data as any).logradouro || '',
        numero: data.endereco?.numero !== undefined && data.endereco?.numero !== null
          ? String(data.endereco.numero)
          : ((data as any).numero !== undefined && (data as any).numero !== null ? String((data as any).numero) : (prev.endereco.numero || '')),
        complemento: data.endereco?.complemento !== undefined && data.endereco?.complemento !== null
          ? String(data.endereco.complemento)
          : ((data as any).complemento !== undefined && (data as any).complemento !== null ? String((data as any).complemento) : (prev.endereco.complemento || '')),
        bairro: data.endereco?.bairro || (data as any).bairro || prev.endereco.bairro || '',
        municipio: data.endereco?.municipio || (data as any).municipio || prev.endereco.municipio || '',
        uf: data.endereco?.uf || (data as any).uf || prev.endereco.uf || '',
      },
      fonte_dados: {
        ...prev.fonte_dados,
        cnpj_api: true,
        data_consulta_api: new Date().toISOString(),
      },
    }));

    addToast(
      'Dados do CNPJ Importados!',
      `Razão Social: ${data.razao_social || 'Localizada na Receita Federal'}`
    );
  };

  // Callback ao extrair dados via OCR de PDF (IA Gemini)
  const handleOcrExtracted = (ocrData: OcrResponseData) => {
    setEmpresa((prev) => {
      const newEndereco = ocrData.endereco ? {
        logradouro: ocrData.endereco.logradouro || prev.endereco.logradouro || '',
        numero: ocrData.endereco.numero !== undefined && ocrData.endereco.numero !== null
          ? String(ocrData.endereco.numero)
          : (prev.endereco.numero || ''),
        complemento: ocrData.endereco.complemento !== undefined && ocrData.endereco.complemento !== null
          ? String(ocrData.endereco.complemento)
          : (prev.endereco.complemento || ''),
        bairro: ocrData.endereco.bairro || prev.endereco.bairro || '',
        municipio: ocrData.endereco.municipio || prev.endereco.municipio || '',
        uf: ocrData.endereco.uf || prev.endereco.uf || '',
        cep: ocrData.endereco.cep || prev.endereco.cep || '',
      } : prev.endereco;

      const newSocios = (ocrData.socios && ocrData.socios.length > 0)
        ? ocrData.socios.map((s: any) => ({
            nome: s.nome || '',
            qualificacao: s.qualificacao || 'Sócio-Administrador',
            cpf_cnpj: s.cpf_cnpj || s.documento || '',
            percentual_capital: s.percentual_capital !== undefined && s.percentual_capital !== null ? String(s.percentual_capital) : '',
          }))
        : prev.qsa;

      return {
        ...prev,
        nire: ocrData.nire || prev.nire || '',
        objeto_social: ocrData.objeto_social || prev.objeto_social || '',
        razao_social: prev.razao_social || ocrData.razao_social || '',
        nome_fantasia: prev.nome_fantasia || ocrData.nome_fantasia || '',
        cnpj: prev.cnpj || ocrData.cnpj || '',
        capital_social: prev.capital_social || ocrData.capital_social || '',
        data_abertura: prev.data_abertura || ocrData.data_abertura || '',
        natureza_juridica: prev.natureza_juridica || ocrData.natureza_juridica || '',
        inscricao_estadual: ocrData.inscricao_estadual || prev.inscricao_estadual || '',
        ie_situacao_cadastral: ocrData.ie_situacao_cadastral || prev.ie_situacao_cadastral || 'Ativa',
        ie_regime_apuracao: ocrData.ie_regime_apuracao || prev.ie_regime_apuracao || 'Atribuição Normal - RPA',
        ie_data_situacao: ocrData.ie_data_situacao || prev.ie_data_situacao || '',
        inscricao_municipal: ocrData.inscricao_municipal || prev.inscricao_municipal || '',
        data_atualizacao_ccm: ocrData.data_atualizacao_ccm || ocrData.im_ultima_atualizacao || prev.data_atualizacao_ccm || prev.im_ultima_atualizacao || '',
        im_ultima_atualizacao: ocrData.data_atualizacao_ccm || ocrData.im_ultima_atualizacao || prev.im_ultima_atualizacao || prev.data_atualizacao_ccm || '',
        endereco: newEndereco,
        qsa: newSocios,
        fonte_dados: {
          ...prev.fonte_dados,
          ocr_ia: true,
          data_extracao_ocr: new Date().toISOString(),
        },
      };
    });

    const camposExtraidosCount = ocrData.campos_identificados?.length || 0;
    addToast(
      'Extração via IA Concluída!',
      `Identificados ${camposExtraidosCount} campos no documento PDF, incluindo NIRE e Objeto Social.`,
      'success'
    );
  };

  // Salvar cadastro atual no Banco de Dados
  const handleSaveEmpresa = async () => {
    if (!empresa.razao_social.trim()) {
      setErrorMsg('Por favor, informe ao menos a Razão Social da empresa antes de salvar.');
      addToast('Atenção', 'A Razão Social é obrigatória para salvar o cadastro.', 'error');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      // 1. Salvar na coleção 'empresas' do Firestore com a estrutura aninhada NoSQL
      const docId = await salvarCadastroEmpresa(empresa);

      // 2. Salvar também via API local para manter o armazenamento e cache de arquivo sincronizados
      const response = await fetch('/api/companies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(empresa),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        console.warn('Aviso ao sincronizar via API local:', data.error);
      }

      const savedCompany = data.company || empresa;

      // Atualizar lista local de salvos
      const existingIndex = savedEmpresas.findIndex(
        (e) => (e.cnpj && savedCompany.cnpj && e.cnpj.replace(/\D/g, '') === savedCompany.cnpj.replace(/\D/g, '')) || e.id === savedCompany.id
      );

      let updatedList: EmpresaData[];
      if (existingIndex >= 0) {
        updatedList = [...savedEmpresas];
        updatedList[existingIndex] = savedCompany;
      } else {
        updatedList = [savedCompany, ...savedEmpresas];
      }

      persistSavedEmpresas(updatedList);

      // Disparar Toast de Sucesso
      addToast(
        'Empresa Cadastrada no Firestore!',
        `A empresa "${empresa.razao_social}" foi salva com sucesso na coleção 'empresas' (ID: ${docId}).`,
        'success'
      );

      // Redirecionar usuário para a tela /empresas
      handleNavigate('/empresas');
    } catch (err: any) {
      console.error('Erro ao salvar empresa:', err);
      setErrorMsg(err.message || 'Falha ao conectar com o banco de dados.');
      addToast('Erro ao Salvar', err.message || 'Não foi possível salvar a empresa.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Exportar JSON do formulário atual
  const handleExportJson = () => {
    const filename = `Cadastro_Empresa_${empresa.cnpj.replace(/\D/g, '') || 'Rascunho'}.json`;
    const jsonStr = JSON.stringify(empresa, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    addToast('JSON Gerado', `Arquivo ${filename} baixado com sucesso.`, 'info');
  };

  // Limpar formulário para novo cadastro
  const handleNewCadastro = () => {
    setEmpresa(INITIAL_EMPRESA_STATE);
    setErrorMsg(null);
    addToast('Novo Cadastro', 'Formulário redefinido para inserção de nova empresa.', 'info');
  };

  // Deletar empresa salva
  const handleDeleteEmpresa = (cnpj: string) => {
    const filtered = savedEmpresas.filter((e) => e.cnpj !== cnpj);
    persistSavedEmpresas(filtered);
    addToast('Cadastro Removido', 'A empresa foi excluída do histórico local.', 'info');
  };

  const isCadastroView = currentPath === '/cadastro-empresa' || currentPath.startsWith('/cadastro');

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 flex flex-col font-sans">
      {/* Header / Navbar Global */}
      <Header currentPath={currentPath} onNavigate={handleNavigate} />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {isCadastroView ? (
          /* TELA DE CADASTRO DE EMPRESA */
          <div className="space-y-6 animate-fadeIn">
            {/* Action Bar / Status Top Row */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
                <h2 className="text-sm font-bold text-slate-800">
                  Formulário de Entrada de Dados Cadastrais (Contabil.IA)
                </h2>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleNewCadastro}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Novo Cadastro
                </button>

                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(true)}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
                >
                  <FolderCheck className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                  Ver Histórico ({savedEmpresas.length})
                </button>
              </div>
            </div>

            {/* Banners de Erro */}
            {errorMsg && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center justify-between animate-fadeIn">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setErrorMsg(null)}
                  className="text-rose-500 hover:text-rose-800 text-xs font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {/* GRID DE ENTRADA DE DADOS: BUSCA CNPJ & IA OCR */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <CnpjSearch
                onDataLoaded={handleCnpjDataLoaded}
                isLoading={isLoading}
                setIsLoading={setIsLoading}
                setErrorMsg={setErrorMsg}
              />

              <DocumentOcrUpload
                onOcrExtracted={handleOcrExtracted}
                isLoading={isLoading}
                setIsLoading={setIsLoading}
                setErrorMsg={setErrorMsg}
                currentEmpresa={empresa}
                extractionType={extractionType}
                setExtractionType={handleExtractionTypeChange}
              />
            </div>

            {/* FORMULÁRIO PRINCIPAL COMPLETO DE DADOS SOCIETÁRIOS */}
            <EmpresaForm
              empresa={empresa}
              setEmpresa={setEmpresa}
              onSave={handleSaveEmpresa}
              onExportJson={handleExportJson}
              activeTab={activeTab}
              setActiveTab={handleTabChange}
            />
          </div>
        ) : currentPath === '/preenchimento-documentos' || currentPath.startsWith('/preenchimento') ? (
          /* TELA DE PREENCHIMENTO DE DOCUMENTOS PDF */
          <DocumentFillForm onNavigate={handleNavigate} />
        ) : currentPath === '/documentos/criar' || currentPath.startsWith('/documentos') ? (
          /* TELA DE GERAÇÃO DINÂMICA DE DOCUMENTOS (IA) */
          <CreateDocumentForm onNavigate={handleNavigate} initialCompany={empresa.cnpj ? empresa : null} />
        ) : currentPath === '/fiscal/acesso-ecac' || currentPath.startsWith('/fiscal/acesso-ecac') ? (
          /* TELA DE INTEGRAÇÃO E-CAC (GOV.BR) */
          <AcessoEcacForm onNavigate={handleNavigate} />
        ) : currentPath === '/fiscal/simulacao' || currentPath.startsWith('/fiscal') ? (
          /* TELA DE SIMULAÇÃO E AUDITORIA DO DAS (FISCAL) */
          <FiscalSimulacaoForm onNavigate={handleNavigate} />
        ) : currentPath === '/rh/calculos' || currentPath.startsWith('/rh') ? (
          /* TELA DE CÁLCULOS DE RH (SIMULADOR) */
          <HrSimulatorForm />
        ) : currentPath === '/usuarios' || currentPath.startsWith('/usuarios') ? (
          /* TELA DE GESTÃO DE USUÁRIOS (RBAC) */
          <UsersManagement onNavigate={handleNavigate} />
        ) : currentPath === '/empresas' || currentPath.startsWith('/empresas') ? (
          /* TELA DE CONSULTA DE EMPRESAS (DASHBOARD) */
          <EmpresasDashboard
            onNavigate={handleNavigate}
            onSelectEmpresa={(selected) => {
              setEmpresa(selected);
              handleNavigate('/cadastro-empresa');
              addToast('Empresa Carregada', `Cadastro de "${selected.razao_social}" aberto para edição.`, 'info');
            }}
          />
        ) : (
          /* TELA INICIAL (LANDING PAGE) */
          <HomePage onNavigate={handleNavigate} />
        )}
      </main>

      {/* Drawer de Cadastros Salvos */}
      <SavedEmpresasDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        empresas={savedEmpresas}
        onSelectEmpresa={(emp) => {
          setEmpresa(emp);
          handleNavigate('/cadastro-empresa');
          addToast('Cadastro Carregado', `Empresa "${emp.razao_social}" aberta para edição.`, 'info');
        }}
        onDeleteEmpresa={handleDeleteEmpresa}
      />

      {/* Modal de Autenticação / Login */}
      <LoginModal />

      {/* Toast Notifications */}
      <ToastNotification toasts={toasts} onDismiss={handleDismissToast} />

      {/* Footer */}
      <footer className="mt-auto bg-slate-900 text-slate-400 text-xs border-t border-slate-800 py-6 text-center">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="font-medium text-slate-300">
            Contabil<span className="text-emerald-500 font-bold">.IA</span> — Plataforma de Contabilidade Inteligente
          </p>
          <p className="text-slate-500">
            Automação Cadastral com Receita Federal & Google Gemini IA
          </p>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <Providers>
      <AppContent />
    </Providers>
  );
}