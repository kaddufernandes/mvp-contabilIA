import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

import cnpjRoutes from "./server/src/routes/cnpj.routes";
import ocrRoutes from "./server/src/routes/ocr.routes";
import authRoutes from "./server/src/routes/auth.routes";
import usersRoutes from "./server/src/routes/users.routes";
import companiesRoutes from "./server/src/routes/companies.routes";
import rpaRoutes from "./server/src/routes/rpa.routes";
import pdfRoutes from "./server/src/routes/pdf.routes";

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Configuração de Middlewares para grandes payloads (upload de arquivos em base64)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// ==========================================
// REGISTRO DE ROTAS DA API
// ==========================================
app.use("/api/cnpj", cnpjRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/companies", companiesRoutes);
app.use("/api/rpa", rpaRoutes);
app.use("/api/fiscal", rpaRoutes);
app.use("/api", ocrRoutes);
app.use("/api", pdfRoutes);

// ==========================================
// CONFIGURAÇÃO DO SERVIDOR DE DESENVOLVIMENTO (VITE) E PRODUÇÃO (ESTÁTICOS)
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Servidor Contábil AI] Rodando com sucesso na porta ${PORT} (http://localhost:${PORT})`);
  });
}

startServer();