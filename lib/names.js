// Display names for Shipmas: shared by the leaderboards and the multiplayer rooms.
export const NAME_KEY = 'shipmas-name';
const BLOCK = ['fuck', 'shit', 'bitch', 'cunt', 'nigg', 'fag', 'dick', 'cock', 'pussy', 'asshole', 'whore', 'slut', 'rape', 'nazi', 'hitler', '傻逼', '操你', '妈的', '他妈', '屌', '鸡巴'];

export function savedName() { try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; } }

// true unless the name contains a word from the blocklist
export function isFriendly(raw) {
  const flat = String(raw || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  return !BLOCK.some(w => flat.includes(w));
}

// Returns { name } when it's usable, or { error } explaining why not.
export function checkName(raw) {
  const name = String(raw || '').trim().replace(/\s+/g, ' ');
  if ([...name].length < 2) return { error: 'Name needs at least 2 characters.' };
  if ([...name].length > 16) return { error: 'Name can be 16 characters at most.' };
  if (!/^[\p{L}\p{N} _.\-]+$/u.test(name)) return { error: 'Use letters, numbers, spaces, _ . or - only.' };
  if (!isFriendly(name)) return { error: 'Please pick a friendlier name.' };
  return { name };
}
