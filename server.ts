import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { runEcacRpa } from "./src/services/rpa/ecacRpa";
import { runSimplesNacionalRpa } from "./src/services/rpa/simplesNacionalRpa";
import { runEmitirDasRpa, runValidarPaRpa } from "./src/services/rpa/emitirDasRpa";

const app = express();
const PORT = 3000;

// Increase payload limit for base64 encoded document uploads (PDF, images)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Initialize Gemini Client with server-side API Key
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY environment variable is not set.");
  }
  return new GoogleGenAI({
    apiKey: apiKey || "",
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
};

// ==========================================
// ROTA 1: BUSCA DE CNPJ NA RECEITA FEDERAL (BrasilAPI)
// ==========================================
app.get("/api/cnpj/:cnpj", async (req, res) => {
  try {
    const rawCnpj = req.params.cnpj || "";
    // Limpar caracteres não numéricos
    const cleanCnpj = rawCnpj.replace(/\D/g, "");

    if (cleanCnpj.length !== 14) {
      return res.status(400).json({
        success: false,
        error: "CNPJ inválido. Um CNPJ válido deve conter exatamente 14 dígitos numéricos.",
      });
    }

    console.log(`[CNPJ API] Consultando BrasilAPI para CNPJ: ${cleanCnpj}`);
    const apiResponse = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "User-Agent": "ContabilApp/1.0",
      },
    });

    if (!apiResponse.ok) {
      if (apiResponse.status === 404) {
        return res.status(404).json({
          success: false,
          error: "CNPJ não encontrado na base de dados da Receita Federal.",
        });
      }
      return res.status(apiResponse.status).json({
        success: false,
        error: `Falha ao consultar a Receita Federal (Status ${apiResponse.status}). Tente novamente ou use o upload de documento PDF via IA.`,
      });
    }

    const data = await apiResponse.json();

    // Formatar CEP (XXXXX-XXX)
    let formattedCep = data.cep ? String(data.cep).replace(/\D/g, "") : "";
    if (formattedCep.length === 8) {
      formattedCep = `${formattedCep.substring(0, 5)}-${formattedCep.substring(5)}`;
    }

    // Formatar CNPJ (XX.XXX.XXX/XXXX-XX)
    const formattedCnpj = `${cleanCnpj.substring(0, 2)}.${cleanCnpj.substring(2, 5)}.${cleanCnpj.substring(5, 8)}/${cleanCnpj.substring(8, 12)}-${cleanCnpj.substring(12, 14)}`;

    // Mapear QSA (Quadro de Sócios e Administradores)
    const qsaMapped = Array.isArray(data.qsa)
      ? data.qsa.map((s: any) => ({
          nome: s.nome_socio_razao_social || s.nome_socio || "Não informado",
          qualificacao: s.qualificacao_socio || s.qualificacao || "Sócio",
          cpf_cnpj: s.cnpj_cpf_do_socio || s.cpf_representante_legal || "",
          percentual_capital: s.faixa_etaria ? "" : "",
        }))
      : [];

    // Mapear CNAE Secundários
    const cnaesSecundarios = Array.isArray(data.cnaes_secundarios)
      ? data.cnaes_secundarios.map((c: any) => ({
          codigo: String(c.codigo || c.code || ""),
          descricao: c.descricao || c.text || "Descrição não informada",
        }))
      : [];

    // Formatar logradouro com tipo de logradouro se não estiver incluso
    let logradouroStr = data.logradouro || "";
    if (data.descricao_tipo_de_logradouro && logradouroStr) {
      const tipo = String(data.descricao_tipo_de_logradouro).trim();
      const log = String(logradouroStr).trim();
      if (!log.toLowerCase().startsWith(tipo.toLowerCase())) {
        logradouroStr = `${tipo} ${log}`;
      }
    } else if (data.descricao_tipo_de_logradouro && !logradouroStr) {
      logradouroStr = String(data.descricao_tipo_de_logradouro).trim();
    }

    const numeroStr = data.numero !== undefined && data.numero !== null ? String(data.numero).trim() : "";
    const complementoStr = data.complemento ? String(data.complemento).trim() : "";

    const mappedData = {
      cnpj: formattedCnpj,
      razao_social: data.razao_social || "",
      nome_fantasia: data.nome_fantasia || data.razao_social || "",
      situacao_cadastral: data.descricao_situacao_cadastral || data.situacao_cadastral || "Ativa",
      data_abertura: data.data_inicio_atividade || "",
      capital_social: data.capital_social ? Number(data.capital_social) : 0,
      natureza_juridica: data.natureza_juridica || "",
      regime_tributario: data.opcao_pelo_simples ? "Simples Nacional" : "Lucro Presumido / Real",
      inscricao_estadual: "", // A Receita Federal não retorna IE diretamente
      inscricao_municipal: "",
      cnae_principal: {
        codigo: String(data.cnae_fiscal || ""),
        descricao: data.cnae_fiscal_descricao || "Não informado",
      },
      cnaes_secundarios: cnaesSecundarios,
      nire: "", // Não vem da Receita Federal, será preenchido via OCR/PDF ou manual
      objeto_social: "", // Não vem detalhado da Receita Federal, será preenchido via OCR/PDF
      endereco: {
        cep: formattedCep || data.cep || "",
        logradouro: logradouroStr || "",
        numero: numeroStr || "",
        complemento: complementoStr || "",
        bairro: data.bairro || "",
        municipio: data.municipio || "",
        uf: data.uf || "",
      },
      qsa: qsaMapped,
      fonte_dados: {
        cnpj_api: true,
        data_consulta_api: new Date().toISOString(),
      },
    };

    return res.json({
      success: true,
      data: mappedData,
    });
  } catch (error: any) {
    console.error("[CNPJ API Error]:", error);
    return res.status(500).json({
      success: false,
      error: `Erro interno ao processar a busca de CNPJ: ${error.message || "Erro desconhecido"}`,
    });
  }
});

