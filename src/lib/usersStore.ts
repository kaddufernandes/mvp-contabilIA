import { db } from './firebase';
import { collection, getDocs, query, where, doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  password?: string; // Nota: Não armazenar hashes no Firestore se for usar Firebase Auth
  role?: string;
  createdAt: string;
  updatedAt: string;
}

export async function getUsersStore(): Promise<UserRecord[]> {
  try {
    const snapshot = await getDocs(collection(db, 'usuarios'));
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as UserRecord));
  } catch (e) {
    console.error('Erro ao buscar usuários no Firestore:', e);
    return [];
  }
}

export async function findUserByEmail(email: string): Promise<UserRecord | undefined> {
  try {
    const q = query(collection(db, 'usuarios'), where('email', '==', email.trim().toLowerCase()));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() } as UserRecord;
    }
  } catch (e) {
    console.error('Erro ao buscar usuário por email:', e);
  }
  return undefined;
}

export async function findUserById(id: string): Promise<UserRecord | undefined> {
  try {
    const docRef = doc(db, 'usuarios', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as UserRecord;
    }
  } catch (e) {
    console.error('Erro ao buscar usuário por ID:', e);
  }
  return undefined;
}

export async function createUserStore(data: { id: string; name: string; email: string; role?: string }): Promise<UserRecord> {
  try {
    const now = new Date().toISOString();
    const newUser: UserRecord = {
      id: data.id,
      name: data.name.trim(),
      email: data.email.trim().toLowerCase(),
      role: data.role || 'USER',
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(doc(db, 'usuarios', data.id), newUser);
    return newUser;
  } catch (e) {
    console.error('Erro ao criar usuário no Firestore:', e);
    throw new Error('Erro ao salvar usuário no banco de dados.');
  }
}

export async function updateUserStore(
  id: string,
  data: { name?: string; role?: string }
): Promise<UserRecord> {
  try {
    const docRef = doc(db, 'usuarios', id);
    const updateData: any = { updatedAt: new Date().toISOString() };
    if (data.name) updateData.name = data.name.trim();
    if (data.role) updateData.role = data.role;
    
    await updateDoc(docRef, updateData);
    const updated = await getDoc(docRef);
    return { id: updated.id, ...updated.data() } as UserRecord;
  } catch (e) {
    console.error('Erro ao atualizar usuário:', e);
    throw new Error('Erro ao salvar atualização no banco de dados.');
  }
}

export async function deleteUserStore(id: string): Promise<boolean> {
  try {
    await deleteDoc(doc(db, 'usuarios', id));
    return true;
  } catch (e) {
    console.error('Erro ao excluir usuário:', e);
    throw new Error('Erro ao salvar exclusão no banco de dados.');
  }
}

