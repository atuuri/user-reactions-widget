// SPDX-License-Identifier: MIT
// Built-in strings. English only for now; fi and sv arrive with M3.

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

const table: Record<string, Strings> = { en };

/** Strings for a `lang` value; unknown languages fall back to English. */
export const strings = (lang?: string): Strings => table[lang || 'en'] || en;
