import { PDFDocument, PDFTextField, PDFCheckBox, PDFRadioGroup } from 'pdf-lib';
import { EmpresaData } from '../types';

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export interface MappedField {
  pdfField: string;
  label?: string;
  type: 'text' | 'checkbox' | 'radio';
  value: string | boolean;
  options?: string[]; // para campos radio: lista de opções disponíveis no PDF
}

// Gerador de rótulos amigáveis e legíveis para campos técnicos do PDF
// Gerador de rótulos amigáveis e legíveis para campos técnicos de formulários oficiais
export function getFriendlyLabel(pdfField: string): string {
  if (!pdfField) return 'Campo Sem Nome';

  const clean = pdfField.trim();
  const norm = normalize(clean);

  // 1. Mapeamento direto de dicionário para grupos/boxes específicos da Vigilância Sanitária (CVS 1/2024)
  if (norm === 'group30') return 'Item 30 - Serviço de Radiometria / Teste de Qualidade';
  if (norm === 'group31') return 'Item 31 - Transporte de Água';
  if (norm === 'group32') return 'Item 32 - Transportadora de Produtos';
  if (norm === 'group33') return 'Item 33 - Responsável Legal (CPF / CBO)';
  if (norm === 'group34') return 'Item 34 - Responsável Técnico Principal';
  if (norm === 'group35') return 'Item 35 - Responsável Técnico Substituto 01';
  if (norm === 'group36') return 'Item 36 - Responsável Técnico Substituto 02';
  if (norm === 'group37') return 'Item 37 - Responsável Técnico Substituto 03';
  if (norm === 'box351') return 'Opção 35.1 - Resp. Técnico Substituto (Item 1)';
  if (norm === 'box352') return 'Opção 35.2 - Resp. Técnico Substituto (Item 2)';
  if (norm === 'box353') return 'Opção 35.3 - Resp. Técnico Substituto (Item 3)';
  if (norm === 'box354') return 'Opção 35.4 - Resp. Técnico Substituto (Item 4)';
  if (norm === 'box355') return 'Opção 35.5 - Resp. Técnico Substituto (Item 5)';
  if (norm === 'box356') return 'Opção 35.6 - Resp. Técnico Substituto (Item 6)';
  if (norm.includes('checkbox381') || norm.includes('box381')) return 'Item 38 - Assinatura do Resp. Legal';
  if (norm.includes('checkbox382') || norm.includes('box382')) return 'Item 38 - Assinatura do Resp. Técnico';

  // 2. Dicionário de termos diretos e conhecidos em formulários (CRF-SP, CVS, JUCESP, RFB)
  if (norm.includes('cnpj')) return 'CNPJ do Estabelecimento';
  if (norm.includes('cpf')) return 'CPF do Responsável / Solicitante';
  if (norm.includes('razaosocial') || norm.includes('razao_social') || norm.includes('razao')) return 'Razão Social / Nome Empresarial';
  if (norm.includes('fantasia')) return 'Nome Fantasia';
  if (norm.includes('inscricaoestadual') || norm.includes('insc_estadual') || norm.includes('ie')) {
    if (!norm.includes('municipio') && !norm.includes('cidade') && !norm.includes('social')) return 'Inscrição Estadual (IE)';
  }
  if (norm.includes('inscricaomunicipal') || norm.includes('insc_municipal') || norm.includes('ccm')) return 'Inscrição Municipal (IM / CCM)';
  if (norm.includes('logradouro') || norm.includes('rua') || norm.includes('avenida') || norm.includes('endereco')) return 'Logradouro (Rua / Av)';
  if (norm.includes('cep')) return 'CEP';
  if (norm.includes('bairro')) return 'Bairro';
  if (norm.includes('municipio') || norm.includes('cidade')) return 'Município / Cidade';
  if (norm.includes('uf') || norm.includes('estado')) return 'Estado (UF)';
  if (norm.includes('complemento') || norm.includes('compl')) return 'Complemento';
  if (norm.includes('paginaweb') || norm.includes('pagina_web') || norm.includes('site') || norm.includes('web')) return 'Endereço da Página Web / Site';
  if (norm.includes('eletronico') || norm.includes('email') || norm.includes('e_mail')) return 'E-mail de Contato';
  if (norm.includes('celular') || norm === 'cel') return 'Telefone Celular';
  if (norm.includes('telefone') || norm.includes('tel') || norm.includes('fone')) return 'Telefone Fixo';
  if (norm.includes('codativ') || (norm.includes('codigo') && norm.includes('ativ'))) return 'Código da Atividade (CNAE)';
  if (norm.includes('descrativ') || (norm.includes('descr') && norm.includes('ativ'))) return 'Descrição da Atividade (CNAE)';
  if (norm.includes('naturezajuridica') || norm.includes('natureza')) return 'Natureza Jurídica';
  if (norm.includes('capitalsocial') || norm.includes('capital')) return 'Capital Social';
  if (norm.includes('nire')) return 'NIRE';
  if (norm.includes('objetosocial') || norm.includes('objeto')) return 'Objeto Social';
  if (norm.includes('responsavel') && norm.includes('legal')) return 'Nome do Responsável Legal';
  if (norm.includes('responsavel') && norm.includes('tecnico')) return 'Nome do Responsável Técnico';
  if (norm.includes('crfpj') || norm.includes('crf')) return 'Nº CRF-PJ';

  // 3. Tratar padrões numéricos com prefixo (ex: "30 CNPJ_1", "29 ENDEREÇO PÁGINA WEB", "17. Nº", "14 CEP")
  const matchNumText = clean.match(/^(\d+)[\.\s_-]+(.*)$/);
  if (matchNumText) {
    const num = matchNumText[1];
    const rest = matchNumText[2].trim();
    if (rest) {
      const restLabel = getFriendlyLabel(rest);
      return `Item ${num} - ${restLabel}`;
    }
  }

  // 4. Tratar padrões de grupos/boxes técnicos (ex: "Group30", "Box35_1", "Check Box38_2")
  const matchBox = clean.match(/(?:Group|Box|Check\s*Box)[\s_]*(\d+)(?:[\s_]+(\d+))?/i);
  if (matchBox) {
    const groupNum = matchBox[1];
    const subNum = matchBox[2];
    if (subNum) {
      return `Opção ${groupNum} (Item ${subNum})`;
    }
    return `Grupo de Opções ${groupNum}`;
  }

  // 5. Formatação amigável genérica
  const readable = clean
    .replace(/[_]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();

  return readable.charAt(0).toUpperCase() + readable.slice(1);
}

// Helper semântico para obter o valor correspondente a um campo do PDF.
// Usa correspondência por TOKEN (palavra isolada), não substring, para evitar falsos positivos.
export function getMappedValue(fieldName: string, empresa: EmpresaData): string | undefined {
  if (!fieldName) return undefined;

  // Normaliza e divide o nome em tokens individuais (palavras / números)
  const tokens = fieldName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .split(/[\s_\-\.\/\\,;:()[\]{}]+/) // separa por qualquer delimitador
    .map(t => t.replace(/[^a-z0-9]/g, '')) // mantém só alfanumérico
    .filter(t => t.length > 0);

  // Verifica se qualquer um dos tokens exatos está presente
  function hasToken(...words: string[]): boolean {
    return words.some(w => tokens.includes(normalize(w)));
  }

  // Verifica se a concatenação de todos os tokens contém uma substring
  const fullNorm = tokens.join('');
  function hasSubstr(...words: string[]): boolean {
    return words.some(w => fullNorm.includes(normalize(w)));
  }

  // ────────────────────────────────────────────────────────────
  // Regras em ordem de especificidade (mais específico primeiro)
  // ────────────────────────────────────────────────────────────

  // CNPJ (token exato "cnpj")
  if (hasToken('cnpj')) return empresa.cnpj || '';

  // CPF — se for campo exclusivo de CPF (solicitante/responsável)
  if (hasToken('cpf')) {
    if (hasToken('responsavel') || hasToken('socio') || hasToken('solicitante')) {
      return empresa.qsa?.[0]?.cpf_cnpj || '';
    }
    return '';
  }

  // CEP
  if (hasToken('cep')) return empresa.endereco?.cep || '';

  // Inscrição Estadual — precisa de token "inscricao" + "estadual", ou "ie" isolado
  if (
    (hasToken('inscricao') && hasToken('estadual')) ||
    hasToken('inscricaoestadual') ||
    hasToken('ie')
  ) {
    // Evita conflito com "inscricao municipal" ou "inscricao imobiliaria"
    if (!hasToken('municipal') && !hasToken('imobiliaria') && !hasToken('im')) {
      return empresa.inscricao_estadual || '';
    }
  }

  // Inscrição Municipal / CCM / IM
  if (
    (hasToken('inscricao') && hasToken('municipal')) ||
    hasToken('inscricaomunicipal') ||
    hasToken('ccm') ||
    hasToken('im')
  ) {
    return empresa.inscricao_municipal || '';
  }

  // Nome Fantasia — precisa de token "fantasia"
  if (hasToken('fantasia')) return empresa.nome_fantasia || empresa.razao_social || '';

  // Razão Social — precisa de tokens "razao", "razaosocial" ou "firma"
  if (hasToken('razao') || hasToken('razaosocial') || hasToken('firma')) {
    return empresa.razao_social || '';
  }

  // Logradouro / Rua / Endereço — token "logradouro", "rua", "avenida", "endereco", "tipologradouro"
  if (hasToken('logradouro') || hasToken('rua') || hasToken('avenida') || hasToken('endereco') || hasToken('tipologradouro')) {
    return empresa.endereco?.logradouro || '';
  }

  // Número de endereço — token "numero", "num", "n", "no" isolados (ex: "17. Nº", "Nº", "N°")
  if (hasToken('numero') || hasToken('num') || tokens.includes('n') || tokens.includes('no')) {
    if (!hasToken('protocolo') && !hasToken('processo') && !hasToken('cevs') && !hasToken('registro') && !hasToken('crf')) {
      return empresa.endereco?.numero || '';
    }
  }

  // Complemento
  if (hasToken('complemento') || hasToken('compl') || hasToken('apto') || hasToken('apartamento')) {
    return empresa.endereco?.complemento || '';
  }

  // Bairro
  if (hasToken('bairro')) return empresa.endereco?.bairro || '';

  // Município / Cidade
  if (hasToken('municipio') || hasToken('cidade')) return empresa.endereco?.municipio || '';

  // UF / Estado — token EXATO "uf" ou "estado" (não "estadual")
  if (hasToken('uf') || hasToken('estado')) {
    if (!hasToken('inscricao') && !hasToken('estadual')) {
      return empresa.endereco?.uf || '';
    }
  }

  // Endereço eletrônico / E-mail
  if (hasToken('eletronico') || hasToken('email') || hasSubstr('e-mail') || hasSubstr('email')) {
    return empresa.user?.email || '';
  }

  // Página Web / Site
  if (hasToken('web') || hasToken('site') || hasSubstr('paginaweb')) {
    return '';
  }

  // Telefone fixo (token "telefone", "fone", "tel", não "celular")
  if (hasToken('telefone') || hasToken('fone') || hasToken('tel')) {
    if (!hasToken('celular') && !hasToken('cel')) return '';
  }

  // Celular
  if (hasToken('celular') || hasToken('cel')) return '';

  // Código da Atividade CNAE — precisa de "cnae" ou "codativ" + indicador de código
  if (hasSubstr('codativ') || hasSubstr('cnaecod') || (hasToken('cnae') && (hasToken('codigo') || hasToken('cod')))) {
    return empresa.cnae_principal?.codigo || '';
  }

  // Descrição da Atividade CNAE — precisa de "descr" + "ativ" ou "cnaedesc"
  if (hasSubstr('descrativ') || hasSubstr('cnaedesc') || (hasToken('descricao') && hasToken('atividade'))) {
    return empresa.cnae_principal?.descricao || '';
  }

  // CNAE genérico (sem outro indicador) → código
  if (hasToken('cnae')) return empresa.cnae_principal?.codigo || '';

  // NIRE
  if (hasToken('nire')) return empresa.nire || '';

  // Objeto Social
  if (hasToken('objeto') || hasSubstr('objetosocial')) return empresa.objeto_social || '';

  // Capital Social
  if (hasToken('capital') || hasSubstr('capitalsocial')) return String(empresa.capital_social || '');

  // Natureza Jurídica
  if (hasToken('natureza') || hasSubstr('naturezajuridica')) return empresa.natureza_juridica || '';

  // Regime Tributário
  if (hasToken('regime') || hasSubstr('regimetributario')) return empresa.regime_tributario || '';

  // Data de Abertura
  if (hasToken('abertura') || hasSubstr('dataabertura')) return empresa.data_abertura || '';

  // Responsável Legal / Sócios
  if (hasToken('responsavel') || hasToken('socio') || hasToken('socio1')) {
    return empresa.qsa?.[0]?.nome || '';
  }

  return undefined;
}


// Etapa 1: Parse do PDF e mapeamento de campos com dados da empresa
export async function parseAndMapPdfFields(
  pdfBuffer: Buffer | ArrayBuffer,
  empresa: EmpresaData
): Promise<{
  mappedFields: MappedField[];
  hasFormFields: boolean;
}> {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  let form;
  try {
    form = pdfDoc.getForm();
  } catch (e) {
    form = null;
  }

  const mappedFields: MappedField[] = [];

  if (form) {
    const fields = form.getFields();

    for (const field of fields) {
      const originalName = field.getName();

      // ── Grupo de rádio (PDFRadioGroup) ──────────────────────────────────
      if (field instanceof PDFRadioGroup) {
        const options = field.getOptions();
        const selected = field.getSelected() ?? '';
        mappedFields.push({
          pdfField: originalName,
          label: getFriendlyLabel(originalName),
          type: 'radio',
          options,
          value: selected,
        });
        continue;
      }

      // ── Checkbox ──────────────────────────────────────────────────────────
      if (field instanceof PDFCheckBox) {
        const matchVal = getMappedValue(originalName, empresa);
        let boolVal = false;
        if (matchVal !== undefined) {
          boolVal = matchVal.toLowerCase().includes('sim') ||
                    matchVal.toLowerCase().includes('ativa') ||
                    matchVal === 'true';
        } else {
          const norm = normalize(originalName);
          if (norm.includes('pessoajuridica') || norm.includes('juridica')) {
            boolVal = !!empresa.cnpj;
          } else if (norm.includes('pessoafisica') || norm.includes('fisica')) {
            boolVal = !empresa.cnpj;
          } else if (norm.includes('optantesimples') || norm.includes('simplesnacional')) {
            boolVal = String(empresa.regime_tributario || '').toLowerCase().includes('simples');
          }
        }
        mappedFields.push({
          pdfField: originalName,
          label: getFriendlyLabel(originalName),
          type: 'checkbox',
          value: boolVal,
        });
        continue;
      }

      // ── Campo de texto (padrão) ───────────────────────────────────────────
      const matchVal = getMappedValue(originalName, empresa);
      mappedFields.push({
        pdfField: originalName,
        label: getFriendlyLabel(originalName),
        type: 'text',
        value: matchVal !== undefined ? matchVal : '',
      });
    }
  }

  // Se não houver campos interativos no PDF, disponibiliza campos padrões cadastrais
  const hasFormFields = mappedFields.length > 0;
  if (!hasFormFields) {
    mappedFields.push(
      { pdfField: 'Razão Social', label: 'Razão Social / Nome Empresarial', type: 'text', value: empresa.razao_social || '' },
      { pdfField: 'Nome Fantasia', label: 'Nome Fantasia', type: 'text', value: empresa.nome_fantasia || empresa.razao_social || '' },
      { pdfField: 'CNPJ', label: 'CNPJ do Estabelecimento', type: 'text', value: empresa.cnpj || '' },
      { pdfField: 'Inscrição Estadual', label: 'Inscrição Estadual (IE)', type: 'text', value: empresa.inscricao_estadual || 'ISENTO' },
      { pdfField: 'Inscrição Municipal', label: 'Inscrição Municipal (IM / CCM)', type: 'text', value: empresa.inscricao_municipal || '' },
      { pdfField: 'CNAE Código', label: 'Código da Atividade (CNAE)', type: 'text', value: empresa.cnae_principal?.codigo || '' },
      { pdfField: 'CNAE Descrição', label: 'Descrição da Atividade (CNAE)', type: 'text', value: empresa.cnae_principal?.descricao || '' },
      { pdfField: 'CEP', label: 'CEP', type: 'text', value: empresa.endereco?.cep || '' },
      { pdfField: 'Logradouro', label: 'Logradouro (Rua / Av)', type: 'text', value: empresa.endereco?.logradouro || '' },
      { pdfField: 'Número', label: 'Número', type: 'text', value: empresa.endereco?.numero || '' },
      { pdfField: 'Complemento', label: 'Complemento', type: 'text', value: empresa.endereco?.complemento || '' },
      { pdfField: 'Bairro', label: 'Bairro', type: 'text', value: empresa.endereco?.bairro || '' },
      { pdfField: 'Município', label: 'Município / Cidade', type: 'text', value: empresa.endereco?.municipio || '' },
      { pdfField: 'UF', label: 'Estado (UF)', type: 'text', value: empresa.endereco?.uf || '' },
      { pdfField: 'Natureza Jurídica', label: 'Natureza Jurídica', type: 'text', value: empresa.natureza_juridica || '' },
      { pdfField: 'Regime Tributário', label: 'Regime Tributário', type: 'text', value: empresa.regime_tributario || '' },
      { pdfField: 'Capital Social', label: 'Capital Social', type: 'text', value: String(empresa.capital_social || '') },
      { pdfField: 'NIRE', label: 'NIRE', type: 'text', value: empresa.nire || '' },
      { pdfField: 'Objeto Social', label: 'Objeto Social', type: 'text', value: empresa.objeto_social || '' },
      { pdfField: 'E-mail', label: 'E-mail de Contato', type: 'text', value: empresa.user?.email || '' },
      { pdfField: 'Responsável Legal', label: 'Responsável Legal / Sócio', type: 'text', value: empresa.qsa?.[0]?.nome || '' },
      { pdfField: 'CPF Responsável', label: 'CPF / CNPJ do Responsável', type: 'text', value: empresa.qsa?.[0]?.cpf_cnpj || '' },
      { pdfField: 'Declaro Dados Verdadeiros', label: 'Declaração de Responsabilidade e Veracidade', type: 'checkbox', value: true }
    );
  }



  return { mappedFields, hasFormFields };
}

// Etapa 2: Preenchimento do PDF com os dados editados pelo usuário
export async function generatePdfWithFields(
  pdfBuffer: Buffer | ArrayBuffer,
  editedFields: MappedField[],
  empresaFallback?: EmpresaData
): Promise<{ pdfBytes: Uint8Array }> {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  let form;
  try {
    form = pdfDoc.getForm();
  } catch (e) {
    form = null;
  }

  let fieldsFilled = 0;

  if (form) {
    const allFormFields = form.getFields();

    for (const item of editedFields) {
      try {
        let field: any = null;
        try {
          field = form.getField(item.pdfField);
        } catch (e) {
          // Busca semântica flexível se o nome exato do pdfField falhar
          const itemNorm = normalize(item.pdfField);
          const labelNorm = normalize(item.label || '');

          field = allFormFields.find((f) => {
            const fNorm = normalize(f.getName());
            return (
              fNorm === itemNorm ||
              fNorm === labelNorm ||
              (itemNorm.includes('razao') && (fNorm.includes('razao') || fNorm.includes('firma'))) ||
              (itemNorm.includes('cnpj') && fNorm.includes('cnpj')) ||
              (itemNorm.includes('fantasia') && fNorm.includes('fantasia')) ||
              (itemNorm.includes('cep') && fNorm.includes('cep')) ||
              (itemNorm.includes('logradouro') && (fNorm.includes('logradouro') || fNorm.includes('rua') || fNorm.includes('endereco'))) ||
              (itemNorm.includes('numero') && (fNorm.includes('numero') || fNorm.endsWith('n') || fNorm.endsWith('no'))) ||
              (itemNorm.includes('bairro') && fNorm.includes('bairro')) ||
              (itemNorm.includes('municipio') && (fNorm.includes('municipio') || fNorm.includes('cidade'))) ||
              (itemNorm.includes('uf') && fNorm.includes('uf')) ||
              (itemNorm.includes('email') && (fNorm.includes('email') || fNorm.includes('eletronico')))
            );
          });
        }

        if (field) {
          if (field instanceof PDFRadioGroup) {
            const selectedVal = String(item.value ?? '');
            if (selectedVal) {
              try { field.select(selectedVal); fieldsFilled++; } catch (_) {}
            }
          } else if (field instanceof PDFCheckBox) {
            if (item.value === true || item.value === 'true') {
              field.check();
            } else {
              field.uncheck();
            }
            fieldsFilled++;
          } else if (field instanceof PDFTextField) {
            field.setText(String(item.value ?? ''));
            fieldsFilled++;
          }
        }
      } catch (err) {
        // Silencioso para não interromper a geração
      }
    }

    // Achata (flatten) os campos para gravar o texto diretamente na página do PDF
    if (fieldsFilled > 0) {
      try {
        form.flatten();
      } catch (flattenErr) {
        console.warn('Form flatten error (não-fatal):', flattenErr);
      }
    }
  }

  // Se o PDF é uma imagem/documento plano sem campos interativos (fieldsFilled === 0),
  // em vez de sobrepor texto na primeira página, anexa uma nova PÁGINA DE RESUMO CADASTRAIS limpa ao final.
  if (!form || fieldsFilled === 0) {
    const newPage = pdfDoc.addPage();
    const { width, height } = newPage.getSize();

    newPage.drawText('ANEXO DE PREENCHIMENTO CADASTRAL - CONTABIL.IA', {
      x: 40,
      y: height - 50,
      size: 14,
    });

    newPage.drawText('Resumo dos dados cadastrais informados para este formulário:', {
      x: 40,
      y: height - 70,
      size: 10,
    });

    let currentY = height - 100;
    for (const f of editedFields) {
      if (currentY < 50) break;
      const displayVal = f.type === 'checkbox' ? (f.value ? '[X] SIM' : '[ ] NÃO') : (f.value || 'N/A');
      const lineText = `${f.label || f.pdfField}: ${displayVal}`;
      
      newPage.drawText(lineText.substring(0, 95), {
        x: 40,
        y: currentY,
        size: 9,
      });
      currentY -= 16;
    }
  }

  const pdfBytes = await pdfDoc.save();
  return { pdfBytes };
}


// Wrapper retrocompatível
export async function fillPdfWithEmpresaData(
  pdfBuffer: Buffer | ArrayBuffer,
  empresa: EmpresaData
) {
  const { mappedFields } = await parseAndMapPdfFields(pdfBuffer, empresa);
  const { pdfBytes } = await generatePdfWithFields(pdfBuffer, mappedFields, empresa);
  return { pdfBytes, fieldsFilled: mappedFields.length, fieldNames: mappedFields.map((m) => m.pdfField), mappedFields };
}

