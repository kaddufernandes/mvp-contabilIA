import { chromium, Browser, BrowserContext, Page } from 'playwright';

export interface ValidarPaParams {
  cnpj: string;
  cpf: string;
  codigoAcesso: string;
  periodoApuracao: string;
}

export interface EmitirDasParams extends ValidarPaParams {
  valorReceita: string;
  receitaMercadoInterno?: string;
  receitaMercadoExterna?: string;
  atividadeSelecionada?: string;
  ufIss?: string;
  municipioIss?: string;
  valorFixoIcms?: string;
  valorFixoIss?: string;
  transmitir?: boolean;
  deveRetificar?: boolean;
}

const ATIVIDADE_MAP: Record<string, string> = {
  'anexo_iii_proprio_municipio': '-14', 
  'anexo_iii_outro_municipio': '-13',   
  'anexo_iii_retencao_iss': '-15',      
  'anexo_v_fator_r': '-29',             
  'anexo_i_comercio': '-1',             
};

async function realizarLogin(page: Page, cnpj: string, cpf: string, codigoAcesso: string) {
  console.log('[RPA] Iniciando processo de login...');
  const portalUrl = 'https://www8.receita.fazenda.gov.br/SimplesNacional/Servicos/Grupo.aspx?grp=t&area=1';
  await page.goto(portalUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);

  // Limpa botão indesejado da Receita
  await page.evaluate(() => {
    const btnLimpar = document.getElementById('btLimpar');
    if (btnLimpar) btnLimpar.remove();
  }).catch(() => {}); 

  const cnpjField = page.locator('.txt-cnpj').first();
  const cpfField = page.locator('.txt-cpf').first();
  const codigoField = page.locator('.txt-codacesso').first();

  if ((await cnpjField.count()) === 0) {
    throw new Error('Acesso Negado: Campos de login não encontrados no portal da Receita.');
  }

  await cnpjField.focus();
  await cnpjField.pressSequentially(cnpj, { delay: 10 });
  await cpfField.focus();
  await cpfField.pressSequentially(cpf, { delay: 10 });
  await codigoField.focus();
  await codigoField.pressSequentially(codigoAcesso, { delay: 10 });

  console.log('[RPA] Clicando em continuar...');
  const btnContinuar = page.locator('.btn-continuar').first();
  await btnContinuar.click({ force: true });

  console.log('🚨 1º CAPTCHA / LOGIN: Verificando status do login...');

  let isLogged = false;
  let errorMsg = '';
  const startTime = Date.now();
  const timeoutLimit = 300000; // 5 minutos

  while (Date.now() - startTime < timeoutLimit) {
    try {
      const hasPainel = await page.locator('a:has-text("PGDAS-D e DEFIS")').count() > 0;
      const isCnpjHidden = await cnpjField.isHidden();
      
      if (hasPainel || isCnpjHidden) {
        isLogged = true;
        break;
      }

      const errorText = await page.evaluate(() => {
        const errNodes = document.querySelectorAll('.br-message.danger, .alert-danger, .error-message, .msg-erro');
        for (let i = 0; i < errNodes.length; i++) {
          const node = errNodes[i] as HTMLElement;
          if (node.offsetParent !== null && node.innerText.trim().length > 5) {
            return node.innerText.trim();
          }
        }
        return null;
      });

      if (errorText) {
        errorMsg = errorText;
        break;
      }
    } catch (e) {
      // Ignora erro de recarregamento
    }

    await page.waitForTimeout(1000); 
  }

  if (errorMsg) {
    const cleanText = errorMsg.replace(/×/g, '').replace(/close/gi, '').replace(/\n/g, ' ').trim();
    throw new Error(`Acesso Negado: ${cleanText}`); 
  }

  if (!isLogged) {
    throw new Error('Acesso Negado: Tempo limite excedido aguardando o login.');
  }

  console.log('[RPA] Login efetuado com sucesso!');
}

// Função auxiliar para digitar campos de dinheiro burlando a máscara do jQuery
async function digitarValorMonetario(page: Page, seletor: string, valor: string) {
  const campo = page.locator(seletor).first();
  await campo.click({ force: true });
  await page.keyboard.press('Control+A'); 
  await page.keyboard.press('Backspace');
  await campo.pressSequentially(valor, { delay: 50 });
}

export async function runValidarPaRpa(params: ValidarPaParams) {
  return { success: true, status: 'ok', mensagem: 'Validado localmente' };
}

