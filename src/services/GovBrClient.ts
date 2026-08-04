import axios, { AxiosInstance } from 'axios';
import { CookieJar } from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';
import * as cheerio from 'cheerio';

// Permite conexões com os servidores do Gov.br ignorando erro de cadeia de certificados ICP-Brasil no Node.js
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

export interface GovBrSessionResult {
  execution: string;
}

export interface EnviarCpfResult {
  exigeCaptcha: boolean;
  execution: string;
  html?: string;
}

export interface EnviarSenhaResult {
  sucesso: boolean;
  redirectUrl?: string;
  mensagem?: string;
}

export class GovBrClient {
  private client: AxiosInstance;
  private jar: CookieJar;
  private execution: string = '';
  private currentUrl: string = 'https://sso.acesso.gov.br/login?client_id=cav.receita.fazenda.gov.br&authorization_id=1';

  constructor() {
    this.jar = new CookieJar();
    this.client = wrapper(
      axios.create({
        jar: this.jar,
        withCredentials: true,
        maxRedirects: 5,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept':
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'same-origin',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
        },
      })
    );
  }

  public getExecution(): string {
    return this.execution;
  }

  /**
   * Passo 1: Inicia a sessão no Gov.br acessando a tela de login inicial
   * e extraindo o token 'execution' do formulário hidden.
   */
  public async iniciarSessao(): Promise<GovBrSessionResult> {
    try {
      const response = await this.client.get(this.currentUrl);
      const $ = cheerio.load(response.data);

      const executionValue = $('input[name="execution"]').val();
      if (!executionValue || typeof executionValue !== 'string') {
        throw new Error(
          'O portal Gov.br requer resolução de desafio de segurança/CAPTCHA (WAF). Use a emissão via RPA.'
        );
      }

      this.execution = executionValue;
      return { execution: this.execution };
    } catch (error: any) {
      console.error('[GovBrClient] Erro ao iniciar sessão:', error.message);
      throw new Error(`Falha ao iniciar sessão no Gov.br: ${error.message}`);
    }
  }

  /**
   * Passo 2: Envia o CPF e verifica se a resposta solicita resolução de hCaptcha.
   * Atualiza o valor do token 'execution'.
   */
  public async enviarCpf(cpf: string): Promise<EnviarCpfResult> {
    try {
      if (!this.execution) {
        await this.iniciarSessao();
      }

      const cleanCpf = cpf.replace(/\D/g, '');
      const params = new URLSearchParams();
      params.append('accountId', cleanCpf);
      params.append('cpf', cleanCpf);
      params.append('execution', this.execution);
      params.append('_eventId', 'next');

      const response = await this.client.post(this.currentUrl, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Origin': 'https://sso.acesso.gov.br',
          'Referer': this.currentUrl,
        },
      });

      const $ = cheerio.load(response.data);

      // Atualiza o token execution
      const newExecution = $('input[name="execution"]').val();
      if (newExecution && typeof newExecution === 'string') {
        this.execution = newExecution;
      }

      // Verifica presença de elemento h-captcha
      const hasCaptcha = $('.h-captcha').length > 0 || $('[id*="hcaptcha"]').length > 0 || String(response.data).includes('hcaptcha');

      return {
        exigeCaptcha: hasCaptcha,
        execution: this.execution,
        html: response.data,
      };
    } catch (error: any) {
      console.error('[GovBrClient] Erro ao enviar CPF:', error.message);
      throw new Error(`Falha ao enviar CPF no Gov.br: ${error.message}`);
    }
  }

  /**
   * Passo 3: Envia a senha (e opcionalmente token de captcha) e valida o redirecionamento para o e-CAC.
   */
  public async enviarSenha(senha: string, captchaToken?: string): Promise<EnviarSenhaResult> {
    try {
      if (!this.execution) {
        throw new Error('Sessão inválida. Execute enviarCpf() antes de enviar a senha.');
      }

      const params = new URLSearchParams();
      params.append('password', senha);
      params.append('execution', this.execution);
      params.append('_eventId', 'submit');
      if (captchaToken) {
        params.append('g-recaptcha-response', captchaToken);
        params.append('h-captcha-response', captchaToken);
      }

      const response = await this.client.post(this.currentUrl, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Origin': 'https://sso.acesso.gov.br',
          'Referer': this.currentUrl,
        },
      });

      const finalUrl = response.request?.res?.responseUrl || response.config.url || '';
      const $ = cheerio.load(response.data);

      // Verifica se houve erro de credenciais na página
      const errorMessage = $('.alert-danger, .msg-erro, #error-message').text().trim();
      if (errorMessage) {
        return {
          sucesso: false,
          mensagem: errorMessage,
        };
      }

      const redirecionouEcac = finalUrl.includes('cav.receita.fazenda.gov.br') || String(response.data).includes('cav.receita.fazenda.gov.br');

      if (!redirecionouEcac && response.status === 200) {
        const metaRedirect = $('meta[http-equiv="refresh"]').attr('content');
        if (metaRedirect && metaRedirect.includes('cav.receita.fazenda.gov.br')) {
          return {
            sucesso: true,
            redirectUrl: metaRedirect,
          };
        }
      }

      return {
        sucesso: redirecionouEcac,
        redirectUrl: finalUrl,
        mensagem: redirecionouEcac ? 'Autenticação concluída com sucesso!' : 'Não foi possível validar o redirecionamento ao e-CAC.',
      };
    } catch (error: any) {
      console.error('[GovBrClient] Erro ao enviar senha:', error.message);
      throw new Error(`Falha ao enviar senha no Gov.br: ${error.message}`);
    }
  }
}
