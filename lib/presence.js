// Live multiplayer rooms for Shipmas (Firebase anonymous auth + Realtime Database, loaded from the CDN).
// Each visitor writes one small record at presence/{room}/{uid}: position, facing, outfit and name.
// The record is removed automatically when the tab closes or the connection drops.
import { firebaseConfig } from '../firebase-config.js';
import { isFriendly } from './names.js';

const V = '10.12.2';
export const enabled = !!(firebaseConfig && firebaseConfig.apiKey && firebaseConfig.databaseURL);

let auth, db, A, D;
if (enabled) {
  const { initializeApp, getApps } = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`);
  A = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`);
  D = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-database.js`);
  const app = getApps()[0] || initializeApp(firebaseConfig);
  auth = A.getAuth(app);
  db = D.getDatabase(app);
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Number(v) || 0));
const pick = (v, n) => { v = Math.floor(Number(v)); return v >= 0 && v < n ? v : 0; };

// Joins a room. Returns { presence(state), onPeers(cb, onError), peers() }.
// Peers look like { peer: uid, kind: 'viewer', sameTab: bool, presence: state }.
export async function joinRoom(room) {
  if (!enabled) throw new Error('multiplayer is off');
  const user = auth.currentUser || (await A.signInAnonymously(auth)).user;
  const all = D.ref(db, `presence/${room}`);
  const mine = D.child(all, user.uid);
  let peers = [], last = null;

  // (re)announce ourselves every time the connection comes back
  D.onValue(D.ref(db, '.info/connected'), s => {
    if (!s.val()) return;
    D.onDisconnect(mine).remove().then(() => { if (last) D.set(mine, { ...last, ts: D.serverTimestamp() }).catch(() => {}); });
  });

  return {
    presence(st) {
      const name = String(st.n || '').slice(0, 18);
      last = {
        x: clamp(st.x, -40, 60), y: clamp(st.y, -1, 8), z: clamp(st.z, -40, 90), yaw: clamp(st.yaw, -1e4, 1e4),
        n: isFriendly(name) ? name : '',
        t: pick(st.t, 8), p: pick(st.p, 8), s: pick(st.s, 8), c: pick(st.c, 8),
      };
      return D.set(mine, { ...last, ts: D.serverTimestamp() });
    },
    onPeers(cb, onError) {
      D.onValue(all, snap => {
        peers = [];
        snap.forEach(c => { peers.push({ peer: c.key, kind: 'viewer', sameTab: c.key === user.uid, presence: c.val() }); });
        cb({ peers });
      }, err => onError && onError(err));
    },
    peers() { return peers; },
  };
}
