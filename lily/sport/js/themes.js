// themes.js — themed environments. Each minigame picks a default theme.
// Themes are palette + canvas-background instructions; CSS picks up via body[data-theme].
const Themes = (() => {
  const THEMES = {
    default: {
      name: 'Default',
      sky: ['#0b1733', '#1e2a55'],
      ground: '#1e2a55',
      accent: '#3b82f6',
      decor: 'none',
    },
    stadium: {
      name: 'Stadium',
      sky: ['#0b1f3a', '#1c4287'],
      ground: '#0b6e3c',
      accent: '#facc15',
      decor: 'stadium', // crowd line + lights
    },
    pitch: {
      name: 'Football Pitch',
      sky: ['#031a0e', '#0a3a1e'],
      ground: '#14532d',
      accent: '#ffffff',
      decor: 'pitch',
    },
    space: {
      name: 'Space',
      sky: ['#03021a', '#1a0a45'],
      ground: '#08051f',
      accent: '#a855f7',
      decor: 'stars',
    },
    snow: {
      name: 'Snow Mountain',
      sky: ['#0b3a59', '#88d4ff'],
      ground: '#e6f3ff',
      accent: '#ffffff',
      decor: 'snow',
    },
    forest: {
      name: 'Forest Range',
      sky: ['#062c14', '#1f6e3f'],
      ground: '#0e3e1e',
      accent: '#fde68a',
      decor: 'trees',
    },
    beach: {
      name: 'Beach',
      sky: ['#06506b', '#fcd34d'],
      ground: '#fbbf6a',
      accent: '#fb923c',
      decor: 'palms',
    },
    dojo: {
      name: 'Dojo',
      sky: ['#3b1d12', '#7c2d12'],
      ground: '#92400e',
      accent: '#fef3c7',
      decor: 'lanterns',
    },
    court: {
      name: 'Court',
      sky: ['#1e293b', '#475569'],
      ground: '#0e7490',
      accent: '#fbbf24',
      decor: 'court',
    },
    pool: {
      name: 'Pool',
      sky: ['#0c4a6e', '#0ea5e9'],
      ground: '#0369a1',
      accent: '#fef9c3',
      decor: 'pool',
    },
    ice: {
      name: 'Ice Rink',
      sky: ['#0b3a59', '#cffafe'],
      ground: '#e0f7fa',
      accent: '#ffffff',
      decor: 'ice',
    },
  };

  function get(name) {
    return THEMES[name] || THEMES.default;
  }

  function apply(name) {
    document.body.setAttribute('data-theme', name in THEMES ? name : 'default');
  }

  function reset() {
    document.body.setAttribute('data-theme', 'default');
  }

  // draw a themed background onto a canvas context, sized w x h
  function paintBackground(ctx, w, h, themeName) {
    const t = get(themeName);
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, t.sky[0]);
    grad.addColorStop(1, t.sky[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    switch (t.decor) {
      case 'stars': paintStars(ctx, w, h); break;
      case 'stadium': paintStadium(ctx, w, h, t); break;
      case 'pitch': paintPitch(ctx, w, h); break;
      case 'snow': paintSnow(ctx, w, h); break;
      case 'forest':
      case 'trees': paintTrees(ctx, w, h); break;
      case 'court': paintCourt(ctx, w, h); break;
      case 'pool': paintPool(ctx, w, h); break;
      case 'ice': paintIce(ctx, w, h); break;
      default: break;
    }
  }

  function paintCourt(ctx, w, h) {
    // dashed center line + crowd band
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, h * 0.18, w, h * 0.08);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.6);
    ctx.lineTo(w, h * 0.6);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function paintPool(ctx, w, h) {
    // lane ropes
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    for (let i = 1; i < 6; i++) {
      const y = h * (i / 6);
      for (let x = 0; x < w; x += 16) {
        ctx.beginPath();
        ctx.arc(x, y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function paintIce(ctx, w, h) {
    // subtle scratch marks across the ice
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 0.6;
    for (let i = 0; i < 40; i++) {
      const x = rand(i + 11) * w;
      const y = h * (0.55 + rand(i + 81) * 0.45);
      const len = 18 + rand(i + 4) * 30;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + len, y + rand(i) * 2 - 1);
      ctx.stroke();
    }
  }

  // deterministic pseudo-random based on index so stars don't twinkle every frame unless asked
  function rand(i) {
    const x = Math.sin(i * 99991) * 43758.5453;
    return x - Math.floor(x);
  }

  function paintStars(ctx, w, h) {
    ctx.save();
    for (let i = 0; i < 80; i++) {
      const x = rand(i) * w;
      const y = rand(i + 999) * h * 0.85;
      const r = rand(i + 50) * 1.4 + 0.3;
      ctx.globalAlpha = 0.4 + rand(i + 7) * 0.6;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function paintStadium(ctx, w, h, t) {
    // light columns
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let i = 0; i < 4; i++) {
      const x = (i + 0.5) * (w / 4);
      ctx.fillRect(x - 8, h * 0.05, 16, h * 0.15);
    }
    // crowd line band
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, h * 0.55, w, h * 0.1);
  }

  function paintPitch(ctx, w, h) {
    // vertical stripes for a mown-grass feel
    ctx.save();
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(0,0,0,0.0)' : 'rgba(255,255,255,0.04)';
      ctx.fillRect((i * w) / 10, h * 0.55, w / 10, h * 0.45);
    }
    ctx.restore();
  }

  function paintSnow(ctx, w, h) {
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    for (let i = 0; i < 60; i++) {
      const x = rand(i + 13) * w;
      const y = rand(i + 77) * h;
      const r = rand(i + 4) * 2 + 0.5;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function paintTrees(ctx, w, h) {
    ctx.save();
    for (let i = 0; i < 6; i++) {
      const x = (i + 0.5) * (w / 6) + (rand(i) - 0.5) * 30;
      const baseY = h * 0.7;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      // trunk
      ctx.fillRect(x - 3, baseY, 6, h * 0.3);
      // canopy
      ctx.beginPath();
      ctx.fillStyle = 'rgba(10,40,20,0.6)';
      ctx.moveTo(x - 30, baseY);
      ctx.lineTo(x + 30, baseY);
      ctx.lineTo(x, baseY - 60);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  return { get, apply, reset, paintBackground, THEMES };
})();
