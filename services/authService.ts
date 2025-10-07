import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    updateProfile,
    User,
} from 'firebase/auth';
import { auth } from '../config/firebase';

export const authService = {
  // Criar nova conta
  async createAccount(email: string, password: string, displayName?: string): Promise<User> {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      if (displayName && userCredential.user) {
        await updateProfile(userCredential.user, { displayName });
      }
      
      return userCredential.user;
    } catch (error) {
      console.error('Erro ao criar conta:', error);
      throw error;
    }
  },

  // Fazer login
  async signIn(email: string, password: string): Promise<User> {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return userCredential.user;
    } catch (error) {
      console.error('Erro ao fazer login:', error);
      throw error;
    }
  },

  // Fazer logout
  async signOut(): Promise<void> {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      throw error;
    }
  },

  // Obter usuário atual
  getCurrentUser(): User | null {
    return auth.currentUser;
  },

  // Atualizar perfil
  async updateUserProfile(updates: { displayName?: string; photoURL?: string }): Promise<void> {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Usuário não autenticado');
      
      await updateProfile(user, updates);
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      throw error;
    }
  },
};