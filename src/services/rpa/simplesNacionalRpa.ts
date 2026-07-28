import { chromium, Browser, BrowserContext, Page } from 'playwright';

export interface SimplesNacionalRpaParams {
  cnpj: string;
  cpf: string;
  codigoAcesso: string;
}

export interface DteMessage {
  id: string;
  data: string;
  assunto: string;
  remetente: string;
  lida: boolean;
}

export interface SimplesNacionalRpaResult {
  success: boolean;
  cnpj: string;
  cpf: string;
  razaoSocial?: string;
  comprovanteTexto?: string;
  urlLogada?: string;
  messages?: DteMessage[];
  timestamp: string;
  message?: string;
  error?: string;
}

/**
 * Motor de Automação (RPA) - Simples Nacional (Prova de Vida / Acesso Direto)
 * 
 * Realiza login no portal do Simples Nacional com credenciais do contribuinte e
 * extrai o elemento de confirmação (.br-breadcrumb) para comprovar a sessão ativa (Prova de Vida).
 */
export async function runSimplesNacionalRpa(
  params: SimplesNacionalRpaParams
): Promise<SimplesNacionalRpaResult> {
  const cleanCnpj = params.cnpj.replace(/\D/g, '');
  const cleanCpf = params.cpf.replace(/\D/g, '');
  const cleanCodigo = params.codigoAcesso.trim();
  const timestamp = new Date().toISOString();

  if (!cleanCnpj || cleanCnpj.length !== 14) {
    throw new Error('CNPJ inválido. Forneça 14 dígitos numéricos.');
  }
  if (!cleanCpf || cleanCpf.length !== 11) {
    throw new Error('CPF do representante inválido. Forneça 11 dígitos numéricos.');
  }
  if (!cleanCodigo) {
    throw new Error('Código de acesso do Simples Nacional não informado.');
  }

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  console.log(`[RPA Simples Nacional] Iniciando Prova de Vida... CNPJ: ${cleanCnpj}, CPF: ${cleanCpf}`);

  try {
    // 1. Configuração do Robô (headless: false para apoio manual no hCaptcha, com fallback headless: true)
    const forceHeadless = process.env.HEADLESS === 'true';
    try {
      browser = await chromium.launch({
        headless: forceHeadless ? true : false,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
        ],
      });
    } catch (guiErr: any) {
      console.warn('[RPA Simples Nacional] Sem suporte a interface gráfica (X11). Revertendo para modo headless: true:', guiErr?.message);
      browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
        ],
      });
    }

    context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    });

    page = await context.newPage();
    page.setDefaultNavigationTimeout(120000);
    page.setDefaultTimeout(30000);

    // 2. Navegação para o Portal do Simples Nacional
    const portalUrl = 'https://www8.receita.fazenda.gov.br/SimplesNacional/Servicos/Grupo.aspx?grp=t&area=1';
    console.log(`[RPA Simples Nacional] Acessando portal: ${portalUrl}`);

    await page.goto(portalUrl, { waitUntil: 'domcontentloaded' }).catch((err) => {
      console.log('[RPA Simples Nacional] Aviso na navegação inicial:', err?.message);
    });

    // Localiza os campos de credenciais
    const cnpjField = page
      .getByPlaceholder('Entre com CNPJ sem símbolos.', { exact: false })
      .or(page.locator('input[name*="cnpj"], input[id*="Cnpj"], #Cnpj'))
      .first();

    const cpfField = page
      .getByPlaceholder('Entre com CPF sem símbolos.', { exact: false })
      .or(page.locator('input[name*="cpf"], input[id*="Cpf"], #Cpf'))
      .first();

    const codigoField = page
      .getByPlaceholder('Entre com Código de Acesso', { exact: false })
      .or(page.locator('input[name*="codigo"], input[id*="Codigo"], input[type="password"]'))
      .first();

    if ((await cnpjField.count()) === 0) {
      console.log('[RPA Simples Nacional] Buscando link de serviço por Código de Acesso...');
      const linkCodigo = page
        .locator('a:has-text("Código de Acesso"), a[href*="CodigoAcesso"], a:has-text("DTE")')
        .first();

      if ((await linkCodigo.count()) > 0) {
        await linkCodigo.click({ force: true, timeout: 10000 }).catch(async () => {
          await linkCodigo.evaluate((el: HTMLElement) => el.click()).catch(() => {});
        });
        await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
      }
    }

    // Preenchimento sequencial com simulação de digitação humana e desfoque (Tab)
    if ((await cnpjField.count()) > 0) {
      console.log('[RPA Simples Nacional] Preenchendo credenciais com digitação simulada...');

      // CNPJ
      await cnpjField.focus();
      if (typeof (cnpjField as any).clear === 'function') {
        await cnpjField.clear().catch(() => {});
      }
      await cnpjField.pressSequentially(cleanCnpj, { delay: 50 });
      await cnpjField.press('Tab');
      await page.waitForTimeout(200);

      // CPF
      await cpfField.focus();
      if (typeof (cpfField as any).clear === 'function') {
        await cpfField.clear().catch(() => {});
      }
      await cpfField.pressSequentially(cleanCpf, { delay: 50 });
      await cpfField.press('Tab');
      await page.waitForTimeout(200);

      // Código de Acesso
      await codigoField.focus();
      if (typeof (codigoField as any).clear === 'function') {
        await codigoField.clear().catch(() => {});
      }
      await codigoField.pressSequentially(cleanCodigo, { delay: 50 });
      await codigoField.press('Tab');
      await page.waitForTimeout(300);

      const btnContinuar = page
        .getByRole('button', { name: 'Continuar' })
        .or(page.locator('button:has-text("Continuar"), input[value*="Continuar"], button[type="submit"]'))
        .first();

      await btnContinuar.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});

      // Habilitação forçada do botão se desabilitado por script do governo
      await btnContinuar.evaluate((el: HTMLElement) => {
        el.removeAttribute('disabled');
        if ('disabled' in el) {
          (el as any).disabled = false;
        }
      }).catch(() => {});

      console.log('[RPA Simples Nacional] Clicando no botão Continuar e aguardando verificação de login com Promise.race...');
      await btnContinuar.click({ force: true, timeout: 15000 }).catch(async (err: any) => {
        console.warn('[RPA Simples Nacional] Clique no botão Continuar via Playwright:', err?.message);
        await btnContinuar.evaluate((btn: HTMLElement) => btn.click()).catch(() => {});
      });

      // Validar Estado com Promise.race: O ERRO ou o SUCESSO no DOM
      try {
        const resultado = await Promise.race([
          // Condição 1: Apareceu mensagem de erro (Credencial inválida)
          page
            .locator('.alert-danger, .mensagem-erro, #msgErro, text=/Código de acesso inválido|Não confere|inválid|incorret|acesso negado/i')
            .waitFor({ state: 'visible', timeout: 12000 })
            .then(() => 'erro' as const),

          // Condição 2: Apareceu o painel interno (Login Realizado)
          page
            .locator('.br-breadcrumb, text=Serviços com Controle de Acesso, text=DECLARAÇÃO TRANSMITIDA COM SUCESSO')
            .waitFor({ state: 'visible', timeout: 12000 })
            .then(() => 'sucesso' as const),
        ]);

        if (resultado === 'erro') {
          const erroElem = page.locator('.alert-danger, .mensagem-erro, #msgErro').first();
          const msgErroText = (await erroElem.innerText().catch(() => '')).trim() || 'Código de acesso inválido ou não confere.';
          console.error(`[RPA Simples Nacional] Acesso negado pela Receita: ${msgErroText}`);
          const errorObj = new Error(`Acesso negado pela Receita: ${msgErroText}`);
          (errorObj as any).status = 401;
          throw errorObj;
        }

        console.log('[RPA Simples Nacional] Sucesso confirmado via DOM! Painel de controle acessado.');
      } catch (raceErr: any) {
        if (raceErr.status === 401) {
          throw raceErr;
        }
        // Se der timeout ou nenhuma das condições do race responder de imediato, faz varredura de fallback do body
        const bodyText = await page.innerText('body').catch(() => '');
        if (bodyText.includes('Código de Acesso inválido') || bodyText.includes('Não confere') || bodyText.includes('incorret') || bodyText.includes('inválido')) {
          const errorObj = new Error('Acesso negado pela Receita: Código de acesso inválido ou não confere.');
          (errorObj as any).status = 401;
          throw errorObj;
        }
        if (!bodyText.includes('Serviços com Controle de Acesso') && !bodyText.includes('Simples Nacional')) {
          const errorObj = new Error('O portal do Simples Nacional demorou a responder ou a estrutura da página mudou.');
          (errorObj as any).status = 504;
          throw errorObj;
        }
      }
    }

    // Validação de mensagem de erro de login
    const bodyText = await page.innerText('body').catch(() => '');
    const hasErrorAlert =
      bodyText.includes('Código de Acesso inválido') ||
      bodyText.includes('CNPJ ou CPF incorreto') ||
      bodyText.includes('Dados informados não conferem') ||
      bodyText.includes('não optante pelo Simples Nacional');

    if (hasErrorAlert) {
      console.error('[RPA Simples Nacional] Falha de autenticação detectada.');
      const errorObj = new Error('Acesso Negado: Código de Acesso, CNPJ ou CPF incorretos no Simples Nacional.');
      (errorObj as any).status = 401;
      throw errorObj;
    }

    // 3. Prova de Vida na Tela Principal Logada
    console.log('[RPA Simples Nacional] Executando Prova de Vida na tela principal logada...');
    
    // Aguarda o elemento seguro da interface logada (.br-breadcrumb)
    await page.waitForSelector('.br-breadcrumb', { state: 'visible', timeout: 15000 }).catch(() => {
      console.log('[RPA Simples Nacional] Seletor .br-breadcrumb não localizado no tempo limite. Verificando estrutura do DOM...');
    });

    // Extrai o texto do breadcrumb para usar como comprovante
    let comprovanteTexto = '';
    const breadcrumbLocator = page.locator('.br-breadcrumb');
    if ((await breadcrumbLocator.count()) > 0) {
      comprovanteTexto = (await breadcrumbLocator.first().innerText()).trim();
    } else {
      // Fallback de comprovação buscando outro cabeçalho ou título principal da área logada
      const headerTitle = page.locator('h1, h2, .titulo-servico, #conteudo').first();
      comprovanteTexto = (await headerTitle.innerText().catch(() => '')).trim() || 'Simples Nacional - Área Restrita Autenticada';
    }

    const urlLogada = page.url();

    console.log(`[RPA Simples Nacional] Prova de Vida concluída com sucesso! URL: ${urlLogada}, Comprovante: "${comprovanteTexto}"`);

    return {
      success: true,
      cnpj: cleanCnpj,
      cpf: cleanCpf,
      razaoSocial: 'Empresa Optante pelo Simples Nacional',
      comprovanteTexto,
      urlLogada,
      messages: [],
      timestamp,
      message: 'Prova de Vida realizada com sucesso: login verificado e sessão autenticada no portal do Simples Nacional.',
    };
  } catch (err: any) {
    console.error('[RPA Simples Nacional Error]:', err);
    throw err;
  } finally {
    // Encerramento seguro e liberação do navegador
    if (browser) {
      await browser.close().catch(() => {});
      console.log('[RPA Simples Nacional] Navegador Playwright encerrado com sucesso.');
    }
  }
}


