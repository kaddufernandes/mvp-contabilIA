import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth';
import {
  getFirestore,
  collection,
  addDoc,
  setDoc,
  getDocs,
  query,
  onSnapshot,
  doc,
  getDocFromServer,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { useState, useEffect } from 'react';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export const loginFirebase = (email: string, password: string) => signInWithEmailAndPassword(auth, email, password);
export const registerFirebase = (email: string, password: string) => createUserWithEmailAndPassword(auth, email, password);
export const logoutFirebase = () => firebaseSignOut(auth);

// Test connection on initialization
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

// Error handler
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface ApuracaoHistoricoItem {
  id?: string;
  cnpj?: string;
  nomeEmpresa?: string;
  periodoApuracao: string;
  valorReceita: string;
  atividadeSelecionada: string;
  foiRetificadora: boolean;
  status: string;
  dataHora: string;
  valorDas?: string;
  mensagem?: string;
  userId?: string;
}

// Function to save apuração record in Firestore
export async function salvarHistoricoApuracao(dados: {
  cnpj?: string;
  nomeEmpresa?: string;
  periodoApuracao: string;
  valorReceita: string;
  atividadeSelecionada: string;
  foiRetificadora: boolean;
  status: string;
  valorDas?: string;
  mensagem?: string;
  dataHora?: string;
}): Promise<string> {
  const path = 'historico_apuracoes';
  try {
    const payload = {
      cnpj: String(dados.cnpj || ''),
      nomeEmpresa: String(dados.nomeEmpresa || ''),
      periodoApuracao: String(dados.periodoApuracao || ''),
      valorReceita: String(dados.valorReceita || '0,00'),
      atividadeSelecionada: String(dados.atividadeSelecionada || ''),
      foiRetificadora: Boolean(dados.foiRetificadora),
      status: String(dados.status || 'Calculado'),
      dataHora: dados.dataHora || new Date().toISOString(),
      valorDas: dados.valorDas ? String(dados.valorDas) : '',
      mensagem: dados.mensagem ? String(dados.mensagem) : '',
      userId: auth.currentUser?.uid || 'anonymous',
    };

    const docRef = await addDoc(collection(db, path), payload);
    return docRef.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
    throw err;
  }
}

// Function to fetch history once
export async function obterHistoricoApuracoes(): Promise<ApuracaoHistoricoItem[]> {
  const path = 'historico_apuracoes';
  try {
    const q = query(collection(db, path));
    const snapshot = await getDocs(q);
    const items: ApuracaoHistoricoItem[] = [];
    snapshot.forEach((doc) => {
      items.push({ id: doc.id, ...doc.data() } as ApuracaoHistoricoItem);
    });
    return items.sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime());
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
    return [];
  }
}

