import { generatePdfWithFields, MappedField } from '../../../src/lib/pdfFiller';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('pdfFile') as File | null;
    const editedFieldsJson = formData.get('editedFields') as string | null;

    if (!file) {
      return Response.json(
        { success: false, error: 'Arquivo PDF original não fornecido.' },
        { status: 400 }
      );
    }

    if (!editedFieldsJson) {
      return Response.json(
        { success: false, error: 'Campos editados não fornecidos.' },
        { status: 400 }
      );
    }

    let editedFields: MappedField[];
    try {
      editedFields = JSON.parse(editedFieldsJson);
    } catch (e) {
      return Response.json(
        { success: false, error: 'Formato JSON de campos inválido.' },
        { status: 400 }
      );
    }

    const fileBuffer = await file.arrayBuffer();
    const { pdfBytes } = await generatePdfWithFields(fileBuffer, editedFields);

    const pdfBase64 = Buffer.from(pdfBytes).toString('base64');

    return Response.json({
      success: true,
      pdfBase64,
    });
  } catch (error: any) {
    console.error('Erro na rota /api/generate-pdf:', error);
    return Response.json(
      { success: false, error: error.message || 'Erro ao gerar o PDF com os dados editados.' },
      { status: 500 }
    );
  }
}
