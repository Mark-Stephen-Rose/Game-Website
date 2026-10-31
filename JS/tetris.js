/* ============================================================
   TETRIS — Mark's Games Studio Edition
   Features: ghost piece, next-piece preview, high score (localStorage)
   ============================================================ */

(function () {
  'use strict';

  /* ── Canvas setup ─────────────────────────────────────── */
  const canvas     = document.getElementById('board');
  const ctx        = canvas.getContext('2d');
  const nextCanvas = document.getElementById('nextCanvas');
  const nextCtx    = nextCanvas.getContext('2d');

  const COLS       = 10;
  const ROWS       = 20;
  const BLOCK      = canvas.width / COLS;   // 30 px at 300 px wide
  const NEXT_BLOCK = 24;

  /* ── Piece definitions ────────────────────────────────── */
  const SHAPES = {
    I: { matrix: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], color: '#4DD9E0' },
    O: { matrix: [[1,1],[1,1]],                               color: '#F7C948' },
    T: { matrix: [[0,1,0],[1,1,1],[0,0,0]],                   color: '#B36BE0' },
    S: { matrix: [[0,1,1],[1,1,0],[0,0,0]],                   color: '#5BCC6E' },
    Z: { matrix: [[1,1,0],[0,1,1],[0,0,0]],                   color: '#E05A5A' },
    J: { matrix: [[1,0,0],[1,1,1],[0,0,0]],                   color: '#5A7FE0' },
    L: { matrix: [[0,0,1],[1,1,1],[0,0,0]],                   color: '#F0944D' },
  };
  const PIECE_KEYS = Object.keys(SHAPES);

  /* ── State ────────────────────────────────────────────── */
  let board, current, next, score, highScore, level, lines, dropInterval, lastTime, animId, paused, gameOver;

  /* ── Score table ──────────────────────────────────────── */
  const SCORE_TABLE = [0, 100, 300, 500, 800];

  /* ── Speed curve (ms per drop) ───────────────────────── */
  // NES-style: 800ms at level 1 → ~50ms by level 15+
  function speedForLevel(lvl) {
    return Math.max(50, Math.floor(800 * Math.pow(0.8, lvl - 1)));
  }

  /* ── UI elements ──────────────────────────────────────── */
  const elScore     = document.getElementById('score');
  const elHigh      = document.getElementById('highScore');
  const elLevel     = document.getElementById('level');
  const elLines     = document.getElementById('lines');
  const elFinal     = document.getElementById('finalScore');
  const ovStart     = document.getElementById('overlayStart');
  const ovPause     = document.getElementById('overlayPause');
  const ovGameOver  = document.getElementById('overlayGameOver');
  const btnStart    = document.getElementById('btnStart');
  const btnResume   = document.getElementById('btnResume');
  const btnRestart  = document.getElementById('btnRestart');
  const btnPause    = document.getElementById('btnPause');
  const btnNew      = document.getElementById('btnNew');

  /* ── High score persistence ───────────────────────────── */
  function loadHighScore() {
    return parseInt(localStorage.getItem('marks-tetris-highscore') || '0', 10);
  }
  function saveHighScore(s) {
    localStorage.setItem('marks-tetris-highscore', String(s));
  }

  /* ── Board helpers ────────────────────────────────────── */
  function createBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  function randomPiece() {
    const key = PIECE_KEYS[Math.floor(Math.random() * PIECE_KEYS.length)];
    const def = SHAPES[key];
    return {
      matrix: def.matrix.map(r => [...r]),
      color:  def.color,
      x: Math.floor(COLS / 2) - Math.floor(def.matrix[0].length / 2),
      y: 0,
    };
  }

  function rotate(matrix) {
    const N = matrix.length;
    return matrix[0].map((_, c) => matrix.map((_, r) => matrix[N - 1 - r][c]));
  }

  function isValid(piece, dx, dy, mat) {
    const m = mat || piece.matrix;
    for (let r = 0; r < m.length; r++) {
      for (let c = 0; c < m[r].length; c++) {
        if (!m[r][c]) continue;
        const nx = piece.x + c + dx;
        const ny = piece.y + r + dy;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return false;
        if (ny >= 0 && board[ny][nx]) return false;
      }
    }
    return true;
  }

  function lock(piece) {
    let topped = false;
    piece.matrix.forEach((row, r) => {
      row.forEach((val, c) => {
        if (!val) return;
        const ny = piece.y + r;
        if (ny < 0) { topped = true; return; }
        board[ny][piece.x + c] = piece.color;
      });
    });
    if (topped) { triggerGameOver(); return; }
    clearLines();
    // If a Tetris flash started, spawn() will be called after the flash ends
    if (flashRows.length === 0) spawn();
  }

  /* ── Flash animation state ────────────────────────────── */
  let flashRows   = [];   // row indices currently flashing
  let flashTimer  = 0;    // ms elapsed in flash
  const FLASH_DURATION = 380; // ms total for the flash effect
  const FLASH_BLINKS   = 3;   // number of on/off blinks

  // Captured full rows for the flash animation — set once, reused at end of flash
  let pendingFlashRows = [];

  function clearLines() {
    const fullRows = [];
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r].every(c => c !== null)) fullRows.push(r);
    }
    const cleared = fullRows.length;
    if (cleared === 0) return;

    if (cleared === 4) {
      // TETRIS — freeze game briefly and flash the rows
      flashRows        = fullRows.slice();
      pendingFlashRows = fullRows.slice(); // save for removal after flash
      flashTimer = 0;
      cancelAnimationFrame(animId);
      requestAnimationFrame(flashLoop);
    } else {
      // Normal clear — remove immediately
      doRemoveRows(fullRows, cleared);
    }
  }

  function flashLoop(ts) {
    flashTimer += 16; // approximate; good enough for visual
    const progress = Math.min(flashTimer / FLASH_DURATION, 1);
    const blink    = Math.floor(progress * FLASH_BLINKS * 2);
    const lit      = (blink % 2 === 0);

    // Draw board with flash overlay
    draw();
    flashRows.forEach(r => {
      ctx.fillStyle = lit ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.15)';
      ctx.fillRect(0, r * BLOCK, canvas.width, BLOCK);
    });

    if (progress < 1) {
      requestAnimationFrame(flashLoop);
    } else {
      flashRows = [];
      // Use the rows captured when the flash started — never re-scan
      doRemoveRows(pendingFlashRows, 4);
      pendingFlashRows = [];
      spawn();
      lastTime = undefined;
      animId = requestAnimationFrame(loop);
    }
  }

  function doRemoveRows(fullRows, cleared) {
    // Sort descending so lower indices aren't shifted when we splice higher ones first
    fullRows.sort((a, b) => b - a);
    // Splice ALL full rows first, then add empty rows at top.
    // Interleaving splice+unshift was the bug: each unshift pushed a removed row
    // back down, causing subsequent splices to hit the wrong (now-empty) row.
    fullRows.forEach(r => board.splice(r, 1));
    for (let i = 0; i < fullRows.length; i++) board.unshift(Array(COLS).fill(null));
    lines  += cleared;
    score  += SCORE_TABLE[Math.min(cleared, 4)] * level;
    level   = Math.floor(lines / 10) + 1;
    dropInterval = speedForLevel(level);
    updateUI();
  }

  function spawn() {
    current = { ...next, matrix: next.matrix.map(r => [...r]) };
    current.x = Math.floor(COLS / 2) - Math.floor(current.matrix[0].length / 2);
    current.y = 0;
    next = randomPiece();
    drawNext();
    if (!isValid(current, 0, 0)) {
      triggerGameOver();
    }
  }

  /* ── Ghost piece ──────────────────────────────────────── */
  function ghostY() {
    let dy = 0;
    while (isValid(current, 0, dy + 1)) dy++;
    return current.y + dy;
  }

  /* ── Drawing ──────────────────────────────────────────── */
  function isDark() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  }

  function drawBlock(context, x, y, color, size, alpha) {
    context.globalAlpha = alpha !== undefined ? alpha : 1;
    context.fillStyle = color;
    context.beginPath();
    context.roundRect(x * size + 1, y * size + 1, size - 2, size - 2, 3);
    context.fill();
    // Highlight top-left
    context.fillStyle = 'rgba(255,255,255,0.18)';
    context.beginPath();
    context.roundRect(x * size + 2, y * size + 2, size * 0.45, 4, 1);
    context.fill();
    context.globalAlpha = 1;
  }

  function draw() {
    // Background
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = isDark() ? '#0F1117' : '#F5F5F7';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid lines
    ctx.strokeStyle = isDark() ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)';
    ctx.lineWidth = 0.5;
    for (let r = 0; r < ROWS; r++) {
      ctx.beginPath(); ctx.moveTo(0, r * BLOCK); ctx.lineTo(canvas.width, r * BLOCK); ctx.stroke();
    }
    for (let c = 0; c < COLS; c++) {
      ctx.beginPath(); ctx.moveTo(c * BLOCK, 0); ctx.lineTo(c * BLOCK, canvas.height); ctx.stroke();
    }

    // Board
    board.forEach((row, r) => {
      row.forEach((color, c) => {
        if (color) drawBlock(ctx, c, r, color, BLOCK);
      });
    });

    if (!gameOver && current) {
      // Ghost piece
      const gy = ghostY();
      if (gy !== current.y) {
        current.matrix.forEach((row, r) => {
          row.forEach((val, c) => {
            if (!val) return;
            const gx = current.x + c;
            const gyy = gy + r;
            ctx.globalAlpha = isDark() ? 0.18 : 0.12;
            ctx.fillStyle = current.color;
            ctx.beginPath();
            ctx.roundRect(gx * BLOCK + 1, gyy * BLOCK + 1, BLOCK - 2, BLOCK - 2, 3);
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.strokeStyle = current.color;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(gx * BLOCK + 1.5, gyy * BLOCK + 1.5, BLOCK - 3, BLOCK - 3, 3);
            ctx.stroke();
          });
        });
      }

      // Current piece
      current.matrix.forEach((row, r) => {
        row.forEach((val, c) => {
          if (!val) return;
          drawBlock(ctx, current.x + c, current.y + r, current.color, BLOCK);
        });
      });
    }
  }

  function drawNext() {
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    nextCtx.fillStyle = isDark() ? '#181C27' : '#F5F5F7';
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

    if (!next) return;
    const m = next.matrix;
    const offX = Math.floor((4 - m[0].length) / 2);
    const offY = Math.floor((4 - m.length) / 2);
    m.forEach((row, r) => {
      row.forEach((val, c) => {
        if (!val) return;
        drawBlock(nextCtx, offX + c, offY + r, next.color, NEXT_BLOCK);
      });
    });
  }

  /* ── Game loop ────────────────────────────────────────── */
  let dropAccum = 0;

  function loop(ts) {
    if (gameOver || paused) return;
    const dt = ts - (lastTime || ts);
    lastTime = ts;
    dropAccum += dt;
    if (dropAccum >= dropInterval) {
      dropAccum = 0;
      if (isValid(current, 0, 1)) {
        current.y++;
      } else {
        lock(current);
      }
    }
    draw();
    animId = requestAnimationFrame(loop);
  }

  /* ── Controls ─────────────────────────────────────────── */
  function tryMove(dx) {
    if (isValid(current, dx, 0)) current.x += dx;
  }

  function tryRotate() {
    const rot = rotate(current.matrix);
    if (isValid(current, 0, 0, rot)) { current.matrix = rot; return; }
    // Wall kick
    for (const kick of [1, -1, 2, -2]) {
      if (isValid(current, kick, 0, rot)) { current.x += kick; current.matrix = rot; return; }
    }
  }

  function hardDrop() {
    const dy = ghostY() - current.y;
    current.y += dy;
    score += dy * 2;
    updateUI();
    lock(current);
  }

  document.addEventListener('keydown', e => {
    if (gameOver) return;
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { togglePause(); return; }
    if (paused) return;
    switch (e.key) {
      case 'ArrowLeft':  e.preventDefault(); tryMove(-1); break;
      case 'ArrowRight': e.preventDefault(); tryMove(1);  break;
      case 'ArrowDown':  e.preventDefault();
        if (isValid(current, 0, 1)) { current.y++; score += 1; updateUI(); }
        break;
      case 'ArrowUp':    e.preventDefault(); tryRotate();  break;
      case ' ':          e.preventDefault(); hardDrop();   break;
    }
  });

  /* ── UI helpers ───────────────────────────────────────── */
  function updateUI() {
    elScore.textContent = score;
    elLines.textContent = lines;
    elLevel.textContent = level;
    if (score > highScore) {
      highScore = score;
      saveHighScore(highScore);
    }
    elHigh.textContent = highScore;
  }

  function showOverlay(el) {
    [ovStart, ovPause, ovGameOver].forEach(o => o.classList.add('hidden'));
    el.classList.remove('hidden');
  }

  function hideOverlays() {
    [ovStart, ovPause, ovGameOver].forEach(o => o.classList.add('hidden'));
  }

  /* ── Game flow ────────────────────────────────────────── */
  function initGame() {
    board        = createBoard();
    score        = 0;
    lines        = 0;
    level        = 1;
    dropInterval = speedForLevel(1);
    dropAccum    = 0;
    lastTime     = undefined;
    paused       = false;
    gameOver     = false;
    highScore    = loadHighScore();
    next         = randomPiece();
    spawn();
    updateUI();
    btnPause.textContent = 'Pause';
    hideOverlays();
    cancelAnimationFrame(animId);
    animId = requestAnimationFrame(loop);
  }

  function triggerGameOver() {
    gameOver = true;
    cancelAnimationFrame(animId);
    draw();
    if (score > loadHighScore()) saveHighScore(score);
    elFinal.textContent = `Score: ${score.toLocaleString()}  ·  Level ${level}`;
    showOverlay(ovGameOver);
  }

  function togglePause() {
    if (gameOver) return;
    paused = !paused;
    btnPause.textContent = paused ? 'Resume' : 'Pause';
    if (paused) {
      cancelAnimationFrame(animId);
      showOverlay(ovPause);
    } else {
      hideOverlays();
      lastTime = undefined;
      animId = requestAnimationFrame(loop);
    }
  }

  /* ── Button listeners ─────────────────────────────────── */
  btnStart.addEventListener('click', initGame);
  btnRestart.addEventListener('click', initGame);
  btnNew.addEventListener('click', initGame);
  btnPause.addEventListener('click', togglePause);
  btnResume.addEventListener('click', togglePause);

  /* ── Init display ─────────────────────────────────────── */
  highScore = loadHighScore();
  elHigh.textContent = highScore;
  draw();

})();
