import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { get, onValue, ref, remove } from 'firebase/database';
import React, { useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StatusBar, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Badge } from '../components/Badges';
import { Card } from '../components/Card';
import { ProgressBar } from '../components/Progress';
import { Body, Heading, Label } from '../components/Typography';
import { COLORS, RADIUS, SPACING } from '../constants/Theme';
import { useTheme } from '../context/ThemeContext';
import { auth, database } from '../services/firebaseConfig';

export default function TodayScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ totalCalories: 0, totalProtein: 0 });
  const [limits, setLimits] = useState({ calories: 2000, protein: 50, water: 3 });

  useFocusEffect(React.useCallback(() => { loadData(); }, []));

  const loadData = async () => {
    const user = auth.currentUser;
    if (!user) { setLoading(false); return; }

    try {
      const settingsSnap = await get(ref(database, `users/${user.uid}/settings`));
      if (settingsSnap.exists()) {
        const data = settingsSnap.val();
        if (data.calculatedLimits) setLimits(data.calculatedLimits);
      }
    } catch (err) {
      console.log("Error fetching settings", err);
    }

    const logsRef = ref(database, `users/${user.uid}/foodLogs`);
    const unsubscribe = onValue(logsRef, async (snapshot) => {
      const data = snapshot.val();
      const todayLogs = [];
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

      if (data) {
        Object.keys(data).forEach((key) => {
          const log = data[key];
          if (log.timestamp >= todayStart) todayLogs.push({ id: key, ...log });
        });
      }

      todayLogs.sort((a, b) => b.timestamp - a.timestamp);
      setLogs(todayLogs);

      const totalCal = todayLogs.reduce((sum, log) => sum + (parseFloat(log.calories) || 0), 0);
      const totalProt = todayLogs.reduce((sum, log) => sum + (parseFloat(log.protein) || 0), 0);

      setSummary({
        totalCalories: Math.round(totalCal),
        totalProtein: Math.round(totalProt * 10) / 10,
        totalWater: 0 // Will update below
      });

      // Fetch Water Logs
      const waterRef = ref(database, `users/${user.uid}/waterLogs`);
      const waterSnap = await get(waterRef);
      if (waterSnap.exists()) {
        const wLogs = waterSnap.val();
        let totalWater = 0;
        Object.values(wLogs).forEach(log => {
          if (log.timestamp >= todayStart) {
            totalWater += parseFloat(log.amount) || 0;
          }
        });
        setSummary(prev => ({ ...prev, totalWater: Math.round(totalWater * 100) / 100 }));
      }

      setLoading(false);
    });

    return unsubscribe;
  };

  const addWater = async () => {
    const user = auth.currentUser;
    if (!user) return;
    const amountToAdd = 0.25; // 250ml

    // Optimistic update
    setSummary(prev => ({ ...prev, totalWater: Math.round((prev.totalWater + amountToAdd) * 100) / 100 }));

    try {
      await push(ref(database, `users/${user.uid}/waterLogs`), {
        amount: amountToAdd,
        timestamp: Date.now()
      });
    } catch (e) { console.log("Error adding water", e); }
  };

  const deleteLog = async (logId) => {
    const user = auth.currentUser;
    if (user) {
      const logRef = ref(database, `users/${user.uid}/foodLogs/${logId}`);
      await remove(logRef);
    }
  };

  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const monthDay = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

  if (loading) return (
    <View style={styles.centerContainer}>
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  );

  return (
    <View style={[styles.mainContainer, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header Summary */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View>
              <Heading level={2}>Today's Log</Heading>
              <Body muted>{dayName}, {monthDay}</Body>
            </View>
            <View style={[styles.totalBadge, { backgroundColor: `${colors.primary}15` }]}>
              <Heading level={3}>{summary.totalCalories} </Heading>
              <Label>kcal</Label>
            </View>
          </View>

          {/* Progress Bars */}
          <Card style={styles.progressCard}>
            <ProgressBar
              label="Calories"
              subLabel={`${summary.totalCalories} / ${limits.calories}`}
              progress={(summary.totalCalories / limits.calories) * 100}
              color={summary.totalCalories > limits.calories ? COLORS.accent.high : COLORS.primary}
            />
            <View style={{ marginTop: SPACING.md }}>
              <ProgressBar
                label="Protein"
                subLabel={`${summary.totalProtein} / ${limits.protein}g`}
                progress={(summary.totalProtein / limits.protein) * 100}
                color="#f97316"
              />
            </View>
            <View style={{ marginTop: SPACING.md }}>
              <ProgressBar
                label="Water" // New Water Bar
                subLabel={`${summary.totalWater || 0} / ${limits.water || 3}L`}
                progress={((summary.totalWater || 0) / (limits.water || 3)) * 100}
                color="#3b82f6"
              />
            </View>
          </Card>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.mainAction, { backgroundColor: colors.primary }]} onPress={() => navigation.navigate('Scan')}>
            <Ionicons name="camera-outline" size={20} color="#fff" />
            <Body style={styles.actionText}>Scan</Body>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.secondaryAction, { backgroundColor: colors.surface, borderColor: colors.primary }]} onPress={() => navigation.navigate('ManualEntry')}>
            <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
            <Body style={[styles.actionText, { color: colors.primary }]}>Add Food</Body>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.secondaryAction, { backgroundColor: '#eff6ff', borderColor: '#3b82f6' }]} onPress={addWater}>
            <Ionicons name="water-outline" size={20} color="#3b82f6" />
            <Body style={[styles.actionText, { color: '#3b82f6' }]}>+ Water</Body>
          </TouchableOpacity>
        </View>

        {/* Meals Section */}
        <View style={styles.logsSection}>
          <Heading level={3} style={styles.sectionTitle}>Meals</Heading>

          {logs.length === 0 ? (
            <Card style={[styles.emptyCard, { backgroundColor: colors.surface, marginTop: 10 }]}>
              <MaterialIcons name="restaurant-menu" size={48} color={colors.text.muted} />
              <Heading level={3} style={styles.emptyTitle}>No Meals Yet</Heading>
              <Body muted style={styles.emptySubtitle}>Log your first meal to track your macros for today.</Body>
            </Card>
          ) : (
            logs.map((item) => (
              <Card key={item.id} style={styles.logCard}>
                <View style={styles.logLeft}>
                  {item.imageUri ? (
                    <Image source={{ uri: item.imageUri }} style={styles.logImage} />
                  ) : (
                    <View style={[styles.logIconPlaceholder, { backgroundColor: item.vegetarianStatus === 'Vegetarian' ? '#ecfdf5' : '#fef2f2' }]}>
                      <MaterialIcons
                        name={item.vegetarianStatus === 'Vegetarian' ? 'eco' : 'restaurant'}
                        size={20}
                        color={item.vegetarianStatus === 'Vegetarian' ? '#10b981' : '#ef4444'}
                      />
                    </View>
                  )}
                  <View style={styles.logContent}>
                    <Body style={styles.logName} numberOfLines={1}>{item.productName}</Body>
                    <Label style={{ fontSize: 11 }}>{item.calories} kcal • {item.protein}g Prot • {item.carbohydrates || 0}g Carbs</Label>
                  </View>
                </View>
                <View style={styles.logRight}>
                  <Badge
                    label={item.healthScore.toString()}
                    type={item.healthScore > 75 ? 'success' : item.healthScore > 50 ? 'warning' : 'error'}
                  />
                  <TouchableOpacity onPress={() => deleteLog(item.id)} style={styles.deleteBtn}>
                    <Ionicons name="trash-outline" size={18} color={COLORS.text.muted} />
                  </TouchableOpacity>
                </View>
              </Card>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1 },
  scrollContent: { padding: SPACING.screen, paddingTop: 60, paddingBottom: 100 },
  header: { marginBottom: SPACING.xl },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
  totalBadge: { alignItems: 'flex-end', backgroundColor: `${COLORS.primary}10`, paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.md },

  progressCard: { padding: SPACING.md },
  actionRow: { flexDirection: 'row', gap: 12, marginBottom: SPACING.xl },
  mainAction: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: RADIUS.md, gap: 8 },
  secondaryAction: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.primary, paddingVertical: 14, borderRadius: RADIUS.md, gap: 8 },
  actionText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  logsSection: { marginBottom: SPACING.xl },
  sectionTitle: { marginBottom: SPACING.md },
  logCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.md, marginBottom: 12 },
  logLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  logRight: { alignItems: 'flex-end', gap: 8 },
  logImage: { width: 44, height: 44, borderRadius: RADIUS.md, marginRight: 12 },
  logIconPlaceholder: { width: 44, height: 44, borderRadius: RADIUS.md, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  logContent: { flex: 1 },
  logName: { fontWeight: '700', fontSize: 15, marginBottom: 2 },
  deleteBtn: { padding: 4 },
  emptyCard: { alignItems: 'center', paddingVertical: SPACING.xl, backgroundColor: '#fff' },
  emptyTitle: { marginTop: SPACING.md },
  emptySubtitle: { textAlign: 'center', marginTop: SPACING.xs, marginHorizontal: SPACING.xl },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
