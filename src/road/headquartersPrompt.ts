/**
 * REG-658: foglio «Manca l'indirizzo della sede» della tab Road. Si apre da
 * solo UNA volta per avvio dell'app quando la sede non ha l'indirizzo
 * (`headquarters: null` in `GET /road/free`). Stato solo in memoria, come
 * `pagellinoPrompt`: al prossimo avvio, se manca ancora, ricompare.
 */
let shown = false;

export const headquartersPrompt = {
  shouldShow: () => !shown,
  markShown: () => {
    shown = true;
  },
};
