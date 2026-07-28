import { chromium, Browser, BrowserContext, Page } from 'playwright';
import fs from 'fs';
import path from 'path';

export interface EcacRpaParams {
  cpf: string;
  senhaGov: string;
  targetCnpj: string;
  downloadDir?: string;
  headless?: boolean;
}

export interface EcacRpaResult {
  success: boolean;
  message: string;
  downloadPath?: string;
  companyCnpj?: string;
  timestamp: string;
  error?: string;
}

/**
 * Motor de Automação RPA - e-CAC (Receita Federal) via Gov.br
 * 
 * Executa o fluxo de autenticação, troca de perfil para Representante Legal / PJ,
 * navegação até Certidões e Situação Fiscal e download do Relatório em PDF.
 */
export async function runEcacRpa(params: EcacRpaParams): Promise<EcacRpaResult> {
  const {
    cpf,
    senhaGov,
    targetCnpj,
    downloadDir = path.join(process.cwd(), 'downloads'),
    headless = process.env.HEADLESS !== 'false',
  } = params;

  const cleanCpf = cpf.replace(/\D/g, '');
  const cleanCnpj = targetCnpj.replace(/\D/g, '');
  const timestamp = new Date().toISOString();

  // Garante que a pasta de downloads exista
  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
  }

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  console.log(`[e-CAC RPA] Iniciando motor de automação... (CNPJ: ${cleanCnpj}, Headless: ${headless})`);

  try {
    // 1. Inicialização do Navegador Playwright
    browser = await chromium.launch({
      headless,
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

    context = await browser.newContext({
      acceptDownloads: true,
      viewport: { width: 1280, height: 800 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    });

    page = await context.newPage();
    page.setDefaultNavigationTimeout(60000);
    page.setDefaultTimeout(30000);

    // =========================================================================
    // ETAPA 1: Navegação e Login no Gov.br
    // =========================================================================
    console.log('[e-CAC RPA] Etapa 1: Acessando portal de autenticação e-CAC / Gov.br...');
    await page.goto('https://cav.receita.fazenda.gov.br/autenticacao/login', {
      waitUntil: 'domcontentloaded',
    });

    // Clique em "Entrar com gov.br"
    const loginGovBtn = page.locator('a:has-text("Entrar com gov.br"), button:has-text("Entrar com gov.br"), #login-dados-pessoa');
    if (await loginGovBtn.count() > 0) {
      await loginGovBtn.first().click();
    } else {
      // Fallback para clique direto no link Gov.br
      await page.click('a[href*="gov.br"]');
    }

    console.log('[e-CAC RPA] Aguardando tela de login do Gov.br...');
    await page.waitForSelector('#accountId, input[name="accountId"], #cpf', { timeout: 30000 });

    // Preenchimento do CPF
    console.log('[e-CAC RPA] Preenchendo CPF do usuário...');
    const cpfInput = page.locator('#accountId, input[name="accountId"], #cpf').first();
    await cpfInput.fill(cleanCpf);

    // Clique em Avançar
    const btnAvancar = page.locator('#enter-account-id, button:has-text("Avançar"), button:has-text("Continuar")').first();
    await btnAvancar.click();

    // Preenchimento da Senha
    console.log('[e-CAC RPA] Aguardando campo de senha do Gov.br...');
    await page.waitForSelector('#password, input[type="password"]', { timeout: 30000 });
    const passwordInput = page.locator('#password, input[type="password"]').first();
    await passwordInput.fill(senhaGov);

    // Clique em Entrar
    console.log('[e-CAC RPA] Autenticando credenciais no Gov.br...');
    const btnEntrar = page.locator('#submit-signin, button:has-text("Entrar"), button[type="submit"]').first();
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 45000 }).catch(() => {}),
      btnEntrar.click(),
    ]);

    // Validação de redirecionamento para o e-CAC
    console.log('[e-CAC RPA] Validando carregamento do painel principal do e-CAC...');
    await page.waitForLoadState('networkidle');

    // =========================================================================
    // ETAPA 2: Troca de Perfil de Acesso (PF -> PJ / Representante Legal)
    // =========================================================================
    console.log(`[e-CAC RPA] Etapa 2: Solicitando alteração de perfil de acesso para CNPJ ${cleanCnpj}...`);
    
    // Procura o botão/link "Alterar perfil de acesso"
    const btnTrocarPerfil = page.locator(
      '#btnTrocarPerfil, a:has-text("Alterar perfil de acesso"), button:has-text("Alterar perfil"), a[href*="TrocarPerfil"]'
    ).first();

    if (await btnTrocarPerfil.isVisible()) {
      await btnTrocarPerfil.click();
    } else {
      console.log('[e-CAC RPA] Tentando localizar seletores alternativos para troca de perfil...');
      await page.click('text="Alterar perfil de acesso"');
    }

    // Aguarda o modal ou campo de CNPJ
    await page.waitForSelector('#txtNIP, input[name*="cnpj"], input[id*="Cnpj"], #codNIP', { timeout: 20000 });

    console.log('[e-CAC RPA] Preenchendo CNPJ da empresa...');
    const cnpjField = page.locator('#txtNIP, input[name*="cnpj"], input[id*="Cnpj"], #codNIP').first();
    await cnpjField.fill(cleanCnpj);

    // Clique em Alterar / Confirmar
    const btnConfirmarPerfil = page.locator(
      'button:has-text("Alterar"), input[value="Alterar"], button:has-text("Confirmar"), #btnAlterar'
    ).first();

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
      btnConfirmarPerfil.click(),
    ]);

    console.log('[e-CAC RPA] Perfil alterado com sucesso. Validando cabeçalho PJ...');
    await page.waitForLoadState('networkidle');

    // Quick validation no cabeçalho
    const headerText = await page.innerText('body').catch(() => '');
    if (!headerText.includes(cleanCnpj) && !headerText.includes('Representante Legal')) {
      console.warn('[e-CAC RPA] Aviso: CNPJ não detectado explicitamente no corpo da página, prosseguindo com o fluxo...');
    }

    // =========================================================================
    // ETAPA 3: Navegação até Situação Fiscal e Download do Relatório
    // =========================================================================
    console.log('[e-CAC RPA] Etapa 3: Navegando para "Certidões e Situação Fiscal"...');

    const certidoesMenu = page.locator(
      'a:has-text("Certidões e Situação Fiscal"), button:has-text("Certidões e Situação Fiscal"), #btnCertidoes'
    ).first();

    if (await certidoesMenu.isVisible()) {
      await certidoesMenu.click();
    } else {
      await page.click('text="Certidões e Situação Fiscal"');
    }

    console.log('[e-CAC RPA] Clicando em "Consulta Pendências - Situação Fiscal"...');
    await page.waitForSelector('text="Consulta Pendências - Situação Fiscal", a:has-text("Situação Fiscal")', { timeout: 20000 });
    
    const pendenciasLink = page.locator(
      'a:has-text("Consulta Pendências - Situação Fiscal"), a:has-text("Situação Fiscal")'
    ).first();

    await pendenciasLink.click();
    await page.waitForTimeout(3000);

    // Verifica se a tela abriu em um Iframe interno
    let targetFrame: Page | any = page;
    const frames = page.frames();
    const situacaoFrame = frames.find((f) => f.url().includes('SituacaoFiscal') || f.name().includes('frmApp'));
    if (situacaoFrame) {
      targetFrame = situacaoFrame;
      console.log('[e-CAC RPA] Frame interno de Situação Fiscal localizado.');
    }

    // Configuração do ouvinte de download e acionamento do Gerar Relatório
    console.log('[e-CAC RPA] Gerando relatório de Situação Fiscal em PDF...');
    const downloadPromise = page.waitForEvent('download', { timeout: 45000 });

    const btnGerarRelatorio = targetFrame.locator(
      'button:has-text("Gerar Relatório"), input[value*="Gerar Relatório"], a:has-text("Gerar Relatório"), #btnGerarRelatorio'
    ).first();

    await btnGerarRelatorio.click();

    // Aguarda conclusão do download
    const download = await downloadPromise;
    const suggestedName = download.suggestedFilename() || `SituacaoFiscal_${cleanCnpj}_${Date.now()}.pdf`;
    const finalFilePath = path.join(downloadDir, suggestedName);

    await download.saveAs(finalFilePath);
    console.log(`[e-CAC RPA] Download concluído com sucesso! Arquivo salvo em: ${finalFilePath}`);

    return {
      success: true,
      message: 'Relatório de Situação Fiscal do e-CAC baixado com sucesso via automação RPA.',
      downloadPath: finalFilePath,
      companyCnpj: cleanCnpj,
      timestamp,
    };
  } catch (error: any) {
    console.error('[e-CAC RPA Error]: Erro durante execução do robô:', error);

    // Captura de screenshot em caso de falha para auditoria/debug
    if (page) {
      try {
        const screenshotPath = path.join(downloadDir, `rpa_error_${cleanCnpj}_${Date.now()}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`[e-CAC RPA] Screenshot do erro salva em: ${screenshotPath}`);
      } catch (e) {
        // Ignora erro de screenshot
      }
    }

    return {
      success: false,
      message: `Falha na automação e-CAC: ${error.message || 'Erro inesperado na navegação do Playwright'}`,
      error: String(error.stack || error),
      companyCnpj: cleanCnpj,
      timestamp,
    };
  } finally {
    // Encerramento seguro do navegador
    if (browser) {
      await browser.close().catch(() => {});
      console.log('[e-CAC RPA] Navegador Playwright encerrado com segurança.');
    }
  }
}
