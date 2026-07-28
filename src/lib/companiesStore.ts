import { db } from './firebase';
import { collection, getDocs, query, where, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { EmpresaData } from '../types';

export async function getCompaniesStore(userId?: string): Promise<EmpresaData[]> {
  try {
    const colRef = collection(db, 'empresas');
    const snapshot = await getDocs(colRef);
    
    const docs = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as EmpresaData));

    console.log('[Firestore] Empresas encontradas:', docs.length);
    console.log('[Firestore] Filtro userId:', userId);

    if (userId) {
      return docs.filter(doc => doc.metadata?.userId === userId);
    }
    
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
