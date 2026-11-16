// ui/meters.js — shared meter/oscillator helpers used by aim+power minigames.
const Meters = (() => {
  // Oscillate a value between [min, max], reflecting at the bounds.
  // Returns { value, dir } — pass dir back in next frame.
  function oscillate(value, dir, speedPerSec, dtMs, min = 0, max = 1) {
    let v = value + dir * (speedPerSec * dtMs / 1000);
    if (v >= max) { v = max; dir = -1; }
    else if (v <= min) { v = min; dir = 1; }
    return { value: v, dir };
  }

  // Vertical power meter (0 at bottom → 1 at top).
  // value in [0,1]. `sweet` (optional): {center, width} draws a green zone.
  function drawPowerMeter(c, x, y, w, h, value, locked, opts = {}) {
    const sweet = opts.sweet;
    const label = opts.label || 'POWER';
    c.save();
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.fillRect(x - 2, y - 2, w + 4, h + 4);
    c.fillStyle = 'rgba(255,255,255,0.06)';
    c.fillRect(x, y, w, h);
    // sweet spot
    if (sweet) {
      const sy = y + h - (sweet.center + sweet.width / 2) * h;
      const sh = sweet.width * h;
      c.fillStyle = 'rgba(34,197,94,0.4)';
      c.fillRect(x, sy, w, sh);
    }
    // fill
    const fillH = h * value;
    const grad = c.createLinearGradient(0, y + h, 0, y);
    grad.addColorStop(0, '#22c55e');
    grad.addColorStop(0.5, '#facc15');
    grad.addColorStop(1, '#ef4444');
    c.fillStyle = grad;
    c.fillRect(x, y + h - fillH, w, fillH);
    c.strokeStyle = locked ? '#22c55e' : '#fff';
    c.lineWidth = 2;
    c.strokeRect(x, y, w, h);
    c.fillStyle = '#fff';
    c.font = 'bold 11px "Fredoka", sans-serif';
    c.textAlign = 'left';
    c.fillText(label, x - 2, y - 6);
    c.restore();
  }

  // Horizontal "sweet-spot" timing bar: a marker swings L↔R, player taps when it's in the green.
  // value in [0,1]; sweet = {center, width} positions the green band.
  function drawTimingBar(c, x, y, w, h, value, sweet, locked, label = 'TIMING') {
    c.save();
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.fillRect(x - 2, y - 2, w + 4, h + 4);
    c.fillStyle = 'rgba(255,255,255,0.08)';
    c.fillRect(x, y, w, h);
    if (sweet) {
      const sx = x + (sweet.center - sweet.width / 2) * w;
      const sw = sweet.width * w;
      c.fillStyle = 'rgba(34,197,94,0.45)';
      c.fillRect(sx, y, sw, h);
    }
    // marker
    const mx = x + value * w;
    c.fillStyle = locked ? '#22c55e' : '#fff';
    c.fillRect(mx - 2, y - 4, 4, h + 8);
    c.strokeStyle = '#fff';
    c.lineWidth = 1;
    c.strokeRect(x, y, w, h);
    c.fillStyle = '#fff';
    c.font = 'bold 11px "Fredoka", sans-serif';
    c.textAlign = 'left';
    c.fillText(label, x, y - 5);
    c.restore();
  }

  // Semicircular angle dial. value in [0,1] mapping to 0°..maxDeg.
  function drawAngleDial(c, cx, cy, r, value, locked, color, maxDeg = 90, label = 'ANGLE') {
    c.save();
    // backdrop arc
    c.fillStyle = 'rgba(0,0,0,0.3)';
    c.beginPath();
    c.arc(cx, cy, r + 4, Math.PI, Math.PI * 2);
    c.lineTo(cx + r + 4, cy);
    c.lineTo(cx - r - 4, cy);
    c.closePath();
    c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.2)';
    c.lineWidth = 1;
    c.beginPath();
    c.arc(cx, cy, r, Math.PI, Math.PI * 2);
    c.stroke();
    // tick marks every 15°
    for (let deg = 0; deg <= maxDeg; deg += 15) {
      const ang = Math.PI + (deg / 180) * Math.PI;
      const x1 = cx + Math.cos(ang) * (r - 4);
      const y1 = cy + Math.sin(ang) * (r - 4);
      const x2 = cx + Math.cos(ang) * r;
      const y2 = cy + Math.sin(ang) * r;
      c.beginPath();
      c.moveTo(x1, y1);
      c.lineTo(x2, y2);
      c.stroke();
    }
    // needle
    const a = Math.PI + (value * maxDeg / 180) * Math.PI;
    const nx = cx + Math.cos(a) * (r - 6);
    const ny = cy + Math.sin(a) * (r - 6);
    c.strokeStyle = locked ? '#22c55e' : color;
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(cx, cy);
    c.lineTo(nx, ny);
    c.stroke();
    c.fillStyle = color;
    c.beginPath();
    c.arc(cx, cy, 4, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#fff';
    c.font = 'bold 11px "Fredoka", sans-serif';
    c.textAlign = 'center';
    c.fillText(label, cx, cy + 16);
    c.restore();
  }

  // Round rect path
  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r);
    c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
  }

  // Helper: build a single "big tap" controller button for the current player
  function bigTapButton(host, player, label, onTap) {
    host.innerHTML = '';
    const btn = document.createElement('button');
    btn.className = 'action-btn';
    btn.style.borderColor = player.color;
    btn.textContent = label || 'TAP';
    btn.addEventListener('pointerdown', e => { e.preventDefault(); onTap(); });
    host.appendChild(btn);
    return btn;
  }

  return { oscillate, drawPowerMeter, drawTimingBar, drawAngleDial, roundRect, bigTapButton };
})();
