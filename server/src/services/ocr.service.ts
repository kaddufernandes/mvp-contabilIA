import { getGeminiClient } from "../config/gemini";

export interface OcrExtractionParams {
  fileBase64: string;
  mimeType?: string;
  fileName?: string;
  extractionType?: string;
}

export async function processDocumentOcr(params: OcrExtractionParams) {
  const { fileBase64, mimeType, fileName, extractionType = "completo" } = params;

  if (!fileBase64) {
    throw new Error("Arquivo não enviado ou formato inválido.");
  }

  console.log(`[OCR Service] Processando documento (${extractionType}): ${fileName || "documento.pdf"} (${mimeType || "application/pdf"})`);

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

EXTRAÇÃO ESTRITA: Você deve retornar APENAS \`inscricao_estadual\`, \`situacao_cadastral_ie\`, \`regime_apuracao\` e \`data_situacao_ie\`. É ESTRITAMENTE PROIBIDO retornar dados de endereço, cnpj ou razão social neste escopo.
`;
  } else if (extractionType === "municipal") {
    extractionInstruction = `
MODO DE EXTRAÇÃO DIRECIONADA: INSCRIÇÃO MUNICIPAL (FDC / CCM / PREFEITURA)
Você está analisando uma Ficha de Dados Cadastrais (FDC) da Prefeitura. Sua única função é localizar e extrair o número do C.C.M e a data de Última Atualização Cadastral. Retorne UM JSON ESTRITO com apenas duas chaves: \`inscricao_municipal\` (recebe o valor do C.C.M) e \`data_atualizacao_ccm\` (recebe a data).
`;
  } else {
    extractionInstruction = `
MODO DE EXTRAÇÃO COMPLETA:
Analise o documento e extraia todos os dados cadastrais, societários e tributários disponíveis.
`;
  }

  const promptText = `
Você é um Engenheiro de IA especializado em leitura e extração de dados de documentos societários e corporativos brasileiros.

Instruções Estritas:
1. Analise cuidadosamente o documento anexado.
2. ${extractionInstruction}
3. Retorne EXATAMENTE um objeto JSON contendo a estrutura descrita abaixo.
4. Se uma informação NÃO for encontrada no documento, atribua o valor null.
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
  "resumo_extracao": "Breve resumo textual dos dados encontrados",
  "campos_identificados": ["nire", "objeto_social", ...]
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
  let extractedData: any = {};
  try {
    extractedData = JSON.parse(responseText);
  } catch (parseErr) {
    console.error("[OCR Service] Erro ao converter JSON da IA:", parseErr, responseText);
    throw new Error("A IA retornou um formato que não pôde ser interpretado como JSON.");
  }

  return {
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
  };
}
