import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ScrollView,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import * as Haptics from '@/utils/haptics';
import { authErrorText, sendPhoneNumber } from '@/services/tdlib/auth';
import type { StackScreenProps } from '@react-navigation/stack';
import type { AuthStackParamList } from '@/navigation/types';
import { useTheme } from '@/hooks/useTheme';
import { showAlert } from '@/components/ui/Dialog';

type Props = StackScreenProps<AuthStackParamList, 'Login'>;

interface Country {
  flag: string;
  name: string;
  code: string;
  dialCode: string;
}

const COUNTRIES: Country[] = [
  { flag: '🇺🇿', name: 'Uzbekistan', code: 'UZ', dialCode: '+998' },
  { flag: '🇷🇺', name: 'Russia', code: 'RU', dialCode: '+7' },
  { flag: '🇺🇸', name: 'USA', code: 'US', dialCode: '+1' },
  { flag: '🇬🇧', name: 'UK', code: 'GB', dialCode: '+44' },
  { flag: '🇩🇪', name: 'Germany', code: 'DE', dialCode: '+49' },
];

const DEFAULT_COUNTRY = COUNTRIES[0] as Country;

export function LoginScreen({ navigation }: Props): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [selectedCountry, setSelectedCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const phoneInputRef = useRef<TextInput>(null);

  const digitCount = phoneNumber.replace(/\D/g, '').length;
  const isNextEnabled = digitCount >= 7 && !isLoading;

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleCountryPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsModalVisible(true);
  }, []);

  const handleCountrySelect = useCallback((country: Country) => {
    setSelectedCountry(country);
    setIsModalVisible(false);
    setTimeout(() => phoneInputRef.current?.focus(), 100);
  }, []);

  const handleModalClose = useCallback(() => {
    setIsModalVisible(false);
  }, []);

  const handleNext = useCallback(async () => {
    if (!isNextEnabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);
    const fullPhone = `${selectedCountry.dialCode}${phoneNumber.replace(/\D/g, '')}`;
    try {
      await sendPhoneNumber(fullPhone);
      navigation.navigate('OTP', { phone: fullPhone });
    } catch (e) {
      showAlert('Kod yuborilmadi', authErrorText(e));
    } finally {
      setIsLoading(false);
    }
  }, [isNextEnabled, selectedCountry, phoneNumber, navigation]);

  const styles = StyleSheet.create({
    flex: { flex: 1 },
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      paddingTop: insets.top,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      flex: 1,
      fontSize: theme.fontSizes.xl,
      fontWeight: theme.fontWeights.bold,
      color: theme.colors.text,
      marginLeft: theme.spacing.sm,
    },
    scrollContent: {
      paddingHorizontal: theme.spacing.xxl,
      paddingTop: theme.spacing.xxxl,
      paddingBottom: Math.max(insets.bottom, theme.spacing.xl),
    },
    subtitle: {
      fontSize: theme.fontSizes.md,
      color: theme.colors.textSecondary,
      lineHeight: 22,
      marginBottom: theme.spacing.xxxl,
    },
    countrySelector: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      marginBottom: theme.spacing.xxl,
      gap: theme.spacing.md,
    },
    countryFlag: {
      fontSize: 24,
    },
    countryInfo: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    countryName: {
      fontSize: theme.fontSizes.md,
      color: theme.colors.text,
      fontWeight: theme.fontWeights.medium,
    },
    countryDialCode: {
      fontSize: theme.fontSizes.md,
      color: theme.colors.textSecondary,
    },
    phoneInputContainer: {
      borderBottomWidth: 2,
      borderBottomColor: theme.colors.primary,
      marginBottom: theme.spacing.xxxl,
    },
    phoneInput: {
      fontSize: 28,
      fontWeight: theme.fontWeights.medium,
      color: theme.colors.text,
      textAlign: 'center',
      paddingVertical: theme.spacing.md,
      letterSpacing: 2,
    },
    nextButton: {
      height: 56,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing.xxl,
    },
    nextButtonActive: {
      backgroundColor: theme.colors.primary,
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
      elevation: 6,
    },
    nextButtonDisabled: {
      backgroundColor: theme.colors.surfaceElevated,
    },
    nextButtonText: {
      fontSize: theme.fontSizes.lg,
      fontWeight: theme.fontWeights.semibold,
    },
    nextButtonTextActive: { color: '#FFFFFF' },
    nextButtonTextDisabled: { color: theme.colors.textTertiary },
    securityNote: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.lg,
    },
    securityText: {
      fontSize: theme.fontSizes.sm,
      color: theme.colors.textTertiary,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: theme.colors.overlay,
      justifyContent: 'flex-end',
    },
    modalContainer: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: Math.max(insets.bottom, theme.spacing.lg),
    },
    modalHandle: {
      width: 40,
      height: 4,
      backgroundColor: theme.colors.border,
      borderRadius: 2,
      alignSelf: 'center',
      marginTop: theme.spacing.md,
      marginBottom: theme.spacing.lg,
    },
    modalTitle: {
      fontSize: theme.fontSizes.lg,
      fontWeight: theme.fontWeights.bold,
      color: theme.colors.text,
      paddingHorizontal: theme.spacing.xxl,
      marginBottom: theme.spacing.md,
    },
    countryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.xxl,
      paddingVertical: theme.spacing.lg,
      gap: theme.spacing.md,
    },
    countryRowSelected: {
      backgroundColor: theme.colors.surfaceHighlight,
    },
    countryRowFlag: {
      fontSize: 24,
      width: 32,
    },
    countryRowName: {
      flex: 1,
      fontSize: theme.fontSizes.md,
      color: theme.colors.text,
    },
    countryRowCode: {
      fontSize: theme.fontSizes.md,
      color: theme.colors.textSecondary,
    },
  });

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Your Phone</Text>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.subtitle}>
            Please confirm your country code and enter your phone number
          </Text>

          <TouchableOpacity
            style={styles.countrySelector}
            onPress={handleCountryPress}
            accessibilityLabel={`Selected country: ${selectedCountry.name} ${selectedCountry.dialCode}. Tap to change`}
            accessibilityRole="button"
          >
            <Text style={styles.countryFlag}>{selectedCountry.flag}</Text>
            <View style={styles.countryInfo}>
              <Text style={styles.countryName}>{selectedCountry.name}</Text>
              <Text style={styles.countryDialCode}>{selectedCountry.dialCode}</Text>
            </View>
            <Ionicons name="chevron-down" size={18} color={theme.colors.textSecondary} />
          </TouchableOpacity>

          <View style={styles.phoneInputContainer}>
            <TextInput
              ref={phoneInputRef}
              style={styles.phoneInput}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="Phone number"
              placeholderTextColor={theme.colors.textTertiary}
              keyboardType="phone-pad"
              returnKeyType="done"
              onSubmitEditing={handleNext}
              autoFocus
              accessibilityLabel="Phone number input"
              maxLength={15}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.nextButton,
              isNextEnabled ? styles.nextButtonActive : styles.nextButtonDisabled,
            ]}
            onPress={handleNext}
            disabled={!isNextEnabled}
            accessibilityLabel="Next step"
            accessibilityRole="button"
            accessibilityState={{ disabled: !isNextEnabled }}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text
                style={[
                  styles.nextButtonText,
                  isNextEnabled ? styles.nextButtonTextActive : styles.nextButtonTextDisabled,
                ]}
              >
                Next
              </Text>
            )}
          </TouchableOpacity>

          <View style={styles.securityNote}>
            <Ionicons name="lock-closed-outline" size={14} color={theme.colors.textTertiary} />
            <Text style={styles.securityText}>We will send you a confirmation code</Text>
          </View>
        </ScrollView>

        <Modal
          visible={isModalVisible}
          transparent
          animationType="slide"
          onRequestClose={handleModalClose}
        >
          <Pressable style={styles.modalOverlay} onPress={handleModalClose}>
            <Pressable style={styles.modalContainer} onPress={() => undefined}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Select Country</Text>
              {COUNTRIES.map((country) => (
                <TouchableOpacity
                  key={country.code}
                  style={[
                    styles.countryRow,
                    selectedCountry.code === country.code && styles.countryRowSelected,
                  ]}
                  onPress={() => handleCountrySelect(country)}
                  accessibilityLabel={`${country.name} ${country.dialCode}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: selectedCountry.code === country.code }}
                >
                  <Text style={styles.countryRowFlag}>{country.flag}</Text>
                  <Text style={styles.countryRowName}>{country.name}</Text>
                  <Text style={styles.countryRowCode}>{country.dialCode}</Text>
                  {selectedCountry.code === country.code && (
                    <Ionicons name="checkmark" size={18} color={theme.colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </KeyboardAvoidingView>
  );
}
