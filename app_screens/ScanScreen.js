import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, StatusBar, StyleSheet, TouchableOpacity, View } from 'react-native';
import { GradientButton } from '../components/GradientButton';
import { Body, Heading } from '../components/Typography';
import { COLORS, RADIUS, SHADOWS, SPACING } from '../constants/Theme';
import { useTheme } from '../context/ThemeContext';

// Define CameraType locally for compatibility with user request while using CameraView strings
const CameraType = {
  back: 'back',
  front: 'front',
};

export default function ScanScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);
  const [torch, setTorch] = useState(false);
  const [cameraType, setCameraType] = useState(CameraType.back);
  const cameraRef = useRef(null);

  if (!permission) return <View style={styles.blackBg} />;

  if (!permission.granted) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
        <MaterialIcons name="no-photography" size={64} color={colors.text.muted} />
        <Heading level={2} style={styles.permissionTitle}>Camera Access Required</Heading>
        <Body muted style={styles.permissionText}>We need camera access to instantly analyze food labels and provide nutrition insights.</Body>
        <GradientButton
          title="Allow Camera Access"
          onPress={requestPermission}
          style={{ width: '100%', marginTop: SPACING.xl }}
        />
      </View>
    );
  }

  const handleCapture = async () => {
    if (loading || !cameraRef.current) return;
    setLoading(true);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.5,
        skipProcessing: true,
      });
      navigation.navigate('Result', { imageUri: photo.uri });
    } catch (error) {
      Alert.alert('Error', 'Failed to capture: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        navigation.navigate('Result', { imageUri: result.assets[0].uri });
      }
    } catch (error) {
      Alert.alert('Error', 'Could not pick image');
    }
  };

  const toggleCameraType = () => {
    setCameraType(prev => prev === CameraType.back ? CameraType.front : CameraType.back);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <CameraView
        style={styles.camera}
        ref={cameraRef}
        enableTorch={torch}
        facing={cameraType}
      />

      {/* Darkened Overlay with rounded viewfinder */}
      <View style={styles.overlayContainer}>
        <View style={styles.overlayTop} />
        <View style={styles.overlayMiddle}>
          <View style={styles.overlaySide} />
          <View style={styles.viewfinderContainer}>
            <View style={styles.viewfinder}>
              {/* Corners with Teal Border */}
              <View style={styles.cornerTL} />
              <View style={styles.cornerTR} />
              <View style={styles.cornerBL} />
              <View style={styles.cornerBR} />
            </View>
          </View>
          <View style={styles.overlaySide} />
        </View>
        <View style={styles.overlayBottom}>
          <Body inverse style={styles.instructionText}>Align food label within the box</Body>
        </View>
      </View>

      {/* Header with Blur */}
      {/* Updated layout for back button and camera toggle */}
      <BlurView intensity={20} style={styles.topControls}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.toggleButton}
          onPress={toggleCameraType}
          activeOpacity={0.7}
        >
          <MaterialIcons name="flip-camera-ios" size={24} color="#000" />
        </TouchableOpacity>
      </BlurView>

      {/* Footer with Blur */}
      <BlurView intensity={30} style={styles.bottomControls}>
        {/* Gallery Icon */}
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={pickImage}
          disabled={loading}
          activeOpacity={0.7}
        >
          <Ionicons name="images-outline" size={26} color="#fff" />
        </TouchableOpacity>

        {/* Shutter Button */}
        <TouchableOpacity
          activeOpacity={0.9}
          style={styles.shutterButtonOuter}
          onPress={handleCapture}
          disabled={loading}
        >
          <View style={styles.shutterButtonInner}>
            {loading && <ActivityIndicator size="small" color={COLORS.primary} />}
          </View>
        </TouchableOpacity>

        {/* Flash Toggle */}
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => setTorch(!torch)}
          disabled={loading}
          activeOpacity={0.7}
        >
          <Ionicons
            name={torch ? "flash" : "flash-off-outline"}
            size={26}
            color={torch ? "#f1c40f" : "#fff"}
          />
        </TouchableOpacity>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  blackBg: { flex: 1, backgroundColor: '#000' },
  container: { flex: 1, backgroundColor: '#000' },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xxl,
  },
  permissionTitle: { marginTop: SPACING.lg },
  permissionText: {
    marginTop: SPACING.sm,
    textAlign: 'center',
  },

  camera: { ...StyleSheet.absoluteFillObject },

  overlayContainer: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
  overlayTop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  overlayMiddle: { flexDirection: 'row', height: 280 },
  overlaySide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },

  viewfinderContainer: {
    width: 280,
    height: 280,
    overflow: 'hidden',
    borderRadius: RADIUS.xl, // Rounded corners for the actual viewfinder cutout
  },
  viewfinder: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: RADIUS.xl,
  },

  overlayBottom: { flex: 1.5, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', paddingTop: 30 },

  instructionText: {
    fontWeight: '600',
    fontSize: 16,
    opacity: 0.9,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 10
  },

  cornerTL: { position: 'absolute', top: -2, left: -2, width: 40, height: 40, borderTopWidth: 5, borderLeftWidth: 5, borderColor: COLORS.primary, borderTopLeftRadius: RADIUS.xl },
  cornerTR: { position: 'absolute', top: -2, right: -2, width: 40, height: 40, borderTopWidth: 5, borderRightWidth: 5, borderColor: COLORS.primary, borderTopRightRadius: RADIUS.xl },
  cornerBL: { position: 'absolute', bottom: -2, left: -2, width: 40, height: 40, borderBottomWidth: 5, borderLeftWidth: 5, borderColor: COLORS.primary, borderBottomLeftRadius: RADIUS.xl },
  cornerBR: { position: 'absolute', bottom: -2, right: -2, width: 40, height: 40, borderBottomWidth: 5, borderRightWidth: 5, borderColor: COLORS.primary, borderBottomRightRadius: RADIUS.xl },

  topControls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 110,
    paddingTop: 60,
    paddingHorizontal: 24,
    zIndex: 10,
    flexDirection: 'row', // Changed to row for space-between
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 180,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 40,
    paddingHorizontal: SPACING.screen,
    zIndex: 10,
  },

  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },

  // New Toggle Button Style
  toggleButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.67)', // #FFFFFFAA equivalent approx
    justifyContent: 'center',
    alignItems: 'center',
    // Slight shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },

  secondaryButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },

  shutterButtonOuter: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.5)',
    ...SHADOWS.premium,
  },
  shutterButtonInner: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
  },
});
