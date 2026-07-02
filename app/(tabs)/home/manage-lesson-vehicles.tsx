import React, { useSyncExternalStore } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { manageLessonStore } from '../../../src/stores/manageLessonStore';
import { optionsPickerStore } from '../../../src/stores/optionsPickerStore';
import { SheetScaffold } from '../../../src/components/SheetScaffold';
import { GradientCTABackground } from '../../../src/components/GradientCTA';
import { isMotoLicenseCategory, vehicleServesStudent, licenseCategoryLabel, transmissionLabel } from '../../../src/utils/license';
import { instructorCanUseVehicle } from '../../../src/utils/vehicles';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

/**
 * "Veicoli" management sheet for a moto guide — opened from the manage-lesson
 * summary row to keep that screen uncluttered. Edits the primary moto, extra
 * motos and the follow car (auto al seguito). Every change auto-saves through
 * the manageLessonStore callbacks (no local Salva); the store refetches and this
 * sheet re-renders. Read-only for the titolare (it just shows the set).
 */
export default function ManageLessonVehiclesScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(manageLessonStore.subscribe, manageLessonStore.get);
  const lesson = data?.lesson ?? null;

  if (!data || !lesson) {
    return <View style={s.root} />;
  }

  const {
    vehicles, readOnly, studentLicense, followCarRules,
    onChangeVehicle, onChangeExtraMotos, onChangeFollowVehicle,
  } = data;

  const primaryVehicle = lesson.vehicle ?? null;
  const followVehicle = lesson.followVehicle ?? null;
  const extraMotos = lesson.extraMotoVehicles ?? [];
  const extraMotoIds = extraMotos.map((v) => v.id);
  const followRequired =
    isMotoLicenseCategory(primaryVehicle?.licenseCategory) &&
    followCarRules?.[primaryVehicle?.licenseCategory ?? '']?.enabled === true;

  // Pickers only offer vehicles this instructor can use (exclusivity / pool).
  const lessonInstructorId = lesson.instructorId ?? null;
  const usableByInstructor = (v: { assignedInstructorId?: string | null; poolInstructorIds?: string[] | null }) =>
    !lessonInstructorId || instructorCanUseVehicle(v, lessonInstructorId);
  const isStudentEligible = (v: { licenseCategory?: string | null; transmission?: string | null }) =>
    vehicleServesStudent(v, studentLicense ?? {});
  const primaryMotoCandidates = vehicles.filter(
    (v) => isMotoLicenseCategory(v.licenseCategory) && usableByInstructor(v) && isStudentEligible(v),
  );
  // Extra motos must ALSO serve the student's license (moto hierarchy AM<A1<A2<A:
  // equal-or-lower category only) — same rule as the primary, not "any moto".
  const extraMotoCandidates = vehicles.filter(
    (v) => isMotoLicenseCategory(v.licenseCategory) && usableByInstructor(v) && isStudentEligible(v),
  );
  const followCandidates = vehicles.filter((v) => v.licenseCategory === 'B' && usableByInstructor(v));
  const availableExtraCount = extraMotoCandidates.filter(
    (v) => v.id !== primaryVehicle?.id && !extraMotoIds.includes(v.id),
  ).length;

  const openPrimaryMotoPicker = () => {
    optionsPickerStore.set({
      title: 'Moto principale',
      multi: false,
      selected: lesson.vehicleId ? [lesson.vehicleId] : [],
      options: primaryMotoCandidates
        .filter((v) => !extraMotoIds.includes(v.id))
        .map((v) => ({ value: v.id, label: v.name, subtitle: licenseCategoryLabel(v.licenseCategory) || v.subtitle || null })),
      onConfirm: (v) => onChangeVehicle(v[0] ?? null),
    });
    router.push('/(tabs)/home/select-options');
  };

  const openExtraMotosPicker = () => {
    optionsPickerStore.set({
      title: 'Moto aggiuntive',
      multi: true,
      selected: extraMotoIds,
      options: extraMotoCandidates
        .filter((v) => v.id !== lesson.vehicleId)
        .map((v) => ({ value: v.id, label: v.name, subtitle: licenseCategoryLabel(v.licenseCategory) || v.subtitle || null })),
      onConfirm: (vs) => onChangeExtraMotos(vs),
    });
    router.push('/(tabs)/home/select-options');
  };

  const openFollowCarPicker = () => {
    optionsPickerStore.set({
      title: 'Auto al seguito',
      multi: false,
      selected: followVehicle?.id ? [followVehicle.id] : ['__none__'],
      options: [
        // The global rule suggests the follow car, it doesn't force it.
        { value: '__none__', label: 'Nessuna auto al seguito', subtitle: null },
        ...followCandidates.map((v) => ({ value: v.id, label: v.name, subtitle: transmissionLabel(v.transmission) || v.subtitle || null })),
      ],
      onConfirm: (v) => onChangeFollowVehicle(v[0] && v[0] !== '__none__' ? v[0] : null),
    });
    router.push('/(tabs)/home/select-options');
  };

  return (
    <View style={[s.root, Platform.OS === 'android' && { flex: 1 }]}>
      <View style={s.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={s.closeBtn}>
          <Ionicons name="close" size={20} color="#1A1A2E" />
        </Pressable>
      </View>

      <SheetScaffold
        contentContainerStyle={s.scaffoldBody}
        footer={
          <Pressable onPress={() => router.back()} style={({ pressed }) => [s.doneBtn, pressed && { opacity: 0.9 }]}>
            <GradientCTABackground radius={27} />
            <Text style={s.doneText}>Fatto</Text>
          </Pressable>
        }
      >
        <View style={s.headerBlock}>
          <Text style={s.title}>Veicoli</Text>
          <Text style={s.subtitle}>Moto e auto al seguito di questa guida.</Text>
        </View>

        {/* ── MOTO ── */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Moto</Text>
          <View style={s.chipWrap}>
            {primaryVehicle ? (
              <Pressable
                onPress={readOnly || !primaryMotoCandidates.length ? undefined : openPrimaryMotoPicker}
                disabled={readOnly || !primaryMotoCandidates.length}
                style={({ pressed }) => [s.mChip, pressed && !readOnly && { opacity: 0.55 }]}
              >
                <View style={s.mChipIc}><MaterialCommunityIcons name="motorbike" size={19} color="#1A1A2E" /></View>
                <Text style={s.mChipName} numberOfLines={1}>{primaryVehicle.name}</Text>
                <View style={s.princTag}><Text style={s.princTagTxt}>PRINC.</Text></View>
              </Pressable>
            ) : null}

            {extraMotos.map((v) => (
              <View key={v.id} style={s.mChip}>
                <View style={s.mChipIc}><MaterialCommunityIcons name="motorbike" size={19} color="#1A1A2E" /></View>
                <Text style={s.mChipName} numberOfLines={1}>{v.name}</Text>
                {!readOnly ? (
                  <Pressable onPress={() => onChangeExtraMotos(extraMotoIds.filter((x) => x !== v.id))} hitSlop={8} style={({ pressed }) => [s.chipX, pressed && { opacity: 0.5 }]}>
                    <Ionicons name="close" size={15} color="#8A93A2" />
                  </Pressable>
                ) : null}
              </View>
            ))}

            {!readOnly && availableExtraCount > 0 ? (
              <Pressable onPress={openExtraMotosPicker} style={({ pressed }) => [s.chipAdd, pressed && { opacity: 0.5 }]}>
                <Ionicons name="add" size={18} color="#4B5563" />
                <Text style={s.chipAddTxt}>Aggiungi</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* ── AUTO AL SEGUITO ── */}
        <View style={s.section}>
          <View style={s.sectionLabelRow}>
            <Text style={s.sectionLabel}>Auto al seguito</Text>
            {followRequired ? <Text style={s.reqTag}>consigliata</Text> : null}
          </View>
          {followVehicle ? (
            <View style={s.followRow}>
              <View style={s.vIc}><Ionicons name="car-outline" size={20} color="#1A1A2E" /></View>
              <Pressable
                onPress={readOnly || !followCandidates.length ? undefined : openFollowCarPicker}
                disabled={readOnly || !followCandidates.length}
                style={({ pressed }) => [{ flex: 1, minWidth: 0 }, pressed && !readOnly && { opacity: 0.55 }]}
              >
                <Text style={s.vName} numberOfLines={1}>{followVehicle.name}</Text>
                <Text style={s.vKind}>{readOnly ? 'Auto al seguito' : 'Tocca per cambiare'}</Text>
              </Pressable>
              {!readOnly ? (
                <Pressable onPress={() => onChangeFollowVehicle(null)} hitSlop={8} style={({ pressed }) => [s.chipX, pressed && { opacity: 0.5 }]}>
                  <Ionicons name="close" size={16} color="#8A93A2" />
                </Pressable>
              ) : null}
            </View>
          ) : !readOnly ? (
            <Pressable onPress={openFollowCarPicker} disabled={!followCandidates.length} style={({ pressed }) => [s.addFollow, pressed && { opacity: 0.5 }]}>
              <View style={s.addFollowIc}><Ionicons name="add" size={18} color="#6B7280" /></View>
              <Text style={s.addFollowTxt}>Aggiungi auto al seguito</Text>
            </Pressable>
          ) : (
            <Text style={s.followEmpty}>Nessuna</Text>
          )}
        </View>
      </SheetScaffold>
    </View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: colors.background, paddingTop: 16, paddingHorizontal: spacing.lg, paddingBottom: 32, gap: 20 },
  scaffoldBody: { gap: 24 },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', marginRight: -4, marginBottom: -8 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  headerBlock: { gap: 4, marginBottom: 0 },
  title: { fontSize: 22, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.4 },
  subtitle: { fontSize: 14, fontWeight: '500', color: colors.textMuted },

  section: { gap: 12 },
  sectionLabel: { fontSize: 16, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.3 },
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  // bigger tags
  reqTag: { fontSize: 12, fontWeight: '600', color: '#64748B', backgroundColor: '#EEF0F4', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8, overflow: 'hidden' },
  princTag: { backgroundColor: '#1A1A2E', borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3 },
  princTagTxt: { fontSize: 11, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.3 },

  // moto chips
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 9 },
  mChip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F4F5F7', borderRadius: 14, paddingVertical: 7, paddingLeft: 7, paddingRight: 12, maxWidth: '100%' },
  mChipIc: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  mChipName: { fontSize: 14.5, fontWeight: '600', color: '#1E293B', flexShrink: 1 },
  chipX: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center', marginLeft: 1 },
  chipAdd: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: '#C7CBD6', borderStyle: 'dashed', borderRadius: 14, paddingVertical: 8, paddingHorizontal: 13 },
  chipAddTxt: { fontSize: 14, fontWeight: '600', color: '#4B5563' },

  // follow car
  followRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F4F5F7', borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14 },
  vIc: { width: 36, height: 36, borderRadius: 11, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  vName: { fontSize: 15, fontWeight: '600', color: '#1E293B' },
  vKind: { fontSize: 12.5, color: '#94A3B8', marginTop: 1 },
  addFollow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  addFollowIc: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: '#C3C7D4', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  addFollowTxt: { fontSize: 15, fontWeight: '600', color: '#3A3A63' },
  followEmpty: { fontSize: 14.5, color: '#94A3B8' },

  doneBtn: {
    minHeight: 54, borderRadius: 27,
    alignItems: 'center', justifyContent: 'center', marginTop: 24,
    shadowColor: '#1A1A2E', shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  doneText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF', letterSpacing: -0.2 },
});
