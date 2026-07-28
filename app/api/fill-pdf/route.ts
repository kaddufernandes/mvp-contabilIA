import { parseAndMapPdfFields } from '../../../src/lib/pdfFiller';
import { EmpresaData } from '../../../src/types';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('pdfFile') as File | null;
    const companyJson = formData.get('companyData') as string | null;

    if (!file) {
      return Response.json(
        { success: false, error: 'Arquivo PDF não fornecido.' },
        { status: 400 }
      );
    }

    if (!companyJson) {
      return Response.json(
        { success: false, error: 'Dados da empresa não fornecidos.' },
        { status: 400 }
      );
    }

    let empresa: EmpresaData;
    try {
      empresa = JSON.parse(companyJson);
    } catch (e) {
      return Response.json(
        { success: false, error: 'Formato JSON inválido para dados da empresa.' },
        { status: 400 }
      );
    }

    const fileBuffer = await file.arrayBuffer();
    const { mappedFields, hasFormFields } = await parseAndMapPdfFields(fileBuffer, empresa);

    return Response.json({
      success: true,
      mappedFields,
      hasFormFields,
    });
  } catch (error: any) {
    console.error('Erro na rota /api/fill-pdf (Parse):', error);
    return Response.json(
      { success: false, error: error.message || 'Erro ao analisar o documento PDF.' },
      { status: 500 }
    );
  }
}

