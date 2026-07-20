import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LessonsOverview } from '../../../src/components/LessonsOverview';
import { useSession } from '../../../src/context/SessionContext';
import { regloApi } from '../../../src/services/regloApi';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';
import type { AutoscuolaStudent } from '../../../src/types/regloApi';

const normalize = (v: string | null | undefined) => (v ?? '').trim().toLowerCase();

const findLinkedStudent = (
  students: AutoscuolaStudent[],
  user: { name: string | null; email: string } | null,
) => {
  if (!user) return null;
  const normalizedEmail = normalize(user.email);
  const normalizedName = normalize(user.name);
  const byEmail = students.find((s) => normalize(s.email) === normalizedEmail);
  if (byEmail) return byEmail;
  if (!normalizedName) return null;
  const byName = students.find(
    (s) => `${normalize(s.firstName)} ${normalize(s.lastName)}` === normalizedName,
  );
  return byName ?? null;
};

/**
 * Accesso durevole a "Le tue guide" dal Profilo (tab Impostazioni) dell'allievo,
 * così le guide annullate sono sempre raggiungibili anche senza guide future in
 * home. Modalità autonoma: risolve l'allievo collegato e passa lo studentId alla
 * vista condivisa, che carica programmate + annullate da sé.
 */
export default function LeTueGuideScreen() {
  const router = useRouter();
  const { user } = useSession();
  const [studentId, setStudentId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const students = await regloApi.getStudents();
        const linked = findLinkedStudent(students, user);
        if (alive) setStudentId(linked?.id ?? null);
      } catch {
        // silenzioso: la vista mostra i propri stati vuoti/di caricamento
      }
    })();
    return () => { alive = false; };
  }, [user]);

  return (
    <View style={s.root}>
      <View style={s.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={s.closeBtn}>
          <Ionicons name="close" size={20} color="#1A1A2E" />
        </Pressable>
      </View>
      <LessonsOverview studentId={studentId} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, paddingTop: 20 },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: spacing.md, marginBottom: -8 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
});
