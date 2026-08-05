import { Router } from "express";
import { getAuthenticatedUserFromRequest } from "../../../src/lib/authHelper";
import { getUsersStore, createUserStore, updateUserStore, deleteUserStore } from "../../../src/lib/usersStore";

const router = Router();

// GET /api/users
router.get("/", async (req, res) => {
  try {
    const user = await getAuthenticatedUserFromRequest(req.headers);
    if (!user || (user.role !== 'ADMIN' && user.role !== 'CONTADOR')) {
      return res.status(403).json({
        success: false,
        error: "Acesso negado. Apenas administradores e contadores podem gerenciar usuários.",
      });
    }

    const rawUsers = await getUsersStore();
    const users = rawUsers.map(({ password, ...u }) => u);
    return res.json({ success: true, users });
  } catch (error: any) {
    console.error("[Users GET Error]:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Erro ao buscar usuários.",
    });
  }
});

// POST /api/users
router.post("/", async (req, res) => {
  try {
    const user = await getAuthenticatedUserFromRequest(req.headers);
    if (!user || (user.role !== 'ADMIN' && user.role !== 'CONTADOR')) {
      return res.status(403).json({
        success: false,
        error: "Acesso negado. Apenas administradores e contadores podem criar usuários.",
      });
    }

    const { id, name, email, password, role } = req.body || {};
    if (!name || !email) {
      return res.status(400).json({
        success: false,
        error: "Nome e e-mail são obrigatórios.",
      });
    }

    const requestedRole = (role || 'USER').toUpperCase();
    if (requestedRole === 'ADMIN' && user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: "Acesso negado: Você não tem permissão para criar usuários administradores.",
      });
    }

    const newUser = await createUserStore({
      id: id || `usr_${Date.now()}`,
      name,
      email,
      role: requestedRole
    });
    const { password: _, ...sanitized } = newUser;

    return res.status(201).json({ success: true, user: sanitized });
  } catch (error: any) {
    console.error("[Users POST Error]:", error);
    return res.status(400).json({
      success: false,
      error: error.message || "Erro ao criar usuário.",
    });
  }
});

// PUT /api/users/:id
router.put("/:id", async (req, res) => {
  try {
    const user = await getAuthenticatedUserFromRequest(req.headers);
    if (!user || (user.role !== 'ADMIN' && user.role !== 'CONTADOR')) {
      return res.status(403).json({
        success: false,
        error: "Acesso negado. Apenas administradores e contadores podem atualizar usuários.",
      });
    }

    const { id } = req.params;
    const { name, role } = req.body || {};

    // 1. Busca os usuários do banco para inspecionar o cargo do alvo
    const usersStore = await getUsersStore();
    const targetUser = usersStore.find((u) => u.id === id);
    
    if (targetUser) {
      const targetRole = (targetUser.role || targetUser.cargo || 'USER').toUpperCase();
      
      // Se o usuário alvo for ADMIN, apenas um ADMIN pode editá-lo
      if (targetRole === 'ADMIN' && user.role !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          error: "Acesso negado: Apenas administradores podem editar um usuário administrador.",
        });
      }
    }

    // 2. Se houver tentativa de promover o usuário a ADMIN e o editor não for ADMIN
    if (role && role.toUpperCase() === 'ADMIN' && user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: "Acesso negado: Apenas administradores podem conceder privilégios de administrador.",
      });
    }

    const updated = await updateUserStore(id, req.body);
    const { password: _, ...sanitized } = updated;

    return res.json({ success: true, user: sanitized });
  } catch (error: any) {
    console.error("[Users PUT Error]:", error);
    return res.status(400).json({
      success: false,
      error: error.message || "Erro ao atualizar usuário.",
    });
  }
});

// DELETE /api/users/:id
router.delete("/:id", async (req, res) => {
  try {
    const user = await getAuthenticatedUserFromRequest(req.headers);
    if (!user || (user.role !== 'ADMIN' && user.role !== 'CONTADOR')) {
      return res.status(403).json({
        success: false,
        error: "Acesso negado. Apenas administradores e contadores podem excluir usuários.",
      });
    }

    const { id } = req.params;

    // Apenas ADMIN pode excluir um usuário que seja ADMIN
    const usersStore = await getUsersStore();
    const targetUser = usersStore.find((u) => u.id === id);
    
    if (targetUser) {
      const targetRole = (targetUser.role || targetUser.cargo || 'USER').toUpperCase();
      if (targetRole === 'ADMIN' && user.role !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          error: "Acesso negado: Apenas administradores podem excluir um usuário administrador.",
        });
      }
    }

    await deleteUserStore(id);

    return res.json({ success: true, message: "Usuário excluído com sucesso." });
  } catch (error: any) {
    console.error("[Users DELETE Error]:", error);
    return res.status(400).json({
      success: false,
      error: error.message || "Erro ao excluir usuário.",
    });
  }
});

export default router;
