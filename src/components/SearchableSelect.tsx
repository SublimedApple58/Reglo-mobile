import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GlassInput } from './GlassInput';
import { colors, spacing, typography } from '../theme';

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
  disabled?: boolean;
  emptyText?: string;
  maxSuggestions?: number;
};

const normalize = (value: string) => value.trim().toLowerCase();

export const SearchableSelect = ({
  label,
  placeholder,
  value,
  options,
  onChange,
  disabled = false,
  emptyText = 'Nessun risultato.',
  maxSuggestions = 8,
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
      setQuery(selectedOption?.label ?? '');
    }
  }, [focused, selectedOption]);

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
        <GlassInput
          value={query}
          onChangeText={setQuery}
          placeholder={placeholder}
          editable={!disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setTimeout(() => setFocused(false), 120);
          }}
        />
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
                        setQuery(option.label);
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
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(50, 77, 122, 0.14)',
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    maxHeight: 220,
    shadowColor: '#0F1D33',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 10 },
  },
  suggestionsScroll: {
    maxHeight: 220,
  },
  suggestionsContent: {
    paddingVertical: spacing.xs,
  },
  optionRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 2,
  },
  optionRowSelected: {
    backgroundColor: 'rgba(50, 77, 122, 0.08)',
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
