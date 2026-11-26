import React from 'react';

import { IstruttoreHomeScreen } from './IstruttoreHomeScreen';

/**
 * Home del titolare/owner (ruolo OWNER, senza profilo istruttore).
 *
 * È la STESSA Agenda dell'istruttore in modalità `ownerMode`: scope fisso
 * «tutti gli istruttori» (il giorno della scuola), niente FAB. Dal 26/11
 * (REG-794 rilascio 2) agisce sulle guide come sul web: niente più sola lettura.
 * La prima tab del titolare è «Oggi» (`OwnerTodayScreen`).
 *
 * Stesso pattern del `VehiclesScreen` unificato Owner+Instructor.
 */
export const TitolareHomeScreen = () => {
  return <IstruttoreHomeScreen ownerMode />;
};
