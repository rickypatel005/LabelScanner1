import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { get, push, ref, update } from 'firebase/database';
import React, { useState } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Card } from '../components/Card';
import { ProgressRing } from '../components/Progress';
import { TrendsChart } from '../components/TrendsChart';
import { Body, Heading, Label } from '../components/Typography';
import { COLORS, RADIUS, SHADOWS, SPACING } from '../constants/Theme';
import { useTheme } from '../context/ThemeContext';
import { auth, database } from '../services/firebaseConfig';
import { getHabitStats } from '../services/habitService';

const Toast = ({ message, visible }) => {
    if (!visible) return null;
    return (
        <View style={styles.toastContainer}>
            <View style={styles.toast}>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.toastText}>{message}</Text>
            </View>
        </View>
    );
};


export default function HomeScreen({ navigation }) {
    const { colors, isDark } = useTheme();
    const [username, setUsername] = useState(''); // Default empty, load from Firebase
    const [nameLoading, setNameLoading] = useState(true);
    const [habitStats, setHabitStats] = useState({ currentStreak: 0, totalScans: 0 });
    const [summary, setSummary] = useState({ totalCalories: 0, totalProtein: 0, totalCarbs: 0, water: 0 });
    const [limits, setLimits] = useState({ calories: 2500, protein: 120, carbohydrates: 300, water: 3.0 });
    const [weeklyData, setWeeklyData] = useState([]);
    const [toastVisible, setToastVisible] = useState(false);

    useFocusEffect(React.useCallback(() => {
        loadData();
    }, []));

    const loadData = async () => {
        const user = auth.currentUser;
        if (!user) return;

        try {
            // Fetch username and limits
            const settingsSnap = await get(ref(database, `users/${user.uid}/settings`));
            if (settingsSnap.exists()) {
                const data = settingsSnap.val();
                if (data.username) setUsername(data.username);
                if (data.calculatedLimits) setLimits({ ...limits, ...data.calculatedLimits });
            }

            // Fetch habit stats
            const hStats = await getHabitStats(user.uid);
            setHabitStats(hStats);

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayStart = today.getTime();

            // Fetch today's food logs
            const logsRef = ref(database, `users/${user.uid}/foodLogs`);
            const logsSnap = await get(logsRef);
            let totalCal = 0;
            let totalProt = 0;
            let totalCarbs = 0;
            // Process Weekly Trends (Last 7 Days)
            const last7Days = [];
            for (let i = 6; i >= 0; i--) {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                last7Days.push({
                    dateObj: date,
                    day: date.toLocaleDateString('en-US', { weekday: 'narrow' }), // M, T, W...
                    value: 0
                });
            }

            if (logsSnap.exists()) {
                const logs = logsSnap.val();
                Object.values(logs).forEach(log => {
                    const logDate = new Date(log.timestamp);
                    const logDateStr = logDate.toDateString();

                    // Check if log is within the last 7 days window
                    const dayIndex = last7Days.findIndex(d => d.dateObj.toDateString() === logDateStr);
                    if (dayIndex !== -1) {
                        last7Days[dayIndex].value += (parseFloat(log.calories) || 0);
                    }

                    // Also check for today totals (already doing this below but can optimize if careful, keeping logic mostly separate for safety)
                    if (log.timestamp >= todayStart) {
                        totalCal += parseFloat(log.calories) || 0;
                        totalProt += parseFloat(log.protein) || 0;
                        totalCarbs += parseFloat(log.carbohydrates) || 0;
                    }
                });
            }

            // Clean up data for chart
            const chartData = last7Days.map(d => ({ day: d.day, value: d.value }));
            setWeeklyData(chartData);

            // Fetch today's water logs
            const waterRef = ref(database, `users/${user.uid}/waterLogs`);
            const waterSnap = await get(waterRef);
            let totalWater = 0;
            if (waterSnap.exists()) {
                const wLogs = waterSnap.val();
                Object.values(wLogs).forEach(log => {
                    if (log.timestamp >= todayStart) {
                        totalWater += parseFloat(log.amount) || 0;
                    }
                });
            }

            setSummary({
                totalCalories: Math.round(totalCal),
                totalProtein: Math.round(totalProt),
                totalCarbs: Math.round(totalCarbs),
                water: Math.round(totalWater * 100) / 100
            });

        } catch (err) {
            console.log("Error loading Home data", err);
        }
    };

    const handleAddWater = async () => {
        const user = auth.currentUser;
        if (!user) return;

        const amountToAdd = 0.25; // 250ml in Liters

        // Optimistic UI Update
        setSummary(prev => ({ ...prev, water: Math.round((prev.water + amountToAdd) * 100) / 100 }));

        // Show Toast
        setToastVisible(true);
        setTimeout(() => setToastVisible(false), 2000);

        try {
            const newWaterRef = push(ref(database, `users/${user.uid}/waterLogs`));
            await update(newWaterRef, {
                amount: amountToAdd,
                timestamp: Date.now()
            });
        } catch (e) {
            console.log("Error adding water", e);
            // Revert on error if needed, but keeping simple for now
        }
    };

    const QuickAction = ({ icon, label, onPress, color }) => {
        const btnColor = color || colors.primary;
        return (
            <TouchableOpacity style={styles.actionBtn} onPress={onPress} activeOpacity={0.7}>
                <View style={[styles.actionIcon, { backgroundColor: `${btnColor}15` }]}>
                    <Ionicons name={icon} size={24} color={btnColor} />
                </View>
                <Label style={[styles.actionLabel, { color: colors.text.primary }]}>{label}</Label>
            </TouchableOpacity>
        );
    };

    const ShortcutItem = ({ icon, label, onPress }) => (
        <TouchableOpacity style={styles.shortcutItem} onPress={onPress}>
            <Ionicons name={icon} size={20} color={colors.text.secondary} />
            <Body style={[styles.shortcutLabel, { color: colors.text.secondary }]}>{label}</Body>
            <Ionicons name="chevron-forward" size={16} color={colors.text.muted} />
        </TouchableOpacity>
    );

    return (
        <View style={[styles.mainContainer, { backgroundColor: colors.background }]}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
            <ScrollView
                style={styles.container}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* Header */}
                <View style={styles.header}>
                    <Heading level={1}>
                        {username ? `Hello ${username} 👋` : 'Hello 👋'}
                    </Heading>
                    {username ? (
                        <Body muted>Stay consistent today!</Body>
                    ) : (
                        <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
                            <Body style={{ color: colors.primary, fontWeight: '600' }}>Complete your profile to personalize your experience</Body>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Daily Goals Summary */}
                <View style={styles.goalsContainer}>
                    <Card style={styles.goalCard}>
                        <ProgressRing
                            progress={(summary.totalCalories / limits.calories) * 100}
                            size={70}
                            strokeWidth={6}
                            color={colors.primary}
                        />
                        <View style={styles.goalInfo}>
                            <Label>Calories</Label>
                            <Heading level={3}>{summary.totalCalories} / {limits.calories}</Heading>
                        </View>
                    </Card>

                    <View style={styles.goalSideRow}>
                        <Card style={styles.smallGoalCard}>
                            <ProgressRing
                                progress={(summary.totalProtein / limits.protein) * 100}
                                size={50}
                                strokeWidth={5}
                                color="#f97316"
                            />
                            <View style={styles.smallGoalText}>
                                <Label>Protein</Label>
                                <Body style={{ fontWeight: '700' }}>{summary.totalProtein}g</Body>
                            </View>
                        </Card>
                        <Card style={styles.smallGoalCard}>
                            <ProgressRing
                                progress={(summary.water / limits.water) * 100}
                                size={50}
                                strokeWidth={5}
                                color="#3b82f6"
                            />
                            <View style={styles.smallGoalText}>
                                <Label>Water</Label>
                                <Body style={{ fontWeight: '700' }}>{summary.water}L</Body>
                            </View>
                        </Card>
                    </View>
                </View>

                {/* Quick Actions */}
                <Heading level={3} style={styles.sectionTitle}>Quick Actions</Heading>
                <View style={styles.actionsRow}>
                    <QuickAction icon="camera-outline" label="Scan Food" onPress={() => navigation.navigate('Scan')} />
                    <QuickAction icon="add-circle-outline" label="Add Meal" onPress={() => navigation.navigate('Log')} />
                    <QuickAction icon="water-outline" label="Add Water" onPress={handleAddWater} color="#3b82f6" />
                </View>

                {/* Weekly Trends */}
                <View style={styles.chartContainer}>
                    <TrendsChart
                        data={weeklyData.length > 0 ? weeklyData : [{ value: 0 }, { value: 0 }, { value: 0 }, { value: 0 }, { value: 0 }, { value: 0 }, { value: 0 }]}
                        title="Weekly Progress"
                    />
                </View>

                {/* Shortcuts */}
                <View style={[styles.shortcutsContainer, { backgroundColor: colors.surface }]}>
                    <ShortcutItem icon="list-outline" label="Today's Log" onPress={() => navigation.navigate('Log')} />
                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                    <ShortcutItem icon="time-outline" label="Food History" onPress={() => navigation.navigate('History')} />
                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                    <ShortcutItem icon="person-outline" label="Profile" onPress={() => navigation.navigate('Profile')} />
                </View>

            </ScrollView>

            <Toast visible={toastVisible} message="+250ml added" />
        </View>
    );
}

