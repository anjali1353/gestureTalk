export const GESTURES = [
  { name: 'Hello',      emoji: '👋', desc: 'Wave open hand',       color: '#4f8ef7' },
  { name: 'Yes',        emoji: '👍', desc: 'Thumbs up',            color: '#22d3a0' },
  { name: 'No',         emoji: '👎', desc: 'Thumbs down',          color: '#f75f7e' },
  { name: 'Help / SOS', emoji: '✊', desc: 'Raised fist',          color: '#f7a94f' },
  { name: 'Thank You',  emoji: '🙏', desc: 'Hand to chest',        color: '#a78bfa' },
  { name: 'Please',     emoji: '🤲', desc: 'Open flat palm',       color: '#60d4f7' },
  { name: 'I Love You', emoji: '🤟', desc: 'ASL ILY sign',         color: '#f75f9e' },
  { name: 'Stop',       emoji: '🛑', desc: 'Palm facing outward',  color: '#f76060' },
];

function getFeatures(lm) {
  const tips    = [4, 8, 12, 16, 20];
  const knuckle = [3, 6, 10, 14, 18];

  const extended = tips.map((tip, i) => {
    if (i === 0) return Math.abs(lm[4].x - lm[0].x) > Math.abs(lm[3].x - lm[0].x);
    return lm[tip].y < lm[knuckle[i]].y;
  });

  const palmCenter = { x: (lm[0].x + lm[9].x) / 2, y: (lm[0].y + lm[9].y) / 2 };
  const avgTipDist = tips.reduce((s, t) =>
    s + Math.hypot(lm[t].x - palmCenter.x, lm[t].y - palmCenter.y), 0) / 5;

  const spread = Math.hypot(lm[8].x - lm[20].x, lm[8].y - lm[20].y);
  const thumbTipY   = lm[4].y;
  const thumbBaseY  = lm[2].y;
  const thumbOut    = Math.abs(lm[4].x - lm[3].x) > 0.04;
  const wristAboveMid = lm[0].y > lm[12].y;
  const avgY = lm.reduce((s, p) => s + p.y, 0) / 21;

  const isFist   = avgTipDist < 0.12;
  const isILY    = thumbOut && lm[8].y < lm[6].y && lm[12].y > lm[10].y &&
                   lm[16].y > lm[14].y && lm[20].y < lm[18].y;
  const isThumbUp   = thumbTipY < thumbBaseY - 0.05 && !extended[1] && !extended[2] && !extended[3] && !extended[4];
  const isThumbDown = thumbTipY > thumbBaseY + 0.05 && !extended[1] && !extended[2] && !extended[3] && !extended[4];
  const fingersUp   = extended[1] && extended[2] && extended[3] && extended[4];
  const isStop      = fingersUp && spread < 0.25 && wristAboveMid;
  const isHello     = extended.every(Boolean) && spread > 0.22;
  const isPlease    = fingersUp && spread < 0.22 && !wristAboveMid;
  const isThankYou  = !extended.every(Boolean) && !isFist && avgTipDist > 0.06 && avgTipDist < 0.15;
  const isHelp      = isFist && avgY < 0.55;

  const scores = {
    'I Love You':  isILY      ? 0.95 : 0.01,
    'Yes':         isThumbUp  ? 0.90 : 0.01,
    'No':          isThumbDown? 0.88 : 0.01,
    'Hello':       isHello    ? 0.90 : 0.01,
    'Stop':        isStop     ? 0.88 : 0.01,
    'Please':      isPlease   ? 0.82 : 0.01,
    'Help / SOS':  isHelp     ? 0.85 : 0.01,
    'Thank You':   isThankYou ? 0.75 : 0.01,
  };

  let best = null, bestScore = 0;
  for (const [g, s] of Object.entries(scores)) {
    if (s > bestScore) { bestScore = s; best = g; }
  }

  if (bestScore < 0.6) return { gesture: null, confidence: 0 };
  return { gesture: best, confidence: bestScore };
}

export { getFeatures as classifyGesture };
