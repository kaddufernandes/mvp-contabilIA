import { db } from './firebase';
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { EmpresaData, Role, VinculoTipo } from '../types';

// ============================================================
// HELPERS DE MAPEAMENTO
// ============================================================

/**
 * Converte um documento bruto do Firestore no formato tipado EmpresaData.
 * Suporta tanto o formato aninhado (receitaFederal, juntaComercial) quanto o flat.
 */
function mapFirestoreToEmpresa(docSnapshot: any): EmpresaData {
  const data = docSnapshot.data();
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
    // Multi-tenant
    usuariosVinculados: data.usuariosVinculados || {},
    userId: data.userId || '',
    createdAt: data.createdAt || '',
    updatedAt: data.updatedAt || '',
    fonte_dados: data.fonte_dados || {},
    ...data, // preserva campos extras
  } as EmpresaData;
}

// ============================================================
// LEITURA COM RBAC
// ============================================================

/**
 * Busca empresas respeitando o papel (role) do usuário:
 * - ADMIN → retorna todas as empresas
 * - CONTADOR / USER → retorna apenas empresas onde o uid consta em usuariosVinculados
 */
export async function getCompaniesStore(
  userId?: string,
  role?: Role
): Promise<EmpresaData[]> {
  try {
    const colRef = collection(db, 'empresas');

    // ADMIN vê tudo — sem filtro
    if (!userId || role === 'ADMIN') {
      const snapshot = await getDocs(colRef);
      const docs = snapshot.docs.map(mapFirestoreToEmpresa);
      console.log(`[Firestore] ADMIN — ${docs.length} empresa(s) carregada(s).`);
      return docs;
    }

    // USER e CONTADOR — filtro pelo mapa usuariosVinculados
    // Firestore suporta: where('usuariosVinculados.{uid}', 'in', ['DONO', 'CONTADOR'])
    // Porém 'in' em campo de mapa não é diretamente suportado; usamos != null approach:
    const q = query(
      colRef,
      where(`usuariosVinculados.${userId}`, 'in', ['DONO', 'CONTADOR'])
    );
    const snapshot = await getDocs(q);
    const docs = snapshot.docs.map((d) => {
      const empresa = mapFirestoreToEmpresa(d);
      // Enriquece com o tipo de vínculo do usuário atual
      empresa.vinculoAtual = empresa.usuariosVinculados?.[userId] as VinculoTipo | undefined;
      return empresa;
    });

    console.log(`[Firestore] ${role} (${userId}) — ${docs.length} empresa(s) vinculada(s).`);
    return docs;
  } catch (e) {
    console.error('[Firestore] Erro ao buscar empresas:', e);
    return [];
  }
}

// ============================================================
// ESCRITA COM VÍNCULO AUTOMÁTICO
// ============================================================

/**
 * Salva ou atualiza uma empresa no Firestore.
 * Na criação (sem id), injeta automaticamente o userId como 'DONO' em usuariosVinculados.
 */
export async function saveCompanyStore(
  data: Partial<EmpresaData>,
  creatorUserId?: string
): Promise<string> {
  try {
    const isNew = !data.id;
    const docId = data.id || `emp_${Date.now()}`;
    const docRef = doc(db, 'empresas', docId);
    const now = new Date().toISOString();

    const payload: Partial<EmpresaData> & { updatedAt: string; createdAt?: string } = {
      ...data,
      id: docId,
      updatedAt: now,
    };

    // Na criação: injeta o criador como DONO e define createdAt
    if (isNew && creatorUserId) {
      payload.createdAt = now;
      payload.usuariosVinculados = {
        ...(data.usuariosVinculados || {}),
        [creatorUserId]: 'DONO',
      };
    }

    await setDoc(docRef, payload, { merge: true });
    console.log(`[Firestore] Empresa ${isNew ? 'criada' : 'atualizada'}: ${docId}`);
    return docId;
  } catch (e) {
    console.error('[Firestore] Erro ao salvar empresa:', e);
    throw new Error('Erro ao salvar empresa no banco de dados.');
  }
}

// ============================================================
// VÍNCULO DE CONTADOR A UMA EMPRESA
// ============================================================

/**
 * Vincula um usuário (contador ou dono) a uma empresa existente.
 * Apenas ADMIN ou o próprio DONO podem fazer isso.
 */
export async function vincularUsuarioEmpresa(
  empresaId: string,
  targetUserId: string,
  vinculo: VinculoTipo,
  requestorId: string,
  requestorRole: Role
): Promise<void> {
  // Apenas ADMIN pode vincular qualquer usuário
  if (requestorRole !== 'ADMIN') {
    const docSnap = await getDoc(doc(db, 'empresas', empresaId));
    if (!docSnap.exists()) throw new Error('Empresa não encontrada.');
    const vinculos = docSnap.data().usuariosVinculados || {};
    if (vinculos[requestorId] !== 'DONO') {
      throw new Error('Acesso negado: somente o DONO ou ADMIN pode vincular usuários.');
    }
  }

  await updateDoc(doc(db, 'empresas', empresaId), {
    [`usuariosVinculados.${targetUserId}`]: vinculo,
    updatedAt: new Date().toISOString(),
  });
  console.log(`[Firestore] Usuário ${targetUserId} vinculado como ${vinculo} na empresa ${empresaId}.`);
}

/**
 * Remove o vínculo de um usuário de uma empresa.
 */
export async function desvincularUsuarioEmpresa(
  empresaId: string,
  targetUserId: string,
  requestorId: string,
  requestorRole: Role
): Promise<void> {
  if (requestorRole !== 'ADMIN') {
    const docSnap = await getDoc(doc(db, 'empresas', empresaId));
    if (!docSnap.exists()) throw new Error('Empresa não encontrada.');
    const vinculos = docSnap.data().usuariosVinculados || {};
    if (vinculos[requestorId] !== 'DONO') {
      throw new Error('Acesso negado: somente o DONO ou ADMIN pode desvincular usuários.');
    }
  }

  const { deleteField } = await import('firebase/firestore');
  await updateDoc(doc(db, 'empresas', empresaId), {
    [`usuariosVinculados.${targetUserId}`]: deleteField(),
    updatedAt: new Date().toISOString(),
  });
}

// ============================================================
// EXCLUSÃO
// ============================================================

export async function deleteCompanyStore(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'empresas', id));
  } catch (e) {
    console.error('[Firestore] Erro ao excluir empresa:', e);
    throw new Error('Erro ao excluir empresa do banco de dados.');
  }
}