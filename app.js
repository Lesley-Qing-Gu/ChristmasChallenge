const preview = new URLSearchParams(location.search).has('preview'); // add ?preview to see every box unlocked

const pad = n => String(n).padStart(2, '0');
const now = new Date();
const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
const dt = s => new Date(s + 'T00:00');
const mon = s => dt(s).toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
const wd = s => dt(s).toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();

(days => {
  const grid = document.getElementById('grid');
  let opened = 0;

  days.forEach(d => {
    const open = preview || d.date <= today;
    if (open) opened++;
    const art = ICONS[d.day - 1];
    const el = document.createElement('div');
    el.className = `cell ${open ? 'open' : 'locked'}${d.date === today ? ' today' : ''}`;
    const day = dt(d.date).getDate();
    el.innerHTML = `
      ${open
        ? `<a class="under" href="${d.path}"><span class="k">DAY ${pad(d.day)}</span><b>${d.title}</b><small>Open →</small></a>`
        : `<div class="under"><span class="k">DAY ${pad(d.day)}</span><b>Coming soon</b><small>Opens ${mon(d.date)} ${day}</small></div>`}
      <div class="page">
        <div class="f bg-${art.bg}"><svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${art.full ? art.svg : `<g transform="translate(17 14) scale(.66)">${art.svg}</g>`}</svg><span class="date">${mon(d.date)} ${day} · ${wd(d.date)}</span><span class="num">${pad(d.day)}</span></div>
        <div class="b"></div>
      </div>`;
    // touch screens have no hover: first tap turns the page, second tap opens the feature
    el.addEventListener('click', e => {
      if (!matchMedia('(hover:none)').matches || el.classList.contains('flipped')) return;
      e.preventDefault();
      document.querySelectorAll('.flipped').forEach(x => x.classList.remove('flipped'));
      el.classList.add('flipped');
    });
    grid.appendChild(el);
  });

  // boxes in the first column turn to the right so the page stays on screen
  const markFirst = () => {
    const cells = [...grid.children];
    const left = cells[0].offsetLeft;
    cells.forEach(c => c.classList.toggle('first', c.offsetLeft === left));
  };
  markFirst();
  addEventListener('resize', markFirst);

  document.getElementById('fill').style.width = (opened / days.length * 100) + '%';
  document.getElementById('progress').textContent = `${opened} / ${days.length} SHIPPED`;
})(DAYS);

// pearls drift with the mouse, and pop when clicked (they come back a moment later)
addEventListener('mousemove', e => {
  document.documentElement.style.setProperty('--mx', ((e.clientX / innerWidth) - .5) * 16);
  document.documentElement.style.setProperty('--my', ((e.clientY / innerHeight) - .5) * 16);
});
document.querySelectorAll('.balls i').forEach(b => b.addEventListener('click', () => {
  b.classList.add('pop');
  setTimeout(() => b.classList.remove('pop'), 2500);
}));
