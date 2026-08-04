import { Router } from "express";
import multer from "multer";
import { parseAndMapPdfFields, generatePdfWithFields } from "../../../src/lib/pdfFiller";
import { getGeminiClient } from "../config/gemini";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// POST /api/fill-pdf
router.post("/fill-pdf", upload.single("pdfFile"), async (req, res) => {
  try {
    const file = req.file;
    const companyJson = req.body?.companyData;

    if (!file) {
      return res.status(400).json({ success: false, error: "Arquivo PDF não enviado." });
    }
    if (!companyJson) {
      return res.status(400).json({ success: false, error: "Dados da empresa não informados." });
    }

    let empresa;
    try {
      empresa = typeof companyJson === "string" ? JSON.parse(companyJson) : companyJson;
    } catch (e) {
      return res.status(400).json({ success: false, error: "JSON da empresa inválido." });
    }

    const { mappedFields, hasFormFields } = await parseAndMapPdfFields(file.buffer, empresa);

    return res.json({
      success: true,
      mappedFields,
      hasFormFields,
    });
  } catch (error: any) {
    console.error("[Fill PDF Parse Error]:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Erro ao ler e mapear PDF com dados da empresa.",
    });
  }
});

// POST /api/generate-pdf
router.post("/generate-pdf", upload.single("pdfFile"), async (req, res) => {
  try {
    const file = req.file;
    const editedFieldsJson = req.body?.editedFields;

    if (!file) {
      return res.status(400).json({ success: false, error: "Arquivo PDF original não fornecido." });
    }
    if (!editedFieldsJson) {
      return res.status(400).json({ success: false, error: "Campos editados não fornecidos." });
    }

    let editedFields;
    try {
      editedFields = typeof editedFieldsJson === "string" ? JSON.parse(editedFieldsJson) : editedFieldsJson;
    } catch (e) {
      return res.status(400).json({ success: false, error: "JSON de campos editados inválido." });
    }

    const { pdfBytes } = await generatePdfWithFields(file.buffer, editedFields);
    const pdfBase64 = Buffer.from(pdfBytes).toString("base64");

    return res.json({
      success: true,
      pdfBase64,
    });
  } catch (error: any) {
    console.error("[Generate PDF Error]:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Erro ao gerar PDF final.",
    });
  }
});

// POST /api/generate-contract
router.post("/generate-contract", upload.single("templateFile"), async (req, res) => {
  try {
    const file = req.file;
    const companyJson = req.body?.companyData;
    const customInstructions = req.body?.customInstructions || "";

    if (!file) {
      return res.status(400).json({ success: false, error: "Arquivo modelo (template) não enviado." });
    }
    if (!companyJson) {
      return res.status(400).json({ success: false, error: "Dados da empresa não fornecidos." });
    }

    let companyObj;
    try {
      companyObj = typeof companyJson === "string" ? JSON.parse(companyJson) : companyJson;
    } catch (e) {
      return res.status(400).json({ success: false, error: "JSON da empresa inválido." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: "Chave da API da IA (GEMINI_API_KEY) não configurada no servidor.",
      });
    }

    const ai = getGeminiClient();
    const parts: any[] = [];
    const isPdf = file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf");

    if (isPdf) {
      parts.push({
        inlineData: {
          mimeType: "application/pdf",
          data: file.buffer.toString("base64"),
        },
      });
    } else {
      const fileText = file.buffer.toString("utf-8");
      parts.push({
        text: `--- CONTRATO/DOCUMENTO MODELO ORIGINAL ---\n${fileText}\n--- FIM DO MODELO ---`,
      });
    }

    const promptText = `
Você é um assistente paralegal avançado. Você receberá o texto de um contrato/documento modelo e um objeto JSON contendo os dados de uma empresa e seus sócios. Sua tarefa é reescrever o contrato modelo, substituindo as informações originais (nomes, endereços, CNPJ, capital social, cotas, etc.) pelos dados da nova empresa fornecida no JSON. Mantenha estritamente a mesma estrutura legal, formatação, cláusulas e tom formal do documento original. Retorne APENAS o texto do novo contrato gerado, pronto para uso.

DADOS SOCIETÁRIOS E CADASTRAIS DA EMPRESA:
${JSON.stringify(companyObj, null, 2)}

${customInstructions ? `INSTRUÇÕES ADICIONAIS:\n${customInstructions}\n` : ''}

Requisitos Finais:
1. Mantenha todas as cláusulas legais, parágrafos e termos jurídicos adequados.
2. Atualize rigorosamente todas as qualificações de sócios, valores monetários, participações sociais, qualificações cadastrais e endereço.
3. Não coloque introduções nem explicações no início. Retorne diretamente o documento gerado.
`;

    parts.push({ text: promptText });

    console.log(`[Generate Contract API] Gerando contrato com Gemini IA para empresa "${companyObj.razao_social || 'Empresa'}"...`);

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: parts,
      config: {
        systemInstruction: "Você é um assistente paralegal avançado. Retorne APENAS o texto do novo contrato gerado.",
      },
    });

    const generatedText = response.text || "";

    return res.json({
      success: true,
      generatedContract: generatedText,
      razaoSocial: companyObj.razao_social || "Empresa",
    });
  } catch (error: any) {
    console.error("[Generate Contract API Error]:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Erro ao reescrever contrato via IA.",
    });
  }
});

