// SPDX-License-Identifier: MIT
// Built-in strings. M1 ships English only; fi and sv arrive with M2.

export interface Strings {
  thumbs: string;
  up: string;
  down: string;
  placeholder: string;
  send: string;
  thanks: string;
}

const en: Strings = {
  thumbs: 'Was this helpful?',
  up: 'Helpful',
  down: 'Not helpful',
  placeholder: 'Tell us more (optional)',
  send: 'Send',
  thanks: 'Thanks for your feedback',
};

const table: Record<string, Strings> = { en };

/** Strings for a `lang` value; unknown languages fall back to English. */
export const strings = (lang?: string): Strings => table[lang || 'en'] || en;