// ============================================================================
// FUNÇÃO DE PREENCHIMENTO ÚNICO (O Robô Oficial Blindado)
// ============================================================================
export async function runEmitirDasRpa(params: EmitirDasParams) {
  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ 
      headless: false, 
      args: [
        '--start-maximized',
        '--disable-blink-features=AutomationControlled'
      ],
      ignoreDefaultArgs: ['--enable-automation']
    });
    
    const context = await browser.newContext({ viewport: null });
    const page = await context.newPage();
    await page.bringToFront();
    
    page.setDefaultNavigationTimeout(300000);
    page.setDefaultTimeout(300000);

    const receitaInterna = params.receitaMercadoInterno || params.valorReceita || '0,00';
    const receitaExterna = params.receitaMercadoExterna || '0,00';

    // 1. FAZ O LOGIN
    await realizarLogin(page, params.cnpj, params.cpf, params.codigoAcesso);

    // 2. ABRIR SANFONA E CLICAR NO PGDAS
    console.log('[RPA] Abrindo sanfona Cálculo e Declaração...');
    await page.waitForSelector('button[aria-controls="grupo_5"], a:has-text("PGDAS-D e DEFIS")', { state: 'attached', timeout: 60000 }).catch(() => {});
    
    const menuCalculo = page.locator('button[aria-controls="grupo_5"]').first();
    if ((await menuCalculo.count()) > 0 && await menuCalculo.isVisible()) {
      await menuCalculo.click({ force: true });
      await page.waitForTimeout(1000);
    }

    console.log('[RPA] Acessando PGDAS-D...');
    const linkPgdas = page.locator('a:has-text("PGDAS-D e DEFIS")').first();
    await linkPgdas.waitFor({ state: 'visible', timeout: 60000 });
    await linkPgdas.click({ force: true });

    // 3. RESOLUÇÃO BLINDADA DO 2º CAPTCHA (INTACTA CONFORME SEU PEDIDO)
    console.log('🚨 2º CAPTCHA: Verificando se o portal exige resolução do hCaptcha...');
    
    const isCaptchaPage = await page.waitForFunction(() => {
      const temCaptcha = document.body.innerText.includes('Clique abaixo para prosseguir') || !!document.querySelector('iframe[src*="hcaptcha"]');
      const temMenuPronto = !!document.querySelector('a[href*="declaracao?clear=1"]') || !!document.querySelector('a[href="#collapseOne"]');
      return temCaptcha || temMenuPronto;
    }, { timeout: 300000 });

    const precisaResolver = await page.evaluate(() => {
      return document.body.innerText.includes('Clique abaixo para prosseguir') || !!document.querySelector('iframe[src*="hcaptcha"]');
    });

    if (precisaResolver) {
      console.log('🛑 [2º Captcha] Aguardando você marcar o checkbox "Sou humano"...');

      await page.waitForFunction(() => {
        const responseTextArea = document.querySelector('[name="h-captcha-response"]') as HTMLTextAreaElement;
        const iframeChecked = document.querySelector('iframe[data-hcaptcha-widget-id]') as HTMLIFrameElement;
        const hasToken = responseTextArea && responseTextArea.value.trim().length > 10;
        return hasToken;
      }, { timeout: 300000 });

      console.log('✅ [2º Captcha] Validado! Disparando o clique no botão Prosseguir...');
      await page.waitForTimeout(1000);

      await page.evaluate(() => {
        const btnProsseguir = document.querySelector('button.btn-success, input[type="submit"], .btn-success') as HTMLElement;
        if (btnProsseguir) {
          btnProsseguir.click();
        } else {
          const form = document.querySelector('form');
          if (form) form.submit();
        }
      });

      await page.waitForLoadState('domcontentloaded');
    }

    // 4. NAVEGAÇÃO PARA DECLARAR / RETIFICAR
    console.log('[RPA] Aguardando o menu principal do PGDAS-D...');
    await page.waitForSelector('a[href*="declaracao?clear=1"], a[href="#collapseOne"]', { state: 'attached', timeout: 30000 });

    const menuDeclaracao = page.locator('a[href="#collapseOne"]');
    if (await menuDeclaracao.isVisible().catch(() => false)) {
      await menuDeclaracao.click({ force: true });
      await page.waitForTimeout(800);
    }

    console.log('[RPA] Clicando em Declarar/Retificar...');
    const linkDeclarar = page.locator('a[href*="declaracao?clear=1"]').first();
    await linkDeclarar.click({ force: true });
    await page.waitForLoadState('domcontentloaded');

    // 5. INFORMAR O MÊS/ANO (PA)
    console.log(`[RPA] Preenchendo PA: ${params.periodoApuracao}...`);
    await page.waitForSelector('#pa', { state: 'visible', timeout: 15000 });
    await page.fill('#pa', params.periodoApuracao);
    await page.click('button[type="submit"]');
    await page.waitForLoadState('domcontentloaded');

    const errorPa = page.locator('.alert-danger:not(#jsMsgBoxConfirm)').first();
    if (await errorPa.isVisible().catch(() => false)) {
      const errText = await errorPa.innerText();
      throw new Error(`Erro no Período de Apuração: ${errText.replace(/×/g, '').trim()}`);
    }

    // 6. TRATAR SE É RETIFICADORA
    const msgBoxConfirm = page.locator('#jsMsgBoxConfirm');
    if (await msgBoxConfirm.isVisible().catch(() => false)) {
      if (params.deveRetificar) {
        console.log('[RPA] A Receita pediu retificação. Clicando em SIM...');
        await page.locator('.sim').click();
        await page.waitForLoadState('domcontentloaded');
      } else {
        throw new Error('A Receita identificou declaração existente. Volte no sistema e marque "Sim (Retificar declaração)".');
      }
    }

    // 7. INFORMAR AS RECEITAS BRUTAS
    console.log('[RPA] Preenchendo Receitas Brutas...');
    await page.waitForSelector('input[name="rpaCompInt"]', { state: 'visible', timeout: 15000 });
    await digitarValorMonetario(page, 'input[name="rpaCompInt"]', receitaInterna);
    await digitarValorMonetario(page, 'input[name="rpaCompExt"]', receitaExterna);
    await page.click('button[type="submit"]');
    await page.waitForLoadState('domcontentloaded');

    const errorReceita = page.locator('.alert-danger').first();
    if (await errorReceita.isVisible().catch(() => false)) {
      const textR = await errorReceita.innerText();
      throw new Error(`Erro na Receita: ${textR.replace(/×/g, '').trim()}`);
    }

    // 8. SELECIONAR A ATIVIDADE
    console.log(`[RPA] Interagindo com a seleção de Atividade Econômica...`);
    
    const btnExpandir = page.locator('#btn-exibe-todos');
    if (await btnExpandir.isVisible().catch(() => false)) {
      await btnExpandir.click();
      await page.waitForTimeout(500);
    }

    const atividadeSufixo = ATIVIDADE_MAP[params.atividadeSelecionada || 'anexo_iii_proprio_municipio'] || '-14';
    const atividadeLocator = page.locator(`a[data-atividade$="${atividadeSufixo}"]`);
    
    if ((await atividadeLocator.count()) > 0) {
      const isAlreadyChecked = await atividadeLocator.locator('.glyphicon-check').count() > 0;

      if (isAlreadyChecked) {
        console.log('[RPA] Opção já selecionada. Desmarcando e marcando novamente para reativar o formulário...');
        await atividadeLocator.click(); // Desmarca
        await page.waitForTimeout(500);
        await atividadeLocator.click(); // Marca novamente
      } else {
        console.log('[RPA] Desmarcando seleções anteriores e marcando a nova atividade...');
        const outrasMarcadas = page.locator('a:has(.glyphicon-check)');
        const countMarcadas = await outrasMarcadas.count();
        for (let i = 0; i < countMarcadas; i++) {
          await outrasMarcadas.nth(i).click();
          await page.waitForTimeout(300);
        }
        await atividadeLocator.click();
      }
    } else {
      throw new Error(`A atividade selecionada não foi encontrada na tela da Receita.`);
    }
    
    await page.click('#btn-salvar');
    await page.waitForLoadState('domcontentloaded');

    // 9. DISTRIBUIR A RECEITA PARA A ATIVIDADE (NOVA REGRA DE UF E MUNICÍPIO APLICADA)
    console.log('[RPA] Inserindo a Receita na Tabela de Atividade...');
    await page.waitForSelector('.receita-valor', { state: 'visible', timeout: 15000 });
    
    if (params.ufIss) {
      const ufSelect = page.locator('.receita-uf').first();
      if (await ufSelect.count() > 0) {
        console.log(`[RPA] Selecionando UF: ${params.ufIss}`);
        await ufSelect.selectOption(params.ufIss);
        // Aguarda a Receita carregar os municípios via AJAX após a seleção do estado
        await page.waitForTimeout(1500); 
      }
    }

    if (params.municipioIss) {
      const municipioSelect = page.locator('.receita-codmunicipio').first();
      if (await municipioSelect.count() > 0) {
        console.log(`[RPA] Selecionando Município: ${params.municipioIss}`);
        // Tenta selecionar pelo rótulo exato ou pelo código caso o sistema mande o código do IBGE
        await municipioSelect.selectOption({ label: params.municipioIss }).catch(async () => {
          await municipioSelect.selectOption(params.municipioIss as string);
        });
      }
    }

    await digitarValorMonetario(page, '.receita-valor', receitaInterna);
    
    console.log('[RPA] Clicando em Calcular na tela de Receitas e aguardando a próxima página...');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
      page.click('.btn-calcular')
    ]);
    await page.waitForTimeout(1000);

    // 10. VALORES FIXOS — preenche ICMS/ISS fixos se informados e avança para o Resumo
    console.log('[RPA] Verificando tela de Valores Fixos...');
    const isValorValido = (v?: string) => v && v.trim() !== '' && v !== '0,00' && v !== '0';
    const temValorFixo = isValorValido(params.valorFixoIcms) || isValorValido(params.valorFixoIss);

    const urlAtual = page.url();
    const isTelaValoresFixos = urlAtual.includes('ValoresFixos') || (await page.locator('h3:has-text("Valores Fixos")').count()) > 0;

    if (isTelaValoresFixos) {
      console.log('[RPA] Tela de Valores Fixos confirmada.');
      if (temValorFixo) {
        if (isValorValido(params.valorFixoIcms)) {
          const icmsInput = page.locator('input[name="icms"]');
          if ((await icmsInput.count()) > 0) {
            console.log(`[RPA] Preenchendo ICMS fixo: ${params.valorFixoIcms}`);
            await digitarValorMonetario(page, 'input[name="icms"]', params.valorFixoIcms!);
          }
        }
        if (isValorValido(params.valorFixoIss)) {
          const issInput = page.locator('input[name="iss"]');
          if ((await issInput.count()) > 0) {
            console.log(`[RPA] Preenchendo ISS fixo: ${params.valorFixoIss}`);
            await digitarValorMonetario(page, 'input[name="iss"]', params.valorFixoIss!);
          }
        }
      } else {
        console.log('[RPA] Valores fixos são 0 ou não informados. Avançando diretamente para o Resumo...');
      }

      console.log('[RPA] Enviando formulário da tela de Valores Fixos...');
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {}),
        page.evaluate(() => {
          const btn = document.querySelector('form button[type="submit"], form .btn-success') as HTMLElement;
          if (btn) {
            btn.click();
          } else {
            const form = document.querySelector('form') as HTMLFormElement;
            if (form) form.submit();
          }
        })
      ]);
      await page.waitForTimeout(1500);
    } else {
      console.log(`[RPA] Página de Valores Fixos não exibida ou já ultrapassada (URL: ${urlAtual}).`);
    }

    // 11. TELA DE RESUMO E EXTRAÇÃO DE DADOS DA .table-bordered
    console.log('[RPA] Resumo alcançado! Aguardando tabelas de tributos...');
    await page.waitForSelector('.table-bordered, form[action*="Transmitir"]', { state: 'attached', timeout: 45000 });
    console.log(`[RPA] URL atual no Resumo: ${page.url()}`);
    
    // Usa a tabela de resumo dos tributos
    const tableResumo = page.locator('form[action*="Transmitir"] .table-bordered, .table-bordered').last();

    const dadosCalculados = {
      irpj: await tableResumo.locator('tr').nth(1).locator('td').nth(0).innerText().catch(() => '0,00'),
      csll: await tableResumo.locator('tr').nth(1).locator('td').nth(1).innerText().catch(() => '0,00'),
      cofins: await tableResumo.locator('tr').nth(1).locator('td').nth(2).innerText().catch(() => '0,00'),
      pis: await tableResumo.locator('tr').nth(1).locator('td').nth(3).innerText().catch(() => '0,00'),
      inss: await tableResumo.locator('tr').nth(1).locator('td').nth(4).innerText().catch(() => '0,00'),
      ipi: await tableResumo.locator('tr').nth(1).locator('td').nth(5).innerText().catch(() => '0,00'),
      icms: await tableResumo.locator('tr').nth(1).locator('td').nth(6).innerText().catch(() => '0,00'),
      iss: await tableResumo.locator('tr').nth(1).locator('td').nth(7).innerText().catch(() => '0,00'),
      total: await tableResumo.locator('tr').nth(1).locator('td').nth(8).innerText().catch(() => '0,00'),
    };

    console.log('🚨 SUCESSO! Extração concluída. Fechando o Chrome automaticamente...');
    await page.waitForTimeout(500);

    return {
      success: true,
      sucesso: true,
      status: 'calculado',
      periodoApuracao: params.periodoApuracao,
      dadosCalculados,
      valorDas: dadosCalculados.total,
      mensagem: 'Robô finalizou a apuração e extraiu os tributos com sucesso!',
    };

  } catch (error: any) {
    console.error('[RPA Emitir DAS Error]', error);
    throw error;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}