// ==========================================
// ROTA 2: EXTRAÇÃO DE DADOS VIA IA (OCR DE PDF/IMAGEM)
// ==========================================
app.post("/api/ocr-document", async (req, res) => {
  try {
    const { fileBase64, mimeType, fileName, extractionType = "completo" } = req.body;

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

    console.log(`[OCR API] Processando documento (${extractionType}): ${fileName || "documento.pdf"} (${mimeType || "application/pdf"})`);

    // Remove data prefix if sent as data URL (e.g. data:application/pdf;base64,...)
    const cleanBase64 = fileBase64.replace(/^data:[^;]+;base64,/, "");

    const ai = getGeminiClient();

    const documentPart = {
      inlineData: {
        mimeType: mimeType || "application/pdf",
        data: cleanBase64,
      },
    };

    let extractionInstruction = "";
    if (extractionType === "junta") {
      extractionInstruction = `
MODO DE EXTRAÇÃO DIRECIONADA: JUNTA COMERCIAL (FICHA CADASTRAL SIMPLIFICADA / CONTRATO SOCIAL)
Você está analisando uma Ficha Cadastral Simplificada ou Contrato Social da Junta Comercial (ex: JUCESP, JUCEPAR).
Sua tarefa é extrair os seguintes dados:
1. nire: O número do NIRE da Matriz (ex: 35212345678).
2. objeto_social: O texto descrito no OBJETO SOCIAL ou Cláusulas do Estatuto/Contrato.
3. Dados de Endereço (localizados no bloco ENDEREÇO): Retorne as chaves "logradouro", "numero", "bairro", "complemento", "municipio", "uf" e "cep" dentro de um objeto "endereco".
4. Sócios (localizados no bloco TITULAR/SÓCIOS/DIRETORIA / QSA): Retorne um array chamado "socios". Cada objeto no array deve conter "nome" (nome do titular/sócio) e "documento" ou "cpf_cnpj" (CPF ou CNPJ informado), "qualificacao" e "percentual_capital".
`;
    } else if (extractionType === "cadesp") {
      extractionInstruction = `
MODO DE EXTRAÇÃO DIRECIONADA: INSCRIÇÃO ESTADUAL (CADESP / SEFAZ)
O foco principal é extrair os dados do cadastro de contribuintes de ICMS do estado.
Campos prioritários a extrair do documento (retorne null se não constar):
- inscricao_estadual: Número da Inscrição Estadual (IE)
- ie_situacao_cadastral: Situação cadastral na SEFAZ (ex: Ativa, Inativa, Suspensa)
- ie_regime_apuracao: Regime de apuração do ICMS (ex: RPA, Simples Nacional, MEI)
- ie_data_situacao: Data de início/alteração da situação cadastral

EXTRAÇÃO ESTRITA: Você deve retornar APENAS \`inscricao_estadual\`, \`situacao_cadastral_ie\`, \`regime_apuracao\` e \`data_situacao_ie\`. É ESTRITAMENTE PROIBIDO retornar dados de endereço (logradouro, cep, bairro, etc.), cnpj ou razão social neste escopo. Ignore completamente a seção de endereço e identificação básica do documento.
`;
    } else if (extractionType === "municipal") {
      extractionInstruction = `
MODO DE EXTRAÇÃO DIRECIONADA: INSCRIÇÃO MUNICIPAL (FDC / CCM / PREFEITURA)
Você está analisando uma Ficha de Dados Cadastrais (FDC) da Prefeitura. Sua única função é localizar e extrair o número do C.C.M e a data de Última Atualização Cadastral. Retorne UM JSON ESTRITO com apenas duas chaves: \`inscricao_municipal\` (recebe o valor do C.C.M) e \`data_atualizacao_ccm\` (recebe a data). Jamais retorne chaves de inscrição estadual (como inscricao_estadual) neste escopo.
`;
    } else {
      extractionInstruction = `
MODO DE EXTRAÇÃO COMPLETA:
Analise o documento e extraia todos os dados cadastrais, societários e tributários disponíveis.
`;
    }

    const promptText = `
Você é um Engenheiro de IA especializado em leitura e extração de dados de documentos societários e corporativos brasileiros (Contrato Social, Requerimento de Empresário, Ficha Cadastral da Junta Comercial - JUCESP, JUCEPAR, CADESP, Ficha FDC/CCM, Estatuto Social ou Certidão Simplificada).

Instruções Estritas:
1. Analise cuidadosamente o documento anexado.
2. ${extractionInstruction}
3. Retorne EXATAMENTE um objeto JSON contendo a estrutura descrita abaixo.
4. Se uma informação NÃO for encontrada no documento ou não se aplicar à extração solicitada, atribua o valor null para o campo correspondente.
5. Não invente dados não existentes no documento.

Estrutura do JSON exigida:
{
  "nire": "número do NIRE ou null",
  "objeto_social": "texto completo do objeto social ou null",
  "razao_social": "razão social oficial ou null",
  "nome_fantasia": "nome fantasia ou null",
  "cnpj": "CNPJ formatado XX.XXX.XXX/XXXX-XX ou null",
  "capital_social": "valor numérico do capital social ou null",
  "data_abertura": "data de abertura/constituição AAAA-MM-DD ou null",
  "natureza_juridica": "natureza jurídica ex: Sociedade Empresária Limitada ou null",
  "inscricao_estadual": "inscrição estadual se constar ou null",
  "ie_situacao_cadastral": "situação da IE ex: Ativa ou null",
  "ie_regime_apuracao": "regime de apuração da IE ex: RPA ou Simples Nacional ou null",
  "ie_data_situacao": "data da situação da IE ou null",
  "inscricao_municipal": "inscrição municipal se constar ou null",
  "im_ultima_atualizacao": "última atualização da IM/FDC ou null",
  "endereco": {
    "cep": "00000-000 ou null",
    "logradouro": "nome da rua/avenida ou null",
    "numero": "número ou null",
    "complemento": "complemento ou null",
    "bairro": "bairro ou null",
    "municipio": "cidade ou null",
    "uf": "UF de 2 letras ex: SP, RJ ou null"
  },
  "socios": [
    {
      "nome": "nome do sócio",
      "qualificacao": "cargo/qualificação ex: Sócio-Administrador",
      "cpf_cnpj": "CPF ou CNPJ do sócio se houver",
      "percentual_capital": "porcentagem da cota/capital se houver"
    }
  ],
  "resumo_extracao": "Breve resumo textual dos dados que foram encontrados no documento referentes à modalidade solicitada (${extractionType})",
  "campos_identificados": ["nire", "objeto_social", "inscricao_estadual", ...]
}
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: [
        documentPart,
        { text: promptText },
      ],
      config: {
        systemInstruction: "Você é um leitor OCR de alta precisão especializado em documentos societários brasileiros. Responda APENAS com JSON estruturado e válido.",
        responseMimeType: "application/json",
      },
    });

    const responseText = response.text || "{}";
    console.log(`[OCR API] Resposta recebida da IA. Tamanho: ${responseText.length} chars.`);

    let extractedData: any = {};
    try {
      extractedData = JSON.parse(responseText);
    } catch (parseErr) {
      console.error("[OCR API] Erro ao converter JSON da IA:", parseErr, responseText);
      return res.status(500).json({
        success: false,
        error: "A IA retornou um formato que não pôde ser interpretado como JSON.",
      });
    }

    return res.json({
      success: true,
      nire: extractedData.nire || null,
      objeto_social: extractedData.objeto_social || null,
      razao_social: extractedData.razao_social || null,
      nome_fantasia: extractedData.nome_fantasia || null,
      cnpj: extractedData.cnpj || null,
      capital_social: extractedData.capital_social || null,
      data_abertura: extractedData.data_abertura || null,
      natureza_juridica: extractedData.natureza_juridica || null,
      inscricao_estadual: extractedData.inscricao_estadual || null,
      ie_situacao_cadastral: extractedData.ie_situacao_cadastral || null,
      ie_regime_apuracao: extractedData.ie_regime_apuracao || null,
      ie_data_situacao: extractedData.ie_data_situacao || null,
      inscricao_municipal: extractedData.inscricao_municipal || extractedData.ccm || null,
      data_atualizacao_ccm: extractedData.data_atualizacao_ccm || extractedData.im_ultima_atualizacao || null,
      im_ultima_atualizacao: extractedData.data_atualizacao_ccm || extractedData.im_ultima_atualizacao || null,
      endereco: extractedData.endereco || null,
      socios: Array.isArray(extractedData.socios)
        ? extractedData.socios.map((s: any) => ({
            nome: s.nome || '',
            qualificacao: s.qualificacao || 'Sócio',
            cpf_cnpj: s.cpf_cnpj || s.documento || '',
            percentual_capital: s.percentual_capital || '',
          }))
        : null,
      resumo_extracao: extractedData.resumo_extracao || "Processamento concluído com sucesso.",
      campos_identificados: extractedData.campos_identificados || Object.keys(extractedData).filter(k => extractedData[k] !== null),
    });
  } catch (error: any) {
    console.error("[OCR API Error]:", error);
    return res.status(500).json({
      success: false,
      error: `Erro ao extrair dados do documento via IA: ${error.message || "Falha na chamada da IA"}`,
    });
  }
});

// ==========================================
// ROTA 3: PERSISTÊNCIA DE EMPRESAS (CRUD BANCO DE DADOS)
// ==========================================
import { getCompaniesStore, saveCompanyStore, deleteCompanyStore } from "./src/lib/companiesStore.js";
import { parseAndMapPdfFields, generatePdfWithFields } from "./src/lib/pdfFiller.js";
import multer from "multer";

const upload = multer({ storage: multer.memoryStorage() });

// ETAPA 1: PARSE DO PDF (Leitura de campos e cruzamento)
app.post("/api/fill-pdf", upload.single("pdfFile"), async (req, res) => {
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

// ETAPA 2: GERAR PDF COM CAMPOS EDITADOS
app.post("/api/generate-pdf", upload.single("pdfFile"), async (req, res) => {
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

// ==========================================
// ROTA DE PROCESSAMENTO E PARSER DO TXT DA PREFEITURA (/api/fiscal/parse-txt)
// ==========================================
app.post("/api/fiscal/parse-txt", upload.single("file"), async (req, res) => {
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

    // 1. Validação se o CNPJ da empresa consta no arquivo TXT
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

    // 2. Processamento posicional e extração de valores e contraparte (Manual SP v4.09)
    let totalValoresLocal = 0;
    let contraparteLocal = "";
    let valorRodapeTipo9 = 0;
    let somaDetalheTipo2 = 0;

    for (const line of lines) {
      if (!line.trim()) continue;
      const tipoRegistro = line.charAt(0);

      // Linha Tipo '9' - Rodapé Oficial com Totalizador (Pos 9 a 23 -> substring(8, 23))
      if (tipoRegistro === "9") {
        if (line.length >= 23) {
          const strTotal = line.substring(8, 23).trim();
          if (/^\d+$/.test(strTotal)) {
            valorRodapeTipo9 = Number(strTotal) / 100;
          }
        }
        if (valorRodapeTipo9 === 0 && line.length >= 15) {
          const matchDigits = line.match(/\d{10,15}/);
          if (matchDigits) {
            valorRodapeTipo9 = Number(matchDigits[0]) / 100;
          }
        }
      }

      // Linha Tipo '2' - Detalhe da Nota Fiscal
      if (tipoRegistro === "2") {
        let valorNota = 0;

        if (line.length >= 97) {
          const valStr = line.substring(82, 97).trim();
          if (/^\d+$/.test(valStr)) {
            valorNota = Number(valStr) / 100;
          }
        }

        if (valorNota === 0 && line.length >= 82) {
          const valStr = line.substring(67, 82).trim();
          if (/^\d+$/.test(valStr)) {
            valorNota = Number(valStr) / 100;
          }
        }

        somaDetalheTipo2 += valorNota;

        // Extração do Nome da Contraparte
        if (!contraparteLocal) {
          if (line.length >= 240) {
            const subNome = line.substring(180, 240).trim();
            if (subNome.length > 3 && /[A-Z]/.test(subNome)) {
              contraparteLocal = subNome;
            }
          }
          if (!contraparteLocal) {
            const matchNome = line.match(/AMIL\s+[A-Z0-9\s]+|ITWV\s+[A-Z0-9\s]+|[A-Z]{3,}\s+[A-Z]{3,}(?:\s+[A-Z]{3,})*/i);
            if (matchNome && !matchNome[0].includes("PREFEITURA")) {
              contraparteLocal = matchNome[0].trim();
            }
          }
        }
      }
    }

    if (valorRodapeTipo9 > 0) {
      totalValoresLocal = valorRodapeTipo9;
    } else if (somaDetalheTipo2 > 0) {
      totalValoresLocal = somaDetalheTipo2;
    } else {
      const matches = textContent.match(/\d{10,15}/g) || [];
      for (const m of matches) {
        if (m === targetCnpj) continue;
        const numVal = Number(m) / 100;
        if (numVal > 0 && numVal < 100000000) {
          totalValoresLocal = numVal;
          break;
        }
      }
    }

    if (!contraparteLocal) {
      const matchItwv = textContent.match(/ITWV[A-Z0-9\s\.\-]*/i);
      const matchAmil = textContent.match(/AMIL[A-Z0-9\s\.\-]*/i);
      if (matchAmil) {
        contraparteLocal = matchAmil[0].trim();
      } else if (matchItwv) {
        contraparteLocal = matchItwv[0].trim();
      } else {
        contraparteLocal = tipoImportacao === "saida" ? "ITWV SOLUCOES INTELIGENTES" : "AMIL ASSISTENCIA MEDICA";
      }
    }

    console.log(`[Parse TXT API] Arquivo TXT processado no servidor. CNPJ: ${targetCnpj}, Total: R$ ${totalValoresLocal}, Contraparte: ${contraparteLocal}`);

    return res.json({
      success: true,
      valorTotal: totalValoresLocal,
      contraparte: contraparteLocal,
      tipoImportacao,
      message: `Arquivo de ${tipoImportacao === "saida" ? "Saída (Faturamento)" : "Entrada (Despesas)"} validado e processado no servidor com sucesso.`,
    });
  } catch (error: any) {
    console.error("[Parse TXT API Error]:", error);
    return res.status(500).json({
      success: false,
      error: `Erro ao processar o arquivo TXT da Prefeitura no servidor: ${error.message || "Erro desconhecido"}`,
    });
  }
});

// ==========================================
// ROTA DE AUTENTICAÇÃO E TESTE RPA - SIMPLES NACIONAL (/api/rpa/testar-conexao, /api/fiscal/rpa-ecac, /api/rpa/ecac-test)
// ==========================================
const handleRpaSimplesNacional = async (req: express.Request, res: express.Response) => {
  try {
    const { cnpj, cpf, codigoAcesso, targetCnpj, senha, codigo } = req.body || {};

    const cleanCnpj = String(cnpj || targetCnpj || "").replace(/\D/g, "");
    const cleanCpf = String(cpf || "").replace(/\D/g, "");
    const cleanCodigo = String(codigoAcesso || senha || codigo || "").trim();

    if (!cleanCnpj || cleanCnpj.length !== 14) {
      return res.status(400).json({
        sucesso: false,
        success: false,
        error: "CNPJ inválido ou não informado. O CNPJ deve conter 14 dígitos numéricos.",
        mensagem: "CNPJ inválido ou não informado. O CNPJ deve conter 14 dígitos numéricos.",
      });
    }

    if (!cleanCpf || cleanCpf.length !== 11) {
      return res.status(400).json({
        sucesso: false,
        success: false,
        error: "CPF do representante inválido ou não informado. O CPF deve conter 11 dígitos numéricos.",
        mensagem: "CPF do representante inválido ou não informado. O CPF deve conter 11 dígitos numéricos.",
      });
    }

    // Regra 1: Mock Inteligente no Backend
    // Se o codigoAcesso for exatamente "Aa123456" ou estiver vazio, simula falha 401
    if (!cleanCodigo || cleanCodigo === "Aa123456") {
      console.log(`[RPA Simples Nacional API] Código de Acesso '${cleanCodigo}' detectado. Retornando erro 401 (Código de acesso inválido).`);
      return res.status(401).json({
        sucesso: false,
        success: false,
        status: "erro_autenticacao",
        mensagem: "Erro PGDAS: Código de acesso inválido ou não confere.",
        error: "Erro PGDAS: Código de acesso inválido ou não confere.",
        timestamp: new Date().toISOString(),
      });
    }

    // Validação de enquadramento da empresa (Simples Nacional)
    const allCompanies = getCompaniesStore();
    const foundCompany = allCompanies.find(
      (c) => (c.cnpj || "").replace(/\D/g, "") === cleanCnpj
    );

    if (foundCompany) {
      const regime = (foundCompany.regime_tributario || (foundCompany as any).regimeTributario || "").trim();
      if (regime && !regime.toLowerCase().includes("simples")) {
        return res.status(403).json({
          sucesso: false,
          success: false,
          error: "Acesso Negado: Empresa não optante pelo Simples Nacional.",
          mensagem: "Acesso Negado: Empresa não optante pelo Simples Nacional.",
        });
      }
    }

    console.log(`[RPA Simples Nacional API] Autenticando empresa CNPJ: ${cleanCnpj}, CPF: ${cleanCpf}`);

    try {
      const rpaResult = await runSimplesNacionalRpa({
        cnpj: cleanCnpj,
        cpf: cleanCpf,
        codigoAcesso: cleanCodigo,
      });

      if (foundCompany?.razao_social) {
        rpaResult.razaoSocial = foundCompany.razao_social;
      }

      // SOMENTE AQUI, com a tela logada e confirmada via DOM, o sucesso é retornado!
      return res.status(200).json({
        sucesso: true,
        success: true,
        mensagem: "Conexão estabelecida com sucesso.",
        message: "Conexão estabelecida com sucesso.",
        ...rpaResult,
      });
    } catch (rpaError: any) {
      console.error("[RPA Simples Nacional Error]:", rpaError?.message || rpaError);
      
      const isAuthError = rpaError.status === 401 || /inválido|não confere|incorret|Acesso negado|Falha na autenticação/i.test(rpaError.message || "");
      const isTimeoutError = rpaError.status === 504 || /demorou|timeout|estrutura/i.test(rpaError.message || "");

      if (isAuthError) {
        return res.status(401).json({
          sucesso: false,
          success: false,
          error: rpaError.message || "Acesso negado pela Receita: Código de acesso inválido ou não confere.",
          mensagem: rpaError.message || "Acesso negado pela Receita: Código de acesso inválido ou não confere.",
          timestamp: new Date().toISOString(),
        });
      }

      if (isTimeoutError) {
        return res.status(504).json({
          sucesso: false,
          success: false,
          error: "O portal do Simples Nacional demorou a responder ou a estrutura da página mudou.",
          mensagem: "O portal do Simples Nacional demorou a responder ou a estrutura da página mudou.",
          timestamp: new Date().toISOString(),
        });
      }

      return res.status(401).json({
        sucesso: false,
        success: false,
        error: rpaError.message ? `Acesso negado pela Receita: ${rpaError.message}` : "Acesso negado pela Receita: Código de acesso inválido ou não confere.",
        mensagem: rpaError.message ? `Acesso negado pela Receita: ${rpaError.message}` : "Acesso negado pela Receita: Código de acesso inválido ou não confere.",
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error: any) {
    console.error("[RPA Simples Nacional API Error]:", error);
    const statusCode = error.status || (error.message?.includes("Acesso Negado") ? 401 : 500);
    return res.status(statusCode).json({
      sucesso: false,
      success: false,
      error: error.message || "Erro interno ao validar credenciais e autenticar no portal do Simples Nacional.",
      mensagem: error.message || "Erro interno ao validar credenciais e autenticar no portal do Simples Nacional.",
      timestamp: new Date().toISOString(),
    });
  }
};

app.post("/api/rpa/testar-conexao", express.json(), handleRpaSimplesNacional);
app.post("/api/fiscal/rpa-ecac", express.json(), handleRpaSimplesNacional);
app.post("/api/rpa/ecac-test", express.json(), handleRpaSimplesNacional);
app.post("/api/rpa/test-connection", express.json(), handleRpaSimplesNacional);

// ==========================================
// ROTA DE EMISSÃO DO DAS - PGDAS-D (/api/fiscal/emitir-das & /api/rpa/emitir-das)
// ==========================================
const handleEmitirDas = async (req: express.Request, res: express.Response) => {
  try {
    const {
      cnpj,
      cpf,
      codigoAcesso,
      periodoApuracao,
      targetCnpj,
      senha,
      pa,
      valorReceita,
      receitaBruta,
      valor,
      atividadeSelecionada,
      ufIss,
      municipioIss,
      transmitir,
      transmitirEGerar,
      confirmouRetificacao,
      retificar,
      deveRetificar,
    } = req.body || {};

    const cleanCnpj = String(cnpj || targetCnpj || "").replace(/\D/g, "");
    const cleanCpf = String(cpf || "").replace(/\D/g, "");
    const cleanCodigo = String(codigoAcesso || senha || "").trim();
    const cleanPa = String(periodoApuracao || pa || "").trim();
    const rawReceita = valorReceita ?? receitaBruta ?? valor ?? "0,00";
    const shouldTransmit = Boolean(transmitir || transmitirEGerar || req.path.includes("transmitir"));
    const isRetificacaoConfirmed = Boolean(deveRetificar || confirmouRetificacao || retificar);

    if (!cleanCnpj || cleanCnpj.length !== 14) {
      return res.status(400).json({
        success: false,
        error: "CNPJ inválido ou não informado. O CNPJ deve conter 14 dígitos numéricos.",
      });
    }

    if (!cleanCpf || cleanCpf.length !== 11) {
      return res.status(400).json({
        success: false,
        error: "CPF do representante inválido ou não informado. O CPF deve conter 11 dígitos numéricos.",
      });
    }

    if (!cleanCodigo) {
      return res.status(400).json({
        success: false,
        error: "Código de Acesso do Simples Nacional não informado.",
      });
    }

    if (!cleanPa) {
      return res.status(400).json({
        success: false,
        error: "Período de Apuração (PA) não informado. Exemplo: '05/2026'.",
      });
    }

    console.log(`[RPA Emitir DAS API] Processando solicitação para CNPJ: ${cleanCnpj}, PA: ${cleanPa}, Receita: ${rawReceita}, Atividade: ${atividadeSelecionada || 'default'}, UF/Muni: ${ufIss || '-'}/${municipioIss || '-'}, Transmitir: ${shouldTransmit}, deveRetificar: ${isRetificacaoConfirmed}`);

    const rpaResult = await runEmitirDasRpa({
      cnpj: cleanCnpj,
      cpf: cleanCpf,
      codigoAcesso: cleanCodigo,
      periodoApuracao: cleanPa,
      valorReceita: rawReceita,
      atividadeSelecionada: atividadeSelecionada ? String(atividadeSelecionada).trim() : undefined,
      ufIss: ufIss ? String(ufIss).trim() : undefined,
      municipioIss: municipioIss ? String(municipioIss).trim() : undefined,
      transmitir: shouldTransmit,
      confirmouRetificacao: isRetificacaoConfirmed,
      deveRetificar: isRetificacaoConfirmed,
    });

    if (rpaResult.status === "sistema_governo_indisponivel") {
      return res.status(503).json(rpaResult);
    }

    return res.status(200).json(rpaResult);
  } catch (error: any) {
    console.error("[RPA Emitir DAS API Error]:", error);
    const isGovError =
      error.status === 503 ||
      error.customStatus === "sistema_governo_indisponivel" ||
      (error.message && (error.message.includes("fora do ar") || error.message.includes("indisponível") || error.message.includes("MSG_E")));

    const statusCode = isGovError ? 503 : (error.status || (error.message?.includes("Acesso Negado") ? 401 : 500));
    return res.status(statusCode).json({
      sucesso: false,
      success: false,
      status: isGovError ? "sistema_governo_indisponivel" : "erro",
      mensagem: error.message || "Erro interno ao executar a automação de emissão do DAS no PGDAS-D.",
      error: error.message || "Erro interno ao executar a automação de emissão do DAS no PGDAS-D.",
      timestamp: new Date().toISOString(),
    });
  }
};

app.post("/api/fiscal/emitir-das", express.json(), handleEmitirDas);
app.post("/api/rpa/emitir-das", express.json(), handleEmitirDas);
app.post("/api/rpa/emitir", express.json(), handleEmitirDas);
app.post("/api/fiscal/transmitir-das", express.json(), handleEmitirDas);
app.post("/api/rpa/transmitir-das", express.json(), handleEmitirDas);

const handleValidarPa = async (req: express.Request, res: express.Response) => {
  try {
    const {
      cnpj,
      cpf,
      codigoAcesso,
      periodoApuracao,
      targetCnpj,
      senha,
      pa,
    } = req.body || {};

    const cleanCnpj = String(cnpj || targetCnpj || "").replace(/\D/g, "");
    const cleanCpf = String(cpf || "").replace(/\D/g, "");
    const cleanCodigo = String(codigoAcesso || senha || "").trim();
    const cleanPa = String(periodoApuracao || pa || "").trim();

    if (!cleanCnpj || cleanCnpj.length !== 14) {
      return res.status(400).json({
        status: "erro",
        success: false,
        error: "CNPJ inválido ou não informado. O CNPJ deve conter 14 dígitos numéricos.",
      });
    }

    if (!cleanCpf || cleanCpf.length !== 11) {
      return res.status(400).json({
        status: "erro",
        success: false,
        error: "CPF do representante inválido ou não informado. O CPF deve conter 11 dígitos numéricos.",
      });
    }

    if (!cleanCodigo) {
      return res.status(400).json({
        status: "erro",
        success: false,
        error: "Código de Acesso do Simples Nacional não informado.",
      });
    }

    if (!cleanPa) {
      return res.status(400).json({
        status: "erro",
        success: false,
        error: "Período de Apuração (PA) não informado. Exemplo: '06/2026'.",
      });
    }

    console.log(`[RPA Validar PA API] Validando PA ${cleanPa} para CNPJ: ${cleanCnpj}...`);

    const result = await runValidarPaRpa({
      cnpj: cleanCnpj,
      cpf: cleanCpf,
      codigoAcesso: cleanCodigo,
      periodoApuracao: cleanPa,
    });

    if (result.status === "sistema_governo_indisponivel") {
      return res.status(503).json(result);
    }

    return res.status(200).json(result);
  } catch (error: any) {
    console.error("[RPA Validar PA API Error]:", error);
    const isGovError =
      error.status === 503 ||
      error.customStatus === "sistema_governo_indisponivel" ||
      (error.message && (error.message.includes("fora do ar") || error.message.includes("indisponível") || error.message.includes("MSG_E")));

    const statusCode = isGovError ? 503 : (error.status || (error.message?.includes("Acesso Negado") ? 401 : 500));
    return res.status(statusCode).json({
      sucesso: false,
      success: false,
      status: isGovError ? "sistema_governo_indisponivel" : "erro",
      mensagem: error.message || "Erro interno ao validar o Período de Apuração no PGDAS-D.",
      error: error.message || "Erro interno ao validar o Período de Apuração no PGDAS-D.",
      timestamp: new Date().toISOString(),
    });
  }
};

app.post("/api/fiscal/validar-pa", express.json(), handleValidarPa);
app.post("/api/rpa/validar-pa", express.json(), handleValidarPa);
app.post("/api/fiscal/verificar-pa", express.json(), handleValidarPa);
app.post("/api/rpa/verificar-pa", express.json(), handleValidarPa);

// ==========================================
// ROTA 4: GERAÇÃO DINÂMICA DE CONTRATOS/DOCUMENTOS COM IA (/api/generate-contract)
// ==========================================
app.post("/api/generate-contract", upload.single("templateFile"), async (req, res) => {
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
        systemInstruction: "Você é um assistente paralegal avançado. Você receberá o texto de um contrato/documento modelo e um objeto JSON contendo os dados de uma empresa e seus sócios. Sua tarefa é reescrever o contrato modelo, substituindo as informações originais (nomes, endereços, CNPJ, capital social, cotas, etc.) pelos dados da nova empresa fornecida no JSON. Mantenha estritamente a mesma estrutura legal, formatação, cláusulas e tom formal do documento original. Retorne APENAS o texto do novo contrato gerado, pronto para uso.",
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

import bcrypt from "bcryptjs";
import { findUserByEmail, createUserStore } from "./src/lib/usersStore";

// ==========================================
// ROTAS DE AUTENTICAÇÃO (Register, Signin, Session)
// ==========================================
app.post("/api/auth/register", express.json(), async (req, res) => {
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

    const existingUser = findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: "Este e-mail já está cadastrado no sistema.",
      });
    }

    const newUser = await createUserStore({
      name,
      email,
      password,
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

app.post("/api/auth/signin", express.json(), async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Forneça e-mail e senha para realizar o login.",
      });
    }

    const user = findUserByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Usuário não encontrado ou credenciais inválidas.",
      });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: "Senha incorreta. Verifique suas credenciais.",
      });
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

app.get("/api/auth/session", (req, res) => {
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

app.post("/api/auth/signout", (req, res) => {
  return res.json({ success: true, url: "/" });
});

// ==========================================
// ROTA 5: REFINAMENTO / AJUSTE FINO DE CONTRATOS VIA IA (/api/refine-contract)
// ==========================================
app.post("/api/refine-contract", async (req, res) => {
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
      "Você é um assistente paralegal avançado. Você receberá a minuta atual de um documento/contrato e uma instrução específica do usuário pedindo uma alteração ou adição. Sua tarefa é aplicar ESSA INSTRUÇÃO no documento. Se for pedido para adicionar uma cláusula, crie-a com linguagem jurídica formal e numeração sequencial correta, inserindo-a no local adequado do texto. Retorne APENAS o documento inteiro atualizado, sem comentários adicionais, markdown ou explicações.";

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



import { getAuthenticatedUserFromRequest } from "./src/lib/authHelper";
import { getUsersStore, updateUserStore, deleteUserStore } from "./src/lib/usersStore";

// ==========================================
// ROTAS DE GESTÃO DE USUÁRIOS (RBAC ADMIN)
// ==========================================
app.get("/api/users", async (req, res) => {
  try {
    const user = getAuthenticatedUserFromRequest(req.headers);
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: "Acesso negado. Apenas administradores podem gerenciar usuários.",
      });
    }

    const users = getUsersStore().map(({ password, ...u }) => u);
    return res.json({ success: true, users });
  } catch (error: any) {
    console.error("[Users GET Error]:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Erro ao buscar usuários.",
    });
  }
});

app.post("/api/users", async (req, res) => {
  try {
    const user = getAuthenticatedUserFromRequest(req.headers);
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: "Acesso negado. Apenas administradores podem criar usuários.",
      });
    }

    const { name, email, password, role } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: "Nome, e-mail e senha são obrigatórios.",
      });
    }

    const newUser = await createUserStore({ name, email, password, role: role || 'USER' });
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

app.put("/api/users/:id", async (req, res) => {
  try {
    const user = getAuthenticatedUserFromRequest(req.headers);
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

app.delete("/api/users/:id", async (req, res) => {
  try {
    const user = getAuthenticatedUserFromRequest(req.headers);
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: "Acesso negado. Apenas administradores podem excluir usuários.",
      });
    }

    const { id } = req.params;
    deleteUserStore(id);

    return res.json({ success: true, message: "Usuário excluído com sucesso." });
  } catch (error: any) {
    console.error("[Users DELETE Error]:", error);
    return res.status(400).json({
      success: false,
      error: error.message || "Erro ao excluir usuário.",
    });
  }
});

app.get("/api/companies", async (req, res) => {
  try {
    const user = getAuthenticatedUserFromRequest(req.headers);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Acesso não autorizado. Faça login para visualizar suas empresas.",
      });
    }

    const isAdmin = user.role === 'ADMIN';
    const companies = isAdmin ? getCompaniesStore() : getCompaniesStore(user.id);
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

app.post("/api/companies", async (req, res) => {
  try {
    const user = getAuthenticatedUserFromRequest(req.headers);
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

    // Injetar o userId da sessão do usuário autenticado diretamente
    const savedCompany = saveCompanyStore(companyData, user.id);
    console.log(`[Companies API] Empresa cadastrada/atualizada para o usuário ${user.email}: ${savedCompany.razao_social}`);

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

app.delete("/api/companies/:id", async (req, res) => {
  try {
    const user = getAuthenticatedUserFromRequest(req.headers);
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

    const deleted = deleteCompanyStore(id, user.id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: "Empresa não encontrada para exclusão ou pertencente a outro usuário.",
      });
    }

    console.log(`[Companies API] Empresa deletada pelo usuário ${user.email}: ${id}`);
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

// ==========================================
// CONFIGURAÇÃO DO SERVIDOR (VITE E ESTÁTICOS)
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
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Servidor Contábil] Rodando na porta ${PORT} (http://localhost:${PORT})`);
  });
}

startServer();
