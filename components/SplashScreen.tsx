import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef } from 'react';
import {
    Animated,
    Dimensions,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from 'react-native';

const { width, height } = Dimensions.get('window');

interface SplashScreenProps {
  onFinish: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  // Animações
  const logoScale = useRef(new Animated.Value(0.5)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const iconRotation = useRef(new Animated.Value(0)).current;
  const progressWidth = useRef(new Animated.Value(0)).current;
  const backgroundIconsOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Sequência de animações
    const animationSequence = Animated.sequence([
      // 1. Fade in dos ícones de fundo
      Animated.timing(backgroundIconsOpacity, {
        toValue: 0.1,
        duration: 800,
        useNativeDriver: true,
      }),

      // 2. Aparecer logo com escala
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),

      // 3. Aparecer título
      Animated.timing(titleOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),

      // 4. Animação da barra de progresso
      Animated.timing(progressWidth, {
        toValue: width * 0.7,
        duration: 2000,
        useNativeDriver: false,
      }),
    ]);

    // Rotação contínua do ícone central
    const rotationAnimation = Animated.loop(
      Animated.timing(iconRotation, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: true,
      })
    );

    // Iniciar animações
    animationSequence.start();
    rotationAnimation.start();

    // Finalizar splash screen após as animações
    const timer = setTimeout(() => {
      onFinish();
    }, 3500);

    return () => {
      clearTimeout(timer);
      rotationAnimation.stop();
    };
  }, []);

  const spin = iconRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      
      {/* Gradient Background */}
      <LinearGradient
        colors={['#1a1a2e', '#16213e', '#0f3460']}
        style={styles.gradient}
      />

      {/* Background Icons - Elementos fitness */}
      <Animated.View 
        style={[
          styles.backgroundIcons,
          { opacity: backgroundIconsOpacity }
        ]}
      >
        {/* Halteres */}
        <Ionicons 
          name="barbell" 
          size={80} 
          color="#ffffff" 
          style={[styles.bgIcon, styles.bgIcon1]} 
        />
        <MaterialIcons 
          name="fitness-center" 
          size={60} 
          color="#ffffff" 
          style={[styles.bgIcon, styles.bgIcon2]} 
        />
        
        {/* Elementos de dieta */}
        <Ionicons 
          name="nutrition" 
          size={50} 
          color="#ffffff" 
          style={[styles.bgIcon, styles.bgIcon3]} 
        />
        <MaterialIcons 
          name="local-dining" 
          size={45} 
          color="#ffffff" 
          style={[styles.bgIcon, styles.bgIcon4]} 
        />
        
        {/* Elementos de atividade */}
        <Ionicons 
          name="walk" 
          size={55} 
          color="#ffffff" 
          style={[styles.bgIcon, styles.bgIcon5]} 
        />
        <MaterialIcons 
          name="directions-run" 
          size={65} 
          color="#ffffff" 
          style={[styles.bgIcon, styles.bgIcon6]} 
        />
        
        {/* Timer e métricas */}
        <Ionicons 
          name="timer" 
          size={40} 
          color="#ffffff" 
          style={[styles.bgIcon, styles.bgIcon7]} 
        />
        <MaterialIcons 
          name="trending-up" 
          size={50} 
          color="#ffffff" 
          style={[styles.bgIcon, styles.bgIcon8]} 
        />
      </Animated.View>

      {/* Conteúdo Principal */}
      <View style={styles.content}>
        {/* Logo Principal */}
        <Animated.View
          style={[
            styles.logoContainer,
            {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
            },
          ]}
        >
          {/* Ícone principal com rotação */}
          <Animated.View
            style={[
              styles.mainIcon,
              { transform: [{ rotate: spin }] },
            ]}
          >
            <MaterialIcons name="fitness-center" size={80} color="#00ff7f" />
          </Animated.View>

          {/* Título StepFit */}
          <Animated.View style={{ opacity: titleOpacity }}>
            <Text style={styles.title}>StepFit</Text>
            <Text style={styles.subtitle}>Seu Personal Trainer Digital</Text>
          </Animated.View>
        </Animated.View>

        {/* Barra de Progresso */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <Animated.View
              style={[
                styles.progressFill,
                { width: progressWidth },
              ]}
            />
          </View>
          <Text style={styles.loadingText}>Preparando seu treino...</Text>
        </View>
      </View>

      {/* Versão */}
      <View style={styles.versionContainer}>
        <Text style={styles.versionText}>v1.0.0</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  backgroundIcons: {
    position: 'absolute',
    width: width,
    height: height,
  },
  bgIcon: {
    position: 'absolute',
    opacity: 0.1,
  },
  bgIcon1: {
    top: '15%',
    left: '10%',
    transform: [{ rotate: '-15deg' }],
  },
  bgIcon2: {
    top: '25%',
    right: '15%',
    transform: [{ rotate: '20deg' }],
  },
  bgIcon3: {
    top: '45%',
    left: '5%',
    transform: [{ rotate: '45deg' }],
  },
  bgIcon4: {
    top: '55%',
    right: '10%',
    transform: [{ rotate: '-30deg' }],
  },
  bgIcon5: {
    top: '70%',
    left: '20%',
    transform: [{ rotate: '10deg' }],
  },
  bgIcon6: {
    top: '75%',
    right: '25%',
    transform: [{ rotate: '-45deg' }],
  },
  bgIcon7: {
    top: '35%',
    left: '80%',
    transform: [{ rotate: '60deg' }],
  },
  bgIcon8: {
    top: '65%',
    left: '75%',
    transform: [{ rotate: '-20deg' }],
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 80,
  },
  mainIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(0, 255, 127, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    borderWidth: 2,
    borderColor: '#00ff7f',
    shadowColor: '#00ff7f',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 2,
    textShadowColor: 'rgba(0, 255, 127, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#00ff7f',
    textAlign: 'center',
    fontWeight: '300',
    letterSpacing: 1,
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
  },
  progressBar: {
    width: width * 0.7,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    marginBottom: 20,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#00ff7f',
    borderRadius: 2,
    shadowColor: '#00ff7f',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontWeight: '300',
  },
  versionContainer: {
    position: 'absolute',
    bottom: 40,
    right: 30,
  },
  versionText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    fontWeight: '300',
  },
});