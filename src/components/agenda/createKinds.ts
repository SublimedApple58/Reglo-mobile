import type { ImageSourcePropType } from 'react-native';

import type { AgendaCreateKind } from '../WeeklyAgendaView';
import { VITA_ART } from '../../theme/vitaArt';
import { car34Art } from '../../road/markerArt';

/**
 * Tipi creabili dal blocco fantasma dell'Agenda (REG-671, rifatto il
 * 05/11/2026): nome, riga di spiegazione e oggetto 3D (barra «Guida ⌄» e
 * foglio «Cosa vuoi creare?»), più la tinta della bozza sulla griglia.
 */
const PERSONE_ART = require('../../../assets/icons3d-ai/persone.png') as ImageSourcePropType;

export const CREATE_LABEL: Record<AgendaCreateKind, string> = {
  lesson: 'Guida',
  group: 'Di gruppo',
  exam: 'Esame',
  theory: 'Teoria',
  block: 'Blocca',
};

export const CREATE_KIND_HINT: Record<AgendaCreateKind, string> = {
  lesson: 'Con un allievo',
  group: 'Più allievi, stesso orario',
  exam: 'Accompagni gli allievi alla prova',
  theory: 'Lezione in sede, in aula',
  block: 'Nessuno può prenotare l’orario',
};

export const createArt = (kind: AgendaCreateKind, carColor: string | null | undefined): ImageSourcePropType => {
  switch (kind) {
    case 'lesson': return car34Art(carColor ?? 'rosso');
    case 'group': return PERSONE_ART;
    case 'exam': return VITA_ART.esame;
    case 'theory': return VITA_ART.edificio;
    default: return VITA_ART.calendario;
  }
};

/**
 * Bozza sulla griglia (anteprima W1 approvata): velo nella tinta del tipo,
 * contorno sottile, pallini bianchi bordati. Preso in mano il velo si riempie
 * e il contorno si scurisce. Guida = giallo delle guide; gruppo = verde foglia
 * dei gruppi; esame, teoria e blocco = neutri come i loro blocchi.
 */
export type DraftLook = { fill: string; fillLive: string; ring: string; ringLive: string; dot: string; glow: string };

const AMBER: DraftLook = {
  fill: 'rgba(252,239,199,0.55)', fillLive: 'rgba(252,239,199,0.85)',
  ring: 'rgba(214,150,20,0.65)', ringLive: 'rgba(214,150,20,0.9)',
  dot: '#D99A1E', glow: 'rgba(214,140,10,0.3)',
};
const LEAF: DraftLook = {
  fill: 'rgba(213,237,225,0.6)', fillLive: 'rgba(213,237,225,0.9)',
  ring: 'rgba(47,163,107,0.6)', ringLive: 'rgba(47,163,107,0.85)',
  dot: '#2FA36B', glow: 'rgba(47,163,107,0.28)',
};
const NEUTRAL: DraftLook = {
  fill: 'rgba(17,17,17,0.03)', fillLive: 'rgba(17,17,17,0.06)',
  ring: 'rgba(17,17,17,0.32)', ringLive: 'rgba(17,17,17,0.55)',
  dot: '#3A3A3C', glow: 'rgba(17,17,17,0.16)',
};

export const draftLook = (kind: AgendaCreateKind): DraftLook =>
  kind === 'lesson' ? AMBER : kind === 'group' ? LEAF : NEUTRAL;
