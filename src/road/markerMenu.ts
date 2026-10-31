import { ActionSheetIOS, Alert, Platform } from 'react-native';
import { correctRoadMarker } from './roadActions';

/**
 * REG-696: menu nativo per correggere una segnalazione dopo i 5 s
 * dell'«Annulla»: giudizio opposto o cancellazione (con conferma). `onDone`
 * dopo la risposta del server (niente aggiornamento ottimistico).
 */
export function openRoadMarkerMenu(
  sessionId: string,
  marker: { id: string; label: string; sentiment?: 'good' | 'bad' | null },
  onDone: () => void,
) {
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
    ]);

  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: marker.label,
        options: [flipLabel, 'Elimina segnalazione', 'Annulla'],
        destructiveButtonIndex: 1,
        cancelButtonIndex: 2,
        tintColor: '#111111',
      },
      (i) => {
        if (i === 0) void flip();
        else if (i === 1) remove();
      },
    );
    return;
  }
  Alert.alert(marker.label, undefined, [
    { text: flipLabel, onPress: () => void flip() },
    { text: 'Elimina segnalazione', style: 'destructive', onPress: remove },
    { text: 'Annulla', style: 'cancel' },
  ]);
}
