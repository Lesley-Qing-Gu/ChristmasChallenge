// MöleMe, English edition: a Windows 98 style "slacking terminal".
// Ported from the original React app (github.com/Lesley-Qing-Gu/MoLeMe) to plain JS so it runs without a build step.

const KEY = 'moleme-en-sek';   // new key so everyone starts in SEK
const LEVELS = [
  [0, 'Work Horse'], [300, 'Resourceful Mule'], [1200, 'Office Phantom'],
  [3600, 'Salary Thief'], [10800, 'Grandmaster of Slacking'],
];
const QUESTS = [
  { id: '1', icon: '🙏', title: 'Knock the wooden fish', desc: "Tap the wooden fish 10 times to clear today's boss-induced bad karma." },
  { id: '2', icon: '⏳', title: 'Fake a system update', desc: 'Go full screen with a progress bar and get a coffee, guilt-free.' },
  { id: '3', icon: '🎨', title: 'Doodle on the memo', desc: "Draw a moustache on the boss's top-secret memo." },
  { id: '4', icon: '🧘', title: 'Deep breathing', desc: "Three deep breaths. The money is the company's. Your life is yours." },
  { id: '5', icon: '🚽', title: 'Paid bathroom break', desc: 'Stay in the bathroom for 5+ minutes. Body and soul, both relieved.' },
];
const REMINDERS = [
  'Your boss just bought a new car. Your extra hour of overtime paid for one of the wheels.',
  "If you don't slack today, tomorrow's workload will double anyway.",
  "Slacking isn't laziness. It's an office worker's last bit of dignity.",
  "Go get a glass of water. You've earned it, and it isn't in your KPIs.",
  "You've stared at the screen too long. Look out the window (no window? look at a stressed colleague).",
];
const SUCCESS = [
  'Nice! You just stole back five bucks from the company.',
  "Clocked in. 15% of today's slacking allowance used. Keep it up.",
  'Office hero! You fought the grind with silence.',
];
const CURRENCIES = ['SEK', '€', '$', '£', '¥'];

let S = load();
function load() {
  const base = { salary: 1800, cur: 'SEK', seconds: 0, quests: [] };   // roughly an average Swedish day's pay
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s) return { ...base, ...s }; } catch (e) {}
  return base;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

