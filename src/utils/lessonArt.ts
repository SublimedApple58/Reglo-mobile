// Shared chooser for the 3D guide illustrations on the student experience.
// One place to decide car vs. moto so the per-screen `require()`s never drift.
// Selection is driven by the license category of the GUIDE's vehicle when known
// (most precise, stays correct for mixed paths), falling back to the student's
// own license category. Car students (category B) keep the existing artwork.
//
// NB: these are pre-coloured AI 3D icons (design-system §0.4, `assets/icons3d-ai/`)
// — never apply `tintColor` in RN.
import { isMotoLicenseCategory } from './license';

const CAR = require('../../assets/icons3d-ai/auto.png');
const MOTORCYCLE = require('../../assets/icons3d-ai/moto.png');

/** Card / list / empty-state guide illustration (car vs moto). */
export const lessonArtSource = (licenseCategory?: string | null) =>
  isMotoLicenseCategory(licenseCategory) ? MOTORCYCLE : CAR;

/** Hero "prossima guida" illustration (REG-639: same art as the cards, the
 *  Fluent «racing» variant is gone). */
export const heroArtSource = (licenseCategory?: string | null) =>
  isMotoLicenseCategory(licenseCategory) ? MOTORCYCLE : CAR;
