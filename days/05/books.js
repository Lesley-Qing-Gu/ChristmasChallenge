// The books on the desk, and a small two-page reader to read them in.
// Five are original and short. "A Christmas Carol" is Charles Dickens (1843, public domain): the opening of Stave One.

export const BOOKS = [
  {
    title: 'The Art of Looking Busy', author: 'Anonymous Employee', spine: '#f3f1ec', ink: '#1f1f1f', cover: '#1f1f1f',
    pages: [
      ['Chapter 1', 'Always carry a piece of paper. A person walking with a piece of paper is going somewhere important. A person walking without one is going to the kitchen.'],
      ['Chapter 2', 'Sigh audibly every forty minutes. Not too loud. Just loud enough that people think: wow, that is a lot of responsibility.'],
      ['Chapter 3', 'Keep a spreadsheet open at all times. It does not matter which spreadsheet. Nobody has ever checked.', 'I'],
      ['Chapter 4', 'When someone asks how it is going, say "it\'s a lot right now." This is true of everything, always, for everyone.'],
      ['Chapter 5', 'Type fast when the boss walks past. What you type is between you and your keyboard.'],
      ['Epilogue', 'Looking busy is a full-time job. Which is why you never have time for the other one.'],
    ],
  },
  {
    title: 'Deep Work, Shallow Nap', author: 'Someone Very Tired', spine: '#1f1f1f', ink: '#f3f1ec', cover: '#2b2b2b',
    pages: [
      ['Foreword', 'This book was going to be about focus. Then I checked my phone.'],
      ['Part I · Deep work', 'Close every tab. Silence every notification. Sit in perfect stillness until the work begins.'],
      ['Part I, continued', 'The work has not begun. The stillness, however, is very nice.'],
      ['Part II · Shallow nap', 'Twenty minutes, eyes closed, chin resting on one hand so it looks like thinking. Researchers call this "strategic reflection".'],
      ['Part III · Results', 'Output: none. Mood: excellent. Sleep debt: slightly repaid.'],
      ['Afterword', 'If you have read this far, you have done more deep work than the author. Congratulations. Take a nap.'],
    ],
  },
  {
    title: 'Meetings That Could Have Been Emails', author: 'A. Calendar', spine: '#f3f1ec', ink: '#c8102e', cover: '#c8102e',
    pages: [
      ['Meeting 1 · 09:00', 'Twelve people gathered to agree that they would send an email.'],
      ['Meeting 2 · 10:30', 'A "quick sync". It was not quick. Nobody synced.'],
      ['Meeting 3 · 13:00', 'The pre-meeting, to prepare for the 14:00 meeting, which will plan the follow-up meeting.'],
      ['Meeting 4 · 14:00', '"Can everyone see my screen?" (Nobody could see the screen. For eleven minutes.)'],
      ['Meeting 5 · 16:45', '"Let\'s take this offline." The only sentence of the day that made everyone happy.'],
      ['Action items', '1. Send email.  2. Schedule meeting about email.  3. ~~Do the work~~'],
    ],
  },
  {
    title: 'A Christmas Carol', author: 'Charles Dickens, 1843', spine: '#c8102e', ink: '#f6d38a', cover: '#9e0c24',
    pages: [
      ['Stave One · Marley\'s Ghost', 'Marley was dead: to begin with. There is no doubt whatever about that. The register of his burial was signed by the clergyman, the clerk, the undertaker, and the chief mourner. Scrooge signed it: and Scrooge\'s name was good upon \'Change, for anything he chose to put his hand to. Old Marley was as dead as a door-nail.'],
      ['', 'Oh! But he was a tight-fisted hand at the grind-stone, Scrooge! a squeezing, wrenching, grasping, scraping, clutching, covetous, old sinner! Hard and sharp as flint, from which no steel had ever struck out generous fire; secret, and self-contained, and solitary as an oyster.'],
      ['', 'Once upon a time—of all the good days in the year, on Christmas Eve—old Scrooge sat busy in his counting-house. It was cold, bleak, biting weather: foggy withal: and he could hear the people in the court outside, go wheezing up and down, beating their hands upon their breasts, and stamping their feet upon the pavement stones to warm them.'],
      ['', 'The door of Scrooge\'s counting-house was open that he might keep his eye upon his clerk, who in a dismal little cell beyond, a sort of tank, was copying letters. Scrooge had a very small fire, but the clerk\'s fire was so very much smaller that it looked like one coal.'],
      ['', '"A merry Christmas, uncle! God save you!" cried a cheerful voice. It was the voice of Scrooge\'s nephew, who came upon him so quickly that this was the first intimation he had of his approach.\n\n"Bah!" said Scrooge, "Humbug!"'],
      ['A note from your desk', 'Scrooge never let his clerk take Christmas off. Don\'t be Scrooge. Take the afternoon. (The rest is free online: it\'s in the public domain.)'],
    ],
  },
  {
    title: 'The Little Book of Kaffe', author: 'A Swedish Coworker', spine: '#f3f1ec', ink: '#2f6b4f', cover: '#e8d9b5',
    pages: [
      ['Kaffe', 'In Sweden, coffee is not a drink. It is an appointment: a break with something sweet, taken together, on purpose. Practically a workplace right.'],
      ['Rule 1', 'A coffee break is not a snack at your desk. You stand up. You leave the screen. You talk to a human about anything except work.'],
      ['Rule 2', 'There must be a bun. Kanelbulle (cinnamon) is classic. In December, lussekatt (saffron) is mandatory.'],
      ['Rule 3', 'Twice a day is normal. Once a day is concerning. Never is a cry for help.'],
      ['Useful phrase', '"Ska vi ta en kaffe?" means "Shall we grab a coffee?" It is the most productive sentence in the Swedish language.'],
      ['The end', 'Close this book. Go get a coffee. Bring someone with you.'],
    ],
  },
  {
    title: 'Swedish for Slackers', author: 'Shipmas, Day 4', spine: '#2f6b4f', ink: '#f3f1ec', cover: '#2f6b4f',
    pages: [
      ['Lesson 1', 'lagom (adj.) — not too much, not too little. Your ideal workload. Also your ideal effort.'],
      ['Lesson 2', 'tycka (v.) — to think, to have an opinion. The 4th most common word in a year of Radio Sweden. Everyone has one.'],
      ['Lesson 3', 'ledig (adj.) — free, off work. "Jag är ledig imorgon" means "I am off tomorrow". The most beautiful sentence in Swedish.'],
      ['Lesson 4', 'mysa (v.) — to be cosy, on purpose, with candles and a blanket. A legitimate activity, not laziness.'],
      ['Lesson 5', 'God jul! — Merry Christmas! Say it, then log off.'],
      ['Want more?', 'Shipmas Day 4 has a free deck of the 1000 most common words from Radio Sweden på lätt svenska. Back on the calendar.'],
    ],
  },
];

