import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { getUsersStore, createUserStore } from "../../../src/lib/usersStore";
import { getAuthenticatedUserFromRequest } from "../../../src/lib/authHelper";

export async function GET(request: Request) {
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
        { success: false, error: "Acesso negado. Apenas administradores podem gerenciar usuários." },
        { status: 403 }
      );
    }

    const users = getUsersStore().map(({ password, ...userWithoutPassword }) => userWithoutPassword);

    return Response.json({ success: true, users });
  } catch (error: any) {
    return Response.json(
      { success: false, error: error.message || "Erro interno ao buscar lista de usuários." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
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
        { success: false, error: "Acesso negado. Apenas administradores podem criar usuários." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, email, password, role: userRole } = body || {};

    if (!name || !email || !password) {
      return Response.json(
        { success: false, error: "Nome, e-mail e senha são obrigatórios." },
        { status: 400 }
      );
    }

    const newUser = await createUserStore({
      name,
      email,
      password,
      role: userRole || "USER",
    });

    const { password: _, ...sanitizedUser } = newUser;

    return Response.json({ success: true, user: sanitizedUser }, { status: 201 });
  } catch (error: any) {
    return Response.json(
      { success: false, error: error.message || "Erro ao criar usuário." },
      { status: 400 }
    );
  }
}