let os, built = false, slacking = false, active = 'timer', closeCb = null, reminder = REMINDERS[0];
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pick = a => a[Math.floor(Math.random() * a.length)];
const rank = () => LEVELS.reduce((p, l) => (S.seconds >= l[0] ? l[1] : p), LEVELS[0][1]);
const fmt = s => [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map(n => String(n).padStart(2, '0')).join(':');
const earnings = () => (S.salary / 8 / 3600 * S.seconds).toFixed(4);

export function onOSClose(fn) { closeCb = fn; }
let clueCb = null;
export function setOSClue(fn) { clueCb = fn; }
export function openOS() {
  if (!built) build();
  os.hidden = false;
  requestAnimationFrame(() => os.classList.add('on'));
  renderWin();
}
function closeOS() {
  os.classList.remove('on');
  setPanic(false);
  setTimeout(() => { os.hidden = true; if (closeCb) closeCb(); }, 260);
}

function build() {
  built = true;
  os = $('os');
  os.innerHTML = `
    <div class="os-icons">
      ${icon('timer', '💻', 'My Computer')}
      ${icon('quests', '🗂️', 'My Documents')}
      ${icon('muyu', fishIcon(), 'My Inbox')}
      ${icon('recycle', '🗑️', 'Recycle Bin')}
    </div>
    <div id="osWin"></div>
    <button class="os-panic" id="osPanic" aria-label="Boss incoming">Boss<br>incoming</button>
    <div class="os-report" id="osReport" hidden></div>
    <div class="os-update" id="osUpdate" hidden></div>
    <div class="os-toast" id="osToast" hidden></div>
    <div class="os-taskbar">
      <button class="b98 os-start" id="osStart"><span class="flag">Start</span><span id="osStartLbl">Start slacking</span></button>
      <div class="in98 os-ticker"><div id="osTicker"></div></div>
      <div class="in98 os-tray"><span id="osClock"></span></div>
      <button class="b98 os-leave" id="osLeave" title="Back to the desk (Esc)">⏻ Back to desk</button>
    </div>`;
  os.querySelectorAll('.os-icon').forEach(el => el.addEventListener('click', () => { active = el.dataset.win; renderWin(); }));
  $('osStart').addEventListener('click', toggleSlacking);
  $('osLeave').addEventListener('click', closeOS);
  const panic = $('osPanic');
  panic.addEventListener('mouseenter', () => setPanic(true));
  panic.addEventListener('mouseleave', () => setPanic(false));
  panic.addEventListener('click', e => { if (matchMedia('(hover:none)').matches) setPanic($('osReport').hidden); e.preventDefault(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !os.hidden && $('osUpdate').hidden) closeOS(); });
  setInterval(secondTick, 1000);
  setInterval(() => { reminder = pick(REMINDERS); renderTicker(); }, 30000);
  secondTick(); renderTicker();
}

function icon(win, glyph, label) {
  return `<button class="os-icon" data-win="${win}"><span class="g">${glyph}</span><span class="l">${label}</span></button>`;
}
function fishIcon() {
  return `<svg viewBox="0 0 200 160" width="40" height="40"><path d="M40,110 Q30,110 30,90 Q30,50 100,40 Q170,40 170,90 Q170,120 150,130 Q130,140 100,140 Q60,140 40,110" fill="#a66e38" stroke="#5d3a1a" stroke-width="4"/><path d="M170,95 L110,95 Q90,95 85,105 Q80,115 95,120 L160,120" fill="#3d240e"/><rect x="50" y="140" width="100" height="15" fill="#ef4444" stroke="#eab308" stroke-width="2"/></svg>`;
}

function secondTick() {
  if (slacking) { S.seconds++; save(); }
  $('osClock').textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (active === 'timer' && $('tClock')) {
    $('tClock').textContent = fmt(S.seconds);
    $('tEarn').textContent = `${S.cur} ${earnings()}`;
    $('tRank').textContent = rank();
  }
  if (slacking && S.seconds % 15 === 0) renderTicker();
}
function renderTicker() {
  $('osTicker').textContent = `📢 Status: ${slacking ? '🚀 Paid slacking in progress' : '💤 Waiting to grind'}  |  Tip: ${reminder}  |  Rank: ${rank()}`;
}

function toggleSlacking() {
  slacking = !slacking;
  $('osStart').classList.toggle('down', slacking);
  $('osStartLbl').textContent = slacking ? 'Slacking…' : 'Start slacking';
  renderTicker();
  if (slacking) toast(pick(SUCCESS));
}
function toast(msg) {
  const t = $('osToast'); t.textContent = '✨ ' + msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 3000);
}
function complete(id) { if (!S.quests.includes(id)) { S.quests.push(id); save(); } }

// ---------------- windows ----------------
function frame(title, body) {
  return `<div class="w98 os-window"><div class="os-title"><span>${title}</span><button class="b98 x" data-close>×</button></div><div class="os-body">${body}</div></div>`;
}
function renderWin() {
  const host = $('osWin');
  if (!active) { host.innerHTML = ''; return; }
  const views = { timer: viewTimer, quests: viewQuests, muyu: viewFish, recycle: viewRecycle, doodle: viewDoodle };
  host.innerHTML = views[active]();
  host.querySelector('[data-close]').addEventListener('click', () => { active = null; renderWin(); });
  ({ timer: bindTimer, quests: bindQuests, muyu: bindFish, recycle: bindRecycle, doodle: bindDoodle })[active]();
}

function viewTimer() {
  return frame('My Computer - Earnings Report', `
    <div class="in98 white pad timer">
      <p class="cap">Total time slacked</p>
      <p class="lcd in98" id="tClock">${fmt(S.seconds)}</p>
      <div class="row"><span>Paid earnings:</span><b class="earn" id="tEarn">${S.cur} ${earnings()}</b></div>
      <div class="row small"><span>Current rank:</span><span class="w98 rank" id="tRank">${rank()}</span></div>
      <div class="sep"></div>
      <label class="cap" for="tSal">Daily pay (don't lie to yourself):</label>
      <div class="row gap">
        <select id="tCur" class="in98">${CURRENCIES.map(c => `<option${c === S.cur ? ' selected' : ''}>${c}</option>`).join('')}</select>
        <input id="tSal" class="in98" type="number" min="0" value="${S.salary}">
        <button class="b98" id="tOk">OK</button>
      </div>
      <p class="note">*Every minute is roughly one free therapy session.</p>
    </div>`);
}
function bindTimer() {
  const upd = () => { S.salary = Math.max(0, Number($('tSal').value) || 0); S.cur = $('tCur').value; save(); $('tEarn').textContent = `${S.cur} ${earnings()}`; };
  $('tSal').addEventListener('input', upd); $('tCur').addEventListener('change', upd); $('tOk').addEventListener('click', upd);
  $('tSal').addEventListener('keydown', e => e.stopPropagation());
}

