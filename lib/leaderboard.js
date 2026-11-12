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
import { NAME_KEY, checkName } from './names.js';
export { savedName, checkName } from './names.js';

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
