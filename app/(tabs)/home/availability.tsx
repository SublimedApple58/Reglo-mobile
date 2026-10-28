import { InstructorAvailabilityScreen } from '../../../src/screens/InstructorAvailabilityScreen';

/**
 * Disponibilità dell'istruttore aperta dall'orologio dell'Agenda (REG-639
 * fluidità): vera schermata push dello stack Agenda, quindi con lo swipe
 * indietro nativo. Prima era un salto alla tab nascosta `role/`, senza gesto.
 */
export default function AvailabilityRoute() {
  return <InstructorAvailabilityScreen />;
}
