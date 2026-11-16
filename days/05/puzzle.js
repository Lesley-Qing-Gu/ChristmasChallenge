// The desk puzzle: four letters hidden around the desk open the locked top drawer.
//   ① ② ③ ④: see the clue spots in desk.js, books.js and moleme.js
// kept out of plain sight so a quick look at the source doesn't spoil it
export const ANSWER = atob('QUtJRg==').split('').reverse().join('');
const KEY = 'moleme-puzzle';
const HINTS = {
  F: 'Pop every single bubble on the bubble wrap.',
  I: 'Read "The Art of Looking Busy". Someone made notes in the margin.',
  K: 'Clock in on the computer and look in the Recycle Bin.',
  A: 'Light all four advent candles.',
};
const NUM = { F: '①', I: '②', K: '③', A: '④' };

let S = load();
function load() {
  const base = { found: [], start: Date.now(), solvedIn: null };
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && Array.isArray(s.found)) return { ...base, ...s }; } catch (e) {}
  return base;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

const listeners = [];
export const onChange = fn => { listeners.push(fn); fn(S); };
const emit = () => listeners.forEach(fn => fn(S));
export const state = () => S;
export const isSolved = () => S.solvedIn != null;
export const has = l => S.found.includes(l);

/* ---------- a small card overlay used for every puzzle moment ---------- */
let card;
function show(html, cls = '') {
  if (!card) {
    card = document.createElement('div'); card.id = 'fcard'; card.hidden = true;
    card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true');
    document.body.appendChild(card);
    card.addEventListener('click', e => { if (e.target === card) hide(); });
    addEventListener('keydown', e => { if (!card.hidden && e.key === 'Escape') { e.stopPropagation(); hide(); } }, true);
  }
  card.innerHTML = `<div class="fc ${cls}">${html}<button class="fc-x" aria-label="Close">×</button></div>`;
  card.querySelector('.fc-x').addEventListener('click', hide);
  card.hidden = false; requestAnimationFrame(() => card.classList.add('on'));
  return card.querySelector('.fc');
}
function hide() { if (!card) return; card.classList.remove('on'); setTimeout(() => { card.hidden = true; }, 180); }

const tiles = () => ANSWER.split('').map(l => `<span class="tile${has(l) ? ' got' : ''}">${has(l) ? l : '?'}<i>${NUM[l]}</i></span>`).join('');
const fmt = ms => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

/* ---------- finding a letter ---------- */
export function found(letter) {
  if (has(letter)) return false;
  S.found.push(letter); save(); emit();
  const left = ANSWER.length - S.found.length;
  show(`<p class="fc-k">You found a letter</p><div class="big">${letter}<i>${NUM[letter]}</i></div>
    <div class="tiles">${tiles()}</div>
    <p>${left ? `${left} more hidden on the desk. The number tells you where it goes.` : 'That was the last one. Now find the lock.'}</p>`, 'found');
  return true;
}

/* ---------- the sticky note on the monitor ---------- */
export function showRiddle() {
  show(`<div class="note"><p class="fc-k">A sticky note</p>
    <p class="riddle">“Every Swede takes me twice a day.<br>Nobody calls it slacking.<br>What am I?”</p>
    <p class="small">P.S. Four letters are hidden on this desk. The answer opens the locked drawer.</p></div>
    <div class="tiles">${tiles()}</div>`, 'paper');
}

/* ---------- the letter lock on the top drawer ---------- */
export function showLock(onOpen) {
  if (isSolved()) { onOpen(); return; }
  const el = show(`<p class="fc-k">Top drawer · locked</p><h3>Enter the 4-letter code</h3>
    <div class="dials">${[0, 1, 2, 3].map(i => `<input class="dial" maxlength="1" inputmode="text" autocomplete="off" aria-label="Letter ${i + 1}" data-i="${i}">`).join('')}</div>
    <p class="msg" aria-live="polite">&nbsp;</p>
    <div class="row"><button class="hint">Hint</button><button class="go">Unlock</button></div>`, 'lock');
  const dials = [...el.querySelectorAll('.dial')];
  dials.forEach((d, i) => {
    d.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Backspace' && !d.value && i) dials[i - 1].focus();
      if (e.key === 'Enter') tryIt();
    });
    d.addEventListener('input', () => { d.value = d.value.replace(/[^a-zåäö]/gi, '').toUpperCase().slice(-1); if (d.value && i < 3) dials[i + 1].focus(); });
  });
  dials[0].focus();
  el.querySelector('.go').addEventListener('click', tryIt);
  el.querySelector('.hint').addEventListener('click', () => {
    const next = ANSWER.split('').find(l => !has(l));
    el.querySelector('.msg').textContent = next ? `${NUM[next]} ${HINTS[next]}` : 'You have all four letters. Read them in order: ① ② ③ ④.';
  });
  function tryIt() {
    const code = dials.map(d => d.value).join('');
    if (code === ANSWER) {
      S.solvedIn = Date.now() - S.start; save(); emit();
      hide(); setTimeout(onOpen, 200);
    } else {
      el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
      el.querySelector('.msg').textContent = code.length < 4 ? 'Four letters, please.' : 'Click. Nope. Maybe have a coffee and think again?';
    }
  }
}

