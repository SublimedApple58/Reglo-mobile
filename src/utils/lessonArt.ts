// Shared chooser for the 3D guide illustrations on the student experience.
// One place to decide car vs. moto so the per-screen `require()`s never drift.
// Selection is driven by the license category of the GUIDE's vehicle when known
// (most precise, stays correct for mixed paths), falling back to the student's
// own license category. Car students (category B) keep the existing artwork.
//
// NB: these are pre-coloured Fluent 3D assets — never apply `tintColor` in RN.
import { isMotoLicenseCategory } from './license';

const CAR = require('../../assets/icons/fluent-car.png');
const RACING = require('../../assets/icons/fluent-racing.png');
const MOTORCYCLE = require('../../assets/icons/fluent-motorcycle.png');

/** Card / list / empty-state guide illustration (car vs moto). */
export const lessonArtSource = (licenseCategory?: string | null) =>
  isMotoLicenseCategory(licenseCategory) ? MOTORCYCLE : CAR;

/** Hero "prossima guida" illustration. Car students get the racing variant;
 *  there is no racing-moto asset, so moto students get the standard moto. */
export const heroArtSource = (licenseCategory?: string | null) =>
  isMotoLicenseCategory(licenseCategory) ? MOTORCYCLE : RACING;
