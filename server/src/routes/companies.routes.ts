import { Router } from "express";
import { getAuthenticatedUserFromRequest } from "../../../src/lib/authHelper";
import { getCompaniesStore, saveCompanyStore, deleteCompanyStore } from "../../../src/lib/companiesStore";

const router = Router();

// GET /api/companies
router.get("/", async (req, res) => {
  try {
    const user = await getAuthenticatedUserFromRequest(req.headers);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Acesso não autorizado. Faça login para visualizar suas empresas.",
      });
    }

    const isAdmin = user.role === 'ADMIN';
    const companies = isAdmin ? await getCompaniesStore() : await getCompaniesStore(user.id);
    return res.json({
      success: true,
      companies,
    });
  } catch (error: any) {
    console.error("[Companies GET Error]:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Erro ao listar empresas do banco de dados.",
    });
  }
});

// POST /api/companies
router.post("/", async (req, res) => {
  try {
    const user = await getAuthenticatedUserFromRequest(req.headers);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Acesso não autorizado. Faça login para cadastrar empresas.",
      });
    }

    const companyData = req.body?.formData || req.body;
    if (!companyData || (!companyData.razao_social && !companyData.cnpj)) {
      return res.status(400).json({
        success: false,
        error: "Informe a Razão Social ou CNPJ para cadastrar a empresa.",
      });
    }

    companyData.metadata = { ...companyData.metadata, userId: user.id };
    const savedCompanyId = await saveCompanyStore(companyData);
    const savedCompany = { ...companyData, id: savedCompanyId };

    return res.status(201).json({
      success: true,
      message: "Empresa cadastrada com sucesso!",
      company: savedCompany,
    });
  } catch (error: any) {
    console.error("[Companies POST Error]:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Erro ao salvar empresa no banco de dados.",
    });
  }
});

// DELETE /api/companies/:id
router.delete("/:id", async (req, res) => {
  try {
    const user = await getAuthenticatedUserFromRequest(req.headers);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Acesso não autorizado. Faça login para excluir empresas.",
      });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        error: "ID ou CNPJ não informado.",
      });
    }

    await deleteCompanyStore(id);
    return res.json({
      success: true,
      message: "Empresa excluída com sucesso!",
    });
  } catch (error: any) {
    console.error("[Companies DELETE Error]:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Erro ao excluir empresa.",
    });
  }
});

export default router;
