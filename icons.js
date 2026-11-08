// 24 flat Christmas illustrations, one per box. viewBox 0 0 100 100; bottom ~25% left clear for the number.
const R = '#e3262b', RD = '#b5121b', G = '#14935a', GD = '#0b4a35', GO = '#d9b36c', GOL = '#f3dfae', C = '#f7f1e3';

const spokes = (cx, cy, r, color, w) => [0, 60, 120].map(a =>
  `<line x1="${cx - r * Math.cos(a * Math.PI / 180)}" y1="${cy - r * Math.sin(a * Math.PI / 180)}" x2="${cx + r * Math.cos(a * Math.PI / 180)}" y2="${cy + r * Math.sin(a * Math.PI / 180)}" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>`).join('');
const star = (cx, cy, ro, ri, n, fill) => {
  const p = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? ri : ro, a = Math.PI * i / n - Math.PI / 2;
    p.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return `<polygon points="${p.join(' ')}" fill="${fill}"/>`;
};

const ICONS = [
  // 1 ornament
  { bg: 'cream', svg: `<circle cx="50" cy="48" r="34" fill="${R}"/><rect x="43" y="9" width="14" height="9" rx="2" fill="${GO}"/><path d="M50 9 q-6 -8 0 -8" stroke="${GO}" stroke-width="3" fill="none"/><path d="M24 40 q26 -14 52 0" stroke="#fff" stroke-opacity=".35" stroke-width="4" fill="none"/>` },
  // 2 bell
  { bg: 'gold', svg: `<circle cx="50" cy="12" r="6" fill="${C}"/><path d="M50 16 C30 16 27 34 27 48 L19 66 H81 L73 48 C73 34 70 16 50 16Z" fill="${C}" opacity=".9"/><circle cx="50" cy="70" r="7" fill="${C}"/>` },
  // 3 mitten
  { bg: 'red', svg: `<ellipse cx="30" cy="48" rx="8" ry="13" transform="rotate(-25 30 48)" fill="${GOL}"/><path d="M33 68 V36 a17 17 0 0 1 34 0 V68Z" fill="${GOL}"/><rect x="30" y="64" width="40" height="10" rx="3" fill="${C}"/>${spokes(50, 40, 10, '#fff', 2.5)}<circle cx="72" cy="76" r="4" fill="${C}"/><circle cx="64" cy="80" r="4" fill="${C}"/>` },
  // 4 pine trio
  { bg: 'dark', svg: `<polygon points="30,30 14,68 46,68" fill="${G}"/><polygon points="70,30 54,68 86,68" fill="${G}"/><polygon points="50,12 30,66 70,66" fill="#1fb06b"/>${star(50, 12, 6, 2.6, 5, GO)}` },
  // 5 gift ribbon
  { bg: 'green', full: true, svg: `<rect x="0" y="38" width="100" height="14" fill="${R}"/><rect x="43" y="0" width="14" height="100" fill="${R}"/><ellipse cx="38" cy="38" rx="14" ry="8" transform="rotate(-30 38 38)" fill="${RD}"/><ellipse cx="62" cy="38" rx="14" ry="8" transform="rotate(30 62 38)" fill="${RD}"/><circle cx="50" cy="44" r="7" fill="${R}"/>` },
  // 6 eight-point star
  { bg: 'gold', svg: `${star(50, 44, 34, 16, 8, C)}<circle cx="50" cy="44" r="10" fill="${GO}"/><circle cx="50" cy="44" r="4" fill="${C}"/>` },
  // 7 four-point sparkle
  { bg: 'red', svg: `<path d="M50 6 Q54 40 88 44 Q54 48 50 82 Q46 48 12 44 Q46 40 50 6Z" fill="${GD}"/><circle cx="80" cy="16" r="4" fill="${C}"/>` },
  // 8 candy cane
  { bg: 'cream', svg: `<path d="M58 74 V34 a14 14 0 0 0 -28 0" stroke="${R}" stroke-width="12" fill="none" stroke-linecap="round"/><path d="M58 74 V34 a14 14 0 0 0 -28 0" stroke="#fff" stroke-width="12" fill="none" stroke-dasharray="5 9"/>` },
  // 9 reindeer
  { bg: 'green', svg: `<path d="M34 34 C26 22 22 14 16 6 M28 24 L18 22 M66 34 C74 22 78 14 84 6 M72 24 L82 22" stroke="${R}" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="50" cy="52" r="24" fill="${GO}"/><circle cx="42" cy="48" r="3" fill="${GD}"/><circle cx="58" cy="48" r="3" fill="${GD}"/><circle cx="50" cy="66" r="8" fill="${R}"/>` },
  // 10 snowflake
  { bg: 'dark', svg: `${spokes(50, 42, 28, C, 5)}${[0, 60, 120, 180, 240, 300].map(a => { const x = 50 + 18 * Math.cos(a * Math.PI / 180), y = 42 + 18 * Math.sin(a * Math.PI / 180); return `<circle cx="${x}" cy="${y}" r="4" fill="${GO}"/>`; }).join('')}<circle cx="50" cy="42" r="6" fill="${C}"/>` },
  // 11 present
  { bg: 'red', svg: `<rect x="24" y="38" width="52" height="38" rx="3" fill="${GO}"/><rect x="20" y="28" width="60" height="13" rx="3" fill="${GOL}"/><rect x="45" y="28" width="10" height="48" fill="${C}"/><ellipse cx="41" cy="22" rx="9" ry="6" transform="rotate(-25 41 22)" fill="none" stroke="${C}" stroke-width="4"/><ellipse cx="59" cy="22" rx="9" ry="6" transform="rotate(25 59 22)" fill="none" stroke="${C}" stroke-width="4"/>` },
  // 12 holly
  { bg: 'cream', svg: `<ellipse cx="34" cy="40" rx="22" ry="11" transform="rotate(-30 34 40)" fill="${G}"/><ellipse cx="66" cy="40" rx="22" ry="11" transform="rotate(30 66 40)" fill="${GD}"/><circle cx="44" cy="52" r="7" fill="${R}"/><circle cx="56" cy="52" r="7" fill="${R}"/><circle cx="50" cy="42" r="7" fill="${RD}"/>` },
  // 13 santa hat
  { bg: 'green', svg: `<path d="M24 64 Q34 22 70 18 Q60 36 72 64Z" fill="${R}"/><rect x="18" y="60" width="62" height="13" rx="6.5" fill="${C}"/><circle cx="72" cy="18" r="8" fill="${C}"/>` },
  // 14 wreath
  { bg: 'gold', svg: `<circle cx="50" cy="42" r="25" fill="none" stroke="${G}" stroke-width="14"/><circle cx="50" cy="42" r="25" fill="none" stroke="${GD}" stroke-width="4" stroke-dasharray="3 7"/><circle cx="30" cy="30" r="4" fill="${R}"/><circle cx="72" cy="36" r="4" fill="${R}"/><circle cx="62" cy="20" r="4" fill="${R}"/><path d="M50 66 l-12 10 M50 66 l12 10" stroke="${R}" stroke-width="5" stroke-linecap="round"/><circle cx="50" cy="66" r="6" fill="${R}"/>` },
  // 15 moon & stars
  { bg: 'dark', svg: `<circle cx="46" cy="42" r="26" fill="${GOL}"/><circle cx="58" cy="34" r="22" fill="${GD}"/>${star(76, 58, 7, 3, 4, C)}${star(26, 16, 5, 2, 4, C)}<circle cx="80" cy="20" r="2.5" fill="${C}"/>` },
  // 16 stocking
  { bg: 'cream', svg: `<path d="M40 22 H64 V50 L76 60 a11 11 0 0 1 -14 17 L40 60Z" fill="${R}"/><rect x="36" y="12" width="32" height="13" rx="3" fill="${GO}"/><circle cx="50" cy="42" r="4" fill="#fff" opacity=".5"/>` },
  // 17 candle
  { bg: 'red', svg: `<rect x="40" y="38" width="20" height="38" rx="2" fill="${C}"/><path d="M40 44 q6 6 10 0 q4 8 10 0" fill="${C}"/><path d="M50 12 C58 22 58 32 50 34 C42 32 42 22 50 12Z" fill="${GOL}"/><path d="M50 22 C53 27 53 31 50 32 C47 31 47 27 50 22Z" fill="${GO}"/><rect x="49" y="33" width="2" height="6" fill="${GD}"/>` },
  // 18 snowman
  { bg: 'green', svg: `<circle cx="50" cy="60" r="20" fill="${C}"/><circle cx="50" cy="32" r="14" fill="${C}"/><rect x="38" y="12" width="24" height="8" fill="${GD}"/><rect x="42" y="2" width="16" height="12" fill="${GD}"/><path d="M36 44 H64 V50 H58 V60 H52 V50 H36Z" fill="${R}"/><polygon points="50,33 62,36 50,38" fill="#f08a24"/>` },
  // 19 cocoa mug
  { bg: 'cream', svg: `<path d="M64 46 h6 a9 9 0 0 1 0 18 h-6" stroke="${R}" stroke-width="5" fill="none"/><rect x="28" y="38" width="38" height="38" rx="6" fill="${R}"/><path d="M38 30 q-5 -8 0 -14 q5 -6 0 -12 M52 30 q-5 -8 0 -14 q5 -6 0 -12" stroke="${GO}" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M28 50 h38" stroke="#fff" stroke-width="4" stroke-dasharray="4 5"/>` },
  // 20 gingerbread house
  { bg: 'dark', svg: `<rect x="28" y="44" width="44" height="32" fill="${GO}"/><polygon points="20,48 50,18 80,48" fill="${C}"/><path d="M26 48 q6 6 12 0 q6 6 12 0 q6 6 12 0 q6 6 12 0" fill="none" stroke="${C}" stroke-width="4"/><rect x="44" y="58" width="12" height="18" rx="6" fill="${R}"/><rect x="32" y="54" width="8" height="8" fill="${GOL}"/><rect x="60" y="54" width="8" height="8" fill="${GOL}"/>` },
  // 21 gingerbread man
  { bg: 'red', svg: `<path d="M28 40 H72 M40 70 L36 82 M60 70 L64 82" stroke="${GO}" stroke-width="13" stroke-linecap="round"/><rect x="36" y="32" width="28" height="40" rx="12" fill="${GO}"/><circle cx="50" cy="22" r="13" fill="${GO}"/><circle cx="45" cy="20" r="2" fill="${C}"/><circle cx="55" cy="20" r="2" fill="${C}"/><path d="M45 26 q5 4 10 0" stroke="${C}" stroke-width="2" fill="none"/><circle cx="50" cy="44" r="2.5" fill="${C}"/><circle cx="50" cy="54" r="2.5" fill="${C}"/>` },
  // 22 drop bauble
  { bg: 'green', svg: `<path d="M50 18 C70 36 72 54 62 66 C56 74 44 74 38 66 C28 54 30 36 50 18Z" fill="${GO}"/><path d="M36 50 h28 M38 60 h24" stroke="${R}" stroke-width="4"/><rect x="45" y="10" width="10" height="8" fill="${GOL}"/><circle cx="50" cy="40" r="3" fill="${C}"/>` },
  // 23 five-point star
  { bg: 'gold', svg: `${star(50, 44, 34, 14, 5, C)}${star(50, 46, 14, 6, 5, R)}` },
  // 24 the big tree
  { bg: 'dark', svg: `<polygon points="50,14 22,52 78,52" fill="${G}"/><polygon points="50,28 16,72 84,72" fill="#1fb06b"/>${star(50, 12, 10, 4, 5, GO)}<circle cx="38" cy="58" r="4" fill="${R}"/><circle cx="62" cy="62" r="4" fill="${R}"/><circle cx="52" cy="42" r="4" fill="${GOL}"/><circle cx="40" cy="40" r="3" fill="${C}"/><circle cx="66" cy="48" r="3" fill="${C}"/>` },
];
