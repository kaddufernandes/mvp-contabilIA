// ============================================================
// RBAC — Tipos de perfil de acesso
// ============================================================
export type Role = 'USER' | 'CONTADOR' | 'ADMIN';
export type VinculoTipo = 'DONO' | 'CONTADOR';

export interface Cnae {
  codigo: string;
  descricao: string;
}

export interface Socio {
  nome: string;
  qualificacao: string;
  cpf_cnpj?: string;
  percentual_capital?: string | number;
}

export interface Endereco {
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
}

export interface EmpresaData {
  id?: string;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;

  /** Multi-tenant: mapa de usuários vinculados { [uid]: 'DONO' | 'CONTADOR' } */
  usuariosVinculados?: Record<string, VinculoTipo>;
  /** Vínculo do usuário atual com esta empresa (populado no frontend) */
  vinculoAtual?: VinculoTipo;
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  situacao_cadastral: string;
  data_abertura: string;
  capital_social: string | number;
  natureza_juridica: string;
  regime_tributario: string;
  inscricao_estadual: string;
  ie_situacao_cadastral?: string;
  ie_regime_apuracao?: string;
  ie_data_situacao?: string;
  inscricao_municipal: string;
  data_atualizacao_ccm?: string;
  im_ultima_atualizacao?: string;
  cnae_principal: Cnae;
  cnaes_secundarios: Cnae[];
  nire: string;
  objeto_social: string;
  endereco: Endereco;
  qsa: Socio[];
  user?: {
    name: string;
    id?: string;
    email?: string;
  } | null;
  fonte_dados?: {
    cnpj_api?: boolean;
    ocr_ia?: boolean;
    modificado_manual?: boolean;
    data_consulta_api?: string;
    data_extracao_ocr?: string;
  };
}

export interface OcrResponseData {
  success: boolean;
  nire?: string | null;
  objeto_social?: string | null;
  razao_social?: string | null;
  nome_fantasia?: string | null;
  cnpj?: string | null;
  capital_social?: string | number | null;
  data_abertura?: string | null;
  natureza_juridica?: string | null;
  inscricao_estadual?: string | null;
  ie_situacao_cadastral?: string | null;
  ie_regime_apuracao?: string | null;
  ie_data_situacao?: string | null;
  inscricao_municipal?: string | null;
  data_atualizacao_ccm?: string | null;
  im_ultima_atualizacao?: string | null;
  endereco?: Partial<Endereco> | null;
  socios?: Socio[] | null;
  resumo_extracao?: string;
  campos_identificados?: string[];
  error?: string;
}

export interface CnpjApiResponse {
  success: boolean;
  data?: Partial<EmpresaData>;
  error?: string;
}