let reader, book = null, page = 0, onClose = null;
let clueCb = null;
export function setBookClue(fn) { clueCb = fn; }
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

// accepts an index into BOOKS, or a book object (like MANUAL)
export function openBook(b, done) {
  book = typeof b === 'number' ? BOOKS[b] : b; page = 0; onClose = done;
  if (!reader) build();
  render();
  reader.hidden = false;
  requestAnimationFrame(() => reader.classList.add('on'));
  reader.querySelector('.rd-next').focus();
}
function close() {
  reader.classList.remove('on');
  setTimeout(() => { reader.hidden = true; if (onClose) { const f = onClose; onClose = null; f(); } }, 220);
}
function build() {
  reader = document.createElement('div');
  reader.id = 'reader'; reader.hidden = true;
  reader.setAttribute('role', 'dialog'); reader.setAttribute('aria-modal', 'true');
  reader.innerHTML = `<div class="rd-book"><div class="rd-left"></div><div class="rd-right"></div></div>
    <div class="rd-nav"><button class="rd-prev" aria-label="Previous page">‹</button><span class="rd-pg"></span><button class="rd-next" aria-label="Next page">›</button><button class="rd-close">Close book</button></div>`;
  document.body.appendChild(reader);
  reader.addEventListener('click', e => { if (e.target === reader) close(); });
  reader.querySelector('.rd-prev').addEventListener('click', () => turn(-1));
  reader.querySelector('.rd-next').addEventListener('click', () => turn(1));
  reader.querySelector('.rd-close').addEventListener('click', close);
  addEventListener('keydown', e => {
    if (reader.hidden) return;
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
    else if (e.key === 'ArrowRight') turn(1);
    else if (e.key === 'ArrowLeft') turn(-1);
  }, true);
}
// spread 0 = cover + first page; spread n = pages 2n-1 and 2n
function spreads() { return Math.ceil((book.pages.length + 1) / 2); }
function turn(d) {
  const n = page + d; if (n < 0 || n >= spreads()) return;
  page = n;
  const bk = reader.querySelector('.rd-book');
  bk.classList.remove('flip-l', 'flip-r'); void bk.offsetWidth; bk.classList.add(d > 0 ? 'flip-r' : 'flip-l');
  render();
}
function pageHTML(idx) {
  const b = book;
  if (idx === 0) return b.coverHTML || `<div class="rd-cover" style="background:${b.cover};color:${b.ink === '#1f1f1f' && b.cover === '#1f1f1f' ? '#f3f1ec' : b.ink}"><small>${esc(b.author)}</small><h2>${esc(b.title)}</h2><i>✶</i></div>`;
  const p = b.pages[idx - 1]; if (!p) return '<div class="rd-page blank"></div>';
  if (p.html) return `<div class="rd-page manual">${p.html}<span class="no">${idx}</span></div>`;
  if (p[2] && clueCb) setTimeout(() => clueCb(p[2]), 900);
  return `<div class="rd-page">${p[2] ? `<span class="margin-clue" aria-label="A letter circled in red: ${p[2]}">${p[2]}<i>②</i></span>` : ''}${p[0] ? `<h3>${esc(p[0])}</h3>` : ''}${esc(p[1]).split('\n\n').map(t => `<p>${t.replace(/~~(.+?)~~/g, '<s>$1</s>')}</p>`).join('')}<span class="no">${idx}</span></div>`;
}
function render() {
  const L = page === 0 ? 0 : page * 2 - 1;
  reader.querySelector('.rd-left').innerHTML = pageHTML(L);
  reader.querySelector('.rd-right').innerHTML = pageHTML(L + 1);
  reader.querySelector('.rd-pg').textContent = `${page + 1} / ${spreads()}`;
  reader.querySelector('.rd-prev').disabled = page === 0;
  reader.querySelector('.rd-next').disabled = page === spreads() - 1;
  reader.setAttribute('aria-label', book.title);
}

