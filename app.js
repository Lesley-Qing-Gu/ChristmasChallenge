const preview = new URLSearchParams(location.search).has('preview'); // add ?preview to see every day unlocked

const pad = n => String(n).padStart(2, '0');
const now = new Date();
const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
const fmt = s => new Date(s + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const MONTHS = [{ y: 2026, m: 10, name: 'November' }, { y: 2026, m: 11, name: 'December' }];
const WEEK = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const stamp = `
<svg class="stamp" viewBox="0 0 120 120" aria-hidden="true">
  <defs><path id="ring" d="M60,60 m-44,0 a44,44 0 1,1 88,0 a44,44 0 1,1 -88,0"/></defs>
  <circle cx="60" cy="60" r="57" fill="none" stroke="#fff" stroke-width="2"/>
  <circle cx="60" cy="60" r="33" fill="none" stroke="#fff" stroke-width="2"/>
  <text fill="#fff" font-family="Barlow Condensed,sans-serif" font-weight="600" font-size="11.5" letter-spacing="1.2">
    <textPath href="#ring">SHIP EVERY TWO DAYS · BUILD IN PUBLIC ·</textPath></text>
  <text x="60" y="70" text-anchor="middle" font-size="26">🎁</text>
</svg>`;

fetch('days.json').then(r => r.json()).then(days => {
  const byDate = Object.fromEntries(days.map(d => [d.date, d]));
  const isOpen = d => preview || d.date <= today;
  const opened = days.filter(isOpen).length;

  const root = document.getElementById('months');
  MONTHS.forEach(({ y, m, name }, mi) => {
    const first = new Date(y, m, 1).getDay();
    const count = new Date(y, m + 1, 0).getDate();
    let cells = '<div class="cell empty"></div>'.repeat(first);
    const inMonth = [];

    for (let n = 1; n <= count; n++) {
      const key = `${y}-${pad(m + 1)}-${pad(n)}`;
      const d = byDate[key];
      if (!d) {
        cells += `<div class="cell rest"><div class="page"><div class="f"><span class="dn">${n}</span></div></div></div>`;
        continue;
      }
      inMonth.push(d);
      const open = isOpen(d);
      const sun = new Date(y, m, n).getDay() === 0 ? ' sun' : '';
      const cls = `cell rel ${open ? 'open' : 'locked'}${sun}${key === today ? ' today' : ''}`;
      const under = open
        ? `<a class="under" href="${d.path}"><span class="ic">${d.icon}</span><b>${d.title}</b><small>Open →</small></a>`
        : `<div class="under"><span class="ic">🔒</span><b>Opens ${fmt(d.date)}</b></div>`;
      cells += `<div class="${cls}">${under}<div class="page">
          <div class="f"><span class="dn">${n}</span><span class="no">#${pad(d.day)}</span></div>
          <div class="b"></div></div></div>`;
    }

    const notes = inMonth.map(d => isOpen(d)
      ? `<li>#${pad(d.day)} ${d.title}</li>`
      : `<li class="off">#${pad(d.day)} · ${fmt(d.date)}</li>`).join('');

    root.insertAdjacentHTML('beforeend', `
      <section class="sheet month">
        <div class="cal">
          <div class="wk">${WEEK.map(w => `<span>${w}</span>`).join('')}</div>
          <div class="days">${cells}</div>
        </div>
        <aside>
          <div class="big">${pad(m + 1)}</div>
          <p class="mname">${name} ${y}</p>
          <div class="note"><b>Shipped</b><ol>${notes}</ol></div>
          ${mi === MONTHS.length - 1 ? stamp : ''}
        </aside>
      </section>`);
  });

  // touch screens have no hover: first tap turns the page, second tap opens the feature
  document.querySelectorAll('.cell.rel').forEach(el => {
    el.addEventListener('click', e => {
      if (!matchMedia('(hover:none)').matches || el.classList.contains('flipped')) return;
      e.preventDefault();
      document.querySelectorAll('.flipped').forEach(x => x.classList.remove('flipped'));
      el.classList.add('flipped');
    });
  });

  document.getElementById('fill').style.width = (opened / days.length * 100) + '%';
  document.getElementById('progress').textContent = `${opened} of ${days.length} shipped`;
});
