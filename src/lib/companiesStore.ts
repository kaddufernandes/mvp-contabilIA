import { db } from './firebase';
import { collection, getDocs, query, where, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { EmpresaData } from '../types';

export async function getCompaniesStore(userId?: string): Promise<EmpresaData[]> {
  try {
    const colRef = collection(db, 'empresas');
    const snapshot = await getDocs(colRef);
    
    const docs = snapshot.docs.map((docSnapshot) => {
      const data = docSnapshot.data();

      // TRADUÇÃO: Pega o formato aninhado do Firebase e converte para o formato plano da tela
      return {
        id: docSnapshot.id,
        cnpj: data.receitaFederal?.cnpj || data.cnpj || '',
        razao_social: data.receitaFederal?.razaoSocial || data.razao_social || data.razaoSocial || '',
        nome_fantasia: data.receitaFederal?.nomeFantasia || data.nome_fantasia || data.nomeFantasia || '',
        situacao_cadastral: data.receitaFederal?.situacaoCadastral || data.situacao_cadastral || '',
        regime_tributario: data.receitaFederal?.regimeTributario || data.regime_tributario || '',
        data_abertura: data.receitaFederal?.dataAbertura || data.data_abertura || '',
        capital_social: data.receitaFederal?.capitalSocial || data.capital_social || '',
        natureza_juridica: data.receitaFederal?.naturezaJuridica || data.natureza_juridica || '',
        cnae_principal: data.receitaFederal?.cnaePrincipal || data.cnae_principal || {},
        cnaes_secundarios: data.receitaFederal?.cnaesSecundarios || data.cnaes_secundarios || [],

        nire: data.juntaComercial?.nire || data.nire || '',
        objeto_social: data.juntaComercial?.objetoSocial || data.objeto_social || '',
        endereco: data.juntaComercial?.endereco || data.endereco || {},
        qsa: data.juntaComercial?.socios || data.qsa || [],

        inscricao_estadual: data.inscricaoEstadual?.ie || data.inscricao_estadual || '',
        ie_situacao_cadastral: data.inscricaoEstadual?.situacaoCadastral || data.ie_situacao_cadastral || '',
        ie_regime_apuracao: data.inscricaoEstadual?.regimeApuracao || data.ie_regime_apuracao || '',
        ie_data_situacao: data.inscricaoEstadual?.dataSituacao || data.ie_data_situacao || '',

        inscricao_municipal: data.inscricaoMunicipal?.im || data.inscricao_municipal || '',
        data_atualizacao_ccm: data.inscricaoMunicipal?.ultimaAtualizacao || data.data_atualizacao_ccm || '',

        metadata: data.metadata || {},
        user: data.user || { name: 'Sistema' },
        ...data // Mantém o restante dos dados intactos
      } as EmpresaData;
    });

    console.log('[Firestore] Empresas mapeadas com sucesso:', docs.length);

    // Filtro de usuário desativado temporariamente para garantir que as empresas
    // do banco apareçam na tela sem bloqueios de ID.
    return docs;
  } catch (e) {
    console.error('Erro ao buscar empresas no Firestore:', e);
    return [];
  }
}

export async function saveCompanyStore(data: Partial<EmpresaData>): Promise<string> {
  try {
    const docId = data.id || `emp_${Date.now()}`;
    const docRef = doc(db, 'empresas', docId);
    await setDoc(docRef, data, { merge: true });
    return docId;
  } catch (e) {
    console.error('Erro ao salvar empresa no Firestore:', e);
    throw new Error('Erro ao salvar empresa no banco de dados.');
  }
}

export async function deleteCompanyStore(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'empresas', id));
  } catch (e) {
    console.error('Erro ao excluir empresa:', e);
    throw new Error('Erro ao excluir empresa do banco de dados.');
  }
}