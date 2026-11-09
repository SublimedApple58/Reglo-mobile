/**
 * Prefissi telefonici per il campo telefono (`PhoneField`): paese, nome in
 * italiano e prefisso internazionale. Il valore che parte verso il server è
 * sempre E.164 (`+39…`), come prima: il server lo normalizza comunque
 * (`reglo/lib/phone-e164.ts`).
 */
export type PhoneCountry = { iso: string; name: string; dial: string };

/** In cima al foglio: chi scrive più spesso a un'autoscuola italiana. */
const TOP_ISO = ['IT', 'CH', 'SM', 'RO', 'AL', 'MA', 'UA', 'DE', 'FR', 'ES', 'GB'];

// prettier-ignore
const RAW: Array<[string, string, string]> = [
  ['AF', 'Afghanistan', '93'], ['AL', 'Albania', '355'], ['DZ', 'Algeria', '213'], ['AD', 'Andorra', '376'],
  ['AO', 'Angola', '244'], ['AR', 'Argentina', '54'], ['AM', 'Armenia', '374'], ['AU', 'Australia', '61'],
  ['AT', 'Austria', '43'], ['AZ', 'Azerbaigian', '994'], ['BD', 'Bangladesh', '880'], ['BY', 'Bielorussia', '375'],
  ['BE', 'Belgio', '32'], ['BJ', 'Benin', '229'], ['BO', 'Bolivia', '591'], ['BA', 'Bosnia ed Erzegovina', '387'],
  ['BR', 'Brasile', '55'], ['BG', 'Bulgaria', '359'], ['BF', 'Burkina Faso', '226'], ['KH', 'Cambogia', '855'],
  ['CM', 'Camerun', '237'], ['CA', 'Canada', '1'], ['CV', 'Capo Verde', '238'], ['CL', 'Cile', '56'],
  ['CN', 'Cina', '86'], ['CY', 'Cipro', '357'], ['CO', 'Colombia', '57'], ['KR', 'Corea del Sud', '82'],
  ['CI', "Costa d'Avorio", '225'], ['CR', 'Costa Rica', '506'], ['HR', 'Croazia', '385'], ['CU', 'Cuba', '53'],
  ['DK', 'Danimarca', '45'], ['DO', 'Repubblica Dominicana', '1'], ['EC', 'Ecuador', '593'], ['EG', 'Egitto', '20'],
  ['SV', 'El Salvador', '503'], ['AE', 'Emirati Arabi Uniti', '971'], ['ER', 'Eritrea', '291'], ['EE', 'Estonia', '372'],
  ['ET', 'Etiopia', '251'], ['PH', 'Filippine', '63'], ['FI', 'Finlandia', '358'], ['FR', 'Francia', '33'],
  ['GM', 'Gambia', '220'], ['GE', 'Georgia', '995'], ['DE', 'Germania', '49'], ['GH', 'Ghana', '233'],
  ['JP', 'Giappone', '81'], ['JO', 'Giordania', '962'], ['GR', 'Grecia', '30'], ['GT', 'Guatemala', '502'],
  ['GN', 'Guinea', '224'], ['GW', 'Guinea-Bissau', '245'], ['HN', 'Honduras', '504'], ['HK', 'Hong Kong', '852'],
  ['IN', 'India', '91'], ['ID', 'Indonesia', '62'], ['IR', 'Iran', '98'], ['IQ', 'Iraq', '964'],
  ['IE', 'Irlanda', '353'], ['IS', 'Islanda', '354'], ['IL', 'Israele', '972'], ['IT', 'Italia', '39'],
  ['KZ', 'Kazakistan', '7'], ['KE', 'Kenya', '254'], ['XK', 'Kosovo', '383'], ['KW', 'Kuwait', '965'],
  ['KG', 'Kirghizistan', '996'], ['LV', 'Lettonia', '371'], ['LB', 'Libano', '961'], ['LR', 'Liberia', '231'],
  ['LY', 'Libia', '218'], ['LI', 'Liechtenstein', '423'], ['LT', 'Lituania', '370'], ['LU', 'Lussemburgo', '352'],
  ['MK', 'Macedonia del Nord', '389'], ['MG', 'Madagascar', '261'], ['MY', 'Malesia', '60'], ['ML', 'Mali', '223'],
  ['MT', 'Malta', '356'], ['MA', 'Marocco', '212'], ['MR', 'Mauritania', '222'], ['MU', 'Mauritius', '230'],
  ['MX', 'Messico', '52'], ['MD', 'Moldavia', '373'], ['MC', 'Monaco', '377'], ['MN', 'Mongolia', '976'],
  ['ME', 'Montenegro', '382'], ['MZ', 'Mozambico', '258'], ['MM', 'Myanmar', '95'], ['NP', 'Nepal', '977'],
  ['NI', 'Nicaragua', '505'], ['NE', 'Niger', '227'], ['NG', 'Nigeria', '234'], ['NO', 'Norvegia', '47'],
  ['NZ', 'Nuova Zelanda', '64'], ['NL', 'Paesi Bassi', '31'], ['PK', 'Pakistan', '92'], ['PS', 'Palestina', '970'],
  ['PA', 'Panama', '507'], ['PY', 'Paraguay', '595'], ['PE', 'Perù', '51'], ['PL', 'Polonia', '48'],
  ['PT', 'Portogallo', '351'], ['QA', 'Qatar', '974'], ['GB', 'Regno Unito', '44'], ['CZ', 'Repubblica Ceca', '420'],
  ['RO', 'Romania', '40'], ['RU', 'Russia', '7'], ['SM', 'San Marino', '378'], ['SA', 'Arabia Saudita', '966'],
  ['SN', 'Senegal', '221'], ['RS', 'Serbia', '381'], ['SL', 'Sierra Leone', '232'], ['SG', 'Singapore', '65'],
  ['SY', 'Siria', '963'], ['SK', 'Slovacchia', '421'], ['SI', 'Slovenia', '386'], ['SO', 'Somalia', '252'],
  ['ES', 'Spagna', '34'], ['LK', 'Sri Lanka', '94'], ['US', 'Stati Uniti', '1'], ['ZA', 'Sudafrica', '27'],
  ['SD', 'Sudan', '249'], ['SE', 'Svezia', '46'], ['CH', 'Svizzera', '41'], ['TW', 'Taiwan', '886'],
  ['TZ', 'Tanzania', '255'], ['TH', 'Thailandia', '66'], ['TG', 'Togo', '228'], ['TN', 'Tunisia', '216'],
  ['TR', 'Turchia', '90'], ['UA', 'Ucraina', '380'], ['UG', 'Uganda', '256'], ['HU', 'Ungheria', '36'],
  ['UY', 'Uruguay', '598'], ['UZ', 'Uzbekistan', '998'], ['VA', 'Città del Vaticano', '379'], ['VE', 'Venezuela', '58'],
  ['VN', 'Vietnam', '84'], ['YE', 'Yemen', '967'], ['ZM', 'Zambia', '260'], ['ZW', 'Zimbabwe', '263'],
];

