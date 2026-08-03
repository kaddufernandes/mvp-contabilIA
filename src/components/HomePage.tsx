import React from 'react';
import {
  Building2,
  Sparkles,
  ShieldCheck,
  Search,
  FileCheck,
  Zap,
  ArrowRight,
  Database,
  CheckCircle2,
  FileSpreadsheet,
  Lock,
  Layers,
} from 'lucide-react';
import { EconomicIndicatorsWidget } from './EconomicIndicatorsWidget';

interface HomePageProps {
  onNavigate: (path: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  return (
    <div className="space-y-16 py-4 animate-fadeIn">
      {/* HERO SECTION */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white rounded-3xl p-8 sm:p-12 border border-slate-800 shadow-2xl">
        {/* Background Decorative Gradients */}
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -mb-12 -ml-12 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 max-w-3xl mx-auto text-center space-y-6">
          {/* Badge */}
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Contabilidade Inteligente & Automação Cadastral</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            O Futuro da <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-200">Contabilidade Inteligente</span>
          </h1>

          {/* Subtitle */}
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl mx-auto">
            O <strong>Contabil.IA</strong> automatiza a coleta, validação e estruturação de cadastros corporativos utilizando Inteligência Artificial de alta precisão, OCR para Contratos Sociais e consulta direta na Receita Federal.
          </p>

          {/* Trust points */}
          <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
            <div className="flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Consulta CNPJ BrasilAPI</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>OCR de PDFs com Gemini IA</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Visão em 4 Esferas Fiscais</span>
            </div>
          </div>
        </div>
      </section>

      {/* WIDGET DE INDICADORES ECONÔMICOS */}
      <section>
        <EconomicIndicatorsWidget />
      </section>

      {/* RECURSOS / FUNCIONALIDADES PRINCIPAIS */}
      <section className="space-y-8">
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Recursos da Plataforma Contabil<span className="text-emerald-600">.IA</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            Tudo o que seu escritório contábil precisa para realizar cadastros empresariais sem erros manuais.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1 */}
          <div className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all space-y-3 group">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl w-fit group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Busca Automática de CNPJ
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Consulte qualquer CNPJ na Receita Federal e obtenha Razão Social, endereço 100% completo, situação e CNAEs instantaneamente.
            </p>
          </div>

          {/* Card 2 */}
          <div className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all space-y-3 group">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl w-fit group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Leitura de PDFs via IA
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Faça upload do Contrato Social em PDF e nossa inteligência artificial extrai o NIRE, Objeto Social e Quadro Societário (QSA).
            </p>
          </div>

          {/* Card 3 */}
          <div className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all space-y-3 group">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl w-fit group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Organização em 4 Abas
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Visualização limpa e categorizada: Receita Federal (API), Junta Comercial (OCR), Inscrição Estadual (Cadesp) e Municipal (FDC).
            </p>
          </div>

          {/* Card 4 */}
          <div className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all space-y-3 group">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl w-fit group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <Database className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Exportação & Histórico
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Guarde os registros no histórico da aplicação e exporte a estrutura completa em JSON para integração com seu ERP contábil.
            </p>
          </div>
        </div>
      </section>

      {/* WORKFLOW / PASSO A PASSO */}
      <section className="bg-slate-50 border border-slate-200/80 rounded-3xl p-8 sm:p-10 space-y-8">
        <div className="text-center space-y-2 max-w-xl mx-auto">
          <h2 className="text-2xl font-extrabold text-slate-900">
            Como Funciona o Contabil<span className="text-emerald-600">.IA</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            Três passos simples para cadastrar e validar qualquer empresa
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 relative space-y-3">
            <span className="text-xs font-black bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full">
              Passo 1
            </span>
            <h3 className="text-sm font-bold text-slate-900">Consulta ou Envio de Documento</h3>
            <p className="text-xs text-slate-600">
              Digite o número do CNPJ para buscar os dados oficiais da Receita Federal ou envie o PDF do Contrato Social.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 relative space-y-3">
            <span className="text-xs font-black bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full">
              Passo 2
            </span>
            <h3 className="text-sm font-bold text-slate-900">Processamento Inteligente</h3>
            <p className="text-xs text-slate-600">
              Os dados são automaticamente mapeados e o endereço, CNAEs, sócios e dados tributários são preenchidos.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 relative space-y-3">
            <span className="text-xs font-black bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full">
              Passo 3
            </span>
            <h3 className="text-sm font-bold text-slate-900">Conferência & Salvamento</h3>
            <p className="text-xs text-slate-600">
              Navegue pelas 4 abas organizadas, revise o cadastro completo e salve no sistema ou baixe o arquivo JSON.
            </p>
          </div>
        </div>
      </section>

      {/* BANNER INFORMATIVO FINAL */}
      <section className="bg-gradient-to-r from-emerald-900 to-slate-900 rounded-3xl p-8 sm:p-10 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl border border-emerald-800/50">
        <div className="space-y-2 text-center md:text-left mx-auto md:mx-0">
          <h3 className="text-xl sm:text-2xl font-bold">
            Pronto para transformar a rotina do seu escritório?
          </h3>
          <p className="text-xs sm:text-sm text-emerald-200 max-w-xl">
            Acesse o formulário inteligente do Contabil.IA e experimente a velocidade do preenchimento automático.
          </p>
        </div>
      </section>
    </div>
  );
};