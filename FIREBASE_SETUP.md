# Configuração Firebase - StepFit

## ✅ Configuração Concluída

O Firebase foi configurado com sucesso no seu projeto! Aqui está o que foi implementado:

### 🔧 Serviços Configurados

1. **Firebase Config** (`config/firebase.ts`)
   - Configuração com suas credenciais
   - Inicialização dos serviços (Auth, Firestore, Storage)

2. **Context Provider** (`contexts/FirebaseContext.tsx`)
   - Gerenciamento de estado de autenticação
   - Hook `useFirebase()` para usar em componentes

3. **Serviços**
   - **Auth Service** (`services/authService.ts`) - Login, registro, logout
   - **Firestore Service** (`services/firestoreService.ts`) - CRUD no banco de dados
   - **Storage Service** (`services/storageService.ts`) - Upload de arquivos

### 📝 Configuração Adicional Necessária

Para completar a configuração, você precisa atualizar o arquivo `config/firebase.ts` com as informações completas do seu projeto Firebase:

1. Acesse o [Console do Firebase](https://console.firebase.google.com/)
2. Vá para o seu projeto `stepfit-9ee62`
3. Acesse "Configurações do projeto" > "Geral"
4. Na seção "Seus aplicativos", clique no ícone da web (`</>`)
5. Copie as informações e atualize o arquivo `config/firebase.ts`:

```typescript
const firebaseConfig = {
  apiKey: "AIzaSyAO8dnhXCJAlJzaos9PaGvCTe0L148eWVg",
  authDomain: "stepfit-9ee62.firebaseapp.com",
  projectId: "stepfit-9ee62",
  storageBucket: "stepfit-9ee62.appspot.com",
  messagingSenderId: "SEU_MESSAGING_SENDER_ID", // Substitua
  appId: "SEU_APP_ID" // Substitua
};
```

### 🚀 Como Usar

#### 1. Autenticação
```typescript
import { authService } from '@/services/authService';

// Criar conta
const user = await authService.createAccount('email@exemplo.com', 'senha123', 'Nome');

// Login
const user = await authService.signIn('email@exemplo.com', 'senha123');

// Logout
await authService.signOut();
```

#### 2. Firestore (Banco de Dados)
```typescript
import { firestoreService } from '@/services/firestoreService';

// Adicionar treino
const workoutData = {
  userId: 'user123',
  type: 'corrida',
  duration: 30,
  distance: 5,
  calories: 300
};
const docId = await firestoreService.addDocument('workouts', workoutData);

// Obter treinos do usuário
const workouts = await firestoreService.getUserDocuments('workouts', userId);
```

#### 3. Storage (Arquivos)
```typescript
import { storageService } from '@/services/storageService';

// Upload de foto
const imageUrl = await storageService.uploadProfileImage(userId, imageFile);
```

#### 4. Usar o Context em Componentes
```typescript
import { useFirebase } from '@/contexts/FirebaseContext';

export default function MeuComponente() {
  const { user, loading } = useFirebase();

  if (loading) return <Text>Carregando...</Text>;

  return (
    <View>
      {user ? (
        <Text>Olá, {user.displayName}!</Text>
      ) : (
        <Text>Faça login</Text>
      )}
    </View>
  );
}
```

### 🏗️ Estrutura de Dados Recomendada

#### Usuário
```typescript
{
  id: string,
  email: string,
  displayName: string,
  photoURL?: string,
  preferences: {
    units: 'metric' | 'imperial',
    notifications: boolean,
    privateProfile: boolean
  },
  createdAt: Date,
  updatedAt: Date
}
```

#### Treino
```typescript
{
  id: string,
  userId: string,
  type: 'corrida' | 'caminhada' | 'ciclismo',
  duration: number, // minutos
  distance: number, // km
  steps: number,
  calories: number,
  date: Date,
  notes?: string,
  createdAt: Date,
  updatedAt: Date
}
```

#### Meta
```typescript
{
  id: string,
  userId: string,
  type: 'steps' | 'distance' | 'calories',
  target: number,
  period: 'daily' | 'weekly' | 'monthly',
  startDate: Date,
  endDate: Date,
  isActive: boolean,
  progress: number,
  createdAt: Date,
  updatedAt: Date
}
```

### 🔒 Regras de Segurança

Configure as regras de segurança no Firebase Console:

#### Firestore Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Usuários podem ler/escrever seus próprios dados
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Treinos privados do usuário
    match /workouts/{workoutId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == resource.data.userId;
    }
    
    // Metas privadas do usuário
    match /goals/{goalId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == resource.data.userId;
    }
  }
}
```

#### Storage Rules
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Perfis de usuário
    match /profiles/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Uploads gerais do usuário
    match /uploads/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### 📱 Próximos Passos

1. Complete a configuração das credenciais
2. Configure as regras de segurança
3. Habilite os serviços necessários no Firebase Console:
   - Authentication (Email/Password)
   - Firestore Database
   - Storage
4. Teste a autenticação
5. Implemente as telas de login/registro
6. Comece a salvar dados dos treinos

### 🆘 Suporte

Para dúvidas sobre implementação específica, consulte:
- [Documentação Firebase](https://firebase.google.com/docs)
- [Firebase + React Native](https://rnfirebase.io/)
- Exemplos em `examples/firebaseExamples.ts`