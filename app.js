const preview = new URLSearchParams(location.search).has('preview'); // add ?preview to see every door unlocked

const pad = n => String(n).padStart(2, '0');
const now = new Date();
const t = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
const fmt = s => new Date(s + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

fetch('days.json').then(r => r.json()).then(days => {
  const grid = document.getElementById('grid');
  let opened = 0;
  days.forEach(d => {
    const open = preview || d.date <= t;
    if (open) opened++;
    const el = document.createElement(open ? 'a' : 'div');
    el.className = 'cell ' + (open ? 'open' : 'locked') + (d.date === t ? ' today' : '');
    if (open) el.href = d.path;
    el.innerHTML = `
      <div class="back">
        <span class="ic">${open ? d.icon : '🔒'}</span>
        <b>${open ? d.title : 'Opens ' + fmt(d.date)}</b>
        ${open ? '<small>Open →</small>' : ''}
      </div>
      <div class="door">
        <div class="f"><span class="dt">${fmt(d.date)}</span><span class="n">${d.day}</span></div>
        <div class="b"></div>
      </div>`;
    // touch screens have no hover: first tap opens the door, second tap follows the link
    el.addEventListener('click', e => {
      if (!matchMedia('(hover:none)').matches || el.classList.contains('flipped')) return;
      e.preventDefault();
      document.querySelectorAll('.flipped').forEach(x => x.classList.remove('flipped'));
      el.classList.add('flipped');
    });
    grid.appendChild(el);
  });
  document.getElementById('progress').textContent = `${opened} of ${days.length} doors open`;
});
