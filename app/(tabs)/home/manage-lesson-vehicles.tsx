import React, { useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { manageLessonStore } from '../../../src/stores/manageLessonStore';
import { optionsPickerPath, optionsPickerStore } from '../../../src/stores/optionsPickerStore';
import { FormSheet } from '../../../src/components/SheetScaffold';
import { ClayButton, ClayList, ClayListRow, ClaySection } from '../../../src/components/clay';
import { isMotoLicenseCategory, vehicleServesStudent, licenseCategoryLabel, transmissionLabel } from '../../../src/utils/license';
import { instructorCanUseVehicle } from '../../../src/utils/vehicles';
import { CLAY } from '../../../src/theme/clay';

/** «Togli» di una riga: X monocromatica piccola (comando, non decorazione). */
function RemoveButton({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => [s.remove, pressed && { opacity: 0.5 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name="close" size={18} color={CLAY.ink3} />
    </Pressable>
  );
}

/**
 * "Veicoli" management sheet for a moto guide — opened from the manage-lesson
 * summary row to keep that screen uncluttered. Edits the primary moto, extra
 * motos and the follow car (auto al seguito). Every change auto-saves through
 * the manageLessonStore callbacks (no local Salva); the store refetches and this
 * sheet re-renders. Read-only for the titolare (it just shows the set).
 * Form sheet unico (FORM_SHEET + FormSheet, REG-639 clay): righe di liste clay,
 * niente chip né tag; «principale» e «consigliata» sono testo.
 */
export default function ManageLessonVehiclesScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(manageLessonStore.subscribe, manageLessonStore.get);
  const lesson = data?.lesson ?? null;

  if (!data || !lesson) {
    return <View style={s.empty} />;
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
    router.push(optionsPickerPath());
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
    router.push(optionsPickerPath());
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
    router.push(optionsPickerPath());
  };

  const canPickPrimary = !readOnly && primaryMotoCandidates.length > 0;
  const canAddExtra = !readOnly && availableExtraCount > 0;
  const hasMotoRows = !!primaryVehicle || extraMotos.length > 0 || canAddExtra;

  return (
    <FormSheet
      title="Veicoli"
      subtitle="Moto e auto al seguito di questa guida."
      testID="manage-lesson-vehicles-sheet"
      cta={<ClayButton title="Fatto" onPress={() => router.back()} testID="manage-lesson-vehicles-done" />}
    >
      <ClaySection title="Moto" style={s.firstSection}>
        {hasMotoRows ? (
          <ClayList>
            {primaryVehicle ? (
              <ClayListRow
                title={primaryVehicle.name}
                subtitle="Moto principale"
                onPress={canPickPrimary ? openPrimaryMotoPicker : undefined}
                testID="vehicles-primary"
              />
            ) : null}
            {extraMotos.map((v) => (
              <ClayListRow
                key={v.id}
                title={v.name}
                subtitle="Moto aggiuntiva"
                trailing={
                  !readOnly ? (
                    <RemoveButton
                      label={`Togli ${v.name}`}
                      onPress={() => onChangeExtraMotos(extraMotoIds.filter((x) => x !== v.id))}
                    />
                  ) : null
                }
                testID={`vehicles-extra-${v.id}`}
              />
            ))}
            {canAddExtra ? (
              <ClayListRow title="Aggiungi moto" onPress={openExtraMotosPicker} testID="vehicles-add-moto" />
            ) : null}
          </ClayList>
        ) : (
          <Text style={s.none}>Nessuna</Text>
        )}
      </ClaySection>

      <ClaySection
        title="Auto al seguito"
        footnote={followRequired ? 'Consigliata per questa moto.' : undefined}
      >
        {followVehicle ? (
          <ClayList>
            <ClayListRow
              title={followVehicle.name}
              subtitle={readOnly ? 'Auto al seguito' : 'Tocca per cambiare'}
              onPress={readOnly || !followCandidates.length ? undefined : openFollowCarPicker}
              chevron={false}
              trailing={
                !readOnly ? (
                  <RemoveButton label="Togli l'auto al seguito" onPress={() => onChangeFollowVehicle(null)} />
                ) : null
              }
              testID="vehicles-follow"
            />
          </ClayList>
        ) : !readOnly ? (
          <ClayList>
            <ClayListRow
              title="Aggiungi auto al seguito"
              onPress={openFollowCarPicker}
              dimmed={!followCandidates.length}
              testID="vehicles-add-follow"
            />
          </ClayList>
        ) : (
          <Text style={s.none}>Nessuna</Text>
        )}
      </ClaySection>
    </FormSheet>
  );
}

const s = StyleSheet.create({
  empty: { backgroundColor: '#FFFFFF', height: 1 },
  firstSection: { marginTop: 4 },
  none: { fontSize: 15, color: CLAY.ink3, paddingHorizontal: 2 },
  remove: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
});
