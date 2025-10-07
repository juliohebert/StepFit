import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    DocumentData,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    updateDoc,
    where
} from 'firebase/firestore';
import { db } from '../config/firebase';

export const firestoreService = {
  // Adicionar documento
  async addDocument(collectionName: string, data: any): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, collectionName), {
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return docRef.id;
    } catch (error) {
      console.error('Erro ao adicionar documento:', error);
      throw error;
    }
  },

  // Obter documento por ID
  async getDocument(collectionName: string, docId: string): Promise<DocumentData | null> {
    try {
      const docRef = doc(db, collectionName, docId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      }
      return null;
    } catch (error) {
      console.error('Erro ao obter documento:', error);
      throw error;
    }
  },

  // Obter todos os documentos de uma coleção
  async getCollection(collectionName: string): Promise<DocumentData[]> {
    try {
      const querySnapshot = await getDocs(collection(db, collectionName));
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Erro ao obter coleção:', error);
      throw error;
    }
  },

  // Obter documentos com query personalizada
  async getDocumentsWithQuery(
    collectionName: string,
    whereConditions?: { field: string; operator: any; value: any }[],
    orderByField?: string,
    orderDirection: 'asc' | 'desc' = 'asc',
    limitCount?: number
  ): Promise<DocumentData[]> {
    try {
      let q = query(collection(db, collectionName));

      // Adicionar condições where
      if (whereConditions) {
        whereConditions.forEach(condition => {
          q = query(q, where(condition.field, condition.operator, condition.value));
        });
      }

      // Adicionar ordenação
      if (orderByField) {
        q = query(q, orderBy(orderByField, orderDirection));
      }

      // Adicionar limite
      if (limitCount) {
        q = query(q, limit(limitCount));
      }

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Erro ao executar query:', error);
      throw error;
    }
  },

  // Atualizar documento
  async updateDocument(collectionName: string, docId: string, data: any): Promise<void> {
    try {
      const docRef = doc(db, collectionName, docId);
      await updateDoc(docRef, {
        ...data,
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('Erro ao atualizar documento:', error);
      throw error;
    }
  },

  // Deletar documento
  async deleteDocument(collectionName: string, docId: string): Promise<void> {
    try {
      const docRef = doc(db, collectionName, docId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Erro ao deletar documento:', error);
      throw error;
    }
  },

  // Obter documentos de um usuário específico
  async getUserDocuments(collectionName: string, userId: string): Promise<DocumentData[]> {
    return this.getDocumentsWithQuery(
      collectionName,
      [{ field: 'userId', operator: '==', value: userId }],
      'createdAt',
      'desc'
    );
  },
};