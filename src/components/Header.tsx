import React, { useState, useRef, useEffect } from 'react';
import {
  Calculator,
  Building2,
  Folder,
  Users,
  Sparkles,
  ShieldCheck,
  Scale,
  Receipt,
  ChevronDown,
  Wand2,
  FileCheck2,
  LogIn,
  LogOut,
  Landmark,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from './ui/button';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  currentPath?: string;
  onNavigate?: (path: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentPath = '/', onNavigate }) => {
  const { data: session, status, signOut, openLoginModal } = useAuth();
  const [isCadastrosOpen, setIsCadastrosOpen] = useState(false);
  const [isJuridicoOpen, setIsJuridicoOpen] = useState(false);
  const [isFiscalOpen, setIsFiscalOpen] = useState(false);
  const [isRhOpen, setIsRhOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  
  const cadastrosRef = useRef<HTMLDivElement>(null);
  const juridicoRef = useRef<HTMLDivElement>(null);
  const fiscalRef = useRef<HTMLDivElement>(null);
  const rhRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const isAuthenticated = status === 'authenticated' && !!session?.user;

  const handleNav = (path: string, e: React.MouseEvent) => {
    e.preventDefault();
    setIsCadastrosOpen(false);
    setIsJuridicoOpen(false);
    setIsFiscalOpen(false);
    setIsRhOpen(false);
    setIsProfileOpen(false);

    if (!isAuthenticated && path !== '/') {
      openLoginModal(`Faça login para acessar a área "${path}".`);
      return;
    }

    if (onNavigate) {
      onNavigate(path);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (cadastrosRef.current && !cadastrosRef.current.contains(event.target as Node)) {
        setIsCadastrosOpen(false);
      }
      if (juridicoRef.current && !juridicoRef.current.contains(event.target as Node)) {
        setIsJuridicoOpen(false);
      }
      if (fiscalRef.current && !fiscalRef.current.contains(event.target as Node)) {
        setIsFiscalOpen(false);
      }
      if (rhRef.current && !rhRef.current.contains(event.target as Node)) {
        setIsRhOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isEmpresas = currentPath === '/' || currentPath === '/empresas' || currentPath.startsWith('/empresas');
  const isUsuarios = currentPath === '/usuarios' || currentPath.startsWith('/usuarios');
  const isCadastros = isEmpresas || isUsuarios;

  const isJuridico =
    currentPath === '/preenchimento-documentos' ||
    currentPath.startsWith('/preenchimento') ||
    currentPath === '/documentos/criar' ||
    currentPath.startsWith('/documentos');

  const isFiscal = currentPath.startsWith('/fiscal');
  const isRh = currentPath.startsWith('/rh');

  const isPreenchimento = currentPath === '/preenchimento-documentos' || currentPath.startsWith('/preenchimento');
  const isCriarDocumento = currentPath === '/documentos/criar' || currentPath.startsWith('/documentos');
  const isAcessoEcac = currentPath === '/fiscal/acesso-ecac' || currentPath.startsWith('/fiscal/acesso-ecac');
  const isRhCalculos = currentPath === '/rh/calculos' || currentPath.startsWith('/rh/calculos');

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 shadow-lg sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        {/* Brand Logo & Name */}
        <div className="flex items-center space-x-3">
          <Link
            href="/"
            onClick={(e) => handleNav('/', e)}
            className="flex items-center space-x-3 group cursor-pointer"
          >
            <div className="p-2.5 bg-emerald-600 group-hover:bg-emerald-500 rounded-xl shadow-inner text-white flex items-center justify-center transition-colors">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-white flex items-center">
                Contabil<span className="text-emerald-500 font-black">.IA</span>
              </h1>
              <p className="text-[11px] text-slate-400 font-medium leading-none mt-0.5">
                Contabilidade Inteligente
              </p>
            </div>
          </Link>
        </div>

        {/* Navigation Links */}
        {isAuthenticated ? (
          <nav className="flex items-center space-x-1 sm:space-x-2">
            {/* Cadastros */}
            <div className="relative" ref={cadastrosRef}>
              <button
                type="button"
                onClick={() => {
                  setIsCadastrosOpen(!isCadastrosOpen);
                  setIsJuridicoOpen(false);
                  setIsFiscalOpen(false);
                  setIsRhOpen(false);
                }}
                className={`inline-flex items-center justify-center px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isCadastros
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs ring-2 ring-emerald-500/30'
                    : 'bg-transparent text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Folder className={`w-4 h-4 mr-1.5 ${isCadastros ? 'text-white' : 'text-emerald-400'}`} />
                <span>Cadastros</span>
                <ChevronDown className={`w-3.5 h-3.5 ml-1.5 transition-transform duration-200 ${isCadastrosOpen ? 'rotate-180' : ''}`} />
              </button>

              {isCadastrosOpen && (
                <div className="absolute left-0 mt-2 w-64 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl py-2 z-50 animate-fadeIn">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700/60 mb-1">
                    Gestão de Cadastros
                  </div>

                  <Link
                    href="/empresas"
                    onClick={(e) => handleNav('/empresas', e)}
                    className={`flex items-center space-x-3 px-3.5 py-2.5 mx-1 rounded-xl text-xs font-semibold transition-colors ${
                      isEmpresas && !isUsuarios
                        ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 font-bold'
                        : 'text-slate-200 hover:bg-slate-700/80 hover:text-white'
                    }`}
                  >
                    <div className="p-1.5 bg-slate-700 rounded-lg text-emerald-400">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="block text-slate-100 font-bold">Empresas</span>
                      <span className="block text-[10px] text-slate-400 font-normal">Consulta e cadastro de empresas</span>
                    </div>
                  </Link>

                  {session?.user?.role === 'ADMIN' && (
                    <Link
                      href="/usuarios"
                      onClick={(e) => handleNav('/usuarios', e)}
                      className={`flex items-center space-x-3 px-3.5 py-2.5 mx-1 mt-1 rounded-xl text-xs font-semibold transition-colors ${
                        isUsuarios
                          ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 font-bold'
                          : 'text-slate-200 hover:bg-slate-700/80 hover:text-white'
                      }`}
                    >
                      <div className="p-1.5 bg-emerald-500/20 rounded-lg text-emerald-300">
                        <Users className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="block text-slate-100 font-bold flex items-center gap-1.5">
                          Usuários
                          <span className="px-1.5 py-0.2 bg-amber-500/30 text-amber-300 text-[9px] rounded-md font-bold">ADMIN</span>
                        </span>
                        <span className="block text-[10px] text-slate-400 font-normal">Gestão e controle de permissões</span>
                      </div>
                    </Link>
                  )}
                </div>
              )}
            </div>

            {/* Jurídico */}
            <div className="relative" ref={juridicoRef}>
              <button
                type="button"
                onClick={() => {
                  setIsJuridicoOpen(!isJuridicoOpen);
                  setIsCadastrosOpen(false);
                  setIsFiscalOpen(false);
                  setIsRhOpen(false);
                }}
                className={`inline-flex items-center justify-center px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isJuridico
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs ring-2 ring-emerald-500/30'
                    : 'bg-transparent text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Scale className={`w-4 h-4 mr-1.5 ${isJuridico ? 'text-white' : 'text-emerald-400'}`} />
                <span>Jurídico</span>
                <ChevronDown className={`w-3.5 h-3.5 ml-1.5 transition-transform duration-200 ${isJuridicoOpen ? 'rotate-180' : ''}`} />
              </button>

              {isJuridicoOpen && (
                <div className="absolute left-0 mt-2 w-64 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl py-2 z-50 animate-fadeIn">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700/60 mb-1">
                    Gerenciamento de Documentos
                  </div>

                  <Link
                    href="/preenchimento-documentos"
                    onClick={(e) => handleNav('/preenchimento-documentos', e)}
                    className={`flex items-center space-x-3 px-3.5 py-2.5 mx-1 rounded-xl text-xs font-semibold transition-colors ${
                      isPreenchimento
                        ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 font-bold'
                        : 'text-slate-200 hover:bg-slate-700/80 hover:text-white'
                    }`}
                  >
                    <div className="p-1.5 bg-slate-700 rounded-lg text-emerald-400">
                      <FileCheck2 className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="block text-slate-100 font-bold">Preencher PDF (Formulários)</span>
                      <span className="block text-[10px] text-slate-400 font-normal">Preenchimento automático via dados salvos</span>
                    </div>
                  </Link>

                  <Link
                    href="/documentos/criar"
                    onClick={(e) => handleNav('/documentos/criar', e)}
                    className={`flex items-center space-x-3 px-3.5 py-2.5 mx-1 mt-1 rounded-xl text-xs font-semibold transition-colors ${
                      isCriarDocumento
                        ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 font-bold'
                        : 'text-slate-200 hover:bg-slate-700/80 hover:text-white'
                    }`}
                  >
                    <div className="p-1.5 bg-emerald-500/20 rounded-lg text-emerald-300">
                      <Wand2 className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="block text-slate-100 font-bold flex items-center gap-1.5">
                        Criar Documento (IA)
                        <span className="px-1.5 py-0.2 bg-emerald-500/30 text-emerald-300 text-[9px] rounded-md font-bold">NOVO</span>
                      </span>
                      <span className="block text-[10px] text-slate-400 font-normal">Reescrita de modelos via Gemini IA</span>
                    </div>
                  </Link>
                </div>
              )}
            </div>

            {/* Fiscal */}
            <div className="relative" ref={fiscalRef}>
              <button
                type="button"
                onClick={() => {
                  setIsFiscalOpen(!isFiscalOpen);
                  setIsJuridicoOpen(false);
                  setIsCadastrosOpen(false);
                  setIsRhOpen(false);
                }}
                className={`inline-flex items-center justify-center px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isFiscal
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs ring-2 ring-emerald-500/30'
                    : 'bg-transparent text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Receipt className={`w-4 h-4 mr-1.5 ${isFiscal ? 'text-white' : 'text-emerald-400'}`} />
                <span>Fiscal</span>
                <ChevronDown className={`w-3.5 h-3.5 ml-1.5 transition-transform duration-200 ${isFiscalOpen ? 'rotate-180' : ''}`} />
              </button>

              {isFiscalOpen && (
                <div className="absolute left-0 mt-2 w-64 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl py-2 z-50 animate-fadeIn">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700/60 mb-1">
                    Gestão Fiscal & Tributária
                  </div>

                  <Link
                    href="/fiscal/acesso-ecac"
                    onClick={(e) => handleNav('/fiscal/acesso-ecac', e)}
                    className={`flex items-center space-x-3 px-3.5 py-2.5 mx-1 mt-1 rounded-xl text-xs font-semibold transition-colors ${
                      isAcessoEcac
                        ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 font-bold'
                        : 'text-slate-200 hover:bg-slate-700/80 hover:text-white'
                    }`}
                  >
                    <div className="p-1.5 bg-emerald-500/20 rounded-lg text-emerald-300">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="block text-slate-100 font-bold flex items-center gap-1.5">
                        Emissão imposto
                        <span className="px-1.5 py-0.2 bg-emerald-500/30 text-emerald-300 text-[9px] rounded-md font-bold">Simples</span>
                      </span>
                      <span className="block text-[10px] text-slate-400 font-normal">Autenticação e robô do Simples Nacional</span>
                    </div>
                  </Link>
                </div>
              )}
            </div>

            {/* RH */}
            <div className="relative" ref={rhRef}>
              <button
                type="button"
                onClick={() => {
                  setIsRhOpen(!isRhOpen);
                  setIsFiscalOpen(false);
                  setIsJuridicoOpen(false);
                  setIsCadastrosOpen(false);
                }}
                className={`inline-flex items-center justify-center px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isRh
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs ring-2 ring-emerald-500/30'
                    : 'bg-transparent text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Users className={`w-4 h-4 mr-1.5 ${isRh ? 'text-white' : 'text-emerald-400'}`} />
                <span>RH</span>
                <ChevronDown className={`w-3.5 h-3.5 ml-1.5 transition-transform duration-200 ${isRhOpen ? 'rotate-180' : ''}`} />
              </button>

              {isRhOpen && (
                <div className="absolute left-0 mt-2 w-64 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl py-2 z-50 animate-fadeIn">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700/60 mb-1">
                    Departamento Pessoal
                  </div>

                  <Link
                    href="/rh/calculos"
                    onClick={(e) => handleNav('/rh/calculos', e)}
                    className={`flex items-center space-x-3 px-3.5 py-2.5 mx-1 mt-1 rounded-xl text-xs font-semibold transition-colors ${
                      isRhCalculos
                        ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 font-bold'
                        : 'text-slate-200 hover:bg-slate-700/80 hover:text-white'
                    }`}
                  >
                    <div className="p-1.5 bg-emerald-500/20 rounded-lg text-emerald-300">
                      <Calculator className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="block text-slate-100 font-bold flex items-center gap-1.5">
                        Cálculos
                        <span className="px-1.5 py-0.2 bg-emerald-500/30 text-emerald-300 text-[9px] rounded-md font-bold">DP</span>
                      </span>
                      <span className="block text-[10px] text-slate-400 font-normal">Simulador de folha e férias</span>
                    </div>
                  </Link>
                </div>
              )}
            </div>
          </nav>
        ) : null}

        {/* Right Corner: User Profile or Login Button */}
        <div className="flex items-center space-x-3">
          {isAuthenticated ? (
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center space-x-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-xl text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
              >
                <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-[11px]">
                  {session?.user?.name ? session.user.name.charAt(0) : 'A'}
                </div>
                <span className="hidden sm:inline-block max-w-[120px] truncate">
                  {session?.user?.name || session?.user?.email}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {/* Profile Dropdown */}
              {isProfileOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl py-2 z-50 animate-fadeIn">
                  <div className="px-4 py-2 border-b border-slate-700/80 mb-1">
                    <p className="text-xs font-bold text-white truncate">{session?.user?.name}</p>
                    <p className="text-[10px] text-slate-400 truncate">{session?.user?.email}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileOpen(false);
                      signOut();
                    }}
                    className="w-full flex items-center space-x-2.5 px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors text-left cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sair / Encerrar Sessão</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => openLoginModal()}
              className="inline-flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer space-x-1.5"
            >
              <LogIn className="w-4 h-4" />
              <span>Login</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export const Navbar = Header;