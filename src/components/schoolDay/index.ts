/**
 * Giorno della scuola (REG-794). La schermata usa SOLO `SchoolDayView`: per
 * provare un'altra vista (B timeline, C elenco) basta scriverla con le stesse
 * `SchoolDayViewProps` e cambiare l'export qui sotto.
 */
export { SchoolDayColumns as SchoolDayView } from './SchoolDayColumns';
export { SchoolDayStrip } from './SchoolDayStrip';
export { orderInstructors, buildSchoolDay, mondayOf, toDateKey } from './schoolDayModel';
export type { SchoolDayViewProps, SchoolInstructor, SchoolAvailability, AvailWindow } from './types';
