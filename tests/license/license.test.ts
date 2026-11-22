/**
 * Regola dei mezzi per patente (specchio di reglo/lib/autoscuole/license.ts).
 * REG-507: rimorchi sulla motrice, qualificazioni sul loro mezzo. REG-766: CQC
 * merci su C/C1, CQC persone su D/D1.
 * Esecuzione: `npx -y tsx --test tests/license/*.test.ts`.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  licenseCategoryEligible,
  licenseCategoryShort,
  pathNoun,
  pathPhrase,
  vehicleServesStudent,
} from '../../src/utils/license';

describe('licenseCategoryEligible', () => {
  it('moto: gerarchia AM < A1 < A2 < A', () => {
    assert.equal(licenseCategoryEligible('A1', 'A2'), true);
    assert.equal(licenseCategoryEligible('A', 'A2'), false);
  });

  it('rimorchio sulla motrice, a senso unico', () => {
    assert.equal(licenseCategoryEligible('C', 'CE'), true);
    assert.equal(licenseCategoryEligible('D', 'DE'), true);
    assert.equal(licenseCategoryEligible('B', 'BE'), true);
    assert.equal(licenseCategoryEligible('CE', 'C'), false);
  });

  it('CQC merci su C e C1, mai sull\'autobus', () => {
    assert.equal(licenseCategoryEligible('C', 'CQC'), true);
    assert.equal(licenseCategoryEligible('C1', 'CQC'), true);
    assert.equal(licenseCategoryEligible('D', 'CQC'), false);
  });

  it('CQC persone su D e D1, mai sul camion', () => {
    assert.equal(licenseCategoryEligible('D', 'CQCP'), true);
    assert.equal(licenseCategoryEligible('D1', 'CQCP'), true);
    assert.equal(licenseCategoryEligible('C', 'CQCP'), false);
    assert.equal(licenseCategoryEligible('CQCP', 'D'), false);
  });

  it('ADR solo sul camion C', () => {
    assert.equal(licenseCategoryEligible('C', 'ADR'), true);
    assert.equal(licenseCategoryEligible('C1', 'ADR'), false);
  });

  it('il cambio deve coincidere', () => {
    const autobus = { licenseCategory: 'D', transmission: 'automatic' };
    assert.equal(vehicleServesStudent(autobus, { licenseCategory: 'CQCP', transmission: 'automatic' }), true);
    assert.equal(vehicleServesStudent(autobus, { licenseCategory: 'CQCP', transmission: 'manual' }), false);
  });
});

describe('nomi delle due CQC', () => {
  it('la sigla non va a schermo', () => {
    assert.equal(licenseCategoryShort('CQC'), 'CQC merci');
    assert.equal(licenseCategoryShort('CQCP'), 'CQC persone');
    assert.equal(licenseCategoryShort('B'), 'B');
    assert.equal(licenseCategoryShort(null), '');
  });

  it('«patente» solo sulle patenti vere', () => {
    assert.equal(pathNoun('C'), 'patente C');
    assert.equal(pathNoun('CQCP'), 'CQC persone');
    assert.equal(pathPhrase('B'), 'Patente B');
    assert.equal(pathPhrase('CQC'), 'CQC merci');
  });
});