// POST /api/refine-contract
router.post("/refine-contract", async (req, res) => {
  try {
    const { currentText, customInstruction } = req.body || {};

    if (!currentText) {
      return res.status(400).json({
        success: false,
        error: "Nenhum texto de documento atual fornecido para refinamento.",
      });
    }

    if (!customInstruction || !customInstruction.trim()) {
      return res.status(400).json({
        success: false,
        error: "Instrução de alteração não informada.",
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: "Chave da API da IA (GEMINI_API_KEY) não configurada no servidor.",
      });
    }

    const ai = getGeminiClient();

    const systemInstruction =
      "Você é um assistente paralegal avançado. Você receberá a minuta atual de um documento/contrato e uma instrução específica do usuário pedindo uma alteração ou adição. Sua tarefa é aplicar ESSA INSTRUÇÃO no documento. Retorne APENAS o documento inteiro atualizado, sem comentários adicionais, markdown ou explicações.";

    const promptText = `DOCUMENTO ATUAL:
${currentText}

INSTRUÇÃO DE ALTERAÇÃO / AJUSTE FINO DO USUÁRIO:
${customInstruction}

Retorne APENAS o documento inteiro reescrito com a alteração solicitada.`;

    console.log("[Refine Contract API] Processando refinamento com Gemini IA...");

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: promptText,
      config: {
        systemInstruction,
      },
    });

    const refinedText = response.text || "";

    return res.json({
      success: true,
      refinedContract: refinedText,
    });
  } catch (error: any) {
    console.error("[Refine Contract API Error]:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Erro ao refinhar contrato com a IA.",
    });
  }
});

// POST /api/fiscal/parse-txt
router.post("/fiscal/parse-txt", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    const cnpjInput = req.body?.cnpj || req.query?.cnpj || "";
    const tipoImportacao = req.body?.tipoImportacao || "saida";

    if (!file) {
      return res.status(400).json({
        success: false,
        error: "Nenhum arquivo TXT foi enviado. Por favor, selecione um arquivo válido.",
      });
    }

    const targetCnpj = String(cnpjInput).replace(/\D/g, "");
    if (!targetCnpj || targetCnpj.length !== 14) {
      return res.status(400).json({
        success: false,
        error: "CNPJ da empresa selecionada não foi informado ou é inválido.",
      });
    }

    const textContent = file.buffer.toString("utf-8");
    const lines = textContent.split(/\r?\n/);

    let cnpjValido = false;
    for (const line of lines) {
      if (!line.trim()) continue;
      if (line.includes(targetCnpj)) {
        cnpjValido = true;
        break;
      }
    }

    if (!cnpjValido) {
      const formattedCnpj = `${targetCnpj.substring(0, 2)}.${targetCnpj.substring(2, 5)}.${targetCnpj.substring(5, 8)}/${targetCnpj.substring(8, 12)}-${targetCnpj.substring(12, 14)}`;
      return res.status(400).json({
        success: false,
        error: `CNPJ não encontrado no arquivo: O CNPJ ${formattedCnpj} selecionado não consta como ${tipoImportacao.toUpperCase()} no arquivo TXT importado.`,
      });
    }

    let totalValoresLocal = 0;
    let contraparteLocal = "";
    let valorRodapeTipo9 = 0;

    for (const line of lines) {
      if (!line.trim()) continue;
      const tipoRegistro = line.charAt(0);

      if (tipoRegistro === "9") {
        if (line.length >= 23) {
          const strTotal = line.substring(8, 23).trim();
          if (/^\d+$/.test(strTotal)) {
            valorRodapeTipo9 = parseFloat(strTotal) / 100;
          }
        }
      }
    }

    totalValoresLocal = valorRodapeTipo9;

    return res.json({
      success: true,
      cnpjEncontrado: targetCnpj,
      tipoImportacao,
      totalRegistros: lines.length,
      valorTotal: totalValoresLocal,
      contraparte: contraparteLocal || "Prefeitura SP / Tomadores Diversos",
    });
  } catch (error: any) {
    console.error("[Parse TXT Error]:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Erro ao ler e processar o arquivo TXT.",
    });
  }
});

export default router;
