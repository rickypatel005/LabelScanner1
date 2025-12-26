import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { LinearGradient } from 'expo-linear-gradient';
import { get, push, ref, remove, serverTimestamp, update } from 'firebase/database';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { Badge } from '../components/Badges';
import { Card } from '../components/Card';
import { GradientButton } from '../components/GradientButton';
import { ProgressRing } from '../components/Progress';
import { Body, Heading, Label } from '../components/Typography';
import { COLORS, RADIUS, SHADOWS, SPACING } from '../constants/Theme';
import { useTheme } from '../context/ThemeContext';
import { auth, database } from '../services/firebaseConfig';
import { analyzeImageWithGemini } from '../services/geminiService';
import { updateStreakAndAchievements } from '../services/habitService';
import { updateLogEntry } from '../services/logService';

export default function ResultScreen({ route, navigation }) {
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [multiplier, setMultiplier] = useState(1);
  const [analysis, setAnalysis] = useState(null);
  const [productName, setProductName] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [notes, setNotes] = useState('');

  const { imageUri, logData } = route.params || {};

  useEffect(() => {
    if (logData) {
      // History Mode: Load existing data
      // Reverse calculate base values if portions > 1 to ensure multiplier logic works correctly
      const portions = logData.portions || 1;
      const baseCalories = logData.calories ? logData.calories / portions : 0;
      const baseProtein = logData.protein ? logData.protein / portions : 0;
      const baseFat = logData.totalFat ? logData.totalFat / portions : 0; // Assuming totalFat is stored
      // Note: If some macros aren't stored, they might show 0.

      setAnalysis({
        ...logData,
        calories: baseCalories,
        protein: baseProtein,
        totalFat: baseFat,
        carbohydrates: logData.carbohydrates ? logData.carbohydrates / portions : 0,
        healthScore: logData.healthScore || 0,
        healthInsight: logData.healthInsight || '',
        allergens: logData.allergens || [],
        alternatives: logData.alternatives || [],
        vegetarianStatus: logData.vegetarianStatus || 'Unknown'
      });
      setProductName(logData.productName || '');
      setNotes(logData.notes || '');
      setMultiplier(portions);

    } else if (imageUri) {
      // Scan Mode: Process new image
      processImage(imageUri);
    }
    checkFavorite();
  }, [imageUri, logData]);

  const checkFavorite = async () => {
    const user = auth.currentUser;
    if (user && productName) {
      const favRef = ref(database, `users/${user.uid}/favorites/${productName.replace(/[.#$[\]]/g, "")}`);
      const snap = await get(favRef);
      if (snap.exists()) setIsFavorite(true);
    }
  };

  const processImage = async (uri) => {
    setLoading(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
      const user = auth.currentUser;
      let userProfile = { vegType: 'Vegetarian', goal: 'General Health' };

      if (user) {
        const snapshot = await get(ref(database, `users/${user.uid}/settings`));
        if (snapshot.exists()) {
          const s = snapshot.val();
          const diet = s.diet ? (Array.isArray(s.diet) ? s.diet.join(', ') : s.diet) : 'Vegetarian';
          userProfile = {
            vegType: diet,
            goal: s.goal || 'General Health'
          };
        }
      }

      const data = await analyzeImageWithGemini(base64, userProfile);
      if (data) {
        setAnalysis(data);
        if (data.productName) setProductName(data.productName);
      }
    } catch (error) {
      Alert.alert('Error', 'Could not analyze image. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async () => {
    const user = auth.currentUser;
    if (!user || !productName) return;

    const safeName = productName.replace(/[.#$[\]]/g, "");
    const favRef = ref(database, `users/${user.uid}/favorites/${safeName}`);

    if (isFavorite) {
      await remove(favRef);
      setIsFavorite(false);
    } else {
      await update(ref(database, `users/${user.uid}/favorites`), {
        [safeName]: { productName, calories: analysis.calories, protein: analysis.protein, timestamp: serverTimestamp() }
      });
      setIsFavorite(true);
    }
  };

  const saveToLog = async () => {
    if (!analysis || !productName.trim()) {
      Alert.alert('Required', 'Please enter a product name');
      return;
    }

    try {
      const user = auth.currentUser;
      if (!user) return;

      if (isEditing && logData) {
        // UPDATE Existing Log
        const updatedData = {
          ...logData, // Keep original timestamp/id unless we let them change
          // Update mutable fields
          productName, // Though mostly read-only, we let them fix name if needed
          notes,
          portions: multiplier,
          calories: Math.round(analysis.calories * multiplier),
          protein: Math.round(analysis.protein * multiplier * 10) / 10,
          carbohydrates: Math.round((analysis.carbohydrates || 0) * multiplier * 10) / 10,
          totalFat: Math.round(analysis.totalFat * multiplier * 10) / 10,
        };

        await updateLogEntry(user.uid, logData.id, updatedData);
        Alert.alert("Updated", "Entry updated successfully");
        navigation.goBack();

      } else {
        // CREATE New Log
        const logsRef = ref(database, `users/${user.uid}/foodLogs`);
        const newLogData = {
          timestamp: serverTimestamp(),
          productName,
          ...analysis,
          notes,
          calories: Math.round(analysis.calories * multiplier),
          protein: Math.round(analysis.protein * multiplier * 10) / 10,
          carbohydrates: Math.round((analysis.carbohydrates || 0) * multiplier * 10) / 10,
          imageUri,
          portions: multiplier,
        };

        await push(logsRef, newLogData);
        await updateStreakAndAchievements(user.uid, newLogData);

        Alert.alert('Success', 'Saved to your diary!');
        navigation.navigate('MainApp', { screen: 'Log' });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save.');
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return '#10b981'; // Green
    if (score >= 60) return '#fbbf24'; // Yellow
    if (score >= 40) return '#f59e0b'; // Orange
    return '#ef4444'; // Red
  };

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Heading level={2} style={styles.loadingText}>Analyzing Label...</Heading>
        <Body muted>Gemini AI is scanning ingredients</Body>
      </View>
    );
  }

  if (!analysis) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <MaterialIcons name="error-outline" size={48} color={colors.text.muted} />
        <Heading level={2} style={styles.loadingText}>No Data Found</Heading>
        <Body muted style={{ textAlign: 'center', maxWidth: 300 }}>
          We couldn't analyze the image or find any data. Please try scanning again.
        </Body>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.retryBtn}>
          <Body style={{ color: '#fff', fontWeight: 'bold' }}>Go Back</Body>
        </TouchableOpacity>
      </View>
    );
  }
  const scoreColor = getScoreColor(analysis.healthScore);

  const MacroCard = ({ label, value, unit }) => (
    <View style={[styles.macroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Heading level={3} style={{ color: colors.text.primary }}>{Math.round(value * multiplier * 10) / 10}</Heading>
      <Label style={{ fontSize: 10 }}>{unit}</Label>
      <Body muted style={{ fontSize: 11, marginTop: 2 }}>{label}</Body>
    </View>
  );

  return (
    <View style={[styles.mainContainer, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false} bounces={false}>

        {/* Hero Section */}
        <ImageBackground source={{ uri: imageUri }} style={styles.heroBackground}>
          <LinearGradient colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.8)']} style={styles.heroGradient}>
            <View style={styles.headerNav}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
                <Ionicons name="chevron-back" size={24} color="#fff" />
              </TouchableOpacity>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {logData && (
                  <TouchableOpacity onPress={() => setIsEditing(!isEditing)} style={[styles.iconBtn, isEditing && { backgroundColor: colors.primary }]}>
                    <MaterialIcons name="edit" size={20} color="#fff" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={toggleFavorite} style={styles.iconBtn}>
                  <Ionicons
                    name={isFavorite ? "heart" : "heart-outline"}
                    size={24}
                    color={isFavorite ? "#ff4757" : "#fff"}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <Card glass style={styles.scoreHeroCard}>
              <ProgressRing
                progress={analysis.healthScore}
                size={120}
                strokeWidth={10}
                color={scoreColor}
                label="HEALTH"
              />
              <View style={styles.nameHeader}>
                <TextInput
                  style={[styles.nameInput, isEditing && { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.3)' }]}
                  value={productName}
                  onChangeText={setProductName}
                  placeholder="Product Name"
                  placeholderTextColor="#ccc"
                  editable={isEditing || !logData} // Editable if new scan OR editing mode
                />
              </View>
              <Badge label={analysis.vegetarianStatus} type={analysis.vegetarianStatus.includes('Non') ? 'error' : 'success'} />
            </Card>
          </LinearGradient>
        </ImageBackground>

        <View style={styles.contentContainer}>
          {/* Portion Selector */}
          <View style={styles.portionRow}>
            <Body style={{ fontWeight: '700' }}>Select Portion</Body>
            <View style={[styles.multiplierContainer, { backgroundColor: colors.inputBackground }]}>
              {[1, 2, 3].map(v => (
                <TouchableOpacity
                  key={v}
                  onPress={() => setMultiplier(v)}
                  style={[styles.multiplierBtn, multiplier === v && { backgroundColor: colors.surface, ...SHADOWS.soft }]}
                >
                  <Body style={[styles.multiplierText, { color: multiplier === v ? colors.primary : colors.text.muted }]}>x{v}</Body>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Notes Section - Only visible in Edit mode or New Scan */}
          {(isEditing || !logData) && (
            <View style={styles.section}>
              <Heading level={3} style={styles.sectionTitle}>Notes</Heading>
              <TextInput
                style={[styles.notesInput, { backgroundColor: colors.surface, color: colors.text.primary }]}
                placeholder="Add notes about your meal..."
                placeholderTextColor={colors.text.muted}
                value={notes}
                onChangeText={setNotes}
                multiline
              />
            </View>
          )}

          {/* Short AI Verdict */}
          <Card style={styles.verdictCard}>
            <View style={styles.verdictHeader}>
              <MaterialIcons name="auto-awesome" size={18} color={colors.primary} />
              <Heading level={3}>AI Verdict</Heading>
            </View>
            <View style={styles.bulletContainer}>
              {analysis.healthInsight.split('. ').filter(s => s).map((sentence, i) => (
                <View key={i} style={styles.bulletRow}>
                  <View style={styles.bulletDot} />
                  <Body style={styles.verdictBody}>{sentence.replace('.', '')}</Body>
                </View>
              ))}
            </View>
          </Card>

          {/* Macros Row */}
          <View style={styles.macrosScroll}>
            <MacroCard label="Calories" value={analysis.calories} unit="kcal" />
            <MacroCard label="Protein" value={analysis.protein} unit="g" />
            <MacroCard label="Carbs" value={analysis.carbohydrates || 0} unit="g" />
            <MacroCard label="Fats" value={analysis.totalFat} unit="g" />
            <MacroCard label="Fiber" value={analysis.fiber || 0} unit="g" />
            <MacroCard label="Sugar" value={analysis.sugar?.labelSugar || 0} unit="g" />
          </View>

          {/* Allergens Row */}
          {analysis.allergens?.length > 0 && (
            <View style={styles.section}>
              <Heading level={3} style={styles.sectionTitle}>Allergens Detected</Heading>
              <View style={styles.chipRow}>
                {analysis.allergens.map((a, i) => <Badge key={i} label={a} type="error" style={{ marginRight: 8, marginBottom: 8 }} />)}
              </View>
            </View>
          )}

          {/* Better Alternatives */}
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Heading level={3}>Better Alternatives</Heading>
              <Label style={{ color: colors.primary }}>For Muscle Gain</Label>
            </View>
            {analysis.alternatives?.map((alt, i) => (
              <Card key={i} style={[styles.alternativeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="flash" size={20} color="#f1c40f" style={{ marginRight: 12 }} />
                <Body style={{ fontWeight: '600' }}>{alt}</Body>
              </Card>
            ))}
          </View>


          <GradientButton
            title={isEditing ? "Save Changes" : (logData ? "Add Again to Today" : "Save to Daily Diary")}
            onPress={saveToLog}
            style={{ marginTop: SPACING.xl, marginBottom: 50 }}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xxl },
  loadingText: { marginTop: SPACING.lg, marginBottom: 4 },
  retryBtn: { marginTop: 20, backgroundColor: COLORS.primary, paddingHorizontal: 30, paddingVertical: 12, borderRadius: RADIUS.md },

  heroBackground: { width: '100%', height: 420 },
  heroGradient: { flex: 1, padding: SPACING.lg, justifyContent: 'space-between' },
  headerNav: { marginTop: 50, flexDirection: 'row', justifyContent: 'space-between' },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },

  scoreHeroCard: { alignItems: 'center', paddingVertical: SPACING.lg, marginTop: 'auto' },
  nameHeader: { marginTop: 10, marginBottom: 8 },
  nameInput: { fontSize: 24, fontWeight: '800', color: '#fff', textAlign: 'center' },

  contentContainer: { padding: SPACING.lg, marginTop: -20 },

  portionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
  multiplierContainer: { flexDirection: 'row', backgroundColor: '#f3f4f6', borderRadius: RADIUS.md, padding: 4 },
  multiplierBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.sm },
  multiplierBtnActive: { backgroundColor: '#fff', ...SHADOWS.soft },
  multiplierText: { fontSize: 13, fontWeight: '600', color: COLORS.text.muted },
  multiplierTextActive: { color: COLORS.primary },

  verdictCard: { padding: SPACING.md, marginBottom: SPACING.xl },
  verdictHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  bulletContainer: { gap: 8 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  verdictCard: { padding: SPACING.md, marginBottom: SPACING.xl },
  verdictHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  bulletContainer: { gap: 8 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bulletDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(16, 185, 129, 0.5)', marginTop: 8 },
  verdictBody: { lineHeight: 22, fontSize: 15, flex: 1 },

  macrosScroll: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: SPACING.xl, justifyContent: 'space-between' },
  macroCard: {
    width: '30%',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    borderWidth: 1,
  },

  section: { marginBottom: SPACING.xl },
  sectionTitle: { marginBottom: SPACING.md },
  sectionTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  alternativeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    marginBottom: 12,
    borderRadius: RADIUS.md,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.soft
  },
  notesInput: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: 'top'
  }
});


