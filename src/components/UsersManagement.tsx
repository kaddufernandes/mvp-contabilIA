import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Pencil,
  Trash2,
  ShieldAlert,
  Search,
  Check,
  Lock,
  Mail,
  User as UserIcon,
  AlertCircle,
  RefreshCw,
  Crown,
  ShieldCheck,
  Building2,
  Eye,
  EyeOff,
  X,
  Briefcase,
} from 'lucide-react';

import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import firebaseConfig from '../../firebase-applet-config.json';
import { useAuth } from '../context/AuthContext';
import { getAuthHeaders } from '../lib/apiClient';

// App secundário para criar contas de usuário no Auth sem deslogar a sessão Admin primária
const secondaryApp = getApps().find((a) => a.name === 'SecondaryAuth') || initializeApp(firebaseConfig, 'SecondaryAuth');
const secondaryAuth = getAuth(secondaryApp);

export interface UserItem {
  id: string; // UID real do Firebase Auth e do documento Firestore
  nome: string;
  name?: string;
  email: string;
  cargo: string; // 'ADMIN' | 'USER'
  role?: string;
  dataCriacao?: any;
  createdAt?: string;
  updatedAt?: string;
}

interface UsersManagementProps {
  onNavigate?: (path: string) => void;
}

export const UsersManagement: React.FC<UsersManagementProps> = ({ onNavigate }) => {
  const { data: session, status } = useAuth();
  const currentRole = session?.user?.role || 'USER';
  const isAdmin = currentRole === 'ADMIN';
  const isContador = currentRole === 'CONTADOR';
  const isAuthorized = isAdmin || isContador;

  const [users, setUsers] = useState<UserItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal State (Create / Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formRole, setFormRole] = useState<'USER' | 'CONTADOR' | 'ADMIN'>('USER');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);


  // Delete Confirmation Modal
  const [userToDelete, setUserToDelete] = useState<UserItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 1. LISTAGEM DINÂMICA NA TABELA (READ) - Firebase Firestore Real-Time Listener
  useEffect(() => {
    setIsLoading(true);
    setErrorMsg(null);

    const usuariosCollectionRef = collection(db, 'usuarios');

    const unsubscribe = onSnapshot(
      usuariosCollectionRef,
      (snapshot) => {
        const userList: UserItem[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          const nomeVal = data.nome || data.name || 'Sem Nome';
          const emailVal = data.email || '';
          const cargoVal = data.cargo || data.role || 'USER';

          return {
            id: docSnap.id,
            nome: nomeVal,
            name: nomeVal,
            email: emailVal,
            cargo: cargoVal,
            role: cargoVal,
            dataCriacao: data.dataCriacao,
          };
        });

        setUsers(userList);
        setIsLoading(false);
      },
      (err: any) => {
        console.error('Erro ao escutar coleção "usuarios" no Firestore:', err);
        setErrorMsg('Erro de conexão ao carregar usuários do Firestore.');
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Handle open create modal
  const handleOpenCreateModal = () => {
    setEditingUser(null);
    setFormName('');
    setFormEmail('');
    setFormPassword('');
    setShowPassword(false);
    setFormRole('USER');
    setFormError(null);
    setIsModalOpen(true);
  };


  // Handle open edit modal
  const handleOpenEditModal = (user: UserItem) => {
    setEditingUser(user);
    setFormName(user.nome || user.name || '');
    setFormEmail(user.email);
    setFormPassword('');
    const cargo = (user.cargo || user.role || 'USER').toUpperCase();
    setFormRole(cargo === 'ADMIN' ? 'ADMIN' : cargo === 'CONTADOR' ? 'CONTADOR' : 'USER');
    setFormError(null);
    setIsModalOpen(true);
  };


  // 2. CRIAÇÃO / EDIÇÃO DE USUÁRIO (Firebase Auth + Firestore)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = formName.trim();
    const cleanEmail = formEmail.trim();

    if (!cleanName || !cleanEmail) {
      setFormError('Nome e E-mail são obrigatórios.');
      return;
    }

    if (!editingUser && !formPassword.trim()) {
      setFormError('A senha é obrigatória para cadastrar novos usuários.');
      return;
    }

    if (!editingUser && formPassword.trim().length < 6) {
      setFormError('A senha deve conter no mínimo 6 caracteres.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      if (editingUser) {
        // Atualizar documento existente no Firestore
        const userDocRef = doc(db, 'usuarios', editingUser.id);
        const dadosUsuarioAtualizado = {
          nome: cleanName,
          email: cleanEmail,
          cargo: formRole,
          role: formRole,
        };

        await setDoc(userDocRef, dadosUsuarioAtualizado, { merge: true });

        // Opcional: Atualizar na API local caso exista
        try {
          await fetch(`/api/users/${editingUser.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              ...getAuthHeaders(),
            },
            body: JSON.stringify({ name: cleanName, email: cleanEmail, role: formRole }),
          });
        } catch (apiErr) {
          console.warn('Aviso ao sincronizar edição na API local:', apiErr);
        }

        setSuccessMsg(`Usuário "${cleanName}" atualizado com sucesso no Firestore!`);
      } else {
        // 1. Criar credencial de acesso utilizando Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(
          secondaryAuth,
          cleanEmail,
          formPassword.trim()
        );
        const authUser = userCredential.user;

        // 2. Utilizar o UID do Firebase Auth para criar o documento na coleção `usuarios` do Firestore
        const dadosUsuarioNovo = {
          nome: cleanName,
          email: cleanEmail,
          cargo: formRole,
          role: formRole,
          dataCriacao: serverTimestamp(),
        };

        await setDoc(doc(db, 'usuarios', authUser.uid), dadosUsuarioNovo);

        // Opcional: Registrar na API local para sincronização de espelho
        try {
          await fetch('/api/users', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...getAuthHeaders(),
            },
            body: JSON.stringify({
              id: authUser.uid,
              name: cleanName,
              email: cleanEmail,
              password: formPassword.trim(),
              role: formRole,
            }),
          });
        } catch (apiErr) {
          console.warn('Aviso ao sincronizar cadastro na API local:', apiErr);
        }

        setSuccessMsg(`Novo usuário "${cleanName}" cadastrado com sucesso no Firebase (UID: ${authUser.uid})!`);
      }

      setTimeout(() => setSuccessMsg(null), 4000);
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Erro ao salvar usuário no Firebase:', err);
      let message = 'Erro ao processar cadastro de usuário.';

      if (err.code === 'auth/email-already-in-use') {
        message = 'Este e-mail já está cadastrado por outro usuário.';
      } else if (err.code === 'auth/invalid-email') {
        message = 'O e-mail informado é inválido.';
      } else if (err.code === 'auth/weak-password') {
        message = 'A senha informada é fraca. Digite pelo menos 6 caracteres.';
      } else if (err.message) {
        message = err.message;
      }

      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. EXCLUSÃO DE USUÁRIO (DELETE)
  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    setIsDeleting(true);
    try {
      // Remover registro da coleção 'usuarios' no Firestore
      await deleteDoc(doc(db, 'usuarios', userToDelete.id));

      // Sincronizar exclusão na API local caso exista
      try {
        await fetch(`/api/users/${userToDelete.id}`, {
          method: 'DELETE',
          headers: getAuthHeaders(),
        });
      } catch (apiErr) {
        console.warn('Aviso ao sincronizar exclusão na API local:', apiErr);
      }

      const userNameDisplay = userToDelete.nome || userToDelete.name || userToDelete.email;
      setSuccessMsg(`Usuário "${userNameDisplay}" foi excluído com sucesso do Firestore.`);
      setTimeout(() => setSuccessMsg(null), 4000);
      setUserToDelete(null);
    } catch (err: any) {
      console.error('Erro ao excluir usuário no Firestore:', err);
      setErrorMsg(err.message || 'Erro ao remover documento do usuário no Firestore.');
      setUserToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered Users
  const filteredUsers = users.filter((u) => {
    const term = searchTerm.toLowerCase();
    const nameStr = (u.nome || u.name || '').toLowerCase();
    const emailStr = (u.email || '').toLowerCase();
    const cargoStr = (u.cargo || u.role || '').toLowerCase();
    return nameStr.includes(term) || emailStr.includes(term) || cargoStr.includes(term);
  });

  // Route Protection Notice if not Admin
  if (status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-3">
        <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
        <p className="text-sm font-medium text-slate-600">Verificando permissões de acesso...</p>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="max-w-2xl mx-auto my-12 bg-white border border-rose-200 rounded-2xl shadow-xl p-8 text-center animate-fadeIn">
        <div className="w-16 h-16 bg-rose-100 rounded-full text-rose-600 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 mb-2">Acesso Negado</h2>
        <p className="text-slate-600 text-sm mb-6 max-w-md mx-auto">
          Esta página de <strong>Gestão de Usuários</strong> é restrita apenas a usuários com privilégios de <strong>Administrador (ADMIN)</strong> ou <strong>Contador (CONTADOR)</strong>.
        </p>
        {onNavigate && (
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="inline-flex items-center px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
          >
            Voltar para a Página Inicial
          </button>
        )}
      </div>
    );
  }


  return (
    <div className="space-y-6 animate-fadeIn">
      {/* HEADER DA PÁGINA */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-slate-900 text-emerald-400 rounded-xl shadow-inner">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              Gestão de Usuários
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-md uppercase tracking-wider">
                Firebase Firestore
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Administração em tempo real das credenciais Firebase Auth e documentos na coleção 'usuarios'
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenCreateModal}
          className="inline-flex items-center px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer space-x-2"
        >
          <UserPlus className="w-4 h-4" />
          <span>+ Novo Usuário</span>
        </button>
      </div>

      {/* FEEDBACK BANNERS */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center justify-between animate-fadeIn">
          <div className="flex items-center space-x-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            className="text-emerald-500 hover:text-emerald-800 font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center justify-between animate-fadeIn">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-rose-500 hover:text-rose-800 font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* CONTROLES E BUSCA */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nome, e-mail ou cargo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center space-x-2 text-xs text-slate-500 font-medium">
          <span>Total de Usuários no Firestore: <strong>{filteredUsers.length}</strong></span>
        </div>
      </div>

      {/* TABELA DE USUÁRIOS */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-slate-500 text-xs flex flex-col items-center justify-center space-y-2">
            <RefreshCw className="w-6 h-6 text-emerald-600 animate-spin" />
            <span>Conectando e sincronizando com a coleção 'usuarios' do Firestore...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-xs space-y-2">
            <Users className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-700">Nenhum usuário cadastrado na coleção do Firestore</p>
            <p className="text-slate-400">Clique em "+ Novo Usuário" para cadastrar credenciais e dados no Firebase.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead>
                <tr className="bg-slate-900 text-slate-300 font-bold border-b border-slate-800 uppercase tracking-wider text-[11px]">
                  <th className="p-4 pl-6">Nome</th>
                  <th className="p-4">E-mail</th>
                  <th className="p-4">Cargo / Role</th>
                  <th className="p-4 text-center pr-6">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((user) => {
                  const userNameDisplay = user.nome || user.name || 'Sem Nome';
                  const userCargoDisplay = (user.cargo || user.role || 'USER').toUpperCase();
                  const isUserAdmin = userCargoDisplay === 'ADMIN';
                  const isUserContador = userCargoDisplay === 'CONTADOR';
                  const isMasterAdmin = user.email.trim().toLowerCase() === 'admin@contabil.ia';

                  return (
                    <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* NOME */}
                      <td className="p-4 pl-6 font-bold text-slate-900 whitespace-nowrap">
                        <div className="flex items-center space-x-3">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs text-white ${
                              isUserAdmin ? 'bg-amber-600' : 'bg-slate-700'
                            }`}
                          >
                            {userNameDisplay ? userNameDisplay.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div>
                            <span className="block font-bold text-slate-900">{userNameDisplay}</span>
                            <span className="block text-[10px] text-slate-400 font-normal font-mono">
                              UID: {user.id}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* E-MAIL */}
                      <td className="p-4 text-slate-600 font-medium whitespace-nowrap">
                        <div className="flex items-center space-x-1.5">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          <span>{user.email}</span>
                        </div>
                      </td>

                      {/* CARGO (ROLE) */}
                      <td className="p-4 whitespace-nowrap">
                        {isUserAdmin ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-[11px] font-bold">
                            <Crown className="w-3.5 h-3.5 text-amber-600" />
                            <span>Administrador (ADMIN)</span>
                          </span>
                        ) : isUserContador ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-blue-50 text-blue-800 border border-blue-200 rounded-lg text-[11px] font-bold">
                            <Users className="w-3.5 h-3.5 text-blue-600" />
                            <span>Contador (CONTADOR)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-semibold">
                            <UserIcon className="w-3.5 h-3.5 text-slate-500" />
                            <span>Usuário Comum (USER)</span>
                          </span>
                        )}
                      </td>


                      {/* AÇÕES */}
                      <td className="p-4 text-center pr-6 whitespace-nowrap">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(user)}
                            disabled={isUserAdmin && !isAdmin}
                            title={isUserAdmin && !isAdmin ? "Apenas administradores podem editar outros administradores" : "Editar Usuário no Firestore"}
                            className={`p-1.5 rounded-lg transition-colors ${
                              isUserAdmin && !isAdmin
                                ? 'text-slate-300 cursor-not-allowed opacity-50'
                                : 'text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 cursor-pointer'
                            }`}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setUserToDelete(user)}
                            disabled={isMasterAdmin || (isUserAdmin && !isAdmin)}
                            title={
                              isMasterAdmin
                                ? 'O Administrador Principal não pode ser excluído'
                                : isUserAdmin && !isAdmin
                                ? 'Apenas administradores master podem excluir outros administradores'
                                : 'Excluir do Firestore'
                            }
                            className={`p-1.5 rounded-lg transition-colors ${
                              isMasterAdmin || (isUserAdmin && !isAdmin)
                                ? 'text-slate-300 cursor-not-allowed opacity-50'
                                : 'text-slate-600 hover:text-rose-600 hover:bg-rose-50 cursor-pointer'
                            }`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>

                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* MODAL DE CRIAÇÃO / EDIÇÃO DE USUÁRIO — REDESIGNED */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] overflow-y-auto flex items-start justify-center p-4 pt-28 animate-fadeIn"
          style={{ background: 'rgba(2, 8, 23, 0.85)', backdropFilter: 'blur(8px)' }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200/60"
            style={{ animation: 'scaleIn 0.18s ease' }}>

            {/* HEADER COM GRADIENTE */}
            <div className="relative px-7 pt-7 pb-6"
              style={{
                background: editingUser
                  ? 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)'
                  : 'linear-gradient(135deg, #064e3b 0%, #065f46 60%, #047857 100%)'
              }}>
              {/* Decoração */}
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10"
                style={{ background: 'radial-gradient(circle, #fff 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />

              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
                    style={{ background: 'rgba(255,255,255,0.15)' }}>
                    {editingUser
                      ? <Pencil className="w-6 h-6 text-white" />
                      : <UserPlus className="w-6 h-6 text-white" />}
                  </div>
                  <div>
                    <h3 className="text-white font-black text-lg leading-tight">
                      {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
                    </h3>
                    <p className="text-white/60 text-xs mt-0.5">
                      {editingUser
                        ? `Atualizando dados de ${editingUser.nome || editingUser.email}`
                        : 'Preencha os dados para criar a conta no Firebase'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* FORM BODY */}
            <form onSubmit={handleSubmitForm} className="px-7 py-6 space-y-5">

              {/* ERRO */}
              {formError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-2xl flex items-start space-x-3 animate-fadeIn">
                  <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                  <span className="font-medium">{formError}</span>
                </div>
              )}

              {/* NOME + E-MAIL (2 colunas) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* NOME */}
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">
                    Nome Completo <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="João da Silva"
                      required
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                    />
                  </div>
                </div>

                {/* E-MAIL */}
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">
                    E-mail <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder="joao@empresa.com"
                      required
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* SENHA */}
              {!editingUser && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">
                    Senha <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      placeholder="Mínimo de 6 caracteres"
                      required
                      className="w-full pl-10 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {formPassword && formPassword.length < 6 && (
                    <p className="text-xs text-rose-500 mt-1.5 font-medium">A senha deve ter ao menos 6 caracteres</p>
                  )}
                </div>
              )}

              {/* PERFIL DE ACESSO */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-3">
                  Perfil de Acesso <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-3">

                  {/* USER */}
                  <button
                    type="button"
                    onClick={() => setFormRole('USER')}
                    className={`relative flex flex-col items-center text-center p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                      formRole === 'USER'
                        ? 'border-emerald-500 bg-emerald-50 shadow-md shadow-emerald-100'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {formRole === 'USER' && (
                      <div className="absolute top-2 right-2 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 ${
                      formRole === 'USER' ? 'bg-emerald-500' : 'bg-slate-100'
                    }`}>
                      <UserIcon className={`w-5 h-5 ${formRole === 'USER' ? 'text-white' : 'text-slate-500'}`} />
                    </div>
                    <span className={`text-xs font-bold block ${
                      formRole === 'USER' ? 'text-emerald-800' : 'text-slate-700'
                    }`}>Usuário</span>
                    <span className="text-[10px] text-slate-500 mt-0.5 leading-tight">Sócio / Empreendedor</span>
                  </button>

                  {/* CONTADOR */}
                  <button
                    type="button"
                    onClick={() => setFormRole('CONTADOR')}
                    className={`relative flex flex-col items-center text-center p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                      formRole === 'CONTADOR'
                        ? 'border-blue-500 bg-blue-50 shadow-md shadow-blue-100'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {formRole === 'CONTADOR' && (
                      <div className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 ${
                      formRole === 'CONTADOR' ? 'bg-blue-500' : 'bg-slate-100'
                    }`}>
                      <Briefcase className={`w-5 h-5 ${formRole === 'CONTADOR' ? 'text-white' : 'text-slate-500'}`} />
                    </div>
                    <span className={`text-xs font-bold block ${
                      formRole === 'CONTADOR' ? 'text-blue-800' : 'text-slate-700'
                    }`}>Contador</span>
                    <span className="text-[10px] text-slate-500 mt-0.5 leading-tight">Escritório B2B</span>
                  </button>

                  {/* ADMIN */}
                  <button
                    type="button"
                    disabled={!isAdmin}
                    onClick={() => isAdmin && setFormRole('ADMIN')}
                    className={`relative flex flex-col items-center text-center p-4 rounded-2xl border-2 transition-all ${
                      !isAdmin
                        ? 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed'
                        : formRole === 'ADMIN'
                        ? 'border-amber-500 bg-amber-50 shadow-md shadow-amber-100 cursor-pointer'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 cursor-pointer'
                    }`}
                    title={!isAdmin ? 'Apenas um Administrador pode criar outro Administrador' : 'Selecionar perfil de Administrador'}
                  >
                    {formRole === 'ADMIN' && isAdmin && (
                      <div className="absolute top-2 right-2 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                    {/* Cadeado visível se não é admin */}
                    {!isAdmin && (
                      <div className="absolute top-2 right-2 w-5 h-5 bg-slate-400 rounded-full flex items-center justify-center">
                        <Lock className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 ${
                      !isAdmin ? 'bg-slate-200' : formRole === 'ADMIN' ? 'bg-amber-500' : 'bg-slate-100'
                    }`}>
                      <Crown className={`w-5 h-5 ${
                        !isAdmin ? 'text-slate-400' : formRole === 'ADMIN' ? 'text-white' : 'text-slate-500'
                      }`} />
                    </div>
                    <span className={`text-xs font-bold block ${
                      !isAdmin ? 'text-slate-400' : formRole === 'ADMIN' ? 'text-amber-800' : 'text-slate-700'
                    }`}>Admin</span>
                    <span className={`text-[10px] mt-0.5 leading-tight ${
                      !isAdmin ? 'text-rose-400 font-semibold' : 'text-slate-500'
                    }`}>
                      {!isAdmin ? 'Restrito' : 'Acesso total'}
                    </span>
                  </button>

                </div>

                {/* Aviso ADMIN */}
                {!isAdmin && (
                  <div className="mt-3 flex items-start space-x-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800 font-medium">
                      O perfil <strong>Administrador</strong> só pode ser atribuído por outro Administrador do sistema.
                    </p>
                  </div>
                )}
              </div>

              {/* BOTÕES */}
              <div className="flex items-center justify-end space-x-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center px-6 py-2.5 text-sm font-bold text-white rounded-xl shadow-lg transition-all cursor-pointer space-x-2 disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #059669 0%, #047857 100%)' }}
                >
                  {isSubmitting
                    ? <RefreshCw className="w-4 h-4 animate-spin" />
                    : editingUser ? <Check className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />
                  }
                  <span>{editingUser ? 'Salvar Alterações' : 'Criar Conta'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4 border border-slate-200 text-center animate-scaleUp">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Excluir Usuário?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Tem certeza que deseja remover o usuário <strong>{userToDelete.nome || userToDelete.name || userToDelete.email}</strong>? Esta ação excluirá o documento da coleção <code>usuarios</code> do Firestore.
              </p>
            </div>

            <div className="flex items-center justify-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={isDeleting}
                className="inline-flex items-center px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer space-x-1"
              >
                {isDeleting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirmar Exclusão</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
