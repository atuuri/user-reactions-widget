// SPDX-License-Identifier: MIT
// Built-in strings for every visible text and label. fi and sv await native-speaker review.

export interface Strings {
  thumbs: string;
  csat: string;
  ces: string;
  up: string;
  down: string;
  /** Word between a scale value and its maximum in button labels: "1 of 5 – …". */
  of: string;
  /** Point labels for each scale, lowest score first. */
  csatPoints: string[];
  cesPoints: string[];
  placeholder: string;
  send: string;
  thanks: string;
}

const en: Strings = {
  thumbs: 'Was this helpful?',
  csat: 'How satisfied are you?',
  ces: 'How easy was this?',
  up: 'Helpful',
  down: 'Not helpful',
  of: 'of',
  csatPoints: ['very dissatisfied', 'dissatisfied', 'neutral', 'satisfied', 'very satisfied'],
  cesPoints: ['very difficult', 'difficult', 'somewhat difficult', 'neither easy nor difficult', 'somewhat easy', 'easy', 'very easy'],
  placeholder: 'Tell us more (optional)',
  send: 'Send',
  thanks: 'Thanks for your feedback',
};

const fi: Strings = {
  thumbs: 'Oliko tästä apua?',
  csat: 'Kuinka tyytyväinen olet?',
  ces: 'Kuinka helppoa tämä oli?',
  up: 'Hyödyllinen',
  down: 'Ei hyödyllinen',
  of: '/',
  csatPoints: ['erittäin tyytymätön', 'tyytymätön', 'neutraali', 'tyytyväinen', 'erittäin tyytyväinen'],
  cesPoints: ['erittäin vaikeaa', 'vaikeaa', 'melko vaikeaa', 'ei helppoa eikä vaikeaa', 'melko helppoa', 'helppoa', 'erittäin helppoa'],
  placeholder: 'Kerro lisää (vapaaehtoinen)',
  send: 'Lähetä',
  thanks: 'Kiitos palautteestasi',
};

const sv: Strings = {
  thumbs: 'Var detta till hjälp?',
  csat: 'Hur nöjd är du?',
  ces: 'Hur enkelt var detta?',
  up: 'Till hjälp',
  down: 'Inte till hjälp',
  of: 'av',
  csatPoints: ['mycket missnöjd', 'missnöjd', 'neutral', 'nöjd', 'mycket nöjd'],
  cesPoints: ['mycket svårt', 'svårt', 'ganska svårt', 'varken lätt eller svårt', 'ganska lätt', 'lätt', 'mycket lätt'],
  placeholder: 'Berätta mer (valfritt)',
  send: 'Skicka',
  thanks: 'Tack för din feedback',
};

export const LANGS: Record<string, Strings> = { en, fi, sv };

/** Built-in language for a `lang` value by its primary subtag (fi-FI → fi); unknown languages fall back to English. */
export const language = (lang?: string): string => {
  const p = (lang || '').trim().toLowerCase().split(/[-_]/)[0];
  return Object.hasOwn(LANGS, p) ? p : 'en';
};

/** Strings for a `lang` value; unknown languages fall back to English. */
export const strings = (lang?: string): Strings => LANGS[language(lang)];
