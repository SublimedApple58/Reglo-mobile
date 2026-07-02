import React, { useEffect, useState, useSyncExternalStore } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  Extrapolation,
  FadeIn,
  FadeOut,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { manageLessonStore, type ManageLessonMenuOption } from '../../../src/stores/manageLessonStore';
import { instructorPickerStore } from '../../../src/stores/instructorPickerStore';
import { locationPickerStore } from '../../../src/stores/locationPickerStore';
import { locationFormStore } from '../../../src/stores/locationFormStore';
import { optionsPickerStore } from '../../../src/stores/optionsPickerStore';
import { regloApi } from '../../../src/services/regloApi';
import { GradientCTABackground } from '../../../src/components/GradientCTA';
import { ProgressRing } from '../../../src/components/ProgressRing';
import { SkeletonRing } from '../../../src/components/Skeleton';
import { LESSON_TYPE_OPTIONS, normalizeLessonType } from '../../../src/utils/lessonTypes';
import { isMotoLicenseCategory, vehicleServesStudent } from '../../../src/utils/license';
import { instructorCanUseVehicle } from '../../../src/utils/vehicles';
import { formatDay, formatTime } from '../../../src/utils/date';
import { colors } from '../../../src/theme/colors';

const TONE: Record<string, { bg: string; fg: string }> = {
  live: { bg: '#1A1A2E', fg: '#FFFFFF' },
  confirmed: { bg: '#DCFCE7', fg: '#15803D' },
  scheduled: { bg: '#EEF0F4', fg: '#1A1A2E' },
  pending_review: { bg: '#FEF0E6', fg: '#C2410C' },
};

const PILL_ICON: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  sposta: 'calendar-arrow-right',
  scambia: 'swap-horizontal',
  cancella: 'trash-can-outline',
};
const PILL_LABEL: Record<string, string> = {
  sposta: 'Sposta',
  scambia: 'Scambia',
  cancella: 'Elimina',
};

