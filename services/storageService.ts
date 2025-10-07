import {
    deleteObject,
    getDownloadURL,
    ref,
    uploadBytes,
    uploadBytesResumable
} from 'firebase/storage';
import { storage } from '../config/firebase';

export const storageService = {
  // Upload de arquivo
  async uploadFile(path: string, file: Blob | Uint8Array | ArrayBuffer): Promise<string> {
    try {
      const storageRef = ref(storage, path);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      return downloadURL;
    } catch (error) {
      console.error('Erro ao fazer upload do arquivo:', error);
      throw error;
    }
  },

  // Upload com progresso
  uploadFileWithProgress(
    path: string,
    file: Blob | Uint8Array | ArrayBuffer,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const storageRef = ref(storage, path);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          if (onProgress) {
            onProgress(progress);
          }
        },
        (error) => {
          console.error('Erro no upload:', error);
          reject(error);
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(downloadURL);
          } catch (error) {
            reject(error);
          }
        }
      );
    });
  },

  // Deletar arquivo
  async deleteFile(path: string): Promise<void> {
    try {
      const storageRef = ref(storage, path);
      await deleteObject(storageRef);
    } catch (error) {
      console.error('Erro ao deletar arquivo:', error);
      throw error;
    }
  },

  // Upload de imagem do perfil do usuário
  async uploadProfileImage(userId: string, imageFile: Blob): Promise<string> {
    const imagePath = `profiles/${userId}/avatar.jpg`;
    return this.uploadFile(imagePath, imageFile);
  },

  // Upload de imagem genérica
  async uploadImage(folder: string, fileName: string, imageFile: Blob): Promise<string> {
    const imagePath = `${folder}/${fileName}`;
    return this.uploadFile(imagePath, imageFile);
  },

  // Obter URL de download
  async getDownloadURL(path: string): Promise<string> {
    try {
      const storageRef = ref(storage, path);
      return await getDownloadURL(storageRef);
    } catch (error) {
      console.error('Erro ao obter URL de download:', error);
      throw error;
    }
  },
};