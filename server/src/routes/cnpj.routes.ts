import { Router } from "express";
import { fetchCnpjData } from "../services/brasilApi.service";

const router = Router();

// GET /api/cnpj/:cnpj
router.get("/:cnpj", async (req, res) => {
  try {
    const rawCnpj = req.params.cnpj || "";
    const result = await fetchCnpjData(rawCnpj);

    if (!result.success) {
      return res.status(result.status).json({
        success: false,
        error: result.error,
      });
    }

    return res.json({
      success: true,
      data: result.data,
    });
  } catch (error: any) {
    console.error("[CNPJ Route Error]:", error);
    return res.status(500).json({
      success: false,
      error: `Erro interno ao processar a busca de CNPJ: ${error.message || "Erro desconhecido"}`,
    });
  }
});

export default router;