/** One expanded action pill — staggered spring-in driven by the shared progress. */
function MorphPill({
  progress,
  index,
  count,
  option,
  onPress,
  disabled,
}: {
  progress: SharedValue<number>;
  index: number;
  count: number;
  option: ManageLessonMenuOption;
  onPress: () => void;
  disabled: boolean;
}) {
  const st = useAnimatedStyle(() => {
    const order = count - 1 - index; // last pill leads — fans out from the •••
    const start = 0.08 * order;
    const p = interpolate(progress.value, [start, start + 0.6], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: p,
      transform: [
        { translateX: interpolate(p, [0, 1], [40, 0]) },
        { scale: interpolate(p, [0, 1], [0.82, 1]) },
      ],
    };
  });
  const iconOnly = !!option.danger; // Elimina = solo cestino, come la X
  return (
    <Animated.View style={[iconOnly ? s.pillIconWrap : s.pillWrap, st]}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [iconOnly ? s.pillIcon : s.pill, pressed && { opacity: 0.5 }]}
      >
        <MaterialCommunityIcons name={PILL_ICON[option.key] ?? 'dots-horizontal'} size={iconOnly ? 21 : 19} color={option.danger ? '#E5484D' : '#1A1A2E'} />
        {iconOnly ? null : (
          <Text style={s.pillLabel} numberOfLines={1}>{PILL_LABEL[option.key] ?? option.label}</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

type MorphStatus = {
  allowPresente: boolean;
  pendingAction: string | null;
  onPresente: () => void;
  onAssente: () => void;
};

/**
 * Morphing action toolbar: one row with [Presente] [Assente] [•••]. Tapping •••
 * collapses Presente/Assente and fans out the secondary actions as separate
 * rounded pills while the ••• morphs into an X (back). One spring drives it all.
 */
function MorphToolbar({
  menuOptions,
  onAction,
  disabled,
  expanded,
  setExpanded,
  status,
}: {
  menuOptions: ManageLessonMenuOption[];
  onAction: (key: string) => void;
  disabled: boolean;
  expanded: boolean;
  setExpanded: (v: boolean) => void;
  status?: MorphStatus;
}) {
  const hasMenu = menuOptions.length > 0;
  const onlyDelete = menuOptions.length === 1 && !!menuOptions[0].danger;
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withSpring(expanded ? 1 : 0, { damping: 15, stiffness: 170, mass: 0.7 });
  }, [expanded]);

  const statusStyle = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 0.35], [1, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(t.value, [0, 1], [1, 0.95], Extrapolation.CLAMP) }],
  }));
  const dotsStyle = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 0.3], [1, 0], Extrapolation.CLAMP),
    transform: [{ rotate: `${interpolate(t.value, [0, 1], [0, 90], Extrapolation.CLAMP)}deg` }],
  }));
  const xStyle = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0.35, 1], [0, 1], Extrapolation.CLAMP),
    transform: [{ rotate: `${interpolate(t.value, [0, 1], [-90, 0], Extrapolation.CLAMP)}deg` }],
  }));

  // No Presente/Assente and more than one action → show the actions directly,
  // no ••• needed (there's room for them).
  if (hasMenu && !onlyDelete && !status) {
    return (
      <View style={s.directRow} pointerEvents="box-none">
        {menuOptions.map((o) =>
          o.danger ? (
            <Pressable
              key={o.key}
              onPress={() => onAction(o.key)}
              disabled={disabled}
              style={({ pressed }) => [s.pillIcon, pressed && { opacity: 0.7 }]}
              accessibilityLabel="Elimina guida"
            >
              <MaterialCommunityIcons name="trash-can-outline" size={21} color="#E5484D" />
            </Pressable>
          ) : (
            <Pressable
              key={o.key}
              onPress={() => onAction(o.key)}
              disabled={disabled}
              style={({ pressed }) => [s.directPill, pressed && { opacity: 0.5 }]}
            >
              <MaterialCommunityIcons name={PILL_ICON[o.key] ?? 'dots-horizontal'} size={19} color="#1A1A2E" />
              <Text style={s.pillLabel} numberOfLines={1}>{PILL_LABEL[o.key] ?? o.label}</Text>
            </Pressable>
          ),
        )}
      </View>
    );
  }

  return (
    <View style={s.toolbar} pointerEvents="box-none">
      {/* Presente / Assente (collapsed state) */}
      {status ? (
        <Animated.View style={[s.statusLayer, { right: hasMenu ? 60 : 0 }, statusStyle]} pointerEvents={expanded ? 'none' : 'auto'}>
          {status.allowPresente ? (
            <Pressable
              onPress={status.onPresente}
              disabled={disabled}
              style={({ pressed }) => [s.presBtn, pressed && { opacity: 0.9 }, disabled && { opacity: 0.5 }]}
            >
              <GradientCTABackground radius={25} />
              <Text style={s.presText}>{status.pendingAction === 'checked_in' ? 'Attendi…' : 'Presente'}</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={status.onAssente}
            disabled={disabled}
            style={({ pressed }) => [s.absBtn, pressed && { opacity: 0.9 }, disabled && { opacity: 0.5 }]}
          >
            <Text style={s.absText}>{status.pendingAction === 'no_show' ? 'Attendi…' : 'Assente'}</Text>
          </Pressable>
        </Animated.View>
      ) : null}

      {/* Action pills (expanded state) — not used when delete is the only action */}
      {hasMenu && !onlyDelete ? (
        <View style={s.pillsLayer} pointerEvents={expanded ? 'auto' : 'none'}>
          {menuOptions.map((o, i) => (
            <MorphPill
              key={o.key}
              progress={t}
              index={i}
              count={menuOptions.length}
              option={o}
              disabled={disabled}
              onPress={() => { setExpanded(false); onAction(o.key); }}
            />
          ))}
        </View>
      ) : null}

      {/* Right anchor: trash circle when delete is the only action, else ••• ↔ X */}
      {onlyDelete ? (
        <Pressable
          onPress={() => onAction(menuOptions[0].key)}
          disabled={disabled}
          style={({ pressed }) => [s.fabCircle, s.moreAnchor, pressed && { opacity: 0.85 }]}
          accessibilityLabel="Elimina guida"
        >
          <MaterialCommunityIcons name="trash-can-outline" size={21} color="#E5484D" />
        </Pressable>
      ) : hasMenu ? (
        <Pressable
          onPress={() => setExpanded(!expanded)}
          style={({ pressed }) => [s.fabCircle, s.moreAnchor, pressed && { opacity: 0.85 }]}
          accessibilityLabel={expanded ? 'Chiudi azioni' : 'Altre azioni'}
        >
          <Animated.View style={[s.iconAbs, dotsStyle]}>
            <Ionicons name="ellipsis-horizontal" size={21} color="#1A1A2E" />
          </Animated.View>
          <Animated.View style={[s.iconAbs, xStyle]}>
            <Ionicons name="close" size={21} color="#1A1A2E" />
          </Animated.View>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function ManageLessonScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const data = useSyncExternalStore(manageLessonStore.subscribe, manageLessonStore.get);
  const [expanded, setExpanded] = useState(false);

  // Tell the parent when this route is dismissed (popped), then clear the store.
  useEffect(() => {
    return () => {
      manageLessonStore.get()?.onClosed?.();
      manageLessonStore.clear();
    };
  }, []);

  const lesson = data?.lesson ?? null;

  if (!data || !lesson) {
    return <View style={s.sheet} />;
  }

  const {
    studentProgress, stateMeta, stateLabel, durationText, vehiclesEnabled, vehicleText,
    vehicles, defaultLocation, showStatusActions, allowPresente, showRating, readOnly,
    pendingAction, menuOptions, onChangeInstructor, onStatus, onMenu, onChangeLocation, onChangeVehicle,
    studentLicense, followCarRules,
  } = data;

  const isPending = pendingAction !== null;
  const tone = stateMeta ? TONE[stateMeta.tone] ?? TONE.scheduled : null;
  const phone = lesson.student?.phone ?? null;
  const hasMenu = menuOptions.length > 0;

  const openInstructorPicker = () => {
    instructorPickerStore.set({
      currentInstructorId: lesson.instructorId ?? null,
      selectedInstructorId: lesson.instructorId ?? null,
      onSelect: (it) => onChangeInstructor(it),
    });
    router.push('/(tabs)/home/manage-lesson-instructor');
  };

  const openLocationPicker = () => {
    locationPickerStore.set({
      selectedLocationId: lesson.locationId ?? defaultLocation?.id ?? null,
      onSelect: (loc) => onChangeLocation(loc),
      onRequestCreate: () => {
        locationFormStore.set({
          initial: null,
          onSubmit: async (values) => {
            // Just create it — the picker refetches on focus and shows it in
            // the list. The user then taps it to apply (single change → no
            // "Nessuna modifica da salvare" from re-applying the same id).
            await regloApi.createLocation(values);
          },
        });
        router.push('/(tabs)/home/manage-lesson-location-form');
      },
    });
    router.push('/(tabs)/home/manage-lesson-location');
  };

  // Auto / unassigned guide → single "Veicolo" row picker (eligible vehicles for
  // the student that this instructor can use). The moto multi-vehicle editing
  // (primary + extra motos + follow car) lives in the manage-lesson-vehicles
  // sheet to keep this screen uncluttered.
  const lessonInstructorId = lesson.instructorId ?? null;
  const openVehiclePicker = () => {
    optionsPickerStore.set({
      title: 'Veicolo',
      multi: false,
      selected: lesson.vehicleId ? [lesson.vehicleId] : [],
      options: vehicles
        .filter(
          (v) =>
            (!lessonInstructorId || instructorCanUseVehicle(v, lessonInstructorId)) &&
            vehicleServesStudent(v, studentLicense ?? {}),
        )
        .map((v) => ({ value: v.id, label: v.name, subtitle: v.subtitle ?? null })),
      onConfirm: (v) => onChangeVehicle(v[0] ?? null),
    });
    router.push('/(tabs)/home/select-options');
  };

  const openVehiclesSheet = () => router.push('/(tabs)/home/manage-lesson-vehicles');

  const openDetails = () => router.push('/(tabs)/home/manage-lesson-details');

  // Student detail modal — same route the exam sheet uses, stacks natively
  // over this sheet with its own X close.
  const openStudentDetail = () =>
    router.push({
      pathname: '/(tabs)/home/student-detail',
      params: { studentId: lesson.studentId, name: studentName },
    } as never);

  const runMenu = (key: string) => {
    if (isPending) return;
    if (key === 'scambia' || key === 'sposta') {
      // These open a formSheet that stacks natively over this sheet — keep
      // "Gestisci guida" open underneath instead of closing it first.
      onMenu(key);
      return;
    }
    router.back();
    setTimeout(() => onMenu(key), 350);
  };

  const handleStatus = (action: 'checked_in' | 'no_show') => {
    if (isPending) return;
    router.back();
    setTimeout(() => onStatus(action), 300);
  };

  const locName = lesson.location?.name ?? defaultLocation?.name ?? "Sede dell'autoscuola";
  const locAddress = lesson.location?.address ?? defaultLocation?.address ?? null;

  // Vehicles: a moto guide shows a single "Veicoli" summary row that opens the
  // manage-lesson-vehicles sheet (primary moto + extra motos + follow car). An
  // auto / unassigned guide keeps the single "Veicolo" picker row inline.
  const primaryVehicle = lesson.vehicle ?? null;
  const followVehicle = lesson.followVehicle ?? null;
  const extraMotos = lesson.extraMotoVehicles ?? [];
  const primaryIsMoto = vehiclesEnabled && isMotoLicenseCategory(primaryVehicle?.licenseCategory);
  const motoBlock = primaryIsMoto;
  // Summary shown on the "Veicoli" row: primary (+N moto) and the follow car.
  const motoSummaryMain =
    (primaryVehicle?.name ?? 'Moto da assegnare') +
    (extraMotos.length ? ` +${extraMotos.length} moto` : '');
  const motoSummarySub = followVehicle
    ? `Auto al seguito: ${followVehicle.name}`
    : (primaryIsMoto && followCarRules?.[primaryVehicle?.licenseCategory ?? '']?.enabled === true
        ? 'Auto al seguito da assegnare'
        : null);
  const instructorDisplay = lesson.instructor?.name ?? 'Nessun istruttore';
  const studentName = `${lesson.student?.firstName ?? ''} ${lesson.student?.lastName ?? ''}`.trim() || 'Allievo';

  // Details card preview (tipo · voto · note)
  const typeValues = lesson.types?.length ? lesson.types : (lesson.type ? [lesson.type] : []);
  const typeLabels = typeValues
    .map((v) => LESSON_TYPE_OPTIONS.find((o) => o.value === normalizeLessonType(v))?.label ?? null)
    .filter(Boolean) as string[];
  const summaryParts: string[] = [];
  if (typeLabels.length) summaryParts.push(typeLabels.join(', '));
  if (showRating && lesson.rating) summaryParts.push(`${lesson.rating}★`);
  if (lesson.notes && lesson.notes.trim()) summaryParts.push('note');
  const detailsSummary = summaryParts.join(' · ') || 'Tipo, valutazione e note';

  const showBottom = showStatusActions || hasMenu;
  const bottomPad = insets.bottom + (showBottom ? 86 : 12);

  return (
    <View style={s.sheet}>
      {/* Top action bar — X close */}
      <View style={[s.topBar, Platform.OS === 'android' && { justifyContent: 'flex-start' }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={({ pressed }) => [s.iconBtn, pressed && { opacity: 0.5 }]}>
          <Ionicons name={Platform.OS === 'android' ? 'arrow-back' : 'close'} size={20} color="#1A1A2E" />
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.content, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={s.hero}>
          <Text style={s.heroOverline}>{readOnly ? 'Dettaglio guida' : 'Gestisci guida'}</Text>
          {/* Nome tappabile → modal dettaglio allievo (storico, obbligo guide, esami) */}
          <Pressable onPress={openStudentDetail} hitSlop={6} style={({ pressed }) => [s.heroNameRow, pressed && { opacity: 0.55 }]}>
            <Text style={s.heroName}>{studentName}</Text>
            <Ionicons name="chevron-forward" size={21} color="#C7CBD1" style={{ marginTop: 3 }} />
          </Pressable>
          <Text style={s.heroMeta}>
            {formatDay(lesson.startsAt)} · {formatTime(lesson.startsAt)}
            {durationText ? ` · ${durationText}` : ''}
            {vehiclesEnabled && !motoBlock ? ` · ${vehicleText}` : ''}
          </Text>
          <View style={{ flexDirection: 'row', marginTop: 12 }}>
            <View style={[s.statePill, { backgroundColor: tone ? tone.bg : '#EEF0F4' }]}>
              <Text style={[s.statePillText, { color: tone ? tone.fg : '#1A1A2E' }]}>
                {stateMeta ? stateMeta.label : stateLabel}
              </Text>
            </View>
          </View>

          {/* Contatti — cerchietti in alto a sinistra */}
          {phone ? (
            <View style={s.contactTopRow}>
              <Pressable
                onPress={() => Linking.openURL(`tel:${phone}`)}
                style={({ pressed }) => [s.contactCircle, pressed && { opacity: 0.7 }]}
                accessibilityLabel="Chiama allievo"
              >
                <Ionicons name="call" size={19} color="#1A1A2E" />
              </Pressable>
              <Pressable
                onPress={() => Linking.openURL(`https://wa.me/${phone.replace(/[^0-9]/g, '')}`)}
                style={({ pressed }) => [s.contactCircle, pressed && { opacity: 0.7 }]}
                accessibilityLabel="Scrivi su WhatsApp"
              >
                <Ionicons name="logo-whatsapp" size={19} color="#1A1A2E" />
              </Pressable>
            </View>
          ) : null}
        </View>

        {/* Progresso guide — ring 3D centrale */}
        {lesson.type !== 'esame' && (
          <View style={s.progressBlock}>
            {studentProgress ? (
              <ProgressRing
                size={132}
                stroke={13}
                progress={studentProgress.completed / Math.max(1, studentProgress.required)}
                gradient={['#3A3A63', '#16162A']}
                innerColor={colors.background}
              >
                <Text style={s.ringCount}>
                  {studentProgress.completed}
                  <Text style={s.ringTotal}>/{studentProgress.required}</Text>
                </Text>
              </ProgressRing>
            ) : (
              <SkeletonRing size={132} stroke={13} />
            )}
          </View>
        )}

        {/* Istruttore + Luogo — righe piatte. Read-only (titolare) = righe statiche
            senza chevron né navigazione; altrimenti auto-save su selezione. */}
        <View style={s.detailRows}>
          {readOnly ? (
            <View style={s.detailRow}>
              <View style={s.detailIcon}><Ionicons name="person-outline" size={23} color="#1A1A2E" /></View>
              <View style={s.detailBody}>
                <Text style={s.detailLabel}>Istruttore</Text>
                <Text style={s.detailValue} numberOfLines={1}>{instructorDisplay}</Text>
              </View>
            </View>
          ) : (
            <Pressable onPress={openInstructorPicker} style={({ pressed }) => [s.detailRow, pressed && { opacity: 0.5 }]}>
              <View style={s.detailIcon}><Ionicons name="person-outline" size={23} color="#1A1A2E" /></View>
              <View style={s.detailBody}>
                <Text style={s.detailLabel}>Istruttore</Text>
                <Text style={s.detailValue} numberOfLines={1}>{instructorDisplay}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#C7CBD1" />
            </Pressable>
          )}
          <View style={s.rowDivider} />
          {readOnly ? (
            <View style={s.detailRow}>
              <View style={s.detailIcon}><Ionicons name="location-outline" size={23} color="#1A1A2E" /></View>
              <View style={s.detailBody}>
                <Text style={s.detailLabel}>Luogo</Text>
                <Text style={s.detailValue} numberOfLines={1}>{locName}</Text>
                {locAddress ? <Text style={s.detailValueSub} numberOfLines={1}>{locAddress}</Text> : null}
              </View>
            </View>
          ) : (
            <Pressable onPress={openLocationPicker} style={({ pressed }) => [s.detailRow, pressed && { opacity: 0.5 }]}>
              <View style={s.detailIcon}><Ionicons name="location-outline" size={23} color="#1A1A2E" /></View>
              <View style={s.detailBody}>
                <Text style={s.detailLabel}>Luogo</Text>
                <Text style={s.detailValue} numberOfLines={1}>{locName}</Text>
                {locAddress ? <Text style={s.detailValueSub} numberOfLines={1}>{locAddress}</Text> : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color="#C7CBD1" />
            </Pressable>
          )}

          {vehiclesEnabled && !motoBlock ? (
            <>
              <View style={s.rowDivider} />
              {readOnly ? (
                <View style={s.detailRow}>
                  <View style={s.detailIcon}><Ionicons name="car-outline" size={23} color="#1A1A2E" /></View>
                  <View style={s.detailBody}>
                    <Text style={s.detailLabel}>Veicolo</Text>
                    <Text style={s.detailValue} numberOfLines={1}>{vehicleText}</Text>
                  </View>
                </View>
              ) : (
                <Pressable
                  onPress={openVehiclePicker}
                  disabled={!vehicles.length}
                  style={({ pressed }) => [s.detailRow, pressed && { opacity: 0.5 }]}
                >
                  <View style={s.detailIcon}><Ionicons name="car-outline" size={23} color="#1A1A2E" /></View>
                  <View style={s.detailBody}>
                    <Text style={s.detailLabel}>Veicolo</Text>
                    <Text style={s.detailValue} numberOfLines={1}>{vehicleText}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#C7CBD1" />
                </Pressable>
              )}
            </>
          ) : null}

          {/* Guida moto: riga riepilogo "Veicoli" → apre il sheet dedicato
              (moto principale + aggiuntive + auto al seguito). Read-only per il
              titolare = riga statica. */}
          {motoBlock ? (
            <>
              <View style={s.rowDivider} />
              {readOnly ? (
                <View style={s.detailRow}>
                  <View style={s.detailIcon}><MaterialCommunityIcons name="motorbike" size={23} color="#1A1A2E" /></View>
                  <View style={s.detailBody}>
                    <Text style={s.detailLabel}>Veicoli</Text>
                    <Text style={s.detailValue} numberOfLines={1}>{motoSummaryMain}</Text>
                    {motoSummarySub ? <Text style={s.detailValueSub} numberOfLines={1}>{motoSummarySub}</Text> : null}
                  </View>
                </View>
              ) : (
                <Pressable onPress={openVehiclesSheet} style={({ pressed }) => [s.detailRow, pressed && { opacity: 0.5 }]}>
                  <View style={s.detailIcon}><MaterialCommunityIcons name="motorbike" size={23} color="#1A1A2E" /></View>
                  <View style={s.detailBody}>
                    <Text style={s.detailLabel}>Veicoli</Text>
                    <Text style={s.detailValue} numberOfLines={1}>{motoSummaryMain}</Text>
                    {motoSummarySub ? <Text style={s.detailValueSub} numberOfLines={1}>{motoSummarySub}</Text> : null}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#C7CBD1" />
                </Pressable>
              )}
            </>
          ) : null}
        </View>

        {/* Dettagli guida — card 3D CTA (tutta cliccabile) → sub-sheet.
            Nascosta in read-only (il titolare non modifica tipo/voto/note). */}
        {!readOnly && lesson.type !== 'esame' ? (
          <Pressable onPress={openDetails} style={({ pressed }) => [s.cardCta, pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] }]}>
            <View style={s.cardIcon}><Ionicons name="create-outline" size={22} color="#1A1A2E" /></View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.cardTitle}>Dettagli guida</Text>
              <Text style={s.cardSub} numberOfLines={1}>{detailsSummary}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#C7CBD1" />
          </Pressable>
        ) : null}
      </ScrollView>

      {/* Backdrop to collapse the morph on outside tap */}
      {expanded ? (
        <Animated.View entering={FadeIn.duration(140)} exiting={FadeOut.duration(140)} style={StyleSheet.absoluteFill}>
          <Pressable style={s.backdrop} onPress={() => setExpanded(false)} />
        </Animated.View>
      ) : null}

      {/* Floating bottom cluster — single row: Presente · Assente · ••• */}
      {showBottom ? (
        <View style={[s.floatWrap, { paddingBottom: insets.bottom + 12 }]} pointerEvents="box-none">
          <MorphToolbar
            menuOptions={menuOptions}
            onAction={runMenu}
            disabled={isPending}
            expanded={expanded}
            setExpanded={setExpanded}
            status={showStatusActions ? {
              allowPresente,
              pendingAction,
              onPresente: () => handleStatus('checked_in'),
              onAssente: () => handleStatus('no_show'),
            } : undefined}
          />
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.background },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4 },
  iconBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#EFEFF1', alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20, gap: 24 },

  // Hero
  hero: { gap: 4 },
  heroOverline: { fontSize: 13, fontWeight: '500', color: '#94A3B8', letterSpacing: 0.2 },
  heroNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  heroName: { fontSize: 24, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.4 },
  heroMeta: { fontSize: 14, fontWeight: '400', color: '#717171', marginTop: 2 },
  statePill: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 },
  statePillText: { fontSize: 12, fontWeight: '600' },

  // Contatti in alto
  contactTopRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  contactCircle: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2,
  },

  // Progresso ring centrale
  progressBlock: { alignItems: 'center', paddingVertical: 4 },
  ringCount: { fontSize: 34, fontWeight: '700', color: '#1A1A2E', letterSpacing: -1 },
  ringTotal: { fontSize: 18, fontWeight: '500', color: '#9CA3AF' },

  // Righe piatte istruttore/luogo
  detailRows: { gap: 0 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 14 },
  detailIcon: { width: 28, alignItems: 'center' },
  detailBody: { flex: 1, gap: 1 },
  detailLabel: { fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  detailValue: { fontSize: 14, fontWeight: '400', color: '#717171' },
  detailValueSub: { fontSize: 13, color: '#9CA3AF' },
  rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#EBEBEB', marginLeft: 44 },

  // Card 3D CTA dettagli
  cardCta: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#ECECEC',
    shadowColor: '#1A1A2E', shadowOpacity: 0.1, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 5,
  },
  cardIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#EEF0F4', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.3 },
  cardSub: { fontSize: 13, fontWeight: '400', color: '#717171' },

  // Floating bottom cluster
  backdrop: { flex: 1, backgroundColor: 'rgba(20,20,30,0.04)' },
  floatWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, gap: 10 },

  // Status layer (Presente / Assente) — collapses on expand, leaves room for •••
  statusLayer: { position: 'absolute', left: 0, top: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  presBtn: {
    flex: 1, height: 50, borderRadius: 25,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#1A1A2E', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.25, shadowRadius: 14, elevation: 8,
  },
  presText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.2 },
  absBtn: {
    flex: 1, height: 50, borderRadius: 25, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5,
  },
  absText: { fontSize: 15, fontWeight: '700', color: '#E5484D', letterSpacing: -0.2 },

  // Morphing action toolbar (downsized)
  toolbar: { height: 50, justifyContent: 'center' },
  directRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 50 },
  directPill: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    height: 50, paddingHorizontal: 18, borderRadius: 25, backgroundColor: '#FFFFFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 6,
  },
  fabCircle: {
    width: 50, height: 50, borderRadius: 25, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 6,
  },
  moreAnchor: { position: 'absolute', right: 0, top: 0 },
  iconAbs: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },

  // Expanded action pills (separate rounded pills, leaving room for the X at right)
  pillsLayer: { position: 'absolute', left: 0, top: 0, bottom: 0, right: 60, flexDirection: 'row', alignItems: 'center', gap: 10 },
  pillWrap: { flex: 1, height: 50 },
  pill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    borderRadius: 25, backgroundColor: '#FFFFFF', paddingHorizontal: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 6,
  },
  pillLabel: { fontSize: 14, fontWeight: '500', color: '#1A1A2E', letterSpacing: -0.2 },
  // Elimina — solo icona, cerchio come la X
  pillIconWrap: { width: 50, height: 50 },
  pillIcon: {
    width: 50, height: 50, borderRadius: 25, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 6,
  },
});