function viewQuests() {
  return frame('My Documents - To-do List', `
    <div class="pad quests">
      <h3>Office worker self-care goals</h3>
      ${QUESTS.map(q => `<div class="in98 white quest"><span class="qi">${q.icon}</span><div class="qt"><b>${q.title}</b><small>${q.desc}</small></div>
        <button class="b98${S.quests.includes(q.id) ? ' done' : ''}" data-q="${q.id}">${S.quests.includes(q.id) ? '✓ Done' : 'Go slack'}</button></div>`).join('')}
    </div>`);
}
function bindQuests() {
  $('osWin').querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.q;
    if (id === '1') { active = 'muyu'; renderWin(); }
    else if (id === '2') showUpdate();
    else if (id === '3') { active = 'doodle'; renderWin(); }
    else { complete(id); renderWin(); }
  }));
}

function viewFish() {
  return frame('My Inbox - Merit Received', `
    <div class="in98 fish">
      <div class="prog" id="fProg">Merit: 0/10</div>
      <div class="fishbox" id="fBox">
        <div class="cushion"></div>
        <svg viewBox="0 0 200 160" class="woodfish" id="fSvg">
          <path d="M40,110 Q30,110 30,90 Q30,45 100,35 Q180,45 180,90 Q180,125 150,135 Q125,145 100,145 Q55,145 40,110" fill="#bd804b" stroke="#5d3a1a" stroke-width="4"/>
          <ellipse cx="80" cy="70" rx="30" ry="15" fill="#d4a373" opacity="0.25" transform="rotate(-20 80 70)"/>
          <path d="M180,90 L105,90 Q85,90 80,105 Q75,120 95,125 L165,125" fill="#3d240e" stroke="#2a180a"/>
          <circle cx="60" cy="80" r="4" fill="#3d240e" opacity="0.6"/>
        </svg>
        <div class="mallet" id="fMallet"><i></i><b></b></div>
      </div>
      <p class="count" id="fCount">0</p>
      <p class="motto">No KPIs in your heart, merit comes on its own</p>
    </div>`);
}
function bindFish() {
  let n = 0;
  $('fBox').addEventListener('click', () => {
    n++;
    $('fCount').textContent = n; $('fProg').textContent = `Merit: ${Math.min(n, 10)}/10`;
    $('fSvg').classList.add('hit'); $('fMallet').classList.add('hit');
    setTimeout(() => { $('fSvg')?.classList.remove('hit'); $('fMallet')?.classList.remove('hit'); }, 80);
    const pop = document.createElement('div'); pop.className = 'merit'; pop.textContent = 'Merit +1';
    $('fBox').parentElement.appendChild(pop); setTimeout(() => pop.remove(), 900);
    if (n === 10) { complete('1'); setTimeout(() => { active = 'quests'; renderWin(); }, 1000); }
  });
}

function viewRecycle() {
  return frame('Recycle Bin - Rant Collection Center', `
    <div class="pad recycle">
      <div class="in98 white pad">
        <p class="cap">Rant outlet (sent anonymously to another dimension):</p>
        <textarea id="rText" class="in98" placeholder="Type what you really think about work, KPIs or your boss…"></textarea>
      </div>
      <div class="row"><i class="note">Once tossed, rants are non-refundable.</i><button class="b98 bold" id="rToss" disabled>Crumple &amp; toss</button></div>
      <div class="in98 white files">
        <p class="cap">Deleted items (1)</p>
        <div class="file" id="rFile"><span>📄 clue.txt</span><small>Deleted by: Boss</small><button class="b98" id="rRestore">Restore</button></div>
      </div>
      <div class="bin">🗑️</div>
    </div>`);
}
function bindRecycle() {
  $('rRestore').addEventListener('click', () => {
    $('rFile').innerHTML = `<div class="cluetxt"><b>clue.txt</b><pre>Note to self: delete this before anyone sees it.\n\nThe third letter is   K  ③</pre></div>`;
    if (clueCb) setTimeout(() => clueCb('K'), 600);
  });
  const ta = $('rText'), btn = $('rToss');
  ta.addEventListener('input', () => { btn.disabled = !ta.value.trim(); });
  ta.addEventListener('keydown', e => e.stopPropagation());
  btn.addEventListener('click', () => {
    if (!ta.value.trim()) return;
    ta.classList.add('crumple'); btn.disabled = true;
    setTimeout(() => {
      ta.classList.remove('crumple'); ta.value = '';
      const ball = document.createElement('div'); ball.className = 'paperball';
      $('osWin').querySelector('.recycle').appendChild(ball); setTimeout(() => ball.remove(), 800);
    }, 400);
  });
}

