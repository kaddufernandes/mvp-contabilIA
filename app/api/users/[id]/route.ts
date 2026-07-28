import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { updateUserStore, deleteUserStore } from "../../../../src/lib/usersStore";
import { getAuthenticatedUserFromRequest } from "../../../../src/lib/authHelper";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    let role: string | undefined;

    const session = await getServerSession(authOptions);
    if (session?.user) {
      role = session.user.role;
    } else {
      const user = getAuthenticatedUserFromRequest(request.headers);
      if (user) {
        role = user.role;
      }
    }

    if (role !== "ADMIN") {
      return Response.json(
        { success: false, error: "Acesso negado. Apenas administradores podem atualizar usuários." },
        { status: 403 }
      );
    }

    const { id } = params;
    const body = await request.json();

    const updated = await updateUserStore(id, body);
    const { password: _, ...sanitizedUser } = updated;

    return Response.json({ success: true, user: sanitizedUser });
  } catch (error: any) {
    return Response.json(
      { success: false, error: error.message || "Erro ao atualizar usuário." },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    let role: string | undefined;

    const session = await getServerSession(authOptions);
    if (session?.user) {
      role = session.user.role;
    } else {
      const user = getAuthenticatedUserFromRequest(request.headers);
      if (user) {
        role = user.role;
      }
    }

    if (role !== "ADMIN") {
      return Response.json(
        { success: false, error: "Acesso negado. Apenas administradores podem excluir usuários." },
        { status: 403 }
      );
    }

    const { id } = params;
    deleteUserStore(id);

    return Response.json({ success: true, message: "Usuário excluído com sucesso." });
  } catch (error: any) {
    return Response.json(
      { success: false, error: error.message || "Erro ao excluir usuário." },
      { status: 400 }
    );
  }
}
