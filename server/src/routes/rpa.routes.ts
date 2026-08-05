import { Router, Request, Response } from 'express';
// Importação do seu robô original feito em Playwright corrigida com o nome exato da função
import { runEmitirDasRpa } from '../../../src/services/rpa/emitirDasRpa';

const router = Router();

/**
 * Função controladora para a emissão fiscal via Playwright
 */
const handleFiscalEmissao = async (req: Request, res: Response) => {
  try {
    const { cnpj, cpf, codigoAcesso, senha, periodo, receita } = req.body;

    // Aceita tanto 'codigoAcesso' quanto 'senha' (frontend envia como 'senha')
    const codigoFinal = codigoAcesso || senha;

    // Validação básica de segurança
    if (!cnpj || !cpf || !codigoFinal) {
      return res.status(400).json({ 
        success: false, 
        error: 'Dados obrigatórios ausentes. Verifique se o CNPJ, CPF e Código de Acesso foram informados.' 
      });
    }

    console.log(`[RPA] Iniciando automação via Playwright/Chromium para o CNPJ: ${cnpj}`);

    // Executa o robô do Playwright mapeando as variáveis da requisição 
    // para os nomes que a interface EmitirDasParams espera
    const resultado = await runEmitirDasRpa({
      cnpj,
      cpf,
      codigoAcesso: codigoFinal,
      periodoApuracao: periodo,
      valorReceita: receita
    });

    // Tratamento da resposta do robô
    if (resultado.success || resultado.sucesso) {
      console.log(`[RPA] Sucesso na emissão para o CNPJ: ${cnpj}`);
      return res.status(200).json({
        success: true,
        message: resultado.mensagem || 'Imposto calculado com sucesso (Motor Chromium)',
        dadosCalculados: resultado.dadosCalculados,
        valorDas: resultado.valorDas
      });
    } else {
      console.warn(`[RPA] Falha na emissão para o CNPJ: ${cnpj}`);
      return res.status(400).json({
        success: false,
        // @ts-ignore - Proteção extra de tipagem
        error: resultado.erro || 'Falha na automação durante o acesso ao portal e-CAC.'
      });
    }

  } catch (error: any) {
    console.error('[RPA Error] Erro crítico na rota de emissão:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Erro interno no servidor RPA: ' + (error.message || 'Falha desconhecida no Chromium') 
    });
  }
};

// ==========================================
// MAPEAMENTO DE ROTAS (ENDPOINTS)
// ==========================================

// Rota POST que o frontend acessa via fetch('/api/rpa/emissao')
router.post('/emissao', handleFiscalEmissao);

// Caso tenha outras automações (como certidões, FGTS), você pode adicionar novas rotas abaixo:
// router.post('/certidao-fgts', handleCertidaoFgts);

export default router;