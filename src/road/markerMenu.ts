import { ActionSheetIOS, Alert, Platform } from 'react-native';
import { correctRoadMarker } from './roadActions';
import { roadNightNow } from './night';

/**
 * REG-696: menu nativo per correggere una segnalazione dopo i 5 s
 * dell'«Annulla»: giudizio opposto o cancellazione (con conferma). `onDone`
 * dopo la risposta del server (niente aggiornamento ottimistico).
 */
export function openRoadMarkerMenu(
  sessionId: string,
  marker: { id: string; label: string; sentiment?: 'good' | 'bad' | null; note?: string | null; street?: string | null },
  onDone: () => void,
) {
  // Ricca 7: di notte menu e conferme nativi scuri, come i fogli di Road.
  const ui = roadNightNow() ? 'dark' : 'light';
  const toGood = marker.sentiment !== 'good';
  const flipLabel = toGood ? 'Segna come «Fatto bene»' : 'Segna come «Da migliorare»';
  const flip = async () => {
    if (await correctRoadMarker(sessionId, marker.id, { sentiment: toGood ? 'good' : 'bad' })) onDone();
  };
  const remove = () =>
    Alert.alert(`Eliminare «${marker.label}»?`, 'Sparisce dal percorso e dai punti critici.', [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Elimina',
        style: 'destructive',
        onPress: async () => {
          if (await correctRoadMarker(sessionId, marker.id, { remove: true })) onDone();
        },
      },
    ], { userInterfaceStyle: ui });

  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: marker.label,
        // la nota intera (nella riga è troncata)
        message: [marker.street, marker.note].filter(Boolean).join(' · ') || undefined,
        options: [flipLabel, 'Elimina segnalazione', 'Annulla'],
        destructiveButtonIndex: 1,
        cancelButtonIndex: 2,
        tintColor: ui === 'dark' ? '#F2F2F2' : '#111111',
        userInterfaceStyle: ui,
      },
      (i) => {
        if (i === 0) void flip();
        else if (i === 1) remove();
      },
    );
    return;
  }
  Alert.alert(marker.label, [marker.street, marker.note].filter(Boolean).join(' · ') || undefined, [
    { text: flipLabel, onPress: () => void flip() },
    { text: 'Elimina segnalazione', style: 'destructive', onPress: remove },
    { text: 'Annulla', style: 'cancel' },
  ]);
}
