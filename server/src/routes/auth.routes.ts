import { Router } from "express";
import bcrypt from "bcryptjs";
import { findUserByEmail, createUserStore } from "../../../src/lib/usersStore";

const router = Router();

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: "O campo Nome é obrigatório.",
      });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        error: "O campo E-mail é obrigatório.",
      });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        error: "A senha deve ter no mínimo 6 caracteres.",
      });
    }

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: "Este e-mail já está cadastrado no sistema.",
      });
    }

    const newUser = await createUserStore({
      id: `usr_${Date.now()}`,
      name,
      email,
      role: 'USER',
    });

    console.log(`[Auth API] Novo usuário registrado com sucesso: ${newUser.email}`);

    return res.status(201).json({
      success: true,
      message: "Usuário cadastrado com sucesso!",
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        createdAt: newUser.createdAt,
      },
    });
  } catch (error: any) {
    console.error("[Register API Error]:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Erro interno ao cadastrar usuário.",
    });
  }
});

// POST /api/auth/signin
router.post("/signin", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Forneça e-mail e senha para realizar o login.",
      });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Usuário não encontrado ou credenciais inválidas.",
      });
    }

    if (user.password) {
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return res.status(401).json({
          success: false,
          error: "Senha incorreta. Verifique suas credenciais.",
        });
      }
    }

    const sessionData = {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role || "user",
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    return res.json({
      success: true,
      session: sessionData,
    });
  } catch (error: any) {
    console.error("[Signin API Error]:", error);
    return res.status(500).json({
      success: false,
      error: "Erro ao processar autenticação.",
    });
  }
});

// GET /api/auth/session
router.get("/session", (req, res) => {
  return res.json({
    user: {
      id: "usr_admin_1",
      name: "Administrador Contábil",
      email: "admin@contabil.ia",
      role: "ADMIN",
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });
});

// POST /api/auth/signout
router.post("/signout", (req, res) => {
  return res.json({ success: true, url: "/" });
});

export default router;
