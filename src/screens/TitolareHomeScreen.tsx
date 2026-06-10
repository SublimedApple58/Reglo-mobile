import React from 'react';

import { IstruttoreHomeScreen } from './IstruttoreHomeScreen';

/**
 * Home del titolare/owner (ruolo OWNER, senza profilo istruttore).
 *
 * È la STESSA home dell'istruttore — stesso itinerario Airbnb, stessa vista
 * settimana "controllo in parole", stessi chip/header/day-detail — riusata in
 * modalità `ownerMode`: SOLA LETTURA (niente FAB, niente prenotazione/band,
 * niente azioni mutanti sulle guide) e scope fisso "tutti gli istruttori"
 * (l'agenda mostra le guide di tutta la scuola, non di un singolo istruttore).
 *
 * Stesso pattern del `VehiclesScreen` unificato Owner+Instructor.
 */
export const TitolareHomeScreen = () => {
  return <IstruttoreHomeScreen ownerMode />;
};
