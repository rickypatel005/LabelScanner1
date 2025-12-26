import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { onAuthStateChanged } from 'firebase/auth';
import { onValue, ref } from 'firebase/database';
import { ActivityIndicator, useColorScheme, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DARK_THEME, LIGHT_THEME } from './constants/Theme';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { auth, database } from './services/firebaseConfig';

import AchievementsScreen from './app_screens/AchievementsScreen';
import EditProfileScreen from './app_screens/EditProfileScreen';
import HistoryScreen from './app_screens/HistoryScreen';
import HomeScreen from './app_screens/HomeScreen';
import LoginScreen from './app_screens/LoginScreen';
import LogScreen from './app_screens/LogScreen';
import ManualEntryScreen from './app_screens/ManualEntryScreen';
import OnboardingScreen from './app_screens/OnboardingScreen';
import ProfileScreen from './app_screens/ProfileScreen';
import ResultScreen from './app_screens/ResultScreen';
import ScanScreen from './app_screens/ScanScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function MainTabs() {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size, focused }) => {
          const icons = {
            'Home': focused ? 'home' : 'home-outline',
            'Log': focused ? 'list' : 'list-outline',
            'Scan': focused ? 'camera' : 'camera-outline',
            'History': focused ? 'time' : 'time-outline',
            'Profile': focused ? 'person' : 'person-outline'
          };
          return <Ionicons name={icons[route.name]} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.text.muted,
        headerShown: false,
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.surface,
          height: 85,
          paddingBottom: 25,
          paddingTop: 10,
        },
        tabBarShowLabel: true,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Home' }} />
      <Tab.Screen name="Log" component={LogScreen} options={{ title: 'Log' }} />
      <Tab.Screen name="Scan" component={ScanScreen} options={{ title: 'Scan' }} />
      <Tab.Screen name="History" component={HistoryScreen} options={{ title: 'History' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}


export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const colorScheme = useColorScheme();

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setLoading(false);
        setOnboardingComplete(false);
      }
    });

    return unsubAuth;
  }, []);

  useEffect(() => {
    if (user) {
      const settingsRef = ref(database, `users/${user.uid}/settings`);
      const unsubSettings = onValue(settingsRef, (snapshot) => {
        const data = snapshot.val();
        if (data && data.diet) {
          setOnboardingComplete(true);
        } else {
          setOnboardingComplete(false);
        }
        setLoading(false);
      });
      return unsubSettings;
    }
  }, [user]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colorScheme === 'dark' ? DARK_THEME.colors.background : LIGHT_THEME.colors.background }}>
        <ActivityIndicator size="large" color={colorScheme === 'dark' ? DARK_THEME.colors.primary : LIGHT_THEME.colors.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <NavigationContainer theme={colorScheme === 'dark' ? DARK_THEME : LIGHT_THEME}>
          <StatusBar style="auto" />
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            {!user ? (
              <Stack.Screen name="Login" component={LoginScreen} />
            ) : !onboardingComplete ? (
              <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            ) : (
              <Stack.Screen name="MainApp" component={MainTabs} />
            )}
            <Stack.Screen name="EditProfile" component={EditProfileScreen} />
            <Stack.Screen name="Result" component={ResultScreen} />
            <Stack.Screen name="ManualEntry" component={ManualEntryScreen} />
            <Stack.Screen name="History" component={HistoryScreen} />
            <Stack.Screen name="Achievements" component={AchievementsScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
