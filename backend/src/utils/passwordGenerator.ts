/**
 * Generate a "medium complexity" password for admin-issued credentials.
 *
 * Goal: easy to read out / paste in an email but still hard to guess.
 * Format: <Word><Word><2-digit number><symbol>  e.g. `BrightTiger47!`.
 *
 * Used by:
 *   - POST /api/admin/leads/:id/convert  (issue creds for an access request)
 *   - POST /api/admin/users/:id/reset-password
 */

import crypto from 'crypto';

const ADJECTIVES = [
  'Bright', 'Swift', 'Calm', 'Bold', 'Clever', 'Lively', 'Sharp', 'Steady',
  'Quick', 'Royal', 'Sunny', 'Brave', 'Cosmic', 'Eager', 'Noble', 'Witty',
  'Vivid', 'Mellow', 'Lucky', 'Rapid',
];

const NOUNS = [
  'Tiger', 'Falcon', 'Comet', 'River', 'Mango', 'Panda', 'Pearl', 'Quartz',
  'Cobra', 'Orbit', 'Maple', 'Otter', 'Lotus', 'Raven', 'Stork', 'Heron',
  'Coral', 'Cedar', 'Pixel', 'Echo',
];

const SYMBOLS = ['!', '@', '#', '$', '%', '&', '*'];

const pick = <T>(arr: T[]): T => arr[crypto.randomInt(0, arr.length)];

export function generateMediumPassword(): string {
  const word1 = pick(ADJECTIVES);
  const word2 = pick(NOUNS);
  const num = String(crypto.randomInt(10, 100)); // always 2 digits
  const sym = pick(SYMBOLS);
  return `${word1}${word2}${num}${sym}`;
}
