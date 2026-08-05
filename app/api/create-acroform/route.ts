import { createAcroformFields } from '../../../src/lib/pdfFiller';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('pdfFile') as File | null;
    const fieldsJson = formData.get('fieldsConfig') as string | null;

    if (!file || !fieldsJson) {
      return Response.json({ success: false, error: 'Arquivo PDF ou configuração de campos ausentes.' }, { status: 400 });
    }

    let fieldsConfig: any[];
    try {
      fieldsConfig = JSON.parse(fieldsJson);
    } catch (e) {
      return Response.json({ success: false, error: 'Formato JSON inválido para os campos.' }, { status: 400 });
    }

    const fileBuffer = await file.arrayBuffer();
    
    // Chama o motor para desenhar os campos digitais (AcroForm) no PDF plano
    const pdfBytes = await createAcroformFields(fileBuffer, fieldsConfig);

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="AcroForm_${file.name}"`,
      },
    });

  } catch (error: any) {
    console.error('Erro na rota /api/create-acroform:', error);
    return Response.json({ success: false, error: error.message || 'Erro ao converter PDF em AcroForm.' }, { status: 500 });
  }
}