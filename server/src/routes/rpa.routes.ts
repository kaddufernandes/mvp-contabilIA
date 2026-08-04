import { Router, Request, Response } from "express";
import { runSimplesNacionalRpa } from "../../../src/services/rpa/simplesNacionalRpa";
import { runEmitirDasRpa, runValidarPaRpa } from "../../../src/services/rpa/emitirDasRpa";
import { getCompaniesStore } from "../../../src/lib/companiesStore";
import { GovBrClient } from "../../../src/services/GovBrClient";

const router = Router();

const handleRpaSimplesNacional = async (req: Request, res: Response) => {
  try {
    const { cnpj, cpf, codigoAcesso, targetCnpj, senha } = req.body || {};

    const cleanCnpj = String(cnpj || targetCnpj || "").replace(/\D/g, "");
    const cleanCpf = String(cpf || "").replace(/\D/g, "");
    const cleanCodigo = String(codigoAcesso || senha || "").trim();

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

    if (!cleanCodigo) {
      return res.status(400).json({
        sucesso: false,
        success: false,
        error: "Código de Acesso do Simples Nacional não informado.",
        mensagem: "Código de Acesso do Simples Nacional não informado.",
      });
    }

    const allCompanies = await getCompaniesStore();
    const foundCompany = allCompanies.find((c: any) => {
      const cCnpj = String(c.cnpj || "").replace(/\D/g, "");
      return cCnpj === cleanCnpj;
    });

    console.log(`[RPA Simples Nacional API] Autenticando empresa CNPJ: ${cleanCnpj}, CPF: ${cleanCpf}`);

    try {
      const rpaResult = await runSimplesNacionalRpa({
        cnpj: cleanCnpj,
        cpf: cleanCpf,
        codigoAcesso: cleanCodigo,
      });

      const razaoSocial = foundCompany?.razao_social || "Empresa Selecionada";

      return res.status(200).json({
        sucesso: true,
        success: true,
        razaoSocial,
        cnpj: rpaResult.cnpj,
        cpf: rpaResult.cpf,
        timestamp: rpaResult.timestamp,
        mensagem: rpaResult.message,
        message: rpaResult.message,
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

const handleEmitirDas = async (req: Request, res: Response) => {
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

    console.log(`[RPA Emitir DAS API] Processando solicitação para CNPJ: ${cleanCnpj}, PA: ${cleanPa}`);

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

const handleValidarPa = async (req: Request, res: Response) => {
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

// Rotas de teste de conexão e eCAC
router.post("/testar-conexao", handleRpaSimplesNacional);
router.post("/ecac-test", handleRpaSimplesNacional);
router.post("/test-connection", handleRpaSimplesNacional);

// Rotas de emissão do DAS
router.post("/emitir-das", handleEmitirDas);
router.post("/emitir", handleEmitirDas);
router.post("/transmitir-das", handleEmitirDas);

const handleFiscalEmissao = async (req: Request, res: Response) => {
  try {
    const { cpf, senha, cnpj, periodo, receita } = req.body || {};

    const cleanCpf = String(cpf || "").replace(/\D/g, "");
    const cleanCnpj = String(cnpj || "").replace(/\D/g, "");
    const cleanSenha = String(senha || "").trim();

    if (!cleanCpf || cleanCpf.length !== 11) {
      return res.status(400).json({
        sucesso: false,
        success: false,
        error: "CPF inválido. O CPF deve conter 11 dígitos numéricos.",
        mensagem: "CPF inválido. O CPF deve conter 11 dígitos numéricos.",
      });
    }

    if (!cleanSenha) {
      return res.status(400).json({
        sucesso: false,
        success: false,
        error: "Senha do Gov.br não informada.",
        mensagem: "Senha do Gov.br não informada.",
      });
    }

    const client = new GovBrClient();
    await client.iniciarSessao();
    const cpfResult = await client.enviarCpf(cleanCpf);

    if (cpfResult.exigeCaptcha) {
      return res.status(403).json({
        sucesso: false,
        success: false,
        exigeCaptcha: true,
        error: "Desafio CAPTCHA detectado no Gov.br. Por favor, resolva a barreira de verificação.",
        mensagem: "Desafio CAPTCHA detectado no Gov.br. Por favor, resolva a barreira de verificação.",
        execution: cpfResult.execution,
      });
    }

    const senhaResult = await client.enviarSenha(cleanSenha);

    if (!senhaResult.sucesso) {
      return res.status(401).json({
        sucesso: false,
        success: false,
        error: senhaResult.mensagem || "Falha ao autenticar no Gov.br com a senha fornecida.",
        mensagem: senhaResult.mensagem || "Falha ao autenticar no Gov.br com a senha fornecida.",
      });
    }

    return res.status(200).json({
      sucesso: true,
      success: true,
      mensagem: "Autenticação no Gov.br e redirecionamento ao e-CAC efetuados com sucesso via HTTP!",
      redirectUrl: senhaResult.redirectUrl,
      cnpj: cleanCnpj,
      periodo,
      receita,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[API /api/fiscal/emissao Express Error]:", error);
    return res.status(500).json({
      sucesso: false,
      success: false,
      error: error.message || "Erro interno ao processar emissão no Gov.br.",
      mensagem: error.message || "Erro interno ao processar emissão no Gov.br.",
      timestamp: new Date().toISOString(),
    });
  }
};

router.post("/emissao", handleFiscalEmissao);

// Rotas de validação do PA
router.post("/validar-pa", handleValidarPa);
router.post("/verificar-pa", handleValidarPa);

export default router;
