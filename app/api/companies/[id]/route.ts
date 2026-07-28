import { deleteCompanyStore } from '../../../../src/lib/companiesStore';
import { getAuthenticatedUserFromRequest } from '../../../../src/lib/authHelper';

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = getAuthenticatedUserFromRequest(request.headers);
    if (!user) {
      return Response.json(
        { success: false, error: 'Acesso não autorizado. Faça login para excluir empresas.' },
        { status: 401 }
      );
    }

    const id = params?.id;
    if (!id) {
      return Response.json(
        { success: false, error: 'ID ou CNPJ da empresa não informado.' },
        { status: 400 }
      );
    }

    const deleted = deleteCompanyStore(id, user.id);
    if (!deleted) {
      return Response.json(
        { success: false, error: 'Empresa não encontrada no banco de dados para este usuário.' },
        { status: 404 }
      );
    }

    return Response.json(
      { success: true, message: 'Empresa excluída com sucesso!' },
      { status: 200 }
    );
  } catch (error: any) {
    return Response.json(
      { success: false, error: error.message || 'Erro ao excluir empresa.' },
      { status: 500 }
    );
  }
}
