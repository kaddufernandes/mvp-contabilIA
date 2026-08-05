import { PDFDocument, PDFTextField, PDFCheckBox, PDFRadioGroup, PDFDropdown } from 'pdf-lib';
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
  type: 'text' | 'checkbox' | 'radio' | 'dropdown';
  value: string | boolean;
  options?: string[];
}

export function getFriendlyLabel(pdfField: string): string {
  if (!pdfField) return 'Campo Sem Nome';
  const clean = pdfField.trim();
  const readable = clean
    .replace(/[_]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
  return readable.charAt(0).toUpperCase() + readable.slice(1);
}

export function getMappedValue(fieldName: string, empresa: EmpresaData): string | undefined {
  if (!fieldName) return undefined;
  const norm = normalize(fieldName);

  if (norm.includes('cnpj')) return empresa.cnpj || '';
  if (norm.includes('cep')) return empresa.endereco?.cep || '';
  if (norm.includes('fantasia')) return empresa.nome_fantasia || empresa.razao_social || '';
  if (norm.includes('razao') || norm.includes('firma') || norm.includes('nomeempresarial')) {
    if (!norm.includes('tecn') && !norm.includes('legal')) {
      return empresa.razao_social || '';
    }
  }
  if (norm.includes('logradouro') || norm.includes('rua') || norm.includes('avenida') || norm.includes('endereco')) return empresa.endereco?.logradouro || '';
  if (norm.includes('numero') || norm.endsWith('num') || norm.endsWith('n') || norm.endsWith('no')) return empresa.endereco?.numero || '';
  if (norm.includes('complemento') || norm.includes('compl')) return empresa.endereco?.complemento || '';
  if (norm.includes('bairro')) return empresa.endereco?.bairro || '';
  if (norm.includes('municipio') || norm.includes('cidade')) return empresa.endereco?.municipio || '';
  if (norm.includes('uf') || norm.includes('estado')) return empresa.endereco?.uf || '';
  if (norm.includes('email') || norm.includes('eletronico')) return empresa.user?.email || '';
  if (norm.includes('cnae') || norm.includes('codativ') || norm.includes('codigoatividade')) return empresa.cnae_principal?.codigo || '';
  if (norm.includes('descrativ') || norm.includes('descricaoatividade')) return empresa.cnae_principal?.descricao || '';
  if (norm.includes('ie') || norm.includes('inscricaoestadual')) return empresa.inscricao_estadual || '';
  if (norm.includes('im') || norm.includes('inscricaomunicipal') || norm.includes('ccm')) return empresa.inscricao_municipal || '';

  return undefined;
}

// ----------------------------------------------------------------------------------
// 1. LÊ E MAPEIA CAMPOS EXISTENTES DO PDF NATIVO
// ----------------------------------------------------------------------------------
export async function parseAndMapPdfFields(
  pdfBuffer: Buffer | ArrayBuffer,
  empresa: EmpresaData
): Promise<{ mappedFields: MappedField[]; hasFormFields: boolean }> {
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

      if (field instanceof PDFRadioGroup) {
        mappedFields.push({
          pdfField: originalName,
          label: getFriendlyLabel(originalName),
          type: 'radio',
          options: field.getOptions(),
          value: field.getSelected() ?? ''
        });
      } else if (field instanceof PDFCheckBox) {
        mappedFields.push({
          pdfField: originalName,
          label: getFriendlyLabel(originalName),
          type: 'checkbox',
          value: field.isChecked()
        });
      } else if (field instanceof PDFDropdown) {
        mappedFields.push({
          pdfField: originalName,
          label: getFriendlyLabel(originalName),
          type: 'dropdown',
          options: field.getOptions(),
          value: field.getSelected()[0] ?? ''
        });
      } else if (field instanceof PDFTextField) {
        const matchVal = getMappedValue(originalName, empresa);
        mappedFields.push({
          pdfField: originalName,
          label: getFriendlyLabel(originalName),
          type: 'text',
          value: matchVal !== undefined ? matchVal : (field.getText() ?? '')
        });
      }
    }
  }

  return { mappedFields, hasFormFields: mappedFields.length > 0 };
}

// ----------------------------------------------------------------------------------
// 2. CONSTRUTOR DE ACROFORM (Transfoma PDF Plano em Interativo)
// ----------------------------------------------------------------------------------
export async function createAcroformFields(
  pdfBuffer: Buffer | ArrayBuffer,
  fields: { name: string; type: string; page: number; x: number; y: number; width: number; height: number }[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const form = pdfDoc.getForm();

  for (const field of fields) {
    const page = pdfDoc.getPage(field.page || 0);
    try {
      if (field.type === 'text') {
        const textField = form.createTextField(field.name);
        textField.addToPage(page, { x: Number(field.x), y: Number(field.y), width: Number(field.width), height: Number(field.height) });
      } else if (field.type === 'checkbox') {
        const checkbox = form.createCheckBox(field.name);
        checkbox.addToPage(page, { x: Number(field.x), y: Number(field.y), width: Number(field.width), height: Number(field.height) });
      }
    } catch (e) {
      console.warn(`Erro ao criar campo ${field.name}:`, e);
    }
  }

  return await pdfDoc.save();
}

// ----------------------------------------------------------------------------------
// 3. PREENCHIMENTO E GERAÇÃO FINAL DO PDF
// ----------------------------------------------------------------------------------
export async function generatePdfWithFields(
  pdfBuffer: Buffer | ArrayBuffer,
  editedFields: MappedField[]
): Promise<{ pdfBytes: Uint8Array }> {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  let form;
  try {
    form = pdfDoc.getForm();
  } catch (e) {
    form = null;
  }

  if (form) {
    const allFormFields = form.getFields();

    for (const item of editedFields) {
      try {
        let field: any = null;
        try {
          field = form.getField(item.pdfField);
        } catch (e) {
          field = allFormFields.find((f) => f.getName() === item.pdfField);
        }

        if (field) {
          if (field instanceof PDFRadioGroup || field instanceof PDFDropdown) {
            const selectedVal = String(item.value ?? '');
            if (selectedVal) {
              try { field.select(selectedVal); } catch (_) {}
            }
          } else if (field instanceof PDFCheckBox) {
            if (item.value === true || item.value === 'true') {
              field.check();
            } else {
              field.uncheck();
            }
          } else if (field instanceof PDFTextField) {
            field.setText(String(item.value ?? ''));
          }
        }
      } catch (err) {}
    }

    try {
      form.flatten();
    } catch (flattenErr) {
      console.warn('Flatten warning:', flattenErr);
    }
  }

  const pdfBytes = await pdfDoc.save();
  return { pdfBytes };
}