// Custom Hook to listen to apurações history in real-time
export function useHistoricoApuracoes() {
  const [historico, setHistorico] = useState<ApuracaoHistoricoItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const path = 'historico_apuracoes';
    const q = query(collection(db, path));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: ApuracaoHistoricoItem[] = [];
        snapshot.forEach((doc) => {
          items.push({ id: doc.id, ...doc.data() } as ApuracaoHistoricoItem);
        });
        items.sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime());
        setHistorico(items);
        setLoading(false);
      },
      (err) => {
        console.error('Error listening to historico_apuracoes:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { historico, loading, error };
}

export interface EmpresaFirestoreDocument {
  id?: string;
  receitaFederal: {
    cnpj: string;
    razaoSocial: string;
    nomeFantasia: string;
    dataAbertura: string;
    capitalSocial: number | string;
    situacaoCadastral: string;
    regimeTributario: string;
    naturezaJuridica: string;
    cnaePrincipal: { codigo: string; descricao: string };
    cnaesSecundarios: Array<{ codigo: string; descricao: string }>;
  };
  juntaComercial: {
    nire: string;
    objetoSocial: string;
    endereco: {
      cep: string;
      logradouro: string;
      numero: string;
      complemento: string;
      bairro: string;
      municipio: string;
      uf: string;
    };
    socios: Array<{
      nome: string;
      qualificacao: string;
      cpfCnpj: string;
      percentualCapital: string | number;
    }>;
  };
  inscricaoEstadual: {
    ie: string;
    situacaoCadastral: string;
    regimeApuracao: string;
    dataSituacao: string;
  };
  inscricaoMunicipal: {
    im: string;
    ultimaAtualizacao: string;
  };
  metadata: {
    dataCadastro: any;
    userId: string;
  };
}

/**
 * Salva o cadastro de empresa na coleção NoSQL `empresas` do Firestore
 * seguindo a estrutura aninhada das 4 abas (Receita Federal, Junta Comercial, Inscrição Estadual e Inscrição Municipal).
 */
export async function salvarCadastroEmpresa(dadosDaInterface: any): Promise<string> {
  const path = 'empresas';
  try {
    // 1. Receita Federal
    const cnpj = String(dadosDaInterface.receitaFederal?.cnpj || dadosDaInterface.cnpj || '').trim();
    const razaoSocial = String(dadosDaInterface.receitaFederal?.razaoSocial || dadosDaInterface.razao_social || dadosDaInterface.razaoSocial || '').trim();
    const nomeFantasia = String(dadosDaInterface.receitaFederal?.nomeFantasia || dadosDaInterface.nome_fantasia || dadosDaInterface.nomeFantasia || '').trim();
    const dataAbertura = String(dadosDaInterface.receitaFederal?.dataAbertura || dadosDaInterface.data_abertura || dadosDaInterface.dataAbertura || '').trim();

    let rawCapital = dadosDaInterface.receitaFederal?.capitalSocial ?? dadosDaInterface.capital_social ?? dadosDaInterface.capitalSocial ?? 0;
    let capitalSocial: number | string = rawCapital;
    if (typeof rawCapital === 'string') {
      const cleanCapitalStr = rawCapital.replace(/[^\d.,]/g, '').replace(',', '.');
      const parsedCapital = parseFloat(cleanCapitalStr);
      if (!isNaN(parsedCapital)) {
        capitalSocial = parsedCapital;
      }
    }

    const situacaoCadastral = String(dadosDaInterface.receitaFederal?.situacaoCadastral || dadosDaInterface.situacao_cadastral || 'Ativa').trim();
    const regimeTributario = String(dadosDaInterface.receitaFederal?.regimeTributario || dadosDaInterface.regime_tributario || 'Simples Nacional').trim();
    const naturezaJuridica = String(dadosDaInterface.receitaFederal?.naturezaJuridica || dadosDaInterface.natureza_juridica || '').trim();

    const rawCnaePrincipal = dadosDaInterface.receitaFederal?.cnaePrincipal || dadosDaInterface.cnae_principal || {};
    const cnaePrincipal = {
      codigo: String(rawCnaePrincipal.codigo || '').trim(),
      descricao: String(rawCnaePrincipal.descricao || '').trim(),
    };

    const rawCnaesSecundarios = dadosDaInterface.receitaFederal?.cnaesSecundarios || dadosDaInterface.cnaes_secundarios || [];
    const cnaesSecundarios = Array.isArray(rawCnaesSecundarios)
      ? rawCnaesSecundarios.map((c: any) => ({
          codigo: String(c.codigo || '').trim(),
          descricao: String(c.descricao || '').trim(),
        }))
      : [];

    // 2. Junta Comercial
    const nire = String(dadosDaInterface.juntaComercial?.nire || dadosDaInterface.nire || '').trim();
    const objetoSocial = String(dadosDaInterface.juntaComercial?.objetoSocial || dadosDaInterface.objeto_social || '').trim();

    const rawEndereco = dadosDaInterface.juntaComercial?.endereco || dadosDaInterface.endereco || {};
    const endereco = {
      cep: String(rawEndereco.cep || '').trim(),
      logradouro: String(rawEndereco.logradouro || '').trim(),
      numero: String(rawEndereco.numero !== undefined && rawEndereco.numero !== null ? rawEndereco.numero : '').trim(),
      complemento: String(rawEndereco.complemento !== undefined && rawEndereco.complemento !== null ? rawEndereco.complemento : '').trim(),
      bairro: String(rawEndereco.bairro || '').trim(),
      municipio: String(rawEndereco.municipio || '').trim(),
      uf: String(rawEndereco.uf || 'SP').trim(),
    };

    const rawSocios = dadosDaInterface.juntaComercial?.socios || dadosDaInterface.qsa || [];
    const socios = Array.isArray(rawSocios)
      ? rawSocios.map((s: any) => ({
          nome: String(s.nome || '').trim(),
          qualificacao: String(s.qualificacao || '').trim(),
          cpfCnpj: String(s.cpfCnpj || s.cpf_cnpj || '').trim(),
          percentualCapital: s.percentualCapital !== undefined && s.percentualCapital !== null
            ? s.percentualCapital
            : (s.percentual_capital !== undefined ? s.percentual_capital : ''),
        }))
      : [];

    // 3. Inscrição Estadual (Cadesp)
    const ie = String(dadosDaInterface.inscricaoEstadual?.ie || dadosDaInterface.inscricao_estadual || '').trim();
    const ieSituacaoCadastral = String(
      dadosDaInterface.inscricaoEstadual?.situacaoCadastral || dadosDaInterface.ie_situacao_cadastral || 'Ativa'
    ).trim();
    const regimeApuracao = String(
      dadosDaInterface.inscricaoEstadual?.regimeApuracao || dadosDaInterface.ie_regime_apuracao || ''
    ).trim();
    const dataSituacao = String(
      dadosDaInterface.inscricaoEstadual?.dataSituacao || dadosDaInterface.ie_data_situacao || ''
    ).trim();

    // 4. Inscrição Municipal (FDC)
    const im = String(dadosDaInterface.inscricaoMunicipal?.im || dadosDaInterface.inscricao_municipal || '').trim();
    const ultimaAtualizacao = String(
      dadosDaInterface.inscricaoMunicipal?.ultimaAtualizacao ||
      dadosDaInterface.data_atualizacao_ccm ||
      dadosDaInterface.im_ultima_atualizacao ||
      ''
    ).trim();

    // 5. Metadata (Data de Cadastro e ID do Usuário Logado do Firebase Auth)
    const currentUserId = auth.currentUser?.uid || dadosDaInterface.metadata?.userId || dadosDaInterface.userId || 'ID_DO_USUARIO_LOGADO';

    const documentData: Omit<EmpresaFirestoreDocument, 'id'> = {
      receitaFederal: {
        cnpj,
        razaoSocial,
        nomeFantasia,
        dataAbertura,
        capitalSocial,
        situacaoCadastral,
        regimeTributario,
        naturezaJuridica,
        cnaePrincipal,
        cnaesSecundarios,
      },
      juntaComercial: {
        nire,
        objetoSocial,
        endereco,
        socios,
      },
      inscricaoEstadual: {
        ie,
        situacaoCadastral: ieSituacaoCadastral,
        regimeApuracao,
        dataSituacao,
      },
      inscricaoMunicipal: {
        im,
        ultimaAtualizacao,
      },
      metadata: {
        dataCadastro: serverTimestamp(),
        userId: currentUserId,
      },
    };

    const cleanCnpj = cnpj.replace(/\D/g, '');
    let documentId: string;

    if (cleanCnpj && cleanCnpj.length === 14) {
      documentId = cleanCnpj;
      const docRef = doc(db, path, documentId);
      await setDoc(docRef, documentData, { merge: true });
    } else {
      const docRef = await addDoc(collection(db, path), documentData);
      documentId = docRef.id;
    }

    console.log(`[Firestore] Empresa salva com sucesso na coleção 'empresas'. ID: ${documentId}`);
    return documentId;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
    throw err;
  }
}
