/**
 * Logica pura dell'avviso sui punti critici in guida (`stepHotspotWatch`).
 * Esecuzione: `npm run test:road` (node:test via tsx, niente dipendenze nuove).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  closeHotspotWatch,
  EMPTY_HOTSPOT_WATCH,
  hotspotAtRadius,
  hotspotDistance,
  stepHotspotWatch,
  HOTSPOT_DECIDE_MS,
  type HotspotWatch,
} from '../../src/road/navGuide';
import type { RoadStudentHotspot } from '../../src/types/regloApi';

// Torino; metri per grado di latitudine.
const BASE = { lat: 45.07, lng: 7.68 };
const LAT_M = 111_200;

const hs = (over: Partial<RoadStudentHotspot> = {}): RoadStudentHotspot => ({
  key: 'precedenza~1',
  kind: 'precedenza',
  label: 'Precedenza',
  lat: BASE.lat,
  lng: BASE.lng,
  street: 'Via Roma',
  errors: 2,
  sessions: 2,
  lastAt: '2026-11-10T10:00:00.000Z',
  ...over,
});

/** Un punto a `north` metri a nord e `east` metri a est del centro, al secondo `sec`. */
const at = (north: number, sec: number, east = 0) => ({
  lat: BASE.lat + north / LAT_M,
  lng: BASE.lng + east / (LAT_M * Math.cos((BASE.lat * Math.PI) / 180)),
  t: sec * 1000,
});

/** Percorre i punti in ordine e restituisce lo stato finale. */
function drive(list: RoadStudentHotspot[], pts: Array<ReturnType<typeof at>>, from: HotspotWatch = EMPTY_HOTSPOT_WATCH) {
  return pts.reduce((w, p) => stepHotspotWatch(w, list, p), from);
}

describe('punti critici in guida — due inneschi', () => {
  const point = hs();

  it('avvicinamento a 180 m, poi «Ci sei» entro 40 m nella stessa card', () => {
    let w = drive([point], [at(-170, 0)]);
    assert.equal(w.alert?.phase, 'ahead');
    w = drive([point], [at(-100, 5), at(-38, 10)], w);
    assert.equal(w.alert?.phase, 'at');
    assert.equal(w.seen[point.key].at, true);
  });

  it("passato accanto senza attraversarlo, poi sopra nella stessa guida: avvisa di nuovo", () => {
    // Via parallela a ~80 m: avvicinamento, poi «com'è andata» (come oggi, entro 100 m).
    let w = drive([point], [at(-150, 0, 80), at(-60, 5, 80), at(0, 10, 80), at(60, 12, 80)]);
    assert.equal(w.alert?.phase, 'decide');
    // La card si chiude da sola dopo 20 s.
    w = drive([point], [at(80, 12 + HOTSPOT_DECIDE_MS / 1000 + 1, 80)], w);
    assert.equal(w.alert, null);
    // Giro dell'isolato (sempre entro 150 m) e poi esattamente sopra: nuova card «sopra».
    w = drive([point], [at(100, 40, 40), at(20, 50, 10), at(3, 55)], w);
    assert.equal(w.alert?.phase, 'at');
    assert.equal(w.alert?.hotspot.key, point.key);
  });

  it('nello stesso passaggio niente secondo avvicinamento né secondo «sopra»', () => {
    let w = drive([point], [at(-30, 0)]);
    assert.equal(w.alert?.phase, 'at');
    w = closeHotspotWatch(w, point.key, 2_000);
    // Torna indietro subito: ancora entro 150 m o meno di 45 s → silenzio.
    w = drive([point], [at(-120, 20), at(-10, 30)], w);
    assert.equal(w.alert, null);
  });

  it('riarmo solo oltre 150 m E 45 s dopo la chiusura', () => {
    let w = drive([point], [at(-30, 0)]);
    w = closeHotspotWatch(w, point.key, 1_000);
    // Lontano ma troppo presto: resta disarmato.
    w = drive([point], [at(-200, 30)], w);
    assert.equal(w.seen[point.key].at, true);
    // Lontano e dopo 45 s: riarmato.
    w = drive([point], [at(-200, 47)], w);
    assert.equal(w.seen[point.key].at, false);
    assert.equal(w.seen[point.key].ahead, false);
    // Riavvicinandosi torna l'avvicinamento.
    w = drive([point], [at(-170, 70)], w);
    assert.equal(w.alert?.phase, 'ahead');
  });

  it('cooldown: lo stesso «sopra» non torna prima di 60 s', () => {
    let w = drive([point], [at(0, 0)]);
    assert.equal(w.alert?.phase, 'at');
    // Chiusa subito con la X, via oltre 150 m per più di 45 s.
    w = closeHotspotWatch(w, point.key, 500);
    w = drive([point], [at(-200, 46)], w);
    assert.equal(w.seen[point.key].at, false);
    // Di nuovo sopra a 50 s: dentro il cooldown, niente.
    w = drive([point], [at(0, 50)], w);
    assert.equal(w.alert, null);
    // A 61 s: avvisa.
    w = drive([point], [at(0, 61)], w);
    assert.equal(w.alert?.phase, 'at');
  });

  it('la chiusura dalla schermata segna l’ora (base del riarmo)', () => {
    const w = drive([point], [at(-170, 0)]);
    assert.equal(closeHotspotWatch(w, 'altro', 1), w);
    const closed = closeHotspotWatch(w, point.key, 9_000);
    assert.equal(closed.alert, null);
    assert.equal(closed.seen[point.key].closedAt, 9_000);
  });
});

describe('punti critici in guida — zone', () => {
  // Tratto da 200 m lungo la via, nord-sud, centrato sul punto.
  const zone = hs({
    key: 'precedenza~zona',
    extentM: 200,
    extent: [
      [BASE.lat - 100 / LAT_M, BASE.lng],
      [BASE.lat + 100 / LAT_M, BASE.lng],
    ],
  });

  it('distanza dal tratto e raggio «dentro» di 25 m', () => {
    assert.equal(hotspotAtRadius(zone), 25);
    assert.equal(hotspotAtRadius(hs()), 40);
    assert.equal(hotspotAtRadius(hs({ extentM: 100, extent: null })), 70);
    // A 90 m dal centro ma sul tratto: distanza ~0.
    assert.ok(hotspotDistance(zone, at(90, 0)) < 1);
    // Di lato a 30 m dal tratto.
    assert.ok(Math.abs(hotspotDistance(zone, at(0, 0, 30)) - 30) < 1);
  });

  it('dentro la zona lontano dal centro: avvisa «sopra»', () => {
    const w = drive([zone], [at(90, 0)]);
    assert.equal(w.alert?.phase, 'at');
  });

  it('a 30 m di lato dal tratto: solo avvicinamento', () => {
    const w = drive([zone], [at(0, 0, 30)]);
    assert.equal(w.alert?.phase, 'ahead');
  });

  it("avvicinamento misurato dal capo del tratto, non dal centro", () => {
    // 260 m dal centro ma 160 m dal capo nord del tratto: già in avvicinamento.
    const w = drive([zone], [at(260, 0)]);
    assert.equal(w.alert?.phase, 'ahead');
    assert.ok(Math.abs((w.alert?.meters ?? 0) - 160) < 2);
  });
});
