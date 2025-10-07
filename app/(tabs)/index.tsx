import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Firebase imports
import { db } from '@/config/firebase';
import { authService } from '@/services/authService';
import { firestoreService } from '@/services/firestoreService';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc
} from 'firebase/firestore';

const { width, height } = Dimensions.get('window');

// Configuração das notificações
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: string;
  muscle: string;
  weight?: number;
  category?: string;
  completed?: boolean;
  restTime?: number; // em segundos
  videoUrl?: string;
  instructions: string[];
  musclesWorked: string[];
  tips: string[];
  difficulty: 'Iniciante' | 'Intermediário' | 'Avançado';
  equipment: string[];
}

interface Food {
  id: number;
  name: string;
  calories: number; // por 100g
  protein: number; // gramas por 100g
  carbs: number; // gramas por 100g
  fat: number; // gramas por 100g
  fiber?: number; // gramas por 100g
  category: string;
}

interface FoodEntry {
  food: Food;
  quantity: number; // total em gramas (baseQuantity * multiplier)
  baseQuantity?: number; // quantidade base em gramas (opcional, para exibição)
  multiplier?: number; // multiplicador usado (opcional, para exibição)
}

interface Meal {
  id: number;
  name: string;
  time?: string;
  foods: FoodEntry[];
  timestamp: Date;
  completed?: boolean;
}

interface CurrentMeal {
  name: string;
  time: string;
  foods: FoodEntry[];
}

interface DailyDiet {
  id: number;
  date: string;
  meals: Meal[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
}

interface WorkoutPlan {
  id: string;
  name: string;
  weeklyExercises: { [key: string]: Exercise[] };
}

interface DietPlan {
  id: string;
  name: string;
  weeklyMeals: {
    [key: string]: Meal[]; // 'segunda', 'terca', 'quarta', etc.
  };
  totalCalories: number;
}

type DayOfWeek = 'segunda' | 'terca' | 'quarta' | 'quinta' | 'sexta' | 'sabado' | 'domingo';

// Base de dados de exercícios
const EXERCISE_DATABASE: Exercise[] = [
  // PEITO
  {
    id: 'supino-reto',
    name: 'Supino Reto',
    sets: 3,
    reps: '8-12',
    muscle: 'Peito',
    category: 'Peito',
    difficulty: 'Intermediário',
    equipment: ['Barra', 'Banco'],
    instructions: [
      'Deite no banco com os pés firmes no chão',
      'Segure a barra com pegada ligeiramente mais larga que os ombros',
      'Desça a barra controladamente até o peito',
      'Empurre a barra de volta à posição inicial'
    ],
    musclesWorked: ['Peitoral maior', 'Tríceps', 'Deltoides anterior'],
    tips: ['Mantenha os ombros retraídos', 'Controle a descida', 'Não trave os cotovelos']
  },
  {
    id: 'supino-inclinado',
    name: 'Supino Inclinado',
    sets: 3,
    reps: '8-12',
    muscle: 'Peito',
    category: 'Peito',
    difficulty: 'Intermediário',
    equipment: ['Barra', 'Banco inclinado'],
    instructions: [
      'Ajuste o banco em 30-45 graus',
      'Posicione-se com a barra alinhada ao peito superior',
      'Desça controladamente',
      'Empurre explosivamente para cima'
    ],
    musclesWorked: ['Peitoral superior', 'Deltoides anterior', 'Tríceps'],
    tips: ['Inclinação ideal: 30-45°', 'Foque no peito superior', 'Mantenha core ativado']
  },
  {
    id: 'flexao',
    name: 'Flexão de Braço',
    sets: 3,
    reps: '10-20',
    muscle: 'Peito',
    category: 'Peito',
    difficulty: 'Iniciante',
    equipment: [],
    instructions: [
      'Posição de prancha com mãos na largura dos ombros',
      'Desça o corpo até quase tocar o chão',
      'Empurre de volta à posição inicial',
      'Mantenha o corpo alinhado'
    ],
    musclesWorked: ['Peitoral', 'Tríceps', 'Core', 'Deltoides'],
    tips: ['Corpo sempre alinhado', 'Desça completamente', 'Controle o movimento']
  },

  // COSTAS
  {
    id: 'barra-fixa',
    name: 'Barra Fixa',
    sets: 3,
    reps: '5-12',
    muscle: 'Costas',
    category: 'Costas',
    difficulty: 'Intermediário',
    equipment: ['Barra fixa'],
    instructions: [
      'Pendure na barra com pegada pronada',
      'Puxe o corpo até o queixo passar da barra',
      'Desça controladamente',
      'Estenda completamente os braços'
    ],
    musclesWorked: ['Latíssimo do dorso', 'Romboides', 'Bíceps'],
    tips: ['Ative as escápulas primeiro', 'Evite balançar', 'Descida controlada']
  },
  {
    id: 'remada-curvada',
    name: 'Remada Curvada',
    sets: 3,
    reps: '8-12',
    muscle: 'Costas',
    category: 'Costas',
    difficulty: 'Intermediário',
    equipment: ['Barra'],
    instructions: [
      'Incline o tronco mantendo as costas retas',
      'Puxe a barra em direção ao abdômen',
      'Aperte as escápulas no topo',
      'Desça controladamente'
    ],
    musclesWorked: ['Latíssimo', 'Romboides', 'Trapézio médio', 'Bíceps'],
    tips: ['Mantenha costas neutras', 'Puxe com os cotovelos', 'Aperte as escápulas']
  },

  // PERNAS
  {
    id: 'agachamento',
    name: 'Agachamento',
    sets: 3,
    reps: '10-15',
    muscle: 'Pernas',
    category: 'Pernas',
    difficulty: 'Iniciante',
    equipment: [],
    instructions: [
      'Pés na largura dos ombros',
      'Desça como se fosse sentar numa cadeira',
      'Desça até coxas paralelas ao chão',
      'Suba empurrando pelos calcanhares'
    ],
    musclesWorked: ['Quadríceps', 'Glúteos', 'Isquiotibiais'],
    tips: ['Peso nos calcanhares', 'Joelhos alinhados', 'Core ativado']
  },
  {
    id: 'levantamento-terra',
    name: 'Levantamento Terra',
    sets: 3,
    reps: '6-10',
    muscle: 'Pernas',
    category: 'Pernas',
    difficulty: 'Avançado',
    equipment: ['Barra'],
    instructions: [
      'Pés na largura dos quadris',
      'Segure a barra com pegada dupla pronada',
      'Mantenha costas retas e levante',
      'Estenda quadris e joelhos simultaneamente'
    ],
    musclesWorked: ['Isquiotibiais', 'Glúteos', 'Erectores da espinha', 'Trapézio'],
    tips: ['Costas sempre retas', 'Barra próxima ao corpo', 'Movimento dos quadris']
  },

  // OMBROS
  {
    id: 'desenvolvimento-ombros',
    name: 'Desenvolvimento de Ombros',
    sets: 3,
    reps: '8-12',
    muscle: 'Ombros',
    category: 'Ombros',
    difficulty: 'Intermediário',
    equipment: ['Halteres'],
    instructions: [
      'Sentado ou em pé com halteres nas mãos',
      'Posicione os halteres na altura dos ombros',
      'Empurre para cima até estender os braços',
      'Desça controladamente'
    ],
    musclesWorked: ['Deltoides', 'Tríceps'],
    tips: ['Não trave os cotovelos', 'Core estabilizado', 'Movimento controlado']
  },
  {
    id: 'elevacao-lateral',
    name: 'Elevação Lateral',
    sets: 3,
    reps: '12-15',
    muscle: 'Ombros',
    category: 'Ombros',
    difficulty: 'Iniciante',
    equipment: ['Halteres'],
    instructions: [
      'Em pé com halteres ao lado do corpo',
      'Eleve os braços lateralmente até altura dos ombros',
      'Pausa no topo',
      'Desça controladamente'
    ],
    musclesWorked: ['Deltoides lateral'],
    tips: ['Cotovelos ligeiramente flexionados', 'Não balance o corpo', 'Movimento suave']
  },

  // BRAÇOS
  {
    id: 'rosca-biceps',
    name: 'Rosca Bíceps',
    sets: 3,
    reps: '10-15',
    muscle: 'Braços',
    category: 'Braços',
    difficulty: 'Iniciante',
    equipment: ['Halteres'],
    instructions: [
      'Em pé com halteres nas mãos',
      'Cotovelos fixos ao lado do corpo',
      'Flexione os braços levando os halteres ao peito',
      'Desça controladamente'
    ],
    musclesWorked: ['Bíceps'],
    tips: ['Cotovelos fixos', 'Não balance', 'Contração no topo']
  },
  {
    id: 'triceps-testa',
    name: 'Tríceps Testa',
    sets: 3,
    reps: '10-15',
    muscle: 'Braços',
    category: 'Braços',
    difficulty: 'Intermediário',
    equipment: ['Halteres'],
    instructions: [
      'Deitado no banco com halteres',
      'Braços estendidos sobre o peito',
      'Flexione apenas os cotovelos baixando os pesos',
      'Estenda os braços de volta'
    ],
    musclesWorked: ['Tríceps'],
    tips: ['Apenas cotovelos se movem', 'Controle total', 'Cuidado com os pesos']
  }
];

// Funções helper para obter informações do treino de hoje
const getTodayWorkout = (workoutPlans: WorkoutPlan[], currentDay: DayOfWeek) => {
  for (const plan of workoutPlans) {
    const dayWorkouts = plan.weeklyExercises[currentDay];
    if (dayWorkouts && dayWorkouts.length > 0) {
      return { plan, dayWorkouts };
    }
  }
  return null;
};

const getTodayWorkoutTitle = (workoutPlans: WorkoutPlan[], currentDay: DayOfWeek) => {
  const todayWorkout = getTodayWorkout(workoutPlans, currentDay);
  if (todayWorkout) {
    return todayWorkout.plan.name;
  }
  return 'Nenhum treino programado';
};

const getTodayWorkoutSubtitle = (workoutPlans: WorkoutPlan[], currentDay: DayOfWeek) => {
  const todayWorkout = getTodayWorkout(workoutPlans, currentDay);
  if (todayWorkout) {
    const exerciseCount = todayWorkout.dayWorkouts.length;
    const estimatedTime = exerciseCount * 8; // Estimativa de 8 minutos por exercício
    return `${exerciseCount} exercícios • ${estimatedTime}-${estimatedTime + 15} min`;
  }
  return 'Toque para criar um treino';
};

const getTodayWorkoutProgress = (workoutPlans: WorkoutPlan[], currentDay: DayOfWeek) => {
  const todayWorkout = getTodayWorkout(workoutPlans, currentDay);
  if (todayWorkout) {
    const completedExercises = todayWorkout.dayWorkouts.filter(ex => ex.completed).length;
    const totalExercises = todayWorkout.dayWorkouts.length;
    return totalExercises > 0 ? Math.round((completedExercises / totalExercises) * 100) : 0;
  }
  return 0;
};

// Função helper para obter o dia atual da semana
const getCurrentDayOfWeek = (): DayOfWeek => {
  const today = new Date();
  const dayIndex = today.getDay(); // 0 = Domingo, 1 = Segunda, etc.
  
  const dayMap: { [key: number]: DayOfWeek } = {
    0: 'domingo',
    1: 'segunda',
    2: 'terca',
    3: 'quarta',
    4: 'quinta',
    5: 'sexta',
    6: 'sabado'
  };
  
  return dayMap[dayIndex];
};

// Funções de persistência de dados
const STORAGE_KEYS = {
  WORKOUT_PLANS: '@workout_plans',
  DIET_PLANS: '@diet_plans',
  USER_STATS: '@user_stats',
  WEIGHT_HISTORY: '@weight_history',
  WORKOUT_HISTORY: '@workout_history',
  GOALS: '@goals',
  NOTIFICATIONS: '@notifications',
  USER_FAVORITE_EXERCISE: '@user_favorite_exercise'
};

// Salvar dados diretamente no Firebase
const saveData = async (key: string, data: any) => {
  try {
    // Mapear chave AsyncStorage para coleção Firebase
    const firebaseKey = STORAGE_TO_FIREBASE_MAPPING[key] || key;
    
    if (key === STORAGE_KEYS.WORKOUT_PLANS) {
      // Salvar cada plano individualmente no Firebase
      for (const plan of data) {
        await saveDataToFirebase(firebaseKey, plan.id, plan);
      }
      console.log(`� ${data.length} planos de treino salvos`);
    } else if (key === STORAGE_KEYS.DIET_PLANS) {
      // Salvar cada plano de dieta individualmente
      for (const plan of data) {
        await saveDataToFirebase(firebaseKey, plan.id, plan);
      }
      console.log(`� ${data.length} planos de dieta salvos`);
    } else if (key === STORAGE_KEYS.WEIGHT_HISTORY) {
      // Salvar cada entrada do histórico individualmente
      for (const entry of data) {
        const entryId = entry.date || new Date().toISOString();
        await saveDataToFirebase(firebaseKey, entryId, entry);
      }
      console.log(`� ${data.length} entradas de peso salvas`);
    } else if (key === STORAGE_KEYS.WORKOUT_HISTORY) {
      // Salvar cada sessão de treino individualmente
      for (const session of data) {
        await saveDataToFirebase(firebaseKey, session.id, session);
      }
      console.log(`� ${data.length} sessões de treino salvas`);
    } else if (key === STORAGE_KEYS.GOALS) {
      // Salvar cada objetivo individualmente
      for (const goal of data) {
        await saveDataToFirebase(firebaseKey, goal.id, goal);
      }
      console.log(`� ${data.length} objetivos salvos`);
    } else if (key === STORAGE_KEYS.NOTIFICATIONS) {
      // Salvar cada notificação individualmente
      for (const notification of data) {
        await saveDataToFirebase(firebaseKey, notification.id, notification);
      }
      console.log(`� ${data.length} notificações salvas`);
    } else {
      // Para dados únicos (userStats, favoriteExercise), usar um ID fixo
      await saveDataToFirebase(firebaseKey, 'dados_usuario', data);
      console.log(`� Dados salvos`);
    }
  } catch (error) {
    console.error(`❌ Erro ao salvar no Firebase ${key}:`, error);
  }
};

// Carregar dados diretamente do Firebase (versão atualizada)
const loadData = async (key: string, defaultValue: any = null) => {
  try {
    // Mapear chave AsyncStorage para coleção Firebase
    const firebaseKey = STORAGE_TO_FIREBASE_MAPPING[key] || key;
    
    if (key === STORAGE_KEYS.WORKOUT_PLANS) {
      const plans = await loadCollectionFromFirebase(firebaseKey);
      console.log(`🔥 ${plans.length} planos de treino carregados do Firebase`);
      return plans.length > 0 ? plans : defaultValue;
    } else if (key === STORAGE_KEYS.DIET_PLANS) {
      const plans = await loadCollectionFromFirebase(firebaseKey);
      console.log(`🔥 ${plans.length} planos de dieta carregados do Firebase`);
      return plans.length > 0 ? plans : defaultValue;
    } else if (key === STORAGE_KEYS.WEIGHT_HISTORY) {
      const history = await loadCollectionFromFirebase(firebaseKey);
      console.log(`🔥 ${history.length} entradas de peso carregadas do Firebase`);
      return history.length > 0 ? history : defaultValue;
    } else if (key === STORAGE_KEYS.WORKOUT_HISTORY) {
      const history = await loadCollectionFromFirebase(firebaseKey);
      console.log(`🔥 ${history.length} sessões de treino carregadas do Firebase`);
      return history.length > 0 ? history : defaultValue;
    } else if (key === STORAGE_KEYS.GOALS) {
      const goals = await loadCollectionFromFirebase(firebaseKey);
      console.log(`🔥 ${goals.length} objetivos carregados do Firebase`);
      return goals.length > 0 ? goals : defaultValue;
    } else if (key === STORAGE_KEYS.NOTIFICATIONS) {
      const notifications = await loadCollectionFromFirebase(firebaseKey);
      console.log(`🔥 ${notifications.length} notificações carregadas do Firebase`);
      return notifications.length > 0 ? notifications : defaultValue;
    } else {
      // Para dados únicos (userStats, favoriteExercise), carregar documento específico
      const data = await loadDataFromFirebase(firebaseKey, 'dados_usuario', defaultValue);
      console.log(`🔥 Dados carregados do Firebase - ${firebaseKey}:`, data);
      return data;
    }
  } catch (error) {
    console.error(`❌ Erro ao carregar do Firebase ${key}:`, error);
    return defaultValue;
  }
};

// Carregar dados diretamente do Firebase
// Versão legacy - será removida
const loadDataOld = async (key: string, defaultValue: any = null) => {
  try {
    // Mapear chaves para coleções Firebase
    if (key === STORAGE_KEYS.WORKOUT_PLANS) {
      const plans = await loadCollectionFromFirebase('workoutPlans');
      console.log(`🔥 ${plans.length} planos carregados do Firebase`);
      return plans.length > 0 ? plans : defaultValue;
    } else {
      // Para outros dados, carregar do Firebase
      const data = await loadDataFromFirebase(key, 'data', defaultValue);
      console.log(`� Dados carregados do Firebase - ${key}:`, data);
      return data;
    }
  } catch (error) {
    console.error(`❌ Erro ao carregar do Firebase ${key}:`, error);
    return defaultValue;
  }
};

// ============================================
// FIREBASE FUNCTIONS - Firestore Integration
// ============================================

// Mapeamento de chaves AsyncStorage para coleções Firebase
const STORAGE_TO_FIREBASE_MAPPING: { [key: string]: string } = {
  '@workout_plans': 'workoutPlans',
  '@diet_plans': 'dietPlans', 
  '@user_stats': 'userStats',
  '@weight_history': 'weightHistory',
  '@workout_history': 'workoutHistory',
  '@goals': 'goals',
  '@notifications': 'notifications',
  '@user_favorite_exercise': 'userFavoriteExercise'
};

// Mapeamento de nomes das coleções em português
const FIREBASE_COLLECTIONS: { [key: string]: string } = {
  workoutPlans: 'planos_treino',
  dietPlans: 'planos_dieta', 
  userStats: 'estatisticas_usuario',
  weightHistory: 'historico_peso',
  workoutHistory: 'historico_treinos',
  goals: 'objetivos',
  notifications: 'notificacoes',
  exercises: 'exercicios',
  meals: 'refeicoes',
  userFavoriteExercise: 'exercicio_favorito'
};

// Salvar dados no Firebase Firestore
const saveDataToFirebase = async (collection_key: string, doc_id: string, data: any) => {
  try {
    const userId = 'usuario_padrao'; // Nome em português
    
    // Usar nome em português da coleção
    const collection_name = FIREBASE_COLLECTIONS[collection_key] || collection_key;
    
    const docRef = doc(db, 'usuarios', userId, collection_name, doc_id);
    await setDoc(docRef, {
      ...data,
      atualizadoEm: new Date(),
      usuarioId: userId
    }, { merge: true });
    
    // Log simplificado apenas com ID do documento
    console.log(`💾 Salvo: ${collection_name}/${doc_id}`);
  } catch (error) {
    console.error(`❌ Erro ao salvar no Firebase ${collection_key}/${doc_id}:`, error);
    throw error;
  }
};

// Carregar dados do Firebase Firestore
const loadDataFromFirebase = async (collection_key: string, doc_id: string, defaultValue: any = null): Promise<any> => {
  try {
    const userId = 'usuario_padrao'; // Nome em português
    
    // Usar nome em português da coleção
    const collection_name = FIREBASE_COLLECTIONS[collection_key] || collection_key;
    
    const docRef = doc(db, 'usuarios', userId, collection_name, doc_id);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const firebaseData = docSnap.data();
      console.log(`✅ Dados carregados do Firebase - ${collection_name}/${doc_id}:`, firebaseData);
      return firebaseData;
    } else {
      console.log(`📱 Documento não encontrado no Firebase - ${collection_key}/${doc_id}`);
      return defaultValue;
    }
  } catch (error) {
    console.error(`❌ Erro ao carregar do Firebase ${collection_key}/${doc_id}:`, error);
    return defaultValue;
  }
};

// Carregar todos os documentos de uma coleção
const loadCollectionFromFirebase = async (collection_key: string) => {
  try {
    const userId = 'usuario_padrao'; // Nome em português
    
    // Usar nome em português da coleção
    const collection_name = FIREBASE_COLLECTIONS[collection_key] || collection_key;
    
    const collectionRef = collection(db, 'usuarios', userId, collection_name);
    const querySnapshot = await getDocs(collectionRef);
    
    const documents: any[] = [];
    querySnapshot.forEach((doc) => {
      documents.push({ id: doc.id, ...doc.data() });
    });
    
    console.log(`✅ Coleção carregada do Firebase - ${collection_name}:`, documents);
    return documents;
  } catch (error) {
    console.error(`❌ Erro ao carregar coleção do Firebase ${collection_key}:`, error);
    return [];
  }
};

// Listener em tempo real para uma coleção
const setupRealtimeListener = (collection_key: string, callback: (data: any[]) => void) => {
  try {
    const userId = 'usuario_padrao';
    const collection_name = FIREBASE_COLLECTIONS[collection_key] || collection_key;
    
    const collectionRef = collection(db, 'usuarios', userId, collection_name);
    
    const unsubscribe = onSnapshot(collectionRef, (querySnapshot) => {
      const documents: any[] = [];
      querySnapshot.forEach((doc) => {
        documents.push({ id: doc.id, ...doc.data() });
      });
      
      // Log simplificado apenas com contagem
      if (documents.length > 0) {
        console.log(`🔄 ${collection_name}: ${documents.length} itens sincronizados`);
      }
      callback(documents);
    }, (error) => {
      console.error(`❌ Erro no listener ${collection_key}:`, error);
    });
    
    return unsubscribe;
  } catch (error) {
    console.error(`❌ Erro ao configurar listener ${collection_key}:`, error);
    return null;
  }
};

// Deletar documento do Firebase
const deleteDataFromFirebase = async (collection_key: string, doc_id: string) => {
  try {
    const userId = 'usuario_padrao'; // Nome em português
    
    // Usar nome em português da coleção
    const collection_name = FIREBASE_COLLECTIONS[collection_key] || collection_key;
    
    const docRef = doc(db, 'usuarios', userId, collection_name, doc_id);
    await deleteDoc(docRef);
    
    console.log(`✅ Documento deletado do Firebase - ${collection_name}/${doc_id}`);
  } catch (error) {
    console.error(`❌ Erro ao deletar do Firebase ${collection_key}/${doc_id}:`, error);
  }
};

// Função para limpar uma coleção inteira (para debugging)
const clearCollectionFromFirebase = async (collection_key: string) => {
  try {
    const userId = 'usuario_padrao';
    const collection_name = FIREBASE_COLLECTIONS[collection_key] || collection_key;
    
    const collectionRef = collection(db, 'usuarios', userId, collection_name);
    const querySnapshot = await getDocs(collectionRef);
    
    console.log(`🧹 Limpando coleção ${collection_name} (${querySnapshot.size} documentos)...`);
    
    const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
    
    console.log(`✅ Coleção ${collection_name} limpa com sucesso!`);
  } catch (error) {
    console.error(`❌ Erro ao limpar coleção ${collection_key}:`, error);
  }
};

// Função para listar conteúdo de uma coleção (para debugging)
const debugCollectionContents = async (collection_key: string) => {
  try {
    const userId = 'usuario_padrao';
    const collection_name = FIREBASE_COLLECTIONS[collection_key] || collection_key;
    
    const collectionRef = collection(db, 'usuarios', userId, collection_name);
    const querySnapshot = await getDocs(collectionRef);
    
    console.log(`🔍 DEBUG - Conteúdo da coleção ${collection_name}:`);
    querySnapshot.docs.forEach(doc => {
      console.log(`  📄 Doc ${doc.id}:`, doc.data());
    });
  } catch (error) {
    console.error(`❌ Erro ao listar coleção ${collection_key}:`, error);
  }
};

interface UserStats {
  weight: number;
  height: number;
  age: number;
  bodyFat: number;
  muscle: number;
  name?: string;
  profileImage?: string;
  bio?: string;
  
  // Informações adicionais para estatísticas
  gender?: 'male' | 'female' | 'other';
  activityLevel?: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  fitnessGoal?: 'weight_loss' | 'muscle_gain' | 'maintenance' | 'strength' | 'endurance';
  experienceLevel?: 'beginner' | 'intermediate' | 'advanced';
  weeklyWorkoutGoal?: number; // Meta de treinos por semana
  dailyCalorieGoal?: number; // Meta de calorias diárias
  dailyWaterGoal?: number; // Meta de água em litros
  sleepGoal?: number; // Meta de horas de sono
  startDate?: string; // Data de início no app
  
  // Medidas corporais adicionais
  chest?: number; // Peitoral (cm)
  waist?: number; // Cintura (cm)
  hips?: number; // Quadril (cm)
  arms?: number; // Braços (cm)
  thighs?: number; // Coxas (cm)
  
  // Preferências de treino
  preferredWorkoutTime?: 'morning' | 'afternoon' | 'evening' | 'night';
  workoutDuration?: number; // Duração preferida em minutos
  restDayPreference?: number[]; // Dias da semana preferidos para descanso (0-6)
}

interface WeightEntry {
  id: string;
  date: string;
  weight: number;
  bodyFat?: number;
  muscle?: number;
}

interface Notification {
  id: string;
  type: 'workout' | 'meal';
  title: string;
  time: string;
  enabled: boolean;
  days: number[]; // 0-6, domingo a sábado
}

interface HealthTip {
  id: string;
  title: string;
  content: string;
  category: 'nutrition' | 'health' | 'workout' | 'wellness';
  icon: string;
  isRead: boolean;
  createdAt: string;
}

interface Goal {
  id: string;
  type: 'weight_loss' | 'muscle_gain' | 'strength' | 'endurance';
  title: string;
  description: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  deadline: string;
  completed: boolean;
  createdAt: string;
}

interface WorkoutSession {
  id: string;
  workoutPlanId: string;
  workoutName: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number; // em minutos
  completedExercises: CompletedExercise[];
  totalVolume: number; // peso total levantado
  notes?: string;
}

interface CompletedExercise {
  exerciseId: string;
  exerciseName: string;
  sets: CompletedSet[];
  muscle: string;
  restTime?: number;
}

interface CompletedSet {
  setNumber: number;
  reps: number;
  weight: number;
  completed: boolean;
  restTime?: number;
}

interface WorkoutStats {
  totalWorkouts: number;
  totalVolume: number;
  averageDuration: number;
  favoriteExercise: string;
  currentStreak: number;
  longestStreak: number;
  weeklyFrequency: number;
  monthlyProgress: MonthlyProgress[];
}

interface MonthlyProgress {
  month: string;
  workouts: number;
  volume: number;
  avgDuration: number;
}

interface Goal {
  id: string;
  type: 'weight_loss' | 'muscle_gain' | 'strength' | 'endurance';
  title: string;
  description: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  deadline: string;
  completed: boolean;
  createdAt: string;
}

// Função para testar a conectividade com Firebase
const testFirebaseConnection = async () => {
  try {
    console.log('🔥 Testando conexão com Firebase...');
    
    const testData = {
      mensagem: 'Teste de conexão',
      timestamp: new Date(),
      versaoApp: '1.0.0'
    };
    
    // Testar escrita
    const testDocRef = doc(db, 'usuarios', 'usuario_padrao', 'teste', 'conexao');
    await setDoc(testDocRef, testData);
    console.log('✅ Teste de escrita no Firebase: SUCCESS');
    
    // Testar leitura
    const testDocSnap = await getDoc(testDocRef);
    if (testDocSnap.exists()) {
      console.log('✅ Teste de leitura no Firebase: SUCCESS', testDocSnap.data());
    } else {
      console.log('❌ Teste de leitura no Firebase: FAILED');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Erro no teste de Firebase:', error);
    return false;
  }
};

// Função para migrar dados existentes do Firebase (inglês para português)
const migrateFirebaseToPortuguese = async () => {
  try {
    console.log('🔄 Verificando migração Firebase para português...');
    
    // Primeiro, verificar se existem dados na estrutura antiga em inglês
    const oldUserId = 'user_default';
    const oldCollectionRef = collection(db, 'users', oldUserId, 'workoutPlans');
    
    try {
      const oldQuerySnapshot = await getDocs(oldCollectionRef);
      
      if (!oldQuerySnapshot.empty) {
        console.log(`🔄 Encontrados ${oldQuerySnapshot.size} treinos na estrutura antiga. Migrando...`);
        
        // Migrar cada treino para a nova estrutura
        const migratedWorkouts = [];
        for (const docSnapshot of oldQuerySnapshot.docs) {
          const workoutData = { id: docSnapshot.id, ...docSnapshot.data() } as any;
          try {
            await saveDataToFirebase('workoutPlans', workoutData.id, workoutData);
            migratedWorkouts.push(workoutData);
            console.log(`✅ Treino "${workoutData.name || workoutData.id}" migrado para português`);
          } catch (error) {
            console.error(`❌ Erro ao migrar treino ${workoutData.id}:`, error);
          }
        }
        
        console.log(`🎉 Migração concluída! ${migratedWorkouts.length} treinos migrados para estrutura em português`);
        
        // Opcional: remover dados antigos após migração bem-sucedida
        // (comentado por segurança - pode descomentar depois de confirmar que funciona)
        /*
        for (const docSnapshot of oldQuerySnapshot.docs) {
          await deleteDoc(docSnapshot.ref);
          console.log(`🗑️ Documento antigo removido: ${docSnapshot.id}`);
        }
        */
        
        return migratedWorkouts;
      } else {
        console.log('📱 Nenhum dado na estrutura antiga encontrado');
        return [];
      }
    } catch (error) {
      console.log('📱 Estrutura antiga não encontrada ou sem dados');
      return [];
    }
  } catch (error) {
    console.error('❌ Erro na migração para português:', error);
    return [];
  }
};

// Função para migrar coleções com nomes em inglês para português
const migrateCollectionNames = async (cleanupOld: boolean = false) => {
  try {
    console.log('🔄 Iniciando migração de nomes de coleções para português...');
    const userId = 'usuario_padrao';
    
    // Mapeamento de coleções antigas (inglês) para novas (português)
    const COLLECTION_MIGRATIONS = [
      { old: '@weight_history', new: 'historico_peso' },
      { old: '@diet_plans', new: 'planos_dieta' },
      { old: '@goals', new: 'objetivos' },
      { old: '@notifications', new: 'notificacoes' },
      { old: '@user_stats', new: 'estatisticas_usuario' },
      { old: '@workout_history', new: 'historico_treinos' },
      { old: '@user_favorite_exercise', new: 'exercicio_favorito' }
    ];
    
    for (const migration of COLLECTION_MIGRATIONS) {
      try {
        console.log(`🔄 Migrando ${migration.old} -> ${migration.new}...`);
        
        // Carregar dados da coleção antiga
        const oldCollectionRef = collection(db, 'usuarios', userId, migration.old);
        const oldQuerySnapshot = await getDocs(oldCollectionRef);
        
        if (oldQuerySnapshot.empty) {
          console.log(`⏭️ Coleção ${migration.old} vazia, pulando...`);
          continue;
        }
        
        // Migrar cada documento
        for (const docSnapshot of oldQuerySnapshot.docs) {
          const data = docSnapshot.data();
          const documentId = docSnapshot.id;
          
          // Salvar na nova coleção com nome em português
          const newDocRef = doc(db, 'usuarios', userId, migration.new, documentId);
          await setDoc(newDocRef, {
            ...data,
            migradoEm: new Date(),
            origem: migration.old
          });
          
          console.log(`✅ Documento ${documentId} migrado de ${migration.old} para ${migration.new}`);
        }
        
        console.log(`🎉 Migração de ${migration.old} concluída! ${oldQuerySnapshot.size} documentos migrados.`);
        
        // Se solicitado, remover a coleção antiga após migração
        if (cleanupOld) {
          console.log(`🗑️ Removendo coleção antiga: ${migration.old}...`);
          for (const docSnapshot of oldQuerySnapshot.docs) {
            await deleteDoc(docSnapshot.ref);
          }
          console.log(`✅ Coleção antiga ${migration.old} removida!`);
        }
        
      } catch (error) {
        console.error(`❌ Erro ao migrar ${migration.old}:`, error);
      }
    }
    
    console.log('🎉 Migração de nomes de coleções concluída!');
    return true;
    
  } catch (error) {
    console.error('❌ Erro na migração de nomes de coleções:', error);
    return false;
  }
};

// Função para limpar coleções antigas em inglês
const cleanupOldCollections = async () => {
  try {
    console.log('🧹 Iniciando limpeza de coleções antigas em inglês...');
    const userId = 'usuario_padrao';
    
    // Lista de coleções antigas para remover
    const OLD_COLLECTIONS = [
      '@weight_history',
      '@diet_plans', 
      '@goals',
      '@notifications',
      '@user_stats',
      '@workout_history',
      '@user_favorite_exercise'
    ];
    
    for (const oldCollection of OLD_COLLECTIONS) {
      try {
        console.log(`🗑️ Removendo coleção antiga: ${oldCollection}...`);
        
        // Carregar todos os documentos da coleção antiga
        const oldCollectionRef = collection(db, 'usuarios', userId, oldCollection);
        const oldQuerySnapshot = await getDocs(oldCollectionRef);
        
        if (oldQuerySnapshot.empty) {
          console.log(`⏭️ Coleção ${oldCollection} já foi removida ou está vazia`);
          continue;
        }
        
        // Remover cada documento da coleção antiga
        for (const docSnapshot of oldQuerySnapshot.docs) {
          await deleteDoc(docSnapshot.ref);
        }
        
        console.log(`✅ Coleção ${oldCollection} removida! ${oldQuerySnapshot.size} documentos apagados.`);
        
      } catch (error) {
        console.error(`❌ Erro ao remover coleção ${oldCollection}:`, error);
      }
    }
    
    console.log('🎉 Limpeza de coleções antigas concluída!');
    return true;
    
  } catch (error) {
    console.error('❌ Erro na limpeza de coleções antigas:', error);
    return false;
  }
};

export default function FitnessApp() {
  // @ts-ignore - Ignorando erros TypeScript não críticos para demonstração
  const [currentScreen, setCurrentScreen] = useState('menu');
  const [workoutPlans, setWorkoutPlans] = useState<WorkoutPlan[]>([]);
  const [selectedWorkoutDay, setSelectedWorkoutDay] = useState<DayOfWeek>(getCurrentDayOfWeek());
  const [selectedDaysForEdit, setSelectedDaysForEdit] = useState<DayOfWeek[]>([getCurrentDayOfWeek()]);
  const [dietPlans, setDietPlans] = useState<DietPlan[]>([]);
  const [userStats, setUserStats] = useState<UserStats>({
    weight: 70,
    height: 175,
    age: 25,
    bodyFat: 15,
    muscle: 40,
    name: 'Usuário StepFit',
    profileImage: '',
    bio: 'Focado em evolução e resultados!',
    
    // Valores padrão para novos campos
    gender: 'male',
    activityLevel: 'moderate',
    fitnessGoal: 'muscle_gain',
    experienceLevel: 'intermediate',
    weeklyWorkoutGoal: 4,
    dailyCalorieGoal: 2500,
    dailyWaterGoal: 2.5,
    sleepGoal: 8,
    startDate: new Date().toISOString().split('T')[0],
    
    // Medidas corporais opcionais
    chest: 100,
    waist: 85,
    hips: 95,
    arms: 35,
    thighs: 60,
    
    // Preferências
    preferredWorkoutTime: 'evening',
    workoutDuration: 60,
    restDayPreference: [0, 6] // Domingo e Sábado
  });
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [weightHistory, setWeightHistory] = useState<WeightEntry[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [timer, setTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [restTimer, setRestTimer] = useState(0);
  const [isRestTimerRunning, setIsRestTimerRunning] = useState(false);
  const [activeWorkout, setActiveWorkout] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [healthTips, setHealthTips] = useState<HealthTip[]>([]);
  const [showHealthTipsModal, setShowHealthTipsModal] = useState(false);
  const [selectedTipCategory, setSelectedTipCategory] = useState<string>('all');
  const [goals, setGoals] = useState<Goal[]>([
    {
      id: '1',
      type: 'weight_loss',
      title: 'Perder 10kg em 6 meses',
      description: 'Meta de perda de peso para melhorar saúde e disposição',
      targetValue: 10,
      currentValue: 3,
      unit: 'kg',
      deadline: '31/12/2024',
      createdAt: '2024-06-01T00:00:00.000Z',
      completed: false
    },
    {
      id: '2',
      type: 'strength',
      title: 'Supino 100kg',
      description: 'Conseguir levantar 100kg no supino reto',
      targetValue: 100,
      currentValue: 80,
      unit: 'kg',
      deadline: '01/03/2025',
      createdAt: '2024-01-15T00:00:00.000Z',
      completed: false
    }
  ]);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  
  // Estados para edição de exercícios
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [editingWorkoutId, setEditingWorkoutId] = useState<string>('');
  const [editExerciseName, setEditExerciseName] = useState('');
  const [editExerciseSets, setEditExerciseSets] = useState('');
  const [editExerciseReps, setEditExerciseReps] = useState('');
  const [editExerciseWeight, setEditExerciseWeight] = useState('');
  const [editExerciseRestTime, setEditExerciseRestTime] = useState('');
  const [selectedWorkoutForNewExercise, setSelectedWorkoutForNewExercise] = useState<string | null>(null);
  
  // Estados para adicionar exercícios
  const [showAddExerciseModal, setShowAddExerciseModal] = useState(false);
  const [showAddExerciseSection, setShowAddExerciseSection] = useState(false);
  const [exerciseSearchTerm, setExerciseSearchTerm] = useState('');
  const [selectedMuscleFilter, setSelectedMuscleFilter] = useState<string>('Todos');
  const [selectedExerciseToAdd, setSelectedExerciseToAdd] = useState<Exercise | null>(null);
  const [newExerciseSets, setNewExerciseSets] = useState('3');
  const [newExerciseReps, setNewExerciseReps] = useState('10');
  const [newExerciseWeight, setNewExerciseWeight] = useState('');
  
  // Estados para dieta
  const [selectedDiet, setSelectedDiet] = useState<DailyDiet | null>(null);
  
  // Estados para nova dieta
  const [newDietName, setNewDietName] = useState('');
  const [showDietNameModal, setShowDietNameModal] = useState(false);
  const [newDietMeals, setNewDietMeals] = useState<Meal[]>([]);
  const [currentMeal, setCurrentMeal] = useState<CurrentMeal>({
    name: '',
    time: '',
    foods: []
  });
  const [selectedDietDay, setSelectedDietDay] = useState<DayOfWeek>(getCurrentDayOfWeek());
  
  // Estados para melhorar usabilidade da dieta
  const [foodSearchTerm, setFoodSearchTerm] = useState('');
  const [selectedFoodCategory, setSelectedFoodCategory] = useState('Todos');
  const [dietStep, setDietStep] = useState(1); // 1: Info básica, 2: Adicionar refeições, 3: Revisar
  const [mealTemplates, setMealTemplates] = useState<Meal[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);

  // Estados para edição de dietas
  const [isEditingDiet, setIsEditingDiet] = useState(false);
  const [currentEditDiet, setCurrentEditDiet] = useState<DietPlan | null>(null);
  const [showEditDietModal, setShowEditDietModal] = useState(false);
  
  const [availableFoods] = useState([
    { id: 1, name: 'Aveia', calories: 300, protein: 10, carbs: 55, fat: 6, category: 'Grãos' },
    { id: 2, name: 'Banana', calories: 90, protein: 1, carbs: 23, fat: 0.3, category: 'Frutas' },
    { id: 3, name: 'Whey Protein', calories: 120, protein: 25, carbs: 3, fat: 1, category: 'Suplementos' },
    { id: 4, name: 'Peito de Frango', calories: 350, protein: 65, carbs: 0, fat: 8, category: 'Carnes' },
    { id: 5, name: 'Arroz Integral', calories: 220, protein: 5, carbs: 45, fat: 2, category: 'Grãos' },
    { id: 6, name: 'Brócolis', calories: 55, protein: 6, carbs: 11, fat: 0.6, category: 'Vegetais' },
    { id: 7, name: 'Ovo', calories: 155, protein: 13, carbs: 1, fat: 11, category: 'Laticínios' },
    { id: 8, name: 'Batata Doce', calories: 180, protein: 4, carbs: 41, fat: 0.3, category: 'Tubérculos' },
    { id: 9, name: 'Salmão', calories: 350, protein: 39, carbs: 0, fat: 20, category: 'Carnes' },
    { id: 10, name: 'Espinafre', calories: 23, protein: 3, carbs: 4, fat: 0.4, category: 'Vegetais' },
    { id: 11, name: 'Maçã', calories: 52, protein: 0.3, carbs: 14, fat: 0.2, category: 'Frutas' },
    { id: 12, name: 'Amendoim', calories: 567, protein: 26, carbs: 16, fat: 49, category: 'Oleaginosas' },
    { id: 13, name: 'Quinoa', calories: 368, protein: 14, carbs: 64, fat: 6, category: 'Grãos' },
    { id: 14, name: 'Iogurte Grego', calories: 59, protein: 10, carbs: 4, fat: 0.4, category: 'Laticínios' },
    { id: 15, name: 'Azeite', calories: 884, protein: 0, carbs: 0, fat: 100, category: 'Óleos' }
  ]);

  // Estados para novos lembretes
  const [showNewReminderModal, setShowNewReminderModal] = useState(false);
  const [newReminderTitle, setNewReminderTitle] = useState('');
  const [newReminderTime, setNewReminderTime] = useState('');
  const [newReminderType, setNewReminderType] = useState<'workout' | 'meal'>('meal');
  const [newReminderDays, setNewReminderDays] = useState<number[]>([]);
  const [selectedFoodForMeal, setSelectedFoodForMeal] = useState<any>(null);
  const [selectedFoodsForMeal, setSelectedFoodsForMeal] = useState<Food[]>([]); // Para seleção múltipla
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false); // Modo de seleção múltipla
  const [foodQuantityForDiet, setFoodQuantityForDiet] = useState('100');
  const [foodMultiplier, setFoodMultiplier] = useState('1');
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [foodSearch, setFoodSearch] = useState('');
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [foodQuantity, setFoodQuantity] = useState(100);
  const [newMealName, setNewMealName] = useState('');
  
  // Estados para histórico de treinos
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutSession[]>([]);
  const [currentWorkoutSession, setCurrentWorkoutSession] = useState<WorkoutSession | null>(null);
  const [workoutStats, setWorkoutStats] = useState<WorkoutStats>({
    totalWorkouts: 0,
    totalVolume: 0,
    averageDuration: 0,
    favoriteExercise: 'Supino',
    currentStreak: 0,
    longestStreak: 0,
    weeklyFrequency: 0,
    monthlyProgress: []
  });
  const [selectedDateRange, setSelectedDateRange] = useState('7days'); // 7days, 30days, 3months, 1year
  
  // Estados para sistema de metas e objetivos
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [userDefinedFavoriteExercise, setUserDefinedFavoriteExercise] = useState<string>(''); // Exercício favorito definido pelo usuário
  const [showFavoriteExerciseModal, setShowFavoriteExerciseModal] = useState(false);
  const [favoriteExercisesList, setFavoriteExercisesList] = useState<string[]>([]);
  const [showUpdateGoalModal, setShowUpdateGoalModal] = useState(false);
  const [updateGoalValue, setUpdateGoalValue] = useState('');
  const [newGoal, setNewGoal] = useState({
    type: 'weight_loss' as 'weight_loss' | 'muscle_gain' | 'strength' | 'endurance',
    title: '',
    description: '',
    targetValue: 0,
    currentValue: 0,
    unit: 'kg',
    deadline: '',
  });
  
  // Estados para criação de treinos personalizados
  const [customWorkoutName, setCustomWorkoutName] = useState('');
  const [selectedExercisesForWorkout, setSelectedExercisesForWorkout] = useState<Exercise[]>([]);
  const [selectedDaysForWorkout, setSelectedDaysForWorkout] = useState<DayOfWeek[]>(['segunda']);
  const [availableExercises, setAvailableExercises] = useState<Exercise[]>([]);
  const [editingWorkout, setEditingWorkout] = useState<WorkoutPlan | null>(null);
  const [showPresetWorkouts, setShowPresetWorkouts] = useState(false);
  const [selectedPresetWorkout, setSelectedPresetWorkout] = useState<any>(null);
  
  // Estados para edição de treinos
  const [editingWorkoutName, setEditingWorkoutName] = useState('');
  const [isEditingWorkout, setIsEditingWorkout] = useState(false);
  
  const [newExercise, setNewExercise] = useState({
    name: '',
    sets: 3,
    reps: 10,
    weight: 0,
    muscle: 'Peito',
    category: 'Peito',
    restTime: 60
  });

  // Timer principal do treino
  useEffect(() => {
    let interval: any;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimer(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  // Timer de descanso
  useEffect(() => {
    let interval: any;
    if (isRestTimerRunning && restTimer > 0) {
      interval = setInterval(() => {
        setRestTimer(prev => {
          if (prev <= 1) {
            setIsRestTimerRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRestTimerRunning, restTimer]);

  // Base de dados de alimentos
  const foodDatabase: Food[] = [
    { id: 1, name: 'Aveia', calories: 389, protein: 16.9, carbs: 66.3, fat: 6.9, category: 'Cereais', fiber: 10.6 },
    { id: 2, name: 'Banana', calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3, category: 'Frutas', fiber: 2.6 },
    { id: 3, name: 'Whey Protein', calories: 400, protein: 80, carbs: 10, fat: 4, category: 'Suplementos', fiber: 0 },
    { id: 4, name: 'Peito de Frango', calories: 165, protein: 31, carbs: 0, fat: 3.6, category: 'Carnes', fiber: 0 },
    { id: 5, name: 'Arroz Integral', calories: 111, protein: 2.6, carbs: 22, fat: 0.9, category: 'Cereais', fiber: 1.8 },
    { id: 6, name: 'Brócolis', calories: 25, protein: 3, carbs: 5, fat: 0.3, category: 'Vegetais', fiber: 3 },
    { id: 7, name: 'Batata Doce', calories: 86, protein: 1.6, carbs: 20.1, fat: 0.1, category: 'Tubérculos', fiber: 3 },
    { id: 8, name: 'Ovo', calories: 155, protein: 13, carbs: 1.1, fat: 11, category: 'Proteínas', fiber: 0 },
    { id: 9, name: 'Salmão', calories: 208, protein: 20, carbs: 0, fat: 13, category: 'Peixes', fiber: 0 },
    { id: 10, name: 'Amêndoas', calories: 579, protein: 21, carbs: 22, fat: 50, category: 'Oleaginosas', fiber: 12 }
  ];

  // Função para calcular valores nutricionais
  const calculateNutrition = (foods: FoodEntry[]) => {
    return foods.reduce((total, entry) => {
      const factor = entry.quantity / 100; // Cálculo baseado em 100g
      return {
        calories: total.calories + (entry.food.calories * factor),
        protein: total.protein + (entry.food.protein * factor),
        carbs: total.carbs + (entry.food.carbs * factor),
        fat: total.fat + (entry.food.fat * factor)
      };
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
  };

  // Banco de treinos prontos para seleção
  const presetWorkouts = [
    {
      id: 'preset_1',
      name: 'Push - Peito, Ombros e Tríceps',
      description: 'Treino focado em empurrar. Ideal para desenvolvimento do peito, ombros e tríceps.',
      duration: '45-60 min',
      difficulty: 'Intermediário',
      category: 'Push',
      icon: '💪',
      exercises: [
        { id: 'ex1', name: 'Supino Reto', sets: 4, reps: '8-10', weight: 80, muscle: 'Peito', category: 'Peito', completed: false, restTime: 90 },
        { id: 'ex2', name: 'Supino Inclinado', sets: 3, reps: '10-12', weight: 70, muscle: 'Peito', category: 'Peito', completed: false, restTime: 90 },
        { id: 'ex3', name: 'Desenvolvimento Militar', sets: 4, reps: '8-10', weight: 50, muscle: 'Ombros', category: 'Ombros', completed: false, restTime: 90 },
        { id: 'ex4', name: 'Elevação Lateral', sets: 3, reps: '12-15', weight: 15, muscle: 'Ombros', category: 'Ombros', completed: false, restTime: 60 },
        { id: 'ex5', name: 'Tríceps Testa', sets: 3, reps: '10-12', weight: 30, muscle: 'Tríceps', category: 'Braços', completed: false, restTime: 60 },
        { id: 'ex6', name: 'Tríceps Corda', sets: 3, reps: '12-15', weight: 25, muscle: 'Tríceps', category: 'Braços', completed: false, restTime: 60 }
      ]
    },
    {
      id: 'preset_2',
      name: 'Pull - Costas e Bíceps',
      description: 'Treino focado em puxar. Excelente para desenvolvimento das costas e bíceps.',
      duration: '45-60 min',
      difficulty: 'Intermediário',
      category: 'Pull',
      icon: '🎣',
      exercises: [
        { id: 'ex7', name: 'Puxada Alta', sets: 4, reps: '8-10', weight: 60, muscle: 'Costas', category: 'Costas', completed: false, restTime: 90 },
        { id: 'ex8', name: 'Remada Curvada', sets: 4, reps: '8-10', weight: 70, muscle: 'Costas', category: 'Costas', completed: false, restTime: 90 },
        { id: 'ex9', name: 'Puxada Triangular', sets: 3, reps: '10-12', weight: 55, muscle: 'Costas', category: 'Costas', completed: false, restTime: 90 },
        { id: 'ex10', name: 'Rosca Direta', sets: 3, reps: '10-12', weight: 25, muscle: 'Bíceps', category: 'Braços', completed: false, restTime: 60 },
        { id: 'ex11', name: 'Rosca Martelo', sets: 3, reps: '12-15', weight: 20, muscle: 'Bíceps', category: 'Braços', completed: false, restTime: 60 },
        { id: 'ex12', name: 'Rosca Concentrada', sets: 3, reps: '12-15', weight: 15, muscle: 'Bíceps', category: 'Braços', completed: false, restTime: 60 }
      ]
    },
    {
      id: 'preset_3',
      name: 'Legs - Pernas Completo',
      description: 'Treino completo de pernas. Trabalha quadríceps, glúteos, posterior e panturrilhas.',
      duration: '60-75 min',
      difficulty: 'Avançado',
      category: 'Legs',
      icon: '🦵',
      exercises: [
        { id: 'ex13', name: 'Agachamento Livre', sets: 4, reps: '8-10', weight: 80, muscle: 'Pernas', category: 'Pernas', completed: false, restTime: 120 },
        { id: 'ex14', name: 'Leg Press', sets: 4, reps: '12-15', weight: 150, muscle: 'Pernas', category: 'Pernas', completed: false, restTime: 90 },
        { id: 'ex15', name: 'Stiff', sets: 3, reps: '10-12', weight: 60, muscle: 'Pernas', category: 'Pernas', completed: false, restTime: 90 },
        { id: 'ex16', name: 'Cadeira Extensora', sets: 3, reps: '12-15', weight: 50, muscle: 'Pernas', category: 'Pernas', completed: false, restTime: 60 },
        { id: 'ex17', name: 'Mesa Flexora', sets: 3, reps: '12-15', weight: 40, muscle: 'Pernas', category: 'Pernas', completed: false, restTime: 60 },
        { id: 'ex18', name: 'Panturrilha em Pé', sets: 4, reps: '15-20', weight: 60, muscle: 'Panturrilhas', category: 'Pernas', completed: false, restTime: 45 }
      ]
    },
    {
      id: 'preset_4',
      name: 'Upper Body - Corpo Superior',
      description: 'Treino completo de corpo superior. Combina peito, costas, ombros e braços.',
      duration: '60-75 min',
      difficulty: 'Intermediário',
      category: 'Upper',
      icon: '💪',
      exercises: [
        { id: 'ex19', name: 'Supino Reto', sets: 3, reps: '10-12', weight: 75, muscle: 'Peito', category: 'Peito', completed: false, restTime: 90 },
        { id: 'ex20', name: 'Puxada Alta', sets: 3, reps: '10-12', weight: 55, muscle: 'Costas', category: 'Costas', completed: false, restTime: 90 },
        { id: 'ex21', name: 'Desenvolvimento', sets: 3, reps: '10-12', weight: 45, muscle: 'Ombros', category: 'Ombros', completed: false, restTime: 90 },
        { id: 'ex22', name: 'Remada Sentada', sets: 3, reps: '10-12', weight: 50, muscle: 'Costas', category: 'Costas', completed: false, restTime: 90 },
        { id: 'ex23', name: 'Rosca Direta', sets: 3, reps: '12-15', weight: 20, muscle: 'Bíceps', category: 'Braços', completed: false, restTime: 60 },
        { id: 'ex24', name: 'Tríceps Pulley', sets: 3, reps: '12-15', weight: 30, muscle: 'Tríceps', category: 'Braços', completed: false, restTime: 60 }
      ]
    },
    {
      id: 'preset_5',
      name: 'Full Body - Corpo Inteiro',
      description: 'Treino de corpo inteiro. Perfeito para iniciantes ou para dias com pouco tempo.',
      duration: '45-60 min',
      difficulty: 'Iniciante',
      category: 'Full Body',
      icon: '🏋️',
      exercises: [
        { id: 'ex25', name: 'Agachamento', sets: 3, reps: '12-15', weight: 50, muscle: 'Pernas', category: 'Pernas', completed: false, restTime: 90 },
        { id: 'ex26', name: 'Supino Inclinado', sets: 3, reps: '10-12', weight: 60, muscle: 'Peito', category: 'Peito', completed: false, restTime: 90 },
        { id: 'ex27', name: 'Remada Curvada', sets: 3, reps: '10-12', weight: 50, muscle: 'Costas', category: 'Costas', completed: false, restTime: 90 },
        { id: 'ex28', name: 'Desenvolvimento', sets: 3, reps: '10-12', weight: 35, muscle: 'Ombros', category: 'Ombros', completed: false, restTime: 90 },
        { id: 'ex29', name: 'Prancha', sets: 3, reps: '30-45s', weight: 0, muscle: 'Core', category: 'Core', completed: false, restTime: 60 }
      ]
    },
    {
      id: 'preset_6',
      name: 'HIIT Cardio',
      description: 'Treino intervalado de alta intensidade. Queima calórica e melhora condicionamento.',
      duration: '20-30 min',
      difficulty: 'Avançado',
      category: 'Cardio',
      icon: '🔥',
      exercises: [
        { id: 'ex30', name: 'Burpees', sets: 4, reps: '30s', weight: 0, muscle: 'Full Body', category: 'Cardio', completed: false, restTime: 30 },
        { id: 'ex31', name: 'Mountain Climbers', sets: 4, reps: '30s', weight: 0, muscle: 'Core', category: 'Cardio', completed: false, restTime: 30 },
        { id: 'ex32', name: 'Jump Squats', sets: 4, reps: '30s', weight: 0, muscle: 'Pernas', category: 'Cardio', completed: false, restTime: 30 },
        { id: 'ex33', name: 'High Knees', sets: 4, reps: '30s', weight: 0, muscle: 'Cardio', category: 'Cardio', completed: false, restTime: 30 },
        { id: 'ex34', name: 'Plank Jacks', sets: 4, reps: '30s', weight: 0, muscle: 'Core', category: 'Cardio', completed: false, restTime: 30 }
      ]
    }
  ];

  // Banco de exercícios disponíveis para criar treinos
  const exerciseLibrary: Exercise[] = [
    {
      id: 'ex1', name: 'Supino Reto', sets: 4, reps: '10', muscle: 'Peito',
      videoUrl: 'https://www.youtube.com/watch?v=4T9UQ4FBVXI',
      instructions: ['Deite-se no banco', 'Segure a barra', 'Desça controladamente', 'Empurre com força'],
      musclesWorked: ['Peitoral maior', 'Tríceps', 'Deltóide anterior'],
      tips: ['Mantenha os pés firmes no chão', 'Não arqueie excessivamente as costas'],
      difficulty: 'Intermediário', equipment: ['Barra', 'Banco', 'Anilhas'],
      weight: 80, category: 'Peito', completed: false, restTime: 90
    },
    {
      id: 'ex2', name: 'Agachamento', sets: 4, reps: '12', muscle: 'Pernas',
      videoUrl: 'https://www.youtube.com/watch?v=Dy28eq2PjcM',
      instructions: ['Pés na largura dos ombros', 'Desça flexionando joelhos', 'Mantenha o tronco ereto', 'Suba controladamente'],
      musclesWorked: ['Quadríceps', 'Glúteos', 'Isquiotibiais'],
      tips: ['Não deixe os joelhos ultrapassarem os pés', 'Mantenha o core ativo'],
      difficulty: 'Iniciante', equipment: ['Barra', 'Anilhas'],
      weight: 60, category: 'Pernas', completed: false, restTime: 60
    },
    {
      id: 'ex3', name: 'Puxada Alta', sets: 3, reps: '12', muscle: 'Costas',
      videoUrl: 'https://www.youtube.com/watch?v=CAwf7n6Luuc',
      instructions: ['Segure a barra', 'Puxe até o peito', 'Controle a subida', 'Mantenha postura'],
      musclesWorked: ['Latíssimo do dorso', 'Bíceps', 'Rombóides'],
      tips: ['Não balance o corpo', 'Foque na contração das costas'],
      difficulty: 'Intermediário', equipment: ['Polia alta', 'Barra'],
      weight: 50, category: 'Costas', completed: false, restTime: 60
    },
    {
      id: 'ex4', name: 'Desenvolvimento', sets: 3, reps: '10', muscle: 'Ombros',
      videoUrl: 'https://www.youtube.com/watch?v=qEwKCR5JCog',
      instructions: ['Posição sentado', 'Empurre os halteres', 'Controle a descida', 'Não arqueie as costas'],
      musclesWorked: ['Deltóide', 'Tríceps', 'Trapézio'],
      tips: ['Use banco com apoio', 'Mantenha o core contraído'],
      difficulty: 'Intermediário', equipment: ['Halteres', 'Banco'],
      weight: 25, category: 'Ombros', completed: false, restTime: 60
    },
    {
      id: 'ex5', name: 'Rosca Direta', sets: 3, reps: '12', muscle: 'Bíceps',
      videoUrl: 'https://www.youtube.com/watch?v=ykJmrZ5v0Oo',
      instructions: ['Braços estendidos', 'Flexione os cotovelos', 'Controle o movimento', 'Não balance'],
      musclesWorked: ['Bíceps braquial', 'Braquial anterior'],
      tips: ['Mantenha os cotovelos fixos', 'Controle excêntrico'],
      difficulty: 'Iniciante', equipment: ['Halteres'],
      weight: 15, category: 'Bíceps', completed: false, restTime: 45
    }
  ];

  // Funções para gerenciar treinos personalizados
  const resetCustomWorkoutModal = () => {
    setCustomWorkoutName('');
    setSelectedExercisesForWorkout([]);
    setSelectedDaysForWorkout(['segunda']); // Reset para segunda-feira como padrão
    setModalType('');
    setShowModal(false);
  };

  // Função para criar treino a partir de template
  const createWorkoutFromPreset = (preset: any) => {
    const newWorkout: WorkoutPlan = {
      id: Date.now().toString(),
      name: preset.name,
      weeklyExercises: {
        segunda: preset.exercises,
        terca: [],
        quarta: [],
        quinta: [],
        sexta: [],
        sabado: [],
        domingo: []
      }
    };

    const updatedPlans = [...workoutPlans, newWorkout];
    setWorkoutPlans(updatedPlans);
    saveData(STORAGE_KEYS.WORKOUT_PLANS, updatedPlans);
    
    setShowPresetWorkouts(false);
    setSelectedPresetWorkout(null);
    
    alert(`Treino "${preset.name}" criado com sucesso!`);
  };

  const createCustomWorkout = async () => {
    console.log('Tentando criar treino:', customWorkoutName, selectedExercisesForWorkout.length);
    
    if (!customWorkoutName.trim()) {
      alert('Por favor, digite um nome para o treino.');
      return;
    }
    
    if (selectedExercisesForWorkout.length === 0) {
      alert('Por favor, adicione pelo menos um exercício ao treino.');
      return;
    }

    if (selectedDaysForWorkout.length === 0) {
      alert('Por favor, selecione pelo menos um dia da semana.');
      return;
    }
    
    // Criar weeklyExercises baseado nos dias selecionados
    const weeklyExercises: Record<DayOfWeek, Exercise[]> = {
      segunda: [],
      terca: [],
      quarta: [],
      quinta: [],
      sexta: [],
      sabado: [],
      domingo: []
    };

    // Adicionar exercícios apenas nos dias selecionados
    selectedDaysForWorkout.forEach(day => {
      weeklyExercises[day] = [...selectedExercisesForWorkout];
    });
    
    const newWorkout: WorkoutPlan = {
      id: Date.now().toString(),
      name: customWorkoutName.trim(),
      weeklyExercises
    };
    
    // Atualizar estado local
    const updatedPlans = [...workoutPlans, newWorkout];
    setWorkoutPlans(updatedPlans);
    
    // Salvar no Firebase
    try {
      await saveDataToFirebase('workoutPlans', newWorkout.id, newWorkout);
      console.log('✅ Novo treino salvo no Firebase:', newWorkout.name);
    } catch (error) {
      console.error('❌ Erro ao salvar novo treino no Firebase:', error);
      // Fallback para AsyncStorage
      saveData(STORAGE_KEYS.WORKOUT_PLANS, updatedPlans);
    }
    
    alert(`Treino "${newWorkout.name}" criado com sucesso! Agora você tem ${workoutPlans.length + 1} treinos.`);
    resetCustomWorkoutModal();
  };

  const addExerciseToWorkout = (exercise: Exercise) => {
    const exerciseWithId = {
      ...exercise,
      id: `${exercise.id}_${Date.now()}`, // ID único para evitar conflitos
      sets: 3,
      reps: '10',
      weight: exercise.weight || 0
    };
    setSelectedExercisesForWorkout([...selectedExercisesForWorkout, exerciseWithId]);
  };

  const removeExerciseFromWorkout = (exerciseId: string) => {
    setSelectedExercisesForWorkout(selectedExercisesForWorkout.filter(ex => ex.id !== exerciseId));
  };

  const updateExerciseInWorkout = (exerciseId: string, field: keyof Exercise, value: any) => {
    setSelectedExercisesForWorkout(selectedExercisesForWorkout.map(ex => 
      ex.id === exerciseId ? { ...ex, [field]: value } : ex
    ));
  };

  // Função para alternar seleção de dias da semana
  const toggleDaySelection = (day: DayOfWeek) => {
    setSelectedDaysForWorkout(prev => {
      if (prev.includes(day)) {
        // Se só há um dia selecionado, não permite desmarcar
        if (prev.length === 1) {
          return prev;
        }
        return prev.filter(d => d !== day);
      } else {
        return [...prev, day];
      }
    });
  };

  // Função para alternar seleção de dias na edição de treino
  const toggleDaySelectionForEdit = (day: DayOfWeek) => {
    setSelectedDaysForEdit(prev => {
      if (prev.includes(day)) {
        // Se só há um dia selecionado, não permite desmarcar
        if (prev.length === 1) {
          return prev;
        }
        return prev.filter(d => d !== day);
      } else {
        return [...prev, day];
      }
    });
  };

  // Funções para adicionar exercícios existentes ao treino
  const getFilteredExercises = () => {
    try {
      if (!EXERCISE_DATABASE || !Array.isArray(EXERCISE_DATABASE)) {
        return [];
      }
      return EXERCISE_DATABASE.filter(exercise => {
        const matchesSearch = exercise?.name?.toLowerCase()?.includes(exerciseSearchTerm?.toLowerCase() || '') ||
                             exercise?.muscle?.toLowerCase()?.includes(exerciseSearchTerm?.toLowerCase() || '');
        const matchesMuscle = selectedMuscleFilter === 'Todos' || exercise?.muscle === selectedMuscleFilter;
        return matchesSearch && matchesMuscle;
      }) || [];
    } catch (error) {
      console.error('Erro ao filtrar exercícios:', error);
      return [];
    }
  };

  const getMuscleGroups = () => {
    try {
      if (!EXERCISE_DATABASE || !Array.isArray(EXERCISE_DATABASE)) {
        return ['Todos'];
      }
      const muscles = ['Todos', ...new Set(EXERCISE_DATABASE.map(ex => ex?.muscle || 'Sem categoria').filter(Boolean))];
      return muscles || ['Todos'];
    } catch (error) {
      console.error('Erro ao obter grupos musculares:', error);
      return ['Todos'];
    }
  };

  const addExerciseToCurrentWorkout = () => {
    if (!selectedExerciseToAdd || !editingWorkout) return;

    const newExercise: Exercise = {
      ...selectedExerciseToAdd,
      id: `${selectedExerciseToAdd.id}_${Date.now()}`,
      sets: parseInt(newExerciseSets) || 3,
      reps: newExerciseReps || '10',
      weight: parseFloat(newExerciseWeight) || 0
    };

    // Adicionar exercício a todos os dias selecionados
    const updatedWeeklyExercises = { ...editingWorkout.weeklyExercises };
    
    selectedDaysForEdit.forEach(day => {
      const currentDayExercises = updatedWeeklyExercises[day] || [];
      updatedWeeklyExercises[day] = [...currentDayExercises, { 
        ...newExercise,
        id: `${selectedExerciseToAdd.id}_${Date.now()}_${day}` // ID único por dia
      }];
    });
    
    const updatedWorkout = {
      ...editingWorkout,
      weeklyExercises: updatedWeeklyExercises
    };

    setEditingWorkout(updatedWorkout);
    
    // Reset form
    setSelectedExerciseToAdd(null);
    setNewExerciseSets('3');
    setNewExerciseReps('10');
    setNewExerciseWeight('');
    setShowAddExerciseModal(false);
  };

  const resetAddExerciseModal = () => {
    setSelectedExerciseToAdd(null);
    setNewExerciseSets('3');
    setNewExerciseReps('10');
    setNewExerciseWeight('');
    setExerciseSearchTerm('');
    setSelectedMuscleFilter('Todos');
    setShowAddExerciseModal(false);
  };

  // Funções para gerenciar nova dieta
  
  // Sugestões inteligentes baseadas no tipo de alimento
  const getSmartSuggestions = (foodName: string) => {
    const name = foodName.toLowerCase();
    
    // Definir conversões comuns
    const conversions = {
      // Ovos
      'ovo': [
        { label: '1 unidade', quantity: '50' },
        { label: '2 unidades', quantity: '100' },
        { label: '3 unidades', quantity: '150' }
      ],
      // Pães
      'pão': [
        { label: '1 fatia', quantity: '25' },
        { label: '2 fatias', quantity: '50' },
        { label: '3 fatias', quantity: '75' }
      ],
      // Arroz
      'arroz': [
        { label: '1 colher sopa', quantity: '25' },
        { label: '1 xícara', quantity: '150' },
        { label: '1 prato', quantity: '100' }
      ],
      // Feijão
      'feijão': [
        { label: '1 concha', quantity: '80' },
        { label: '1 xícara', quantity: '120' },
        { label: '1/2 xícara', quantity: '60' }
      ],
      // Banana
      'banana': [
        { label: '1 pequena', quantity: '80' },
        { label: '1 média', quantity: '120' },
        { label: '1 grande', quantity: '150' }
      ],
      // Maçã
      'maçã': [
        { label: '1 pequena', quantity: '100' },
        { label: '1 média', quantity: '150' },
        { label: '1 grande', quantity: '200' }
      ],
      // Leite
      'leite': [
        { label: '1 copo (200ml)', quantity: '200' },
        { label: '1 xícara', quantity: '250' },
        { label: '1/2 copo', quantity: '100' }
      ]
    };
    
    // Procurar por coincidências no nome do alimento
    for (const [key, suggestions] of Object.entries(conversions)) {
      if (name.includes(key)) {
        return suggestions;
      }
    }
    
    // Retornar sugestões padrão se não encontrar conversões específicas
    return [
      { label: '50g', quantity: '50' },
      { label: '100g', quantity: '100' },
      { label: '150g', quantity: '150' },
      { label: '200g', quantity: '200' }
    ];
  };

  // Funções para seleção múltipla de alimentos
  const toggleMultiSelectMode = () => {
    setIsMultiSelectMode(!isMultiSelectMode);
    setSelectedFoodsForMeal([]);
    setSelectedFoodForMeal(null);
  };

  const toggleFoodSelection = (food: Food) => {
    if (isMultiSelectMode) {
      setSelectedFoodsForMeal(prev => {
        const isSelected = prev.find(f => f.id === food.id);
        if (isSelected) {
          return prev.filter(f => f.id !== food.id);
        } else {
          return [...prev, food];
        }
      });
    } else {
      setSelectedFoodForMeal(food);
    }
  };

  const addMultipleFoodsToMeal = () => {
    if (selectedFoodsForMeal.length === 0) {
      alert('Selecione pelo menos um alimento');
      return;
    }

    const baseQuantity = parseFloat(foodQuantityForDiet);
    const multiplier = parseFloat(foodMultiplier);
    
    if (isNaN(baseQuantity) || baseQuantity <= 0) {
      alert('Digite uma quantidade válida');
      return;
    }
    
    if (isNaN(multiplier) || multiplier <= 0) {
      alert('Digite um multiplicador válido');
      return;
    }

    const totalQuantity = baseQuantity * multiplier;

    const newFoodEntries: FoodEntry[] = selectedFoodsForMeal.map(food => ({
      food: food,
      quantity: totalQuantity,
      baseQuantity: baseQuantity,
      multiplier: multiplier
    }));

    setCurrentMeal(prev => ({
      ...prev,
      foods: [...prev.foods, ...newFoodEntries]
    }));
    
    setSelectedFoodsForMeal([]);
    setIsMultiSelectMode(false);
    setFoodQuantityForDiet('100');
    setFoodMultiplier('1');
    alert(`${newFoodEntries.length} alimentos adicionados à refeição!`);
  };

  const resetNewDietModal = () => {
    setNewDietName('');
    setNewDietMeals([]);
    setCurrentMeal({ name: '', time: '', foods: [] });
    setSelectedFoodForMeal(null);
    setSelectedFoodsForMeal([]);
    setIsMultiSelectMode(false);
    setFoodQuantityForDiet('100');
    setFoodMultiplier('1');
    setShowDietNameModal(false);
    setDietStep(1);
    setFoodSearchTerm('');
    setSelectedFoodCategory('Todos');
    setShowTemplates(false);
  };

  // Filtrar alimentos por busca e categoria
  const getFilteredFoods = () => {
    return availableFoods.filter(food => {
      const matchesSearch = food.name.toLowerCase().includes(foodSearchTerm.toLowerCase());
      const matchesCategory = selectedFoodCategory === 'Todos' || food.category === selectedFoodCategory;
      return matchesSearch && matchesCategory;
    });
  };

  // Obter categorias únicas
  const getFoodCategories = () => {
    const categories = [...new Set(availableFoods.map(food => food.category))];
    return ['Todos', ...categories];
  };

  // Salvar refeição como template
  const saveAsTemplate = () => {
    if (currentMeal.name && currentMeal.foods.length > 0) {
      const template: Meal = {
        id: Date.now(),
        name: `Template: ${currentMeal.name}`,
        time: currentMeal.time || '',
        foods: currentMeal.foods,
        completed: false,
        timestamp: new Date()
      };
      setMealTemplates([...mealTemplates, template]);
      Alert.alert('Sucesso', 'Refeição salva como template!');
    }
  };

  // Aplicar template
  const applyTemplate = (template: Meal) => {
    setCurrentMeal({
      name: template.name.replace('Template: ', ''),
      time: template.time || '',
      foods: [...template.foods]
    });
    setShowTemplates(false);
  };

  const addFoodToCurrentMeal = () => {
    if (!selectedFoodForMeal || !foodQuantityForDiet) {
      alert('Selecione um alimento e informe a quantidade');
      return;
    }

    const baseQuantity = parseFloat(foodQuantityForDiet);
    const multiplier = parseFloat(foodMultiplier);
    
    if (isNaN(baseQuantity) || baseQuantity <= 0) {
      alert('Digite uma quantidade válida');
      return;
    }
    
    if (isNaN(multiplier) || multiplier <= 0) {
      alert('Digite um multiplicador válido');
      return;
    }

    const totalQuantity = baseQuantity * multiplier;

    const newFoodEntry: FoodEntry = {
      food: selectedFoodForMeal,
      quantity: totalQuantity,
      baseQuantity: baseQuantity,
      multiplier: multiplier
    };

    setCurrentMeal(prev => ({
      ...prev,
      foods: [...prev.foods, newFoodEntry]
    }));
    
    setSelectedFoodForMeal(null);
    setFoodQuantityForDiet('100');
    setFoodMultiplier('1');
  };

  const removeFoodFromCurrentMeal = (index: number) => {
    setCurrentMeal(prev => ({
      ...prev,
      foods: prev.foods.filter((_, i) => i !== index)
    }));
  };

  const addMealToDiet = () => {
    if (!currentMeal.name.trim()) {
      alert('Preencha o nome da refeição');
      return;
    }

    if (currentMeal.foods.length === 0) {
      alert('Adicione pelo menos um alimento à refeição');
      return;
    }

    const newMeal: Meal = {
      id: Date.now(),
      name: currentMeal.name.trim(),
      time: currentMeal.time.trim() || '00:00',
      foods: currentMeal.foods,
      timestamp: new Date(),
      completed: false
    };

    setNewDietMeals(prev => [...prev, newMeal]);
    setCurrentMeal({ name: '', time: '', foods: [] });
    alert(`Refeição "${newMeal.name}" adicionada à dieta!`);
  };

  const removeMealFromDiet = (mealId: number) => {
    setNewDietMeals(prev => prev.filter(meal => meal.id !== mealId));
  };

  const createNewDiet = () => {
    if (!newDietName.trim()) {
      alert('Digite um nome para a dieta');
      return;
    }

    if (currentMeal.foods.length === 0) {
      alert('Adicione pelo menos um alimento à dieta');
      return;
    }

    // Criar uma dieta simples
    const totalCalories = currentMeal.foods.reduce((total, foodEntry) => 
      total + (foodEntry.food.calories * foodEntry.quantity / 100), 0
    );

    const newDiet: DietPlan = {
      id: Date.now().toString(),
      name: newDietName.trim(),
      weeklyMeals: {
        segunda: [],
        terca: [],
        quarta: [],
        quinta: [],
        sexta: [],
        sabado: [],
        domingo: []
      },
      totalCalories
    };

    setDietPlans(prev => [...prev, newDiet]);
    alert(`Dieta "${newDiet.name}" criada com sucesso!`);
    resetNewDietModal();
  };

  const createSimpleDiet = () => {
    setShowDietNameModal(true);
  };

  const confirmCreateDiet = async () => {
    if (!newDietName.trim()) {
      alert('Digite um nome para a dieta');
      return;
    }

    if (newDietMeals.length === 0) {
      alert('Adicione pelo menos uma refeição à dieta');
      return;
    }
    
    const totalCalories = newDietMeals.reduce((total, meal) => 
      total + (meal.foods ? 
        meal.foods.reduce((mealTotal, foodEntry) => 
          mealTotal + (foodEntry.food.calories * foodEntry.quantity / 100), 0
        ) : 0
      ), 0
    );
    
    const newDiet: DietPlan = {
      id: Date.now().toString(),
      name: newDietName.trim(),
      weeklyMeals: {
        segunda: newDietMeals,
        terca: [],
        quarta: [],
        quinta: [],
        sexta: [],
        sabado: [],
        domingo: []
      },
      totalCalories
    };
    
    // Atualizar estado local
    setDietPlans(prev => [...prev, newDiet]);
    
    // Salvar no Firebase
    try {
      await saveDataToFirebase('dietPlans', newDiet.id, newDiet);
      console.log('✅ Dieta salva no Firebase:', newDiet.name);
      alert(`Dieta "${newDietName}" criada com sucesso! Total: ${totalCalories.toFixed(0)} kcal`);
    } catch (error) {
      console.error('❌ Erro ao salvar dieta no Firebase:', error);
      // Fallback para AsyncStorage
      const updatedDiets = [...dietPlans, newDiet];
      saveData(STORAGE_KEYS.DIET_PLANS, updatedDiets);
      alert(`Dieta "${newDietName}" criada com sucesso! Total: ${totalCalories.toFixed(0)} kcal (salva localmente)`);
    }
    
    // Reset states
    setNewDietName('');
    setNewDietMeals([]);
    setCurrentMeal({ name: '', time: '', foods: [] });
    setSelectedFoodForMeal(null);
    setSelectedFoodsForMeal([]);
    setIsMultiSelectMode(false);
    setFoodQuantityForDiet('100');
    setFoodMultiplier('1');
    setShowDietNameModal(false);
  };

  // Função para gerar dicas personalizadas baseadas no perfil
  const generatePersonalizedTips = (userStats: UserStats): HealthTip[] => {
    const tips: HealthTip[] = [];
    const now = new Date().toISOString();

    // Dicas baseadas no IMC
    if (userStats.weight && userStats.height) {
      const height_m = userStats.height / 100;
      const bmi = userStats.weight / (height_m * height_m);
      
      if (bmi < 18.5) {
        tips.push({
          id: `tip-underweight-${Date.now()}`,
          title: 'Ganho de peso saudável',
          content: 'Seu IMC indica baixo peso. Foque em alimentos ricos em calorias saudáveis: nuts, abacate, azeite extra virgem e proteínas magras.',
          category: 'nutrition',
          icon: '⬆️',
          isRead: false,
          createdAt: now
        });
      } else if (bmi > 25) {
        tips.push({
          id: `tip-overweight-${Date.now()}`,
          title: 'Déficit calórico controlado',
          content: 'Para perda de peso saudável, crie um déficit de 300-500 calorias por dia através de dieta e exercícios.',
          category: 'nutrition',
          icon: '⬇️',
          isRead: false,
          createdAt: now
        });
      }
    }

    // Dicas baseadas na idade
    if (userStats.age) {
      if (userStats.age > 40) {
        tips.push({
          id: `tip-age40-${Date.now()}`,
          title: 'Treino de força após 40',
          content: 'Após os 40, inclua treinos de força 2-3x por semana para manter massa muscular e densidade óssea.',
          category: 'workout',
          icon: '💪',
          isRead: false,
          createdAt: now
        });
      }
      
      if (userStats.age > 50) {
        tips.push({
          id: `tip-age50-${Date.now()}`,
          title: 'Flexibilidade e mobilidade',
          content: 'Inclua exercícios de flexibilidade e mobilidade diariamente para manter amplitude de movimento e prevenir dores.',
          category: 'wellness',
          icon: '🧘‍♂️',
          isRead: false,
          createdAt: now
        });
      }
    }

    // Dicas baseadas no nível de atividade
    if (userStats.activityLevel) {
      if (userStats.activityLevel === 'sedentary') {
        tips.push({
          id: `tip-sedentary-${Date.now()}`,
          title: 'Comece devagar',
          content: 'Para quem é sedentário, comece com 15-20 minutos de caminhada 3x por semana e aumente gradualmente.',
          category: 'workout',
          icon: '🚶‍♂️',
          isRead: false,
          createdAt: now
        });
      } else if (userStats.activityLevel === 'active') {
        tips.push({
          id: `tip-very-active-${Date.now()}`,
          title: 'Recuperação ativa',
          content: 'Para quem treina intensamente, inclua dias de recuperação ativa com yoga, natação leve ou caminhada.',
          category: 'wellness',
          icon: '🔄',
          isRead: false,
          createdAt: now
        });
      }
    }

    // Dicas baseadas no objetivo
    if (userStats.fitnessGoal) {
      if (userStats.fitnessGoal === 'weight_loss') {
        tips.push({
          id: `tip-weight-loss-${Date.now()}`,
          title: 'Cardio para queima de gordura',
          content: 'Para perda de peso, combine cardio moderado (30-45 min) com treino de força. O HIIT também é muito eficaz.',
          category: 'workout',
          icon: '🔥',
          isRead: false,
          createdAt: now
        });
      } else if (userStats.fitnessGoal === 'muscle_gain') {
        tips.push({
          id: `tip-muscle-gain-${Date.now()}`,
          title: 'Superávit calórico para ganho muscular',
          content: 'Para ganhar músculo, mantenha um superávit de 200-500 calorias e consuma 1,6-2,2g de proteína por kg de peso.',
          category: 'nutrition',
          icon: '💪',
          isRead: false,
          createdAt: now
        });
      }
    }

    return tips;
  };

  // Função para adicionar novas dicas periodicamente
  const addNewHealthTips = async () => {
    try {
      // Gerar dicas personalizadas baseadas no perfil atual
      const personalizedTips = generatePersonalizedTips(userStats);
      
      // Adicionar apenas dicas que ainda não existem
      const currentTipIds = healthTips.map(tip => tip.id);
      const newTips = personalizedTips.filter(tip => !currentTipIds.includes(tip.id));
      
      if (newTips.length > 0) {
        const updatedTips = [...healthTips, ...newTips];
        setHealthTips(updatedTips);
        
        // Salvar no AsyncStorage
        await AsyncStorage.setItem('healthTips', JSON.stringify(updatedTips));
        
        console.log(`✅ ${newTips.length} novas dicas de saúde adicionadas`);
      }
    } catch (error) {
      console.error('❌ Erro ao adicionar novas dicas:', error);
    }
  };

  useEffect(() => {
    // Initialize default workout plans
    const defaultWorkouts: WorkoutPlan[] = [
      {
        id: '1',
        name: 'Treino Peito e Tríceps',
        weeklyExercises: {
          segunda: [
          { 
            id: '1', 
            name: 'Supino Reto', 
            sets: 4, 
            reps: '10', 
            weight: 80, 
            muscle: 'Peito',
            category: 'Peito', 
            completed: false, 
            restTime: 90,
            videoUrl: 'https://www.youtube.com/watch?v=4T9UQ4FBVXI',
            instructions: [
              'Deite-se no banco com os pés firmes no chão',
              'Segure a barra com pegada ligeiramente mais larga que os ombros',
              'Retire a barra do suporte mantendo os braços estendidos',
              'Desça a barra controladamente até tocar o peito',
              'Empurre a barra de volta à posição inicial'
            ],
            musclesWorked: ['Peitoral Maior', 'Tríceps', 'Deltoides Anterior'],
            tips: [
              'Mantenha as escápulas retraídas durante todo o movimento',
              'Não arqueie excessivamente as costas',
              'Controle a descida, não deixe a barra "cair" no peito'
            ],
            difficulty: 'Intermediário',
            equipment: ['Barra', 'Banco', 'Anilhas']
          },
          { 
            id: '2', 
            name: 'Supino Inclinado', 
            sets: 3, 
            reps: '12', 
            weight: 70, 
            muscle: 'Peito',
            category: 'Peito', 
            completed: false, 
            restTime: 90,
            videoUrl: 'https://www.youtube.com/watch?v=IP9-bs_R4n8',
            instructions: [
              'Ajuste o banco para inclinação de 30-45 graus',
              'Posicione-se com os pés firmes no chão',
              'Segure a barra com pegada similar ao supino reto',
              'Desça a barra até a parte superior do peito',
              'Empurre a barra de volta controladamente'
            ],
            musclesWorked: ['Peitoral Superior', 'Deltoides Anterior', 'Tríceps'],
            tips: [
              'Foque no peitoral superior durante o movimento',
              'Não use inclinação muito acentuada (máx 45°)',
              'Mantenha o core contraído'
            ],
            difficulty: 'Intermediário',
            equipment: ['Barra', 'Banco Inclinável', 'Anilhas']
          },
          { 
            id: '3', 
            name: 'Tríceps Pulley', 
            sets: 3, 
            reps: '15',
            muscle: 'Tríceps',
            weight: 30, 
            category: 'Tríceps', 
            completed: false, 
            restTime: 60,
            videoUrl: 'https://www.youtube.com/watch?v=vB5OHsJ3EME',
            instructions: [
              'Fique em pé de frente para o cabo',
              'Segure a barra com pegada pronada',
              'Mantenha os cotovelos próximos ao corpo',
              'Estenda os braços completamente para baixo',
              'Retorne controladamente à posição inicial'
            ],
            musclesWorked: ['Tríceps Braquial', 'Ancôneo'],
            tips: [
              'Não balance o corpo durante o movimento',
              'Foque na contração do tríceps na parte inferior',
              'Mantenha os cotovelos fixos'
            ],
            difficulty: 'Iniciante',
            equipment: ['Cabo', 'Barra Reta']
          },
          { 
            id: '4', 
            name: 'Mergulho', 
            sets: 3, 
            reps: '12',
            muscle: 'Tríceps',
            weight: 0, 
            category: 'Tríceps', 
            completed: false, 
            restTime: 60,
            videoUrl: 'https://www.youtube.com/watch?v=2z8JmcrW-As',
            instructions: [
              'Posicione as mãos nas barras paralelas',
              'Suspenda o corpo com os braços estendidos',
              'Desça o corpo flexionando os cotovelos',
              'Desça até sentir alongamento no peito',
              'Empurre o corpo de volta à posição inicial'
            ],
            musclesWorked: ['Tríceps', 'Peitoral Inferior', 'Deltoides Anterior'],
            tips: [
              'Mantenha o corpo ligeiramente inclinado para frente',
              'Não desça além do confortável para os ombros',
              'Use assistência se necessário'
            ],
            difficulty: 'Avançado',
            equipment: ['Barras Paralelas']
          }
          ],
          terca: [],
          quarta: [],
          quinta: [],
          sexta: [],
          sabado: [],
          domingo: []
        }
      },
      {
        id: '2',
        name: 'Treino Costas e Bíceps',
        weeklyExercises: {
          segunda: [],
          terca: [
          { 
            id: '5', 
            name: 'Puxada Frontal', 
            sets: 4, 
            reps: '10', 
            weight: 60, 
            muscle: 'Costas',
            category: 'Costas', 
            completed: false, 
            restTime: 90,
            videoUrl: 'https://www.youtube.com/watch?v=CAwf7n6Luuc',
            instructions: [
              'Sente-se no equipamento com as coxas fixas',
              'Segure a barra com pegada larga',
              'Puxe a barra em direção ao peito',
              'Contraia as escápulas no final do movimento',
              'Retorne controladamente à posição inicial'
            ],
            musclesWorked: ['Latissímo do Dorso', 'Romboides', 'Bíceps'],
            tips: [
              'Foque em puxar com os cotovelos, não com as mãos',
              'Evite balançar o tronco',
              'Contraia bem as escápulas na posição final'
            ],
            difficulty: 'Intermediário',
            equipment: ['Polia Alta', 'Barra Larga']
          },
          { 
            id: '6', 
            name: 'Remada Curvada', 
            sets: 4, 
            reps: '12', 
            weight: 50, 
            muscle: 'Costas',
            category: 'Costas', 
            completed: false, 
            restTime: 90,
            videoUrl: 'https://www.youtube.com/watch?v=FWJR5Ve8bnQ',
            instructions: [
              'Fique em pé com os pés na largura dos ombros',
              'Curve o tronco mantendo as costas retas',
              'Segure a barra com pegada pronada',
              'Puxe a barra em direção ao abdômen',
              'Retorne controladamente'
            ],
            musclesWorked: ['Latissímo do Dorso', 'Romboides', 'Trapézio Médio'],
            tips: [
              'Mantenha o core contraído',
              'Não arredonde as costas',
              'Foque em apertar as escápulas'
            ],
            difficulty: 'Avançado',
            equipment: ['Barra', 'Anilhas']
          },
          { 
            id: '7', 
            name: 'Rosca Direta', 
            sets: 3, 
            reps: '12', 
            weight: 20, 
            muscle: 'Bíceps',
            category: 'Bíceps', 
            completed: false, 
            restTime: 60,
            videoUrl: 'https://www.youtube.com/watch?v=ykJmrZ5v0Oo',
            instructions: [
              'Fique em pé com os pés na largura dos ombros',
              'Segure a barra com pegada supinada',
              'Mantenha os cotovelos próximos ao corpo',
              'Flexione os braços elevando a barra',
              'Descer controladamente'
            ],
            musclesWorked: ['Bíceps Braquial', 'Braquial Anterior'],
            tips: [
              'Não balance o corpo',
              'Mantenha os cotovelos fixos',
              'Contraia bem o bíceps no topo'
            ],
            difficulty: 'Iniciante',
            equipment: ['Barra', 'Anilhas']
          },
          { 
            id: '8', 
            name: 'Rosca Martelo', 
            sets: 3, 
            reps: '15', 
            weight: 15, 
            muscle: 'Bíceps',
            category: 'Bíceps', 
            completed: false, 
            restTime: 60,
            videoUrl: 'https://www.youtube.com/watch?v=zC3nLlEvin4',
            instructions: [
              'Fique em pé segurando halteres',
              'Mantenha as palmas voltadas uma para a outra',
              'Flexione um braço de cada vez',
              'Mantenha o punho neutro durante todo movimento',
              'Alterne os braços ou faça simultâneo'
            ],
            musclesWorked: ['Bíceps Braquial', 'Braquiorradial', 'Braquial Anterior'],
            tips: [
              'Mantenha o cotovelo estável',
              'Não gire o punho durante o movimento',
              'Controle bem a descida'
            ],
            difficulty: 'Iniciante',
            equipment: ['Halteres']
          }
          ],
          quarta: [],
          quinta: [],
          sexta: [],
          sabado: [],
          domingo: []
        }
      }
    ];

    // Default diet plans (simplified)
    const defaultDiets: DietPlan[] = [
      {
        id: '1',
        name: 'Dieta Ganho de Massa',
        totalCalories: 3200,
        weeklyMeals: {
          segunda: [
            {
              id: 1,
              name: 'Café da Manhã',
              time: '07:00',
              foods: [
                { food: { id: 1, name: 'Aveia', calories: 375, protein: 13, carbs: 69, fat: 7, category: 'Cereais' }, quantity: 80 },
                { food: { id: 2, name: 'Banana', calories: 89, protein: 1, carbs: 23, fat: 0.3, category: 'Frutas' }, quantity: 100 }
              ],
              timestamp: new Date(),
              completed: false
            },
            {
              id: 2,
              name: 'Almoço', 
              time: '12:30',
              foods: [
                { food: { id: 3, name: 'Peito de Frango', calories: 175, protein: 33, carbs: 0, fat: 4, category: 'Carnes' }, quantity: 250 },
                { food: { id: 4, name: 'Arroz Integral', calories: 110, protein: 3, carbs: 23, fat: 1, category: 'Cereais' }, quantity: 150 }
              ],
              timestamp: new Date(),
              completed: false
            },
            {
              id: 3,
              name: 'Jantar',
              time: '19:00',
              foods: [
                { food: { id: 5, name: 'Salmão', calories: 208, protein: 25, carbs: 0, fat: 12, category: 'Peixes' }, quantity: 180 }
              ],
              timestamp: new Date(),
              completed: false
            }
          ],
          terca: [
            {
              id: 11,
              name: 'Café da Manhã',
              time: '07:00',
              foods: [
                { food: { id: 6, name: 'Ovos', calories: 155, protein: 13, carbs: 1.1, fat: 11, category: 'Proteínas' }, quantity: 120 }
              ],
              timestamp: new Date(),
              completed: false
            },
            {
              id: 12,
              name: 'Almoço',
              time: '12:30',
              foods: [
                { food: { id: 3, name: 'Peito de Frango', calories: 175, protein: 33, carbs: 0, fat: 4, category: 'Carnes' }, quantity: 200 }
              ],
              timestamp: new Date(),
              completed: false
            }
          ],
          quarta: [
            {
              id: 21,
              name: 'Café da Manhã',
              time: '07:00',
              foods: [
                { food: { id: 1, name: 'Aveia', calories: 375, protein: 13, carbs: 69, fat: 7, category: 'Cereais' }, quantity: 80 }
              ],
              timestamp: new Date(),
              completed: false
            }
          ],
          quinta: [
            {
              id: 31,
              name: 'Café da Manhã',
              time: '07:00',
              foods: [
                { food: { id: 7, name: 'Whey Protein', calories: 400, protein: 80, carbs: 10, fat: 4, category: 'Suplementos' }, quantity: 30 }
              ],
              timestamp: new Date(),
              completed: false
            }
          ],
          sexta: [
            {
              id: 41,
              name: 'Café da Manhã',
              time: '07:00',
              foods: [
                { food: { id: 2, name: 'Banana', calories: 89, protein: 1, carbs: 23, fat: 0.3, category: 'Frutas' }, quantity: 100 }
              ],
              timestamp: new Date(),
              completed: false
            }
          ],
          sabado: [
            {
              id: 51,
              name: 'Café da Manhã',
              time: '08:00',
              foods: [
                { food: { id: 8, name: 'Pão Integral', calories: 247, protein: 13, carbs: 41, fat: 4, category: 'Cereais' }, quantity: 60 }
              ],
              timestamp: new Date(),
              completed: false
            }
          ],
          domingo: [
            {
              id: 61,
              name: 'Café da Manhã',
              time: '09:00',
              foods: [
                { food: { id: 9, name: 'Iogurte', calories: 61, protein: 3.5, carbs: 4.7, fat: 3.3, category: 'Laticínios' }, quantity: 200 }
              ],
              timestamp: new Date(),
              completed: false
            }
          ]
        }
      },
      {
        id: '2',
        name: 'Dieta Definição',
        totalCalories: 2000,
        weeklyMeals: {
          segunda: [
            {
              id: 71,
              name: 'Café da Manhã',
              time: '07:00',
              foods: [
                { food: { id: 6, name: 'Ovos', calories: 155, protein: 13, carbs: 1.1, fat: 11, category: 'Proteínas' }, quantity: 100 }
              ],
              timestamp: new Date(),
              completed: false
            },
            {
              id: 72,
              name: 'Almoço',
              time: '12:30',
              foods: [
                { food: { id: 10, name: 'Frango Grelhado', calories: 165, protein: 31, carbs: 0, fat: 3.6, category: 'Carnes' }, quantity: 150 }
              ],
              timestamp: new Date(),
              completed: false
            }
          ],
          terca: [
            {
              id: 81,
              name: 'Café da Manhã',
              time: '07:00',
              foods: [
                { food: { id: 7, name: 'Whey Protein', calories: 400, protein: 80, carbs: 10, fat: 4, category: 'Suplementos' }, quantity: 25 }
              ],
              timestamp: new Date(),
              completed: false
            }
          ],
          quarta: [
            {
              id: 91,
              name: 'Café da Manhã',
              time: '07:00',
              foods: [
                { food: { id: 1, name: 'Aveia', calories: 375, protein: 13, carbs: 69, fat: 7, category: 'Cereais' }, quantity: 50 }
              ],
              timestamp: new Date(),
              completed: false
            }
          ],
          quinta: [
            {
              id: 101,
              name: 'Café da Manhã',
              time: '07:00',
              foods: [
                { food: { id: 2, name: 'Banana', calories: 89, protein: 1, carbs: 23, fat: 0.3, category: 'Frutas' }, quantity: 100 }
              ],
              timestamp: new Date(),
              completed: false
            }
          ],
          sexta: [
            {
              id: 111,
              name: 'Café da Manhã',
              time: '07:00',
              foods: [
                { food: { id: 11, name: 'Salada', calories: 25, protein: 2, carbs: 5, fat: 0.3, category: 'Vegetais' }, quantity: 200 }
              ],
              timestamp: new Date(),
              completed: false
            }
          ],
          sabado: [
            {
              id: 121,
              name: 'Café da Manhã',
              time: '08:00',
              foods: [
                { food: { id: 12, name: 'Mingau Light', calories: 150, protein: 6, carbs: 25, fat: 3, category: 'Cereais' }, quantity: 200 }
              ],
              timestamp: new Date(),
              completed: false
            }
          ],
          domingo: [
            {
              id: 131,
              name: 'Café da Manhã',
              time: '09:00',
              foods: [
                { food: { id: 13, name: 'Café com Leite', calories: 60, protein: 3, carbs: 6, fat: 3, category: 'Bebidas' }, quantity: 250 }
              ],
              timestamp: new Date(),
              completed: false
            }
          ]
        }
      }
    ];

    // Default weight history
    const defaultWeightHistory: WeightEntry[] = [
      { id: '1', date: '2024-09-01', weight: 72, bodyFat: 16, muscle: 38 },
      { id: '2', date: '2024-09-15', weight: 71, bodyFat: 15.5, muscle: 39 },
      { id: '3', date: '2024-10-01', weight: 70, bodyFat: 15, muscle: 40 }
    ];

    setWorkoutPlans(defaultWorkouts);
    setDietPlans(defaultDiets);
    setWeightHistory(defaultWeightHistory);

    // Default notifications
    const defaultNotifications: Notification[] = [
      {
        id: '1',
        type: 'workout',
        title: 'Hora do Treino!',
        time: '07:00',
        enabled: true,
        days: [1, 3, 5] // Segunda, Quarta, Sexta
      },
      {
        id: '2',
        type: 'meal',
        title: 'Lembrete: Café da Manhã',
        time: '08:00',
        enabled: true,
        days: [0, 1, 2, 3, 4, 5, 6] // Todos os dias
      },
      {
        id: '3',
        type: 'meal',
        title: 'Lembrete: Almoço',
        time: '12:00',
        enabled: true,
        days: [0, 1, 2, 3, 4, 5, 6]
      },
      {
        id: '4',
        type: 'meal',
        title: 'Lembrete: Jantar',
        time: '19:00',
        enabled: true,
        days: [0, 1, 2, 3, 4, 5, 6]
      }
    ];
    setNotifications(defaultNotifications);

    // Default health tips
    const defaultHealthTips: HealthTip[] = [
      {
        id: '1',
        title: 'Hidratação é fundamental',
        content: 'Beba pelo menos 2-3 litros de água por dia. A hidratação adequada melhora o desempenho físico, ajuda na digestão e mantém a pele saudável.',
        category: 'health',
        icon: '💧',
        isRead: false,
        createdAt: new Date().toISOString()
      },
      {
        id: '2',
        title: 'Proteína após o treino',
        content: 'Consuma proteína dentro de 30-60 minutos após o treino para otimizar a recuperação muscular. Boas opções: whey protein, ovos, frango ou iogurte grego.',
        category: 'nutrition',
        icon: '🥩',
        isRead: false,
        createdAt: new Date().toISOString()
      },
      {
        id: '3',
        title: 'Importância do aquecimento',
        content: 'Sempre faça 5-10 minutos de aquecimento antes do treino. Isso prepara músculos e articulações, reduzindo o risco de lesões.',
        category: 'workout',
        icon: '🏃‍♂️',
        isRead: false,
        createdAt: new Date().toISOString()
      },
      {
        id: '4',
        title: 'Qualidade do sono',
        content: 'Durma 7-9 horas por noite. O sono é essencial para recuperação muscular, regulação hormonal e controle do peso.',
        category: 'wellness',
        icon: '😴',
        isRead: false,
        createdAt: new Date().toISOString()
      },
      {
        id: '5',
        title: 'Carboidratos pré-treino',
        content: 'Consuma carboidratos 1-2 horas antes do treino para ter energia. Boas opções: banana, aveia, batata doce ou pão integral.',
        category: 'nutrition',
        icon: '🍌',
        isRead: false,
        createdAt: new Date().toISOString()
      }
    ];
    setHealthTips(defaultHealthTips);

    // Default goals
    const defaultGoals: Goal[] = [
      {
        id: '1',
        type: 'weight_loss',
        title: 'Perder Peso',
        description: 'Atingir peso ideal para melhor saúde',
        targetValue: 65,
        currentValue: 70,
        unit: 'kg',
        deadline: '2025-03-01',
        completed: false,
        createdAt: '2024-10-01'
      },
      {
        id: '2',
        type: 'muscle_gain',
        title: 'Ganhar Massa Muscular',
        description: 'Aumentar percentual de massa magra',
        targetValue: 45,
        currentValue: 40,
        unit: '%',
        deadline: '2025-06-01',
        completed: false,
        createdAt: '2024-10-01'
      },
      {
        id: '3',
        type: 'strength',
        title: 'Aumentar Força no Supino',
        description: 'Meta de carga máxima no supino reto',
        targetValue: 100,
        currentValue: 80,
        unit: 'kg',
        deadline: '2025-04-01',
        completed: false,
        createdAt: '2024-10-01'
      }
    ];
    setGoals(defaultGoals);
    
    // Carregar dados salvos na inicialização
    const initializeApp = async () => {
      console.log('🚀 INICIANDO APP - Carregando dados...');
      
      // Testar conexão com Firebase
      const firebaseConnected = await testFirebaseConnection();
      if (firebaseConnected) {
        console.log('🔥 Firebase conectado com sucesso!');
        console.log('🔄 Iniciando migração automática para estrutura em português...');
        
        // Migrar nomes das coleções para português
        await migrateCollectionNames();
        
        // DEBUG: Verificar conteúdo da coleção de dietas (comentado para não interferir)
        // console.log('🔍 Verificando conteúdo da coleção de dietas...');
        // await debugCollectionContents('dietPlans');
        
        // Configurar listener em tempo real para planos de treino
        const unsubscribeWorkouts = setupRealtimeListener('workoutPlans', (firebasePlans: any[]) => {
          setWorkoutPlans(firebasePlans);
        });

        // Configurar listener em tempo real para planos de dieta
        const unsubscribeDiets = setupRealtimeListener('dietPlans', (firebaseDiets: any[]) => {
          console.log('🔄 Dietas sincronizadas do Firebase:', firebaseDiets.length);
          console.log('📋 Detalhes das dietas carregadas:', firebaseDiets.map(d => ({ 
            id: d.id, 
            name: d.name, 
            totalCalories: d.totalCalories,
            weeklyMeals: Object.keys(d.weeklyMeals || {}).map(day => `${day}: ${(d.weeklyMeals[day] || []).length} refeições`)
          })));
          setDietPlans(firebaseDiets);
        });

        // Armazenar função de cleanup no componente
        return () => {
          if (unsubscribeWorkouts) unsubscribeWorkouts();
          if (unsubscribeDiets) unsubscribeDiets();
        };
      } else {
        console.log('⚠️ Firebase não disponível - funcionando somente online');
      }
      
      // Carregar dados (que automaticamente fará a migração se necessário)
      loadSavedData();
    };
    
    const cleanup = initializeApp();
    
    // Cleanup function para remover listener
    return () => {
      cleanup.then((unsubscribe) => {
        if (unsubscribe) {
          unsubscribe();
          console.log('🔌 Listener de planos de treino desconectado');
        }
      });
    };
  }, []);

  // useEffect para gerar dicas personalizadas quando o perfil for atualizado
  useEffect(() => {
    if (dataLoaded && userStats.name && userStats.age && userStats.height && userStats.weight) {
      // Aguardar um pouco antes de gerar dicas para não sobrecarregar
      const timer = setTimeout(() => {
        addNewHealthTips();
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [dataLoaded, userStats.name, userStats.age, userStats.height, userStats.weight]);

  // Função para carregar dados salvos
  const loadSavedData = async () => {
    try {
      console.log('🔄 Carregando dados do Firebase...');
      console.log('🔍 DEBUG: Iniciando loadSavedData...');
      
      // Carregar treinos salvos do Firebase
      const savedWorkouts = await loadCollectionFromFirebase('workoutPlans');
      if (savedWorkouts && savedWorkouts.length > 0) {
        setWorkoutPlans(savedWorkouts);
        console.log('✅ Treinos carregados do Firebase (português):', savedWorkouts.length);
      } else {
        console.log('📱 Nenhum treino encontrado na estrutura em português. Verificando estrutura antiga...');
        
        // Tentar migrar dados da estrutura antiga
        const migratedWorkouts = await migrateFirebaseToPortuguese();
        if (migratedWorkouts && migratedWorkouts.length > 0) {
          setWorkoutPlans(migratedWorkouts);
          console.log('✅ Treinos migrados e carregados:', migratedWorkouts.length);
        }
      }

      // ⚠️ NOTA: Carregamento de dietas removido - agora usado listener em tempo real
      // O listener setupRealtimeListener('dietPlans') carrega automaticamente
      
      console.log('🔍 DEBUG: Chegando na seção userStats...');
      // Carregar estatísticas do usuário
      const savedStats = await loadData(STORAGE_KEYS.USER_STATS);
      console.log('🔍 DEBUG: Tentando carregar userStats...');
      console.log('🔍 STORAGE_KEYS.USER_STATS:', STORAGE_KEYS.USER_STATS);
      console.log('🔍 Carregando userStats salvos:', savedStats);
      if (savedStats) {
        console.log('✅ Aplicando userStats salvos:', savedStats);
        setUserStats(savedStats);
      } else {
        console.log('⚠️ Nenhum userStats encontrado, mantendo padrão');
      }

      // Carregar histórico de peso
      const savedWeightHistory = await loadData(STORAGE_KEYS.WEIGHT_HISTORY);
      if (savedWeightHistory && savedWeightHistory.length > 0) {
        setWeightHistory(savedWeightHistory);
      }

      // Carregar histórico de treinos
      const savedWorkoutHistory = await loadData(STORAGE_KEYS.WORKOUT_HISTORY);
      if (savedWorkoutHistory && savedWorkoutHistory.length > 0) {
        setWorkoutHistory(savedWorkoutHistory);
      }

      // Carregar objetivos
      const savedGoals = await loadData(STORAGE_KEYS.GOALS);
      if (savedGoals && savedGoals.length > 0) {
        setGoals(savedGoals);
      }

      // Carregar notificações
      const savedNotifications = await loadData(STORAGE_KEYS.NOTIFICATIONS);
      if (savedNotifications && savedNotifications.length > 0) {
        setNotifications(savedNotifications);
      }

      // Carregar dicas de saúde
      const savedHealthTips = await AsyncStorage.getItem('healthTips');
      if (savedHealthTips) {
        const parsedTips = JSON.parse(savedHealthTips);
        if (parsedTips && parsedTips.length > 0) {
          setHealthTips(parsedTips);
        }
      }

      console.log('✅ Dados carregados com sucesso!');
      setDataLoaded(true);
    } catch (error) {
      console.error('❌ Erro ao carregar dados salvos:', error);
      setDataLoaded(true);
    }
  };

  // 🚫 useEffects para salvar dados automaticamente REMOVIDOS para evitar loop infinito
  // com sincronização em tempo real do Firebase
  
  // COMENTADO: Esses useEffects causavam loop infinito com real-time sync
  // useEffect(() => {
  //   if (workoutPlans.length > 0) {
  //     saveData(STORAGE_KEYS.WORKOUT_PLANS, workoutPlans);
  //   }
  // }, [workoutPlans]);

  // useEffect(() => {
  //   if (dietPlans.length > 0) {
  //     saveData(STORAGE_KEYS.DIET_PLANS, dietPlans);
  //   }
  // }, [dietPlans]);

  // ✅ useEffect específico para userStats com debounce para evitar salvamentos excessivos
  useEffect(() => {
    if (dataLoaded && (userStats.name || userStats.weight || userStats.height || userStats.age)) {
      const timer = setTimeout(() => {
        console.log('💾 Auto-salvando perfil do usuário:', userStats);
        saveData(STORAGE_KEYS.USER_STATS, userStats);
      }, 2000); // Salvar após 2 segundos de inatividade

      return () => clearTimeout(timer);
    }
  }, [userStats, dataLoaded]);

  // useEffect(() => {
  //   if (dataLoaded) {
  //     console.log('💾 Salvando userStats:', userStats);
  //     saveData(STORAGE_KEYS.USER_STATS, userStats);
  //   } else {
  //     console.log('⏳ Aguardando carregamento dos dados antes de salvar...');
  //   }
  // }, [userStats, dataLoaded]);

  // useEffect para salvar histórico de peso
  useEffect(() => {
    if (dataLoaded && weightHistory.length > 0) {
      const timer = setTimeout(async () => {
        console.log('💾 Auto-salvando histórico de peso:', weightHistory);
        await saveData(STORAGE_KEYS.WEIGHT_HISTORY, weightHistory);
        
        // Salvar no Firebase também
        try {
          const user = authService.getCurrentUser();
          if (user && weightHistory.length > 0) {
            // Salvar apenas a entrada mais recente se ainda não foi salva
            const lastEntry = weightHistory[weightHistory.length - 1];
            if (lastEntry) {
              await firestoreService.addDocument('historico_peso', {
                ...lastEntry,
                userId: user.uid,
                createdAt: new Date(),
                updatedAt: new Date()
              });
              console.log('✅ Nova entrada de peso salva no Firebase:', lastEntry);
            }
          }
        } catch (error) {
          console.error('❌ Erro ao salvar histórico de peso no Firebase:', error);
        }
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [weightHistory, dataLoaded]);

  // useEffect(() => {
  //   if (workoutHistory.length > 0) {
  //     saveData(STORAGE_KEYS.WORKOUT_HISTORY, workoutHistory);
  //   }
  // }, [workoutHistory]);

  // useEffect(() => {
  //   if (goals.length > 0) {
  //     saveData(STORAGE_KEYS.GOALS, goals);
  //   }
  // }, [goals]);

  // useEffect para salvar notificações e reagendar
  useEffect(() => {
    if (notifications.length > 0) {
      saveData(STORAGE_KEYS.NOTIFICATIONS, notifications);
      
      // Reagendar notificações quando a lista muda (não na primeira carga)
      if (dataLoaded) {
        const timer = setTimeout(() => {
          rescheduleAllNotifications();
        }, 1000);
        
        return () => clearTimeout(timer);
      }
    }
  }, [notifications, dataLoaded]);

  // useEffect para configurar notificações na inicialização do app
  useEffect(() => {
    if (dataLoaded && notifications.length > 0) {
      const initializeNotifications = async () => {
        console.log('🔔 Inicializando sistema de notificações...');
        await rescheduleAllNotifications();
      };
      
      initializeNotifications();
    }
  }, [dataLoaded]);

  // Função de teste para notificações (remover em produção)
  const createTestNotification = async () => {
    const now = new Date();
    const testTime = new Date(now.getTime() + 60000); // 1 minuto a partir de agora
    const timeString = `${testTime.getHours().toString().padStart(2, '0')}:${testTime.getMinutes().toString().padStart(2, '0')}`;
    
    const testReminder: Notification = {
      id: `test_${Date.now()}`,
      type: 'workout',
      title: 'Teste de Notificação - Hora do Treino!',
      time: timeString,
      enabled: true,
      days: [now.getDay()] // Hoje
    };

    setNotifications(prev => [...prev, testReminder]);
    await scheduleNotification(testReminder);
    
    Alert.alert(
      'Teste de Notificação',
      `Notificação de teste agendada para ${timeString} (em 1 minuto). Verifique se receberá a notificação.`,
      [{ text: 'OK' }]
    );
  };

  // Carregar exercício favorito do usuário
  useEffect(() => {
    loadData(STORAGE_KEYS.USER_FAVORITE_EXERCISE).then((favorite: string) => {
      if (favorite) {
        setUserDefinedFavoriteExercise(favorite);
      }
    });
  }, []);

  // 🔥 useEffect específico para carregar userStats independente das migrações
  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        console.log('🔍 [PROFILE] Carregando dados do perfil...');
        const savedStats = await loadData(STORAGE_KEYS.USER_STATS);
        console.log('🔍 [PROFILE] Dados carregados:', savedStats);
        
        if (savedStats && Object.keys(savedStats).length > 0) {
          console.log('✅ [PROFILE] Aplicando dados do perfil salvos');
          setUserStats(savedStats);
          setDataLoaded(true);
        } else {
          console.log('⚠️ [PROFILE] Nenhum dado de perfil encontrado, usando padrão');
          setDataLoaded(true);
        }
      } catch (error) {
        console.error('❌ [PROFILE] Erro ao carregar perfil:', error);
        setDataLoaded(true); // Marca como carregado mesmo com erro
      }
    };

    // Delay pequeno para garantir que Firebase esteja inicializado
    setTimeout(loadUserProfile, 1000);
  }, []);

  // Atualizar lista de exercícios disponíveis
  useEffect(() => {
    const exercises = new Set<string>();
    workoutPlans.forEach(plan => {
      Object.values(plan.weeklyExercises).forEach(dayExercises => {
        dayExercises.forEach(exercise => {
          exercises.add(exercise.name);
        });
      });
    });
    workoutHistory.forEach(session => {
      session.completedExercises.forEach(exercise => {
        exercises.add(exercise.exerciseName);
      });
    });
    setFavoriteExercisesList(Array.from(exercises).sort());
  }, [workoutPlans, workoutHistory]);

  // Função para calcular volume total de uma sessão com debug
  const calculateSessionVolume = (completedExercises: any[]) => {
    let totalVolume = 0;
    
    completedExercises.forEach(exercise => {
      const exerciseVolume = exercise.sets.reduce((sum: number, set: any) => {
        const weight = set.weight || 0;
        const reps = set.reps || 0;
        const setVolume = weight * reps;
        console.log(`Set: ${weight}kg x ${reps}reps = ${setVolume}kg`);
        return sum + setVolume;
      }, 0);
      
      console.log(`Exercício ${exercise.exerciseName}: ${exerciseVolume}kg`);
      totalVolume += exerciseVolume;
    });
    
    console.log(`Volume total da sessão: ${totalVolume}kg`);
    return totalVolume;
  };

  // Função para obter exercício favorito inteligente
  const getSmartFavoriteExercise = (exerciseCount: Record<string, number>) => {
    // Se o usuário definiu um favorito, usar ele
    if (userDefinedFavoriteExercise) {
      return userDefinedFavoriteExercise;
    }
    
    // Senão, usar o mais praticado
    if (Object.keys(exerciseCount).length > 0) {
      return Object.keys(exerciseCount).reduce((a, b) => 
        exerciseCount[a] > exerciseCount[b] ? a : b
      );
    }
    
    // Padrão se não houver dados
    return 'Supino';
  };

  // Função para salvar exercício favorito
  const saveFavoriteExercise = async (exercise: string) => {
    setUserDefinedFavoriteExercise(exercise);
    await saveData(STORAGE_KEYS.USER_FAVORITE_EXERCISE, exercise);
    setShowFavoriteExerciseModal(false);
    // Recalcular estatísticas
    if (workoutHistory.length > 0) {
      recalculateWorkoutStats();
    }
  };

  // Função para resetar exercício favorito (usar automático)
  const resetFavoriteExercise = async () => {
    setUserDefinedFavoriteExercise('');
    await saveData(STORAGE_KEYS.USER_FAVORITE_EXERCISE, '');
    setShowFavoriteExerciseModal(false);
    // Recalcular estatísticas
    if (workoutHistory.length > 0) {
      recalculateWorkoutStats();
    }
  };

  // Recalcular estatísticas quando o histórico mudar
  useEffect(() => {
    if (workoutHistory.length > 0) {
      recalculateWorkoutStats();
    }
  }, [workoutHistory]);

  // Função para recalcular estatísticas do histórico existente
  const recalculateWorkoutStats = () => {
    // Validar e corrigir volumes das sessões se necessário
    const correctedHistory = workoutHistory.map(session => {
      if (!session.totalVolume || session.totalVolume === 0) {
        const recalculatedVolume = calculateSessionVolume(session.completedExercises);
        console.log(`Corrigindo volume da sessão ${session.id}: ${session.totalVolume} → ${recalculatedVolume}`);
        return { ...session, totalVolume: recalculatedVolume };
      }
      return session;
    });
    
    // Atualizar histórico se houve correções
    if (JSON.stringify(correctedHistory) !== JSON.stringify(workoutHistory)) {
      setWorkoutHistory(correctedHistory);
      console.log('Histórico de treinos corrigido');
    }
    
    const totalWorkouts = correctedHistory.length;
    const totalVolume = correctedHistory.reduce((sum, session) => sum + (session.totalVolume || 0), 0);
    const averageDuration = totalWorkouts > 0 ? 
      correctedHistory.reduce((sum, session) => sum + (session.duration || 0), 0) / totalWorkouts : 0;
    
    // Calcular exercício favorito com validação
    const exerciseCount = correctedHistory.reduce((acc, session) => {
      if (session.completedExercises && session.completedExercises.length > 0) {
        session.completedExercises.forEach(ex => {
          if (ex.exerciseName) {
            acc[ex.exerciseName] = (acc[ex.exerciseName] || 0) + 1;
          }
        });
      }
      return acc;
    }, {} as Record<string, number>);
    
    const favoriteExercise = getSmartFavoriteExercise(exerciseCount);

    // Calcular streak atual melhorado
    const sortedSessions = correctedHistory
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    let lastDate: Date | null = null;
    
    for (const session of sortedSessions) {
      const sessionDate = new Date(session.date);
      sessionDate.setHours(0, 0, 0, 0);
      
      if (lastDate === null) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (sessionDate.getTime() === today.getTime() || sessionDate.getTime() === yesterday.getTime()) {
          currentStreak = 1;
          tempStreak = 1;
          lastDate = sessionDate;
        } else {
          tempStreak = 1;
          lastDate = sessionDate;
        }
      } else {
        const expectedDate = new Date(lastDate);
        expectedDate.setDate(expectedDate.getDate() - 1);
        
        if (sessionDate.getTime() === expectedDate.getTime()) {
          tempStreak++;
          if (currentStreak > 0) currentStreak++;
          lastDate = sessionDate;
        } else if (sessionDate.getTime() === lastDate.getTime()) {
          continue;
        } else {
          longestStreak = Math.max(longestStreak, tempStreak);
          tempStreak = 1;
          lastDate = sessionDate;
          currentStreak = 0;
        }
      }
    }
    
    longestStreak = Math.max(longestStreak, tempStreak, currentStreak);

    setWorkoutStats({
      totalWorkouts,
      totalVolume,
      averageDuration,
      favoriteExercise,
      currentStreak,
      longestStreak,
      weeklyFrequency: calculateWeeklyFrequency(correctedHistory),
      monthlyProgress: calculateMonthlyProgress(correctedHistory)
    });
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const startWorkout = (workoutId: string) => {
    setActiveWorkout(workoutId);
    setTimer(0);
    setIsTimerRunning(true);
    // Resetar todos os exercícios para não concluídos
    const updatedPlans = workoutPlans.map(plan => {
      const newWeeklyExercises = { ...plan.weeklyExercises };
      Object.keys(newWeeklyExercises).forEach(day => {
        newWeeklyExercises[day] = newWeeklyExercises[day].map(ex => ({ ...ex, completed: false }));
      });
      return { ...plan, weeklyExercises: newWeeklyExercises };
    });
    setWorkoutPlans(updatedPlans);
  };

  const finishWorkout = () => {
    if (activeWorkout) {
      const workoutPlan = workoutPlans.find(plan => plan.id === activeWorkout);
      if (workoutPlan) {
        const currentDayExercises = workoutPlan.weeklyExercises[selectedWorkoutDay] || [];
        const completedExercises: CompletedExercise[] = currentDayExercises.map(exercise => ({
          exerciseId: exercise.id,
          exerciseName: exercise.name,
          muscle: exercise.muscle,
          sets: [
            {
              setNumber: 1,
              reps: parseInt(exercise.reps) || 0,
              weight: exercise.weight || 0,
              completed: exercise.completed || false,
              restTime: exercise.restTime
            }
          ],
          restTime: exercise.restTime
        }));

        const session: WorkoutSession = {
          id: Date.now().toString(),
          workoutPlanId: activeWorkout,
          workoutName: workoutPlan.name,
          date: new Date().toISOString().split('T')[0],
          startTime: new Date(Date.now() - timer * 1000).toISOString(),
          endTime: new Date().toISOString(),
          duration: Math.floor(timer / 60),
          completedExercises,
          totalVolume: calculateSessionVolume(completedExercises),
          notes: ''
        };

        setWorkoutHistory([...workoutHistory, session]);
        updateWorkoutStats(session);
      }
    }
    
    setActiveWorkout(null);
    setIsTimerRunning(false);
    setTimer(0);
    setRestTimer(0);
    setIsRestTimerRunning(false);
  };

  // Função para abrir vídeo do YouTube
  const openVideoURL = async (videoUrl: string) => {
    try {
      const supported = await Linking.canOpenURL(videoUrl);
      if (supported) {
        await Linking.openURL(videoUrl);
      } else {
        alert('Não é possível abrir este link no seu dispositivo');
      }
    } catch (error) {
      alert('Erro ao tentar abrir o vídeo: ' + error);
    }
  };

  // Função para criar nova meta
  const createGoal = () => {
    if (!newGoal.title.trim() || !newGoal.targetValue || !newGoal.deadline.trim()) {
      alert('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    const goal: Goal = {
      id: Date.now().toString(),
      type: newGoal.type,
      title: newGoal.title,
      description: newGoal.description,
      targetValue: newGoal.targetValue,
      currentValue: newGoal.currentValue,
      unit: newGoal.unit,
      deadline: newGoal.deadline,
      createdAt: new Date().toISOString(),
      completed: false
    };

    setGoals([...goals, goal]);
    setNewGoal({
      type: 'weight_loss',
      title: '',
      description: '',
      targetValue: 0,
      currentValue: 0,
      unit: 'kg',
      deadline: '',
    });
  };

  // Funções para controlar dicas de saúde
  const markTipAsRead = (tipId: string) => {
    const updatedTips = healthTips.map(tip =>
      tip.id === tipId ? { ...tip, isRead: true } : tip
    );
    setHealthTips(updatedTips);
    
    // Salvar no AsyncStorage
    AsyncStorage.setItem('healthTips', JSON.stringify(updatedTips));
  };



  const getUnreadTipsCount = () => {
    return healthTips.filter(tip => !tip.isRead).length;
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'nutrition': return '🥗';
      case 'health': return '💚';
      case 'workout': return '💪';
      case 'wellness': return '🧘‍♂️';
      default: return '💡';
    }
  };

  const getCategoryName = (category: string) => {
    switch (category) {
      case 'nutrition': return 'Nutrição';
      case 'health': return 'Saúde';
      case 'workout': return 'Treino';
      case 'wellness': return 'Bem-estar';
      default: return 'Geral';
    }
  };

  // Função para abrir modal de atualização de meta
  const openUpdateGoalModal = (goal: Goal) => {
    setSelectedGoal(goal);
    setUpdateGoalValue(goal.currentValue.toString());
    setShowUpdateGoalModal(true);
  };

  // Função para atualizar progresso da meta
  const updateGoalProgress = () => {
    if (!selectedGoal || !updateGoalValue.trim()) {
      alert('Por favor, insira um valor válido');
      return;
    }

    const newValue = parseFloat(updateGoalValue);
    if (isNaN(newValue) || newValue < 0) {
      alert('Por favor, insira um valor numérico válido');
      return;
    }

    const updatedGoals = goals.map(g => 
      g.id === selectedGoal.id 
        ? { ...g, currentValue: newValue }
        : g
    );
    
    setGoals(updatedGoals);
    saveData(STORAGE_KEYS.GOALS, updatedGoals);
    
    // Fechar modal e limpar estados
    setShowUpdateGoalModal(false);
    setSelectedGoal(null);
    setUpdateGoalValue('');
  };

  // Função para cancelar atualização da meta
  const cancelUpdateGoal = () => {
    setShowUpdateGoalModal(false);
    setSelectedGoal(null);
    setUpdateGoalValue('');
    setShowModal(false);
  };

  // Funções para histórico de treinos
  const updateWorkoutStats = (newSession: WorkoutSession) => {
    const updatedHistory = [...workoutHistory, newSession];
    
    const totalWorkouts = updatedHistory.length;
    const totalVolume = updatedHistory.reduce((sum, session) => sum + (session.totalVolume || 0), 0);
    const averageDuration = totalWorkouts > 0 ? 
      updatedHistory.reduce((sum, session) => sum + (session.duration || 0), 0) / totalWorkouts : 0;
    
    // Calcular exercício favorito com validação
    const exerciseCount = updatedHistory.reduce((acc, session) => {
      if (session.completedExercises && session.completedExercises.length > 0) {
        session.completedExercises.forEach(ex => {
          if (ex.exerciseName) {
            acc[ex.exerciseName] = (acc[ex.exerciseName] || 0) + 1;
          }
        });
      }
      return acc;
    }, {} as Record<string, number>);
    
    const favoriteExercise = Object.keys(exerciseCount).length > 0 ? 
      Object.keys(exerciseCount).reduce((a, b) => 
        exerciseCount[a] > exerciseCount[b] ? a : b
      ) : 'Supino';

    // Calcular streak atual melhorado
    const sortedSessions = updatedHistory
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    let currentStreak = 0;
    let lastDate: Date | null = null;
    
    for (const session of sortedSessions) {
      const sessionDate = new Date(session.date);
      sessionDate.setHours(0, 0, 0, 0); // Normalizar para comparação por dia
      
      if (lastDate === null) {
        // Primeira sessão
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        // Só conta se foi hoje ou ontem
        if (sessionDate.getTime() === today.getTime() || sessionDate.getTime() === yesterday.getTime()) {
          currentStreak = 1;
          lastDate = sessionDate;
        } else {
          break;
        }
      } else {
        const expectedDate = new Date(lastDate);
        expectedDate.setDate(expectedDate.getDate() - 1);
        
        if (sessionDate.getTime() === expectedDate.getTime()) {
          currentStreak++;
          lastDate = sessionDate;
        } else if (sessionDate.getTime() === lastDate.getTime()) {
          // Mesmo dia, não quebra a sequência mas não incrementa
          continue;
        } else {
          // Quebrou a sequência
          break;
        }
      }
    }

    setWorkoutStats({
      totalWorkouts,
      totalVolume,
      averageDuration,
      favoriteExercise,
      currentStreak,
      longestStreak: Math.max(workoutStats.longestStreak, currentStreak),
      weeklyFrequency: calculateWeeklyFrequency(updatedHistory),
      monthlyProgress: calculateMonthlyProgress(updatedHistory)
    });
  };

  const calculateWeeklyFrequency = (history: WorkoutSession[]) => {
    if (history.length === 0) return 0;
    
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    oneWeekAgo.setHours(0, 0, 0, 0);
    
    const recentWorkouts = history.filter(session => {
      const sessionDate = new Date(session.date);
      return sessionDate >= oneWeekAgo;
    });
    
    return recentWorkouts.length;
  };

  const calculateMonthlyProgress = (history: WorkoutSession[]): MonthlyProgress[] => {
    if (history.length === 0) return [];
    
    const monthlyData = history.reduce((acc, session) => {
      if (!session.date) return acc;
      
      const month = session.date.substring(0, 7); // YYYY-MM
      if (!acc[month]) {
        acc[month] = { workouts: 0, volume: 0, totalDuration: 0 };
      }
      acc[month].workouts++;
      acc[month].volume += session.totalVolume || 0;
      acc[month].totalDuration += session.duration || 0;
      return acc;
    }, {} as Record<string, { workouts: number; volume: number; totalDuration: number }>);

    return Object.entries(monthlyData)
      .map(([month, data]) => ({
        month,
        workouts: data.workouts,
        volume: data.volume,
        avgDuration: data.workouts > 0 ? Math.round(data.totalDuration / data.workouts) : 0
      }))
      .sort((a, b) => b.month.localeCompare(a.month))
      .slice(0, 12);
  };

  const getFilteredWorkoutHistory = () => {
    const now = new Date();
    let filterDate = new Date();

    switch (selectedDateRange) {
      case '7days':
        filterDate.setDate(now.getDate() - 7);
        break;
      case '30days':
        filterDate.setDate(now.getDate() - 30);
        break;
      case '3months':
        filterDate.setMonth(now.getMonth() - 3);
        break;
      case '1year':
        filterDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        filterDate.setDate(now.getDate() - 7);
    }

    return workoutHistory.filter(session => new Date(session.date) >= filterDate);
  };

  const toggleExerciseComplete = (workoutId: string, exerciseId: string) => {
    const updatedPlans = workoutPlans.map(plan => {
      if (plan.id === workoutId) {
        const newWeeklyExercises = { ...plan.weeklyExercises };
        newWeeklyExercises[selectedWorkoutDay] = newWeeklyExercises[selectedWorkoutDay].map(ex => {
          if (ex.id === exerciseId) {
            return { ...ex, completed: !ex.completed };
          }
          return ex;
        });
        return { ...plan, weeklyExercises: newWeeklyExercises };
      }
      return plan;
    });
    setWorkoutPlans(updatedPlans);
  };

  const toggleMealComplete = async (dietId: string, mealId: number) => {
    const safeDietPlans = dietPlans || [];
    const updatedDiets = safeDietPlans.map(diet => {
      if (diet.id === dietId) {
        return {
          ...diet,
          weeklyMeals: {
            ...diet.weeklyMeals,
            [selectedDietDay]: diet.weeklyMeals[selectedDietDay].map(meal => {
              if (meal.id === mealId) {
                return { ...meal, completed: !(meal.completed || false) };
              }
              return meal;
            })
          }
        };
      }
      return diet;
    });
    
    setDietPlans(updatedDiets);
    
    // Salvar no Firebase
    try {
      const updatedDiet = updatedDiets.find(diet => diet.id === dietId);
      if (updatedDiet) {
        await saveDataToFirebase('dietPlans', dietId, updatedDiet);
        console.log('✅ Status da refeição atualizado no Firebase');
      }
    } catch (error) {
      console.error('❌ Erro ao atualizar refeição no Firebase:', error);
      // Fallback para AsyncStorage
      saveData(STORAGE_KEYS.DIET_PLANS, updatedDiets);
    }
  };

  const resetMealsProgress = async (dietId: string) => {
    const safeDietPlans = dietPlans || [];
    const updatedDiets = safeDietPlans.map(diet => {
      if (diet.id === dietId) {
        return {
          ...diet,
          weeklyMeals: {
            ...diet.weeklyMeals,
            [selectedDietDay]: diet.weeklyMeals[selectedDietDay].map(meal => ({
              ...meal,
              completed: false
            }))
          }
        };
      }
      return diet;
    });
    
    setDietPlans(updatedDiets);
    
    // Salvar no Firebase
    try {
      const updatedDiet = updatedDiets.find(diet => diet.id === dietId);
      if (updatedDiet) {
        await saveDataToFirebase('dietPlans', dietId, updatedDiet);
        console.log('✅ Progresso das refeições resetado no Firebase');
      }
    } catch (error) {
      console.error('❌ Erro ao resetar progresso no Firebase:', error);
      // Fallback para AsyncStorage
      saveData(STORAGE_KEYS.DIET_PLANS, updatedDiets);
    }
  };

  const startRestTimer = (seconds: number) => {
    setRestTimer(seconds);
    setIsRestTimerRunning(true);
  };

  const calculateBMI = () => {
    const heightInMeters = userStats.height / 100;
    return (userStats.weight / (heightInMeters * heightInMeters)).toFixed(1);
  };

  const calculateAdvancedStats = () => {
    // BMR usando fórmula de Mifflin-St Jeor
    let bmr: number;
    if (userStats.gender === 'male') {
      bmr = 10 * userStats.weight + 6.25 * userStats.height - 5 * userStats.age + 5;
    } else if (userStats.gender === 'female') {
      bmr = 10 * userStats.weight + 6.25 * userStats.height - 5 * userStats.age - 161;
    } else {
      // Usar média para 'other'
      const maleBmr = 10 * userStats.weight + 6.25 * userStats.height - 5 * userStats.age + 5;
      const femaleBmr = 10 * userStats.weight + 6.25 * userStats.height - 5 * userStats.age - 161;
      bmr = (maleBmr + femaleBmr) / 2;
    }

    // TDEE baseado no nível de atividade
    const activityMultipliers = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
      very_active: 1.9
    };
    
    const tdee = bmr * (activityMultipliers[userStats.activityLevel || 'moderate']);

    // Peso ideal (fórmula de Robinson)
    let idealWeight: number;
    if (userStats.gender === 'male') {
      idealWeight = 52 + 1.9 * ((userStats.height - 152.4) / 2.54);
    } else {
      idealWeight = 49 + 1.7 * ((userStats.height - 152.4) / 2.54);
    }

    // Água corporal estimada (60% do peso para homens, 50% para mulheres)
    const waterPercentage = userStats.gender === 'male' ? 0.6 : userStats.gender === 'female' ? 0.5 : 0.55;
    const bodyWater = userStats.weight * waterPercentage;

    // Relação cintura-quadril (se disponível)
    let waistHipRatio: number | null = null;
    if (userStats.waist && userStats.hips) {
      waistHipRatio = userStats.waist / userStats.hips;
    }

    return {
      bmr: Math.round(bmr),
      tdee: Math.round(tdee),
      idealWeight: Math.round(idealWeight * 10) / 10,
      bodyWater: Math.round(bodyWater * 10) / 10,
      waistHipRatio: waistHipRatio ? Math.round(waistHipRatio * 100) / 100 : null,
      caloriesForGoal: Math.round(userStats.fitnessGoal === 'weight_loss' ? tdee - 500 : 
                                 userStats.fitnessGoal === 'muscle_gain' ? tdee + 300 : tdee)
    };
  };

  const calculateCalories = () => {
    const stats = calculateAdvancedStats();
    return stats.caloriesForGoal;
  };

  const saveUserStats = (newStats: UserStats) => {
    setUserStats(newStats);
    // Adicionar nova entrada no histórico de peso
    const newWeightEntry: WeightEntry = {
      id: Date.now().toString(),
      date: new Date().toISOString().split('T')[0],
      weight: newStats.weight,
      bodyFat: newStats.bodyFat,
      muscle: newStats.muscle
    };
    setWeightHistory(prev => [...prev, newWeightEntry]);
  };

  const toggleNotification = async (id: string) => {
    const notification = notifications.find(notif => notif.id === id);
    if (!notification) return;

    const newEnabledState = !notification.enabled;
    
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === id ? { ...notif, enabled: newEnabledState } : notif
      )
    );

    // Agendar ou cancelar notificação baseado no novo estado
    if (newEnabledState) {
      await scheduleNotification({ ...notification, enabled: true });
      console.log(`✅ Notificação ativada para: ${notification.title}`);
    } else {
      await cancelNotificationById(id);
      console.log(`❌ Notificação desativada para: ${notification.title}`);
    }
  };

  // Funções para gerenciar novos lembretes
  const resetNewReminderModal = () => {
    setNewReminderTitle('');
    setNewReminderTime('');
    setNewReminderType('meal');
    setNewReminderDays([]);
    setShowNewReminderModal(false);
  };

  const toggleReminderDay = (dayIndex: number) => {
    setNewReminderDays(prev => 
      prev.includes(dayIndex) 
        ? prev.filter(day => day !== dayIndex)
        : [...prev, dayIndex].sort()
    );
  };

  const createNewReminder = async () => {
    if (!newReminderTitle.trim() || !newReminderTime.trim() || newReminderDays.length === 0) {
      Alert.alert('Erro', 'Preencha todos os campos e selecione pelo menos um dia da semana.');
      return;
    }

    const newReminder: Notification = {
      id: Date.now().toString(),
      type: newReminderType,
      title: newReminderTitle.trim(),
      time: newReminderTime.trim(),
      enabled: true,
      days: newReminderDays
    };

    setNotifications(prev => [...prev, newReminder]);
    
    // Agendar notificação
    await scheduleNotification(newReminder);
    
    resetNewReminderModal();
    Alert.alert('Sucesso', 'Lembrete criado e notificação agendada com sucesso!');
  };

  const deleteNotification = (id: string) => {
    Alert.alert(
      'Confirmar Exclusão',
      'Tem certeza que deseja excluir este lembrete?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Excluir', 
          style: 'destructive',
          onPress: () => {
            cancelNotificationById(id); // Cancelar notificação agendada
            setNotifications(prev => prev.filter(notif => notif.id !== id));
          }
        }
      ]
    );
  };

  // Função para solicitar permissões de notificação
  const requestNotificationPermissions = async () => {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      Alert.alert(
        'Permissões necessárias',
        'As notificações são necessárias para enviar lembretes. Você pode ativar nas configurações do dispositivo.',
        [{ text: 'OK' }]
      );
      return false;
    }

    return true;
  };

  // Função para agendar uma notificação
  const scheduleNotification = async (notification: Notification) => {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return;

    try {
      // Cancelar notificações existentes para este lembrete
      await cancelNotificationById(notification.id);

      const [hours, minutes] = notification.time.split(':').map(Number);
      
      // Agendar para cada dia da semana selecionado
      for (const dayOfWeek of notification.days) {
        const trigger = {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          hour: hours,
          minute: minutes,
          weekday: dayOfWeek === 0 ? 7 : dayOfWeek, // Expo usa 1-7 (seg-dom), nós usamos 0-6 (dom-sáb)
          repeats: true,
        };

        const notificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: notification.type === 'workout' ? '🏋️ Hora do Treino!' : '🍽️ Hora da Refeição!',
            body: notification.title,
            sound: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
          },
          trigger,
          identifier: `${notification.id}_${dayOfWeek}`, // ID único para cada dia
        });

        console.log(`📅 Notificação agendada: ${notificationId} para ${notification.title} às ${notification.time} no dia ${dayOfWeek}`);
      }
    } catch (error) {
      console.error('Erro ao agendar notificação:', error);
      Alert.alert('Erro', 'Não foi possível agendar o lembrete. Tente novamente.');
    }
  };

  // Função para cancelar notificações por ID do lembrete
  const cancelNotificationById = async (reminderId: string) => {
    try {
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      
      // Encontrar e cancelar todas as notificações relacionadas a este lembrete
      const notificationsToCancel = scheduledNotifications.filter(scheduled => 
        scheduled.identifier.startsWith(reminderId)
      );

      for (const notif of notificationsToCancel) {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
        console.log(`❌ Notificação cancelada: ${notif.identifier}`);
      }
    } catch (error) {
      console.error('Erro ao cancelar notificações:', error);
    }
  };

  // Função para reagendar todas as notificações ativas
  const rescheduleAllNotifications = async () => {
    try {
      // Cancelar todas as notificações agendadas
      await Notifications.cancelAllScheduledNotificationsAsync();
      
      // Reagendar apenas notificações ativas
      const activeNotifications = notifications.filter(notif => notif.enabled);
      for (const notification of activeNotifications) {
        await scheduleNotification(notification);
      }
      
      console.log(`🔄 ${activeNotifications.length} notificações reagendadas`);
    } catch (error) {
      console.error('Erro ao reagendar notificações:', error);
    }
  };

  const deleteExercise = (workoutId: string, exerciseId: string) => {
    const updatedPlans = workoutPlans.map(plan => {
      if (plan.id === workoutId) {
        const newWeeklyExercises = { ...plan.weeklyExercises };
        newWeeklyExercises[selectedWorkoutDay] = newWeeklyExercises[selectedWorkoutDay].filter(ex => ex.id !== exerciseId);
        return { ...plan, weeklyExercises: newWeeklyExercises };
      }
      return plan;
    });
    setWorkoutPlans(updatedPlans);
  };

  const saveEditedExercise = () => {
    if (!editingExercise || !editingWorkoutId) return;
    
    // Validação básica
    if (!editExerciseName.trim()) {
      alert('Nome do exercício é obrigatório');
      return;
    }
    
    if (!editExerciseSets || parseInt(editExerciseSets) <= 0) {
      alert('Número de séries deve ser maior que 0');
      return;
    }
    
    if (!editExerciseReps.trim()) {
      alert('Repetições são obrigatórias');
      return;
    }

    const updatedExercise: Exercise = {
      ...editingExercise,
      name: editExerciseName.trim(),
      sets: parseInt(editExerciseSets),
      reps: editExerciseReps.trim(),
      weight: editExerciseWeight ? parseFloat(editExerciseWeight) : undefined,
      restTime: editExerciseRestTime ? parseInt(editExerciseRestTime) : undefined
    };

    const updatedPlans = workoutPlans.map(plan => {
      if (plan.id === editingWorkoutId) {
        const newWeeklyExercises = { ...plan.weeklyExercises };
        newWeeklyExercises[selectedWorkoutDay] = newWeeklyExercises[selectedWorkoutDay].map(ex => 
          ex.id === editingExercise.id ? updatedExercise : ex
        );
        return { ...plan, weeklyExercises: newWeeklyExercises };
      }
      return plan;
    });

    setWorkoutPlans(updatedPlans);
    
    // Limpar estados de edição
    setEditingExercise(null);
    setEditingWorkoutId('');
    setEditExerciseName('');
    setEditExerciseSets('');
    setEditExerciseReps('');
    setEditExerciseWeight('');
    setEditExerciseRestTime('');
    setShowModal(false);
    
    alert('Exercício atualizado com sucesso!');
  };

  // Função para iniciar edição de treino
  const startEditWorkout = (workout: WorkoutPlan) => {
    setEditingWorkout(workout);
    setEditingWorkoutName(workout.name);
    setIsEditingWorkout(true);
    setModalType('editWorkout');
    setShowModal(true);
    
    // Inicializar dias selecionados com os dias que já têm exercícios
    const daysWithExercises = (['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'] as DayOfWeek[])
      .filter(day => workout.weeklyExercises[day] && workout.weeklyExercises[day].length > 0);
    
    if (daysWithExercises.length > 0) {
      setSelectedDaysForEdit(daysWithExercises);
    } else {
      setSelectedDaysForEdit([getCurrentDayOfWeek()]);
    }
  };

  // Função para salvar edições do treino
  const saveEditedWorkout = async () => {
    if (!editingWorkout || !editingWorkoutName.trim()) {
      alert('Nome do treino é obrigatório');
      return;
    }

    const updatedWorkout = {
      ...editingWorkout, 
      name: editingWorkoutName,
      weeklyExercises: editingWorkout.weeklyExercises
    };

    // Atualizar estado local
    const updatedPlans = workoutPlans.map(plan => 
      plan.id === editingWorkout.id ? updatedWorkout : plan
    );
    
    setWorkoutPlans(updatedPlans);

    // Salvar no Firebase
    try {
      await saveDataToFirebase('workoutPlans', editingWorkout.id, updatedWorkout);
      console.log('✅ Treino salvo no Firebase:', updatedWorkout.name);
    } catch (error) {
      console.error('❌ Erro ao salvar treino no Firebase:', error);
      // Fallback para AsyncStorage
      saveData(STORAGE_KEYS.WORKOUT_PLANS, updatedPlans);
    }

    setShowModal(false);
    setModalType('');
    setEditingWorkout(null);
    setEditingWorkoutName('');
    setIsEditingWorkout(false);
  };

  // Função para cancelar edição do treino
  const cancelEditWorkout = () => {
    setEditingWorkout(null);
    setEditingWorkoutName('');
    setIsEditingWorkout(false);
    setShowModal(false);
    setModalType('');
  };

  // Função para iniciar edição de dieta
  const startEditDiet = (diet: DietPlan) => {
    setCurrentEditDiet(diet);
    setIsEditingDiet(true);
    setShowEditDietModal(true);
  };

  // Função para salvar edições da dieta
  const saveEditedDiet = async () => {
    if (!currentEditDiet) {
      alert('Erro: nenhuma dieta para editar');
      return;
    }

    // Atualizar estado local
    const safeDietPlans = dietPlans || [];
    const updatedPlans = safeDietPlans.map(plan => 
      plan.id === currentEditDiet.id ? currentEditDiet : plan
    );
    
    setDietPlans(updatedPlans);

    // Salvar no Firebase
    try {
      await saveDataToFirebase('dietPlans', currentEditDiet.id, currentEditDiet);
      console.log('✅ Dieta salva no Firebase:', currentEditDiet.name);
    } catch (error) {
      console.error('❌ Erro ao salvar dieta no Firebase:', error);
      // Fallback para AsyncStorage
      saveData(STORAGE_KEYS.DIET_PLANS, updatedPlans);
    }

    setShowEditDietModal(false);
    setCurrentEditDiet(null);
    setIsEditingDiet(false);
  };

  // Função para cancelar edição da dieta
  const cancelEditDiet = () => {
    setCurrentEditDiet(null);
    setIsEditingDiet(false);
    setShowEditDietModal(false);
  };

  const deleteWorkoutPlan = async (planId: string) => {
    try {
      // Remover do estado local
      setWorkoutPlans(prev => prev.filter(plan => plan.id !== planId));
      
      // Remover do Firebase
      console.log(`🗑️ Removendo treino ${planId} do Firebase...`);
      await deleteDataFromFirebase('planos_treino', planId);
      console.log(`✅ Treino ${planId} removido com sucesso do Firebase`);
    } catch (error) {
      console.error(`❌ Erro ao remover treino ${planId} do Firebase:`, error);
      // Em caso de erro, recarregar os dados para manter sincronização
      const savedWorkouts = await loadData(STORAGE_KEYS.WORKOUT_PLANS);
      if (savedWorkouts) {
        setWorkoutPlans(savedWorkouts);
      }
    }
  };

  const deleteDietPlan = async (planId: string) => {
    try {
      console.log(`🗑️ Iniciando remoção da dieta ${planId}...`);
      console.log('📋 Dietas antes da remoção:', (dietPlans || []).map(d => ({ id: d.id, name: d.name })));
      
      // Remover do estado local
      const dietasAntes = (dietPlans || []).length;
      setDietPlans(prev => {
        const novaLista = prev.filter(plan => plan.id !== planId);
        console.log(`📝 Estado local atualizado: ${dietasAntes} -> ${novaLista.length} dietas`);
        return novaLista;
      });
      
      // Remover do Firebase
      console.log(`🗑️ Removendo dieta ${planId} do Firebase...`);
      await deleteDataFromFirebase('dietPlans', planId);
      console.log(`✅ Dieta ${planId} removida com sucesso do Firebase`);
      
    } catch (error) {
      console.error(`❌ Erro ao remover dieta ${planId} do Firebase:`, error);
      // Em caso de erro, recarregar os dados para manter sincronização
      const savedDiets = await loadData(STORAGE_KEYS.DIET_PLANS);
      if (savedDiets) {
        console.log('🔄 Recarregando dietas do Firebase após erro:', savedDiets.length);
        setDietPlans(savedDiets);
      }
    }
  };

  const createNewExercise = () => {
    if (selectedWorkoutForNewExercise && newExercise.name.trim()) {
      const exercise: Exercise = {
        id: Date.now().toString(),
        name: newExercise.name.trim(),
        sets: newExercise.sets,
        reps: newExercise.reps.toString(),
        muscle: newExercise.muscle,
        weight: newExercise.weight,
        category: newExercise.category,
        restTime: newExercise.restTime,
        completed: false,
        instructions: ['Instruções serão adicionadas em breve'],
        musclesWorked: ['Músculos principais'],
        tips: ['Dicas serão adicionadas em breve'],
        difficulty: 'Intermediário',
        equipment: ['Equipamento padrão']
      };

      const updatedPlans = workoutPlans.map(plan => {
        if (plan.id === selectedWorkoutForNewExercise) {
          const newWeeklyExercises = { ...plan.weeklyExercises };
          newWeeklyExercises[selectedWorkoutDay] = [...newWeeklyExercises[selectedWorkoutDay], exercise];
          return { ...plan, weeklyExercises: newWeeklyExercises };
        }
        return plan;
      });

      setWorkoutPlans(updatedPlans);
      
      // Reset form
      setNewExercise({
        name: '',
        sets: 3,
        reps: 10,
        weight: 0,
        muscle: 'Peito',
        category: 'Peito',
        restTime: 60
      });
      setSelectedWorkoutForNewExercise(null);
      setShowModal(false);
    }
  };

  const categories = ['Peito', 'Costas', 'Pernas', 'Ombros', 'Bíceps', 'Tríceps', 'Abdômen', 'Cardio'];

  const getDayName = (dayIndex: number) => {
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    return days[dayIndex];
  };

  const renderConfiguracoesScreen = () => {
    const activeNotifications = notifications.filter(notif => notif.enabled).length;
    const totalNotifications = notifications.length;

    return (
      <View style={styles.container}>
        {/* Header Moderno */}
        <LinearGradient
          colors={['#607D8B', '#455a64']}
          style={styles.settingsHeader}
        >
          <View style={styles.settingsHeaderTop}>
            <TouchableOpacity
              style={styles.settingsBackButton}
              onPress={() => setCurrentScreen('menu')}
            >
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            <Text style={styles.settingsHeaderTitle}>Lembretes & Configurações</Text>
            <TouchableOpacity
              style={styles.settingsHeaderAction}
              onPress={() => setShowNewReminderModal(true)}
            >
              <Ionicons name="add" size={20} color="white" />
            </TouchableOpacity>
          </View>

          {/* Estatísticas Rápidas */}
          <View style={styles.settingsQuickStats}>
            <View style={styles.settingsQuickStat}>
              <Text style={styles.settingsQuickStatValue}>{totalNotifications?.toString()}</Text>
              <Text style={styles.settingsQuickStatLabel}>Total</Text>
            </View>
            <View style={styles.settingsQuickStat}>
              <Text style={styles.settingsQuickStatValue}>{activeNotifications?.toString()}</Text>
              <Text style={styles.settingsQuickStatLabel}>Ativos</Text>
            </View>
            <View style={styles.settingsQuickStat}>
              <Text style={styles.settingsQuickStatValue}>{(totalNotifications - activeNotifications)?.toString()}</Text>
              <Text style={styles.settingsQuickStatLabel}>Inativos</Text>
            </View>
          </View>
        </LinearGradient>

        <ScrollView style={styles.settingsContent} showsVerticalScrollIndicator={false}>
          {/* Seção de Notificações */}
          <View style={styles.modernNotificationsSection}>
            <Text style={styles.modernSectionTitle}>Lembretes Configurados</Text>
            
            {notifications.length === 0 ? (
              <View style={styles.settingsEmptyState}>
                <LinearGradient
                  colors={['#667eea', '#764ba2']}
                  style={styles.settingsEmptyCard}
                >
                  <Ionicons name="notifications-off" size={60} color="white" />
                  <Text style={styles.settingsEmptyTitle}>Nenhum lembrete criado</Text>
                  <Text style={styles.settingsEmptySubtitle}>
                    Configure lembretes para manter sua rotina de treinos e alimentação
                  </Text>
                  <TouchableOpacity
                    style={styles.settingsEmptyButton}
                    onPress={() => setShowNewReminderModal(true)}
                  >
                    <Ionicons name="add" size={16} color="white" />
                    <Text style={styles.settingsEmptyButtonText}>Criar Primeiro Lembrete</Text>
                  </TouchableOpacity>
                </LinearGradient>
              </View>
            ) : (
              <View style={styles.modernNotificationsList}>
                {Array.isArray(notifications) && notifications.map((notif, index) => {
                  const notificationGradients: [string, string][] = [
                    ['#4CAF50', '#45a049'],
                    ['#FF9800', '#f57c00'],
                    ['#2196F3', '#1976d2'],
                    ['#E91E63', '#c2185b'],
                    ['#9C27B0', '#7b1fa2'],
                    ['#607D8B', '#455a64']
                  ];

                  return (
                    <View key={notif.id} style={styles.modernNotificationCard}>
                      <LinearGradient
                        colors={notif.enabled ? 
                          notificationGradients[index % notificationGradients.length] :
                          ['#e0e0e0', '#bdbdbd']
                        }
                        style={styles.modernNotificationGradient}
                      >
                        <View style={styles.modernNotificationHeader}>
                          <View style={styles.modernNotificationInfo}>
                            <Text style={[
                              styles.modernNotificationTitle,
                              !notif.enabled && styles.modernNotificationTitleDisabled
                            ]}>{notif.title}</Text>
                            <View style={styles.modernNotificationTimeContainer}>
                              <Ionicons name="time" size={14} color={notif.enabled ? "rgba(255,255,255,0.8)" : "#999"} />
                              <Text style={[
                                styles.modernNotificationTime,
                                !notif.enabled && styles.modernNotificationTimeDisabled
                              ]}>{notif.time}</Text>
                            </View>
                          </View>
                          
                          <View style={styles.modernNotificationActions}>
                            <TouchableOpacity
                              style={[
                                styles.modernNotificationToggle,
                                notif.enabled && styles.modernNotificationToggleActive
                              ]}
                              onPress={() => toggleNotification(notif.id)}
                            >
                              <Ionicons 
                                name={notif.enabled ? "checkmark" : "close"} 
                                size={16} 
                                color={notif.enabled ? "white" : "#999"} 
                              />
                            </TouchableOpacity>
                            
                            <TouchableOpacity
                              style={styles.modernDeleteNotificationButton}
                              onPress={() => deleteNotification(notif.id)}
                            >
                              <Ionicons name="trash-outline" size={16} color={notif.enabled ? "white" : "#999"} />
                            </TouchableOpacity>
                          </View>
                        </View>

                        <View style={styles.modernNotificationDetails}>
                          <View style={styles.modernNotificationDays}>
                            {Array.isArray(notif.days) && notif.days.map(day => (
                              <View key={day} style={[
                                styles.modernDayTag,
                                !notif.enabled && styles.modernDayTagDisabled
                              ]}>
                                <Text style={[
                                  styles.modernDayTagText,
                                  !notif.enabled && styles.modernDayTagTextDisabled
                                ]}>
                                  {getDayName(day)}
                                </Text>
                              </View>
                            ))}
                          </View>
                          
                          <View style={[
                            styles.modernNotificationTypeBadge,
                            {
                              backgroundColor: notif.enabled 
                                ? (notif.type === 'workout' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.2)')
                                : 'rgba(0,0,0,0.1)'
                            }
                          ]}>
                            <Ionicons 
                              name={notif.type === 'workout' ? "barbell" : "restaurant"} 
                              size={14} 
                              color={notif.enabled ? "white" : "#999"} 
                            />
                            <Text style={[
                              styles.modernNotificationTypeText,
                              !notif.enabled && styles.modernNotificationTypeTextDisabled
                            ]}>
                              {notif.type === 'workout' ? 'Treino' : 'Refeição'}
                            </Text>
                          </View>
                        </View>
                      </LinearGradient>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Botão de Criar Lembrete */}
          <View style={styles.modernCreateReminderSection}>
            <TouchableOpacity 
              style={styles.modernCreateReminderButton}
              onPress={() => setShowNewReminderModal(true)}
            >
              <LinearGradient
                colors={['#4CAF50', '#45a049']}
                style={styles.modernCreateReminderGradient}
              >
                <Ionicons name="add-circle" size={24} color="white" />
                <Text style={styles.modernCreateReminderButtonText}>Criar Novo Lembrete</Text>
              </LinearGradient>
            </TouchableOpacity>
            
            {/* Botão de Teste - Remover em produção */}
            <TouchableOpacity 
              style={[styles.modernCreateReminderButton, { marginTop: 10 }]}
              onPress={createTestNotification}
            >
              <LinearGradient
                colors={['#FF5722', '#e64a19']}
                style={styles.modernCreateReminderGradient}
              >
                <Ionicons name="notifications" size={24} color="white" />
                <Text style={styles.modernCreateReminderButtonText}>Teste Notificação (1min)</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Card de Dicas */}
          <View style={styles.modernHelpCard}>
            <LinearGradient
              colors={['#FF9800', '#f57c00']}
              style={styles.modernHelpGradient}
            >
              <View style={styles.modernHelpHeader}>
                <Ionicons name="bulb" size={24} color="white" />
                <Text style={styles.modernHelpTitle}>Dicas para Sucesso</Text>
              </View>
              <View style={styles.modernHelpContent}>
                <View style={styles.modernHelpItem}>
                  <Ionicons name="checkmark-circle" size={16} color="white" />
                  <Text style={styles.modernHelpText}>
                    Os lembretes ajudam a manter a consistência nos treinos
                  </Text>
                </View>
                <View style={styles.modernHelpItem}>
                  <Ionicons name="checkmark-circle" size={16} color="white" />
                  <Text style={styles.modernHelpText}>
                    Configure horários que funcionem melhor para sua rotina
                  </Text>
                </View>
                <View style={styles.modernHelpItem}>
                  <Ionicons name="checkmark-circle" size={16} color="white" />
                  <Text style={styles.modernHelpText}>
                    Lembretes ativos aparecerão nas notificações do dispositivo
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </View>
          
          <View style={styles.bottomPadding} />
        </ScrollView>
      </View>
    );
  };

  const renderMainMenu = () => (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header Moderno com Gradiente */}
      <LinearGradient
        colors={['#1a1a2e', '#16213e', '#0f3460']}
        style={styles.modernHeader}
      >
        <View style={styles.headerContent}>
          <View style={styles.userGreeting}>
            <View style={styles.avatarContainer}>
              <LinearGradient
                colors={['#00ff7f', '#00d4aa']}
                style={styles.avatarGradient}
              >
                {userStats.profileImage ? (
                  <Image 
                    source={{ uri: userStats.profileImage }} 
                    style={styles.headerProfileImage}
                  />
                ) : (
                  <Ionicons name="person" size={24} color="white" />
                )}
              </LinearGradient>
            </View>
            <View style={styles.greetingText}>
              <Text style={styles.greetingMain}>Olá! 👋</Text>
              <Text style={styles.greetingTitle}>Bem-vindo, {userStats.name || 'Usuário'}!</Text>
              <Text style={styles.greetingSubtitle}>Pronto para treinar hoje?</Text>
            </View>
          </View>
          
          <TouchableOpacity 
            style={styles.notificationButton}
            onPress={() => setShowHealthTipsModal(true)}
          >
            <Ionicons name="notifications-outline" size={24} color="white" />
            {getUnreadTipsCount() > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>{getUnreadTipsCount()}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Quick Stats Cards */}
      <View style={styles.quickStatsContainer}>
        <LinearGradient
          colors={['#4CAF50', '#45a049']}
          style={styles.quickStatCard}
        >
          <Ionicons name="scale-outline" size={28} color="white" />
          <Text style={styles.quickStatValue}>{userStats.weight?.toString()}kg</Text>
          <Text style={styles.quickStatLabel}>Peso Atual</Text>
        </LinearGradient>
        
        <LinearGradient
          colors={['#FF6B6B', '#ee5a52']}
          style={styles.quickStatCard}
        >
          <Ionicons name="flame-outline" size={28} color="white" />
          <Text style={styles.quickStatValue}>1,250</Text>
          <Text style={styles.quickStatLabel}>Calorias</Text>
        </LinearGradient>
        
        <LinearGradient
          colors={['#4ECDC4', '#44a08d']}
          style={styles.quickStatCard}
        >
          <Ionicons name="timer-outline" size={28} color="white" />
          <Text style={styles.quickStatValue}>45min</Text>
          <Text style={styles.quickStatLabel}>Último Treino</Text>
        </LinearGradient>
      </View>

      {/* Treino de Hoje */}
      <View style={styles.todayWorkoutContainer}>
        <Text style={styles.sectionTitle}>Treino de Hoje</Text>
        <TouchableOpacity
          onPress={() => {
            // Determinar o treino do dia baseado no dia da semana
            const today = new Date();
            const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
            const dayNames: DayOfWeek[] = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
            const currentDay = dayNames[dayOfWeek];
            
            // Definir selectedWorkoutDay para hoje
            setSelectedWorkoutDay(currentDay);
            
            // Se houver treinos, encontrar o treino do dia atual
            let todayWorkout = null;
            for (const plan of workoutPlans) {
              const dayWorkouts = plan.weeklyExercises[currentDay];
              if (dayWorkouts && dayWorkouts.length > 0) {
                todayWorkout = { plan, dayWorkouts };
                break;
              }
            }
            
            if (todayWorkout) {
              // Se há treino para hoje, ir direto para a tela de treino
              setCurrentScreen('treino');
            } else {
              // Se não há treino para hoje, ir para a tela de treino para que o usuário possa criar um
              Alert.alert(
                'Nenhum treino programado',
                `Não há treinos programados para ${currentDay}. Deseja criar um novo treino?`,
                [
                  { text: 'Cancelar', style: 'cancel' },
                  { 
                    text: 'Criar Treino', 
                    onPress: () => setCurrentScreen('treino')
                  }
                ]
              );
            }
          }}
        >
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            style={styles.todayWorkoutCard}
          >
            <View style={styles.todayWorkoutHeader}>
              <View>
                <Text style={styles.todayWorkoutTitle}>{getTodayWorkoutTitle(workoutPlans, getCurrentDayOfWeek())}</Text>
                <Text style={styles.todayWorkoutSubtitle}>{getTodayWorkoutSubtitle(workoutPlans, getCurrentDayOfWeek())}</Text>
              </View>
              <Ionicons name="play-circle" size={40} color="white" />
            </View>
            <View style={styles.todayWorkoutProgress}>
              <Text style={styles.todayWorkoutProgressText}>Progresso: {getTodayWorkoutProgress(workoutPlans, getCurrentDayOfWeek())}%</Text>
              <View style={styles.progressBarContainer}>
                <View style={[styles.modernProgressBar, { width: `${getTodayWorkoutProgress(workoutPlans, getCurrentDayOfWeek())}%` }]} />
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Estatísticas Detalhadas */}
      <View style={styles.detailedStatsContainer}>
        <Text style={styles.sectionTitle}>Suas Estatísticas</Text>
        <View style={styles.detailedStatsGrid}>
          <View style={styles.detailedStatCard}>
            <View style={styles.modernStatIconContainer}>
              <LinearGradient
                colors={['#FF9800', '#ff8f00']}
                style={styles.statIconGradient}
              >
                <Ionicons name="fitness-outline" size={20} color="white" />
              </LinearGradient>
            </View>
            <Text style={styles.detailedStatValue}>{userStats.bodyFat}%</Text>
            <Text style={styles.detailedStatLabel}>Gordura Corporal</Text>
          </View>
          
          <View style={styles.detailedStatCard}>
            <View style={styles.modernStatIconContainer}>
              <LinearGradient
                colors={['#2196F3', '#1976d2']}
                style={styles.statIconGradient}
              >
                <Ionicons name="barbell-outline" size={20} color="white" />
              </LinearGradient>
            </View>
            <Text style={styles.detailedStatValue}>{userStats.muscle}%</Text>
            <Text style={styles.detailedStatLabel}>Massa Muscular</Text>
          </View>
          
          <View style={styles.detailedStatCard}>
            <View style={styles.modernStatIconContainer}>
              <LinearGradient
                colors={['#9C27B0', '#7b1fa2']}
                style={styles.statIconGradient}
              >
                <Ionicons name="trophy-outline" size={20} color="white" />
              </LinearGradient>
            </View>
            <Text style={styles.detailedStatValue}>{goals.length?.toString()}</Text>
            <Text style={styles.detailedStatLabel}>Metas Ativas</Text>
          </View>
          
          <View style={styles.detailedStatCard}>
            <View style={styles.modernStatIconContainer}>
              <LinearGradient
                colors={['#4CAF50', '#388e3c']}
                style={styles.statIconGradient}
              >
                <Ionicons name="trending-up-outline" size={20} color="white" />
              </LinearGradient>
            </View>
            <Text style={styles.detailedStatValue}>12</Text>
            <Text style={styles.detailedStatLabel}>Treinos Este Mês</Text>
          </View>
        </View>
      </View>

      {/* Menu Principal Modernizado */}
      <View style={styles.mainMenuContainer}>
        <Text style={styles.sectionTitle}>Explorar</Text>
        <View style={styles.modernMenuGrid}>
          <TouchableOpacity
            style={styles.modernMenuCard}
            onPress={() => setCurrentScreen('treino')}
          >
            <LinearGradient
              colors={['#4CAF50', '#45a049']}
              style={styles.modernMenuCardGradient}
            >
              <Ionicons name="barbell" size={32} color="white" />
              <Text style={styles.modernMenuCardTitle}>Treinos</Text>
              <Text style={styles.modernMenuCardSubtitle}>{workoutPlans.length?.toString()} planos disponíveis</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.modernMenuCard}
            onPress={() => setCurrentScreen('dieta')}
          >
            <LinearGradient
              colors={['#FF9800', '#f57c00']}
              style={styles.modernMenuCardGradient}
            >
              <Ionicons name="restaurant" size={32} color="white" />
              <Text style={styles.modernMenuCardTitle}>Nutrição</Text>
              <Text style={styles.modernMenuCardSubtitle}>{(dietPlans || []).length?.toString()} planos personalizados</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.modernMenuCard}
            onPress={() => setCurrentScreen('progresso')}
          >
            <LinearGradient
              colors={['#2196F3', '#1976d2']}
              style={styles.modernMenuCardGradient}
            >
              <Ionicons name="analytics" size={32} color="white" />
              <Text style={styles.modernMenuCardTitle}>Progresso</Text>
              <Text style={styles.modernMenuCardSubtitle}>Acompanhe sua evolução</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.modernMenuCard}
            onPress={() => setCurrentScreen('metas')}
          >
            <LinearGradient
              colors={['#9C27B0', '#7b1fa2']}
              style={styles.modernMenuCardGradient}
            >
              <Ionicons name="trophy" size={32} color="white" />
              <Text style={styles.modernMenuCardTitle}>Metas</Text>
              <Text style={styles.modernMenuCardSubtitle}>{goals.length?.toString()} objetivos ativos</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.modernMenuCard}
            onPress={() => setCurrentScreen('perfil')}
          >
            <LinearGradient
              colors={['#607D8B', '#455a64']}
              style={styles.modernMenuCardGradient}
            >
              <Ionicons name="person" size={32} color="white" />
              <Text style={styles.modernMenuCardTitle}>Perfil</Text>
              <Text style={styles.modernMenuCardSubtitle}>Suas configurações</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.modernMenuCard}
            onPress={() => setCurrentScreen('configuracoes')}
          >
            <LinearGradient
              colors={['#795548', '#5d4037']}
              style={styles.modernMenuCardGradient}
            >
              <Ionicons name="settings" size={32} color="white" />
              <Text style={styles.modernMenuCardTitle}>Configurações</Text>
              <Text style={styles.modernMenuCardSubtitle}>Lembretes e mais</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Padding bottom para scroll */}
      <View style={styles.bottomPadding} />
    </ScrollView>
  );

  const renderCurrentScreen = () => {
    switch (currentScreen) {
      case 'menu':
        return renderMainMenu();
      case 'treino':
        return renderTreinoScreen();
      case 'dieta':
        return renderDietaScreen();
      case 'progresso':
        return renderProgressoScreen();
      case 'metas':
        return renderMetasScreen();
      case 'perfil':
        return renderPerfilScreen();
      case 'configuracoes':
        return renderConfiguracoesScreen();
      default:
        return renderMainMenu();
    }
  };

  const renderTreinoScreen = () => {
    const todayWorkouts = workoutPlans.reduce((total, plan) => {
      return total + (plan.weeklyExercises[selectedWorkoutDay]?.length || 0);
    }, 0);

    const completedWorkouts = workoutPlans.reduce((total, plan) => {
      const dayExercises = plan.weeklyExercises[selectedWorkoutDay] || [];
      return total + dayExercises.filter(ex => ex.completed).length;
    }, 0);

    const workoutProgress = todayWorkouts > 0 ? (completedWorkouts / todayWorkouts) * 100 : 0;

    return (
      <View style={styles.container}>
        {/* Header Moderno */}
        <LinearGradient
          colors={['#4CAF50', '#45a049']}
          style={styles.workoutHeader}
        >
          <View style={styles.workoutHeaderTop}>
            <TouchableOpacity
              style={styles.workoutBackButton}
              onPress={() => setCurrentScreen('menu')}
            >
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            <Text style={styles.workoutHeaderTitle}>Meus Treinos</Text>
            <View style={styles.workoutHeaderActions}>
              <TouchableOpacity
                style={styles.workoutHeaderAction}
                onPress={() => {
                  console.log('🔥 Abrindo treinos prontos...');
                  setShowPresetWorkouts(true);
                }}
              >
                <Ionicons name="flash" size={20} color="white" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.workoutHeaderAction}
                onPress={() => {
                  setModalType('createWorkout');
                  setShowModal(true);
                }}
              >
                <Ionicons name="add" size={20} color="white" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Estatísticas Rápidas */}
          <View style={styles.workoutQuickStats}>
            <View style={styles.workoutQuickStat}>
              <Text style={styles.workoutQuickStatValue}>{workoutPlans.length?.toString()}</Text>
              <Text style={styles.workoutQuickStatLabel}>Planos</Text>
            </View>
            <View style={styles.workoutQuickStat}>
              <Text style={styles.workoutQuickStatValue}>{todayWorkouts?.toString()}</Text>
              <Text style={styles.workoutQuickStatLabel}>Exercícios Hoje</Text>
            </View>
            <View style={styles.workoutQuickStat}>
              <Text style={styles.workoutQuickStatValue}>{Math.round(workoutProgress)?.toString()}%</Text>
              <Text style={styles.workoutQuickStatLabel}>Progresso</Text>
            </View>
          </View>
        </LinearGradient>

        <ScrollView style={styles.workoutContent} showsVerticalScrollIndicator={false}>
          {/* Seletor de Dias Modernizado */}
          <View style={styles.modernDaySelector}>
            <Text style={styles.modernDaySelectorTitle}>Selecione o dia da semana:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modernDayScrollView}>
              {(['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'] as DayOfWeek[]).map((day) => (
                <TouchableOpacity
                  key={day}
                  style={[
                    styles.modernDayButton,
                    selectedWorkoutDay === day && styles.modernDayButtonActive
                  ]}
                  onPress={() => setSelectedWorkoutDay(day)}
                >
                  <Text style={[
                    styles.modernDayButtonText,
                    selectedWorkoutDay === day && styles.modernDayButtonTextActive
                  ]}>
                    {day.charAt(0).toUpperCase() + day.slice(1)}
                  </Text>
                  <View style={[
                    styles.modernDayIndicator,
                    selectedWorkoutDay === day && styles.modernDayIndicatorActive
                  ]} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Treino Ativo (se houver) */}
          {activeWorkout && (
            <View style={styles.activeWorkoutContainer}>
              <LinearGradient
                colors={['#FF6B6B', '#ee5a52']}
                style={styles.activeWorkoutCard}
              >
                <View style={styles.activeWorkoutHeader}>
                  <View style={styles.activeWorkoutInfo}>
                    <Text style={styles.activeWorkoutTitle}>🔥 Treino em Andamento</Text>
                    <Text style={styles.activeWorkoutSubtitle}>
                      {workoutPlans.find(p => p.id === activeWorkout)?.name || 'Treino Ativo'}
                    </Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.activeWorkoutStopButton}
                    onPress={finishWorkout}
                  >
                    <Ionicons name="stop" size={20} color="white" />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.activeWorkoutStats}>
                  <View style={styles.activeWorkoutStat}>
                    <Ionicons name="time" size={16} color="white" />
                    <Text style={styles.activeWorkoutStatText}>{formatTime(timer)}</Text>
                  </View>
                  {restTimer > 0 && (
                    <View style={styles.activeWorkoutStat}>
                      <Ionicons name="pause" size={16} color="white" />
                      <Text style={styles.activeWorkoutStatText}>Descanso: {formatTime(restTimer)}</Text>
                    </View>
                  )}
                  <View style={styles.activeWorkoutStat}>
                    <Ionicons name="checkmark-circle" size={16} color="white" />
                    <Text style={styles.activeWorkoutStatText}>{completedWorkouts?.toString()}/{todayWorkouts?.toString()}</Text>
                  </View>
                </View>

                <View style={styles.activeWorkoutProgress}>
                  <View style={styles.activeWorkoutProgressBar}>
                    <View 
                      style={[
                        styles.activeWorkoutProgressFill,
                        { width: `${workoutProgress}%` }
                      ]} 
                    />
                  </View>
                  <Text style={styles.activeWorkoutProgressText}>{Math.round(workoutProgress)?.toString()}% Concluído</Text>
                </View>
              </LinearGradient>
            </View>
          )}

          {/* Cards de Treinos */}
          <View style={styles.workoutPlansContainer}>
            {workoutPlans.length === 0 ? (
              <View style={styles.workoutEmptyState}>
                <LinearGradient
                  colors={['#667eea', '#764ba2']}
                  style={styles.workoutEmptyCard}
                >
                  <Ionicons name="fitness" size={60} color="white" />
                  <Text style={styles.workoutEmptyTitle}>Nenhum treino criado</Text>
                  <Text style={styles.workoutEmptySubtitle}>
                    Comece criando seu primeiro plano de treino ou escolha um treino pronto
                  </Text>
                  <View style={styles.workoutEmptyActions}>
                    <TouchableOpacity
                      style={styles.workoutEmptyButton}
                      onPress={() => {
                        console.log('💪 Abrindo treinos prontos da tela vazia...');
                        setShowPresetWorkouts(true);
                      }}
                    >
                      <Ionicons name="flash" size={16} color="white" />
                      <Text style={styles.workoutEmptyButtonText}>Treinos Prontos</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.workoutEmptyButton, styles.workoutEmptyButtonSecondary]}
                      onPress={() => {
                        setModalType('createWorkout');
                        setShowModal(true);
                      }}
                    >
                      <Ionicons name="add" size={16} color="white" />
                      <Text style={styles.workoutEmptyButtonText}>Criar Treino</Text>
                    </TouchableOpacity>
                  </View>
                </LinearGradient>
              </View>
            ) : (
              workoutPlans.map((plan, index) => {
                const dayExercises = Array.isArray(plan?.weeklyExercises?.[selectedWorkoutDay]) 
                  ? plan.weeklyExercises[selectedWorkoutDay] 
                  : [];
                const planProgress = dayExercises.length > 0 ? 
                  (dayExercises.filter(ex => ex.completed).length / dayExercises.length) * 100 : 0;
                
                const gradientColors: [string, string][] = [
                  ['#667eea', '#764ba2'],
                  ['#f093fb', '#f5576c'],
                  ['#4facfe', '#00f2fe'],
                  ['#43e97b', '#38f9d7'],
                  ['#fa709a', '#fee140'],
                  ['#a8edea', '#fed6e3']
                ];

                return (
                  <TouchableOpacity 
                    key={plan.id} 
                    style={styles.modernWorkoutCard}
                    onPress={() => startEditWorkout(plan)}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={gradientColors[index % gradientColors.length]}
                      style={styles.modernWorkoutCardGradient}
                    >
                      <View style={styles.modernWorkoutCardHeader}>
                        <View style={styles.modernWorkoutCardInfo}>
                          <Text style={styles.modernWorkoutCardTitle}>{plan.name}</Text>
                          <Text style={styles.modernWorkoutCardSubtitle}>
                            {dayExercises.length?.toString()} exercícios • {getCurrentDayOfWeek() === selectedWorkoutDay ? 'Hoje' : selectedWorkoutDay}
                          </Text>
                        </View>
                        <View style={styles.modernWorkoutCardActions}>
                          <TouchableOpacity 
                            style={styles.modernWorkoutCardAction}
                            onPress={(e) => {
                              e.stopPropagation();
                              startEditWorkout(plan);
                            }}
                          >
                            <Ionicons name="create-outline" size={18} color="white" />
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={styles.modernWorkoutCardAction}
                            onPress={(e) => {
                              e.stopPropagation();
                              deleteWorkoutPlan(plan.id);
                            }}
                          >
                            <Ionicons name="trash-outline" size={18} color="white" />
                          </TouchableOpacity>
                        </View>
                      </View>

                      <View style={styles.modernWorkoutCardProgress}>
                        <View style={styles.modernWorkoutProgressBar}>
                          <View 
                            style={[
                              styles.modernWorkoutProgressFill,
                              { width: `${planProgress}%` }
                            ]} 
                          />
                        </View>
                        <Text style={styles.modernWorkoutProgressText}>
                          {Math.round(planProgress)?.toString()}% concluído
                        </Text>
                      </View>

                      {activeWorkout !== plan.id ? (
                        <TouchableOpacity 
                          style={styles.modernStartWorkoutButton}
                          onPress={() => startWorkout(plan.id)}
                        >
                          <Ionicons name="play" size={18} color="white" />
                          <Text style={styles.modernStartWorkoutText}>Iniciar Treino</Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.modernActiveWorkoutIndicator}>
                          <Ionicons name="fitness" size={18} color="white" />
                          <Text style={styles.modernActiveWorkoutText}>Treino Ativo</Text>
                        </View>
                      )}
                    </LinearGradient>

                    {/* Lista de Exercícios Modernizada */}
                    {dayExercises.length > 0 && (
                      <View style={styles.modernExercisesList}>
                        {Array.isArray(dayExercises) && dayExercises.map((exercise, exerciseIndex) => (
                          <View key={exercise.id} style={styles.modernExerciseCard}>
                            <View style={styles.modernExerciseHeader}>
                              {activeWorkout === plan.id && (
                                <TouchableOpacity 
                                  style={styles.modernExerciseCheckbox}
                                  onPress={() => toggleExerciseComplete(plan.id, exercise.id)}
                                >
                                  <Ionicons 
                                    name={exercise.completed ? "checkmark-circle" : "ellipse-outline"} 
                                    size={24} 
                                    color={exercise.completed ? "#4CAF50" : "#ccc"} 
                                  />
                                </TouchableOpacity>
                              )}
                              <View style={styles.modernExerciseInfo}>
                                <Text style={[
                                  styles.modernExerciseName,
                                  exercise.completed && styles.modernExerciseNameCompleted
                                ]}>{exercise.name}</Text>
                                <Text style={styles.modernExerciseDetails}>
                                  {String(typeof exercise.sets === 'number' ? exercise.sets : Array.isArray(exercise.sets) ? (exercise.sets as any[]).length : 0)} séries × {String(exercise.reps || '')} reps
                                  {exercise.weight && exercise.weight > 0 && ` • ${String(exercise.weight)}kg`}
                                </Text>
                                <View style={styles.modernExerciseTags}>
                                  <View style={styles.modernExerciseTag}>
                                    <Text style={styles.modernExerciseTagText}>{exercise.muscle}</Text>
                                  </View>
                                  {exercise.category && (
                                    <View style={[styles.modernExerciseTag, styles.modernExerciseTagSecondary]}>
                                      <Text style={styles.modernExerciseTagText}>{exercise.category}</Text>
                                    </View>
                                  )}
                                </View>
                              </View>
                              <View style={styles.modernExerciseActions}>
                                {exercise.videoUrl && (
                                  <TouchableOpacity 
                                    style={styles.modernExerciseVideoButton}
                                    onPress={() => openVideoURL(exercise.videoUrl!)}
                                  >
                                    <Ionicons name="play-circle" size={16} color="#FF0000" />
                                  </TouchableOpacity>
                                )}
                                <TouchableOpacity 
                                  style={styles.modernExerciseDetailButton}
                                  onPress={() => {
                                    setSelectedExercise(exercise);
                                    setModalType('exerciseDetails');
                                    setShowModal(true);
                                  }}
                                >
                                  <Ionicons name="information-circle-outline" size={16} color="#2196F3" />
                                </TouchableOpacity>
                                {activeWorkout === plan.id && exercise.restTime && (
                                  <TouchableOpacity 
                                    style={styles.modernExerciseRestButton}
                                    onPress={() => startRestTimer(exercise.restTime!)}
                                  >
                                    <Ionicons name="timer-outline" size={14} color="white" />
                                    <Text style={styles.modernExerciseRestText}>{exercise.restTime?.toString()}s</Text>
                                  </TouchableOpacity>
                                )}
                              </View>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </View>
          
          <View style={styles.bottomPadding} />
        </ScrollView>
        
        {/* Modal de Treinos Prontos */}
        <Modal
          visible={showPresetWorkouts}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setShowPresetWorkouts(false)}
        >
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setShowPresetWorkouts(false)}
              >
                <Text style={styles.backButtonText}>←</Text>
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Treinos Prontos</Text>
              <View style={styles.backButton} />
            </View>
            
            <ScrollView style={styles.container}>
              {presetWorkouts.map((workout, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.workoutCard}
                  onPress={() => createWorkoutFromPreset(workout)}
                >
                  <Text style={styles.workoutTitle}>{workout.name}</Text>
                  <Text style={styles.workoutDescription}>{workout.description}</Text>
                  <Text style={styles.workoutDuration}>Duração: {workout.duration}</Text>
                  <Text style={styles.workoutDifficulty}>Dificuldade: {workout.difficulty}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </SafeAreaView>
        </Modal>
      </View>
    );
  };

  const renderMetasScreen = () => {
    const completedGoals = goals.filter(g => g.completed).length;
    const activeGoals = goals.filter(g => !g.completed).length;
    const averageProgress = goals.length > 0 ? Math.round(
      goals.reduce((acc, goal) => {
        const progress = goal.targetValue > 0 
          ? Math.min((goal.currentValue / goal.targetValue) * 100, 100) 
          : 0;
        return acc + progress;
      }, 0) / goals.length
    ) : 0;

    return (
      <View style={styles.container}>
        {/* Header Moderno */}
        <LinearGradient
          colors={['#9C27B0', '#7b1fa2']}
          style={styles.goalsHeader}
        >
          <View style={styles.goalsHeaderTop}>
            <TouchableOpacity
              style={styles.goalsBackButton}
              onPress={() => setCurrentScreen('menu')}
            >
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            <Text style={styles.goalsHeaderTitle}>Metas & Objetivos</Text>
            <TouchableOpacity
              style={styles.goalsHeaderAction}
              onPress={() => {
                setModalType('goals');
                setShowModal(true);
              }}
            >
              <Ionicons name="add" size={20} color="white" />
            </TouchableOpacity>
          </View>

          {/* Estatísticas Rápidas */}
          <View style={styles.goalsQuickStats}>
            <View style={styles.goalsQuickStat}>
              <Text style={styles.goalsQuickStatValue}>{goals.length?.toString()}</Text>
              <Text style={styles.goalsQuickStatLabel}>Total</Text>
            </View>
            <View style={styles.goalsQuickStat}>
              <Text style={styles.goalsQuickStatValue}>{completedGoals?.toString()}</Text>
              <Text style={styles.goalsQuickStatLabel}>Concluídas</Text>
            </View>
            <View style={styles.goalsQuickStat}>
              <Text style={styles.goalsQuickStatValue}>{averageProgress}%</Text>
              <Text style={styles.goalsQuickStatLabel}>Progresso Médio</Text>
            </View>
          </View>
        </LinearGradient>

        <ScrollView style={styles.goalsContent} showsVerticalScrollIndicator={false}>
          {goals.length === 0 ? (
            <View style={styles.goalsEmptyState}>
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                style={styles.goalsEmptyCard}
              >
                <Ionicons name="trophy" size={60} color="white" />
                <Text style={styles.goalsEmptyTitle}>Nenhuma meta criada</Text>
                <Text style={styles.goalsEmptySubtitle}>
                  Defina seus objetivos e acompanhe seu progresso para alcançar seus sonhos fitness
                </Text>
                <TouchableOpacity
                  style={styles.goalsEmptyButton}
                  onPress={() => {
                    setModalType('goals');
                    setShowModal(true);
                  }}
                >
                  <Ionicons name="add" size={16} color="white" />
                  <Text style={styles.goalsEmptyButtonText}>Criar Primeira Meta</Text>
                </TouchableOpacity>
              </LinearGradient>
            </View>
          ) : (
            <View style={styles.goalsListContainer}>
              {goals.map((goal, index) => {
                const progress = goal.targetValue > 0 
                  ? Math.min((goal.currentValue / goal.targetValue) * 100, 100) 
                  : 0;
                const isNearDeadline = new Date(goal.deadline).getTime() - new Date().getTime() < 7 * 24 * 60 * 60 * 1000;
                
                const goalGradients: [string, string][] = [
                  ['#4CAF50', '#45a049'], // Weight Loss
                  ['#FF9800', '#f57c00'], // Muscle Gain  
                  ['#2196F3', '#1976d2'], // Strength
                  ['#E91E63', '#c2185b'], // Endurance
                ];

                const gradientIndex = 
                  goal.type === 'weight_loss' ? 0 :
                  goal.type === 'muscle_gain' ? 1 :
                  goal.type === 'strength' ? 2 : 3;

                return (
                  <View key={goal.id} style={styles.modernGoalCard}>
                    <LinearGradient
                      colors={goal.completed ? ['#4CAF50', '#45a049'] : goalGradients[gradientIndex]}
                      style={styles.modernGoalCardGradient}
                    >
                      <View style={styles.modernGoalHeader}>
                        <View style={styles.modernGoalIcon}>
                          <Ionicons 
                            name={
                              goal.type === 'weight_loss' ? 'trending-down' :
                              goal.type === 'muscle_gain' ? 'fitness' :
                              goal.type === 'strength' ? 'barbell' : 'heart'
                            } 
                            size={24} 
                            color="white" 
                          />
                        </View>
                        <View style={styles.modernGoalInfo}>
                          <Text style={styles.modernGoalTitle}>{goal.title}</Text>
                          <Text style={styles.modernGoalDescription}>{goal.description}</Text>
                        </View>
                        {goal.completed && (
                          <View style={styles.modernGoalCompleted}>
                            <Ionicons name="checkmark-circle" size={24} color="white" />
                          </View>
                        )}
                      </View>

                      <View style={styles.modernGoalProgress}>
                        <View style={styles.modernGoalProgressHeader}>
                          <Text style={styles.modernGoalProgressText}>
                            {goal.currentValue} / {goal.targetValue} {goal.unit}
                          </Text>
                          <Text style={styles.modernGoalProgressPercentage}>
                            {Math.round(progress)?.toString()}%
                          </Text>
                        </View>
                        <View style={styles.modernGoalProgressBar}>
                          <View 
                            style={[
                              styles.modernGoalProgressFill, 
                              { width: `${progress}%` }
                            ]} 
                          />
                        </View>
                      </View>

                      {!goal.completed && (
                        <View style={styles.modernGoalFooter}>
                          <View style={styles.modernGoalDeadline}>
                            <Ionicons name="calendar-outline" size={14} color="white" />
                            <Text style={styles.modernGoalDeadlineText}>
                              {new Date(goal.deadline).toLocaleDateString()}
                            </Text>
                          </View>
                          {isNearDeadline && (
                            <View style={styles.modernGoalUrgent}>
                              <Ionicons name="warning" size={14} color="#FFD54F" />
                              <Text style={styles.modernGoalUrgentText}>Prazo próximo!</Text>
                            </View>
                          )}
                        </View>
                      )}
                    </LinearGradient>

                    {!goal.completed && (
                      <View style={styles.modernGoalActions}>
                        <TouchableOpacity 
                          style={[styles.modernGoalActionButton, styles.modernGoalUpdateButton]}
                          onPress={() => openUpdateGoalModal(goal)}
                        >
                          <Ionicons name="trending-up" size={16} color="white" />
                          <Text style={styles.modernGoalActionText}>Atualizar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={[styles.modernGoalActionButton, styles.modernGoalCompleteButton]}
                          onPress={() => {
                            const updatedGoals = goals.map(g => 
                              g.id === goal.id 
                                ? { ...g, completed: true, currentValue: g.targetValue }
                                : g
                            );
                            setGoals(updatedGoals);
                            saveData(STORAGE_KEYS.GOALS, updatedGoals);
                          }}
                        >
                          <Ionicons name="checkmark" size={16} color="white" />
                          <Text style={styles.modernGoalActionText}>Concluir</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
          
          <View style={styles.bottomPadding} />
        </ScrollView>
      </View>
    );
  };

  const renderDietaScreen = () => {
    // Verificação de segurança para dietPlans undefined
    const safeDietPlans = dietPlans || [];
    
    const totalMeals = safeDietPlans.reduce((total, plan) => {
      // Verificação robusta para plan e suas propriedades
      if (!plan || !plan.weeklyMeals || !plan.weeklyMeals[selectedWorkoutDay]) {
        return total;
      }
      return total + (plan.weeklyMeals[selectedWorkoutDay]?.length || 0);
    }, 0);

    const completedMeals = safeDietPlans.reduce((total, plan) => {
      // Verificação robusta para plan e suas propriedades
      if (!plan || !plan.weeklyMeals || !plan.weeklyMeals[selectedWorkoutDay]) {
        return total;
      }
      const dayMeals = plan.weeklyMeals[selectedWorkoutDay] || [];
      return total + dayMeals.filter(meal => meal && meal.completed === true).length;
    }, 0);

    const totalCalories = safeDietPlans.reduce((total, plan) => {
      // Verificação robusta para plan e totalCalories
      if (!plan || typeof plan.totalCalories !== 'number') {
        return total;
      }
      return total + plan.totalCalories;
    }, 0);

    return (
      <View style={styles.container}>
        {/* Header Moderno */}
        <LinearGradient
          colors={['#FF9800', '#f57c00']}
          style={styles.dietHeader}
        >
          <View style={styles.dietHeaderTop}>
            <TouchableOpacity
              style={styles.dietBackButton}
              onPress={() => setCurrentScreen('menu')}
            >
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            <Text style={styles.dietHeaderTitle}>Nutrição & Dieta</Text>
            <TouchableOpacity
              style={styles.dietHeaderAction}
              onPress={createSimpleDiet}
            >
              <Ionicons name="add" size={20} color="white" />
            </TouchableOpacity>
          </View>

          {/* Estatísticas Rápidas */}
          <View style={styles.dietQuickStats}>
            <View style={styles.dietQuickStat}>
              <Text style={styles.dietQuickStatValue}>{(dietPlans || []).length?.toString()}</Text>
              <Text style={styles.dietQuickStatLabel}>Planos</Text>
            </View>
            <View style={styles.dietQuickStat}>
              <Text style={styles.dietQuickStatValue}>{totalCalories}</Text>
              <Text style={styles.dietQuickStatLabel}>Kcal/dia</Text>
            </View>
            <View style={styles.dietQuickStat}>
              <Text style={styles.dietQuickStatValue}>{completedMeals}/{totalMeals}</Text>
              <Text style={styles.dietQuickStatLabel}>Refeições</Text>
            </View>
          </View>
        </LinearGradient>

        <ScrollView style={styles.dietContent} showsVerticalScrollIndicator={false}>
          {/* Seletor de Dias Modernizado */}
          <View style={styles.modernDietDaySelector}>
            <Text style={styles.modernDietDaySelectorTitle}>Selecione o dia da semana:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modernDietDayScrollView}>
              {(['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'] as DayOfWeek[]).map((day) => (
                <TouchableOpacity
                  key={day}
                  style={[
                    styles.modernDietDayButton,
                    selectedWorkoutDay === day && styles.modernDietDayButtonActive
                  ]}
                  onPress={() => setSelectedWorkoutDay(day)}
                >
                  <Text style={[
                    styles.modernDietDayButtonText,
                    selectedWorkoutDay === day && styles.modernDietDayButtonTextActive
                  ]}>
                    {day.charAt(0).toUpperCase() + day.slice(1)}
                  </Text>
                  <View style={[
                    styles.modernDietDayIndicator,
                    selectedWorkoutDay === day && styles.modernDietDayIndicatorActive
                  ]} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Cards de Dieta */}
          <View style={styles.dietPlansContainer}>
            {(dietPlans || []).length === 0 ? (
              <View style={styles.dietEmptyState}>
                <LinearGradient
                  colors={['#667eea', '#764ba2']}
                  style={styles.dietEmptyCard}
                >
                  <Ionicons name="restaurant" size={60} color="white" />
                  <Text style={styles.dietEmptyTitle}>Nenhuma dieta criada</Text>
                  <Text style={styles.dietEmptySubtitle}>
                    Crie seu plano alimentar personalizado para alcançar seus objetivos
                  </Text>
                  <TouchableOpacity
                    style={styles.dietEmptyButton}
                    onPress={createSimpleDiet}
                  >
                    <Ionicons name="add" size={16} color="white" />
                    <Text style={styles.dietEmptyButtonText}>Criar Primeira Dieta</Text>
                  </TouchableOpacity>
                </LinearGradient>
              </View>
            ) : (
              (dietPlans || []).map((plan, index) => {
                // Verificação robusta para plan e suas propriedades
                if (!plan || !plan.weeklyMeals) {
                  return null;
                }
                
                const currentDayMeals = Array.isArray(plan?.weeklyMeals?.[selectedWorkoutDay]) 
                  ? plan.weeklyMeals[selectedWorkoutDay] 
                  : [];
                const mealProgress = currentDayMeals.length > 0 ? 
                  (currentDayMeals.filter(meal => meal && meal.completed === true).length / currentDayMeals.length) * 100 : 0;
                
                const dietGradients: [string, string][] = [
                  ['#4CAF50', '#45a049'],
                  ['#2196F3', '#1976d2'],
                  ['#E91E63', '#c2185b'],
                  ['#FF5722', '#d84315'],
                  ['#9C27B0', '#7b1fa2'],
                  ['#607D8B', '#455a64']
                ];

                return (
                  <View key={plan.id} style={styles.modernDietCard}>
                    <LinearGradient
                      colors={dietGradients[index % dietGradients.length]}
                      style={styles.modernDietCardGradient}
                    >
                      <View style={styles.modernDietCardHeader}>
                        <View style={styles.modernDietCardInfo}>
                          <Text style={styles.modernDietCardTitle}>{plan.name}</Text>
                          <Text style={styles.modernDietCardSubtitle}>
                            {plan.totalCalories?.toString()} kcal/dia • {currentDayMeals.length?.toString()} refeições
                          </Text>
                        </View>
                        <View style={styles.modernDietCardActions}>
                          <TouchableOpacity
                            style={styles.modernDietActionButton}
                            onPress={() => startEditDiet(plan)}
                          >
                            <Ionicons name="create-outline" size={18} color="white" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.modernDietActionButton}
                            onPress={() => deleteDietPlan(plan.id)}
                          >
                            <Ionicons name="trash-outline" size={18} color="white" />
                          </TouchableOpacity>
                        </View>
                      </View>

                      <View style={styles.modernDietCardProgress}>
                        <View style={styles.modernDietProgressBar}>
                          <View 
                            style={[
                              styles.modernDietProgressFill,
                              { width: `${mealProgress}%` }
                            ]} 
                          />
                        </View>
                        <Text style={styles.modernDietProgressText}>
                          {currentDayMeals.filter(meal => meal && meal.completed === true).length?.toString()}/{currentDayMeals.length?.toString()} refeições concluídas
                        </Text>
                      </View>
                    </LinearGradient>

                    {/* Lista de Refeições */}
                    {currentDayMeals.length > 0 ? (
                      <View style={styles.modernMealsList}>
                        {Array.isArray(currentDayMeals) && currentDayMeals.map((meal) => (
                          <View key={meal.id} style={styles.modernMealCard}>
                            <View style={styles.modernMealHeader}>
                              <TouchableOpacity 
                                style={styles.modernMealCheckbox}
                                onPress={() => toggleMealComplete(plan.id, meal.id)}
                              >
                                <Ionicons 
                                  name={(meal && meal.completed === true) ? "checkmark-circle" : "ellipse-outline"} 
                                  size={24} 
                                  color={(meal && meal.completed === true) ? "#4CAF50" : "#ccc"} 
                                />
                              </TouchableOpacity>
                              <View style={styles.modernMealInfo}>
                                <Text style={[
                                  styles.modernMealName,
                                  (meal && meal.completed === true) && styles.modernMealNameCompleted
                                ]}>{meal.name}</Text>
                                <Text style={styles.modernMealTime}>{meal.time}</Text>
                              </View>
                              <View style={styles.modernMealCalories}>
                                <Text style={styles.modernMealCaloriesValue}>
                                  {(meal && meal.foods && Array.isArray(meal.foods)) ? 
                                    meal.foods.reduce((total, foodEntry) => 
                                      total + (foodEntry?.food?.calories || 0) * (foodEntry?.quantity || 0) / 100, 0
                                    ).toFixed(0) : '0'
                                  }
                                </Text>
                                <Text style={styles.modernMealCaloriesLabel}>kcal</Text>
                              </View>
                            </View>
                            
                            {(meal && meal.foods && Array.isArray(meal.foods) && meal.foods.length > 0) && (
                              <View style={styles.modernMealFoods}>
                                {Array.isArray(meal.foods) && meal.foods.map((foodEntry, index) => (
                                  <View key={index} style={styles.modernFoodItem}>
                                    <View style={styles.modernFoodInfo}>
                                      <Text style={styles.modernFoodName}>{foodEntry?.food?.name || 'N/A'}</Text>
                                      <Text style={styles.modernFoodQuantity}>{foodEntry?.quantity || 0}g</Text>
                                    </View>
                                    <View style={styles.modernFoodMacros}>
                                      <View style={styles.modernMacroItem}>
                                        <Text style={styles.modernMacroValue}>
                                          {((foodEntry?.food?.protein || 0) * (foodEntry?.quantity || 0) / 100).toFixed(1)}g
                                        </Text>
                                        <Text style={styles.modernMacroLabel}>P</Text>
                                      </View>
                                      <View style={styles.modernMacroItem}>
                                        <Text style={styles.modernMacroValue}>
                                          {((foodEntry?.food?.carbs || 0) * (foodEntry?.quantity || 0) / 100).toFixed(1)}g
                                        </Text>
                                        <Text style={styles.modernMacroLabel}>C</Text>
                                      </View>
                                      <View style={styles.modernMacroItem}>
                                        <Text style={styles.modernMacroValue}>
                                          {((foodEntry?.food?.fat || 0) * (foodEntry?.quantity || 0) / 100).toFixed(1)}g
                                        </Text>
                                        <Text style={styles.modernMacroLabel}>G</Text>
                                      </View>
                                    </View>
                                  </View>
                                ))}
                              </View>
                            )}
                          </View>
                        ))}
                      </View>
                    ) : (
                      <View style={styles.modernNoMealsContainer}>
                        <Ionicons name="restaurant-outline" size={40} color="#ccc" />
                        <Text style={styles.modernNoMealsText}>
                          Nenhuma refeição programada para {selectedWorkoutDay}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
          
          <View style={styles.bottomPadding} />
        </ScrollView>
      </View>
    );
  };

  // Função para calcular indicadores de produção com redução
  const calculateProductionIndicators = () => {
    const indicators = {
      july: { 2024: 45, 2025: 13 },
      august: { 2024: 32, 2025: 15 },
      september: { 2024: 20, 2025: 7 },
    };

    const calculateReduction = (oldValue: number, newValue: number) => {
      if (oldValue === 0) return 0;
      return Math.round(((oldValue - newValue) / oldValue) * 100);
    };

    const julyReduction = calculateReduction(indicators.july[2024], indicators.july[2025]);
    const augustReduction = calculateReduction(indicators.august[2024], indicators.august[2025]);
    const septemberReduction = calculateReduction(indicators.september[2024], indicators.september[2025]);
    
    const quarterTotal2024 = indicators.july[2024] + indicators.august[2024] + indicators.september[2024];
    const quarterTotal2025 = indicators.july[2025] + indicators.august[2025] + indicators.september[2025];
    const quarterReduction = calculateReduction(quarterTotal2024, quarterTotal2025);

    return {
      monthly: [
        {
          month: 'Julho',
          2024: indicators.july[2024],
          2025: indicators.july[2025],
          reduction: julyReduction
        },
        {
          month: 'Agosto',
          2024: indicators.august[2024],
          2025: indicators.august[2025],
          reduction: augustReduction
        },
        {
          month: 'Setembro',
          2024: indicators.september[2024],
          2025: indicators.september[2025],
          reduction: septemberReduction
        }
      ],
      quarterly: {
        2024: quarterTotal2024,
        2025: quarterTotal2025,
        reduction: quarterReduction
      }
    };
  };

  const renderProgressoScreen = () => {
    return (
      <View style={styles.container}>
        {/* Header Moderno */}
        <LinearGradient
          colors={['#673AB7', '#512da8']}
          style={styles.progressHeaderModern}
        >
          <View style={styles.progressHeaderTop}>
            <TouchableOpacity
              style={styles.progressBackButton}
              onPress={() => setCurrentScreen('menu')}
            >
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            <Text style={styles.progressHeaderTitle}>Histórico & Progresso</Text>
            <TouchableOpacity
              style={styles.progressHeaderAction}
              onPress={() => setShowFavoriteExerciseModal(true)}
            >
              <Ionicons name="settings" size={20} color="white" />
            </TouchableOpacity>
          </View>

          {/* Estatísticas Rápidas */}
          <View style={styles.progressQuickStats}>
            <View style={styles.progressQuickStat}>
              <Text style={styles.progressQuickStatValue}>{workoutStats.totalWorkouts?.toString()}</Text>
              <Text style={styles.progressQuickStatLabel}>Treinos</Text>
            </View>
            <View style={styles.progressQuickStat}>
              <Text style={styles.progressQuickStatValue}>{Math.round(workoutStats.totalVolume)?.toString()}</Text>
              <Text style={styles.progressQuickStatLabel}>Volume (kg)</Text>
            </View>
            <View style={styles.progressQuickStat}>
              <Text style={styles.progressQuickStatValue}>{workoutStats.currentStreak}</Text>
              <Text style={styles.progressQuickStatLabel}>Sequência</Text>
            </View>
          </View>
        </LinearGradient>

        <ScrollView style={styles.progressContent} showsVerticalScrollIndicator={false}>
          {/* Nova Seção: Estatísticas Avançadas */}
          <View style={styles.modernStatsContainer}>
            <View style={styles.profileDetailCard}>
              <Text style={styles.profileSectionTitle}>📊 Estatísticas Avançadas</Text>
              
              {(() => {
                const advancedStats = calculateAdvancedStats();
                return (
                  <View style={styles.advancedStatsGrid}>
                    <View style={styles.advancedStatItem}>
                      <Text style={styles.advancedStatValue}>{advancedStats.bmr}</Text>
                      <Text style={styles.advancedStatLabel}>TMB (kcal)</Text>
                      <Text style={styles.advancedStatDescription}>Taxa Metabólica Basal</Text>
                    </View>
                    
                    <View style={styles.advancedStatItem}>
                      <Text style={styles.advancedStatValue}>{advancedStats.tdee}</Text>
                      <Text style={styles.advancedStatLabel}>TDEE (kcal)</Text>
                      <Text style={styles.advancedStatDescription}>Gasto Calórico Total</Text>
                    </View>
                    
                    <View style={styles.advancedStatItem}>
                      <Text style={styles.advancedStatValue}>{calculateBMI()}</Text>
                      <Text style={styles.advancedStatLabel}>IMC</Text>
                      <Text style={styles.advancedStatDescription}>Índice de Massa Corporal</Text>
                    </View>
                    
                    <View style={styles.advancedStatItem}>
                      <Text style={styles.advancedStatValue}>{advancedStats.idealWeight}</Text>
                      <Text style={styles.advancedStatLabel}>Peso Ideal (kg)</Text>
                      <Text style={styles.advancedStatDescription}>Baseado na altura</Text>
                    </View>
                    
                    <View style={styles.advancedStatItem}>
                      <Text style={styles.advancedStatValue}>{advancedStats.bodyWater}L</Text>
                      <Text style={styles.advancedStatLabel}>Água Corporal</Text>
                      <Text style={styles.advancedStatDescription}>Estimativa de hidratação</Text>
                    </View>
                    
                    <View style={styles.advancedStatItem}>
                      <Text style={styles.advancedStatValue}>{advancedStats.caloriesForGoal}</Text>
                      <Text style={styles.advancedStatLabel}>Calorias Meta</Text>
                      <Text style={styles.advancedStatDescription}>Para seu objetivo</Text>
                    </View>
                    
                    {userStats.weeklyWorkoutGoal && (
                      <View style={styles.advancedStatItem}>
                        <Text style={styles.advancedStatValue}>{userStats.weeklyWorkoutGoal}/sem</Text>
                        <Text style={styles.advancedStatLabel}>Meta Treinos</Text>
                        <Text style={styles.advancedStatDescription}>Frequência semanal</Text>
                      </View>
                    )}
                    
                    {advancedStats.waistHipRatio && (
                      <View style={styles.advancedStatItem}>
                        <Text style={styles.advancedStatValue}>{advancedStats.waistHipRatio}</Text>
                        <Text style={styles.advancedStatLabel}>RCQ</Text>
                        <Text style={styles.advancedStatDescription}>Relação Cintura-Quadril</Text>
                      </View>
                    )}
                  </View>
                );
              })()}
            </View>
          </View>

          {/* Cards de Estatísticas Principais */}
          <View style={styles.modernStatsContainer}>
            <LinearGradient
              colors={['#4CAF50', '#45a049']}
              style={styles.modernStatCard}
            >
              <View style={styles.modernStatHeader}>
                <Ionicons name="barbell" size={28} color="white" />
                <View style={styles.modernStatInfo}>
                  <Text style={styles.modernStatValue}>{workoutStats.totalWorkouts?.toString()}</Text>
                  <Text style={styles.modernStatLabel}>Treinos Concluídos</Text>
                </View>
              </View>
              <Text style={styles.modernStatDescription}>
                Total de sessões de treino realizadas
              </Text>
            </LinearGradient>

            <LinearGradient
              colors={['#2196F3', '#1976d2']}
              style={styles.modernStatCard}
            >
              <View style={styles.modernStatHeader}>
                <Ionicons name="trending-up" size={28} color="white" />
                <View style={styles.modernStatInfo}>
                  <Text style={styles.modernStatValue}>{Math.round(workoutStats.totalVolume)?.toString()}</Text>
                  <Text style={styles.modernStatLabel}>Volume Total (kg)</Text>
                </View>
              </View>
              <Text style={styles.modernStatDescription}>
                Peso total levantado em todos os treinos
              </Text>
            </LinearGradient>
          </View>

          {/* Grid de Estatísticas Secundárias */}
          <View style={styles.modernSecondaryStatsGrid}>
            <View style={styles.modernSecondaryStatCard}>
              <LinearGradient
                colors={['#FF9800', '#f57c00']}
                style={styles.modernSecondaryStatGradient}
              >
                <Ionicons name="time" size={24} color="white" />
                <Text style={styles.modernSecondaryStatValue}>{Math.round(workoutStats.averageDuration)?.toString()}</Text>
                <Text style={styles.modernSecondaryStatLabel}>Min/Treino</Text>
              </LinearGradient>
            </View>
            
            <View style={styles.modernSecondaryStatCard}>
              <LinearGradient
                colors={['#9C27B0', '#7b1fa2']}
                style={styles.modernSecondaryStatGradient}
              >
                <Ionicons name="calendar" size={24} color="white" />
                <Text style={styles.modernSecondaryStatValue}>{workoutStats.weeklyFrequency}</Text>
                <Text style={styles.modernSecondaryStatLabel}>Por Semana</Text>
              </LinearGradient>
            </View>
            
            <View style={styles.modernSecondaryStatCard}>
              <LinearGradient
                colors={['#F44336', '#d32f2f']}
                style={styles.modernSecondaryStatGradient}
              >
                <Ionicons name="flame" size={24} color="white" />
                <Text style={styles.modernSecondaryStatValue}>{workoutStats.currentStreak}</Text>
                <Text style={styles.modernSecondaryStatLabel}>Sequência</Text>
              </LinearGradient>
            </View>
            
            <View style={styles.modernSecondaryStatCard}>
              <LinearGradient
                colors={['#FFD700', '#ffc107']}
                style={styles.modernSecondaryStatGradient}
              >
                <Ionicons name="trophy" size={24} color="white" />
                <Text style={styles.modernSecondaryStatValue}>{workoutStats.longestStreak}</Text>
                <Text style={styles.modernSecondaryStatLabel}>Recorde</Text>
              </LinearGradient>
            </View>
          </View>

          {/* Card do Exercício Favorito */}
          <View style={styles.modernFavoriteExerciseCard}>
            <LinearGradient
              colors={['#E91E63', '#c2185b']}
              style={styles.modernFavoriteGradient}
            >
              <View style={styles.modernFavoriteHeader}>
                <View style={styles.modernFavoriteHeaderLeft}>
                  <Ionicons name="heart" size={24} color="white" />
                  <Text style={styles.modernFavoriteTitle}>Exercício Favorito</Text>
                </View>
                <TouchableOpacity 
                  style={styles.modernEditFavoriteButton}
                  onPress={() => setShowFavoriteExerciseModal(true)}
                >
                  <Ionicons name="pencil" size={18} color="white" />
                </TouchableOpacity>
              </View>
              <View style={styles.modernFavoriteContent}>
                <Text style={styles.modernFavoriteExerciseText}>{workoutStats.favoriteExercise}</Text>
                <Text style={styles.modernFavoriteDescription}>
                  {userDefinedFavoriteExercise ? 'Definido por você' : 'Mais praticado nos treinos'}
                </Text>
              </View>
            </LinearGradient>
          </View>

          {/* Filtros de Período */}
          <View style={styles.modernFilterSection}>
            <Text style={styles.modernSectionTitle}>Filtrar por Período</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modernFilterScrollView}>
              {[
                { key: '7days', label: '7 dias', icon: 'today' },
                { key: '30days', label: '30 dias', icon: 'calendar' },
                { key: '3months', label: '3 meses', icon: 'calendar-outline' },
                { key: '1year', label: '1 ano', icon: 'calendar-number' }
              ].map(filter => (
                <TouchableOpacity
                  key={filter.key}
                  style={[
                    styles.modernFilterButton,
                    selectedDateRange === filter.key && styles.modernFilterButtonActive
                  ]}
                  onPress={() => setSelectedDateRange(filter.key)}
                >
                  <Ionicons 
                    name={filter.icon as any} 
                    size={16} 
                    color={selectedDateRange === filter.key ? 'white' : '#673AB7'} 
                  />
                  <Text style={[
                    styles.modernFilterButtonText,
                    selectedDateRange === filter.key && styles.modernFilterButtonTextActive
                  ]}>
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Histórico de Treinos */}
          <View style={styles.modernHistorySection}>
            <Text style={styles.modernSectionTitle}>Treinos Recentes</Text>
            {getFilteredWorkoutHistory().length === 0 ? (
              <View style={styles.modernEmptyState}>
                <LinearGradient
                  colors={['#607D8B', '#455a64']}
                  style={styles.modernEmptyCard}
                >
                  <Ionicons name="barbell-outline" size={60} color="white" />
                  <Text style={styles.modernEmptyTitle}>Nenhum treino encontrado</Text>
                  <Text style={styles.modernEmptySubtitle}>
                    Complete um treino para ver seu histórico aqui
                  </Text>
                </LinearGradient>
              </View>
            ) : (
              <View style={styles.modernWorkoutHistory}>
                {getFilteredWorkoutHistory()
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((session, index) => {
                    const historyGradients: [string, string][] = [
                      ['#667eea', '#764ba2'],
                      ['#f093fb', '#f5576c'],
                      ['#4facfe', '#00f2fe'],
                      ['#43e97b', '#38f9d7'],
                      ['#fa709a', '#fee140'],
                      ['#a8edea', '#fed6e3']
                    ];
                    
                    return (
                      <View key={session.id} style={styles.modernWorkoutSessionCard}>
                        <LinearGradient
                          colors={historyGradients[index % historyGradients.length]}
                          style={styles.modernSessionGradient}
                        >
                          <View style={styles.modernSessionHeader}>
                            <View style={styles.modernSessionInfo}>
                              <Text style={styles.modernSessionWorkoutName}>{session.workoutName}</Text>
                              <Text style={styles.modernSessionDate}>
                                {new Date(session.date).toLocaleDateString('pt-BR')}
                              </Text>
                            </View>
                            <View style={styles.modernSessionStats}>
                              <View style={styles.modernSessionStat}>
                                <Text style={styles.modernSessionStatValue}>{session.duration}</Text>
                                <Text style={styles.modernSessionStatLabel}>min</Text>
                              </View>
                              <View style={styles.modernSessionStat}>
                                <Text style={styles.modernSessionStatValue}>{Math.round(session.totalVolume)?.toString()}</Text>
                                <Text style={styles.modernSessionStatLabel}>kg</Text>
                              </View>
                              <View style={styles.modernSessionStat}>
                                <Text style={styles.modernSessionStatValue}>{session.completedExercises.length}</Text>
                                <Text style={styles.modernSessionStatLabel}>ex.</Text>
                              </View>
                            </View>
                          </View>
                        </LinearGradient>
                        
                        <View style={styles.modernSessionExercises}>
                          {session.completedExercises.slice(0, 3).map((exercise, idx) => {
                            const totalSets = exercise.sets.length;
                            const avgWeight = exercise.sets.reduce((sum, set) => sum + (set.weight || 0), 0) / totalSets;
                            const avgReps = exercise.sets.reduce((sum, set) => sum + (set.reps || 0), 0) / totalSets;
                            const exerciseVolume = exercise.sets.reduce((sum, set) => sum + ((set.weight || 0) * (set.reps || 0)), 0);
                            
                            return (
                              <View key={exercise.exerciseId} style={styles.modernSessionExercise}>
                                <View style={styles.modernExerciseIcon}>
                                  <Ionicons name="barbell" size={16} color="#673AB7" />
                                </View>
                                <View style={styles.modernExerciseDetailsProgress}>
                                  <Text style={styles.modernSessionExerciseName}>{exercise.exerciseName}</Text>
                                  <Text style={styles.modernSessionExerciseStats}>
                                    {totalSets?.toString()}x{Math.round(avgReps)?.toString()} • {Math.round(avgWeight)?.toString()}kg • Vol: {Math.round(exerciseVolume)?.toString()}kg
                                  </Text>
                                </View>
                              </View>
                            );
                          })}
                          {session.completedExercises.length > 3 && (
                            <View style={styles.modernMoreExercises}>
                              <Ionicons name="ellipsis-horizontal" size={16} color="#999" />
                              <Text style={styles.modernSessionMoreExercises}>
                                +{session.completedExercises.length - 3} exercícios
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })}
              </View>
            )}
          </View>
          
          <View style={styles.bottomPadding} />
        </ScrollView>
      </View>
    );
  };

  const renderPerfilScreen = () => {
    const pickImage = async () => {
      // Solicitar permissões
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'Precisamos de permissão para acessar suas fotos.');
        return;
      }

      // Mostrar opções para o usuário
      Alert.alert(
        'Selecionar Foto',
        'Como você gostaria de adicionar sua foto?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Galeria', onPress: () => openImagePicker() },
          { text: 'Câmera', onPress: () => openCamera() }
        ]
      );
    };

    const openImagePicker = async () => {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const newUserStats = {
          ...userStats,
          profileImage: result.assets[0].uri
        };
        setUserStats(newUserStats);
        await saveData(STORAGE_KEYS.USER_STATS, newUserStats);
        Alert.alert('✅ Sucesso', 'Foto de perfil atualizada!');
      }
    };

    const openCamera = async () => {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'Precisamos de permissão para usar a câmera.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const newUserStats = {
          ...userStats,
          profileImage: result.assets[0].uri
        };
        setUserStats(newUserStats);
        await saveData(STORAGE_KEYS.USER_STATS, newUserStats);
        Alert.alert('✅ Sucesso', 'Foto de perfil atualizada!');
      }
    };

    const removeProfileImage = () => {
      Alert.alert(
        'Remover Foto',
        'Tem certeza que deseja remover sua foto de perfil?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { 
            text: 'Remover', 
            style: 'destructive',
            onPress: async () => {
              const newUserStats = {
                ...userStats,
                profileImage: ''
              };
              setUserStats(newUserStats);
              await saveData(STORAGE_KEYS.USER_STATS, newUserStats);
              Alert.alert('✅ Sucesso', 'Foto de perfil removida!');
            }
          }
        ]
      );
    };

    return (
      <View style={styles.container}>
        <View style={styles.screenHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setCurrentScreen('menu')}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.screenTitle}>Meu Perfil</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Seção de Foto e Informações Principais */}
          <View style={styles.profileMainCard}>
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.profileGradientHeader}
            >
              <View style={styles.profileImageContainer}>
                <TouchableOpacity
                  style={styles.profileImageWrapper}
                  onPress={pickImage}
                >
                  {userStats.profileImage ? (
                    <Image 
                      source={{ uri: userStats.profileImage }} 
                      style={styles.profileImage}
                    />
                  ) : (
                    <View style={styles.profileImagePlaceholder}>
                      <Ionicons name="person" size={50} color="#666" />
                    </View>
                  )}
                  <View style={styles.profileImageOverlay}>
                    <Ionicons name="camera" size={20} color="white" />
                  </View>
                </TouchableOpacity>
                
                {userStats.profileImage && (
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={removeProfileImage}
                  >
                    <Ionicons name="trash" size={16} color="white" />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.profileNameSection}>
                <TextInput
                  style={styles.profileNameInput}
                  value={userStats.name || ''}
                  onChangeText={(text) => setUserStats({...userStats, name: text})}
                  placeholder="Seu nome"
                  placeholderTextColor="rgba(255,255,255,0.7)"
                />
                <TextInput
                  style={styles.profileBioInput}
                  value={userStats.bio || ''}
                  onChangeText={(text) => setUserStats({...userStats, bio: text})}
                  placeholder="Conte um pouco sobre você..."
                  placeholderTextColor="rgba(255,255,255,0.7)"
                  multiline
                  numberOfLines={2}
                />
              </View>
            </LinearGradient>
          </View>

          {/* Estatísticas Rápidas */}
          <View style={styles.profileQuickStats}>
            <View style={styles.profileQuickStatCard}>
              <Ionicons name="scale-outline" size={24} color="#4CAF50" />
              <Text style={styles.profileQuickStatValue}>{userStats.weight?.toString()}kg</Text>
              <Text style={styles.profileQuickStatLabel}>Peso</Text>
            </View>
            <View style={styles.profileQuickStatCard}>
              <Ionicons name="resize-outline" size={24} color="#2196F3" />
              <Text style={styles.profileQuickStatValue}>{userStats.height}cm</Text>
              <Text style={styles.profileQuickStatLabel}>Altura</Text>
            </View>
            <View style={styles.profileQuickStatCard}>
              <Ionicons name="time-outline" size={24} color="#FF9800" />
              <Text style={styles.profileQuickStatValue}>{userStats.age}</Text>
              <Text style={styles.profileQuickStatLabel}>Anos</Text>
            </View>
          </View>

          {/* Informações Detalhadas */}
          <View style={styles.profileDetailCard}>
            <Text style={styles.profileSectionTitle}>📊 Informações Corporais</Text>
            
            <View style={styles.profileInputGroup}>
              <Text style={styles.profileInputLabel}>Peso (kg)</Text>
              <TextInput
                style={styles.profileDetailInput}
                value={userStats.weight ? String(userStats.weight) : ''}
                onChangeText={(text) => setUserStats({...userStats, weight: parseFloat(text) || 0})}
                keyboardType="numeric"
                placeholder="70"
              />
            </View>

            <View style={styles.profileInputGroup}>
              <Text style={styles.profileInputLabel}>Altura (cm)</Text>
              <TextInput
                style={styles.profileDetailInput}
                value={userStats.height ? String(userStats.height) : ''}
                onChangeText={(text) => setUserStats({...userStats, height: parseFloat(text) || 0})}
                keyboardType="numeric"
                placeholder="175"
              />
            </View>

            <View style={styles.profileInputGroup}>
              <Text style={styles.profileInputLabel}>Idade (anos)</Text>
              <TextInput
                style={styles.profileDetailInput}
                value={userStats.age ? String(userStats.age) : ''}
                onChangeText={(text) => setUserStats({...userStats, age: parseInt(text) || 0})}
                keyboardType="numeric"
                placeholder="25"
              />
            </View>

            <View style={styles.profileInputGroup}>
              <Text style={styles.profileInputLabel}>Gordura Corporal (%)</Text>
              <TextInput
                style={styles.profileDetailInput}
                value={userStats.bodyFat ? String(userStats.bodyFat) : ''}
                onChangeText={(text) => setUserStats({...userStats, bodyFat: parseFloat(text) || 0})}
                keyboardType="numeric"
                placeholder="15"
              />
            </View>

            <View style={styles.profileInputGroup}>
              <Text style={styles.profileInputLabel}>Massa Muscular (%)</Text>
              <TextInput
                style={styles.profileDetailInput}
                value={userStats.muscle ? String(userStats.muscle) : ''}
                onChangeText={(text) => setUserStats({...userStats, muscle: parseFloat(text) || 0})}
                keyboardType="numeric"
                placeholder="40"
              />
            </View>
          </View>

          {/* Informações Adicionais para Estatísticas */}
          <View style={styles.profileDetailCard}>
            <Text style={styles.profileSectionTitle}>🎯 Informações para Estatísticas</Text>
            
            <View style={styles.profileInputGroup}>
              <Text style={styles.profileInputLabel}>Gênero</Text>
              <View style={styles.profileSelectGroup}>
                {['male', 'female', 'other'].map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.profileSelectOption,
                      userStats.gender === option && styles.profileSelectOptionActive
                    ]}
                    onPress={() => setUserStats({...userStats, gender: option as any})}
                  >
                    <Text style={[
                      styles.profileSelectText,
                      userStats.gender === option && styles.profileSelectTextActive
                    ]}>
                      {option === 'male' ? 'Masculino' : option === 'female' ? 'Feminino' : 'Outro'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.profileInputGroup}>
              <Text style={styles.profileInputLabel}>Nível de Atividade</Text>
              <View style={styles.profileSelectGroup}>
                {[
                  { key: 'sedentary', label: 'Sedentário' },
                  { key: 'light', label: 'Leve' },
                  { key: 'moderate', label: 'Moderado' },
                  { key: 'active', label: 'Ativo' },
                  { key: 'very_active', label: 'Muito Ativo' }
                ].map((option) => (
                  <TouchableOpacity
                    key={option.key}
                    style={[
                      styles.profileSelectOption,
                      userStats.activityLevel === option.key && styles.profileSelectOptionActive
                    ]}
                    onPress={() => setUserStats({...userStats, activityLevel: option.key as any})}
                  >
                    <Text style={[
                      styles.profileSelectText,
                      userStats.activityLevel === option.key && styles.profileSelectTextActive
                    ]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.profileInputGroup}>
              <Text style={styles.profileInputLabel}>Objetivo Principal</Text>
              <View style={styles.profileSelectGroup}>
                {[
                  { key: 'weight_loss', label: 'Perda de Peso' },
                  { key: 'muscle_gain', label: 'Ganho de Massa' },
                  { key: 'maintenance', label: 'Manutenção' },
                  { key: 'strength', label: 'Força' },
                  { key: 'endurance', label: 'Resistência' }
                ].map((option) => (
                  <TouchableOpacity
                    key={option.key}
                    style={[
                      styles.profileSelectOption,
                      userStats.fitnessGoal === option.key && styles.profileSelectOptionActive
                    ]}
                    onPress={() => setUserStats({...userStats, fitnessGoal: option.key as any})}
                  >
                    <Text style={[
                      styles.profileSelectText,
                      userStats.fitnessGoal === option.key && styles.profileSelectTextActive
                    ]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.profileInputGroup}>
              <Text style={styles.profileInputLabel}>Treinos por Semana (Meta)</Text>
              <TextInput
                style={styles.profileDetailInput}
                value={userStats.weeklyWorkoutGoal ? String(userStats.weeklyWorkoutGoal) : ''}
                onChangeText={(text) => setUserStats({...userStats, weeklyWorkoutGoal: parseInt(text) || 0})}
                keyboardType="numeric"
                placeholder="4"
              />
            </View>

            <View style={styles.profileInputGroup}>
              <Text style={styles.profileInputLabel}>Meta Calórica Diária (kcal)</Text>
              <TextInput
                style={styles.profileDetailInput}
                value={userStats.dailyCalorieGoal ? String(userStats.dailyCalorieGoal) : ''}
                onChangeText={(text) => setUserStats({...userStats, dailyCalorieGoal: parseInt(text) || 0})}
                keyboardType="numeric"
                placeholder="2500"
              />
            </View>

            <View style={styles.profileInputGroup}>
              <Text style={styles.profileInputLabel}>Meta de Água Diária (litros)</Text>
              <TextInput
                style={styles.profileDetailInput}
                value={userStats.dailyWaterGoal ? String(userStats.dailyWaterGoal) : ''}
                onChangeText={(text) => setUserStats({...userStats, dailyWaterGoal: parseFloat(text) || 0})}
                keyboardType="numeric"
                placeholder="2.5"
              />
            </View>
          </View>

          {/* Medidas Corporais Detalhadas */}
          <View style={styles.profileDetailCard}>
            <Text style={styles.profileSectionTitle}>📏 Medidas Corporais (Opcional)</Text>
            
            <View style={styles.profileInputGroup}>
              <Text style={styles.profileInputLabel}>Peitoral (cm)</Text>
              <TextInput
                style={styles.profileDetailInput}
                value={userStats.chest ? String(userStats.chest) : ''}
                onChangeText={(text) => setUserStats({...userStats, chest: parseFloat(text) || undefined})}
                keyboardType="numeric"
                placeholder="100"
              />
            </View>

            <View style={styles.profileInputGroup}>
              <Text style={styles.profileInputLabel}>Cintura (cm)</Text>
              <TextInput
                style={styles.profileDetailInput}
                value={userStats.waist ? String(userStats.waist) : ''}
                onChangeText={(text) => setUserStats({...userStats, waist: parseFloat(text) || undefined})}
                keyboardType="numeric"
                placeholder="85"
              />
            </View>

            <View style={styles.profileInputGroup}>
              <Text style={styles.profileInputLabel}>Quadril (cm)</Text>
              <TextInput
                style={styles.profileDetailInput}
                value={userStats.hips ? String(userStats.hips) : ''}
                onChangeText={(text) => setUserStats({...userStats, hips: parseFloat(text) || undefined})}
                keyboardType="numeric"
                placeholder="95"
              />
            </View>

            <View style={styles.profileInputGroup}>
              <Text style={styles.profileInputLabel}>Braços (cm)</Text>
              <TextInput
                style={styles.profileDetailInput}
                value={userStats.arms ? String(userStats.arms) : ''}
                onChangeText={(text) => setUserStats({...userStats, arms: parseFloat(text) || undefined})}
                keyboardType="numeric"
                placeholder="35"
              />
            </View>
          </View>

          <View style={styles.bottomPadding} />
        </ScrollView>
      </View>
    );
  };

  const renderModal = () => {
    // Modal para inserir nome da dieta
    if (showDietNameModal) {
      return (
        <Modal
          visible={showDietNameModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowDietNameModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Nova Dieta</Text>
                <TouchableOpacity onPress={() => setShowDietNameModal(false)}>
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                {/* Nome da Dieta */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Nome da Dieta</Text>
                  <TextInput
                    style={styles.input}
                    value={newDietName}
                    onChangeText={setNewDietName}
                    placeholder="Ex: Dieta para Ganho de Massa"
                    placeholderTextColor="#999"
                  />
                </View>

                {/* Refeições Criadas */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Refeições ({newDietMeals.length})</Text>
                  {newDietMeals.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Ionicons name="restaurant" size={50} color="#ccc" />
                      <Text style={styles.emptyStateText}>Nenhuma refeição criada</Text>
                      <Text style={styles.emptyStateSubtext}>Adicione refeições à sua dieta</Text>
                    </View>
                  ) : (
                    Array.isArray(newDietMeals) && newDietMeals.map((meal) => (
                      <View key={meal.id} style={styles.mealPreviewCard}>
                        <View style={styles.mealPreviewHeader}>
                          <Text style={styles.mealPreviewName}>{meal.name}</Text>
                          <TouchableOpacity onPress={() => removeMealFromDiet(meal.id)}>
                            <Ionicons name="trash-outline" size={18} color="#f44336" />
                          </TouchableOpacity>
                        </View>
                        <Text style={styles.mealPreviewFoods}>
                          {meal.foods ? meal.foods.length : 0} alimentos - {meal.foods ? 
                            meal.foods.reduce((total, foodEntry) => 
                              total + (foodEntry.food.calories * foodEntry.quantity / 100), 0
                            ).toFixed(0) : 0} kcal
                        </Text>
                      </View>
                    ))
                  )}
                </View>

                {/* Nova Refeição */}
                <View style={styles.formGroup}>
                  <View style={styles.addFoodHeader}>
                    <Text style={styles.formLabel}>Nova Refeição</Text>
                    {currentMeal.foods.length > 0 && (
                      <TouchableOpacity 
                        style={styles.templatesButton}
                        onPress={() => setCurrentMeal({ name: '', time: '', foods: [] })}
                      >
                        <Ionicons name="refresh-outline" size={16} color="#FF5722" />
                        <Text style={styles.templatesButtonText}>Limpar</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  
                  <View style={styles.formRow}>
                    <View style={styles.formGroupFlex}>
                      <Text style={styles.inputLabel}>Nome da Refeição</Text>
                      <TextInput
                        style={styles.input}
                        value={currentMeal.name}
                        onChangeText={(text) => setCurrentMeal(prev => ({ ...prev, name: text }))}
                        placeholder="Ex: Café da Manhã"
                        placeholderTextColor="#999"
                      />
                    </View>
                    
                    <View style={styles.formGroupFlex}>
                      <Text style={styles.inputLabel}>Horário</Text>
                      <TextInput
                        style={styles.input}
                        value={currentMeal.time}
                        onChangeText={(text) => setCurrentMeal(prev => ({ ...prev, time: text }))}
                        placeholder="Ex: 07:00"
                        placeholderTextColor="#999"
                      />
                    </View>
                  </View>
                  
                  {/* Sugestões de horários */}
                  <View style={styles.timeSuggestions}>
                    {['07:00', '12:00', '15:00', '19:00'].map((time) => (
                      <TouchableOpacity
                        key={time}
                        style={styles.timeSuggestion}
                        onPress={() => setCurrentMeal(prev => ({ ...prev, time }))}
                      >
                        <Text style={styles.timeSuggestionText}>{time}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Sugestões rápidas de refeições */}
                  <View style={styles.quickMeals}>
                    <Text style={styles.inputLabel}>Sugestões Rápidas:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {[
                        { name: 'Café da Manhã', time: '07:00' },
                        { name: 'Lanche da Manhã', time: '10:00' },
                        { name: 'Almoço', time: '12:00' },
                        { name: 'Lanche da Tarde', time: '15:00' },
                        { name: 'Jantar', time: '19:00' },
                        { name: 'Ceia', time: '21:00' }
                      ].map((meal) => (
                        <TouchableOpacity
                          key={meal.name}
                          style={styles.quickMealButton}
                          onPress={() => setCurrentMeal(prev => ({ 
                            ...prev, 
                            name: meal.name, 
                            time: meal.time 
                          }))}
                        >
                          <Text style={styles.quickMealText}>{meal.name}</Text>
                          <Text style={styles.quickMealTime}>{meal.time}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  {/* Alimentos da Refeição */}
                  {currentMeal.foods.length > 0 && (
                    <View style={styles.currentMealFoods}>
                      <Text style={styles.inputLabel}>Alimentos ({currentMeal.foods.length}):</Text>
                      {Array.isArray(currentMeal.foods) && currentMeal.foods.map((foodEntry, index) => (
                        <View key={index} style={styles.foodPreviewRow}>
                          <View style={styles.foodPreviewInfo}>
                            <Text style={styles.foodPreviewName}>{foodEntry.food.name}</Text>
                            <Text style={styles.foodPreviewPortion}>
                              {foodEntry.multiplier && foodEntry.baseQuantity && foodEntry.multiplier > 1 
                                ? `${foodEntry.multiplier}x ${foodEntry.baseQuantity}g = ${foodEntry.quantity}g`
                                : `${foodEntry.quantity}g`
                              }
                            </Text>
                          </View>
                          <View style={styles.foodPreviewNutrition}>
                            <Text style={styles.foodPreviewCalories}>{(foodEntry.food.calories * foodEntry.quantity / 100).toFixed(0)} kcal</Text>
                            <Text style={styles.foodPreviewMacros}>P:{(foodEntry.food.protein * foodEntry.quantity / 100).toFixed(0)}g C:{(foodEntry.food.carbs * foodEntry.quantity / 100).toFixed(0)}g G:{(foodEntry.food.fat * foodEntry.quantity / 100).toFixed(0)}g</Text>
                          </View>
                          <TouchableOpacity onPress={() => removeFoodFromCurrentMeal(index)}>
                            <Ionicons name="close-circle" size={20} color="#f44336" />
                          </TouchableOpacity>
                        </View>
                      ))}
                      <View style={styles.mealTotals}>
                        <Text style={styles.mealTotalsText}>
                          Total: {currentMeal.foods.reduce((total, foodEntry) => 
                            total + (foodEntry.food.calories * foodEntry.quantity / 100), 0
                          ).toFixed(0)} kcal
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Adicionar Alimentos */}
                  <View style={styles.addFoodSection}>
                    <View style={styles.addFoodHeader}>
                      <Text style={styles.inputLabel}>Adicionar Alimento</Text>
                      {mealTemplates.length > 0 && (
                        <TouchableOpacity 
                          style={styles.templatesButton}
                          onPress={() => setShowTemplates(!showTemplates)}
                        >
                          <Ionicons name="library-outline" size={18} color="#2196F3" />
                          <Text style={styles.templatesButtonText}>Templates</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    
                    {/* Templates de Refeições */}
                    {showTemplates && (
                      <View style={styles.templatesContainer}>
                        <Text style={styles.templatesTitle}>Templates Salvos:</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          {Array.isArray(mealTemplates) && mealTemplates.map((template) => (
                            <TouchableOpacity
                              key={template.id}
                              style={styles.templateCard}
                              onPress={() => applyTemplate(template)}
                            >
                              <Text style={styles.templateName}>{template.name}</Text>
                              <Text style={styles.templateInfo}>
                                {template.foods?.length || 0} alimentos
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                    
                    {/* Busca e Filtros */}
                    <View style={styles.searchContainer}>
                      <View style={styles.searchInputContainer}>
                        <Ionicons name="search" size={20} color="#666" />
                        <TextInput
                          style={styles.searchInput}
                          value={foodSearchTerm}
                          onChangeText={setFoodSearchTerm}
                          placeholder="Buscar alimentos..."
                          placeholderTextColor="#999"
                        />
                        {foodSearchTerm.length > 0 && (
                          <TouchableOpacity onPress={() => setFoodSearchTerm('')}>
                            <Ionicons name="close-circle" size={20} color="#666" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>

                    {/* Filtro por Categoria */}
                    <View style={styles.categoryFilter}>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {getFoodCategories() && Array.isArray(getFoodCategories()) && getFoodCategories().map((category) => (
                          <TouchableOpacity
                            key={category}
                            style={[
                              styles.categoryButton,
                              selectedFoodCategory === category && styles.categoryButtonSelected
                            ]}
                            onPress={() => setSelectedFoodCategory(category)}
                          >
                            <Text style={[
                              styles.categoryButtonText,
                              selectedFoodCategory === category && styles.categoryButtonTextSelected
                            ]}>
                              {category}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                    
                    {/* Seletor de Alimento */}
                    <View style={styles.foodSelectorContainer}>
                      <View style={styles.foodSelectorHeader}>
                        <Text style={styles.inputLabel}>
                          Alimentos ({getFilteredFoods().length})
                        </Text>
                        <View style={styles.foodSelectorActions}>
                          <TouchableOpacity 
                            style={[
                              styles.multiSelectButton,
                              isMultiSelectMode && styles.multiSelectButtonActive
                            ]}
                            onPress={toggleMultiSelectMode}
                          >
                            <Ionicons 
                              name={isMultiSelectMode ? "checkmark-circle" : "list"} 
                              size={16} 
                              color={isMultiSelectMode ? "#fff" : "#007AFF"} 
                            />
                            <Text style={[
                              styles.multiSelectButtonText,
                              isMultiSelectMode && styles.multiSelectButtonTextActive
                            ]}>
                              {isMultiSelectMode ? `Múltipla (${selectedFoodsForMeal.length})` : 'Seleção Múltipla'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                        {currentMeal.foods.length > 0 && (
                          <TouchableOpacity 
                            style={styles.saveTemplateButton}
                            onPress={saveAsTemplate}
                          >
                            <Ionicons name="bookmark-outline" size={16} color="#FF9800" />
                            <Text style={styles.saveTemplateText}>Salvar Template</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      
                      <ScrollView style={styles.foodLibrary} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                        {getFilteredFoods().length === 0 ? (
                          <View style={styles.emptySearchState}>
                            <Ionicons name="search" size={40} color="#ccc" />
                            <Text style={styles.emptySearchText}>
                              {foodSearchTerm ? 'Nenhum alimento encontrado' : 'Nenhum alimento nesta categoria'}
                            </Text>
                            <Text style={styles.emptySearchSubtext}>
                              {foodSearchTerm ? 'Tente outro termo de busca' : 'Selecione outra categoria'}
                            </Text>
                          </View>
                        ) : (
                          getFilteredFoods() && Array.isArray(getFilteredFoods()) && getFilteredFoods().map((food) => (
                            <TouchableOpacity
                              key={food.id}
                              style={[
                                styles.foodLibraryItem, 
                                selectedFoodForMeal?.id === food.id && styles.foodLibraryItemSelected,
                                isMultiSelectMode && selectedFoodsForMeal.find(f => f.id === food.id) && styles.foodLibraryItemSelectedMultiple
                              ]}
                              onPress={() => toggleFoodSelection(food)}
                            >
                              {isMultiSelectMode && (
                                <View style={styles.multiSelectIndicator}>
                                  <Ionicons 
                                    name={selectedFoodsForMeal.find(f => f.id === food.id) ? "checkmark-circle" : "radio-button-off"} 
                                    size={20} 
                                    color={selectedFoodsForMeal.find(f => f.id === food.id) ? "#4CAF50" : "#ccc"} 
                                  />
                                </View>
                              )}
                              <View style={styles.foodLibraryInfo}>
                                <Text style={styles.foodLibraryName}>{food.name}</Text>
                                <Text style={styles.foodLibraryCategory}>{food.category}</Text>
                              </View>
                              <View style={styles.foodLibraryNutrition}>
                                <Text style={styles.foodLibraryCalories}>{food.calories} kcal</Text>
                                <Text style={styles.foodLibraryMacros}>
                                  P:{food.protein}g C:{food.carbs}g G:{food.fat}g
                                </Text>
                              </View>
                            </TouchableOpacity>
                          ))
                        )}
                      </ScrollView>
                    </View>

                    {/* Configurar Quantidade */}
                    {(selectedFoodForMeal || (isMultiSelectMode && selectedFoodsForMeal.length > 0)) && (
                      <View style={styles.quantitySection}>
                        <Text style={styles.inputLabel}>
                          {isMultiSelectMode 
                            ? `Configurar ${selectedFoodsForMeal.length} alimentos selecionados`
                            : `Configurar: ${selectedFoodForMeal.name}`
                          }
                        </Text>
                        
                        {isMultiSelectMode && selectedFoodsForMeal.length > 0 && (
                          <View style={styles.selectedFoodsList}>
                            <Text style={styles.inputLabel}>Alimentos selecionados:</Text>
                            <ScrollView style={styles.selectedFoodsScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                              {selectedFoodsForMeal.map((food, index) => (
                                <View key={food.id} style={styles.selectedFoodItem}>
                                  <Text style={styles.selectedFoodName}>{food.name}</Text>
                                  <Text style={styles.selectedFoodCalories}>{food.calories} kcal/100g</Text>
                                  <TouchableOpacity onPress={() => toggleFoodSelection(food)}>
                                    <Ionicons name="close-circle" size={20} color="#f44336" />
                                  </TouchableOpacity>
                                </View>
                              ))}
                            </ScrollView>
                          </View>
                        )}
                        
                        <View style={styles.formGroupFlex}>
                          <Text style={styles.inputLabel}>Quantidade (g)</Text>
                          <TextInput
                            style={[
                              styles.input,
                              (!foodQuantityForDiet || parseFloat(foodQuantityForDiet) <= 0) && styles.searchInputContainer
                            ]}
                            value={foodQuantityForDiet}
                            onChangeText={(text) => {
                              // Permitir apenas números e ponto decimal
                              const numericValue = text.replace(/[^0-9.]/g, '');
                              setFoodQuantityForDiet(numericValue);
                            }}
                            placeholder="100"
                            keyboardType="numeric"
                            placeholderTextColor="#999"
                          />
                          {(!foodQuantityForDiet || parseFloat(foodQuantityForDiet) <= 0) && (
                            <Text style={styles.errorText}>Quantidade deve ser maior que 0</Text>
                          )}
                        </View>

                        <View style={styles.formGroupFlex}>
                          <Text style={styles.inputLabel}>Multiplicador (ex: 2x)</Text>
                          <TextInput
                            style={[
                              styles.input,
                              (!foodMultiplier || parseFloat(foodMultiplier) <= 0) && styles.searchInputContainer
                            ]}
                            value={foodMultiplier}
                            onChangeText={(text) => {
                              // Permitir apenas números e ponto decimal
                              const numericValue = text.replace(/[^0-9.]/g, '');
                              setFoodMultiplier(numericValue);
                            }}
                            placeholder="1"
                            keyboardType="numeric"
                            placeholderTextColor="#999"
                          />
                          {(!foodMultiplier || parseFloat(foodMultiplier) <= 0) && (
                            <Text style={styles.errorText}>Multiplicador deve ser maior que 0</Text>
                          )}
                        </View>
                        
                        {/* Preview Nutricional */}
                        <View style={styles.nutritionPreview}>
                          <Text style={styles.nutritionPreviewTitle}>Será adicionado:</Text>
                          {isMultiSelectMode ? (
                            <>
                              <Text style={styles.nutritionPreviewValue}>
                                {selectedFoodsForMeal.reduce((total, food) => 
                                  total + Math.round((food.calories * parseFloat(foodQuantityForDiet || '0') * parseFloat(foodMultiplier || '1')) / 100), 0
                                )} kcal (total de {selectedFoodsForMeal.length} alimentos)
                              </Text>
                              <Text style={styles.nutritionPreviewValue}>
                                {parseFloat(foodQuantityForDiet || '0') * parseFloat(foodMultiplier || '1')}g cada ({foodMultiplier}x {foodQuantityForDiet}g)
                              </Text>
                            </>
                          ) : (
                            <>
                              <Text style={styles.nutritionPreviewValue}>
                                {Math.round((selectedFoodForMeal.calories * parseFloat(foodQuantityForDiet || '0') * parseFloat(foodMultiplier || '1')) / 100)?.toString()} kcal
                              </Text>
                              <Text style={styles.nutritionPreviewValue}>
                                Total: {parseFloat(foodQuantityForDiet || '0') * parseFloat(foodMultiplier || '1')}g ({foodMultiplier}x {foodQuantityForDiet}g)
                              </Text>
                              <Text style={styles.nutritionPreviewMacros}>
                                P: {Math.round((selectedFoodForMeal.protein * parseFloat(foodQuantityForDiet || '0') * parseFloat(foodMultiplier || '1')) / 100)?.toString()}g | 
                                C: {Math.round((selectedFoodForMeal.carbs * parseFloat(foodQuantityForDiet || '0') * parseFloat(foodMultiplier || '1')) / 100)?.toString()}g | 
                                G: {Math.round((selectedFoodForMeal.fat * parseFloat(foodQuantityForDiet || '0') * parseFloat(foodMultiplier || '1')) / 100)?.toString()}g
                              </Text>
                            </>
                          )}
                        </View>
                        
                        {/* Sugestões de quantidade */}
                        <View style={styles.quantitySuggestions}>
                          <Text style={styles.inputLabel}>
                            {isMultiSelectMode 
                              ? 'Quantidade para cada alimento:' 
                              : `Sugestões para ${selectedFoodForMeal.name}:`
                            }
                          </Text>
                          <View style={styles.timeSuggestions}>
                            {isMultiSelectMode ? (
                              [
                                { label: '50g', quantity: '50' },
                                { label: '100g', quantity: '100' },
                                { label: '150g', quantity: '150' },
                                { label: '200g', quantity: '200' }
                              ].map((suggestion, index) => (
                                <TouchableOpacity
                                  key={index}
                                  style={styles.timeSuggestion}
                                  onPress={() => setFoodQuantityForDiet(suggestion.quantity)}
                                >
                                  <Text style={styles.timeSuggestionText}>{suggestion.label}</Text>
                                </TouchableOpacity>
                              ))
                            ) : (
                              getSmartSuggestions(selectedFoodForMeal.name).map((suggestion, index) => (
                                <TouchableOpacity
                                  key={index}
                                  style={styles.timeSuggestion}
                                  onPress={() => setFoodQuantityForDiet(suggestion.quantity)}
                                >
                                  <Text style={styles.timeSuggestionText}>{suggestion.label}</Text>
                                </TouchableOpacity>
                              ))
                            )}
                          </View>
                        </View>

                        {/* Sugestões de multiplicador */}
                        <View style={styles.quantitySuggestions}>
                          <Text style={styles.inputLabel}>Multiplicador:</Text>
                          <View style={styles.timeSuggestions}>
                            {['1', '2', '3', '4'].map((multiplier) => (
                              <TouchableOpacity
                                key={multiplier}
                                style={styles.timeSuggestion}
                                onPress={() => setFoodMultiplier(multiplier)}
                              >
                                <Text style={styles.timeSuggestionText}>{multiplier}x</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                        
                        <TouchableOpacity 
                          style={[
                            styles.addFoodButton,
                            (!foodQuantityForDiet || parseFloat(foodQuantityForDiet) <= 0 || !foodMultiplier || parseFloat(foodMultiplier) <= 0) && styles.addMealButtonDisabled
                          ]}
                          onPress={isMultiSelectMode ? addMultipleFoodsToMeal : addFoodToCurrentMeal}
                          disabled={!foodQuantityForDiet || parseFloat(foodQuantityForDiet) <= 0 || !foodMultiplier || parseFloat(foodMultiplier) <= 0}
                        >
                          <Ionicons name="add" size={20} color="white" />
                          <Text style={styles.addFoodButtonText}>
                            {isMultiSelectMode 
                              ? `Adicionar ${selectedFoodsForMeal.length} Alimentos`
                              : 'Adicionar à Refeição'
                            }
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>

                  {/* Validações e Feedback */}
                  {!currentMeal.name.trim() && (
                    <View style={styles.validationMessage}>
                      <Ionicons name="alert-circle" size={16} color="#FF5722" />
                      <Text style={styles.validationText}>Digite um nome para a refeição</Text>
                    </View>
                  )}
                  
                  {currentMeal.name.trim() && currentMeal.foods.length === 0 && (
                    <View style={styles.validationMessage}>
                      <Ionicons name="alert-circle" size={16} color="#FF9800" />
                      <Text style={styles.validationText}>Adicione pelo menos um alimento à refeição</Text>
                    </View>
                  )}

                  {/* Botão para Adicionar Refeição */}
                  <TouchableOpacity 
                    style={[
                      styles.addMealButton, 
                      (!currentMeal.name.trim() || currentMeal.foods.length === 0) && styles.addMealButtonDisabled
                    ]}
                    onPress={addMealToDiet}
                    disabled={!currentMeal.name.trim() || currentMeal.foods.length === 0}
                  >
                    <Ionicons name="restaurant" size={20} color="white" />
                    <Text style={styles.addMealButtonText}>
                      {!currentMeal.name.trim() 
                        ? 'Digite o nome da refeição'
                        : currentMeal.foods.length === 0
                        ? 'Adicione alimentos à refeição'
                        : `Adicionar "${currentMeal.name}" à Dieta`
                      }
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    setNewDietName('');
                    setNewDietMeals([]);
                    setCurrentMeal({ name: '', time: '', foods: [] });
                    setSelectedFoodForMeal(null);
                    setSelectedFoodsForMeal([]);
                    setIsMultiSelectMode(false);
                    setFoodQuantityForDiet('100');
                    setFoodMultiplier('1');
                    setShowDietNameModal(false);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.modalButton, styles.confirmButton, (!newDietName.trim() || newDietMeals.length === 0) && styles.confirmButtonDisabled]}
                  onPress={confirmCreateDiet}
                  disabled={!newDietName.trim() || newDietMeals.length === 0}
                >
                  <Text style={styles.confirmButtonText}>
                    Criar Dieta ({newDietMeals.reduce((total, meal) => 
                      total + (meal.foods ? 
                        meal.foods.reduce((mealTotal, foodEntry) => 
                          mealTotal + (foodEntry.food.calories * foodEntry.quantity / 100), 0
                        ) : 0
                      ), 0
                    ).toFixed(0)} kcal)
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      );
    }

    // Modal para editar dieta
    if (showEditDietModal && currentEditDiet) {
      return (
        <Modal
          visible={showEditDietModal}
          transparent={true}
          animationType="slide"
          onRequestClose={cancelEditDiet}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Editar Dieta: {currentEditDiet.name}</Text>
                <TouchableOpacity onPress={cancelEditDiet}>
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                {/* Nome da Dieta */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Nome da Dieta</Text>
                  <TextInput
                    style={styles.input}
                    value={currentEditDiet.name}
                    onChangeText={(text) => setCurrentEditDiet(prev => prev ? {...prev, name: text} : null)}
                    placeholder="Ex: Dieta para Ganho de Massa"
                    placeholderTextColor="#999"
                  />
                </View>

                {/* Seletor de Dias */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Selecione o dia para editar refeições:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.daySelector}>
                    {(['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'] as DayOfWeek[]).map((day) => (
                      <TouchableOpacity
                        key={day}
                        style={[
                          styles.dayButton,
                          selectedWorkoutDay === day && styles.dayButtonActive
                        ]}
                        onPress={() => setSelectedWorkoutDay(day)}
                      >
                        <Text style={[
                          styles.dayButtonText,
                          selectedWorkoutDay === day && styles.dayButtonTextActive
                        ]}>
                          {day.charAt(0).toUpperCase() + day.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* Refeições do Dia Selecionado */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>
                    Refeições para {selectedWorkoutDay} ({(currentEditDiet.weeklyMeals[selectedWorkoutDay] || []).length})
                  </Text>
                  
                  {(currentEditDiet.weeklyMeals[selectedWorkoutDay] || []).length === 0 ? (
                    <View style={styles.emptyState}>
                      <Ionicons name="restaurant" size={50} color="#ccc" />
                      <Text style={styles.emptyStateText}>Nenhuma refeição para {selectedWorkoutDay}</Text>
                      <Text style={styles.emptyStateSubtext}>As refeições podem ser adicionadas na tela principal</Text>
                    </View>
                  ) : (
                    (currentEditDiet.weeklyMeals[selectedWorkoutDay] || []).map((meal) => (
                      <View key={meal.id} style={styles.mealEditCard}>
                        <View style={styles.mealEditHeader}>
                          <Text style={styles.mealEditName}>{meal.name}</Text>
                          <Text style={styles.mealEditTime}>{meal.time}</Text>
                          <TouchableOpacity
                            onPress={() => {
                              const updatedMeals = {
                                ...currentEditDiet.weeklyMeals,
                                [selectedWorkoutDay]: currentEditDiet.weeklyMeals[selectedWorkoutDay]?.filter(m => m.id !== meal.id) || []
                              };
                              setCurrentEditDiet(prev => prev ? {...prev, weeklyMeals: updatedMeals} : null);
                            }}
                          >
                            <Ionicons name="trash-outline" size={18} color="#f44336" />
                          </TouchableOpacity>
                        </View>
                        <Text style={styles.mealEditInfo}>
                          {meal.foods.length} alimentos - {meal.foods.reduce((total, foodEntry) => 
                            total + (foodEntry.food.calories * foodEntry.quantity / 100), 0
                          ).toFixed(0)} kcal
                        </Text>
                        {/* Lista de alimentos da refeição */}
                        {Array.isArray(meal.foods) && meal.foods.map((foodEntry, index) => (
                          <View key={index} style={styles.foodEditItem}>
                            <Text style={styles.foodEditName}>{foodEntry.food.name}</Text>
                            <Text style={styles.foodEditQuantity}>{foodEntry.quantity}g</Text>
                          </View>
                        ))}
                      </View>
                    ))
                  )}
                </View>
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={cancelEditDiet}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.modalButton, styles.confirmButton]}
                  onPress={saveEditedDiet}
                >
                  <Text style={styles.confirmButtonText}>Salvar Alterações</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      );
    }

    // Modal de Meta e Objetivos
    if (modalType === 'goals') {
      return (
        <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity 
                onPress={() => setShowModal(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Nova Meta</Text>
              <TouchableOpacity 
                onPress={createGoal}
                style={styles.saveButton}
              >
                <Text style={styles.saveButtonText}>Salvar</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalContent} contentContainerStyle={{padding: 16}}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Tipo de Meta</Text>
                <View style={styles.goalTypeGrid}>
                  {[
                    { type: 'weight_loss', label: 'Perda de Peso', icon: 'trending-down' },
                    { type: 'muscle_gain', label: 'Ganho de Massa', icon: 'fitness' },
                    { type: 'strength', label: 'Força', icon: 'barbell' },
                    { type: 'endurance', label: 'Resistência', icon: 'heart' }
                  ].map((goalType) => (
                    <TouchableOpacity
                      key={goalType.type}
                      style={[
                        styles.goalTypeCard,
                        newGoal.type === goalType.type && styles.goalTypeCardSelected
                      ]}
                      onPress={() => setNewGoal(prev => ({ ...prev, type: goalType.type as any }))}
                    >
                      <Ionicons 
                        name={goalType.icon as any} 
                        size={32} 
                        color={newGoal.type === goalType.type ? '#007AFF' : '#666'} 
                      />
                      <Text style={[
                        styles.goalTypeText,
                        newGoal.type === goalType.type && styles.goalTypeTextSelected
                      ]}>
                        {goalType.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Título da Meta</Text>
                <TextInput
                  style={styles.input}
                  value={newGoal.title}
                  onChangeText={(text) => setNewGoal(prev => ({ ...prev, title: text }))}
                  placeholder="Ex: Perder 5kg em 3 meses"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Descrição</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={newGoal.description}
                  onChangeText={(text) => setNewGoal(prev => ({ ...prev, description: text }))}
                  placeholder="Descreva sua meta e como pretende alcançá-la"
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={4}
                />
              </View>

              <View style={styles.formRow}>
                <View style={styles.formGroupFlex}>
                  <Text style={styles.formLabel}>Valor Atual</Text>
                  <TextInput
                    style={styles.input}
                    value={newGoal.currentValue.toString()}
                    onChangeText={(text) => setNewGoal(prev => ({ ...prev, currentValue: parseFloat(text) || 0 }))}
                    placeholder="0"
                    keyboardType="numeric"
                    placeholderTextColor="#999"
                  />
                </View>

                <View style={styles.formGroupFlex}>
                  <Text style={styles.formLabel}>Meta</Text>
                  <TextInput
                    style={styles.input}
                    value={newGoal.targetValue.toString()}
                    onChangeText={(text) => setNewGoal(prev => ({ ...prev, targetValue: parseFloat(text) || 0 }))}
                    placeholder="0"
                    keyboardType="numeric"
                    placeholderTextColor="#999"
                  />
                </View>

                <View style={styles.formGroupSmall}>
                  <Text style={styles.formLabel}>Unidade</Text>
                  <TextInput
                    style={styles.input}
                    value={newGoal.unit}
                    onChangeText={(text) => setNewGoal(prev => ({ ...prev, unit: text }))}
                    placeholder="kg"
                    placeholderTextColor="#999"
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Data Limite</Text>
                <TextInput
                  style={styles.input}
                  value={newGoal.deadline}
                  onChangeText={(text) => setNewGoal(prev => ({ ...prev, deadline: text }))}
                  placeholder="DD/MM/AAAA"
                  placeholderTextColor="#999"
                />
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      );
    }
    
    if (modalType === 'exerciseDetails' && selectedExercise) {
      return (
        <Modal
          visible={showModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{selectedExercise.name}</Text>
                <TouchableOpacity onPress={() => setShowModal(false)}>
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                {/* Informações Básicas */}
                <View style={styles.exerciseBasicInfo}>
                  <View style={styles.exerciseInfoRow}>
                    <View style={styles.exerciseInfoItem}>
                      <Text style={styles.exerciseInfoLabel}>Séries</Text>
                      <Text style={styles.exerciseInfoValue}>{selectedExercise.sets?.toString()}</Text>
                    </View>
                    <View style={styles.exerciseInfoItem}>
                      <Text style={styles.exerciseInfoLabel}>Repetições</Text>
                      <Text style={styles.exerciseInfoValue}>{selectedExercise.reps?.toString()}</Text>
                    </View>
                    <View style={styles.exerciseInfoItem}>
                      <Text style={styles.exerciseInfoLabel}>Peso</Text>
                      <Text style={styles.exerciseInfoValue}>{selectedExercise.weight?.toString()}kg</Text>
                    </View>
                  </View>
                  
                  <View style={styles.exerciseMetaInfo}>
                    <View style={styles.difficultyBadge}>
                      <Ionicons name="fitness" size={16} color="#FF9800" />
                      <Text style={styles.difficultyText}>{selectedExercise.difficulty}</Text>
                    </View>
                    <View style={styles.categoryBadge}>
                      <Text style={styles.categoryText}>{selectedExercise.category}</Text>
                    </View>
                  </View>
                </View>

                {/* Vídeo Demonstrativo */}
                <View style={styles.videoContainer}>
                  <TouchableOpacity 
                    style={styles.videoButton}
                    onPress={() => {
                      if (selectedExercise.videoUrl) {
                        openVideoURL(selectedExercise.videoUrl);
                      }
                    }}
                  >
                    <View style={styles.videoPlaceholder}>
                      <Ionicons name="logo-youtube" size={60} color="#FF0000" />
                      <Text style={styles.videoText}>Vídeo Demonstrativo</Text>
                      <Text style={styles.videoSubtext}>Toque para assistir no YouTube</Text>
                    </View>
                  </TouchableOpacity>
                </View>

                {/* Músculos Trabalhados */}
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>💪 Músculos Trabalhados</Text>
                  <View style={styles.musclesList}>
                    {Array.isArray(selectedExercise.musclesWorked) && selectedExercise.musclesWorked.map((muscle, index) => (
                      <View key={index} style={styles.muscleItem}>
                        <Text style={styles.muscleText}>{muscle}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Equipamentos */}
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>🏋️ Equipamentos</Text>
                  <View style={styles.equipmentList}>
                    {Array.isArray(selectedExercise.equipment) && selectedExercise.equipment.map((item, index) => (
                      <View key={index} style={styles.equipmentItem}>
                        <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                        <Text style={styles.equipmentText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Instruções */}
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>📋 Instruções</Text>
                  {Array.isArray(selectedExercise.instructions) && selectedExercise.instructions.map((instruction, index) => (
                    <View key={index} style={styles.instructionItem}>
                      <View style={styles.instructionNumber}>
                        <Text style={styles.instructionNumberText}>{(index + 1)?.toString()}</Text>
                      </View>
                      <Text style={styles.instructionText}>{instruction}</Text>
                    </View>
                  ))}
                </View>

                {/* Dicas */}
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>💡 Dicas Importantes</Text>
                  {Array.isArray(selectedExercise.tips) && selectedExercise.tips.map((tip, index) => (
                    <View key={index} style={styles.tipItem}>
                      <Ionicons name="bulb" size={16} color="#FFD700" />
                      <Text style={styles.tipText}>{tip}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      );
    }

    if (modalType === 'newExercise') {
      return (
        <Modal
          visible={showModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Novo Exercício</Text>
                <TouchableOpacity onPress={() => setShowModal(false)}>
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                {/* Seleção de Treino */}
                <Text style={styles.inputLabel}>Treino</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.workoutSelector}>
                  {workoutPlans.map((plan) => (
                    <TouchableOpacity
                      key={plan.id}
                      style={[
                        styles.workoutSelectorItem,
                        selectedWorkoutForNewExercise === plan.id && styles.workoutSelectorItemActive
                      ]}
                      onPress={() => setSelectedWorkoutForNewExercise(plan.id)}
                    >
                      <Text style={[
                        styles.workoutSelectorText,
                        selectedWorkoutForNewExercise === plan.id && styles.workoutSelectorTextActive
                      ]}>
                        {plan.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Nome do Exercício */}
                <Text style={styles.inputLabel}>Nome do Exercício</Text>
                <TextInput
                  style={styles.textInput}
                  value={newExercise.name}
                  onChangeText={(text) => setNewExercise(prev => ({ ...prev, name: text }))}
                  placeholder="Ex: Supino Reto"
                  placeholderTextColor="#999"
                />

                {/* Categoria */}
                <Text style={styles.inputLabel}>Categoria</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categorySelector}>
                  {categories.map((category) => (
                    <TouchableOpacity
                      key={category}
                      style={[
                        styles.categorySelectorItem,
                        newExercise.category === category && styles.categorySelectorItemActive
                      ]}
                      onPress={() => setNewExercise(prev => ({ ...prev, category }))}
                    >
                      <Text style={[
                        styles.categorySelectorText,
                        newExercise.category === category && styles.categorySelectorTextActive
                      ]}>
                        {category}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Séries e Repetições */}
                <View style={styles.inputRow}>
                  <View style={styles.inputColumn}>
                    <Text style={styles.inputLabel}>Séries</Text>
                    <View style={styles.numberInputContainer}>
                      <TouchableOpacity
                        style={styles.numberButton}
                        onPress={() => setNewExercise(prev => ({ ...prev, sets: Math.max(1, prev.sets - 1) }))}
                      >
                        <Ionicons name="remove" size={20} color="#666" />
                      </TouchableOpacity>
                      <Text style={styles.numberValue}>{newExercise.sets?.toString()}</Text>
                      <TouchableOpacity
                        style={styles.numberButton}
                        onPress={() => setNewExercise(prev => ({ ...prev, sets: prev.sets + 1 }))}
                      >
                        <Ionicons name="add" size={20} color="#666" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.inputColumn}>
                    <Text style={styles.inputLabel}>Repetições</Text>
                    <View style={styles.numberInputContainer}>
                      <TouchableOpacity
                        style={styles.numberButton}
                        onPress={() => setNewExercise(prev => ({ ...prev, reps: Math.max(1, prev.reps - 1) }))}
                      >
                        <Ionicons name="remove" size={20} color="#666" />
                      </TouchableOpacity>
                      <Text style={styles.numberValue}>{newExercise.reps?.toString()}</Text>
                      <TouchableOpacity
                        style={styles.numberButton}
                        onPress={() => setNewExercise(prev => ({ ...prev, reps: prev.reps + 1 }))}
                      >
                        <Ionicons name="add" size={20} color="#666" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {/* Peso e Tempo de Descanso */}
                <View style={styles.inputRow}>
                  <View style={styles.inputColumn}>
                    <Text style={styles.inputLabel}>Peso (kg)</Text>
                    <View style={styles.numberInputContainer}>
                      <TouchableOpacity
                        style={styles.numberButton}
                        onPress={() => setNewExercise(prev => ({ ...prev, weight: Math.max(0, prev.weight - 2.5) }))}
                      >
                        <Ionicons name="remove" size={20} color="#666" />
                      </TouchableOpacity>
                      <Text style={styles.numberValue}>{newExercise.weight?.toString()}</Text>
                      <TouchableOpacity
                        style={styles.numberButton}
                        onPress={() => setNewExercise(prev => ({ ...prev, weight: prev.weight + 2.5 }))}
                      >
                        <Ionicons name="add" size={20} color="#666" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.inputColumn}>
                    <Text style={styles.inputLabel}>Descanso (s)</Text>
                    <View style={styles.numberInputContainer}>
                      <TouchableOpacity
                        style={styles.numberButton}
                        onPress={() => setNewExercise(prev => ({ ...prev, restTime: Math.max(30, prev.restTime - 15) }))}
                      >
                        <Ionicons name="remove" size={20} color="#666" />
                      </TouchableOpacity>
                      <Text style={styles.numberValue}>{newExercise.restTime?.toString()}</Text>
                      <TouchableOpacity
                        style={styles.numberButton}
                        onPress={() => setNewExercise(prev => ({ ...prev, restTime: prev.restTime + 15 }))}
                      >
                        <Ionicons name="add" size={20} color="#666" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {/* Botões de Ação */}
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setShowModal(false)}
                  >
                    <Text style={styles.cancelButtonText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.createButton,
                      (!selectedWorkoutForNewExercise || !newExercise.name.trim()) && styles.createButtonDisabled
                    ]}
                    onPress={createNewExercise}
                    disabled={!selectedWorkoutForNewExercise || !newExercise.name.trim()}
                  >
                    <Text style={styles.createButtonText}>Criar Exercício</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      );
    }

    return (
      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {modalType === 'workout' ? 'Novo Treino' : 
                 modalType === 'diet' ? 'Nova Dieta' : 'Nova Funcionalidade'}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              <Text style={styles.modalText}>
                {modalType === 'workout' ? 
                  'Em breve você poderá criar novos treinos personalizados!' :
                 modalType === 'diet' ?
                  'Em breve você poderá criar novos planos alimentares!' :
                  'Funcionalidade em desenvolvimento!'}
              </Text>
              
              <View style={styles.modalFeatures}>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                  <Text style={styles.featureText}>
                    {modalType === 'workout' ? 'Exercícios personalizados' : 'Refeições customizadas'}
                  </Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                  <Text style={styles.featureText}>
                    {modalType === 'workout' ? 'Controle de séries e repetições' : 'Cálculo automático de macros'}
                  </Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                  <Text style={styles.featureText}>
                    {modalType === 'workout' ? 'Progressão de cargas' : 'Controle de calorias'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setShowModal(false)}
              >
                <Text style={styles.modalButtonText}>Entendi</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  if (modalType === 'createWorkout') {
    return (
      <Modal
        visible={showModal}
        transparent={true}
        animationType="slide"
        onRequestClose={resetCustomWorkoutModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Criar Treino Personalizado</Text>
              <TouchableOpacity onPress={resetCustomWorkoutModal}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Nome do Treino</Text>
              <TextInput
                style={styles.input}
                value={customWorkoutName}
                onChangeText={setCustomWorkoutName}
                placeholder="Ex: Treino de Peito e Tríceps"
              />

              {/* Seleção de Dias da Semana */}
              <View style={styles.daySelectionContainer}>
                <Text style={styles.inputLabel}>Dias da Semana</Text>
                <Text style={styles.inputSubtitle}>Selecione os dias em que este treino será realizado</Text>
                <View style={styles.daysSelector}>
                  {(['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'] as DayOfWeek[]).map((day) => {
                    const dayNames: Record<DayOfWeek, string> = {
                      'segunda': 'SEG',
                      'terca': 'TER',
                      'quarta': 'QUA', 
                      'quinta': 'QUI',
                      'sexta': 'SEX',
                      'sabado': 'SAB',
                      'domingo': 'DOM'
                    };
                    
                    const isSelected = selectedDaysForWorkout.includes(day);
                    
                    return (
                      <TouchableOpacity
                        key={day}
                        style={[
                          styles.customDaySelector,
                          isSelected && styles.customDaySelectorSelected
                        ]}
                        onPress={() => toggleDaySelection(day)}
                        activeOpacity={0.7}
                      >
                        <Text style={[
                          styles.customDaySelectorText,
                          isSelected && styles.customDaySelectorTextSelected
                        ]}>
                          {dayNames[day]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={styles.selectedDaysInfo}>
                  {selectedDaysForWorkout.length} dia(s) selecionado(s)
                </Text>
              </View>

              <Text style={styles.inputLabel}>Exercícios Selecionados ({selectedExercisesForWorkout.length})</Text>
              {selectedExercisesForWorkout.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="fitness" size={50} color="#ccc" />
                  <Text style={styles.emptyStateText}>Nenhum exercício selecionado</Text>
                  <Text style={styles.emptyStateSubtext}>Adicione exercícios da biblioteca abaixo</Text>
                </View>
              ) : (
                selectedExercisesForWorkout.map((exercise, index) => (
                <View key={exercise.id} style={styles.selectedExerciseCard}>
                  <View style={styles.exerciseCardHeader}>
                    <Text style={styles.exerciseName}>{exercise.name}</Text>
                    <TouchableOpacity onPress={() => removeExerciseFromWorkout(exercise.id)}>
                      <Ionicons name="trash" size={20} color="#FF5722" />
                    </TouchableOpacity>
                  </View>
                  
                  <View style={styles.exerciseControls}>
                    <View style={styles.exerciseControlGroup}>
                      <Text style={styles.controlLabel}>Séries:</Text>
                      <TextInput
                        style={styles.controlInput}
                        value={exercise.sets?.toString() || '1'}
                        onChangeText={(text) => updateExerciseInWorkout(exercise.id, 'sets', parseInt(text) || 1)}
                        keyboardType="numeric"
                      />
                    </View>
                    
                    <View style={styles.exerciseControlGroup}>
                      <Text style={styles.controlLabel}>Reps:</Text>
                      <TextInput
                        style={styles.controlInput}
                        value={exercise.reps?.toString() || '1'}
                        onChangeText={(text) => updateExerciseInWorkout(exercise.id, 'reps', text)}
                      />
                    </View>
                    
                    <View style={styles.exerciseControlGroup}>
                      <Text style={styles.controlLabel}>Peso (kg):</Text>
                      <TextInput
                        style={styles.controlInput}
                        value={exercise.weight?.toString() || '0'}
                        onChangeText={(text) => updateExerciseInWorkout(exercise.id, 'weight', parseFloat(text) || 0)}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                </View>
              )))}

              <Text style={styles.inputLabel}>Adicionar Exercícios</Text>
              <View style={styles.exerciseLibrary}>
                {exerciseLibrary.map((exercise) => (
                  <TouchableOpacity
                    key={exercise.id}
                    style={styles.libraryExerciseCard}
                    onPress={() => addExerciseToWorkout(exercise)}
                  >
                    <View style={styles.libraryExerciseInfo}>
                      <Text style={styles.libraryExerciseName}>{exercise.name}</Text>
                      <Text style={styles.libraryExerciseMuscle}>{exercise.muscle}</Text>
                      <Text style={styles.libraryExerciseDifficulty}>{exercise.difficulty}</Text>
                    </View>
                    <Ionicons name="add-circle" size={24} color="#4CAF50" />
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={resetCustomWorkoutModal}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={createCustomWorkout}
              >
                <Text style={styles.confirmButtonText}>Criar Treino</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // Modal para editar exercício
  if (modalType === 'editExercise' && editingExercise) {
    return (
      <Modal
        visible={showModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowModal(false);
          setModalType('');
          setEditingExercise(null);
          setEditingWorkoutId('');
          setEditExerciseName('');
          setEditExerciseSets('');
          setEditExerciseReps('');
          setEditExerciseWeight('');
          setEditExerciseRestTime('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Editar Exercício</Text>
              <TouchableOpacity onPress={() => {
                setShowModal(false);
                setModalType('');
                setEditingExercise(null);
                setEditingWorkoutId('');
                setEditExerciseName('');
                setEditExerciseSets('');
                setEditExerciseReps('');
                setEditExerciseWeight('');
                setEditExerciseRestTime('');
              }}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Nome do Exercício</Text>
                <TextInput
                  style={styles.input}
                  value={editExerciseName}
                  onChangeText={setEditExerciseName}
                  placeholder="Nome do exercício"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.formRow}>
                <View style={styles.formGroupFlex}>
                  <Text style={styles.formLabel}>Séries</Text>
                  <TextInput
                    style={styles.input}
                    value={editExerciseSets}
                    onChangeText={setEditExerciseSets}
                    placeholder="3"
                    keyboardType="numeric"
                    placeholderTextColor="#999"
                  />
                </View>

                <View style={styles.formGroupFlex}>
                  <Text style={styles.formLabel}>Repetições</Text>
                  <TextInput
                    style={styles.input}
                    value={editExerciseReps}
                    onChangeText={setEditExerciseReps}
                    placeholder="12"
                    placeholderTextColor="#999"
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={styles.formGroupFlex}>
                  <Text style={styles.formLabel}>Peso (kg)</Text>
                  <TextInput
                    style={styles.input}
                    value={editExerciseWeight}
                    onChangeText={setEditExerciseWeight}
                    placeholder="0"
                    keyboardType="numeric"
                    placeholderTextColor="#999"
                  />
                </View>

                <View style={styles.formGroupFlex}>
                  <Text style={styles.formLabel}>Descanso (min)</Text>
                  <TextInput
                    style={styles.input}
                    value={editExerciseRestTime}
                    onChangeText={setEditExerciseRestTime}
                    placeholder="60"
                    keyboardType="numeric"
                    placeholderTextColor="#999"
                  />
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowModal(false);
                  setModalType('');
                  setEditingExercise(null);
                  setEditingWorkoutId('');
                  setEditExerciseName('');
                  setEditExerciseSets('');
                  setEditExerciseReps('');
                  setEditExerciseWeight('');
                  setEditExerciseRestTime('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={saveEditedExercise}
              >
                <Text style={styles.confirmButtonText}>Salvar Alterações</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // Modal para editar treino
  if (modalType === 'editWorkout' && editingWorkout) {
    const currentDayExercises = Array.isArray(editingWorkout?.weeklyExercises?.[selectedWorkoutDay]) 
      ? editingWorkout.weeklyExercises[selectedWorkoutDay] 
      : [];
    const daysOfWeek: DayOfWeek[] = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];
    const dayNames: Record<DayOfWeek, string> = {
      'segunda': 'Segunda',
      'terca': 'Terça', 
      'quarta': 'Quarta',
      'quinta': 'Quinta',
      'sexta': 'Sexta',
      'sabado': 'Sábado',
      'domingo': 'Domingo'
    };

    // Verificação de segurança para evitar erros
    if (!editingWorkout || !editingWorkout.weeklyExercises) {
      return null;
    }
    
    return (
      <Modal
        visible={showModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowModal(false);
          setModalType('');
          setEditingWorkout(null);
          setEditingWorkoutName('');
          setIsEditingWorkout(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '95%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Editar Treino</Text>
              <TouchableOpacity 
                onPress={() => {
                  setShowModal(false);
                  setModalType('');
                  setEditingWorkout(null);
                  setEditingWorkoutName('');
                  setIsEditingWorkout(false);
                }}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Nome do Treino</Text>
              <TextInput
                style={styles.input}
                value={editingWorkoutName}
                onChangeText={setEditingWorkoutName}
                placeholder="Digite o nome do treino"
                autoCapitalize="words"
              />

              {/* Seleção de Dias da Semana */}
              <View style={styles.daySelectionContainer}>
                <Text style={styles.inputLabel}>Dias da Semana</Text>
                <Text style={styles.inputSubtitle}>Selecione os dias em que este treino será realizado</Text>
                <View style={styles.daysSelector}>
                  {Array.isArray(daysOfWeek) && daysOfWeek.map((day) => {
                    const dayNames: Record<DayOfWeek, string> = {
                      'segunda': 'SEG',
                      'terca': 'TER',
                      'quarta': 'QUA', 
                      'quinta': 'QUI',
                      'sexta': 'SEX',
                      'sabado': 'SAB',
                      'domingo': 'DOM'
                    };
                    
                    const exercisesCount = editingWorkout?.weeklyExercises?.[day]?.length || 0;
                    const isSelected = selectedDaysForEdit.includes(day);
                    
                    return (
                      <TouchableOpacity
                        key={day}
                        style={[
                          styles.customDaySelector,
                          isSelected && styles.customDaySelectorSelected
                        ]}
                        onPress={() => toggleDaySelectionForEdit(day)}
                        activeOpacity={0.7}
                      >
                        <Text style={[
                          styles.customDaySelectorText,
                          isSelected && styles.customDaySelectorTextSelected
                        ]}>
                          {dayNames[day]}
                        </Text>
                        {exercisesCount > 0 && (
                          <View style={styles.exerciseCountIndicator}>
                            <Text style={styles.exerciseCountIndicatorText}>{exercisesCount}</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={styles.selectedDaysInfo}>
                  {selectedDaysForEdit.length} dia(s) selecionado(s)
                </Text>
              </View>
            {showAddExerciseSection && (
              <View style={styles.addExerciseSectionContainer}>
                <View style={styles.addExerciseSectionHeader}>
                  <Text style={styles.addExerciseSectionTitle}>Adicionar Exercício</Text>
                  <TouchableOpacity
                    onPress={() => setShowAddExerciseSection(false)}
                    style={styles.closeAddExerciseSection}
                  >
                    <Ionicons name="close" size={20} color="#666" />
                  </TouchableOpacity>
                </View>

                {/* Busca e Filtros */}
                <View style={styles.searchSection}>
                  <View style={styles.inputColumn}>
                    <Text style={styles.inputLabel}>Buscar Exercício</Text>
                    <TextInput
                      style={styles.input}
                      value={exerciseSearchTerm}
                      onChangeText={setExerciseSearchTerm}
                      placeholder="Digite o nome do exercício ou músculo"
                      autoCapitalize="words"
                    />
                  </View>

                  <View style={styles.inputColumn}>
                    <Text style={styles.inputLabel}>Filtrar por Músculo</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.muscleFilterContainer}>
                      {getMuscleGroups() && getMuscleGroups().map((muscle) => (
                        <TouchableOpacity
                          key={muscle}
                          style={[
                            styles.muscleFilterChip,
                            selectedMuscleFilter === muscle && styles.muscleFilterChipSelected
                          ]}
                          onPress={() => setSelectedMuscleFilter(muscle)}
                        >
                          <Text style={[
                            styles.muscleFilterChipText,
                            selectedMuscleFilter === muscle && styles.muscleFilterChipTextSelected
                          ]}>
                            {muscle}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </View>

                {/* Lista de exercícios disponíveis */}
                <ScrollView style={styles.exerciseList} nestedScrollEnabled={true}>
                  {getFilteredExercises() && getFilteredExercises().map((exercise, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.exerciseItem,
                        selectedExerciseToAdd?.id === exercise.id && styles.exerciseItemSelected
                      ]}
                      onPress={() => setSelectedExerciseToAdd(exercise)}
                    >
                      <View style={styles.exerciseInfo}>
                        <Text style={styles.exerciseName}>{exercise.name}</Text>
                        <Text style={styles.exerciseMuscle}>{exercise.muscle}</Text>
                        <Text style={styles.exerciseDifficulty}>{exercise.difficulty}</Text>
                      </View>
                      {selectedExerciseToAdd?.id === exercise.id && (
                        <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Configurações do exercício selecionado */}
                {selectedExerciseToAdd && (
                  <View style={styles.exerciseConfigSection}>
                    <Text style={styles.exerciseConfigTitle}>Configurar: {selectedExerciseToAdd.name}</Text>
                    
                    <View style={styles.exerciseConfigRow}>
                      <View style={styles.exerciseConfigItem}>
                        <Text style={styles.exerciseConfigLabel}>Séries</Text>
                        <TextInput
                          style={styles.exerciseConfigInput}
                          value={newExerciseSets}
                          onChangeText={setNewExerciseSets}
                          keyboardType="numeric"
                          placeholder="3"
                        />
                      </View>
                      
                      <View style={styles.exerciseConfigItem}>
                        <Text style={styles.exerciseConfigLabel}>Repetições</Text>
                        <TextInput
                          style={styles.exerciseConfigInput}
                          value={newExerciseReps}
                          onChangeText={setNewExerciseReps}
                          placeholder="10"
                        />
                      </View>
                      
                      <View style={styles.exerciseConfigItem}>
                        <Text style={styles.exerciseConfigLabel}>Peso (kg)</Text>
                        <TextInput
                          style={styles.exerciseConfigInput}
                          value={newExerciseWeight}
                          onChangeText={setNewExerciseWeight}
                          keyboardType="numeric"
                          placeholder="20"
                        />
                      </View>
                    </View>

                    <TouchableOpacity
                      style={styles.addExerciseToWorkoutButton}
                      onPress={() => {
                        if (selectedExerciseToAdd && editingWorkout) {
                          const newExercise = {
                            ...selectedExerciseToAdd,
                            id: `ex${Date.now()}_${Math.random()}`,
                            sets: parseInt(newExerciseSets) || 3,
                            reps: newExerciseReps || '10',
                            weight: parseFloat(newExerciseWeight) || 0,
                            completed: false
                          };

                          const currentExercises = editingWorkout.weeklyExercises[selectedWorkoutDay] || [];
                          const updatedExercises = [...currentExercises, newExercise];

                          const updatedWorkout = {
                            ...editingWorkout,
                            weeklyExercises: {
                              ...editingWorkout.weeklyExercises,
                              [selectedWorkoutDay]: updatedExercises
                            }
                          };

                          setEditingWorkout(updatedWorkout);
                          
                          // Reset form
                          setSelectedExerciseToAdd(null);
                          setNewExerciseSets('3');
                          setNewExerciseReps('10');
                          setNewExerciseWeight('');
                          setExerciseSearchTerm('');
                          setSelectedMuscleFilter('Todos');
                          setShowAddExerciseSection(false);
                        }
                      }}
                    >
                      <Ionicons name="add" size={20} color="white" />
                      <Text style={styles.addExerciseToWorkoutButtonText}>Adicionar ao Treino</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

              {/* Exercícios dos Dias Selecionados */}
              <View style={styles.exercisesDaySection}>
                <View style={styles.exercisesDayHeader}>
                  <View style={styles.exercisesDayTitleContainer}>
                    <Ionicons name="fitness" size={20} color="#4CAF50" />
                    <Text style={styles.exercisesDayTitle}>
                      Exercícios dos Dias Selecionados
                    </Text>
                    <View style={styles.exercisesCountChip}>
                      <Text style={styles.exercisesCountChipText}>
                        {selectedDaysForEdit.length} dia(s)
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity 
                    style={styles.addExerciseButtonModern}
                    onPress={() => {
                      setShowAddExerciseSection(!showAddExerciseSection);
                    }}
                  >
                    <LinearGradient
                      colors={['#4CAF50', '#45a049']}
                      style={styles.addExerciseButtonGradient}
                    >
                      <Ionicons name="add" size={18} color="white" />
                      <Text style={styles.addExerciseButtonModernText}>Adicionar</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
                
                {/* Exercícios agrupados por dia selecionado */}
                {selectedDaysForEdit.map(day => {
                  const dayExercises = Array.isArray(editingWorkout?.weeklyExercises?.[day]) 
                    ? editingWorkout.weeklyExercises[day] 
                    : [];
                  
                  return (
                    <View key={day} style={styles.dayExercisesGroup}>
                      <View style={styles.dayGroupHeader}>
                        <Text style={styles.dayGroupTitle}>{dayNames[day]}</Text>
                        <Text style={styles.dayGroupCount}>
                          {dayExercises.length} exercício{dayExercises.length !== 1 ? 's' : ''}
                        </Text>
                      </View>
                      
                      {dayExercises.length === 0 ? (
                        <View style={styles.noExercisesContainer}>
                          <Text style={styles.noExercisesText}>Nenhum exercício para {dayNames[day]}</Text>
                          <Text style={styles.noExercisesSubtext}>Adicione exercícios usando o botão acima</Text>
                        </View>
                      ) : (
                        dayExercises.map((exercise, index) => {
                          const safeName = exercise?.name ? String(exercise.name) : 'Exercício sem nome';
                          const safeMuscle = exercise?.muscle ? String(exercise.muscle) : 'Músculo não definido';
                          const safeSets = exercise?.sets ? String(exercise.sets) : '0';
                          const safeReps = exercise?.reps ? String(exercise.reps) : '0';
                          const safeWeight = exercise?.weight ? String(exercise.weight) : null;
                          
                          return (
                            <View key={exercise?.id || `exercise-${day}-${index}`} style={styles.exerciseEditCardModern}>
                              <View style={styles.exerciseEditHeaderModern}>
                                <View style={styles.exerciseIconContainer}>
                                  <Ionicons name="barbell-outline" size={20} color="#4CAF50" />
                                </View>
                                <View style={styles.exerciseInfoContainer}>
                                  <Text style={styles.exerciseEditNameModern}>{safeName}</Text>
                                  <Text style={styles.exerciseEditMuscleModern}>{safeMuscle}</Text>
                                </View>
                                <TouchableOpacity 
                                  style={styles.exerciseEditDeleteButtonModern}
                                  onPress={() => {
                                    // Remover exercício de todos os dias selecionados
                                    const updatedWeeklyExercises = { ...editingWorkout?.weeklyExercises };
                                    selectedDaysForEdit.forEach(selectedDay => {
                                      if (updatedWeeklyExercises[selectedDay]) {
                                        updatedWeeklyExercises[selectedDay] = updatedWeeklyExercises[selectedDay].filter((_, i) => 
                                          selectedDay === day ? i !== index : true
                                        );
                                      }
                                    });
                                    
                                    const updatedWorkout = {
                                      ...editingWorkout,
                                      weeklyExercises: updatedWeeklyExercises
                                    };
                                    setEditingWorkout(updatedWorkout);
                                  }}
                                >
                                  <Ionicons name="trash-outline" size={18} color="#f44336" />
                                </TouchableOpacity>
                              </View>
                              
                              <View style={styles.exerciseStatsContainer}>
                                <View style={styles.exerciseStatItem}>
                                  <Text style={styles.exerciseStatValue}>{safeSets}</Text>
                                  <Text style={styles.exerciseStatLabel}>Séries</Text>
                                </View>
                                <View style={styles.exerciseStatDivider} />
                                <View style={styles.exerciseStatItem}>
                                  <Text style={styles.exerciseStatValue}>{safeReps}</Text>
                                  <Text style={styles.exerciseStatLabel}>Reps</Text>
                                </View>
                                {safeWeight && (
                                  <>
                                    <View style={styles.exerciseStatDivider} />
                                    <View style={styles.exerciseStatItem}>
                                      <Text style={styles.exerciseStatValue}>{safeWeight}</Text>
                                      <Text style={styles.exerciseStatLabel}>kg</Text>
                                    </View>
                                  </>
                                )}
                              </View>
                              
                              <View style={styles.exerciseProgressBar}>
                                <View style={[styles.exerciseProgressFill, { width: '0%' }]} />
                              </View>
                            </View>
                          );
                        })
                      )}
                    </View>
                  );
                })}
              </View>
            </ScrollView>

            {/* Footer com botões de ação */}
            <View style={styles.editWorkoutFooter}>
              <TouchableOpacity
                style={styles.editWorkoutCancelButton}
                onPress={() => {
                  setShowModal(false);
                  setModalType('');
                  setEditingWorkout(null);
                  setEditingWorkoutName('');
                  setIsEditingWorkout(false);
                }}
              >
                <Text style={styles.editWorkoutCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.editWorkoutSaveButton}
                onPress={saveEditedWorkout}
              >
                <LinearGradient
                  colors={['#4CAF50', '#45a049']}
                  style={styles.editWorkoutSaveButtonGradient}
                >
                  <Ionicons name="checkmark" size={20} color="white" />
                  <Text style={styles.editWorkoutSaveButtonText}>Salvar Treino</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // Modal para criar novo lembrete
  if (showNewReminderModal) {
    return (
      <Modal
        visible={showNewReminderModal}
        transparent={true}
        animationType="slide"
        onRequestClose={resetNewReminderModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Novo Lembrete</Text>
              <TouchableOpacity onPress={resetNewReminderModal}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Título do Lembrete */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Título do Lembrete</Text>
                <TextInput
                  style={styles.input}
                  value={newReminderTitle}
                  onChangeText={setNewReminderTitle}
                  placeholder="Ex: Hora do Treino!"
                  placeholderTextColor="#999"
                />
              </View>

              {/* Tipo de Lembrete */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Tipo de Lembrete</Text>
                <View style={styles.typeButtons}>
                  <TouchableOpacity
                    style={[
                      styles.typeButton,
                      newReminderType === 'workout' && styles.typeButtonSelected
                    ]}
                    onPress={() => setNewReminderType('workout')}
                  >
                    <Ionicons 
                      name="barbell" 
                      size={20} 
                      color={newReminderType === 'workout' ? 'white' : '#4CAF50'} 
                    />
                    <Text style={[
                      styles.typeButtonText,
                      newReminderType === 'workout' && styles.typeButtonTextSelected
                    ]}>Treino</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.typeButton,
                      newReminderType === 'meal' && styles.typeButtonSelected
                    ]}
                    onPress={() => setNewReminderType('meal')}
                  >
                    <Ionicons 
                      name="restaurant" 
                      size={20} 
                      color={newReminderType === 'meal' ? 'white' : '#FF9800'} 
                    />
                    <Text style={[
                      styles.typeButtonText,
                      newReminderType === 'meal' && styles.typeButtonTextSelected
                    ]}>Refeição</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Horário */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Horário</Text>
                <TextInput
                  style={styles.input}
                  value={newReminderTime}
                  onChangeText={setNewReminderTime}
                  placeholder="Ex: 07:00"
                  placeholderTextColor="#999"
                />
                
                {/* Sugestões de horários */}
                <View style={styles.timeSuggestions}>
                  {newReminderType === 'workout' 
                    ? ['06:00', '07:00', '18:00', '19:00'].map((time) => (
                        <TouchableOpacity
                          key={time}
                          style={styles.timeSuggestion}
                          onPress={() => setNewReminderTime(time)}
                        >
                          <Text style={styles.timeSuggestionText}>{time}</Text>
                        </TouchableOpacity>
                      ))
                    : ['07:00', '12:00', '15:00', '19:00'].map((time) => (
                        <TouchableOpacity
                          key={time}
                          style={styles.timeSuggestion}
                          onPress={() => setNewReminderTime(time)}
                        >
                          <Text style={styles.timeSuggestionText}>{time}</Text>
                        </TouchableOpacity>
                      ))
                  }
                </View>
              </View>

              {/* Dias da Semana */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Dias da Semana</Text>
                <View style={styles.daysContainer}>
                  {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.reminderDayButton,
                        newReminderDays.includes(index) && styles.reminderDayButtonSelected
                      ]}
                      onPress={() => toggleReminderDay(index)}
                    >
                      <Text style={[
                        styles.reminderDayButtonText,
                        newReminderDays.includes(index) && styles.reminderDayButtonTextSelected
                      ]}>
                        {day}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Preview do Lembrete */}
              {newReminderTitle && newReminderTime && newReminderDays.length > 0 && (
                <View style={styles.reminderPreview}>
                  <Text style={styles.previewTitle}>Preview:</Text>
                  <View style={styles.previewCard}>
                    <View style={styles.previewHeader}>
                      <Text style={styles.previewReminderTitle}>{newReminderTitle}</Text>
                      <Text style={styles.previewTime}>⏰ {newReminderTime}</Text>
                    </View>
                    <View style={styles.previewDays}>
                      {newReminderDays.map(day => (
                        <Text key={day} style={styles.previewDayTag}>
                          {getDayName(day)}
                        </Text>
                      ))}
                    </View>
                    <View style={[
                      styles.previewTypeBadge,
                      { backgroundColor: newReminderType === 'workout' ? '#4CAF50' : '#FF9800' }
                    ]}>
                      <Ionicons 
                        name={newReminderType === 'workout' ? "barbell" : "restaurant"} 
                        size={16} 
                        color="white" 
                      />
                      <Text style={styles.previewTypeText}>
                        {newReminderType === 'workout' ? 'Treino' : 'Refeição'}
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={resetNewReminderModal}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.modalButton, 
                  styles.confirmButton,
                  (!newReminderTitle.trim() || !newReminderTime.trim() || newReminderDays.length === 0) && styles.confirmButtonDisabled
                ]}
                onPress={createNewReminder}
                disabled={!newReminderTitle.trim() || !newReminderTime.trim() || newReminderDays.length === 0}
              >
                <Text style={styles.confirmButtonText}>Criar Lembrete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // Modal para adicionar exercícios ao treino
  const renderAddExerciseModal = () => {
    console.log('🔍 renderAddExerciseModal chamado - showAddExerciseModal:', showAddExerciseModal);
    
    if (!showAddExerciseModal) return null;

    console.log('✅ Modal será renderizado!');
    const filteredExercises = getFilteredExercises();
    const muscleGroups = getMuscleGroups();
    console.log('Exercícios filtrados:', filteredExercises.length);
    console.log('Grupos musculares:', muscleGroups.length);

    return (
      <Modal
        visible={showAddExerciseModal}
        transparent={true}
        animationType="slide"
        onRequestClose={resetAddExerciseModal}
      >
        <View style={[styles.modalOverlay, { zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.modalContent, { backgroundColor: 'white', zIndex: 1001 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Adicionar Exercício</Text>
              <TouchableOpacity onPress={resetAddExerciseModal}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Busca e Filtros */}
              <View style={styles.searchSection}>
                <View style={styles.inputRow}>
                  <Text style={styles.inputLabel}>Buscar Exercício</Text>
                  <TextInput
                    style={styles.textInput}
                    value={exerciseSearchTerm}
                    onChangeText={setExerciseSearchTerm}
                    placeholder="Digite o nome do exercício ou músculo"
                    autoCapitalize="words"
                  />
                </View>

                <View style={styles.inputRow}>
                  <Text style={styles.inputLabel}>Filtrar por Músculo</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.muscleFilterContainer}>
                    {Array.isArray(muscleGroups) && muscleGroups.map((muscle) => (
                      <TouchableOpacity
                        key={muscle}
                        style={[
                          styles.muscleFilterButton,
                          selectedMuscleFilter === muscle && styles.muscleFilterButtonSelected
                        ]}
                        onPress={() => setSelectedMuscleFilter(muscle)}
                      >
                        <Text style={[
                          styles.muscleFilterText,
                          selectedMuscleFilter === muscle && styles.muscleFilterTextSelected
                        ]}>
                          {muscle}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>

              {/* Lista de Exercícios */}
              <View style={styles.exercisesList}>
                <Text style={styles.sectionTitle}>
                  {filteredExercises.length} exercício(s) encontrado(s)
                </Text>
                
                {Array.isArray(filteredExercises) && filteredExercises.map((exercise) => (
                  <TouchableOpacity
                    key={exercise.id}
                    style={[
                      styles.exerciseItem,
                      selectedExerciseToAdd?.id === exercise.id && styles.exerciseItemSelected
                    ]}
                    onPress={() => setSelectedExerciseToAdd(exercise)}
                  >
                    <View style={styles.addExerciseInfo}>
                      <Text style={styles.addExerciseName}>{exercise.name}</Text>
                      <Text style={styles.exerciseMuscle}>{exercise.muscle}</Text>
                      <Text style={styles.exerciseDifficulty}>
                        {exercise.difficulty} • {exercise.equipment.length > 0 ? exercise.equipment.join(', ') : 'Sem equipamento'}
                      </Text>
                    </View>
                    {selectedExerciseToAdd?.id === exercise.id && (
                      <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              {/* Configuração do Exercício */}
              {selectedExerciseToAdd && (
                <View style={styles.exerciseConfig}>
                  <Text style={styles.sectionTitle}>Configurar Exercício</Text>
                  
                  <View style={styles.configRow}>
                    <View style={styles.configItem}>
                      <Text style={styles.configLabel}>Séries</Text>
                      <TextInput
                        style={styles.configInput}
                        value={newExerciseSets}
                        onChangeText={setNewExerciseSets}
                        keyboardType="numeric"
                        placeholder="3"
                      />
                    </View>
                    
                    <View style={styles.configItem}>
                      <Text style={styles.configLabel}>Repetições</Text>
                      <TextInput
                        style={styles.configInput}
                        value={newExerciseReps}
                        onChangeText={setNewExerciseReps}
                        placeholder="10-12"
                      />
                    </View>
                    
                    <View style={styles.configItem}>
                      <Text style={styles.configLabel}>Peso (kg)</Text>
                      <TextInput
                        style={styles.configInput}
                        value={newExerciseWeight}
                        onChangeText={setNewExerciseWeight}
                        keyboardType="numeric"
                        placeholder="0"
                      />
                    </View>
                  </View>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={resetAddExerciseModal}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.modalButton, 
                  styles.confirmButton,
                  !selectedExerciseToAdd && styles.confirmButtonDisabled
                ]}
                onPress={addExerciseToCurrentWorkout}
                disabled={!selectedExerciseToAdd}
              >
                <Text style={styles.confirmButtonText}>Adicionar ao Treino</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {renderCurrentScreen()}
      {renderModal()}
      {renderAddExerciseModal()}
      
      {/* Modal de Atualização de Meta */}
      <Modal
        visible={showUpdateGoalModal}
        animationType="slide"
        transparent={true}
        onRequestClose={cancelUpdateGoal}
      >
        <View style={styles.updateGoalModalOverlay}>
          <View style={styles.updateGoalModalContainer}>
            <View style={styles.updateGoalModalHeader}>
              <Text style={styles.updateGoalModalTitle}>
                Atualizar Progresso
              </Text>
              <TouchableOpacity 
                onPress={cancelUpdateGoal}
                style={styles.updateGoalModalCloseButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            {selectedGoal && (
              <View style={styles.updateGoalModalContent}>
                <Text style={styles.updateGoalModalLabel}>
                  {selectedGoal.title}
                </Text>
                <Text style={styles.updateGoalModalSubtitle}>
                  Meta: {selectedGoal.targetValue} {selectedGoal.unit}
                </Text>
                <Text style={styles.updateGoalModalCurrentLabel}>
                  Progresso atual: {selectedGoal.currentValue} {selectedGoal.unit}
                </Text>
                
                <View style={styles.updateGoalInputContainer}>
                  <Text style={styles.updateGoalInputLabel}>
                    Novo valor ({selectedGoal.unit}):
                  </Text>
                  <TextInput
                    style={styles.updateGoalInput}
                    value={updateGoalValue}
                    onChangeText={setUpdateGoalValue}
                    placeholder={`Digite o novo valor em ${selectedGoal.unit}`}
                    keyboardType="numeric"
                    autoFocus={true}
                  />
                </View>
                
                <View style={styles.updateGoalModalActions}>
                  <TouchableOpacity 
                    style={styles.updateGoalCancelButton}
                    onPress={cancelUpdateGoal}
                  >
                    <Text style={styles.updateGoalCancelButtonText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.updateGoalConfirmButton}
                    onPress={updateGoalProgress}
                  >
                    <Text style={styles.updateGoalConfirmButtonText}>Atualizar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal de Dicas de Saúde */}
      <Modal
        visible={showHealthTipsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowHealthTipsModal(false)}
      >
        <View style={styles.healthTipsModalOverlay}>
          <View style={styles.healthTipsModalContainer}>
            {/* Header do Modal */}
            <View style={styles.healthTipsModalHeader}>
              <Text style={styles.healthTipsModalTitle}>💡 Dicas de Saúde</Text>
              <TouchableOpacity
                onPress={() => setShowHealthTipsModal(false)}
                style={styles.healthTipsCloseButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Categorias */}
            <View style={styles.categoriesContainer}>
              {['all', 'nutrition', 'health', 'workout', 'wellness'].map((category) => (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.tipCategoryButton,
                    selectedTipCategory === category && styles.selectedTipCategoryButton
                  ]}
                  onPress={() => setSelectedTipCategory(category)}
                >
                  <Text style={[
                    styles.tipCategoryButtonText,
                    selectedTipCategory === category && styles.selectedTipCategoryButtonText
                  ]}>
                    {category === 'all' ? '🔍 Todas' : `${getCategoryIcon(category)} ${getCategoryName(category)}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Lista de Dicas */}
            <ScrollView style={styles.tipsScrollView} showsVerticalScrollIndicator={false}>
              {healthTips
                .filter(tip => selectedTipCategory === 'all' || tip.category === selectedTipCategory)
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((tip) => (
                  <View key={tip.id} style={[
                    styles.tipCard,
                    !tip.isRead && styles.unreadTipCard
                  ]}>
                    <View style={styles.tipHeader}>
                      <View style={styles.tipHeaderLeft}>
                        <Text style={styles.tipIcon}>{tip.icon}</Text>
                        <View style={styles.tipTitleContainer}>
                          <Text style={styles.tipTitle}>{tip.title}</Text>
                          <Text style={styles.tipCategory}>
                            {getCategoryIcon(tip.category)} {getCategoryName(tip.category)}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.tipActions}>
                        {!tip.isRead && (
                          <TouchableOpacity
                            onPress={() => markTipAsRead(tip.id)}
                            style={styles.markReadButton}
                          >
                            <Ionicons name="checkmark" size={18} color="#4CAF50" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                    <Text style={styles.tipContent}>{tip.content}</Text>
                    <Text style={styles.tipDate}>
                      {new Date(tip.createdAt).toLocaleDateString('pt-BR')}
                    </Text>
                  </View>
                ))}

              {healthTips.filter(tip => selectedTipCategory === 'all' || tip.category === selectedTipCategory).length === 0 && (
                <View style={styles.noTipsContainer}>
                  <Ionicons name="bulb-outline" size={48} color="#ddd" />
                  <Text style={styles.noTipsText}>Nenhuma dica encontrada</Text>
                  <Text style={styles.noTipsSubtext}>
                    {selectedTipCategory === 'all' 
                      ? 'Novas dicas aparecerão aqui conforme você usa o app'
                      : `Sem dicas de ${getCategoryName(selectedTipCategory)} no momento`
                    }
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: 20,
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 5,
  },
  statsContainer: {
    backgroundColor: 'white',
    margin: 15,
    padding: 20,
    borderRadius: 12,
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  // Estilos para progresso
  statCard: {
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 5,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 15,
    justifyContent: 'space-between',
  },
  menuCard: {
    width: (width - 45) / 2,
    height: 120,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
    elevation: 3,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  menuCardTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
  },
  menuCardSubtitle: {
    color: 'white',
    fontSize: 12,
    opacity: 0.9,
    marginTop: 4,
  },
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    padding: 8,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 15,
  },
  comingSoon: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  planCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  planTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  planSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  exerciseDetails: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  categoryBadge: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 12,
    color: '#1976d2',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    width: '95%',
    maxWidth: 400,
    maxHeight: '90%',
    alignSelf: 'center',
  },
  modalDescription: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 22,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalBody: {
    padding: 20,
  },
  modalText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    gap: 12,
  },
  modalButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  mealCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  mealName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  mealTime: {
    fontSize: 14,
    color: '#666',
  },
  foodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  foodInfo: {
    flex: 1,
  },
  foodName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  foodPortion: {
    fontSize: 12,
    color: '#666',
  },
  macroInfo: {
    alignItems: 'flex-end',
  },
  calories: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ff6b35',
  },
  macros: {
    fontSize: 12,
    color: '#666',
  },
  progressCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  progressChart: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 20,
  },
  chartData: {
    alignItems: 'center',
  },
  chartValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  chartLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  recentWorkouts: {
    gap: 10,
  },
  workoutEntry: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  workoutInfo: {
    flex: 1,
  },
  workoutName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  workoutDate: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  profileCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 30,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  profileStats: {
    gap: 15,
  },
  profileStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileStatLabel: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  profileInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    textAlign: 'center',
    minWidth: 80,
  },
  unit: {
    fontSize: 16,
    color: '#666',
    marginLeft: 8,
    minWidth: 30,
  },
  modalFeatures: {
    marginTop: 20,
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  // Estilos para timer e workout
  planHeader: {
    marginBottom: 15,
  },
  planTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  planActions: {
    flexDirection: 'row',
    gap: 8,
  },
  startWorkoutButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    gap: 8,
  },
  startWorkoutText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  workoutTimerContainer: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    gap: 10,
  },
  timerDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  timerText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  restTimerDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  restTimerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF9800',
  },
  finishWorkoutButton: {
    backgroundColor: '#f44336',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 6,
    gap: 6,
  },
  finishWorkoutText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  exerciseCompleted: {
    opacity: 0.6,
    backgroundColor: '#f0f0f0',
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  exerciseCheckbox: {
    marginRight: 5,
  },
  exerciseNameCompleted: {
    textDecorationLine: 'line-through',
    color: '#888',
  },
  exerciseActions: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 8,
  },
  exerciseButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editButton: {
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#2196F3',
    padding: 8,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: '#FFEBEE',
    borderWidth: 1,
    borderColor: '#f44336',
    padding: 8,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  restButton: {
    backgroundColor: '#FF9800',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  restButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  // Estilos para progresso
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
  },
  statItem: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  weightEntry: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  weightEntryInfo: {
    flex: 1,
  },
  weightValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  weightDate: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  weightDetails: {
    flexDirection: 'row',
    gap: 12,
  },
  weightDetail: {
    fontSize: 12,
    color: '#666',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  // Estilos para notificações
  notificationCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  notificationInfo: {
    flex: 1,
    marginRight: 15,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  notificationTime: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  notificationDays: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  dayTag: {
    fontSize: 12,
    color: '#4CAF50',
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    fontWeight: '500',
  },
  notificationToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationToggleActive: {
    backgroundColor: '#4CAF50',
  },
  notificationTypeContainer: {
    marginTop: 5,
  },
  notificationTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  notificationTypeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  helpCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 15,
    marginTop: 10,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  // Estilos para formulário de novo exercício
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 15,
  },
  inputSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  daySelectionContainer: {
    marginTop: 10,
    marginBottom: 20,
  },
  daysSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  customDaySelector: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    backgroundColor: '#f8f8f8',
    minWidth: 50,
    alignItems: 'center',
  },
  customDaySelectorSelected: {
    borderColor: '#4CAF50',
    backgroundColor: '#4CAF50',
  },
  customDaySelectorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  customDaySelectorTextSelected: {
    color: 'white',
  },
  exerciseCountIndicator: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#dc3545',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  exerciseCountIndicatorText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
  },
  selectedDaysInfo: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
    textAlign: 'center',
  },
  dayExercisesGroup: {
    marginBottom: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  dayGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#dee2e6',
  },
  dayGroupTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  dayGroupCount: {
    fontSize: 12,
    color: '#6c757d',
    backgroundColor: '#e9ecef',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  daysWeekContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 8,
  },
  dayCardSelector: {
    width: '13%',
    minHeight: 55,
    backgroundColor: 'white',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  dayCardSelectorSelected: {
    backgroundColor: '#007bff',
    borderColor: '#0056b3',
    shadowColor: '#007bff',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  dayCardText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#495057',
    textAlign: 'center',
    marginBottom: 2,
  },
  dayCardTextSelected: {
    color: 'white',
    fontWeight: '700',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
    marginBottom: 10,
  },
  workoutSelector: {
    marginBottom: 10,
  },
  workoutSelectorItem: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    minWidth: 100,
    alignItems: 'center',
  },
  workoutSelectorItemActive: {
    backgroundColor: '#4CAF50',
  },
  workoutSelectorText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  workoutSelectorTextActive: {
    color: 'white',
  },
  categorySelector: {
    marginBottom: 10,
  },
  categorySelectorItem: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginRight: 8,
  },
  categorySelectorItemActive: {
    backgroundColor: '#2196F3',
  },
  categorySelectorText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  categorySelectorTextActive: {
    color: 'white',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 10,
  },
  inputColumn: {
    flex: 1,
  },
  numberInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 5,
  },
  numberButton: {
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  numberValue: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 15,
    marginTop: 20,
    marginBottom: 10,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  createButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  createButtonDisabled: {
    backgroundColor: '#ccc',
  },
  createButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  // Estilos para metas
  goalCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 15,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  goalInfo: {
    flex: 1,
    marginRight: 10,
  },
  goalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  goalDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  goalIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalProgress: {
    marginBottom: 8,
  },
  goalProgressBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 5,
  },
  goalProgressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 4,
  },
  goalProgressCompleted: {
    backgroundColor: '#FFD700',
  },
  goalProgressText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    fontWeight: '500',
  },
  goalDeadline: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  viewAllGoalsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#E8F5E8',
    borderRadius: 8,
    marginTop: 10,
    gap: 8,
  },
  viewAllGoalsText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
  },
  // Estilos para detalhes do exercício
  detailsButton: {
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#2196F3',
    padding: 8,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  exerciseBasicInfo: {
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  exerciseInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  exerciseInfoItem: {
    alignItems: 'center',
    flex: 1,
  },
  exerciseInfoLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  exerciseInfoValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  exerciseMetaInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  difficultyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFE8D6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  difficultyText: {
    fontSize: 12,
    color: '#FF9800',
    fontWeight: '500',
  },
  videoContainer: {
    marginBottom: 20,
  },
  videoPlaceholder: {
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
  },
  videoText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 10,
  },
  videoSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  sectionContainer: {
    marginBottom: 20,
  },
  musclesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  muscleItem: {
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  muscleText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
  },
  equipmentList: {
    gap: 8,
  },
  equipmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  equipmentText: {
    fontSize: 14,
    color: '#333',
  },
  instructionItem: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  instructionNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  instructionNumberText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  // Estilos para criação de treinos personalizados
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    marginBottom: 15,
  },
  selectedExerciseCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  exerciseCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  exerciseControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  exerciseControlGroup: {
    flex: 1,
    alignItems: 'center',
  },
  controlLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  controlInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 8,
    textAlign: 'center',
    fontSize: 14,
    backgroundColor: '#fff',
    minWidth: 60,
  },
  exerciseLibrary: {
    gap: 8,
  },
  libraryExerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  libraryExerciseInfo: {
    flex: 1,
  },
  libraryExerciseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  libraryExerciseMuscle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  libraryExerciseDifficulty: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
    flex: 1,
    marginLeft: 8,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  createWorkoutButton: {
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  presetWorkoutButton: {
    backgroundColor: '#FFF3E0',
    borderWidth: 1,
    borderColor: '#FF9800',
  },
  presetWorkoutsGrid: {
    gap: 16,
  },
  presetWorkoutCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  presetWorkoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  presetWorkoutIcon: {
    fontSize: 32,
  },
  presetWorkoutBadge: {
    backgroundColor: '#e8f5e8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  presetWorkoutDifficulty: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4CAF50',
  },
  presetWorkoutName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  presetWorkoutDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 16,
  },
  presetWorkoutStats: {
    flexDirection: 'row',
    gap: 16,
  },
  presetWorkoutStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  presetWorkoutStatText: {
    fontSize: 12,
    color: '#666',
  },
  presetWorkoutDetail: {
    alignItems: 'center',
    marginBottom: 24,
  },
  presetWorkoutDetailIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  presetWorkoutDetailName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  presetWorkoutDetailDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  presetWorkoutDetailStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  presetWorkoutDetailStat: {
    alignItems: 'center',
    gap: 8,
  },
  presetWorkoutDetailStatLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  presetWorkoutDetailStatValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  presetWorkoutExercises: {
    marginBottom: 24,
  },
  presetWorkoutExercisesTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  presetWorkoutExercise: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
  },
  presetWorkoutExerciseNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4CAF50',
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 24,
  },
  presetWorkoutExerciseInfo: {
    flex: 1,
  },
  presetWorkoutExerciseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  presetWorkoutExerciseDetails: {
    fontSize: 12,
    color: '#666',
  },
  presetWorkoutExerciseMuscle: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
  },
  addDietButton: {
    backgroundColor: '#FFF3E0',
    borderWidth: 1,
    borderColor: '#FF9800',
  },
  // Estilos para nova dieta
  foodLibrary: {
    maxHeight: 200,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 8,
  },
  foodLibraryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  foodLibraryItemSelected: {
    borderColor: '#4CAF50',
    backgroundColor: '#E8F5E8',
  },
  foodLibraryInfo: {
    flex: 1,
  },
  foodLibraryName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  foodLibraryCategory: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  foodLibraryCalories: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
  },
  addFoodButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
    marginLeft: 8,
  },
  addFoodButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  // Estilos para seleção múltipla
  foodSelectorActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  multiSelectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  multiSelectButtonActive: {
    backgroundColor: '#007AFF',
  },
  multiSelectButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
  },
  multiSelectButtonTextActive: {
    color: '#fff',
  },
  foodLibraryItemSelectedMultiple: {
    borderColor: '#4CAF50',
    borderWidth: 2,
    backgroundColor: '#f0f8f0',
  },
  multiSelectIndicator: {
    marginRight: 8,
  },
  selectedFoodsList: {
    maxHeight: 120,
    marginBottom: 12,
  },
  selectedFoodsScroll: {
    maxHeight: 100,
  },
  selectedFoodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e8',
    borderRadius: 8,
    padding: 8,
    marginBottom: 4,
    gap: 8,
  },
  selectedFoodName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#2e7d32',
  },
  selectedFoodCalories: {
    fontSize: 12,
    color: '#666',
  },
  // Estilos para configuração de refeições
  mealPreviewCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  mealPreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  mealPreviewName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  mealPreviewFoods: {
    fontSize: 12,
    color: '#666',
  },
  // Estilos para edição de dietas
  mealEditCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#FF5722',
  },
  mealEditHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  mealEditName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  mealEditTime: {
    fontSize: 12,
    color: '#666',
    marginRight: 10,
  },
  mealEditInfo: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  foodEditItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: 'white',
    borderRadius: 4,
    marginBottom: 4,
  },
  foodEditName: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  foodEditQuantity: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  currentMealFoods: {
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  foodPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: 'white',
    borderRadius: 6,
    marginBottom: 6,
  },
  foodPreviewInfo: {
    flex: 1,
  },
  foodPreviewName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  foodPreviewPortion: {
    fontSize: 12,
    color: '#666',
  },
  foodPreviewNutrition: {
    alignItems: 'flex-end',
    marginRight: 8,
  },
  foodPreviewCalories: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ff6b35',
  },
  foodPreviewMacros: {
    fontSize: 10,
    color: '#666',
  },
  mealTotals: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  mealTotalsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  addFoodSection: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  foodSelectorContainer: {
    marginBottom: 12,
  },
  quantitySection: {
    marginTop: 12,
    padding: 12,
    backgroundColor: 'white',
    borderRadius: 8,
  },
  nutritionPreview: {
    backgroundColor: '#e8f5e8',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#c8e6c9',
  },
  nutritionPreviewTitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  nutritionPreviewValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
  },
  nutritionPreviewMacros: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },
  addMealButton: {
    backgroundColor: '#9C27B0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
  },
  addMealButtonDisabled: {
    backgroundColor: '#ccc',
  },
  addMealButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButtonDisabled: {
    backgroundColor: '#ccc',
  },
  
  // Novos estilos para usabilidade da dieta
  addFoodHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  templatesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  templatesButtonText: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: '500',
  },
  templatesContainer: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  templatesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  templateCard: {
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    marginRight: 8,
    minWidth: 120,
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  templateName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E65100',
    marginBottom: 4,
  },
  templateInfo: {
    fontSize: 10,
    color: '#BF360C',
  },
  searchContainer: {
    marginBottom: 12,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 0,
  },
  categoryFilter: {
    marginBottom: 12,
  },
  categoryButton: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  categoryButtonSelected: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  categoryButtonText: {
    fontSize: 14,
    color: '#666',
  },
  categoryButtonTextSelected: {
    color: 'white',
    fontWeight: '600',
  },
  foodSelectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  saveTemplateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  saveTemplateText: {
    fontSize: 11,
    color: '#FF9800',
    fontWeight: '500',
  },
  emptySearchState: {
    alignItems: 'center',
    padding: 24,
  },
  emptySearchText: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  emptySearchSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
  foodLibraryNutrition: {
    alignItems: 'flex-end',
  },
  foodLibraryMacros: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  
  // Estilos adicionais para melhor usabilidade
  timeSuggestions: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  timeSuggestion: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  timeSuggestionText: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: '500',
  },
  quickMeals: {
    marginBottom: 12,
  },
  quickMealButton: {
    backgroundColor: '#F3E5F5',
    padding: 8,
    borderRadius: 8,
    marginRight: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  quickMealText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7B1FA2',
  },
  quickMealTime: {
    fontSize: 10,
    color: '#AD62B8',
    marginTop: 2,
  },
  errorText: {
    fontSize: 12,
    color: '#FF5722',
    marginTop: 4,
  },
  quantitySuggestions: {
    marginVertical: 8,
  },
  validationMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 8,
    borderRadius: 6,
    gap: 6,
    marginVertical: 4,
  },
  validationText: {
    fontSize: 13,
    color: '#E65100',
    flex: 1,
  },
  
  // Estilos para histórico de treinos
  statsOverview: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statsHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  statsSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  mainStatsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  primaryStatCard: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  statIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#e8f5e8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  primaryStatNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 4,
  },
  primaryStatLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  statDescription: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  secondaryStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  secondaryStatCard: {
    flex: 1,
    minWidth: '22%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  secondaryStatNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 6,
    marginBottom: 2,
  },
  secondaryStatLabel: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
  },
  favoriteExerciseContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  favoriteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  favoriteHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editFavoriteButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  favoriteTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  favoriteContent: {
    alignItems: 'center',
  },
  favoriteExerciseText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#E91E63',
    marginBottom: 4,
  },
  favoriteDescription: {
    fontSize: 12,
    color: '#666',
  },
  favoriteOptionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e9ecef',
  },
  favoriteOptionCardActive: {
    borderColor: '#4CAF50',
    backgroundColor: '#f8f9fa',
  },
  favoriteOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  favoriteOptionTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  favoriteOptionDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    marginLeft: 36,
  },
  exerciseListTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 20,
    marginBottom: 12,
  },
  historyStatCard: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
  },
  favoriteExerciseCard: {
    flex: 2,
    minHeight: 60,
    justifyContent: 'center',
  },
  favoriteExerciseName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
    textAlign: 'center',
    marginTop: 4,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 4,
  },
  filterSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginTop: 0,
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  filterButton: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#4CAF50',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  historySection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginTop: 0,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#ccc',
    marginTop: 8,
    textAlign: 'center',
  },
  workoutSessionCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionWorkoutName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  sessionDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  sessionStats: {
    alignItems: 'flex-end',
  },
  sessionDuration: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
  },
  sessionVolume: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  sessionExercisesCount: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  sessionExercises: {
    gap: 6,
  },
  sessionExercise: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionExerciseName: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  sessionExerciseDetails: {
    fontSize: 12,
    color: '#666',
  },
  sessionMoreExercises: {
    fontSize: 12,
    color: '#4CAF50',
    fontStyle: 'italic',
    marginTop: 4,
  },
  favoriteSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginTop: 0,
  },
  favoriteCard: {
    alignItems: 'center',
    paddingVertical: 20,
  },

  // Estilos para modal de metas
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
  },
  closeButton: {
    padding: 8,
  },
  saveButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    flexWrap: 'wrap',
  },
  formGroupFlex: {
    flex: 1,
    minWidth: 80,
    marginBottom: 20,
  },
  formGroupSmall: {
    width: 80,
    marginBottom: 20,
  },
  goalTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  goalTypeCard: {
    width: '48%',
    minWidth: 140,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    marginBottom: 8,
  },
  goalTypeCardSelected: {
    backgroundColor: '#e3f2fd',
    borderColor: '#007AFF',
  },
  goalTypeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  goalTypeTextSelected: {
    color: '#007AFF',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },

  // Estilos para tela de metas
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 24,
  },
  emptyStateButton: {
    backgroundColor: '#9C27B0',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 24,
  },
  emptyStateButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  goalsStats: {
    marginBottom: 24,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  goalStatCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  goalStatNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#9C27B0',
  },
  goalStatLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  goalsSection: {
    marginTop: 8,
  },
  goalCardCompleted: {
    opacity: 0.8,
    backgroundColor: '#f8f9fa',
  },
  goalTypeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f3e5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  goalTitleCompleted: {
    textDecorationLine: 'line-through',
    color: '#666',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 14,
    color: '#666',
  },
  progressPercentage: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#9C27B0',
  },
  progressPercentageCompleted: {
    color: '#4CAF50',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#9C27B0',
    borderRadius: 4,
  },
  progressFillCompleted: {
    backgroundColor: '#4CAF50',
  },
  goalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  deadlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deadlineUrgent: {
    backgroundColor: '#ffebee',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  deadlineText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  deadlineTextUrgent: {
    color: '#FF5722',
    fontWeight: '600',
  },
  editGoalButton: {
    padding: 8,
  },

  // Estilo para botão do vídeo
  videoButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },

  // Estilo para indicador de vídeo
  videoIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF0000',
  },
  videoIndicatorButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  videoIndicatorText: {
    fontSize: 10,
    color: '#FF0000',
    marginLeft: 4,
    fontWeight: '600',
  },

  // Botão de play para vídeo
  videoPlayButton: {
    padding: 8,
    backgroundColor: '#fff',
    borderRadius: 20,
    marginLeft: 4,
    borderWidth: 1,
    borderColor: '#FF0000',
  },

  // Estilos para refeições concluídas
  mealCompleted: {
    backgroundColor: '#f8f9fa',
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  mealCheckbox: {
    marginRight: 12,
    alignSelf: 'flex-start',
  },
  mealInfo: {
    flex: 1,
  },
  mealCalories: {
    alignSelf: 'flex-start',
  },
  mealCaloriesText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
  },
  mealNameCompleted: {
    textDecorationLine: 'line-through',
    color: '#999',
  },
  foodRowCompleted: {
    opacity: 0.7,
  },
  foodNameCompleted: {
    textDecorationLine: 'line-through',
    color: '#999',
  },

  // Estilos para botão de reset das refeições
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#fff3e0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF9800',
  },
  resetButtonText: {
    fontSize: 12,
    color: '#FF9800',
    marginLeft: 4,
    fontWeight: '600',
  },

  // Estilos para progresso das refeições (usando os existentes mas com override)
  progressContainer: {
    marginVertical: 12,
  },

  // Estilos para seletor de dias da semana
  daySelector: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  daySelectorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  dayButtons: {
    flexDirection: 'row',
  },
  dayButtonsContainer: {
    flexDirection: 'row',
  },
  dayButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  dayButtonActive: {
    backgroundColor: '#FF9800',
    borderColor: '#FF9800',
  },
  dayButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  dayButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  noMealsContainer: {
    padding: 20,
    alignItems: 'center',
  },
  noMealsText: {
    fontSize: 16,
    color: '#999',
    fontStyle: 'italic',
  },
  
  // Estilos para gerenciamento de dados
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginVertical: 4,
    gap: 8,
  },
  actionButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  dataInfo: {
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  dataInfoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  
  // Estilos para lembretes
  addReminderButton: {
    padding: 8,
  },
  deleteNotificationButton: {
    padding: 8,
    marginLeft: 8,
  },
  createReminderButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    margin: 16,
    gap: 8,
  },
  createReminderButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  typeButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    backgroundColor: 'white',
    gap: 8,
  },
  typeButtonSelected: {
    borderColor: '#4CAF50',
    backgroundColor: '#4CAF50',
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  typeButtonTextSelected: {
    color: 'white',
  },
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reminderDayButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: 'white',
    minWidth: 50,
    alignItems: 'center',
  },
  reminderDayButtonSelected: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  reminderDayButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  reminderDayButtonTextSelected: {
    color: 'white',
  },
  reminderPreview: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  previewCard: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  previewReminderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  previewTime: {
    fontSize: 14,
    color: '#666',
  },
  previewDays: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 8,
  },
  previewDayTag: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    fontSize: 12,
    color: '#2196F3',
  },
  previewTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  previewTypeText: {
    fontSize: 12,
    color: 'white',
    fontWeight: '600',
  },

  // ===== NOVOS ESTILOS PARA LAYOUT MODERNIZADO =====
  
  // Header Moderno
  modernHeader: {
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userGreeting: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    marginRight: 15,
  },
  avatarGradient: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  greetingText: {
    flex: 1,
  },
  greetingMain: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 2,
  },
  greetingTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 2,
  },
  greetingSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  notificationButton: {
    position: 'relative',
    padding: 8,
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#FF4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },

  // Quick Stats Cards
  quickStatsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: -20,
    marginBottom: 25,
    gap: 12,
  },
  quickStatCard: {
    flex: 1,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    elevation: 6,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  quickStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 8,
  },
  quickStatLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 4,
    textAlign: 'center',
  },

  // Treino de Hoje
  todayWorkoutContainer: {
    paddingHorizontal: 20,
    marginBottom: 25,
  },
  todayWorkoutCard: {
    padding: 20,
    borderRadius: 16,
    elevation: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  todayWorkoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  todayWorkoutTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  todayWorkoutSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  todayWorkoutProgress: {
    marginTop: 10,
  },
  todayWorkoutProgressText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 8,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  modernProgressBar: {
    height: '100%',
    width: '0%',
    backgroundColor: 'white',
    borderRadius: 3,
  },

  // Estatísticas Detalhadas
  detailedStatsContainer: {
    paddingHorizontal: 20,
    marginBottom: 25,
  },
  detailedStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  detailedStatCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    width: (width - 56) / 2,
    elevation: 2,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  modernStatIconContainer: {
    marginBottom: 12,
  },
  statIconGradient: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailedStatValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  detailedStatLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },

  // Menu Principal Modernizado
  mainMenuContainer: {
    paddingHorizontal: 20,
    marginBottom: 25,
  },
  modernMenuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
  },
  modernMenuCard: {
    width: (width - 55) / 2,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  modernMenuCardGradient: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    height: 140,
  },
  modernMenuCardTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 4,
  },
  modernMenuCardSubtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },

  // Bottom Padding
  bottomPadding: {
    height: 30,
  },

  // ===== ESTILOS PARA PERFIL MODERNIZADO =====
  
  // Header Profile Image
  headerProfileImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },

  // Profile Main Card
  profileMainCard: {
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  profileGradientHeader: {
    padding: 30,
    alignItems: 'center',
  },
  profileImageContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  profileImageWrapper: {
    position: 'relative',
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: 'white',
  },
  profileImagePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'white',
  },
  profileImageOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  removeImageButton: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: '#FF4444',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  profileNameSection: {
    width: '100%',
    alignItems: 'center',
  },
  profileNameInput: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.3)',
    paddingVertical: 8,
    paddingHorizontal: 20,
    marginBottom: 10,
    minWidth: 200,
  },
  profileBioInput: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    minHeight: 40,
    maxWidth: 280,
  },

  // Quick Stats
  profileQuickStats: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 12,
  },
  profileQuickStatCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 2,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  profileQuickStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  profileQuickStatLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },

  // Detail Card
  profileDetailCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    elevation: 2,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  profileSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  profileInputGroup: {
    marginBottom: 16,
  },
  profileInputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 8,
  },
  profileDetailInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#F9F9F9',
  },
  
  // Estilos para grupos de seleção
  profileSelectGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  profileSelectOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#F9F9F9',
    marginBottom: 8,
  },
  profileSelectOptionActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  profileSelectText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  profileSelectTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  
  // Estilos para estatísticas avançadas
  advancedStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  advancedStatItem: {
    width: '48%',
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  advancedStatValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 4,
  },
  advancedStatLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  advancedStatDescription: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    lineHeight: 14,
  },

  // Action Card
  profileActionCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    elevation: 2,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  profileActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
  },
  profileActionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },

  // ===== ESTILOS PARA TELA DE TREINOS MODERNIZADA =====
  
  // Header de Treinos
  workoutHeader: {
    paddingTop: 60,
    paddingBottom: 25,
    paddingHorizontal: 20,
  },
  workoutHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  workoutBackButton: {
    padding: 8,
  },
  workoutHeaderTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    flex: 1,
    textAlign: 'center',
  },
  workoutHeaderActions: {
    flexDirection: 'row',
    gap: 12,
  },
  workoutHeaderAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Quick Stats de Treinos
  workoutQuickStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  workoutQuickStat: {
    alignItems: 'center',
  },
  workoutQuickStatValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  workoutQuickStatLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },

  // Conteúdo Principal
  workoutContent: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },

  // Seletor de Dias Modernizado
  modernDaySelector: {
    backgroundColor: 'white',
    margin: 20,
    padding: 20,
    borderRadius: 16,
    elevation: 2,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    marginTop: -10,
  },
  modernDaySelectorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  modernDayScrollView: {
    marginHorizontal: -10,
  },
  modernDayButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginHorizontal: 6,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    position: 'relative',
  },
  modernDayButtonActive: {
    backgroundColor: '#4CAF50',
  },
  modernDayButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  modernDayButtonTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  modernDayIndicator: {
    position: 'absolute',
    bottom: -2,
    left: '50%',
    transform: [{ translateX: -2 }],
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  modernDayIndicatorActive: {
    backgroundColor: 'white',
  },

  // Treino Ativo
  activeWorkoutContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  activeWorkoutCard: {
    padding: 20,
    borderRadius: 16,
    elevation: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  activeWorkoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  activeWorkoutInfo: {
    flex: 1,
  },
  activeWorkoutTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  activeWorkoutSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
  },
  activeWorkoutStopButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeWorkoutStats: {
    flexDirection: 'row',
    marginBottom: 15,
    gap: 20,
  },
  activeWorkoutStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activeWorkoutStatText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  activeWorkoutProgress: {
    marginTop: 10,
  },
  activeWorkoutProgressBar: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  activeWorkoutProgressFill: {
    height: '100%',
    backgroundColor: 'white',
    borderRadius: 3,
  },
  activeWorkoutProgressText: {
    color: 'white',
    fontSize: 12,
    textAlign: 'center',
  },

  // Container de Planos
  workoutPlansContainer: {
    paddingHorizontal: 20,
  },

  // Empty State
  workoutEmptyState: {
    marginBottom: 20,
  },
  workoutEmptyCard: {
    padding: 40,
    borderRadius: 16,
    alignItems: 'center',
    elevation: 2,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  workoutEmptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 15,
    marginBottom: 8,
  },
  workoutEmptySubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 25,
  },
  workoutEmptyActions: {
    flexDirection: 'row',
    gap: 12,
  },
  workoutEmptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    gap: 8,
  },
  workoutEmptyButtonSecondary: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  workoutEmptyButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },

  // Cards de Treino Modernizados
  modernWorkoutCard: {
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    backgroundColor: 'white',
  },
  modernWorkoutCardGradient: {
    padding: 20,
  },
  modernWorkoutCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  modernWorkoutCardInfo: {
    flex: 1,
  },
  modernWorkoutCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  modernWorkoutCardSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  modernWorkoutCardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  modernWorkoutCardAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modernWorkoutCardProgress: {
    marginBottom: 15,
  },
  modernWorkoutProgressBar: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  modernWorkoutProgressFill: {
    height: '100%',
    backgroundColor: 'white',
    borderRadius: 3,
  },
  modernWorkoutProgressText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  modernStartWorkoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    gap: 8,
  },
  modernStartWorkoutText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  modernActiveWorkoutIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    gap: 8,
  },
  modernActiveWorkoutText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },

  // Lista de Exercícios Modernizada
  modernExercisesList: {
    paddingTop: 10,
  },
  modernExerciseCard: {
    backgroundColor: '#f8f9fa',
    marginHorizontal: 10,
    marginVertical: 6,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  modernExerciseHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  modernExerciseCheckbox: {
    marginRight: 12,
    marginTop: 2,
  },
  modernExerciseInfo: {
    flex: 1,
  },
  modernExerciseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  modernExerciseNameCompleted: {
    textDecorationLine: 'line-through',
    color: '#999',
  },
  modernExerciseDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  modernExerciseTags: {
    flexDirection: 'row',
    gap: 8,
  },
  modernExerciseTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#4CAF50',
  },
  modernExerciseTagSecondary: {
    backgroundColor: '#2196F3',
  },
  modernExerciseTagText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  modernExerciseActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
  },
  modernExerciseVideoButton: {
    padding: 6,
  },
  modernExerciseDetailButton: {
    padding: 6,
  },
  modernExerciseRestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#FF9800',
    gap: 4,
  },
  modernExerciseRestText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  
  // Estilos da Tela de Dieta Modernizada
  dietHeader: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  dietHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  dietBackButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  dietHeaderTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    flex: 1,
    textAlign: 'center',
  },
  dietHeaderAction: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  dietQuickStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
  dietQuickStat: {
    alignItems: 'center',
  },
  dietQuickStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  dietQuickStatLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  dietContent: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  modernDietDaySelector: {
    padding: 20,
    backgroundColor: 'white',
    marginTop: 10,
    marginHorizontal: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  modernDietDaySelectorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  modernDietDayScrollView: {
    marginHorizontal: -10,
  },
  modernDietDayButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 4,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    minWidth: 80,
    alignItems: 'center',
  },
  modernDietDayButtonActive: {
    backgroundColor: '#FF9800',
  },
  modernDietDayButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  modernDietDayButtonTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  modernDietDayIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'transparent',
    marginTop: 4,
  },
  modernDietDayIndicatorActive: {
    backgroundColor: 'white',
  },
  dietPlansContainer: {
    padding: 20,
    gap: 16,
  },
  dietEmptyState: {
    alignItems: 'center',
  },
  dietEmptyCard: {
    padding: 40,
    borderRadius: 20,
    alignItems: 'center',
    width: '100%',
  },
  dietEmptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 16,
    marginBottom: 8,
  },
  dietEmptySubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  dietEmptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 25,
    gap: 8,
  },
  dietEmptyButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  modernDietCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  modernDietCardGradient: {
    padding: 20,
  },
  modernDietCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modernDietCardInfo: {
    flex: 1,
  },
  modernDietCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  modernDietCardSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  modernDietCardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  modernDietActionButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  modernDietCardProgress: {
    gap: 8,
  },
  modernDietProgressBar: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  modernDietProgressFill: {
    height: '100%',
    backgroundColor: 'white',
    borderRadius: 3,
  },
  modernDietProgressText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  modernMealsList: {
    padding: 20,
    gap: 12,
  },
  modernMealCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
  },
  modernMealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  modernMealCheckbox: {
    padding: 2,
  },
  modernMealInfo: {
    flex: 1,
  },
  modernMealName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  modernMealNameCompleted: {
    textDecorationLine: 'line-through',
    color: '#999',
  },
  modernMealTime: {
    fontSize: 12,
    color: '#666',
  },
  modernMealCalories: {
    alignItems: 'flex-end',
  },
  modernMealCaloriesValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF9800',
  },
  modernMealCaloriesLabel: {
    fontSize: 11,
    color: '#999',
  },
  modernMealFoods: {
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  modernFoodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  modernFoodInfo: {
    flex: 1,
  },
  modernFoodName: {
    fontSize: 14,
    color: '#333',
    marginBottom: 2,
  },
  modernFoodNameCompleted: {
    textDecorationLine: 'line-through',
    color: '#999',
  },
  modernFoodQuantity: {
    fontSize: 12,
    color: '#666',
  },
  modernFoodMacros: {
    flexDirection: 'row',
    gap: 8,
  },
  modernMacroItem: {
    alignItems: 'center',
    minWidth: 32,
  },
  modernMacroValue: {
    fontSize: 11,
    fontWeight: '600',
    color: '#333',
  },
  modernMacroLabel: {
    fontSize: 10,
    color: '#999',
    marginTop: 1,
  },
  modernNoMealsContainer: {
    padding: 40,
    alignItems: 'center',
  },
  modernNoMealsText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 12,
  },
  
  // Estilos da Tela de Progresso Modernizada
  progressHeaderModern: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  progressHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  progressBackButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  progressHeaderTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    flex: 1,
    textAlign: 'center',
  },
  progressHeaderAction: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  progressQuickStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
  progressQuickStat: {
    alignItems: 'center',
  },
  progressQuickStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  progressQuickStatLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  progressContent: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  modernStatsContainer: {
    padding: 20,
    gap: 16,
  },
  modernStatCard: {
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  modernStatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 8,
  },
  modernStatInfo: {
    flex: 1,
  },
  modernStatValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  modernStatLabel: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
  },
  modernStatDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 20,
  },
  modernSecondaryStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 20,
    gap: 12,
  },
  modernSecondaryStatCard: {
    width: '47%',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  modernSecondaryStatGradient: {
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  modernSecondaryStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  modernSecondaryStatLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
    textAlign: 'center',
  },
  modernFavoriteExerciseCard: {
    margin: 20,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  modernFavoriteGradient: {
    padding: 20,
  },
  modernFavoriteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modernFavoriteHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modernFavoriteTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  modernEditFavoriteButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  modernFavoriteContent: {
    gap: 4,
  },
  modernFavoriteExerciseText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  modernFavoriteDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  modernFilterSection: {
    padding: 20,
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  modernSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  modernFilterScrollView: {
    marginHorizontal: -10,
  },
  modernFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 4,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    gap: 8,
    minWidth: 100,
  },
  modernFilterButtonActive: {
    backgroundColor: '#673AB7',
    borderColor: '#673AB7',
  },
  modernFilterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#673AB7',
  },
  modernFilterButtonTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  modernHistorySection: {
    padding: 20,
  },
  modernEmptyState: {
    alignItems: 'center',
    marginTop: 20,
  },
  modernEmptyCard: {
    padding: 40,
    borderRadius: 20,
    alignItems: 'center',
    width: '100%',
  },
  modernEmptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 16,
    marginBottom: 8,
  },
  modernEmptySubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 20,
  },
  modernWorkoutHistory: {
    gap: 16,
  },
  modernWorkoutSessionCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  modernSessionGradient: {
    padding: 20,
  },
  modernSessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modernSessionInfo: {
    flex: 1,
  },
  modernSessionWorkoutName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  modernSessionDate: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  modernSessionStats: {
    flexDirection: 'row',
    gap: 16,
  },
  modernSessionStat: {
    alignItems: 'center',
  },
  modernSessionStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  modernSessionStatLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  modernSessionExercises: {
    padding: 20,
    gap: 12,
  },
  modernSessionExercise: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  modernExerciseIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modernExerciseDetailsProgress: {
    flex: 1,
  },
  modernSessionExerciseName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  modernSessionExerciseStats: {
    fontSize: 13,
    color: '#666',
  },
  modernMoreExercises: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  modernSessionMoreExercises: {
    fontSize: 14,
    color: '#999',
    fontWeight: '500',
  },
  
  // Estilos da Tela de Configurações/Lembretes Modernizada
  settingsHeader: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  settingsHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  settingsBackButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  settingsHeaderTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    flex: 1,
    textAlign: 'center',
  },
  settingsHeaderAction: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  settingsQuickStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
  settingsQuickStat: {
    alignItems: 'center',
  },
  settingsQuickStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  settingsQuickStatLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  settingsContent: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  modernNotificationsSection: {
    padding: 20,
  },
  settingsEmptyState: {
    alignItems: 'center',
    marginTop: 20,
  },
  settingsEmptyCard: {
    padding: 40,
    borderRadius: 20,
    alignItems: 'center',
    width: '100%',
  },
  settingsEmptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 16,
    marginBottom: 8,
  },
  settingsEmptySubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  settingsEmptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 25,
    gap: 8,
  },
  settingsEmptyButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  modernNotificationsList: {
    gap: 16,
  },
  modernNotificationCard: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  modernNotificationGradient: {
    padding: 20,
  },
  modernNotificationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modernNotificationInfo: {
    flex: 1,
  },
  modernNotificationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  modernNotificationTitleDisabled: {
    color: '#999',
  },
  modernNotificationTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modernNotificationTime: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  modernNotificationTimeDisabled: {
    color: '#999',
  },
  modernNotificationActions: {
    flexDirection: 'row',
    gap: 8,
  },
  modernNotificationToggle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modernNotificationToggleActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  modernDeleteNotificationButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modernNotificationDetails: {
    gap: 12,
  },
  modernNotificationDays: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  modernDayTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
  },
  modernDayTagDisabled: {
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  modernDayTagText: {
    fontSize: 12,
    color: 'white',
    fontWeight: '500',
  },
  modernDayTagTextDisabled: {
    color: '#999',
  },
  modernNotificationTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  modernNotificationTypeText: {
    fontSize: 12,
    color: 'white',
    fontWeight: '600',
  },
  modernNotificationTypeTextDisabled: {
    color: '#999',
  },
  modernCreateReminderSection: {
    padding: 20,
  },
  modernCreateReminderButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  modernCreateReminderGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 12,
  },
  modernCreateReminderButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  modernHelpCard: {
    margin: 20,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  modernHelpGradient: {
    padding: 20,
  },
  modernHelpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  modernHelpTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  modernHelpContent: {
    gap: 12,
  },
  modernHelpItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  modernHelpText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 20,
    flex: 1,
  },
  
  // Estilos da Tela de Metas/Objetivos Modernizada
  goalsHeader: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  goalsHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  goalsBackButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  goalsHeaderTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    flex: 1,
    textAlign: 'center',
  },
  goalsHeaderAction: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  goalsQuickStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
  goalsQuickStat: {
    alignItems: 'center',
  },
  goalsQuickStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  goalsQuickStatLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  goalsContent: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  goalsEmptyState: {
    alignItems: 'center',
    padding: 20,
  },
  goalsEmptyCard: {
    padding: 40,
    borderRadius: 20,
    alignItems: 'center',
    width: '100%',
  },
  goalsEmptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 16,
    marginBottom: 8,
  },
  goalsEmptySubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  goalsEmptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 25,
    gap: 8,
  },
  goalsEmptyButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  goalsListContainer: {
    padding: 20,
    gap: 16,
  },
  modernGoalCard: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  modernGoalCardGradient: {
    padding: 20,
  },
  modernGoalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  modernGoalIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modernGoalInfo: {
    flex: 1,
  },
  modernGoalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  modernGoalDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  modernGoalCompleted: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modernGoalProgress: {
    gap: 8,
  },
  modernGoalProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modernGoalProgressText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  modernGoalProgressPercentage: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  modernGoalProgressBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  modernGoalProgressFill: {
    height: '100%',
    backgroundColor: 'white',
    borderRadius: 4,
  },
  modernGoalActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  modernGoalActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    gap: 6,
  },
  modernGoalUpdateButton: {
    backgroundColor: '#9C27B0',
  },
  modernGoalCompleteButton: {
    backgroundColor: '#4CAF50',
  },
  modernGoalActionText: {
    fontSize: 12,
    color: 'white',
    fontWeight: '600',
  },
  modernGoalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  modernGoalDeadline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  modernGoalDeadlineText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  modernGoalUrgent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 213, 79, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  modernGoalUrgentText: {
    fontSize: 11,
    color: '#FFD54F',
    fontWeight: '600',
  },
  
  // Estilos para edição de treino melhorada
  exercisesDaySection: {
    marginTop: 20,
  },
  exercisesDayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  exercisesDayTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  addExerciseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f0f8f0',
    borderRadius: 16,
    gap: 4,
  },
  addExerciseButtonText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
  },
  addExerciseSectionContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  addExerciseSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  addExerciseSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  closeAddExerciseSection: {
    padding: 4,
  },
  exerciseList: {
    maxHeight: 200,
    marginBottom: 16,
  },
  muscleFilterContainer: {
    marginTop: 8,
  },
  muscleFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
    marginRight: 8,
  },
  muscleFilterChipSelected: {
    backgroundColor: '#4CAF50',
  },
  muscleFilterChipText: {
    fontSize: 12,
    color: '#666',
  },
  muscleFilterChipTextSelected: {
    color: 'white',
    fontWeight: '600',
  },
  exerciseConfigSection: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  exerciseConfigTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  exerciseConfigRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  exerciseConfigItem: {
    flex: 1,
  },
  exerciseConfigLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  exerciseConfigInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 8,
    fontSize: 14,
    backgroundColor: 'white',
  },
  addExerciseToWorkoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  addExerciseToWorkoutButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  noExercisesContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginBottom: 16,
  },
  noExercisesText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 12,
    marginBottom: 4,
  },
  noExercisesSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  exerciseEditCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  exerciseEditHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  exerciseEditName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  exerciseEditDeleteButton: {
    padding: 4,
  },
  exerciseEditDetails: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  exerciseEditDetail: {
    fontSize: 14,
    color: '#666',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  exerciseEditMuscle: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  // Novos estilos para a tela de editar treino melhorada
  editWorkoutHeader: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  editWorkoutHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editWorkoutTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  editWorkoutTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  editWorkoutCloseButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  editWorkoutNameSection: {
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  editWorkoutNameLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 8,
  },
  editWorkoutNameInput: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ced4da',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#495057',
  },
  daysSelectorContainer: {
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  daysSelectorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 16,
  },
  daysSelectorScroll: {
    flexGrow: 0,
  },
  daysSelectorContent: {
    gap: 12,
  },
  daySelectorSelected: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  daySelectorText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6c757d',
  },
  daySelectorTextSelected: {
    color: 'white',
  },
  exerciseCountBadge: {
    backgroundColor: '#dc3545',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
    minWidth: 20,
    alignItems: 'center',
  },
  exerciseCountBadgeSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  exerciseCountText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
  },
  exerciseCountTextSelected: {
    color: '#007bff',
  },
  editWorkoutBody: {
    flex: 1,
  },
  exercisesDayTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  exercisesCountChip: {
    backgroundColor: '#e8f5e8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  exercisesCountChipText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
  },
  addExerciseButtonModern: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  addExerciseButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
  },
  addExerciseButtonModernText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  exerciseEditCardModern: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  exerciseEditHeaderModern: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  exerciseIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e8f5e8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  exerciseInfoContainer: {
    flex: 1,
  },
  exerciseEditNameModern: {
    fontSize: 16,
    fontWeight: '700',
    color: '#212529',
    marginBottom: 4,
  },
  exerciseEditMuscleModern: {
    fontSize: 14,
    color: '#6c757d',
  },
  exerciseEditDeleteButtonModern: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffe6e6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  exerciseStatsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  exerciseStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  exerciseStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 4,
  },
  exerciseStatLabel: {
    fontSize: 12,
    color: '#6c757d',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  exerciseStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#dee2e6',
    marginHorizontal: 8,
  },
  exerciseProgressBar: {
    height: 4,
    backgroundColor: '#e9ecef',
    borderRadius: 2,
    overflow: 'hidden',
  },
  exerciseProgressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 2,
  },
  editWorkoutFooter: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    gap: 12,
  },
  editWorkoutCancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
    alignItems: 'center',
  },
  editWorkoutCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6c757d',
  },
  editWorkoutSaveButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  editWorkoutSaveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  editWorkoutSaveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
  },
  // Estilos para o modal de treinos prontos
  backButtonText: {
    fontSize: 24,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  workoutCard: {
    backgroundColor: 'white',
    padding: 16,
    margin: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  workoutTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  workoutDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  workoutDuration: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  workoutDifficulty: {
    fontSize: 12,
    color: '#999',
  },
  
  // Estilos para o modal de adicionar exercícios
  searchSection: {
    marginBottom: 20,
  },
  muscleFilterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    marginRight: 8,
  },
  muscleFilterButtonSelected: {
    backgroundColor: '#4CAF50',
  },
  muscleFilterText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  muscleFilterTextSelected: {
    color: 'white',
  },
  exercisesList: {
    marginBottom: 20,
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  exerciseItemSelected: {
    borderColor: '#4CAF50',
    backgroundColor: '#f8fff8',
  },
  addExerciseInfo: {
    flex: 1,
  },
  addExerciseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  exerciseMuscle: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
    marginBottom: 4,
  },
  exerciseDifficulty: {
    fontSize: 12,
    color: '#999',
  },
  exerciseConfig: {
    backgroundColor: '#f8f8f8',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  configRow: {
    flexDirection: 'row',
    gap: 12,
  },
  configItem: {
    flex: 1,
  },
  configLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  configInput: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    textAlign: 'center',
  },
  
  // Estilos para Modal de Atualização de Meta
  updateGoalModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  updateGoalModalContainer: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    margin: 20,
    maxWidth: 400,
    width: '90%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  updateGoalModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  updateGoalModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  updateGoalModalCloseButton: {
    padding: 4,
  },
  updateGoalModalContent: {
    gap: 16,
  },
  updateGoalModalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  updateGoalModalSubtitle: {
    fontSize: 16,
    color: '#007AFF',
    textAlign: 'center',
    fontWeight: '500',
  },
  updateGoalModalCurrentLabel: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  updateGoalInputContainer: {
    marginVertical: 10,
  },
  updateGoalInputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  updateGoalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  updateGoalModalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  updateGoalCancelButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  updateGoalCancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  updateGoalConfirmButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  updateGoalConfirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },

  // Estilos do Modal de Dicas de Saúde
  healthTipsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  healthTipsModalContainer: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 0,
    elevation: 10,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  healthTipsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  healthTipsModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  healthTipsCloseButton: {
    padding: 5,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 15,
    paddingVertical: 10,
    gap: 8,
  },
  tipCategoryButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  selectedTipCategoryButton: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  tipCategoryButtonText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  selectedTipCategoryButtonText: {
    color: 'white',
  },
  tipsScrollView: {
    flex: 1,
    paddingHorizontal: 15,
  },
  tipCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    elevation: 2,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  unreadTipCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
    backgroundColor: '#f8fff8',
  },
  tipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  tipHeaderLeft: {
    flexDirection: 'row',
    flex: 1,
    alignItems: 'flex-start',
  },
  tipIcon: {
    fontSize: 20,
    marginRight: 10,
    marginTop: 2,
  },
  tipTitleContainer: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 2,
  },
  tipCategory: {
    fontSize: 12,
    color: '#666',
  },
  tipActions: {
    flexDirection: 'row',
    gap: 8,
  },
  markReadButton: {
    padding: 4,
  },
  tipContent: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginBottom: 8,
  },
  tipDate: {
    fontSize: 11,
    color: '#999',
    textAlign: 'right',
  },
  noTipsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noTipsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
    marginTop: 10,
  },
  noTipsSubtext: {
    fontSize: 13,
    color: '#bbb',
    textAlign: 'center',
    marginTop: 5,
    paddingHorizontal: 20,
  },
});