function viewDoodle() {
  return frame('Virtual Doodle Window', `
    <div class="pad doodle">
      <div class="in98 white warn">⚠ Sensitive email from the boss detected. Cover it with scribbles now!</div>
      <div class="in98 white memo">
        <div class="memo-text"><h4>TOP SECRET: KPI REDUCTION PLAN</h4><p>1. Target: cut the department coffee budget by 95%…</p><p>2. Strategy: compulsory weekend overtime, unpaid…</p><p>3. Goal: 300% growth with 0% investment…</p><p class="sig">APPROVED BY: BOSS</p></div>
        <canvas id="dCan" width="360" height="260"></canvas>
      </div>
      <div class="row end"><button class="b98" id="dClear">Clear</button><button class="b98 blue" id="dSave">Save &amp; hide</button></div>
    </div>`);
}
function bindDoodle() {
  const c = $('dCan'), x = c.getContext('2d');
  let on = false;
  const pt = e => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) * c.width / r.width, (e.clientY - r.top) * c.height / r.height]; };
  c.addEventListener('pointerdown', e => { on = true; c.setPointerCapture(e.pointerId); const [a, b] = pt(e); x.beginPath(); x.moveTo(a, b); x.strokeStyle = '#ff0000'; x.lineWidth = 3; x.lineCap = 'round'; x.lineJoin = 'round'; });
  c.addEventListener('pointermove', e => { if (!on) return; const [a, b] = pt(e); x.lineTo(a, b); x.stroke(); });
  const stop = () => { on = false; };
  c.addEventListener('pointerup', stop); c.addEventListener('pointercancel', stop);
  $('dClear').addEventListener('click', () => x.clearRect(0, 0, c.width, c.height));
  $('dSave').addEventListener('click', () => { complete('3'); active = 'quests'; renderWin(); });
}

// ---------------- overlays ----------------
function setPanic(on) {
  const r = $('osReport'); if (!r) return;
  if (on && r.hidden) r.innerHTML = reportHTML();
  r.hidden = !on;
}
function reportHTML() {
  const rows = Array.from({ length: 25 }, (_, i) => `<tr><td>#REF!_${2000 + i}</td><td>Operational Efficiency Optimization</td><td>+${(Math.random() * 10).toFixed(2)}%</td><td>Synthesize cross-platform synergies to leverage incremental ROI.</td><td>STAKEHOLDER_${i}</td></tr>`).join('');
  const charts = [1, 2, 3, 4].map(i => `<div class="kpi"><b>KPI Matrix ${i}</b><div class="cols">${[40, 70, 30, 90, 50, 80].map(h => `<i style="height:${h}%"></i>`).join('')}</div></div>`).join('');
  return `<div class="rep-head"><h1>Q1 2026 Global Growth &amp; Risk Hedging Analysis (Draft)</h1><span>CONFIDENTIAL: internal only</span></div>
    <div class="kpis">${charts}</div>
    <table><thead><tr><th>Index ID</th><th>Core Metrics</th><th>Variance %</th><th>Actionable Insight</th><th>Owner</th></tr></thead><tbody>${rows}</tbody></table>
    <p><b>Executive summary:</b></p>
    <p>By deconstructing and reassembling existing workstreams, we found that synergies show diminishing marginal returns under a decentralised architecture. To achieve sustainable growth, the next phase must deepen closed-loop ecosystem penetration while driving cost collapse through the ABC model. We expect to close the first strategic "efficiency" loop before the end of Q2.</p>`;
}

function showUpdate() {
  const u = $('osUpdate'); u.hidden = false;
  u.innerHTML = `<div class="upd"><h1>Working on updates</h1><p class="pc" id="uPc">0% complete</p><p class="sm">Don't turn off your computer. This will take a while.</p><div class="bar"><i id="uBar"></i></div><div id="uDone"></div></div>`;
  let p = 0, stuck = false;
  const iv = setInterval(() => {
    if (stuck) return;
    if (p >= 99) {
      stuck = true;
      setTimeout(() => {
        clearInterval(iv); p = 100; draw();
        $('uDone').innerHTML = `<p class="ok">✓ System patch installed</p><button class="upd-btn">Done, take me back</button>`;
        $('uDone').querySelector('button').addEventListener('click', () => { u.hidden = true; complete('2'); active = 'quests'; renderWin(); });
      }, 4000);
      return;
    }
    p = Math.min(99, p + (p < 85 ? Math.random() * 4 : Math.random() * 0.4));
    draw();
  }, 400);
  function draw() { $('uPc').textContent = `${Math.floor(p)}% complete`; $('uBar').style.width = p + '%'; }
}
