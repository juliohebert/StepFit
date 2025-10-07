import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAO8dnhXCJAlJzaos9PaGvCTe0L148eWVg",
  authDomain: "stepfit-9ee62.firebaseapp.com",
  projectId: "stepfit-9ee62",
  storageBucket: "stepfit-9ee62.appspot.com",
  messagingSenderId: "123456789", // Substitua pelo seu sender ID
  appId: "1:123456789:web:abcdef123456" // Substitua pelo seu app ID
};

// Verificar se o Firebase já foi inicializado
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Inicializar serviços com persistência para React Native
let auth;
try {
  auth = getAuth(app);
} catch (error) {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
}

const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };
export default app;