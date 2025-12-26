import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StatusBar, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Card } from '../components/Card';
import { GradientButton } from '../components/GradientButton';
import { Body, Heading } from '../components/Typography';
import { RADIUS, SPACING } from '../constants/Theme';
import { useTheme } from '../context/ThemeContext';
import { auth } from '../services/firebaseConfig';

export default function LoginScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (error) {
      console.log(error); // Log to console instead of error to avoid RedBox
      let msg = 'Authentication failed. Please check your internet connection.';

      if (error.code === 'auth/invalid-email') msg = 'Invalid email address.';
      if (error.code === 'auth/wrong-password') msg = 'Incorrect password.';
      if (error.code === 'auth/email-already-in-use') msg = 'Email already in use.';
      if (error.code === 'auth/weak-password') msg = 'Password should be at least 6 characters.';
      if (error.code === 'auth/invalid-credential') msg = 'Incorrect email or password.';
      if (error.code === 'auth/user-not-found') msg = 'No account found with this email.';

      Alert.alert('Authentication Error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <LinearGradient
        colors={colors.primaryGradient}
        style={styles.headerGradient}
      >
        <View style={styles.headerContent}>
          <View style={[styles.logoContainer, { backgroundColor: colors.surface }]}>
            <MaterialIcons name="local-dining" size={48} color={colors.primary} />
          </View>
          <Heading level={1} style={styles.title} inverse>LabelScanner</Heading>
          <Body style={styles.subtitle} inverse>{isLogin ? 'Welcome Back!' : 'Create an Account'}</Body>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.formContainer}
      >
        <Card premium style={styles.card}>
          <View style={[styles.inputContainer, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
            <MaterialIcons name="email" size={20} color={colors.primary} style={styles.icon} />
            <TextInput
              placeholder="Email Address"
              style={[styles.input, { color: colors.text.primary }]}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholderTextColor={colors.text.muted}
            />
          </View>

          <View style={[styles.inputContainer, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
            <MaterialIcons name="lock" size={20} color={colors.primary} style={styles.icon} />
            <TextInput
              placeholder="Password"
              style={[styles.input, { color: colors.text.primary }]}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholderTextColor={colors.text.muted}
            />
          </View>

          <GradientButton
            title={isLogin ? 'Log In' : 'Sign Up'}
            onPress={handleAuth}
            loading={loading}
          />

          <TouchableOpacity onPress={() => setIsLogin(!isLogin)} style={styles.switchButton}>
            <Body muted style={styles.switchText}>
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <Body style={{ color: colors.primary, fontWeight: '700' }}>
                {isLogin ? 'Sign Up' : 'Log In'}
              </Body>
            </Body>
          </TouchableOpacity>
        </Card>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerGradient: {
    height: 380,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomLeftRadius: 60,
    borderBottomRightRadius: 60,
    paddingBottom: 60,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.xl,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  headerContent: { alignItems: 'center' },
  title: { marginTop: 10 },
  subtitle: { marginTop: 8 },
  formContainer: { flex: 1, marginTop: -80, paddingHorizontal: SPACING.lg },
  card: {
    padding: SPACING.xl,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 56,
    marginBottom: SPACING.md,
    borderWidth: 1,
  },
  icon: { marginRight: SPACING.sm },
  input: { flex: 1, height: '100%', fontSize: 16, fontWeight: '500' },
  switchButton: { alignItems: 'center', marginTop: SPACING.lg },
  switchText: { fontSize: 14 },
});

