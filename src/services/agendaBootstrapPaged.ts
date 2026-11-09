import { regloApi } from './regloApi';
import type { AgendaBootstrapParams, AgendaBootstrapPayload } from '../types/regloApi';

/** Pagine al massimo per una finestra (con 400 righe a pagina = 6.000 impegni). */
const MAX_PAGES = 15;

/**
 * Bootstrap dell'agenda SENZA buchi (09/11/2026). Il server restituisce al
 * massimo `limit` impegni in ordine di inizio: con «Tutti gli istruttori» in
 * un'autoscuola grande la finestra caricata (~6 settimane) li supera e le
 * ultime guide sparivano dalla griglia. Se una pagina torna piena si chiede la
 * successiva a partire dall'ultimo inizio ricevuto (`startsAt >= from` lato
 * server) e si scartano i doppioni. Studenti, istruttori e veicoli vengono
 * dalla prima pagina; i blocchi si uniscono.
 *
 * Gira solo dove l'agenda carica già (montaggio, focus, cambio finestra o di
 * «Le mie / Tutti»): il filtro per istruttore non chiama la rete.
 */
export async function getAgendaBootstrapComplete(params: AgendaBootstrapParams): Promise<AgendaBootstrapPayload> {
  const first = await regloApi.getAgendaBootstrap(params);
  const limit = params.limit;
  if (!limit || first.appointments.length < limit) return first;

  const appointments = [...first.appointments];
  const seen = new Set(appointments.map((a) => a.id));
  const blocks = [...(first.instructorBlocks ?? [])];
  const seenBlocks = new Set(blocks.map((b) => b.id));
  let page = first;
  for (let i = 1; i < MAX_PAGES && page.appointments.length >= limit; i++) {
    const from = page.appointments[page.appointments.length - 1].startsAt;
    page = await regloApi.getAgendaBootstrap({ ...params, from });
    let added = 0;
    for (const a of page.appointments) {
      if (seen.has(a.id)) continue;
      seen.add(a.id);
      appointments.push(a);
      added++;
    }
    for (const b of page.instructorBlocks ?? []) {
      if (seenBlocks.has(b.id)) continue;
      seenBlocks.add(b.id);
      blocks.push(b);
    }
    // Pagina tutta di doppioni (più di `limit` impegni allo stesso orario):
    // niente progressi possibili, ci si ferma.
    if (!added) break;
  }
  return {
    ...first,
    appointments,
    instructorBlocks: blocks,
    meta: { ...first.meta, count: appointments.length },
  };
}
