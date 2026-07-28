import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { getCompaniesStore, saveCompanyStore } from '../../../src/lib/companiesStore';
import { getAuthenticatedUserFromRequest } from '../../../src/lib/authHelper';

export async function GET(request: Request) {
  try {
    let role: string | undefined;
    let userId: string | undefined;

    const session = await getServerSession(authOptions);
    if (session?.user) {
      role = session.user.role;
      userId = session.user.id;
    } else {
      const user = getAuthenticatedUserFromRequest(request.headers);
      if (user) {
        role = user.role;
        userId = user.id;
      }
    }

    if (!userId && !role) {
      return Response.json(
        { success: false, error: 'Acesso não autorizado. Faça login para visualizar suas empresas.' },
        { status: 401 }
      );
    }

    let companies;
    if (role === 'ADMIN') {
      // Se for ADMIN: traz todas as empresas sem filtro de userId
      companies = await getCompaniesStore();
    } else {
      // Se não for ADMIN: filtra por userId
      companies = await getCompaniesStore(userId);
    }

    return Response.json({ success: true, companies });
  } catch (error: any) {
    return Response.json(
      { success: false, error: error.message || 'Erro ao buscar empresas do banco de dados.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = getAuthenticatedUserFromRequest(request.headers);
    if (!user) {
      return Response.json(
        { success: false, error: 'Acesso não autorizado. Faça login para cadastrar empresas.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const companyData = body.formData || body;

    if (!companyData || (!companyData.razao_social && !companyData.cnpj)) {
      return Response.json(
        { success: false, error: 'Razão Social ou CNPJ são obrigatórios.' },
        { status: 400 }
      );
    }

    // Injetar o userId da sessão autenticada por segurança
    const saved = saveCompanyStore(companyData, user.id);
    return Response.json(
      {
        success: true,
        message: 'Empresa cadastrada com sucesso!',
        company: saved,
      },
      { status: 201 }
    );
  } catch (error: any) {
    return Response.json(
      { success: false, error: error.message || 'Erro ao salvar empresa no banco de dados.' },
      { status: 500 }
    );
  }
}
