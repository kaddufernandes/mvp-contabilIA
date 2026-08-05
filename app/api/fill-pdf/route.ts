import { parseAndMapPdfFields } from '../../../src/lib/pdfFiller';
import { EmpresaData } from '../../../src/types';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('pdfFile') as File | null;
    const companyJson = formData.get('companyData') as string | null;

    if (!file || !companyJson) {
      return Response.json({ success: false, error: 'Arquivo ou Empresa ausentes.' }, { status: 400 });
    }

    let empresa: EmpresaData;
    try {
      empresa = JSON.parse(companyJson);
    } catch (e) {
      return Response.json({ success: false, error: 'JSON inválido.' }, { status: 400 });
    }

    const fileBuffer = await file.arrayBuffer();
    
    // Motor universal mapeia todos os campos
    const { mappedFields, hasFormFields } = await parseAndMapPdfFields(fileBuffer, empresa);

    return Response.json({
      success: true,
      mappedFields,
      hasFormFields,
    });
  } catch (error: any) {
    console.error('Erro na rota /api/fill-pdf:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}