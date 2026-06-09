# 003 — Instructor agenda: instant day navigation (window + SWR + prefetch)

## Cosa è stato fatto (riassunto)

Reso "istantanea" la navigazione tra i giorni nella home istruttore
(`src/screens/IstruttoreHomeScreen.tsx`), eliminando lo skeleton + refetch che
scattavano ad **ogni** cambio giorno. Pattern: **finestra di fetch disaccoppiata
dal giorno mostrato + cache TanStack + stale-while-revalidate + prefetch dei
vicini** (i giorni adiacenti vengono già caricati nella finestra).

Precede questo lavoro: dedup cold-start + gate focus + BE limits cached (vedi
git, stessa sessione) e i piani performance 001/002.

## Causa originale

In vista **giorno**, l'effetto che setta `calendarRange` lo restringeva al
singolo giorno selezionato; `loadData` dipendeva da `calendarRange` → ogni
selezione cambiava il range → `rangeKeyRef` diverso → `setRangeLoading(true)` →
skeleton + refetch di quel solo giorno. Nessuna cache per-giorno → tornare su un
giorno già visto rivedeva lo skeleton.

## Soluzione implementata

1. **`loadRange` (stato)**: finestra di fetch generosa `-7 / +21` giorni,
   **disaccoppiata** da `selectedDate`. `loadData` e `bootstrapParams` (hook di
   hydration) usano `loadRange` (limit alzato 280 → 400). `loadData` NON dipende
   più da `calendarRange`.
2. **Recenter effect** (`[selectedDate]`): ricentra `loadRange` solo quando il
   giorno selezionato è entro 1g da un bordo; altrimenti no-op → nessun refetch.
   Vale sia per la vista giorno sia per gli swipe settimana.
3. **Filtro client-side**: `dayAppointments = appointments.filter(isSameDay(selectedDate))`.
   La timeline giorno (`timelineAppointments`, `HOUR_SLOTS`,
   `hasTimelineAppointments`) usa il giorno filtrato. `WeeklyAgendaView` riceve
   l'intera finestra ma filtra già per data esatta della colonna (sicuro).
4. **SWR**: skeleton solo se non c'è nulla da dipingere — `dayGridLoading` (giorno)
   e `appointmentsLoading` (settimana) suppressi quando i dati ci sono già.
5. **Cross-fade**: la View radice della timeline giorno è `Animated.View` con
   opacity (`timelineFadeSV`); su una revalidation in background (finestra
   invariata) `loadData` fa un fade 0.5→1 (220ms). Niente figli aggiunti allo
   ScrollView (evita il footgun gap/sticky).
6. **`calendarRange`** resta = giorno/settimana per `blocksByHour`, malattia,
   flusso prenotazione (invariati).

`appointments` ora contiene la finestra: corretto un punto in vista settimana
(banner esami senza orario) che andava ri-vincolato alla settimana visibile.

## Non fatto (di proposito)

- **Caching per-giorno della disponibilità** (`loadAvailability` rifà ancora per
  giorno): è un overlay leggero (ombreggiatura ore), non blocca la griglia.
  Possibile follow-up con lo stesso pattern a finestra.

## Verifica

`tsc --noEmit` pulito (mobile + BE). Da validare su device/TestFlight i tempi reali
e che la finestra a 4 settimane copra bene gli istruttori più pieni (limit 400).