export const PHONE_COUNTRIES: PhoneCountry[] = RAW.map(([iso, name, dial]) => ({ iso, name, dial })).sort((a, b) =>
  a.name.localeCompare(b.name, 'it'),
);

const BY_ISO = new Map(PHONE_COUNTRIES.map((c) => [c.iso, c]));
export const TOP_COUNTRIES: PhoneCountry[] = TOP_ISO.map((iso) => BY_ISO.get(iso)!);
export const ITALY = BY_ISO.get('IT')!;
export const countryByIso = (iso: string) => BY_ISO.get(iso) ?? ITALY;

/** Bandierina emoji dal codice ISO (lettere regionali Unicode). */
export const flagOf = (iso: string) =>
  String.fromCodePoint(...[...iso.toUpperCase()].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));

/** Dove lo stesso prefisso vale per più paesi, quale si sceglie leggendolo. */
const DIAL_PREFERRED: Record<string, string> = { '1': 'US', '7': 'RU', '39': 'IT' };

/** `+41…` / `0041…` → paese e numero nazionale. `null` se non c'è un prefisso. */
export function splitInternational(raw: string): { country: PhoneCountry; national: string } | null {
  let v = raw.trim().replace(/[\s.\-()]/g, '');
  if (v.startsWith('00')) v = `+${v.slice(2)}`;
  if (!v.startsWith('+')) return null;
  const digits = v.slice(1).replace(/\D/g, '');
  for (let len = 4; len >= 1; len--) {
    const dial = digits.slice(0, len);
    const iso = DIAL_PREFERRED[dial] ?? PHONE_COUNTRIES.find((c) => c.dial === dial)?.iso;
    if (iso) return { country: countryByIso(iso), national: digits.slice(len) };
  }
  return null;
}

/** Il campo contiene un'email (o sta per diventarlo): niente prefisso. */
export const looksLikeEmail = (text: string) => /[^\d\s+().\-]/.test(text);

/**
 * Numero nazionale + paese → E.164. In Italia (e a San Marino e in Vaticano)
 * lo zero iniziale fa parte del numero; altrove è il prefisso di linea
 * nazionale e con il prefisso internazionale cade (es. Svizzera 079… → +4179…).
 */
export function toE164(country: PhoneCountry, national: string): string {
  let digits = national.replace(/\D/g, '');
  if (!['IT', 'SM', 'VA'].includes(country.iso)) digits = digits.replace(/^0+/, '');
  return `+${country.dial}${digits}`;
}

/** Cifre nazionali significative (per abilitare «Continua»). */
export const nationalDigits = (national: string) => national.replace(/\D/g, '').length;
