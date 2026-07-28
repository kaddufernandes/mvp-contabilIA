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
  const isAdmin = session?.user?.role === 'ADMIN';

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
  const [formRole, setFormRole] = useState<'USER' | 'ADMIN'>('USER');
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
    setFormRole((user.cargo === 'ADMIN' || user.role === 'ADMIN') ? 'ADMIN' : 'USER');
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

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto my-12 bg-white border border-rose-200 rounded-2xl shadow-xl p-8 text-center animate-fadeIn">
        <div className="w-16 h-16 bg-rose-100 rounded-full text-rose-600 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 mb-2">Acesso Negado</h2>
        <p className="text-slate-600 text-sm mb-6 max-w-md mx-auto">
          Esta página de <strong>Gestão de Usuários</strong> é restrita apenas a usuários com o cargo de <strong>Administrador Master (ADMIN)</strong>.
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
                  const userCargoDisplay = user.cargo || user.role || 'USER';
                  const isUserAdmin = userCargoDisplay.toUpperCase() === 'ADMIN';
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
                            title="Editar Usuário no Firestore"
                            className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setUserToDelete(user)}
                            disabled={isMasterAdmin}
                            title={
                              isMasterAdmin
                                ? 'O Administrador Principal não pode ser excluído'
                                : 'Excluir do Firestore'
                            }
                            className={`p-1.5 rounded-lg transition-colors ${
                              isMasterAdmin
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

      {/* MODAL DE CRIAÇÃO / EDIÇÃO DE USUÁRIO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-scaleUp">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <UserIcon className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm">
                  {editingUser ? 'Editar Usuário (Firestore)' : 'Cadastrar Novo Usuário (Firebase)'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white transition-colors text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* NOME */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nome Completo <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Ex: João da Silva"
                    required
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* E-MAIL */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Endereço de E-mail <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="Ex: joao@empresa.com.br"
                    required
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* SENHA */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Senha {editingUser ? '(não alterável nesta tela)' : <span className="text-rose-500">*</span>}
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder={editingUser ? '••••••••' : 'Mínimo de 6 caracteres'}
                    required={!editingUser}
                    disabled={!!editingUser}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 disabled:opacity-50"
                  />
                </div>
              </div>

              {/* CARGO (ROLE) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Papel / Cargo no Sistema <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`flex items-center space-x-2 p-3 rounded-xl border cursor-pointer transition-all ${
                      formRole === 'USER'
                        ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-900 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value="USER"
                      checked={formRole === 'USER'}
                      onChange={() => setFormRole('USER')}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <span className="block text-xs font-bold">Usuário Comum</span>
                      <span className="block text-[10px] text-slate-500 font-normal">Usuário padrão do sistema</span>
                    </div>
                  </label>

                  <label
                    className={`flex items-center space-x-2 p-3 rounded-xl border cursor-pointer transition-all ${
                      formRole === 'ADMIN'
                        ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/20 text-amber-900 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value="ADMIN"
                      checked={formRole === 'ADMIN'}
                      onChange={() => setFormRole('ADMIN')}
                      className="text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <span className="block text-xs font-bold">Administrador</span>
                      <span className="block text-[10px] text-slate-500 font-normal">Acesso total às funções</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* ACTION BUTTONS */}
              <div className="pt-3 flex items-center justify-end space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer space-x-1.5"
                >
                  {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingUser ? 'Salvar Alterações' : 'Criar no Firebase'}</span>
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