// ---------------- the flat-pack manual (wordless, like the real thing) ----------------
const man = (body, n) => `<svg viewBox="0 0 200 150" class="step" aria-hidden="true">
  <g fill="none" stroke="#222" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${body}</g>
  <text x="10" y="22" font-family="Inter,Arial" font-weight="700" font-size="18" fill="#222">${n}</text></svg>`;
// a stick figure standing on the ground line (feet at y + 64)
const person = (x, y, mood = 'ok', arms = 'down') => `<circle cx="${x}" cy="${y}" r="9"/><path d="M${x} ${y + 9}v28M${x} ${y + 37}l-9 27M${x} ${y + 37}l9 27${
  arms === 'up' ? `M${x} ${y + 18}l-13 -14M${x} ${y + 18}l13 -14` : `M${x} ${y + 18}l-12 14M${x} ${y + 18}l12 14`}"/>${
  mood === 'sad' ? `<path d="M${x - 4} ${y + 5}q4 -4 8 0"/>` : mood === 'happy' ? `<path d="M${x - 4} ${y + 2}q4 5 8 0"/>` : `<path d="M${x - 3} ${y + 3}h6"/>`}`;
const ground = '<path d="M20 132h160" stroke="#bbb" stroke-width="1.5"/>';
export const MANUAL = {
  title: 'MÖLEMÖ assembly instructions', author: '', cover: '#0058a3', ink: '#ffda1a',
  coverHTML: `<div class="rd-cover manual-cover"><h2>MÖLEMÖ</h2><small>Desk for professional slacking</small>
    <svg viewBox="0 0 200 120" width="70%"><g fill="none" stroke="#111" stroke-width="2.4" stroke-linejoin="round"><path d="M20 50h160v8H20zM28 58v52M172 58v52M40 58h50v40H40z"/><path d="M50 72h30M50 86h30"/></g></svg>
    <span class="parts">248 parts · 1 Allen key · 0 regrets</span></div>`,
  pages: [
    // 1 · open the box
    { html: man(`${ground}${person(48, 68)}<path d="M84 132V72h70v60zM84 72l14-12h70l-14 12M154 132l14-12V60"/><path d="M98 60l8 -14M150 60l-6 -14"/>`, 1) + '<p class="cap">Open the box.</p>' },
    // 2 · lose count of the parts
    { html: man(`${ground}${person(42, 68, 'sad')}<path d="M80 128h88M84 120h80M90 112h70"/>${[...Array(12)].map((_, i) => `<circle cx="${92 + (i % 6) * 13}" cy="${i < 6 ? 92 : 102}" r="2.6"/>`).join('')}<text x="38" y="52" font-family="Arial" font-size="18" stroke="none" fill="#222">?</text>`, 2) + '<p class="cap">Count the parts. Lose count.</p>' },
    // 3 · call a friend
    { html: man(`${ground}${person(56, 68, 'sad')}${person(146, 68)}<path d="M70 62q30 -26 62 0" stroke-dasharray="4 4"/><path d="M124 56l8 6-10 2"/><text x="94" y="40" font-family="Arial" font-size="18" stroke="none" fill="#222">?</text>`, 3) + '<p class="cap">Call a friend.</p>' },
    // 4 · coffee first
    { html: man(`${ground}${person(48, 68, 'happy')}${person(152, 68, 'happy')}<path d="M76 104h48M82 104v28M118 104v28"/><path d="M84 92h12v12H84zM96 95q5 0 5 3.5t-5 3.5M104 92h12v12h-12zM116 95q5 0 5 3.5t-5 3.5"/><path d="M88 86q-3 -5 0 -10M110 86q-3 -5 0 -10" stroke-dasharray="2 3"/>`, 4) + '<p class="cap">Coffee first. Obviously.</p>' },
    // 5 · done (mostly)
    { html: man(`${ground}${person(44, 68, 'happy', 'up')}<path d="M78 92h96v7H78zM84 99v33M168 99v33M88 99h34v22H88z"/><path d="M96 108h18"/>`, 5) + '<p class="cap">Done! Mostly.</p>' },
    // 6 · one screw left over
    { html: man(`<circle cx="100" cy="84" r="40" stroke="#c8102e" stroke-width="3"/><path d="M76 76v16M76 84h0"/><path d="M76 78h10v12H76z"/><path d="M86 84h40"/><path d="M90 80l4 8M98 80l4 8M106 80l4 8M114 80l4 8M122 80l4 8"/><text x="90" y="114" font-family="Arial" font-weight="700" font-size="20" stroke="none" fill="#c8102e">?!</text>`, 6) + '<p class="cap">One screw left over. Never mention it.</p>' },
  ],
};
