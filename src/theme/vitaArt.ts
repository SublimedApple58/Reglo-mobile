import type { ImageSourcePropType } from 'react-native';

/**
 * Immagini della direzione «D · Mix» (REG-639, approvata da Tiziano il 28/10;
 * piano `plans/design-system/reg-639-vita.md`). Generate con Gemini (blocco
 * STILE §0.4), fondo portato a bianco puro: OPACHE, vanno solo su superfici
 * bianche (card clay, form sheet, pagina). L'ombra morbida di contatto è
 * dentro l'immagine.
 */
export const VITA_ART = {
  calendario: require('../../assets/vita/calendario.png') as ImageSourcePropType,
  volante: require('../../assets/vita/volante.png') as ImageSourcePropType,
  esame: require('../../assets/vita/esame.png') as ImageSourcePropType,
  edificio: require('../../assets/vita/edificio.png') as ImageSourcePropType,
  termometro: require('../../assets/vita/termometro.png') as ImageSourcePropType,
  /** Campanella ambra (set notte 28/10, PNG trasparente). */
  campanella: require('../../assets/vita/campanella.png') as ImageSourcePropType,
  /** Fondo della card «Guida» del foglio «Nuovo» (370×138 pt): auto 3D sopra. */
  cartinaRoad: require('../../assets/vita/cartina-road.jpg') as ImageSourcePropType,
  /** Foto realistica di una sede (Gemini, approvata 28/10): copertina di Disponibilità senza foto vera. */
  sedeFoto: require('../../assets/vita/sede-foto.jpg') as ImageSourcePropType,
};

/**
 * Copertina di Disponibilità quando la sede non ha una foto caricata dal
 * titolare (o non si carica). Tiziano 28/10: una FOTO realistica, non la
 * cartina illustrata.
 */
export const SEDE_COVER_FALLBACK: ImageSourcePropType = VITA_ART.sedeFoto;

/** Saluto in testa all'Agenda: cambia con l'ora (Tiziano 28/10). */
export function greetingFor(date: Date = new Date()): string {
  const h = date.getHours();
  if (h < 13) return 'Buongiorno';
  if (h < 18) return 'Buon pomeriggio';
  return 'Buonasera';
}
