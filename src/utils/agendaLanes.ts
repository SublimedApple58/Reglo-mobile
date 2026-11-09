/**
 * Agenda «Tutti gli istruttori» (09/11/2026) — corsie affiancate nella colonna
 * di un giorno della griglia settimanale.
 *
 * Gli impegni che si sovrappongono davvero (orari reali, non l'altezza minima
 * disegnata) formano un gruppo; dentro il gruppo ognuno prende la prima corsia
 * libera e tutti dividono la colonna in parti uguali, come il calendario iOS.
 * Se le corsie non stanno nella colonna (`maxLanes`), l'ultima diventa la
 * cella «+N» con gli impegni che restano fuori: il tocco apre la lista della
 * fascia.
 */

export type LaneItem = { key: string; start: number; end: number };

export type LanePlace = {
  /** Corsia (0 = la più a sinistra) fra le `lanes` visibili del gruppo. */
  lane: number;
  lanes: number;
};

export type LaneOverflow = {
  /** Corsia della cella «+N» (l'ultima visibile). */
  lane: number;
  lanes: number;
  start: number;
  end: number;
  /** Impegni nascosti dietro la cella. */
  hidden: string[];
  /** Tutti gli impegni del gruppo, in ordine di inizio: la lista del foglio. */
  all: string[];
};

export type LaneLayout = {
  /** Impegni visibili; quelli nascosti dietro «+N» non ci sono. */
  places: Map<string, LanePlace>;
  overflows: LaneOverflow[];
};

export function layoutLanes(items: LaneItem[], maxLanes: number): LaneLayout {
  const cap = Math.max(1, Math.floor(maxLanes));
  const sorted = items
    .filter((i) => i.end > i.start)
    .sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start) || a.key.localeCompare(b.key));
  const places = new Map<string, LanePlace>();
  const overflows: LaneOverflow[] = [];

  let group: Array<{ item: LaneItem; lane: number }> = [];
  let laneEnds: number[] = [];
  let groupEnd = -Infinity;

  const flush = () => {
    if (!group.length) return;
    const lanes = laneEnds.length;
    if (lanes <= cap) {
      for (const g of group) places.set(g.item.key, { lane: g.lane, lanes });
    } else {
      // Le prime `cap - 1` corsie restano, l'ultima raccoglie il resto.
      const keep = cap - 1;
      const hidden = group.filter((g) => g.lane >= keep);
      for (const g of group) if (g.lane < keep) places.set(g.item.key, { lane: g.lane, lanes: cap });
      overflows.push({
        lane: keep,
        lanes: cap,
        start: Math.min(...hidden.map((h) => h.item.start)),
        end: Math.max(...hidden.map((h) => h.item.end)),
        hidden: hidden.map((h) => h.item.key),
        all: group.map((g) => g.item.key),
      });
    }
    group = [];
    laneEnds = [];
  };

  for (const item of sorted) {
    if (item.start >= groupEnd) {
      flush();
      groupEnd = -Infinity;
    }
    let lane = laneEnds.findIndex((end) => end <= item.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.end);
    } else {
      laneEnds[lane] = item.end;
    }
    group.push({ item, lane });
    groupEnd = Math.max(groupEnd, item.end);
  }
  flush();
  return { places, overflows };
}

/** «Mario Rossi» → «MR»; un nome solo → le prime due lettere. */
export function instructorInitials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toLocaleUpperCase('it');
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toLocaleUpperCase('it');
}

/** «Mario Rossi» → «Mario R.» (riga dell'istruttore nelle colonne larghe). */
export function instructorShortName(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] ?? '';
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}
