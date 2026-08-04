export interface CnpjResult {
  status: number;
  success: boolean;
  data?: any;
  error?: string;
}

export async function fetchCnpjData(rawCnpj: string): Promise<CnpjResult> {
  const cleanCnpj = (rawCnpj || "").replace(/\D/g, "");

  if (cleanCnpj.length !== 14) {
    return {
      status: 400,
      success: false,
      error: "CNPJ inválido. Um CNPJ válido deve conter exatamente 14 dígitos numéricos.",
    };
  }

  console.log(`[BrasilAPI Service] Consultando CNPJ: ${cleanCnpj}`);
  const apiResponse = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`, {
    method: "GET",
    headers: {
      "Accept": "application/json",
      "User-Agent": "ContabilApp/1.0",
    },
  });

  if (!apiResponse.ok) {
    if (apiResponse.status === 404) {
      return {
        status: 404,
        success: false,
        error: "CNPJ não encontrado na base de dados da Receita Federal.",
      };
    }
    return {
      status: apiResponse.status,
      success: false,
      error: `Falha ao consultar a Receita Federal (Status ${apiResponse.status}). Tente novamente ou use o upload de documento PDF via IA.`,
    };
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

  // Formatar logradouro
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
    inscricao_estadual: "",
    inscricao_municipal: "",
    cnae_principal: {
      codigo: String(data.cnae_fiscal || ""),
      descricao: data.cnae_fiscal_descricao || "Não informado",
    },
    cnaes_secundarios: cnaesSecundarios,
    nire: "",
    objeto_social: "",
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

  return {
    status: 200,
    success: true,
    data: mappedData,
  };
}
