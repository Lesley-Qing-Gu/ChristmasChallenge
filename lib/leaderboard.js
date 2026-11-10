// Shared leaderboard for Shipmas games (Firebase anonymous auth + Firestore, loaded from the CDN).
// No accounts, no emails: each browser gets a random anonymous id, and players type a display name.
// Scores live at leaderboards/{game}/scores/{uid}; one document per browser, best score only.
import { firebaseConfig } from '../firebase-config.js';

const V = '10.12.2';
export const enabled = !!(firebaseConfig && firebaseConfig.apiKey);

let auth, db, A, F;
if (enabled) {
  const { initializeApp } = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`);
  A = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`);
  F = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`);
  const app = initializeApp(firebaseConfig);
  auth = A.getAuth(app);
  db = F.getFirestore(app);
}

// ---------- names ----------
const NAME_KEY = 'shipmas-name';
const BLOCK = ['fuck', 'shit', 'bitch', 'cunt', 'nigg', 'fag', 'dick', 'cock', 'pussy', 'asshole', 'whore', 'slut', 'rape', 'nazi', 'hitler', '傻逼', '操你', '妈的', '他妈', '屌', '鸡巴'];
export function savedName() { try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; } }
// Returns { name } when it's usable, or { error } explaining why not.
export function checkName(raw) {
  const name = String(raw || '').trim().replace(/\s+/g, ' ');
  if ([...name].length < 2) return { error: 'Name needs at least 2 characters.' };
  if ([...name].length > 16) return { error: 'Name can be 16 characters at most.' };
  if (!/^[\p{L}\p{N} _.\-]+$/u.test(name)) return { error: 'Use letters, numbers, spaces, _ . or - only.' };
  const flat = name.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  if (BLOCK.some(w => flat.includes(w))) return { error: 'Please pick a friendlier name.' };
  return { name };
}

// ---------- identity (anonymous, per browser) ----------
async function me() {
  if (auth.currentUser) return auth.currentUser;
  return (await A.signInAnonymously(auth)).user;
}
export function onUser(cb) { if (!enabled) { cb(null); return () => {}; } return A.onAuthStateChanged(auth, cb); }

// ---------- read ----------
export function watchTop(game, n, cb) {
  const q = F.query(F.collection(db, 'leaderboards', game, 'scores'), F.orderBy('score', 'desc'), F.limit(n));
  return F.onSnapshot(q, s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))), err => cb(null, err));
}

// ---------- write ----------
// Saves the run only if it beats this browser's best.
export async function submit(game, rawName, run) {
  const { name, error } = checkName(rawName);
  if (error) throw Object.assign(new Error(error), { code: 'bad-name' });
  try { localStorage.setItem(NAME_KEY, name); } catch {}
  const user = await me();
  const ref = F.doc(db, 'leaderboards', game, 'scores', user.uid);
  const prev = await F.getDoc(ref);
  const best = prev.exists() ? prev.data().score : -1;
  if (run.score <= best) return { saved: false, best };
  await F.setDoc(ref, {
    name, score: run.score, gifts: run.gifts, meters: run.meters, secs: run.secs,
    updatedAt: F.serverTimestamp(),
  });
  return { saved: true, best: run.score };
}
