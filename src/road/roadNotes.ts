import { useEffect, useSyncExternalStore } from 'react';
import { Alert } from 'react-native';
import type { Router } from 'expo-router';
import * as Haptics from '../utils/haptics';
import { regloApi } from '../services/regloApi';
import { notesEditorStore } from '../stores/notesEditorStore';
import type { RoadLesson } from '../types/regloApi';

/**
 * Giro Road (Tiziano 28/10): le note sulla guida si prendono anche DENTRO
 * Road — durante la guida (tasto «Note» in testata) e subito dopo (riepilogo,
 * «Appena finita»). È lo stesso campo della guida (`appointment.notes`, lo
 * vede anche l'allievo) e lo stesso foglio note della home (`edit-notes`).
 * La nota già scritta si legge dalla guida (getAppointments per allievo e
 * orario) e si tiene qui, così il foglio si apre subito.
 */

/** appointmentId → nota attuale (`null` = nessuna); assente = da caricare. */
const notes = new Map<string, string | null>();
const loading = new Map<string, Promise<string | null>>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

export type RoadNotesRoute = '/road/note' | '/(tabs)/drive/note';

function loadNotes(lesson: RoadLesson): Promise<string | null> {
  const id = lesson.appointmentId;
  const known = loading.get(id);
  if (known) return known;
  const p = (async () => {
    try {
      const list = await regloApi.getAppointments({
        studentId: lesson.student?.id ?? undefined,
        from: lesson.startsAt,
        to: lesson.endsAt,
        limit: 20,
      });
      const note = list.find((a) => a.id === id)?.notes?.trim() || null;
      notes.set(id, note);
      notify();
      return note;
    } catch {
      return notes.get(id) ?? null;
    } finally {
      loading.delete(id);
    }
  })();
  loading.set(id, p);
  return p;
}

/** Carica in anticipo la nota (all'ingresso in Road / nel riepilogo). */
export function prefetchRoadNotes(lesson: RoadLesson | null | undefined) {
  if (lesson && !notes.has(lesson.appointmentId)) void loadNotes(lesson);
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

/** Nota della guida per le righe di riepilogo; `undefined` finché non si sa. */
export function useRoadNotes(lesson: RoadLesson | null | undefined): string | null | undefined {
  const id = lesson?.appointmentId ?? null;
  const value = useSyncExternalStore(subscribe, () => (id && notes.has(id) ? notes.get(id)! : id ? undefined : null));
  useEffect(() => {
    prefetchRoadNotes(lesson);
  }, [lesson]);
  return value;
}

/** Apre il foglio note della guida (stack di Road o della tab Road). */
export async function openRoadNotes(router: Router, lesson: RoadLesson, route: RoadNotesRoute = '/road/note') {
  Haptics.selectionAsync().catch(() => undefined);
  const id = lesson.appointmentId;
  const initial = notes.has(id) ? notes.get(id)! : await loadNotes(lesson);
  const first = lesson.student?.name?.trim().split(/\s+/)[0] ?? null;
  notesEditorStore.set({
    title: 'Note sulla guida',
    subtitle: first ? `La vede anche ${first}` : 'La vede anche l’allievo',
    placeholder: 'Cosa ricordare di questa guida',
    initial: initial ?? '',
    onSave: async (text) => {
      const next = text.trim() || null;
      if (next === (notes.get(id) ?? null)) return true;
      try {
        await regloApi.updateAppointmentDetails(id, { notes: next });
        notes.set(id, next);
        notify();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        return true;
      } catch (err) {
        Alert.alert('Note non salvate', err instanceof Error ? err.message : 'Riprova tra poco.');
        return false;
      }
    },
  });
  router.push(route);
}
