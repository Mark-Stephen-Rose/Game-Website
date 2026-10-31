/* ============================================================
   SOKOBAN — Mark's Games Studio Edition
   Features: 10 levels, undo, move/push counters, per-level best,
   level select, swipe + d-pad touch controls, theme-aware canvas.

   Game logic adapted from Sokoban.js by Tania Rascia (MIT License,
   Copyright (c) 2021 Tania Rascia) — see THIRD-PARTY-NOTICES.md.
   Level 6 ("Loading Dock") is the original level from that project.
   ============================================================ */

(function () {
  'use strict';

  /* ── Levels ───────────────────────────────────────────────
     Standard XSB notation:
       #  wall      (space) floor    .  goal
       $  crate     *  crate on goal
       @  player    +  player on goal                          */
  const LEVELS = [
  {
    "name": "First Shove",
    "map": [
      "#######",
      "## @  #",
      "# $   #",
      "#  ## #",
      "#   #.#",
      "#######"
    ]
  },
  {
    "name": "Odd Couple",
    "map": [
      "########",
      "# #   ##",
      "# $  # #",
      "#    $ #",
      "#  ##  #",
      "#   + .#",
      "########"
    ]
  },
  {
    "name": "Corner Office",
    "map": [
      "########",
      "#    @ #",
      "##$$   #",
      "# $ #  #",
      "#   #  #",
      "### ...#",
      "########"
    ]
  },
  {
    "name": "Four Square",
    "map": [
      "#########",
      "#       #",
      "# #  $..#",
      "#   #$#+#",
      "#     #.#",
      "#  $ $# #",
      "## ##   #",
      "#########"
    ]
  },
  {
    "name": "Tight Squeeze",
    "map": [
      "#########",
      "#.  ##  #",
      "# #@   *#",
      "#   $#$ #",
      "#    #  #",
      "#    #$ #",
      "#..#    #",
      "#########"
    ]
  },
  {
    "name": "Loading Dock",
    "map": [
      "  #####",
      "###   #",
      "#.@$  #",
      "### $.#",
      "#.##$ #",
      "# # . ##",
      "#$ *$$.#",
      "#   .  #",
      "########"
    ]
  },
  {
    "name": "Crate Expectations",
    "map": [
      "#########",
      "# ..#   #",
      "#     $ #",
      "##.#  ###",
      "#..   ###",
      "# $ $$$ #",
      "# # # @ #",
      "#########"
    ]
  },
  {
    "name": "Sort It Out",
    "map": [
      "##########",
      "#      # #",
      "#$$      #",
      "# $$#    #",
      "#.  ##  @#",
      "#  $#   .#",
      "# # . ..##",
      "##########"
    ]
  },
  {
    "name": "Six Pack",
    "map": [
      "#########",
      "#       #",
      "# $ $#$ #",
      "#  $ $  #",
      "# # #   #",
      "# #   *.#",
      "# # .+..#",
      "#########"
    ]
  },
  {
    "name": "Box Office",
    "map": [
      "#########",
      "#  .    #",
      "#.# $ #$#",
      "#.###$$ #",
      "#.#@$   #",
      "#. $   .#",
      "#   ##  #",
      "#########"
    ]
  }
];

  /* ── Elements ─────────────────────────────────────────── */
  const canvas   = document.getElementById('board');
  const ctx      = canvas.getContext('2d');
  const wrap     = document.getElementById('boardWrap');
  const elLevel  = document.getElementById('levelNum');
  const elMoves  = document.getElementById('moves');
  const elPushes = document.getElementById('pushes');
  const elBest   = document.getElementById('best');
  const elName   = document.getElementById('levelName');
  const elStatus = document.getElementById('srStatus');
  const btnUndo    = document.getElementById('btnUndo');
  const btnRestart = document.getElementById('btnRestart');
  const btnLevels  = document.getElementById('btnLevels');
  const ovStart  = document.getElementById('overlayStart');
  const ovLevels = document.getElementById('overlayLevels');
  const ovWin    = document.getElementById('overlayWin');
  const btnStart     = document.getElementById('btnStart');
  const btnLevelsClose = document.getElementById('btnLevelsClose');
  const levelGrid    = document.getElementById('levelGrid');
  const elWinTitle   = document.getElementById('winTitle');
  const elWinStats   = document.getElementById('winStats');
  const btnNext      = document.getElementById('btnNext');
  const btnReplay    = document.getElementById('btnReplay');
  const btnWinLevels = document.getElementById('btnWinLevels');
  const elStartSub   = document.getElementById('startSub');

  /* ── Progress (localStorage, always guarded) ──────────── */
  const STORE_KEY = 'marks-sokoban-progress';

  function loadProgress() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      return {
        last: Number.isInteger(raw.last) && raw.last >= 1 && raw.last <= LEVELS.length ? raw.last : 1,
        completed: raw.completed && typeof raw.completed === 'object' ? raw.completed : {},
      };
    } catch (e) {
      return { last: 1, completed: {} };
    }
  }

  function saveProgress() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(progress)); } catch (e) { /* storage blocked */ }
  }

  const progress = loadProgress();

  /* ── Colour helpers (the board reads the site's theme variables) ── */
  function hexToRgb(color) {
    const str = String(color || '').trim();
    // accept the rgb(r,g,b) strings that mix() returns as well as #hex
    const m = str.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
    if (m) return [+m[1], +m[2], +m[3]];
    let h = str.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    if (!/^[0-9a-f]{6}$/i.test(h)) return [128, 128, 128];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  function mix(a, b, t) {
    const A = hexToRgb(a), B = hexToRgb(b);
    const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
    return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
  }

  function palette() {
    const root = document.documentElement;
    const cs = getComputedStyle(root);
    const v = (name, fallback) => (cs.getPropertyValue(name) || '').trim() || fallback;
    const dark = root.getAttribute('data-theme') === 'dark';
    const bg = v('--bg', '#FAF6EF');
    const warm = v('--bg-warm', bg);
    const fg = v('--fg', '#2B2620');
    const muted = v('--fg-muted', '#6E655A');
    const faint = v('--fg-faint', '#9C9284');
    const accent = v('--accent', '#3F5D52');
    const accent2 = v('--accent-2', '#B5702F');
    const wall = dark ? mix(faint, bg, 0.5) : muted;
    return {
      floor: warm,
      floorLine: mix(warm, fg, 0.07),
      wall: wall,
      wallHi: mix(wall, '#ffffff', dark ? 0.12 : 0.22),
      wallLo: mix(wall, '#000000', 0.28),
      goal: accent2,
      box: accent2,
      boxHi: mix(accent2, '#ffffff', 0.32),
      boxEdge: mix(accent2, '#000000', 0.4),
      done: accent,
      doneHi: mix(accent, '#ffffff', 0.3),
      doneEdge: mix(accent, '#000000', 0.38),
      player: fg,
      playerEdge: bg,
      eyes: bg,
    };
  }

  /* ── Level parsing ────────────────────────────────────── */
  function parseLevel(def) {
    const rows = def.map;
    const h = rows.length;
    const w = Math.max.apply(null, rows.map(r => r.length));
    const grid = () => Array.from({ length: h }, () => Array(w).fill(false));
    const wall = grid(), goal = grid(), box = grid(), inside = grid(), showWall = grid();
    let player = null;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const ch = rows[y][x] || ' ';
        wall[y][x] = ch === '#';
        goal[y][x] = ch === '.' || ch === '*' || ch === '+';
        box[y][x]  = ch === '$' || ch === '*';
        if (ch === '@' || ch === '+') player = { x: x, y: y };
      }
    }

    // Floor = everything the player can reach. Anything else is "outside" and not drawn.
    const stack = [{ x: player.x, y: player.y }];
    inside[player.y][player.x] = true;
    while (stack.length) {
      const c = stack.pop();
      [[0, -1], [0, 1], [-1, 0], [1, 0]].forEach(function (d) {
        const nx = c.x + d[0], ny = c.y + d[1];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) return;
        if (wall[ny][nx] || inside[ny][nx]) return;
        inside[ny][nx] = true;
        stack.push({ x: nx, y: ny });
      });
    }

    // Draw only walls that touch the playable area
    let minX = w, minY = h, maxX = -1, maxY = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let visible = inside[y][x];
        if (!visible && wall[y][x]) {
          for (let dy = -1; dy <= 1 && !visible; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const nx = x + dx, ny = y + dy;
              if (nx >= 0 && ny >= 0 && nx < w && ny < h && inside[ny][nx]) { visible = true; break; }
            }
          }
          showWall[y][x] = visible;
        }
        if (visible) {
          minX = Math.min(minX, x); maxX = Math.max(maxX, x);
          minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        }
      }
    }

    let total = 0;
    box.forEach(r => r.forEach(b => { if (b) total++; }));

    return {
      w: w, h: h, wall: wall, goal: goal, box: box, inside: inside, showWall: showWall,
      player: player, total: total,
      bounds: { x: minX, y: minY, cols: maxX - minX + 1, rows: maxY - minY + 1 },
    };
  }

  /* ── State ────────────────────────────────────────────── */
  let levelIndex = progress.last;   // 1-based
  let L = null;                     // parsed level (immutable parts)
  let boxes = null;                 // current crate positions
  let player = null;
  let facing = { x: 0, y: 1 };
  let history = [];
  let moves = 0, pushes = 0;
  let locked = true;                // true while an overlay is open or the level is won
  let activeOverlay = ovStart;
  let tile = 32, cssW = 0, cssH = 0;
  let winTimer = null;

  const DIRS = {
    up:    { x: 0,  y: -1 },
    down:  { x: 0,  y: 1 },
    left:  { x: -1, y: 0 },
    right: { x: 1,  y: 0 },
  };

  /* ── Level lifecycle ──────────────────────────────────── */
  function loadLevel(n) {
    clearTimeout(winTimer);
    levelIndex = Math.min(Math.max(n, 1), LEVELS.length);
    const def = LEVELS[levelIndex - 1];
    L = parseLevel(def);
    boxes = L.box.map(r => r.slice());
    player = { x: L.player.x, y: L.player.y };
    facing = { x: 0, y: 1 };
    history = [];
    moves = 0;
    pushes = 0;
    progress.last = levelIndex;
    saveProgress();

    elName.textContent = def.name;
    canvas.setAttribute('aria-label',
      'Sokoban board, level ' + levelIndex + ' of ' + LEVELS.length + ': ' + def.name + '. ' +
      L.total + (L.total === 1 ? ' crate' : ' crates') + ' to place. Use the arrow keys or W A S D to move.');
    announce('Level ' + levelIndex + ', ' + def.name + '. ' + L.total + (L.total === 1 ? ' crate.' : ' crates.'));
    updateStats();
    fit();
  }

  function restartLevel() {
    if (activeOverlay && activeOverlay !== ovWin) return;
    closeOverlays();
    loadLevel(levelIndex);
    locked = false;
  }

  function isWon() {
    for (let y = 0; y < L.h; y++) {
      for (let x = 0; x < L.w; x++) {
        if (boxes[y][x] && !L.goal[y][x]) return false;
      }
    }
    return true;
  }

  /* ── Movement ─────────────────────────────────────────── */
  function inBounds(x, y) { return x >= 0 && y >= 0 && x < L.w && y < L.h; }

  function tryMove(dir) {
    if (locked || !L) return false;
    const d = DIRS[dir];
    facing = d;
    const nx = player.x + d.x, ny = player.y + d.y;
    if (!inBounds(nx, ny) || L.wall[ny][nx]) { draw(); return false; }

    let pushed = false;
    if (boxes[ny][nx]) {
      const bx = nx + d.x, by = ny + d.y;
      // Standard Sokoban rules: one crate at a time, never into a wall or another crate
      if (!inBounds(bx, by) || L.wall[by][bx] || boxes[by][bx]) { draw(); return false; }
      boxes[ny][nx] = false;
      boxes[by][bx] = true;
      pushed = true;
    }

    player = { x: nx, y: ny };
    moves++;
    if (pushed) pushes++;
    history.push({ dx: d.x, dy: d.y, pushed: pushed });
    updateStats();
    draw();

    if (isWon()) {
      locked = true;
      winTimer = setTimeout(showWin, 380);
    }
    return true;
  }

  function undo() {
    if (locked || !history.length) return;
    const last = history.pop();
    const px = player.x - last.dx, py = player.y - last.dy;
    if (last.pushed) {
      boxes[player.y + last.dy][player.x + last.dx] = false;
      boxes[player.y][player.x] = true;
    }
    player = { x: px, y: py };
    facing = { x: last.dx, y: last.dy };
    moves--;
    if (last.pushed) pushes--;
    updateStats();
    draw();
  }

  /* ── HUD ──────────────────────────────────────────────── */
  function announce(text) { if (elStatus) elStatus.textContent = text; }

  function bestFor(n) {
    const rec = progress.completed[n];
    return rec && Number.isFinite(rec.moves) ? rec.moves : null;
  }

  function updateStats() {
    elLevel.textContent = levelIndex + '/' + LEVELS.length;
    elMoves.textContent = moves;
    elPushes.textContent = pushes;
    const best = bestFor(levelIndex);
    elBest.textContent = best === null ? '—' : best;
    btnUndo.disabled = history.length === 0;
  }

  /* ── Overlays ─────────────────────────────────────────── */
  function openOverlay(el, focusEl) {
    [ovStart, ovLevels, ovWin].forEach(o => { if (o !== el) o.classList.add('hidden'); });
    el.classList.remove('hidden');
    activeOverlay = el;
    locked = true;
    if (focusEl) focusEl.focus();
  }

  function closeOverlays() {
    [ovStart, ovLevels, ovWin].forEach(o => o.classList.add('hidden'));
    activeOverlay = null;
    canvas.focus({ preventScroll: true });
  }

  function showWin() {
    const prev = bestFor(levelIndex);
    const isBest = prev === null || moves < prev;
    if (isBest) {
      progress.completed[levelIndex] = { moves: moves, pushes: pushes };
      saveProgress();
    }
    updateStats();

    const last = levelIndex >= LEVELS.length;
    let cleared = 0;
    for (let i = 1; i <= LEVELS.length; i++) if (progress.completed[i]) cleared++;

    elWinTitle.textContent = last && cleared === LEVELS.length ? 'All Levels Cleared' : 'Level Complete';
    let html = '<strong>' + moves + '</strong> moves &middot; <strong>' + pushes + '</strong> pushes<br>';
    html += isBest
      ? (prev === null ? 'First clear!' : 'New best!')
      : 'Best: ' + prev + ' moves';
    html += '<br>' + cleared + ' of ' + LEVELS.length + ' levels cleared';
    elWinStats.innerHTML = html;

    btnNext.classList.toggle('hidden', last);
    announce('Level ' + levelIndex + ' complete in ' + moves + ' moves.');
    openOverlay(ovWin, last ? btnReplay : btnNext);
  }

  function buildLevelGrid() {
    levelGrid.innerHTML = '';
    LEVELS.forEach(function (def, i) {
      const n = i + 1;
      const rec = progress.completed[n];
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'level-chip' + (rec ? ' done' : '') + (n === levelIndex ? ' current' : '');
      chip.setAttribute('aria-label',
        'Level ' + n + ', ' + def.name + (rec ? ', cleared in ' + rec.moves + ' moves' : ''));
      chip.innerHTML =
        '<span class="level-chip-num">' + n + '</span>' +
        '<span class="level-chip-meta">' + (rec ? rec.moves + ' mv' : 'new') + '</span>';
      chip.addEventListener('click', function () {
        closeOverlays();
        loadLevel(n);
        locked = false;
      });
      levelGrid.appendChild(chip);
    });
  }

  function openLevels() {
    if (activeOverlay === ovLevels) return;
    buildLevelGrid();
    const current = levelGrid.querySelector('.current') || levelGrid.firstChild;
    openOverlay(ovLevels, current);
  }

  /* ── Rendering ────────────────────────────────────────── */
  function fit() {
    if (!L) return;
    const bw = wrap.clientWidth, bh = wrap.clientHeight;
    if (!bw || !bh) return;
    const b = L.bounds;
    tile = Math.max(16, Math.floor(Math.min(bw / b.cols, bh / b.rows)));
    cssW = tile * b.cols;
    cssH = tile * b.rows;
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function drawBox(px, py, onGoal, c) {
    const t = tile;
    const pad = t * 0.09;
    const fill = onGoal ? c.done : c.box;
    const hi = onGoal ? c.doneHi : c.boxHi;
    const edge = onGoal ? c.doneEdge : c.boxEdge;

    roundRect(px + pad, py + pad, t - pad * 2, t - pad * 2, t * 0.12);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = Math.max(2, t * 0.05);
    ctx.strokeStyle = edge;
    ctx.stroke();

    // inner panel
    const inset = t * 0.22;
    ctx.lineWidth = Math.max(1.5, t * 0.04);
    ctx.strokeStyle = hi;
    ctx.strokeRect(px + inset, py + inset, t - inset * 2, t - inset * 2);

    if (onGoal) {
      // check mark: success is not communicated by colour alone
      ctx.beginPath();
      ctx.moveTo(px + t * 0.32, py + t * 0.52);
      ctx.lineTo(px + t * 0.45, py + t * 0.65);
      ctx.lineTo(px + t * 0.69, py + t * 0.36);
      ctx.lineWidth = Math.max(2.5, t * 0.075);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(px + inset, py + inset);
      ctx.lineTo(px + t - inset, py + t - inset);
      ctx.moveTo(px + t - inset, py + inset);
      ctx.lineTo(px + inset, py + t - inset);
      ctx.lineWidth = Math.max(1.5, t * 0.04);
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = edge;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function drawPlayer(px, py, c) {
    const t = tile;
    const cx = px + t / 2, cy = py + t / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, t * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = c.player;
    ctx.fill();
    ctx.lineWidth = Math.max(2, t * 0.06);
    ctx.strokeStyle = c.playerEdge;
    ctx.stroke();

    // eyes look the way you last moved
    const fx = facing.x, fy = facing.y;
    const perpX = -fy, perpY = fx;
    [1, -1].forEach(function (s) {
      ctx.beginPath();
      ctx.arc(cx + fx * t * 0.09 + perpX * s * t * 0.1,
              cy + fy * t * 0.09 + perpY * s * t * 0.1, t * 0.055, 0, Math.PI * 2);
      ctx.fillStyle = c.eyes;
      ctx.fill();
    });
  }

  function draw() {
    if (!L) return;
    const c = palette();
    const b = L.bounds;
    ctx.clearRect(0, 0, cssW, cssH);

    for (let y = b.y; y < b.y + b.rows; y++) {
      for (let x = b.x; x < b.x + b.cols; x++) {
        const px = (x - b.x) * tile, py = (y - b.y) * tile;

        if (L.inside[y][x]) {
          ctx.fillStyle = c.floor;
          ctx.fillRect(px, py, tile, tile);
          ctx.lineWidth = 1;
          ctx.strokeStyle = c.floorLine;
          ctx.strokeRect(px + 0.5, py + 0.5, tile - 1, tile - 1);

          if (L.goal[y][x]) {
            ctx.beginPath();
            ctx.arc(px + tile / 2, py + tile / 2, tile * 0.24, 0, Math.PI * 2);
            ctx.lineWidth = Math.max(2, tile * 0.05);
            ctx.strokeStyle = c.goal;
            ctx.globalAlpha = 0.5;
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.beginPath();
            ctx.arc(px + tile / 2, py + tile / 2, tile * 0.11, 0, Math.PI * 2);
            ctx.fillStyle = c.goal;
            ctx.fill();
          }
        } else if (L.showWall[y][x]) {
          ctx.fillStyle = c.wall;
          ctx.fillRect(px, py, tile, tile);
          const above = y > 0 && L.showWall[y - 1][x];
          const below = y < L.h - 1 && L.showWall[y + 1][x];
          if (!above) {
            ctx.fillStyle = c.wallHi;
            ctx.fillRect(px, py, tile, tile * 0.14);
          }
          if (!below) {
            ctx.fillStyle = c.wallLo;
            ctx.fillRect(px, py + tile * 0.86, tile, tile * 0.14);
          }
        }
      }
    }

    // crates and player sit on top of the floor
    for (let y = b.y; y < b.y + b.rows; y++) {
      for (let x = b.x; x < b.x + b.cols; x++) {
        if (boxes[y][x]) drawBox((x - b.x) * tile, (y - b.y) * tile, L.goal[y][x], c);
      }
    }
    drawPlayer((player.x - b.x) * tile, (player.y - b.y) * tile, c);
  }

  /* ── Input ────────────────────────────────────────────── */
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = ((e.target && e.target.tagName) || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

    if (activeOverlay) {
      if (e.key === 'Escape' && activeOverlay === ovLevels) {
        e.preventDefault();
        closeOverlays();
        locked = false;
      }
      return;
    }

    switch (e.key) {
      case 'ArrowUp':    case 'w': case 'W': e.preventDefault(); tryMove('up');    break;
      case 'ArrowDown':  case 's': case 'S': e.preventDefault(); tryMove('down');  break;
      case 'ArrowLeft':  case 'a': case 'A': e.preventDefault(); tryMove('left');  break;
      case 'ArrowRight': case 'd': case 'D': e.preventDefault(); tryMove('right'); break;
      case 'z': case 'Z': case 'Backspace': e.preventDefault(); undo(); break;
      case 'r': case 'R': restartLevel(); break;
      case 'l': case 'L': openLevels(); break;
      default:
    }
  });

  // Swipe on the board (touch)
  let touchStart = null;
  canvas.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) return;
    touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });

  canvas.addEventListener('touchend', function (e) {
    if (!touchStart || !e.changedTouches.length) return;
    const dx = e.changedTouches[0].clientX - touchStart.x;
    const dy = e.changedTouches[0].clientY - touchStart.y;
    touchStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) tryMove(dx > 0 ? 'right' : 'left');
    else tryMove(dy > 0 ? 'down' : 'up');
  }, { passive: true });

  [['dUp', 'up'], ['dDown', 'down'], ['dLeft', 'left'], ['dRight', 'right']].forEach(function (p) {
    const el = document.getElementById(p[0]);
    if (el) el.addEventListener('click', function () { tryMove(p[1]); });
  });

  btnUndo.addEventListener('click', undo);
  btnRestart.addEventListener('click', restartLevel);
  btnLevels.addEventListener('click', openLevels);
  btnLevelsClose.addEventListener('click', function () { closeOverlays(); locked = false; });
  btnWinLevels.addEventListener('click', openLevels);
  btnReplay.addEventListener('click', function () { closeOverlays(); loadLevel(levelIndex); locked = false; });
  btnNext.addEventListener('click', function () { closeOverlays(); loadLevel(levelIndex + 1); locked = false; });
  btnStart.addEventListener('click', function () { closeOverlays(); locked = false; });

  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', fit);

  // Recolour the board when the site's theme or accent swatch changes
  new MutationObserver(draw).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme', 'data-accent'],
  });

  /* ── Start ────────────────────────────────────────────── */
  loadLevel(levelIndex);
  const cleared = Object.keys(progress.completed).length;
  if (cleared > 0) {
    btnStart.textContent = 'Continue — Level ' + levelIndex;
    elStartSub.textContent = cleared + ' of ' + LEVELS.length + ' levels cleared. Pick up where you left off.';
  }
  openOverlay(ovStart, btnStart);
})();
