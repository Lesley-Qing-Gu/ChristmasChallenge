const preview = new URLSearchParams(location.search).has('preview'); // add ?preview to see every box unlocked

const pad = n => String(n).padStart(2, '0');
const now = new Date();
const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
const dt = s => new Date(s + 'T00:00');
const mon = s => dt(s).toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
const wd = s => dt(s).toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();

fetch('days.json').then(r => r.json()).then(days => {
  const grid = document.getElementById('grid');
  let opened = 0;

  days.forEach(d => {
    const open = preview || d.date <= today;
    if (open) opened++;
    const el = document.createElement('div');
    el.className = `cell ${open ? 'open' : 'locked'}${d.date === today ? ' today' : ''}`;
    const day = dt(d.date).getDate();
    el.innerHTML = `
      ${open
        ? `<a class="under" href="${d.path}"><span class="ic">${d.icon}</span><b>${d.title}</b><small>Open →</small></a>`
        : `<div class="under"><span class="ic">🔒</span><b>Opens ${mon(d.date)} ${day}</b></div>`}
      <div class="page">
        <div class="f"><span class="num">${pad(d.day)}</span><span class="date">${mon(d.date)} ${day}<small>${wd(d.date)}</small></span></div>
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
});
