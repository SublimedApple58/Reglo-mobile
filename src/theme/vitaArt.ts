import type { ImageSourcePropType } from 'react-native';

/**
 * Immagini della direzione «D · Mix» (REG-639, approvata da Tiziano il 28/10;
 * piano `plans/design-system/reg-639-vita.md`). Generate con Gemini (blocco
 * STILE §0.4). PNG TRASPARENTI (giro pagamenti 28/10: opache su bianco
 * facevano un quadrato bianco sulla riga premuta): soggetto ritagliato con
 * Vision, il bianco portato ad alfa, così l'ombra morbida di contatto resta
 * come velo grigio semitrasparente e su bianco l'icona è identica a prima.
 */
export const VITA_ART = {
  /**
   * REG-672: icone che esistono già nella web app → stesso PNG (`assets/web/`, design-system §0.9).
   * REG-794: il calendario 3D (`agenda-3d`, con la scritta «JUNE») non si usa più
   * nell'app istruttore/titolare: al suo posto l'orologio 3D (`orologio`).
   */
  volante: require('../../assets/vita/volante.png') as ImageSourcePropType,
  esame: require('../../assets/vita/esame.png') as ImageSourcePropType,
  edificio: require('../../assets/web/settings/sede-autoscuola.png') as ImageSourcePropType,
  /** Malattia: lo sfigmomanometro del web (impostazioni istruttori). */
  termometro: require('../../assets/web/settings/malattia-icon.png') as ImageSourcePropType,
  campanella: require('../../assets/web/menu/bell-3d.png') as ImageSourcePropType,
  /** Fondo della card «Guida» del foglio «Nuovo» (370×138 pt): auto 3D sopra. */
  cartinaRoad: require('../../assets/vita/cartina-road.jpg') as ImageSourcePropType,
  /**
   * Passo 3 «vita ovunque» (Gemini, approvate da Tiziano il 28/10): stella
   * (voto del pagellino) e orologio (ore al volante, Ore di guida). Il
   * pagellino non ha un'icona sua: riusa quella dell'esame.
   */
  stella: require('../../assets/vita/stella.png') as ImageSourcePropType,
  orologio: require('../../assets/vita/orologio.png') as ImageSourcePropType,
  /** REG-802 (Gemini, 27/11): telefono col fumetto ambra, passo «Il tuo numero di cellulare». */
  telefono: require('../../assets/vita/telefono.png') as ImageSourcePropType,
  /** REG-802 giro 2 (Gemini, 27/11): primo accesso normale — «Ciao Sara» (tessera), email (busta), riepilogo (cartellina). */
  tessera: require('../../assets/vita/tessera.png') as ImageSourcePropType,
  busta: require('../../assets/vita/busta.png') as ImageSourcePropType,
  cartellina: require('../../assets/vita/cartellina.png') as ImageSourcePropType,
  /** REG-812 (Gemini, 27/11): lucchetto, passo «Scegli una password» della registrazione. */
  lucchetto: require('../../assets/vita/lucchetto.png') as ImageSourcePropType,
  pagellino: require('../../assets/vita/esame.png') as ImageSourcePropType,
  /**
   * Giro «memorabile» (Gemini, 28/10): salvadanaio = guide da riscuotere
   * (hero di Pagamenti, riga del dettaglio allievo); pieno = tutto saldato.
   */
  salvadanaio: require('../../assets/vita/salvadanaio.png') as ImageSourcePropType,
  salvadanaioPieno: require('../../assets/vita/salvadanaio-pieno.png') as ImageSourcePropType,
  /**
   * REG-784 (Gemini, 24/11): salvadanaio ambra + moneta che ci cade dentro =
   * «crediti finiti / mancano 30 minuti» dell'allievo (`CreditsHero`).
   */
  salvadanaioAmbra: require('../../assets/vita/salvadanaio-ambra.png') as ImageSourcePropType,
  moneta: require('../../assets/vita/moneta.png') as ImageSourcePropType,
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
