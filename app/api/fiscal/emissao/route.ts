import { GovBrClient } from '../../../../src/services/GovBrClient';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { cpf, senha, cnpj, periodo, receita } = body || {};

    const cleanCpf = String(cpf || '').replace(/\D/g, '');
    const cleanCnpj = String(cnpj || '').replace(/\D/g, '');
    const cleanSenha = String(senha || '').trim();

    if (!cleanCpf || cleanCpf.length !== 11) {
      return Response.json(
        {
          sucesso: false,
          success: false,
          error: 'CPF inválido. O CPF deve conter 11 dígitos numéricos.',
          mensagem: 'CPF inválido. O CPF deve conter 11 dígitos numéricos.',
        },
        { status: 400 }
      );
    }

    if (!cleanSenha) {
      return Response.json(
        {
          sucesso: false,
          success: false,
          error: 'Senha do Gov.br não informada.',
          mensagem: 'Senha do Gov.br não informada.',
        },
        { status: 400 }
      );
    }

    // Instancia o cliente GovBrClient para automação HTTP
    const govBrClient = new GovBrClient();

    // 1. Inicia sessão no Gov.br
    await govBrClient.iniciarSessao();

    // 2. Envia o CPF e verifica se há CAPTCHA
    const cpfResult = await govBrClient.enviarCpf(cleanCpf);

    if (cpfResult.exigeCaptcha) {
      return Response.json(
        {
          sucesso: false,
          success: false,
          exigeCaptcha: true,
          error: 'Desafio CAPTCHA detectado no Gov.br. Por favor, resolva a barreira de verificação.',
          mensagem: 'Desafio CAPTCHA detectado no Gov.br. Por favor, resolva a barreira de verificação.',
          execution: cpfResult.execution,
        },
        { status: 403 }
      );
    }

    // 3. Envia a Senha
    const senhaResult = await govBrClient.enviarSenha(cleanSenha);

    if (!senhaResult.sucesso) {
      return Response.json(
        {
          sucesso: false,
          success: false,
          error: senhaResult.mensagem || 'Falha ao autenticar no Gov.br com a senha fornecida.',
          mensagem: senhaResult.mensagem || 'Falha ao autenticar no Gov.br com a senha fornecida.',
        },
        { status: 401 }
      );
    }

    return Response.json(
      {
        sucesso: true,
        success: true,
        mensagem: 'Autenticação no Gov.br e redirecionamento ao e-CAC efetuados com sucesso via HTTP!',
        redirectUrl: senhaResult.redirectUrl,
        cnpj: cleanCnpj,
        periodo,
        receita,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[API /api/fiscal/emissao Error]:', error);
    return Response.json(
      {
        sucesso: false,
        success: false,
        error: error.message || 'Erro interno ao processar emissão no Gov.br.',
        mensagem: error.message || 'Erro interno ao processar emissão no Gov.br.',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
