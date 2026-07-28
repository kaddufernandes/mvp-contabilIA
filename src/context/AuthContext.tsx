import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, loginFirebase, logoutFirebase, db } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export interface UserSession {
  user: {
    id: string;
    name: string | null;
    email: string | null;
    role: string;
  };
}

interface AuthContextType {
  data: UserSession | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
  signIn: (email?: string, password?: string) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
  isLoginModalOpen: boolean;
  setIsLoginModalOpen: (open: boolean) => void;
  openLoginModal: (reason?: string) => void;
  loginReason: string | null;
}

const AuthContext = createContext<AuthContextType>({
  data: null,
  status: 'unauthenticated',
  signIn: async () => ({ ok: false }),
  signOut: async () => {},
  isLoginModalOpen: false,
  setIsLoginModalOpen: () => {},
  openLoginModal: () => {},
  loginReason: null,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<UserSession | null>(null);
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginReason, setLoginReason] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        let userRole = 'USER';
        try {
          const userDoc = await getDoc(doc(db, 'usuarios', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            userRole = userData.role || 'USER';
          }
        } catch (e) {
          console.error('Erro ao buscar role do usuário:', e);
        }
        
        setSession({
          user: {
            id: user.uid,
            name: user.displayName,
            email: user.email,
            role: userRole,
          }
        });
        setStatus('authenticated');
      } else {
        setSession(null);
        setStatus('unauthenticated');
      }
    });
    return () => unsubscribe();
  }, []);

  const signIn = async (email?: string, password?: string) => {
    if (!email || !password) return { ok: false, error: 'E-mail e senha são obrigatórios.' };
    try {
      await loginFirebase(email, password);
      setIsLoginModalOpen(false);
      setLoginReason(null);
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err.message || 'Erro ao realizar login.' };
    }
  };

  const signOut = async () => {
    try {
      await logoutFirebase();
    } catch (e) {
      console.warn('Erro ao sair:', e);
    }
  };

  const openLoginModal = (reason?: string) => {
    setLoginReason(reason || null);
    setIsLoginModalOpen(true);
  };

  return (
    <AuthContext.Provider
      value={{
        data: session,
        status,
        signIn,
        signOut,
        isLoginModalOpen,
        setIsLoginModalOpen,
        openLoginModal,
        loginReason,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

export const useSession = () => {
  const { data, status } = useAuth();
  return { data, status };
};
