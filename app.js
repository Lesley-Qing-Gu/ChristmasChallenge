const preview = new URLSearchParams(location.search).has('preview'); // 加 ?preview 可预览全部

function today() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

fetch('days.json').then(r => r.json()).then(days => {
  const t = today();
  const grid = document.getElementById('grid');
  let opened = 0;
  days.forEach(d => {
    const open = preview || d.date <= t;
    if (open) opened++;
    const el = document.createElement(open ? 'a' : 'div');
    el.className = 'cell ' + (open ? 'open' : 'locked');
    if (open) el.href = d.path;
    const md = d.date.slice(5).replace('-', '/');
    el.innerHTML = `<div class="n">${d.day}</div><div class="t">${open ? d.title : '🔒 未解锁'}</div><div class="d">${md}</div>`;
    grid.appendChild(el);
  });
  document.getElementById('progress').textContent = `已解锁 ${opened} / ${days.length}`;
});

// 下雪
const c = document.getElementById('snow'), x = c.getContext('2d');
let flakes = [];
function resize() { c.width = innerWidth; c.height = innerHeight; }
addEventListener('resize', resize); resize();
for (let i = 0; i < 80; i++) flakes.push({ x: Math.random() * c.width, y: Math.random() * c.height, r: Math.random() * 3 + 1, s: Math.random() + .5 });
(function tick() {
  x.clearRect(0, 0, c.width, c.height);
  x.fillStyle = 'rgba(255,255,255,.8)';
  flakes.forEach(f => {
    f.y += f.s; f.x += Math.sin(f.y / 40) * .4;
    if (f.y > c.height) { f.y = -5; f.x = Math.random() * c.width; }
    x.beginPath(); x.arc(f.x, f.y, f.r, 0, 7); x.fill();
  });
  requestAnimationFrame(tick);
})();
