import { chromium, Browser, BrowserContext, Page } from 'playwright';

export interface SimplesNacionalRpaParams {
  cnpj: string;
  cpf: string;
  codigoAcesso: string;
}

export interface SimplesNacionalRpaResult {
  success: boolean;
  cnpj: string;
  cpf: string;
  timestamp: string;
  message?: string;
  error?: string;
}

export async function runSimplesNacionalRpa(
  params: SimplesNacionalRpaParams
): Promise<SimplesNacionalRpaResult> {
  const cleanCnpj = params.cnpj.replace(/\D/g, '');
  const cleanCpf = params.cpf.replace(/\D/g, '');
  const cleanCodigo = params.codigoAcesso.trim();
  const timestamp = new Date().toISOString();

  if (!cleanCnpj || cleanCnpj.length !== 14) throw new Error('CNPJ inválido. Forneça 14 dígitos numéricos.');
  if (!cleanCpf || cleanCpf.length !== 11) throw new Error('CPF do representante inválido. Forneça 11 dígitos numéricos.');
  if (!cleanCodigo || cleanCodigo.length !== 12) throw new Error('O Código de Acesso do Simples Nacional deve ter EXATAMENTE 12 caracteres.');

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  console.log(`[RPA Simples Nacional] Iniciando acesso limpo... CNPJ: ${cleanCnpj}`);

  try {
    browser = await chromium.launch({
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--start-maximized'
      ],
    });

    context = await browser.newContext({
      viewport: null,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    page = await context.newPage();
    page.setDefaultNavigationTimeout(300000);
    page.setDefaultTimeout(300000);

    const portalUrl = 'https://www8.receita.fazenda.gov.br/SimplesNacional/Servicos/Grupo.aspx?grp=t&area=1';
    await page.goto(portalUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(2000);

    await page.evaluate(() => {
      const btnLimpar = document.getElementById('btLimpar');
      if (btnLimpar) btnLimpar.remove();
    });

    const cnpjField = page.locator('.txt-cnpj').first();
    const cpfField = page.locator('.txt-cpf').first();
    const codigoField = page.locator('.txt-codacesso').first();

    if ((await cnpjField.count()) === 0) {
      throw new Error('Não foi possível localizar os campos de login na tela.');
    }

    console.log('[RPA Simples Nacional] Preenchendo credenciais...');
    
    await cnpjField.focus();
    await cnpjField.pressSequentially(cleanCnpj, { delay: 60 });
    
    await cpfField.focus();
    await cpfField.pressSequentially(cleanCpf, { delay: 60 });
    
    await codigoField.focus();
    await codigoField.pressSequentially(cleanCodigo, { delay: 60 });

    await page.waitForFunction(() => {
      const btn = document.querySelector('.btn-continuar') as HTMLInputElement;
      return btn && btn.disabled === false;
    }, { timeout: 15000 }).catch(() => {
      throw new Error('A Receita Federal não validou os dados digitados e manteve o botão travado.');
    });

    await page.waitForTimeout(1000);

    const btnContinuar = page.locator('.btn-continuar').first();
    await btnContinuar.click({ force: true }).catch(async () => {
      await btnContinuar.evaluate(b => b.click());
    });

    console.log('🚨 ATENÇÃO: Resolva o CAPTCHA! O robô vai aguardar o login. 🚨');
    
    await page.waitForFunction(() => {
      const formLogin = document.getElementById('authFormContainer');
      if (!formLogin) return true;

      const textoTexto = document.body.innerText.toLowerCase();
      if (textoTexto.includes('código de acesso inválido') || 
          textoTexto.includes('não confere') || 
          textoTexto.includes('dados informados não conferem') ||
          textoTexto.includes('acesso negado')) {
        return true;
      }
      return false;
    }, { timeout: 300000 }).catch(() => {
      throw new Error('Tempo de 5 minutos esgotado. O Captcha não foi resolvido a tempo.');
    });

    const bodyText = await page.innerText('body').catch(() => '');
    if (/código de acesso inválido|não confere|incorret|dados informados não conferem|acesso negado/i.test(bodyText)) {
      const err = new Error('Acesso Negado: Código de Acesso, CNPJ ou CPF estão incorretos.');
      (err as any).status = 401; 
      throw err;
    }

    console.log('[RPA Simples Nacional] Sucesso absoluto!');

    return {
      success: true,
      cnpj: cleanCnpj,
      cpf: cleanCpf,
      timestamp,
      message: '200 OK (Sessão Ativa - Prova de Vida OK)',
    };
  } catch (err: any) {
    console.error('[RPA Simples Nacional Error]:', err);
    throw err;
  } finally {
    if (browser) {
      await new Promise(r => setTimeout(r, 4000));
      await browser.close().catch(() => {});
    }
  }
}