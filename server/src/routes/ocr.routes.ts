import { Router } from "express";
import { processDocumentOcr } from "../services/ocr.service";

const router = Router();

// POST /api/ocr-document
router.post("/ocr-document", async (req, res) => {
  try {
    const { fileBase64, mimeType, fileName, extractionType } = req.body || {};

    if (!fileBase64) {
      return res.status(400).json({
        success: false,
        error: "Arquivo não enviado ou formato inválido.",
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: "Chave da API da IA (GEMINI_API_KEY) não configurada no servidor.",
      });
    }

    const result = await processDocumentOcr({ fileBase64, mimeType, fileName, extractionType });
    return res.json(result);
  } catch (error: any) {
    console.error("[OCR Route Error]:", error);
    return res.status(500).json({
      success: false,
      error: `Erro ao extrair dados do documento via IA: ${error.message || "Falha na chamada da IA"}`,
    });
  }
});

export default router;
