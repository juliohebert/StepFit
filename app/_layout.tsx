import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

import { SplashScreen } from '@/components/SplashScreen';
import { FirebaseProvider } from '@/contexts/FirebaseContext';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [isLoading, setIsLoading] = useState(true);

  // Simular carregamento inicial do app
  useEffect(() => {
    // Você pode adicionar aqui qualquer inicialização necessária
    // Por exemplo: verificar autenticação, carregar dados iniciais, etc.
  }, []);

  if (isLoading) {
    return (
      <SplashScreen 
        onFinish={() => setIsLoading(false)} 
      />
    );
  }

  return (
    <FirebaseProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </FirebaseProvider>
  );
}
