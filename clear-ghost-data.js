// Script temporário para limpar dados fantasma das dietas
import { collection, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { db } from './config/firebase';

const clearCollectionFromFirebase = async (collectionName) => {
  try {
    console.log(`🧹 Iniciando limpeza da coleção ${collectionName}...`);
    const querySnapshot = await getDocs(collection(db, collectionName));
    
    console.log(`📊 Encontrados ${querySnapshot.size} documentos na coleção ${collectionName}`);
    
    for (const docSnap of querySnapshot.docs) {
      console.log(`🗑️ Removendo documento ${docSnap.id}:`, docSnap.data());
      await deleteDoc(doc(db, collectionName, docSnap.id));
    }
    
    console.log(`✅ Limpeza da coleção ${collectionName} concluída`);
  } catch (error) {
    console.error(`❌ Erro ao limpar coleção ${collectionName}:`, error);
  }
};

const debugCollectionContents = async (collectionName) => {
  try {
    console.log(`🔍 Verificando conteúdo da coleção ${collectionName}...`);
    const querySnapshot = await getDocs(collection(db, collectionName));
    
    console.log(`📊 Total de documentos na coleção ${collectionName}: ${querySnapshot.size}`);
    
    querySnapshot.forEach((doc) => {
      console.log(`📄 Documento ${doc.id}:`, doc.data());
    });
    
    if (querySnapshot.size === 0) {
      console.log(`✅ Coleção ${collectionName} está vazia (como esperado)`);
    }
  } catch (error) {
    console.error(`❌ Erro ao verificar coleção ${collectionName}:`, error);
  }
};

const runClearGhostData = async () => {
  console.log('🚀 INICIANDO LIMPEZA DE DADOS FANTASMA');
  
  // Verificar conteúdo antes
  await debugCollectionContents('planos_dieta');
  await debugCollectionContents('dietPlans');
  
  // Limpar ambas as coleções
  await clearCollectionFromFirebase('planos_dieta');
  await clearCollectionFromFirebase('dietPlans');
  
  // Verificar conteúdo depois
  console.log('🔄 Verificando se limpeza foi efetiva...');
  await debugCollectionContents('planos_dieta');
  await debugCollectionContents('dietPlans');
  
  console.log('✅ LIMPEZA CONCLUÍDA');
};

// Executar a limpeza
runClearGhostData().catch(console.error);