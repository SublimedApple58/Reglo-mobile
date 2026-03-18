import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, pink, radii, spacing, typography } from '../theme';

export type SearchableSelectOption = {
  value: string;
  label: string;
  subtitle?: string | null;
};

type SearchableSelectProps = {
  label?: string;
  placeholder?: string;
  value: string | null;
  options: SearchableSelectOption[];
  onChange: (value: string) => void;
  onFocus?: () => void;
  disabled?: boolean;
  emptyText?: string;
  maxSuggestions?: number;
  persistSelectedLabel?: boolean;
};

const normalize = (value: string) => value.trim().toLowerCase();

export const SearchableSelect = ({
  label,
  placeholder,
  value,
  options,
  onChange,
  onFocus,
  disabled = false,
  emptyText = 'Nessun risultato.',
  maxSuggestions = 8,
  persistSelectedLabel = true,
}: SearchableSelectProps) => {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const openProgress = useRef(new Animated.Value(0)).current;

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );

  useEffect(() => {
    if (!focused) {
      setQuery(persistSelectedLabel ? selectedOption?.label ?? '' : '');
    }
  }, [focused, selectedOption, persistSelectedLabel]);

  const filteredOptions = useMemo(() => {
    const needle = normalize(query);
    if (!needle) return [];
    const matches = options.filter((option) => {
      const haystack = `${option.label} ${option.subtitle ?? ''}`;
      return normalize(haystack).includes(needle);
    });
    return matches.slice(0, maxSuggestions);
  }, [maxSuggestions, options, query]);

  const showSuggestions = focused && !disabled && query.trim().length > 0;

  useEffect(() => {
    Animated.timing(openProgress, {
      toValue: showSuggestions ? 1 : 0,
      duration: showSuggestions ? 180 : 120,
      useNativeDriver: true,
    }).start();
  }, [openProgress, showSuggestions]);

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.fieldWrap}>
        <View style={[styles.inputWrapper, focused && styles.inputWrapperFocused]}>
          <Ionicons name="search" size={20} color="#94A3B8" style={styles.searchIcon} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={placeholder}
            placeholderTextColor={colors.textMuted}
            editable={!disabled}
            onFocus={() => {
              setFocused(true);
              onFocus?.();
            }}
            onBlur={() => {
              setTimeout(() => setFocused(false), 120);
            }}
            style={styles.searchInput}
          />
        </View>
        <Animated.View
          pointerEvents={showSuggestions ? 'auto' : 'none'}
          style={[
            styles.suggestionsFloating,
            {
              opacity: openProgress,
              transform: [
                {
                  translateY: openProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-6, 0],
                  }),
                },
                {
                  scale: openProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.98, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.suggestionsCard}>
            {filteredOptions.length ? (
              <ScrollView
                style={styles.suggestionsScroll}
                contentContainerStyle={styles.suggestionsContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {filteredOptions.map((option) => {
                  const isSelected = option.value === value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => {
                        onChange(option.value);
                        setQuery(persistSelectedLabel ? option.label : '');
                        setFocused(false);
                      }}
                      style={({ pressed }) => [
                        styles.optionRow,
                        isSelected ? styles.optionRowSelected : null,
                        pressed ? styles.optionRowPressed : null,
                      ]}
                    >
                      <Text style={styles.optionLabel}>{option.label}</Text>
                      {option.subtitle ? (
                        <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : (
              <Text style={styles.emptyText}>{emptyText}</Text>
            )}
          </View>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
    zIndex: 40,
  },
  label: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  fieldWrap: {
    position: 'relative',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  inputWrapperFocused: {
    borderColor: colors.primary,
    backgroundColor: '#FFFFFF',
  },
  searchIcon: {
    paddingLeft: 16,
  },
  searchInput: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  suggestionsFloating: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: spacing.xs,
    zIndex: 200,
    elevation: 12,
  },
  suggestionsCard: {
    borderRadius: radii.sm,
    backgroundColor: '#FFFFFF',
    maxHeight: 220,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  suggestionsScroll: {
    maxHeight: 220,
  },
  suggestionsContent: {
    paddingVertical: spacing.xs,
  },
  optionRow: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 2,
  },
  optionRowSelected: {
    backgroundColor: pink[50],
  },
  optionRowPressed: {
    opacity: 0.72,
  },
  optionLabel: {
    ...typography.body,
    color: colors.textPrimary,
  },
  optionSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
  },
  emptyText: {
    ...typography.caption,
    color: colors.textMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