/* ---------- the prize ---------- */
export function showCertificate() {
  const t = fmt(S.solvedIn || 0);
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const no = String((S.start % 900000) + 100000);
  const share = `I cracked the secret code on the MöleMe desk (Shipmas Day 5) in ${t} ☕🌀 https://lesley-qing-gu.github.io/ChristmasChallenge/days/05/`;
  // a kanelbulle on a gold wax seal with ribbon tails
  const seal = `<svg class="seal" viewBox="0 0 120 150" aria-hidden="true">
    <path d="M38 78 22 146l20-12 12 16 10-60zM82 78l16 68-20-12-12 16-10-60z" fill="#b5121b"/><path d="M38 78 22 146l20-12M82 78l16 68-20-12" fill="none" stroke="#7e0c13" stroke-width="1.5"/>
    <g transform="translate(60 60)">${[...Array(24)].map((_, i) => { const a = i * Math.PI / 12; return `<circle cx="${(Math.cos(a) * 46).toFixed(1)}" cy="${(Math.sin(a) * 46).toFixed(1)}" r="9" fill="#c99a52"/>`; }).join('')}
      <circle r="46" fill="#c99a52"/><circle r="38" fill="none" stroke="#a87b36" stroke-width="2" stroke-dasharray="2 3"/>
      <path d="M0 0m-3 0a3 3 0 1 1 6 0a8 8 0 1 1-14 1a13 13 0 1 1 23-2a18 18 0 1 1-30 4" fill="none" stroke="#7a4a1c" stroke-width="5" stroke-linecap="round"/>
      ${[[-10,-12],[8,-14],[14,4],[-14,8],[2,12]].map(([x,y]) => `<rect x="${x}" y="${y}" width="3" height="3" fill="#fffaf0"/>`).join('')}
    </g></svg>`;
  const el = show(`<div class="paper">
      <div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div>
      <p class="ck">Certificate of Achievement</p>
      <p class="lead">This certifies that <em>you</em> are a</p>
      <h2>Certified Professional Slacker</h2>
      <div class="rule"><span>✦</span></div>
      <p class="lead">for cracking the secret code</p>
      <div class="stamp">${ANSWER.split('').map(l => `<span>${l}</span>`).join('')}</div>
      <p class="def">a coffee break, taken together, on purpose. In Sweden it is practically a workplace right.</p>
      <div class="foot">
        <dl><div><dt>Solved in</dt><dd>${t}</dd></div><div><dt>Date</dt><dd>${date}</dd></div><div><dt>No.</dt><dd>MÖ-${no}</dd></div></dl>
        ${seal}
        <div class="sign"><span class="sig">The Boss</span><span class="line"></span><small>The Boss (reluctantly)</small></div>
      </div>
    </div>
    <div class="row"><button class="copy">Copy my result</button><button class="again">Play again</button></div>`, 'certificate');
  el.querySelector('.copy').addEventListener('click', e => {
    const b = e.currentTarget;
    (navigator.clipboard ? navigator.clipboard.writeText(share) : Promise.reject()).then(() => { b.textContent = 'Copied!'; }, () => { b.textContent = 'Copy failed'; });
  });
  el.querySelector('.again').addEventListener('click', () => { S = { found: [], start: Date.now(), solvedIn: null }; save(); emit(); hide(); location.reload(); });
}
export function solvedToast() { return `Solved in ${fmt(S.solvedIn || 0)}`; }
