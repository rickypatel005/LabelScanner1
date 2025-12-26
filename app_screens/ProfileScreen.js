import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { signOut } from 'firebase/auth';
import { onValue, ref, update } from 'firebase/database';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, ScrollView, StatusBar, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Card } from '../components/Card';
import { GradientButton } from '../components/GradientButton';
import { ProgressRing } from '../components/Progress';
import { Body, Heading, Label } from '../components/Typography';
import { COLORS, RADIUS, SHADOWS, SPACING } from '../constants/Theme';
import { useTheme } from '../context/ThemeContext';
import { auth, database } from '../services/firebaseConfig';
import { getHabitStats } from '../services/habitService';

const DIET_TYPES = ['Vegetarian', 'Non-Vegetarian', 'Vegan', 'Eggetarian'];

export default function ProfileScreen({ navigation }) {
    const { colors, isDark, themePreference, setThemePreference } = useTheme();
    const [username, setUsername] = useState('');
    const [profilePic, setProfilePic] = useState(null);
    const [age, setAge] = useState('28');
    const [goal, setGoal] = useState('Muscle Gain');
    const [streak, setStreak] = useState(0);
    const [diets, setDiets] = useState([]); // Support multiple diets
    const [weeklyActivity, setWeeklyActivity] = useState([]); // Last 7 days data
    const [reminders, setReminders] = useState({ water: true, track: true, protein: true });


    // Editable Targets
    const [calories, setCalories] = useState('2500');
    const [protein, setProtein] = useState('120');
    const [water, setWater] = useState('3.0');

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Dynamic Ring Size Calculation
    const screenWidth = Dimensions.get('window').width;
    const availableWidth = screenWidth - (SPACING.screen * 2) - 32; // 20px padding * 2, 16px card padding * 2
    const minGap = 10;
    // Try to fit 40px rings with min 10px gap
    // 7 * 40 + 6 * 10 = 280 + 60 = 340. If avail < 340, reduce ring.
    // Optimal calculation:
    const calculatedSize = (availableWidth - (6 * 12)) / 7; // Target 12px gap minimum
    const ringSize = Math.min(Math.max(calculatedSize, 32), 42); // Clamp between 32 and 42

    useEffect(() => {
        const user = auth.currentUser;
        if (user) {
            const settingsRef = ref(database, `users/${user.uid}/settings`);
            // Fetch Settings
            const unsub = onValue(settingsRef, (snapshot) => {
                const data = snapshot.val();
                if (data) {
                    if (data.username) setUsername(data.username);
                    if (data.profilePic) setProfilePic(data.profilePic);
                    if (data.age) setAge(data.age.toString());
                    if (data.goal) setGoal(data.goal);

                    // Handle both string and array for diet
                    if (data.diet) {
                        setDiets(Array.isArray(data.diet) ? data.diet : [data.diet]);
                    }

                    if (data.calculatedLimits) {
                        setCalories(data.calculatedLimits.calories.toString());
                        setProtein(data.calculatedLimits.protein.toString());
                        if (data.calculatedLimits.water) setWater(data.calculatedLimits.water.toString());
                    }

                    if (data.reminders) {
                        setReminders(data.reminders);
                    }
                }
                setLoading(false);
            });

            // Fetch Streak
            getHabitStats(user.uid).then(stats => {
                if (stats && stats.currentStreak) setStreak(stats.currentStreak);
            });

            // Fetch Weekly Activity (Logs)
            const logsRef = ref(database, `users/${user.uid}/foodLogs`);
            onValue(logsRef, (snapshot) => {
                const logs = snapshot.val() || {};
                const now = new Date();
                const last7Days = [];
                const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

                // Generate last 7 days (including today)
                // Actually, UI shows M T W T F S S usually, or just last 7 days relative to today?
                // The UI dummy data was static M T W... 
                // Let's make it dynamic: [Today-6, ..., Today]

                for (let i = 6; i >= 0; i--) { // 6 days ago to today
                    const d = new Date();
                    d.setDate(now.getDate() - i);
                    d.setHours(0, 0, 0, 0);

                    const dayName = dayLabels[d.getDay()]; // 0=Sun, 1=Mon...

                    // Sum calories for this day
                    let dailyCal = 0;
                    const dayStart = d.getTime();
                    const dayEnd = dayStart + 86400000;

                    Object.values(logs).forEach(log => {
                        if (log.timestamp >= dayStart && log.timestamp < dayEnd) {
                            dailyCal += (parseFloat(log.calories) || 0);
                        }
                    });

                    // Calculate progress % based on current calorie goal (e.g. 2000)
                    // Note: 'calories' state might not be set yet if this runs before setting ref loads.
                    // But 'onValue' for settings is async too. 
                    // Best to use a safe default or re-calculate if 'calories' changes.
                    // But 'calories' state is string '2500'. 
                    // Let's use the local value if available inside this scope? No, 'calories' state is updated via other listener.
                    // Instead, calculate raw value here, or use 'calories' state if we include it in dependency array.
                    // If we use onValue here, it runs whenever logs change. 
                    // We can just store the 'dailyCal' in state and render the % in the View using 'calories' state.

                    last7Days.push({ day: dayName, value: dailyCal });
                }
                setWeeklyActivity(last7Days);
            });

            return unsub;
        }
    }, [calories]); // Add calories to dependency so if goal changes, we re-render? No, useEffect runs once on mount. 
    // Wait, if I add [calories], it re-runs everything including 'unsub', which is fine but slightly wasteful re-subscribing.
    // Better: separate the log fetching or just use the current 'calories' state in render.
    // I put 'setWeeklyActivity' with raw values (or cal values). 
    // In render map, I will do (item.value / parseInt(calories)) * 100.
    // So useEffect dependency doesn't need 'calories' if 'weeklyActivity' stores absolute values.
    // Confirmed: I will store absolute calories in 'weeklyActivity' and compute % in render.
    // Correction: I need to allow onValue to persist, so I shouldn't put it in a useEffect that re-runs often or I must cleanup properly.
    // The current structure has one huge useEffect with [] dep. 
    // I will keep it there. Logs listener will define the setWeeklyActivity.


    const pickProfileImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.5,
                base64: true,
            });

            if (!result.canceled && result.assets?.[0]) {
                const imgData = `data:image/jpeg;base64,${result.assets[0].base64}`;
                setProfilePic(imgData);
                saveSetting('profilePic', imgData);
            }
        } catch (error) {
            Alert.alert('Error', 'Could not pick image');
        }
    };

    const handleDietToggle = (type) => {
        let newDiets;
        if (diets.includes(type)) {
            newDiets = diets.filter(d => d !== type);
        } else {
            newDiets = [...diets, type];
        }
        setDiets(newDiets);
        saveSetting('diet', newDiets);
    };

    const toggleReminder = (key) => {
        const newReminders = { ...reminders, [key]: !reminders[key] };
        setReminders(newReminders);
        saveSetting('reminders', newReminders);
    };

    const saveSetting = async (key, value) => {
        const user = auth.currentUser;
        if (user) {
            try {
                await update(ref(database, `users/${user.uid}/settings`), { [key]: value });
            } catch (err) { console.log(err); }
        }
    };

    const handleSaveTargets = async () => {
        setSaving(true);
        const user = auth.currentUser;
        if (user) {
            try {
                await update(ref(database, `users/${user.uid}/settings`), {
                    age: parseInt(age),
                    calculatedLimits: {
                        calories: parseInt(calories),
                        protein: parseInt(protein),
                        water: parseFloat(water)
                    },
                    diet: diets
                });
                Alert.alert('Success', 'Profile updated!');
            } catch (err) {
                Alert.alert('Error', 'Failed to save changes');
            }
        }
        setSaving(false);
    };

    const handleLogout = async () => {
        Alert.alert("Log Out", "Are you sure you want to sign out?", [
            { text: "Cancel", style: "cancel" },
            { text: "Sign Out", style: 'destructive', onPress: () => signOut(auth) }
        ]);
    };

    if (loading) return <View style={styles.center}><ActivityIndicator color={COLORS.primary} /></View>;

    return (
        <ScrollView style={[styles.container, { backgroundColor: colors.background }]} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

            {/* Compact Header */}
            <LinearGradient colors={COLORS.primaryGradient} style={styles.header}>
                <View style={styles.headerContent}>
                    <TouchableOpacity onPress={pickProfileImage} style={styles.avatarFrame}>
                        {profilePic ? (
                            <Image source={{ uri: profilePic }} style={styles.avatar} />
                        ) : (
                            <View style={[styles.avatar, styles.placeholder]}>
                                <Heading level={1} inverse>{username?.[0] || 'U'}</Heading>
                            </View>
                        )}
                        <View style={styles.editBadge}>
                            <Ionicons name="camera-outline" size={12} color={COLORS.primary} />
                        </View>
                    </TouchableOpacity>

                    <View style={styles.profileInfo}>
                        <View style={styles.nameRow}>
                            <Heading level={2} inverse>{username || 'User'}</Heading>
                            <TouchableOpacity
                                onPress={() => navigation.navigate('EditProfile', {
                                    currentData: {
                                        username, age, diet: diets,
                                        calculatedLimits: { calories, protein, water }
                                    }
                                })}
                                style={styles.editIconButton}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Ionicons name="create-outline" size={20} color="rgba(255,255,255,0.9)" />
                            </TouchableOpacity>
                        </View>
                        <Body inverse style={styles.headerSubtext}>{age} years • {diets.length > 0 ? diets.join(', ') : 'No Diet Set'}</Body>
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                            <View style={styles.goalBadge}>
                                <Ionicons name="flash-outline" size={12} color="#fff" />
                                <Label inverse style={styles.goalLabelText}>{goal.toUpperCase()}</Label>
                            </View>
                            {streak > 0 ? (
                                <View style={[styles.goalBadge, { backgroundColor: 'rgba(249, 115, 22, 0.2)', borderColor: '#f97316' }]}>
                                    <Ionicons name="flame" size={12} color="#f97316" />
                                    <Label inverse style={[styles.goalLabelText, { color: '#f97316' }]}>{streak} Day Streak</Label>
                                </View>
                            ) : (
                                <View style={[styles.goalBadge, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                                    <Ionicons name="flame-outline" size={12} color="#ddd" />
                                    <Label inverse style={[styles.goalLabelText, { color: '#ddd' }]}>Start your streak today!</Label>
                                </View>
                            )}
                        </View>
                    </View>
                </View>
            </LinearGradient>

            <View style={styles.content}>
                {/* Simplified Diet Preference Grid */}
                <View style={styles.sectionContainer}>
                    <Heading level={3} style={styles.sectionTitle}>Dietary Preferences</Heading>
                    <View style={styles.dietGrid}>
                        {DIET_TYPES.map(type => {
                            const isSelected = diets.includes(type);
                            const icon = type === 'Vegetarian' ? 'leaf-outline' : type === 'Vegan' ? 'eco-outline' : type === 'Eggetarian' ? 'egg-outline' : 'restaurant-outline';

                            return (
                                <TouchableOpacity
                                    key={type}
                                    style={[styles.dietChip, isSelected && styles.dietChipActive]}
                                    onPress={() => handleDietToggle(type)}
                                >
                                    <Ionicons name={icon} size={16} color={isSelected ? '#fff' : COLORS.primary} />
                                    <Body style={[styles.dietChipText, isSelected && styles.dietChipTextActive]}>{type}</Body>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* Daily Targets */}
                <View style={styles.sectionContainer}>
                    <Heading level={3} style={styles.sectionTitle}>Daily Targets</Heading>
                    <Card style={styles.targetsCard}>
                        <View style={styles.inputRow}>
                            <View style={styles.inputBox}>
                                <Label style={styles.inputLabel}>Calories</Label>
                                <TextInput
                                    style={styles.input}
                                    value={calories}
                                    onChangeText={setCalories}
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={styles.inputBox}>
                                <Label style={styles.inputLabel}>Protein (g)</Label>
                                <TextInput
                                    style={styles.input}
                                    value={protein}
                                    onChangeText={setProtein}
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={styles.inputBox}>
                                <Label style={styles.inputLabel}>Water (L)</Label>
                                <TextInput
                                    style={styles.input}
                                    value={water}
                                    onChangeText={setWater}
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>
                        <GradientButton
                            title="Update Profile"
                            onPress={handleSaveTargets}
                            loading={saving}
                            style={styles.saveBtn}
                        />
                    </Card>
                </View>

                {/* Refined Weekly Activity */}
                <View style={styles.sectionContainer}>
                    <Heading level={3} style={styles.sectionTitle}>Weekly Activity</Heading>
                    <Card style={styles.activityCard}>
                        <View style={styles.activityGrid}>
                            {weeklyActivity.map((item, i) => {
                                const target = parseInt(calories) || 2000;
                                const progress = Math.min(Math.round((item.value / target) * 100), 100);
                                const isActive = progress > 0;

                                return (
                                    <View key={i} style={styles.dayBlock}>
                                        <Body style={[styles.activityValue, { color: isActive ? COLORS.primary : COLORS.text.muted }]}>{progress}</Body>
                                        <ProgressRing
                                            progress={isActive ? progress : 0}
                                            size={ringSize}
                                            strokeWidth={4}
                                            color={isActive ? COLORS.primary : 'transparent'}
                                            hideLegend={true}
                                        />
                                        <Label style={styles.dayLabel}>{item.day}</Label>
                                    </View>
                                );
                            })}
                        </View>
                    </Card>
                </View>

                {/* Smart Reminders */}
                <View style={styles.sectionContainer}>
                    <Heading level={3} style={styles.sectionTitle}>Smart Reminders</Heading>
                    <Card style={styles.reminderCard}>
                        {[
                            { id: 'water', label: 'Drink Water', icon: 'water-outline' },
                            { id: 'track', label: 'Track Meals', icon: 'restaurant-outline' },
                            { id: 'protein', label: 'Protein Target', icon: 'fitness-outline' }
                        ].map((item, index) => {
                            const isEnabled = reminders[item.id];
                            return (
                                <View key={item.id} style={[styles.reminderRow, index === 2 && { borderBottomWidth: 0 }]}>
                                    <View style={styles.reminderLabel}>
                                        <Ionicons name={item.icon} size={20} color={COLORS.primary} />
                                        <Body style={styles.reminderText}>{item.label}</Body>
                                    </View>
                                    <TouchableOpacity
                                        style={[styles.switch, { backgroundColor: isEnabled ? COLORS.primary : '#e5e7eb', alignItems: isEnabled ? 'flex-end' : 'flex-start' }]}
                                        onPress={() => toggleReminder(item.id)}
                                    >
                                        <View style={styles.switchDot} />
                                    </TouchableOpacity>
                                </View>
                            );
                        })}
                    </Card>
                </View>

                {/* Theme Selection Section */}
                <View style={styles.sectionContainer}>
                    <Heading level={3} style={[styles.sectionTitle, { color: colors.text.primary }]}>Appearance</Heading>
                    <Card style={[styles.themeCard, { backgroundColor: colors.surface }]}>
                        {[
                            { id: 'system', label: 'Use System Theme', icon: 'phone-portrait-outline', description: 'Follow device settings' },
                            { id: 'dark', label: 'Dark Mode', icon: 'moon', description: 'Always use dark theme' },
                            { id: 'light', label: 'Light Mode', icon: 'sunny', description: 'Always use light theme' }
                        ].map((option, index) => {
                            const isSelected = themePreference === option.id;
                            return (
                                <TouchableOpacity
                                    key={option.id}
                                    style={[
                                        styles.themeOption,
                                        { borderBottomColor: colors.border },
                                        index === 2 && { borderBottomWidth: 0 },
                                        isSelected && { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.05)' }
                                    ]}
                                    onPress={() => setThemePreference(option.id)}
                                >
                                    <View style={styles.themeOptionLeft}>
                                        <View style={[
                                            styles.themeIconContainer,
                                            { backgroundColor: isSelected ? colors.primary : (isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb') }
                                        ]}>
                                            <Ionicons
                                                name={option.icon}
                                                size={20}
                                                color={isSelected ? '#fff' : colors.primary}
                                            />
                                        </View>
                                        <View>
                                            <Body style={[styles.themeOptionLabel, { color: colors.text.primary, fontWeight: isSelected ? '700' : '500' }]}>
                                                {option.label}
                                            </Body>
                                            <Label style={[styles.themeOptionDescription, { color: colors.text.muted }]}>
                                                {option.description}
                                            </Label>
                                        </View>
                                    </View>
                                    {isSelected && (
                                        <View style={[styles.checkmarkContainer, { backgroundColor: colors.primary }]}>
                                            <Ionicons name="checkmark" size={16} color="#fff" />
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </Card>
                </View>

                {/* Balanced Sign Out */}
                <TouchableOpacity onPress={handleLogout} style={[styles.signOutCard, { backgroundColor: colors.surface, borderColor: isDark ? colors.border : '#fee2e2' }]}>
                    <Ionicons name="log-out-outline" size={20} color={COLORS.accent.high} />
                    <Body style={styles.signOutText}>Sign Out</Body>
                </TouchableOpacity>

            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    // Header Styles
    header: {
        paddingTop: 60,
        paddingBottom: 30,
        paddingHorizontal: SPACING.screen,
        borderBottomLeftRadius: 36,
        borderBottomRightRadius: 36,
    },
    headerContent: { flexDirection: 'row', alignItems: 'center', gap: 18 },
    avatarFrame: { position: 'relative' },
    avatar: {
        width: 72, height: 72, borderRadius: 36,
        borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)'
    },
    placeholder: { backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
    editBadge: {
        position: 'absolute', bottom: 0, right: 0,
        backgroundColor: '#fff', width: 22, height: 22, borderRadius: 11,
        justifyContent: 'center', alignItems: 'center', ...SHADOWS.soft
    },
    profileInfo: { flex: 1 },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    editIconButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    headerSubtext: { opacity: 0.9, fontSize: 13, marginBottom: 4 },
    goalBadge: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingHorizontal: 10, paddingVertical: 4,
        borderRadius: RADIUS.full, alignSelf: 'flex-start',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)'
    },
    goalLabelText: { fontWeight: '700', marginLeft: 4, fontSize: 10 },

    // Content & Sections
    content: { paddingHorizontal: SPACING.screen, paddingTop: 24 },
    sectionContainer: { marginBottom: 24 },
    sectionTitle: { marginBottom: 12, fontWeight: '700', fontSize: 16 },

    // Diet Grid Style (Updated)
    dietGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    dietChip: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 8, paddingHorizontal: 12, borderRadius: RADIUS.full,
        backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border, gap: 6,
        ...SHADOWS.soft
    },
    dietChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    dietChipText: { fontSize: 13, fontWeight: '600', color: COLORS.text.secondary },
    dietChipTextActive: { color: "#fff" },

    // Targets Card
    targetsCard: { padding: 16 },
    inputRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    inputBox: { flex: 1 },
    inputLabel: { fontSize: 12, color: COLORS.text.muted, marginBottom: 6, textAlign: 'center' },
    input: {
        backgroundColor: '#f9fafb', borderWidth: 1, borderColor: COLORS.border,
        padding: 10, borderRadius: RADIUS.sm, fontSize: 15, fontWeight: '700',
        textAlign: 'center', color: COLORS.text.primary
    },
    saveBtn: { marginTop: 4 },

    // Weekly Activity
    activityCard: { paddingVertical: 16, paddingHorizontal: 16 },
    activityGrid: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    dayBlock: { alignItems: 'center', gap: 4 },
    activityValue: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
    dayLabel: { fontSize: 10, fontWeight: '600', color: COLORS.text.muted },

    // Reminders
    reminderCard: { padding: 8 },
    reminderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9'
    },
    reminderLabel: { flexDirection: 'row', alignItems: 'center' },
    reminderText: { marginLeft: 12, fontSize: 15, fontWeight: '500' },
    switch: {
        width: 40, height: 22, borderRadius: 11,
        backgroundColor: COLORS.primary, justifyContent: 'center',
        paddingHorizontal: 3, alignItems: 'flex-end'
    },
    switchDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#fff' },

    // Sign Out
    signOutCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        paddingVertical: 14,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: '#fee2e2',
        marginBottom: 20,
        ...SHADOWS.soft
    },
    signOutText: { color: COLORS.accent.high, fontWeight: '700', marginLeft: 10, fontSize: 15 },

    // Theme Selection
    themeCard: { padding: 0, overflow: 'hidden' },
    themeOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
    },
    themeOptionLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    themeIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    themeOptionLabel: {
        fontSize: 15,
        marginBottom: 2,
    },
    themeOptionDescription: {
        fontSize: 12,
    },
    checkmarkContainer: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
