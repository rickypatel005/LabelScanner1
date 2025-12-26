import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { onValue, ref } from 'firebase/database';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, SectionList, StatusBar, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Badge } from '../components/Badges';
import { Card } from '../components/Card';
import { EmptyStateIllustration } from '../components/ThemeIllustrations';
import { Body, Heading, Label } from '../components/Typography';
import { COLORS, RADIUS, SHADOWS, SPACING } from '../constants/Theme';
import { useTheme } from '../context/ThemeContext';
import { auth, database } from '../services/firebaseConfig';
import { deleteLogEntry, restoreLogEntry } from '../services/logService'; // Import new service

export default function HistoryScreen({ navigation }) {
    const { colors, isDark } = useTheme();
    const [sections, setSections] = useState([]);
    const [allLogs, setAllLogs] = useState([]); // Keep raw logs for filtering if needed later, though SectionList makes filtering harder. 
    // Actually, user requirement says "convert flat list", and "Use existing log data". 
    // Filtering logic was present in previous version. I should probably try to keep it or minimal version of it if possible, 
    // but the Prompt said "Convert... to SectionList" and "DO NOT... Modify history item UI design".
    // I will focus on the grouping first. If filtering is complex with sections, I might simplify it or re-implement it.
    // The previous code had search and filter. I should try to maintain that.

    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState('All');
    const [toastMsg, setToastMsg] = useState(''); // For delete feedback
    const [deletedItemCache, setDeletedItemCache] = useState(null); // Cache for undo
    const [showUndo, setShowUndo] = useState(false);

    useEffect(() => {
        const user = auth.currentUser;
        if (!user) return;

        const logsRef = ref(database, `users/${user.uid}/foodLogs`);
        const unsubscribe = onValue(logsRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const list = Object.keys(data).map(key => ({ id: key, ...data[key] }));
                list.sort((a, b) => b.timestamp - a.timestamp);
                setAllLogs(list);
                processSections(list, searchQuery, filter);
            } else {
                setSections([]);
            }
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    const processSections = (logs, search, dietFilter) => {
        let filtered = logs;

        // Apply filters
        if (dietFilter !== 'All') {
            filtered = filtered.filter(log => log.vegetarianStatus === dietFilter);
        }
        if (search) {
            filtered = filtered.filter(log => log.productName.toLowerCase().includes(search.toLowerCase()));
        }

        // Group by Date
        const groups = {};
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();

        filtered.forEach(log => {
            const date = new Date(log.timestamp);
            const dateStr = date.toDateString();

            let title = dateStr;
            if (dateStr === today) title = "Today";
            else if (dateStr === yesterday) title = "Yesterday";
            else title = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

            if (!groups[title]) {
                groups[title] = { title, data: [], totalCalories: 0 };
            }
            groups[title].data.push(log);
            groups[title].totalCalories += (parseInt(log.calories) || 0);
        });

        const sectionArray = Object.values(groups);
        setSections(sectionArray);
    };

    const handleSearch = (text) => {
        setSearchQuery(text);
        processSections(allLogs, text, filter);
    };

    const applyFilter = (f) => {
        setFilter(f);
        processSections(allLogs, searchQuery, f);
    };

    const handleDelete = async (item) => {
        // Cache the item for undo
        setDeletedItemCache(item);

        // Optimistic Update
        const previousLogs = [...allLogs];
        const newLogs = allLogs.filter(l => l.id !== item.id);
        setAllLogs(newLogs);
        processSections(newLogs, searchQuery, filter);

        setToastMsg('Item deleted');
        setShowUndo(true);

        // Auto-hide toast and clear cache references after 8 seconds if not undone
        // Note: We don't strictly need to clear cache if UI hides, but good practice.
        const timer = setTimeout(() => {
            setToastMsg('');
            setShowUndo(false);
            setDeletedItemCache(null);
        }, 8000);

        try {
            await deleteLogEntry(auth.currentUser.uid, item.id, item.timestamp);
        } catch (error) {
            console.error("Delete failed", error);
            // Revert if error
            setAllLogs(previousLogs);
            processSections(previousLogs, searchQuery, filter);
            setToastMsg('Failed to delete');
            setShowUndo(false);
            clearTimeout(timer);
        }
    };

    const handleUndo = async () => {
        if (!deletedItemCache) return;

        const itemToRestore = deletedItemCache;
        setToastMsg('Restoring...');
        setShowUndo(false); // Hide undo button immediately

        // Optimistic Restore
        const restoredLogs = [...allLogs, itemToRestore];
        restoredLogs.sort((a, b) => b.timestamp - a.timestamp); // Re-sort
        setAllLogs(restoredLogs);
        processSections(restoredLogs, searchQuery, filter);

        try {
            await restoreLogEntry(auth.currentUser.uid, itemToRestore);
            setToastMsg('Item restored');
            setTimeout(() => setToastMsg(''), 2000);
            setDeletedItemCache(null);
        } catch (error) {
            console.error("Restore failed", error);
            setToastMsg('Failed to restore');
            // Revert optimistic restore
            const revertedLogs = allLogs.filter(l => l.id !== itemToRestore.id);
            setAllLogs(revertedLogs);
            processSections(revertedLogs, searchQuery, filter);
        }
    };

    if (loading) return <View style={styles.center}><ActivityIndicator color={COLORS.primary} /></View>;

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: colors.surface }]}>
                    <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
                </TouchableOpacity>
                <Heading level={2}>Food History</Heading>
            </View>

            {/* Search Bar */}
            <View style={[styles.searchContainer, { backgroundColor: colors.surface }]}>
                <Ionicons name="search" size={20} color={colors.text.muted} />
                <TextInput
                    placeholder="Search past meals..."
                    style={[styles.searchInput, { color: colors.text.primary }]}
                    value={searchQuery}
                    onChangeText={handleSearch}
                    placeholderTextColor={colors.text.muted}
                />
            </View>

            {/* Filter Pills */}
            <View style={styles.filters}>
                {['All', 'Vegetarian', 'Non-Vegetarian'].map(f => (
                    <TouchableOpacity
                        key={f}
                        style={[styles.filterPill, { backgroundColor: filter === f ? colors.primary : colors.surface, borderColor: filter === f ? colors.primary : colors.border }]}
                        onPress={() => applyFilter(f)}
                    >
                        <Label style={{ color: filter === f ? '#fff' : colors.text.secondary }}>{f}</Label>
                    </TouchableOpacity>
                ))}
            </View>

            <SectionList
                sections={sections}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 100 }}
                stickySectionHeadersEnabled={false}
                renderSectionHeader={({ section: { title, totalCalories } }) => (
                    <View style={styles.sectionHeader}>
                        <Heading level={3} style={[styles.sectionTitle, { color: colors.text.primary }]}>{title}</Heading>
                        <Label style={[styles.sectionTotal, { color: colors.text.secondary }]}>{totalCalories} kcal</Label>
                    </View>
                )}
                renderItem={({ item }) => (
                    <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('Result', { logData: item, imageUri: item.imageUri })}>
                        <Card style={styles.historyCard}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                {item.imageUri ? (
                                    <Image source={{ uri: item.imageUri }} style={styles.logImage} />
                                ) : (
                                    <View style={styles.iconPlaceholder}>
                                        <MaterialIcons name="fastfood" size={24} color={COLORS.primary} />
                                    </View>
                                )}
                                <View style={styles.content}>
                                    <Body style={{ fontWeight: '700' }} numberOfLines={1}>{item.productName}</Body>
                                    <Label muted>{item.calories} kcal</Label>
                                </View>
                            </View>

                            <View style={{ alignItems: 'flex-end', gap: 8 }}>
                                <Badge label={item.healthScore?.toString() || 'N/A'} type={item.healthScore > 70 ? 'success' : item.healthScore > 40 ? 'warning' : 'neutral'} />
                                <TouchableOpacity
                                    style={styles.deleteBtn}
                                    onPress={(e) => {
                                        e.stopPropagation(); // Prevent card navigation
                                        handleDelete(item);
                                    }}
                                >
                                    <Ionicons name="trash-outline" size={18} color={colors.text.muted} />
                                </TouchableOpacity>
                            </View>
                        </Card>
                    </TouchableOpacity>
                )}
                ListEmptyComponent={() => (
                    <View style={styles.empty}>
                        <EmptyStateIllustration
                            icon="time-outline"
                            title="No History Yet"
                            message="Your scanned meals will appear here"
                        />
                    </View>
                )}
            />
            {toastMsg ? (
                <View style={styles.toastContainer}>
                    <View style={styles.toast}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Ionicons name="trash" size={16} color="#fff" />
                            <Body inverse style={{ fontSize: 14 }}>{toastMsg}</Body>
                        </View>
                        {showUndo && (
                            <TouchableOpacity onPress={handleUndo} style={styles.undoBtn}>
                                <Body style={{ color: COLORS.primary, fontWeight: '700', fontSize: 14 }}>UNDO</Body>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        paddingTop: 60, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md,
        flexDirection: 'row', alignItems: 'center', gap: 12
    },
    backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', ...SHADOWS.soft },
    searchContainer: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
        marginHorizontal: SPACING.lg, paddingHorizontal: 16, paddingVertical: 12,
        borderRadius: RADIUS.md, marginTop: SPACING.sm, ...SHADOWS.soft
    },
    searchInput: { flex: 1, marginLeft: 10, fontSize: 16 },
    filters: { flexDirection: 'row', paddingHorizontal: SPACING.lg, marginTop: SPACING.md, gap: 10, marginBottom: SPACING.md },
    filterPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.full, backgroundColor: '#fff', borderWeight: 1, borderColor: COLORS.border },
    filterPillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },

    // Section Header Styles
    sectionHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        marginTop: SPACING.md, marginBottom: SPACING.sm,
        paddingHorizontal: 4 // visual alignment
    },
    sectionTitle: { fontSize: 18, color: COLORS.text.primary },
    sectionTotal: { fontWeight: '600', color: COLORS.text.secondary },

    historyCard: { flexDirection: 'row', alignItems: 'center', padding: SPACING.sm, marginBottom: SPACING.sm },
    logImage: { width: 50, height: 50, borderRadius: RADIUS.sm, marginRight: 12 },
    iconPlaceholder: { width: 50, height: 50, borderRadius: RADIUS.sm, backgroundColor: '#f0fdf4', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    content: { flex: 1, marginRight: 8 },
    empty: { marginTop: 100, alignItems: 'center' },
    deleteBtn: { padding: 4 },
    toastContainer: {
        position: 'absolute', bottom: 50, alignSelf: 'center', zIndex: 100
    },
    toast: {
        backgroundColor: 'rgba(50,50,50,0.95)', paddingVertical: 12, paddingHorizontal: 20,
        borderRadius: 30, flexDirection: 'row', gap: 16, alignItems: 'center', justifyContent: 'space-between',
        minWidth: 200
    },
    undoBtn: {
        marginLeft: 10,
        paddingHorizontal: 8,
        paddingVertical: 2
    }
});
