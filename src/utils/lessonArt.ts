// Shared chooser for the 3D guide illustrations on the student experience.
// One place to decide car vs. moto so the per-screen `require()`s never drift.
// Selection is driven by the license category of the GUIDE's vehicle when known
// (most precise, stays correct for mixed paths), falling back to the student's
// own license category.
//
// NB: pre-coloured 3D icons — never apply `tintColor` in RN.
import { isMotoLicenseCategory } from './license';

/** REG-672: where the car is small it is the web app's car (`assets/web/`). */
const CAR_SMALL = require('../../assets/web/road/cars/auto-34-rosso.png');
/** The web car is 200 px: too soft for the 120+ pt hero, so the hero keeps the mobile art. */
const CAR_HERO = require('../../assets/icons3d-ai/auto.png');
const MOTORCYCLE = require('../../assets/icons3d-ai/moto.png');

/** Small card / list illustration (≤ 72 pt; car vs moto). */
export const lessonArtSource = (licenseCategory?: string | null) =>
  isMotoLicenseCategory(licenseCategory) ? MOTORCYCLE : CAR_SMALL;

/** Hero "prossima guida" and the empty state (120 pt). */
export const heroArtSource = (licenseCategory?: string | null) =>
  isMotoLicenseCategory(licenseCategory) ? MOTORCYCLE : CAR_HERO;
