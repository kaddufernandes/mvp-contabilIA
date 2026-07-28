import { PDFDocument, PDFTextField, PDFCheckBox } from 'pdf-lib';
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
  type: 'text' | 'checkbox';
  value: string | boolean;
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

  // Dicionário de mapeamento de chaves
  const flatData: Record<string, string> = {
    razaosocial: String(empresa.razao_social || ''),
    nomefantasia: String(empresa.nome_fantasia || empresa.razao_social || ''),
    cnpj: String(empresa.cnpj || ''),
    inscricaoestadual: String(empresa.inscricao_estadual || ''),
    ie: String(empresa.inscricao_estadual || ''),
    inscricaomunicipal: String(empresa.inscricao_municipal || ''),
    im: String(empresa.inscricao_municipal || ''),
    ccm: String(empresa.inscricao_municipal || ''),
    situacaocadastral: String(empresa.situacao_cadastral || ''),
    dataabertura: String(empresa.data_abertura || ''),
    capitalsocial: String(empresa.capital_social || ''),
    naturezajuridica: String(empresa.natureza_juridica || ''),
    regimetributario: String(empresa.regime_tributario || ''),
    nire: String(empresa.nire || ''),
    objetosocial: String(empresa.objeto_social || ''),

    // Endereço
    cep: String(empresa.endereco?.cep || ''),
    logradouro: String(empresa.endereco?.logradouro || ''),
    rua: String(empresa.endereco?.logradouro || ''),
    endereco: `${empresa.endereco?.logradouro || ''}, ${empresa.endereco?.numero || ''} ${empresa.endereco?.complemento || ''}`.trim(),
    numero: String(empresa.endereco?.numero || ''),
    complemento: String(empresa.endereco?.complemento || ''),
    bairro: String(empresa.endereco?.bairro || ''),
    municipio: String(empresa.endereco?.municipio || ''),
    cidade: String(empresa.endereco?.municipio || ''),
    uf: String(empresa.endereco?.uf || ''),
    estado: String(empresa.endereco?.uf || ''),

    // CNAE
    cnae: empresa.cnae_principal?.codigo ? `${empresa.cnae_principal.codigo} - ${empresa.cnae_principal.descricao}` : '',
    cnaecodigo: empresa.cnae_principal?.codigo || '',

    // Optante Simples / Isento
    optantesimples: String(empresa.regime_tributario || '').toLowerCase().includes('simples') ? 'true' : 'false',
    isentoie: !empresa.inscricao_estadual || empresa.inscricao_estadual.toLowerCase().includes('isento') ? 'true' : 'false',

    // Sócios
    socio1nome: empresa.qsa?.[0]?.nome || '',
    socio1cpf: empresa.qsa?.[0]?.cpf_cnpj || '',
    socio1qualificacao: empresa.qsa?.[0]?.qualificacao || '',
    socio2nome: empresa.qsa?.[1]?.nome || '',
    socio2cpf: empresa.qsa?.[1]?.cpf_cnpj || '',
  };

  if (form) {
    const fields = form.getFields();

    for (const field of fields) {
      const originalName = field.getName();
      const normName = normalize(originalName);

      const isCheckbox = field instanceof PDFCheckBox;
      const type: 'text' | 'checkbox' = isCheckbox ? 'checkbox' : 'text';

      // Procurar correspondência no flatData
      let matchVal: string | undefined = undefined;
      for (const [key, val] of Object.entries(flatData)) {
        if (!val) continue;
        if (normName === key || normName.includes(key) || key.includes(normName)) {
          matchVal = val;
          break;
        }
      }

      if (isCheckbox) {
        const boolVal = matchVal
          ? matchVal.toLowerCase().includes('sim') ||
            matchVal.toLowerCase().includes('ativa') ||
            matchVal === 'true'
          : false;
        mappedFields.push({
          pdfField: originalName,
          type: 'checkbox',
          value: boolVal,
        });
      } else {
        mappedFields.push({
          pdfField: originalName,
          type: 'text',
          value: matchVal !== undefined ? matchVal : '',
        });
      }
    }
  }

  // Se não houver campos interativos no PDF, disponibiliza campos padrões cadastrais
  const hasFormFields = mappedFields.length > 0;
  if (!hasFormFields) {
    mappedFields.push(
      { pdfField: 'Razão Social', type: 'text', value: empresa.razao_social || '' },
      { pdfField: 'CNPJ', type: 'text', value: empresa.cnpj || '' },
      { pdfField: 'Inscrição Estadual', type: 'text', value: empresa.inscricao_estadual || 'ISENTO' },
      { pdfField: 'Inscrição Municipal', type: 'text', value: empresa.inscricao_municipal || 'N/A' },
      { pdfField: 'Endereço Completo', type: 'text', value: `${empresa.endereco?.logradouro || ''}, ${empresa.endereco?.numero || ''} - ${empresa.endereco?.municipio || ''}/${empresa.endereco?.uf || ''}` },
      { pdfField: 'Declaro Dados Verdadeiros (Simples Nacional)', type: 'checkbox', value: true }
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
    for (const item of editedFields) {
      try {
        const field = form.getField(item.pdfField);
        if (field) {
          if (field instanceof PDFCheckBox) {
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
        console.warn(`Campo ${item.pdfField} não pôde ser atribuído diretamente no formulário:`, err);
      }
    }
  }

  // Se o PDF não tinha formulário nativo, estampa carimbo na primeira página
  if (!form || fieldsFilled === 0) {
    const pages = pdfDoc.getPages();
    if (pages.length > 0) {
      const page = pages[0];
      const { height } = page.getSize();
      
      const stampLines = editedFields.map(
        (f) => `${f.pdfField}: ${f.type === 'checkbox' ? (f.value ? '[X] SIM' : '[ ] NÃO') : f.value}`
      );
      const text = `DOCUMENTO PREENCHIDO POR CONTABIL.IA:\n` + stampLines.join('\n');

      page.drawText(text, {
        x: 30,
        y: height - 50,
        size: 8,
        lineHeight: 11,
      });
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

