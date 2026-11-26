import type { ImageSourcePropType } from 'react-native';
import type { TabIconKey } from '../theme/tabIconArt';

/**
 * REG-800 — PNG delle icone della tab bar nativa di iOS, generati da
 * `src/theme/tabIconArt.ts` (`npx tsx scripts/build-tab-icons.ts`).
 * `off` = tratto grigio a riposo, `on` = a colori, accesa.
 */
export const TAB_ICON_PNG: Record<TabIconKey, { off: ImageSourcePropType; on: ImageSourcePropType }> = {
  oggi: { off: require('../../assets/tab-icons/oggi.png'), on: require('../../assets/tab-icons/oggi-on.png') },
  agenda: { off: require('../../assets/tab-icons/agenda.png'), on: require('../../assets/tab-icons/agenda-on.png') },
  road: { off: require('../../assets/tab-icons/road.png'), on: require('../../assets/tab-icons/road-on.png') },
  allievi: { off: require('../../assets/tab-icons/allievi.png'), on: require('../../assets/tab-icons/allievi-on.png') },
  tu: { off: require('../../assets/tab-icons/tu.png'), on: require('../../assets/tab-icons/tu-on.png') },
  home: { off: require('../../assets/tab-icons/home.png'), on: require('../../assets/tab-icons/home-on.png') },
  guide: { off: require('../../assets/tab-icons/guide.png'), on: require('../../assets/tab-icons/guide-on.png') },
  scambi: { off: require('../../assets/tab-icons/scambi.png'), on: require('../../assets/tab-icons/scambi-on.png') },
  quiz: { off: require('../../assets/tab-icons/quiz.png'), on: require('../../assets/tab-icons/quiz-on.png') },
  notifiche: { off: require('../../assets/tab-icons/notifiche.png'), on: require('../../assets/tab-icons/notifiche-on.png') },
};

export type TabIconContext = {
  /** Istruttore, titolare o titolare-istruttore. */
  staffApp: boolean;
  /** Allievo in teoria: la Home è il Quiz. */
  studentTeoria: boolean;
};

/** Quale icona va su una voce della tab bar (stessa scelta su iOS e Android). */
export function tabIconKey(routeName: string, ctx: TabIconContext): TabIconKey {
  switch (routeName) {
    case 'today':
      return 'oggi';
    case 'home':
      return ctx.staffApp ? 'agenda' : ctx.studentTeoria ? 'quiz' : 'home';
    case 'guide':
      return 'guide';
    case 'swaps':
      return 'scambi';
    case 'drive':
      return 'road';
    case 'notes':
      return 'allievi';
    case 'more':
    case 'settings':
      return 'tu';
    case 'quiz':
      return 'quiz';
    case 'inbox':
      return 'notifiche';
    default:
      return 'agenda';
  }
}
