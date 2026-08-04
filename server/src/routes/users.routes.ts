import { Router } from "express";
import { getAuthenticatedUserFromRequest } from "../../../src/lib/authHelper";
import { getUsersStore, createUserStore, updateUserStore, deleteUserStore } from "../../../src/lib/usersStore";

const router = Router();

// GET /api/users
router.get("/", async (req, res) => {
  try {
    const user = await getAuthenticatedUserFromRequest(req.headers);
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: "Acesso negado. Apenas administradores podem gerenciar usuários.",
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
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: "Acesso negado. Apenas administradores podem criar usuários.",
      });
    }

    const { name, email, password, role } = req.body || {};
    if (!name || !email) {
      return res.status(400).json({
        success: false,
        error: "Nome e e-mail são obrigatórios.",
      });
    }

    const newUser = await createUserStore({
      id: `usr_${Date.now()}`,
      name,
      email,
      role: role || 'USER'
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
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: "Acesso negado. Apenas administradores podem atualizar usuários.",
      });
    }

    const { id } = req.params;
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
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: "Acesso negado. Apenas administradores podem excluir usuários.",
      });
    }

    const { id } = req.params;
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
