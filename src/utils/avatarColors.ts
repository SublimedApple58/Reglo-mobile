/**
 * Colori del cerchio a iniziali degli allievi (tab Allievi, Road): ricavati
 * dall'id, così lo stesso allievo ha sempre lo stesso colore ovunque.
 */
const AVATAR_BG = ['#EBEBEB', '#EBEBEB', '#DCFCE7', '#F1F1F1', '#FFEDD5', '#CCFBF1', '#FEE2E2', '#F2F2F2'];
const AVATAR_FG = ['#000000', '#111111', '#15803D', '#6D28D9', '#C2410C', '#0F766E', '#B91C1C', '#595959'];

const hashStr = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

export const avatarColors = (id: string) => {
  const i = hashStr(id) % AVATAR_BG.length;
  return { bg: AVATAR_BG[i], fg: AVATAR_FG[i] };
};