const styles = StyleSheet.create({
    mainContainer: { flex: 1, backgroundColor: COLORS.background },
    container: { flex: 1 },
    scrollContent: { padding: SPACING.screen, paddingTop: 60, paddingBottom: 100 },
    header: { marginBottom: SPACING.xl },

    goalsContainer: { marginBottom: SPACING.xl },
    goalCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.md,
        marginBottom: SPACING.gap,
        gap: 20
    },
    goalInfo: { flex: 1 },
    goalSideRow: { flexDirection: 'row', gap: SPACING.gap },
    smallGoalCard: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: SPACING.sm, gap: 12 },
    smallGoalText: { flex: 1 },

    sectionTitle: { marginBottom: SPACING.md },
    actionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.xl },
    actionBtn: { flex: 1, alignItems: 'center' },
    actionIcon: {
        width: 56, height: 56, borderRadius: RADIUS.md,
        justifyContent: 'center', alignItems: 'center', marginBottom: 8
    },
    actionLabel: { fontSize: 11, color: COLORS.text.primary, fontWeight: '700' },

    chartContainer: { marginBottom: SPACING.xl },

    shortcutsContainer: {
        backgroundColor: '#fff',
        borderRadius: RADIUS.lg,
        padding: SPACING.xs,
        ...SHADOWS.soft
    },
    shortcutItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.md,
        gap: 12
    },
    shortcutLabel: { flex: 1, fontWeight: '600' },
    divider: { height: 1, backgroundColor: COLORS.border, marginHorizontal: SPACING.md },

    // Toast Styles
    toastContainer: {
        position: 'absolute',
        bottom: 100, // Above tab bar
        left: 0, right: 0,
        alignItems: 'center',
        zIndex: 999
    },
    toast: {
        backgroundColor: 'rgba(0,0,0,0.85)',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: RADIUS.full,
        gap: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        elevation: 8,
    },
    toastText: { color: '#fff', fontWeight: '700', fontSize: 14 }
});
