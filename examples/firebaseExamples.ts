// Exemplos de uso dos serviços Firebase
import { authService } from '../services/authService';
import { firestoreService } from '../services/firestoreService';
import { storageService } from '../services/storageService';

// Como usar o contexto Firebase em um componente React Native:
// import { useFirebase } from '../contexts/FirebaseContext';
// 
// const { user, loading } = useFirebase();
// 
// if (loading) {
//   return <Text>Carregando...</Text>;
// }
// 
// return (
//   <View>
//     {user ? (
//       <Text>Bem-vindo, {user.displayName || user.email}!</Text>
//     ) : (
//       <Text>Usuário não autenticado</Text>
//     )}
//   </View>
// );

// Exemplos de uso do serviço de autenticação
export const authExamples = {
  // Criar conta
  async createAccount() {
    try {
      const user = await authService.createAccount(
        'usuario@email.com',
        'senha123',
        'Nome do Usuário'
      );
      console.log('Usuário criado:', user);
    } catch (error) {
      console.error('Erro ao criar conta:', error);
    }
  },

  // Fazer login
  async signIn() {
    try {
      const user = await authService.signIn('usuario@email.com', 'senha123');
      console.log('Login realizado:', user);
    } catch (error) {
      console.error('Erro no login:', error);
    }
  },

  // Fazer logout
  async signOut() {
    try {
      await authService.signOut();
      console.log('Logout realizado');
    } catch (error) {
      console.error('Erro no logout:', error);
    }
  }
};

// Exemplos de uso do Firestore
export const firestoreExamples = {
  // Adicionar dados de treino
  async addWorkout() {
    try {
      const workoutData = {
        userId: authService.getCurrentUser()?.uid,
        type: 'corrida',
        duration: 30, // minutos
        distance: 5, // km
        calories: 300,
        date: new Date(),
      };

      const docId = await firestoreService.addDocument('workouts', workoutData);
      console.log('Treino adicionado com ID:', docId);
    } catch (error) {
      console.error('Erro ao adicionar treino:', error);
    }
  },

  // Obter treinos do usuário
  async getUserWorkouts() {
    try {
      const userId = authService.getCurrentUser()?.uid;
      if (!userId) return;

      const workouts = await firestoreService.getUserDocuments('workouts', userId);
      console.log('Treinos do usuário:', workouts);
      return workouts;
    } catch (error) {
      console.error('Erro ao obter treinos:', error);
    }
  },

  // Atualizar treino
  async updateWorkout(workoutId: string) {
    try {
      const updateData = {
        calories: 350,
        notes: 'Treino intenso hoje!'
      };

      await firestoreService.updateDocument('workouts', workoutId, updateData);
      console.log('Treino atualizado');
    } catch (error) {
      console.error('Erro ao atualizar treino:', error);
    }
  }
};

// Exemplos de uso do Storage
export const storageExamples = {
  // Upload de foto de perfil
  async uploadProfilePicture(imageFile: Blob) {
    try {
      const userId = authService.getCurrentUser()?.uid;
      if (!userId) return;

      const imageUrl = await storageService.uploadProfileImage(userId, imageFile);
      
      // Atualizar URL da foto no perfil do usuário
      await authService.updateUserProfile({ photoURL: imageUrl });
      
      console.log('Foto de perfil atualizada:', imageUrl);
      return imageUrl;
    } catch (error) {
      console.error('Erro ao fazer upload da foto:', error);
    }
  },

  // Upload com progresso
  async uploadWithProgress(file: Blob) {
    try {
      const userId = authService.getCurrentUser()?.uid;
      const filePath = `uploads/${userId}/${Date.now()}.jpg`;

      const url = await storageService.uploadFileWithProgress(
        filePath,
        file,
        (progress) => {
          console.log(`Upload: ${progress.toFixed(2)}%`);
        }
      );

      console.log('Upload concluído:', url);
      return url;
    } catch (error) {
      console.error('Erro no upload:', error);
    }
  }
};

// Exemplo de estruturas de dados recomendadas para StepFit
export const dataStructures = {
  // Usuário
  user: {
    id: 'userId',
    email: 'usuario@email.com',
    displayName: 'Nome do Usuário',
    photoURL: 'https://...',
    createdAt: new Date(),
    updatedAt: new Date(),
    preferences: {
      units: 'metric', // metric ou imperial
      notifications: true,
      privateProfile: false,
    }
  },

  // Treino
  workout: {
    id: 'workoutId',
    userId: 'userId',
    type: 'corrida', // corrida, caminhada, ciclismo, etc.
    duration: 30, // minutos
    distance: 5, // km
    steps: 6500,
    calories: 300,
    avgHeartRate: 140,
    maxHeartRate: 165,
    date: new Date(),
    route: {
      startLocation: { lat: 0, lng: 0 },
      endLocation: { lat: 0, lng: 0 },
      path: [{ lat: 0, lng: 0, timestamp: new Date() }]
    },
    notes: 'Treino matinal',
    createdAt: new Date(),
    updatedAt: new Date(),
  },

  // Meta
  goal: {
    id: 'goalId',
    userId: 'userId',
    type: 'steps', // steps, distance, calories, workouts
    target: 10000,
    period: 'daily', // daily, weekly, monthly
    startDate: new Date(),
    endDate: new Date(),
    isActive: true,
    progress: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
};