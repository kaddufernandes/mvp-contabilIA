import { z } from 'zod';

const nonBlankString = z
  .string()
  .nullish()
  .transform((val) => (val ?? '').trim())
  .refine((val) => val.length > 0 && val !== '-', {
    message: 'Campo obrigatório não preenchido',
  });

export const CnaeSchema = z.object({
  codigo: z.string().optional().nullable(),
  descricao: z.string().optional().nullable(),
});

export const SocioSchema = z.object({
  nome: z.string().optional().nullable(),
  qualificacao: z.string().optional().nullable(),
  cpf_cnpj: z.string().optional().nullable(),
  percentual_capital: z.union([z.string(), z.number()]).optional().nullable(),
});

export const EnderecoSchema = z.object({
  cep: nonBlankString,
  logradouro: nonBlankString,
  numero: nonBlankString,
  complemento: z.string().optional().nullable(),
  bairro: nonBlankString,
  municipio: nonBlankString,
  uf: nonBlankString,
});

export const EmpresaSchema = z.object({
  cnpj: z
    .string()
    .nullish()
    .transform((val) => (val ?? '').replace(/\D/g, ''))
    .refine((val) => val.length === 14, { message: 'CNPJ deve ter 14 dígitos' }),
  razao_social: nonBlankString,
  nome_fantasia: nonBlankString,
  regime_tributario: nonBlankString,
  data_abertura: nonBlankString,
  capital_social: z.union([
    nonBlankString,
    z.number().refine((val) => val >= 0, { message: 'Capital Social deve ser positivo' }),
  ]),
  nire: nonBlankString,
  objeto_social: nonBlankString,
  inscricao_estadual: nonBlankString,
  inscricao_municipal: nonBlankString,
  // Multi-tenant: mapa de vínculos { [uid]: 'DONO' | 'CONTADOR' }
  usuariosVinculados: z.record(z.enum(['DONO', 'CONTADOR'])).optional(),
});

export type EmpresaSchemaType = z.infer<typeof EmpresaSchema>;


/**
 * Validação de completude do cadastro utilizando Zod.
 * Retorna true apenas se todos os campos obrigatórios atenderem às regras do EmpresaSchema.
 */
export const validateEmpresaCompleta = (empresa: any): boolean => {
  if (!empresa) return false;
  // Normalizar campos em camelCase para snake_case se necessário
  const payload = {
    cnpj: empresa.cnpj,
    razao_social: empresa.razao_social ?? empresa.razaoSocial,
    nome_fantasia: empresa.nome_fantasia ?? empresa.nomeFantasia,
    regime_tributario: empresa.regime_tributario ?? empresa.regimeTributario,
    data_abertura: empresa.data_abertura ?? empresa.dataAbertura,
    capital_social: empresa.capital_social ?? empresa.capitalSocial,
    nire: empresa.nire,
    objeto_social: empresa.objeto_social ?? empresa.objetoSocial,
    inscricao_estadual: empresa.inscricao_estadual ?? empresa.inscricaoEstadual,
    inscricao_municipal: empresa.inscricao_municipal ?? empresa.inscricaoMunicipal,
  };

  const result = EmpresaSchema.safeParse(payload);
  return result.success;
};
