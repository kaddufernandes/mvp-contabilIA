import React from 'react';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { UsersManagement } from '../../src/components/UsersManagement';
import { ShieldAlert } from 'lucide-react';
import Link from 'next/link';

export default async function UsuariosPage() {
  const session = await getServerSession(authOptions);

  // Proteção Server-Side da Rota: se não for ADMIN, nega acesso
  if (!session?.user || session.user.role !== 'ADMIN') {
    return (
      <div className="max-w-2xl mx-auto my-12 bg-white border border-rose-200 rounded-2xl shadow-xl p-8 text-center">
        <div className="w-16 h-16 bg-rose-100 rounded-full text-rose-600 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 mb-2">Acesso Negado</h2>
        <p className="text-slate-600 text-sm mb-6 max-w-md mx-auto">
          Esta rota é de acesso exclusivo para usuários com papel de <strong>Administrador Master (ADMIN)</strong>.
        </p>
        <Link
          href="/"
          className="inline-flex items-center px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition-all"
        >
          Voltar para a Página Inicial
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <UsersManagement />
    </div>
  );
}
