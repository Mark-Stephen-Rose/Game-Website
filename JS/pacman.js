/* ============================================================
   PAC-MAN — Mark's Games Studio Edition  v2
   Fixes: lag (cached wall canvas, no per-frame shadowBlur),
          ghost freeze (tile-step AI, fixed threshold),
          pac wall-bounce (stop-in-place, no snap jitter),
          + classic fruits system
   ============================================================ */

(function () {
  'use strict';

  /* ── Canvas ─────────────────────────────────────────────── */
  const canvas = document.getElementById('board');
  const ctx    = canvas.getContext('2d');

  /* ── Maze (28×31) ───────────────────────────────────────── */
  // 0=dot  1=wall  2=empty  3=power pellet
  // 4=ghost-house door  5=ghost-house interior
  const BASE_MAP = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,1,1,1,1,0,1,1,1,1,1,0,1,1,0,1,1,1,1,1,0,1,1,1,1,0,1],
    [1,3,1,1,1,1,0,1,1,1,1,1,0,1,1,0,1,1,1,1,1,0,1,1,1,1,3,1],
    [1,0,1,1,1,1,0,1,1,1,1,1,0,1,1,0,1,1,1,1,1,0,1,1,1,1,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,1,1,1,1,0,1,1,0,1,1,1,1,1,1,1,1,0,1,1,0,1,1,1,1,0,1],
    [1,0,1,1,1,1,0,1,1,0,1,1,1,1,1,1,1,1,0,1,1,0,1,1,1,1,0,1],
    [1,0,0,0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,0,1,1,1,1,1,2,1,1,2,1,1,1,1,1,0,1,1,1,1,1,1],
    [1,1,1,1,1,1,0,1,1,1,1,1,2,1,1,2,1,1,1,1,1,0,1,1,1,1,1,1],
    [1,1,1,1,1,1,0,1,1,2,2,2,2,2,2,2,2,2,2,1,1,0,1,1,1,1,1,1],
    [1,1,1,1,1,1,0,1,1,2,1,1,1,4,4,1,1,1,2,1,1,0,1,1,1,1,1,1],
    [1,1,1,1,1,1,0,1,1,2,1,5,5,5,5,5,5,1,2,1,1,0,1,1,1,1,1,1],
    [2,2,2,2,2,2,0,2,2,2,1,5,5,5,5,5,5,1,2,2,2,0,2,2,2,2,2,2],
    [1,1,1,1,1,1,0,1,1,2,1,5,5,5,5,5,5,1,2,1,1,0,1,1,1,1,1,1],
    [1,1,1,1,1,1,0,1,1,2,1,1,1,1,1,1,1,1,2,1,1,0,1,1,1,1,1,1],
    [1,1,1,1,1,1,0,1,1,2,2,2,2,2,2,2,2,2,2,1,1,0,1,1,1,1,1,1],
    [1,1,1,1,1,1,0,1,1,2,1,1,1,1,1,1,1,1,2,1,1,0,1,1,1,1,1,1],
    [1,1,1,1,1,1,0,1,1,2,1,1,1,1,1,1,1,1,2,1,1,0,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,1,1,1,1,0,1,1,1,1,1,0,1,1,0,1,1,1,1,1,0,1,1,1,1,0,1],
    [1,0,1,1,1,1,0,1,1,1,1,1,0,1,1,0,1,1,1,1,1,0,1,1,1,1,0,1],
    [1,3,0,0,1,1,0,0,0,0,0,0,0,2,2,0,0,0,0,0,0,0,1,1,0,0,3,1],
    [1,1,1,0,1,1,0,1,1,0,1,1,1,1,1,1,1,1,0,1,1,0,1,1,0,1,1,1],
    [1,1,1,0,1,1,0,1,1,0,1,1,1,1,1,1,1,1,0,1,1,0,1,1,0,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,1,1,1,1,1,1,1,1,1,1,0,1,1,0,1,1,1,1,1,1,1,1,1,1,0,1],
    [1,0,1,1,1,1,1,1,1,1,1,1,0,1,1,0,1,1,1,1,1,1,1,1,1,1,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  ];

  const COLS = 28;
  const ROWS = 31;

  /* ── Fruits ─────────────────────────────────────────────── */
  const FRUIT_SPAWN = {col:13, row:17};
  const FRUIT_TABLE = [
    {emoji:'🍒', pts:100},
    {emoji:'🍓', pts:300},
    {emoji:'🍊', pts:500},
    {emoji:'🍋', pts:700},
    {emoji:'🍎', pts:1000},
    {emoji:'🍇', pts:2000},
    {emoji:'🔔', pts:3000},
    {emoji:'🔑', pts:5000},
  ];

  /* ── Colours ─────────────────────────────────────────────── */
  const C = {
    wallInner:  '#0000a0',
    wall:       '#1a1aff',
    dot:        '#ffb8ae',
    pellet:     '#FFE000',
    pac:        '#FFE000',
    bg:         '#000000',
    frightened: '#0000cc',
    frightEnd:  '#ffffff',
    ghosts: ['#FF0000','#FFB8FF','#00FFFF','#FFB852'],
  };

  /* ── Constants ───────────────────────────────────────────── */
  const HOUSE_EXIT   = {col:13, row:11};
  const PACMAN_START = {col:13, row:23};
  const SCATTER_TARGETS = [
    {col:25, row:0},
    {col:2,  row:0},
    {col:27, row:30},
    {col:0,  row:30},
  ];
  const MODE_SEQUENCE = [
    {scatter:7000, chase:20000},
    {scatter:7000, chase:20000},
    {scatter:5000, chase:20000},
    {scatter:5000, chase:Infinity},
  ];
  const DIRS     = {up:{dc:0,dr:-1},down:{dc:0,dr:1},left:{dc:-1,dr:0},right:{dc:1,dr:0}};
  const OPPOSITE = {up:'down',down:'up',left:'right',right:'left'};

  /* ── Tile size & wall cache ──────────────────────────────── */
  let TILE = 18;
  let wallCanvas = null; // pre-rendered walls — rebuilt on resize only

  function buildWallCache() {
    wallCanvas = document.createElement('canvas');
    wallCanvas.width  = COLS * TILE;
    wallCanvas.height = ROWS * TILE;
    const wc = wallCanvas.getContext('2d');
    wc.fillStyle = C.bg;
    wc.fillRect(0, 0, wallCanvas.width, wallCanvas.height);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const t = BASE_MAP[r][c];
        if (t === 1) {
          paintWallTile(wc, c, r);
        } else if (t === 4) {
          wc.strokeStyle = '#FFB8FF';
          wc.lineWidth   = Math.max(2, TILE * 0.15);
          wc.lineCap     = 'round';
          wc.beginPath();
          wc.moveTo(c*TILE + TILE*0.15, r*TILE + TILE/2);
          wc.lineTo((c+1)*TILE - TILE*0.15, r*TILE + TILE/2);
          wc.stroke();
        }
      }
    }
  }

  function paintWallTile(wc, c, r) {
    const x = c*TILE, y = r*TILE, s = TILE;
    wc.fillStyle = C.wallInner;
    wc.fillRect(x, y, s, s);

    const top   = BASE_MAP[r-1]?.[c]   === 1;
    const bot   = BASE_MAP[r+1]?.[c]   === 1;
    const lft   = BASE_MAP[r]?.[c-1]   === 1;
    const rgt   = BASE_MAP[r]?.[c+1]   === 1;
    const tl    = BASE_MAP[r-1]?.[c-1] === 1;
    const tr    = BASE_MAP[r-1]?.[c+1] === 1;
    const bl    = BASE_MAP[r+1]?.[c-1] === 1;
    const br    = BASE_MAP[r+1]?.[c+1] === 1;

    const hw = s * 0.5;
    const ins = hw * 0.58;

    wc.strokeStyle = C.wall;
    wc.lineWidth   = Math.max(2, TILE * 0.22);
    wc.lineCap     = 'round';
    wc.lineJoin    = 'round';

    wc.beginPath();
    if (!top) { wc.moveTo(x+(lft?0:hw),y+ins);    wc.lineTo(x+(rgt?s:hw),y+ins); }
    if (!bot) { wc.moveTo(x+(lft?0:hw),y+s-ins);  wc.lineTo(x+(rgt?s:hw),y+s-ins); }
    if (!lft) { wc.moveTo(x+ins,y+(top?0:hw));    wc.lineTo(x+ins,y+(bot?s:hw)); }
    if (!rgt) { wc.moveTo(x+s-ins,y+(top?0:hw));  wc.lineTo(x+s-ins,y+(bot?s:hw)); }
    wc.stroke();

    const ar = ins;
    if (!top && !lft && !tl) { wc.beginPath(); wc.arc(x,   y,   ar, 0,        Math.PI/2);  wc.stroke(); }
    if (!top && !rgt && !tr) { wc.beginPath(); wc.arc(x+s, y,   ar, Math.PI/2,Math.PI);    wc.stroke(); }
    if (!bot && !lft && !bl) { wc.beginPath(); wc.arc(x,   y+s, ar,-Math.PI/2,0);          wc.stroke(); }
    if (!bot && !rgt && !br) { wc.beginPath(); wc.arc(x+s, y+s, ar, Math.PI, -Math.PI/2);  wc.stroke(); }
  }

  /* ── Resize ──────────────────────────────────────────────── */
  function resize() {
    const wrap = canvas.parentElement;
    const tH = Math.floor(wrap.clientHeight / ROWS);
    const tW = Math.floor(wrap.clientWidth  / COLS);
    TILE = Math.max(8, Math.min(tH, tW));
    canvas.width  = COLS * TILE;
    canvas.height = ROWS * TILE;
    buildWallCache();
  }

  /* ── Map helpers ─────────────────────────────────────────── */
  let map = [];
  function cloneMap() { return BASE_MAP.map(r => [...r]); }
  function wrapCol(c)  { return ((c % COLS) + COLS) % COLS; }

  function isWall(col, row) {
    if (row < 0 || row >= ROWS) return true;
    return map[row][wrapCol(col)] === 1;
  }
  function isDoor(col, row) {
    return map[row]?.[wrapCol(col)] === 4;
  }
  function countFood() {
    let n = 0;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (map[r][c] === 0 || map[r][c] === 3) n++;
    return n;
  }
  function dist2(ac, ar, bc, br) { return (ac-bc)**2+(ar-br)**2; }

  /* ── Game state ──────────────────────────────────────────── */
  let score, highScore, level, lives, dots, totalDots;
  let pacman, ghosts;
  let gameState; // 'idle'|'playing'|'paused'|'dying'|'levelcomplete'|'gameover'
  let frightTimer, frightDuration, ghostEatCombo;
  let modePhase, globalMode, scatterTimer, chaseTimer;
  let animId, lastTime;
  let fruit;          // null | { col, row, info, timer, popup:{pts,timer} }
  let fruitThresholds;// dots-remaining values that trigger a fruit spawn

  /* ── UI refs ─────────────────────────────────────────────── */
  const elScore    = document.getElementById('score');
  const elHigh     = document.getElementById('highScore');
  const elLevel    = document.getElementById('level');
  const elLives    = document.getElementById('lives');
  const elFinal    = document.getElementById('finalScore');
  const elLevelTit = document.getElementById('levelTitle');
  const ovStart    = document.getElementById('overlayStart');
  const ovPause    = document.getElementById('overlayPause');
  const ovGameOver = document.getElementById('overlayGameOver');
  const ovLevel    = document.getElementById('overlayLevel');
  const btnPause   = document.getElementById('btnPause');

  function loadHigh() { return parseInt(localStorage.getItem('marks-pacman-highscore')||'0',10); }
  function saveHigh(s){ localStorage.setItem('marks-pacman-highscore',String(s)); }
  function showOnly(el) {
    [ovStart,ovPause,ovGameOver,ovLevel].forEach(o=>o.classList.add('hidden'));
    if (el) el.classList.remove('hidden');
  }
  function updateHUD() {
    elScore.textContent = score;
    elHigh.textContent  = highScore;
    elLevel.textContent = level;
    elLives.textContent = lives;
  }

  /* ── Speed helpers (pixels/ms) ───────────────────────────── */
  function pacPxSpeed()   { return TILE * (level<2 ? 0.0058 : level<5 ? 0.0063 : 0.0068); }
  function ghostPxSpeed() { return TILE * (level<2 ? 0.0048 : level<5 ? 0.0053 : 0.0058); }
  function frightPxSpeed(){ return TILE * 0.0033; }
  function eyesPxSpeed()  { return TILE * 0.013; }
  // Ghost AI step interval: how often it makes a turn decision (ms)
  function ghostStepMs()  { return level<2 ? 220 : level<5 ? 195 : 170; }

  /* ── Entity constructors ─────────────────────────────────── */
  function pacStepMs() { return 1 / (level<2 ? 0.0058 : level<5 ? 0.0063 : 0.0068); }

  function makePacman() {
    return {
      col: PACMAN_START.col, row: PACMAN_START.row,
      x:   PACMAN_START.col*TILE+TILE/2,
      y:   PACMAN_START.row*TILE+TILE/2,
      prevX: PACMAN_START.col*TILE+TILE/2,
      prevY: PACMAN_START.row*TILE+TILE/2,
      dir: 'left', nextDir: null,
      moving: false,
      stepTimer: 0,
      mouth: 0, mouthDir: 1,
    };
  }

  function makeGhosts() {
    const cfg = [
      {col:13,row:14,inHouse:true, delay:800,   bounceDir:'up'},
      {col:13,row:13,inHouse:true, delay:2500,  bounceDir:'up'},
      {col:11,row:13,inHouse:true, delay:5500,  bounceDir:'down'},
      {col:15,row:13,inHouse:true, delay:9000,  bounceDir:'up'},
    ];
    return cfg.map((s,i) => ({
      id:i,
      col:s.col, row:s.row,
      x:s.col*TILE+TILE/2, y:s.row*TILE+TILE/2,
      targetCol:s.col, targetRow:s.row,
      dir: i===2?'right':'left',
      eyeDir:'left',
      inHouse:s.inHouse,
      houseTimer:s.delay,
      houseBounceDir:s.bounceDir,
      frightened:false, eaten:false, exitingHouse:false,
      color:C.ghosts[i],
      scatter:SCATTER_TARGETS[i],
      stepTimer:Math.random()*100, // slight jitter so ghosts don't all decide at once
    }));
  }

  /* ── Fruit helpers ───────────────────────────────────────── */
  function currentFruitInfo() {
    return FRUIT_TABLE[Math.min(level-1, FRUIT_TABLE.length-1)];
  }
  function initFruitThresholds() {
    fruit = null;
    fruitThresholds = [];
    // Spawn first fruit after 70 dots eaten, second after 170
    const t1 = totalDots - 70,  t2 = totalDots - 170;
    if (t1 > 0) fruitThresholds.push(t1);
    if (t2 > 0) fruitThresholds.push(t2);
  }
  function trySpawnFruit() {
    if (fruit) return;
    for (let i = fruitThresholds.length-1; i >= 0; i--) {
      if (dots <= fruitThresholds[i]) {
        fruitThresholds.splice(i, 1);
        fruit = {
          col: FRUIT_SPAWN.col, row: FRUIT_SPAWN.row,
          info: currentFruitInfo(),
          timer: 9000,
          popup: null,
        };
        return;
      }
    }
  }

  /* ── Init ────────────────────────────────────────────────── */
  function initGame() {
    resize(); // ensure TILE is correct from current layout before creating pacman
    highScore = loadHigh();
    score=0; level=1; lives=3;
    initLevel();
    showOnly(null);
    gameState='playing';
    updateHUD();
    lastTime=undefined;
    cancelAnimationFrame(animId);
    animId=requestAnimationFrame(loop);
  }

  function initLevel() {
    map       = cloneMap();
    dots      = countFood();
    totalDots = dots;
    pacman    = makePacman();
    ghosts    = makeGhosts();

    frightTimer    = 0;
    frightDuration = Math.max(3000, 8000-(level-1)*500);
    ghostEatCombo  = 0;
    modePhase      = 0;
    globalMode     = 'scatter';
    scatterTimer   = MODE_SEQUENCE[0].scatter;
    chaseTimer     = 0;
    initFruitThresholds();
  }

  /* ════════════════════════════════════════════════════════════
     PAC-MAN MOVEMENT
     FIX: pac stops at wall centre and waits — no bounce jitter.
     Turn buffering: nextDir applied at each tile centre.
  ════════════════════════════════════════════════════════════ */
  function movePacman(dt) {
    const p = pacman;

    // Animate mouth
    const mouthSpeed = p.moving ? 0.07 : 0.025;
    p.mouth += p.mouthDir * mouthSpeed;
    if (p.mouth >= 1) p.mouthDir = -1;
    if (p.mouth <= 0) p.mouthDir =  1;

    // Wait for first keypress before moving
    if (!p.nextDir) return;

    // Accumulate time; only take a tile-step when ready
    p.stepTimer += dt;
    const stepMs = pacStepMs();
    if (p.stepTimer < stepMs) return;
    p.stepTimer -= stepMs;

    // Record previous pixel position for smooth interpolation
    p.prevX = p.x;
    p.prevY = p.y;

    // Try to turn into the queued direction
    const nd = DIRS[p.nextDir];
    if (nd && !isWall(p.col + nd.dc, p.row + nd.dr)) {
      p.dir = p.nextDir;
    }

    // Check if current direction is open
    const cd = DIRS[p.dir];
    if (!cd || isWall(p.col + cd.dc, p.row + cd.dr)) {
      p.moving = false;
      return;
    }

    // Step one tile
    p.moving = true;
    p.col = wrapCol(p.col + cd.dc);
    p.row = Math.max(0, Math.min(ROWS - 1, p.row + cd.dr));
    p.x = p.col * TILE + TILE / 2;
    p.y = p.row * TILE + TILE / 2;

    // Eat dot/pellet
    const t = map[p.row]?.[p.col];
    if (t === 0) {
      map[p.row][p.col] = 2; score += 10; dots--;
      maybeSaveHigh(); updateHUD(); trySpawnFruit();
    } else if (t === 3) {
      map[p.row][p.col] = 2; score += 50; dots--;
      maybeSaveHigh(); activateFright(); updateHUD(); trySpawnFruit();
    }
  }

  function maybeSaveHigh() {
    if (score>highScore) { highScore=score; saveHigh(highScore); }
  }

  /* ════════════════════════════════════════════════════════════
     GHOST MOVEMENT — TILE-STEP AI
     FIX: direction decisions fire on a timer (ghostStepMs), not on
     pixel proximity to tile centre. Pixel position smoothly
     interpolates toward the decided target tile every frame.
     This completely eliminates the "ghost freeze" bug.
  ════════════════════════════════════════════════════════════ */
  // Speed for ghosts walking out of the house — slow enough to see clearly
  function exitPxSpeed() { return TILE * 0.0022; }

  function moveGhost(g, dt) {
    /* House bounce / exit */
    if (g.inHouse) {
      g.houseTimer -= dt;

      if (g.exitingHouse) {
        // Phase 2: walk upward (and toward col 13) until reaching HOUSE_EXIT
        const exitSp = exitPxSpeed() * dt;
        const targetX = HOUSE_EXIT.col * TILE + TILE/2;
        const targetY = HOUSE_EXIT.row * TILE + TILE/2;

        // First centre horizontally on col 13
        if (Math.abs(g.x - targetX) > 1) {
          g.x += g.x < targetX ? Math.min(exitSp, targetX - g.x)
                                : -Math.min(exitSp, g.x - targetX);
        } else {
          g.x = targetX;
          // Then move upward
          g.y -= exitSp;
        }

        g.dir = 'up'; g.eyeDir = 'up';

        // Reached the exit tile — release to normal movement
        if (g.y <= targetY) {
          g.y = targetY; g.x = targetX;
          g.col = HOUSE_EXIT.col; g.row = HOUSE_EXIT.row;
          g.inHouse = false; g.exitingHouse = false;
          g.dir = 'left';
          g.targetCol = wrapCol(g.col - 1); g.targetRow = g.row;
        }
      } else if (g.houseTimer <= 0) {
        // Phase 1 done — start the exit walk
        g.exitingHouse = true;
      } else {
        // Phase 1: bounce up and down inside the house
        const sp = ghostPxSpeed() * dt;
        const minY = 13*TILE+TILE/2, maxY = 15*TILE+TILE/2;
        g.y += g.houseBounceDir==='up' ? -sp : sp;
        if (g.y <= minY) { g.y = minY; g.houseBounceDir = 'down'; }
        if (g.y >= maxY) { g.y = maxY; g.houseBounceDir = 'up'; }
      }
      return;
    }

    const sp = g.eaten ? eyesPxSpeed() : g.frightened ? frightPxSpeed() : ghostPxSpeed();

    /* ── Move pixel position toward target tile ── */
    const tx = g.targetCol*TILE+TILE/2;
    const ty = g.targetRow*TILE+TILE/2;
    const dx = tx-g.x, dy = ty-g.y;
    const dist = Math.sqrt(dx*dx+dy*dy);
    const step = sp*dt;

    if (dist > 0.5) {
      // Still travelling — advance but never overshoot
      const move = Math.min(step, dist);
      g.x += (dx/dist)*move;
      g.y += (dy/dist)*move;
    }

    // Tunnel pixel wrap (before arrival check)
    const half=TILE/2;
    if (g.x < -half)          { g.x=COLS*TILE+half; g.col=COLS-1; g.targetCol=g.col; return; }
    if (g.x > COLS*TILE+half) { g.x=-half;           g.col=0;      g.targetCol=g.col; return; }

    // Arrival: when pixel position is within 0.5px of target centre
    if (Math.abs(g.x-tx) <= 0.5 && Math.abs(g.y-ty) <= 0.5) {
      g.x=tx; g.y=ty;
      g.col=g.targetCol; g.row=g.targetRow;

      // Eaten ghost reaches house entrance — enter and stop
      if (g.eaten && g.col===HOUSE_EXIT.col && g.row===HOUSE_EXIT.row) {
        g.eaten=false; g.frightened=false;
        g.inHouse=true; g.exitingHouse=false; g.houseTimer=1200;
        g.houseBounceDir='down';
        // Move ghost pixel position inside the house so the bounce loop
        // starts from inside, not at the entrance (which would cause it
        // to immediately exit again on the next houseTimer expiry).
        g.row = 14;
        g.y   = 14*TILE+TILE/2;
        return; // don't pick a new outside target
      }

      // Pick next tile
      const target = computeTarget(g);
      // No-reverse filter applies to ALL ghosts including eaten ones.
      // Allowing eaten ghosts to reverse was the root cause of L-turn oscillation:
      // the greedy distance check would pick "reverse" and "forward" on alternating
      // arrivals because both tiles can be equidistant from HOUSE_EXIT at a corner.
      const noReverse = Object.keys(DIRS).filter(name => {
        if (name === OPPOSITE[g.dir]) return false;
        const nc = g.col+DIRS[name].dc, nr = g.row+DIRS[name].dr;
        if (isWall(nc, nr)) return false;
        if (!g.eaten && isDoor(nc, nr)) return false; // eaten ghosts may enter door
        return true;
      });
      const cands = noReverse.length > 0 ? noReverse : [OPPOSITE[g.dir]]; // true dead-end fallback

      let chosen;
      if (!target) {
        chosen = cands[Math.floor(Math.random()*cands.length)]; // frightened: random
      } else {
        let best = Infinity;
        for (const name of cands) {
          const nc=g.col+DIRS[name].dc, nr=g.row+DIRS[name].dr;
          const d=dist2(nc,nr,target.col,target.row);
          // On equal distance, prefer continuing in the current direction (forward
          // momentum) — this breaks ties at symmetric corners without reversing.
          if (d < best || (d === best && name === g.dir)) { best=d; chosen=name; }
        }
      }

      g.dir    = chosen;
      g.eyeDir = chosen;
      g.targetCol = wrapCol(g.col+DIRS[chosen].dc);
      g.targetRow = Math.max(0,Math.min(ROWS-1, g.row+DIRS[chosen].dr));
    }
  }

  function computeTarget(g) {
    if (g.eaten) return {col:HOUSE_EXIT.col, row:HOUSE_EXIT.row};
    if (g.frightened) return null;
    if (globalMode==='scatter') return g.scatter;
    return chaseTarget(g);
  }

  function chaseTarget(g) {
    const pc=pacman.col, pr=pacman.row;
    const pd=DIRS[pacman.dir]||{dc:0,dr:0};
    switch(g.id){
      case 0: return {col:pc, row:pr};
      case 1: return {col:pc+pd.dc*4, row:pr+pd.dr*4};
      case 2:{
        const b=ghosts[0];
        const pvc=pc+pd.dc*2, pvr=pr+pd.dr*2;
        return {col:pvc+(pvc-b.col), row:pvr+(pvr-b.row)};
      }
      case 3:
        return dist2(g.col,g.row,pc,pr)>64 ? {col:pc,row:pr} : g.scatter;
    }
  }

  /* ── Frightened ──────────────────────────────────────────── */
  function activateFright() {
    frightTimer=frightDuration; ghostEatCombo=0;
    ghosts.forEach(g=>{
      if (!g.eaten) {
        g.frightened=true;
        // In-house ghosts turn blue visually and will exit already frightened.
        // Outside ghosts: let them finish their current target tile then the
        // arrival handler picks a new random direction automatically.
      }
    });
  }

  /* ── Scatter/Chase ───────────────────────────────────────── */
  function updateGlobalMode(dt) {
    if (modePhase>=MODE_SEQUENCE.length) return;
    const phase=MODE_SEQUENCE[Math.min(modePhase,MODE_SEQUENCE.length-1)];
    if (globalMode==='scatter') {
      scatterTimer-=dt;
      if (scatterTimer<=0){
        globalMode='chase'; chaseTimer=phase.chase;
      }
    } else {
      if (phase.chase===Infinity) return;
      chaseTimer-=dt;
      if (chaseTimer<=0){
        modePhase++;
        if (modePhase<MODE_SEQUENCE.length){
          globalMode='scatter'; scatterTimer=MODE_SEQUENCE[modePhase].scatter;
        }
      }
    }
  }

  /* ── Collisions ──────────────────────────────────────────── */
  function checkCollisions() {
    for (const g of ghosts) {
      if (g.inHouse||g.eaten) continue;
      if (Math.abs(g.x-pacman.x)<TILE*0.65 && Math.abs(g.y-pacman.y)<TILE*0.65) {
        if (g.frightened) {
          g.eaten=true; g.frightened=false;
          ghostEatCombo++;
          score += 200*Math.pow(2,ghostEatCombo-1);
          maybeSaveHigh(); updateHUD();
          // Snap the ghost's logical tile position to the nearest tile it
          // has already reached so pathfinding toward HOUSE_EXIT starts
          // immediately instead of finishing a now-irrelevant target tile.
          g.col = Math.round((g.x - TILE/2) / TILE);
          g.row = Math.round((g.y - TILE/2) / TILE);
          g.col = Math.max(0, Math.min(COLS-1, g.col));
          g.row = Math.max(0, Math.min(ROWS-1, g.row));
          // Treat the snapped position as the new target so the ghost stops
          // drifting and picks its next tile on the very next arrival check.
          g.targetCol = g.col;
          g.targetRow = g.row;
          g.x = g.col*TILE+TILE/2;
          g.y = g.row*TILE+TILE/2;
        } else {
          pacmanDie(); return;
        }
      }
    }
    // Fruit
    if (fruit && !fruit.popup) {
      const fx=fruit.col*TILE+TILE/2, fy=fruit.row*TILE+TILE/2;
      if (Math.abs(pacman.x-fx)<TILE*0.7 && Math.abs(pacman.y-fy)<TILE*0.7) {
        const pts=fruit.info.pts;
        score+=pts; maybeSaveHigh(); updateHUD();
        fruit.popup={pts, timer:1600};
      }
    }
  }

  /* ── Fruit update ────────────────────────────────────────── */
  function updateFruit(dt) {
    if (!fruit) return;
    if (fruit.popup) {
      fruit.popup.timer-=dt;
      if (fruit.popup.timer<=0) fruit=null;
      return;
    }
    fruit.timer-=dt;
    if (fruit.timer<=0) fruit=null;
  }

  /* ── Death ───────────────────────────────────────────────── */
  function pacmanDie() {
    lives--; updateHUD();
    gameState='dying';
    setTimeout(()=>{
      if (lives<=0){
        gameState='gameover';
        elFinal.textContent=`Final Score: ${score}`;
        showOnly(ovGameOver);
      } else {
        pacman=makePacman();
        ghosts=makeGhosts();
        frightTimer=0; fruit=null;
        gameState='playing'; lastTime=undefined;
      }
    },1200);
  }

  /* ── Main loop ───────────────────────────────────────────── */
  function loop(ts) {
    animId=requestAnimationFrame(loop);

    if (gameState!=='playing' && gameState!=='dying') { draw(); return; }

    if (lastTime===undefined) lastTime=ts;
    const dt=Math.min(ts-lastTime, 50);
    lastTime=ts;

    if (gameState==='playing') {
      if (frightTimer>0) {
        frightTimer-=dt;
        if (frightTimer<=0){ frightTimer=0; ghosts.forEach(g=>{if(!g.eaten)g.frightened=false;}); }
      }
      updateGlobalMode(dt);
      movePacman(dt);
      ghosts.forEach(g=>moveGhost(g,dt));
      updateFruit(dt);
      checkCollisions();

      if (dots<=0){
        gameState='levelcomplete'; level++;
        elLevelTit.textContent=`Level ${level}`;
        showOnly(ovLevel); return;
      }
    }

    draw();
  }

  /* ════════════════════════════════════════════════════════════
     DRAWING
     FIX: walls blit from offscreen cache (1 drawImage vs hundreds
     of arc+stroke calls). shadowBlur removed entirely from the
     per-frame draw path — it was the single biggest perf killer.
  ════════════════════════════════════════════════════════════ */
  function draw() {
    ctx.fillStyle=C.bg;
    ctx.fillRect(0,0,canvas.width,canvas.height);

    if (wallCanvas) ctx.drawImage(wallCanvas,0,0); // O(1) blit

    drawFood();
    drawFruit();

    if (gameState!=='idle') {
      drawGhosts();
      const showPac = gameState!=='dying' || Math.floor(Date.now()/150)%2===0;
      if (showPac) drawPacman();
    }
  }

  function drawFood() {
    const dotR  = Math.max(1.5, TILE*0.1);
    const pellR = Math.max(3, TILE*0.26);
    const pulse = 0.75+0.25*Math.sin(Date.now()/280);

    for (let r=0; r<ROWS; r++) {
      for (let c=0; c<COLS; c++) {
        const t=map[r][c];
        if (t!==0 && t!==3) continue;
        const px=c*TILE+TILE/2, py=r*TILE+TILE/2;
        if (t===0) {
          ctx.fillStyle=C.dot;
          ctx.beginPath(); ctx.arc(px,py,dotR,0,Math.PI*2); ctx.fill();
        } else {
          ctx.fillStyle=C.pellet;
          ctx.beginPath(); ctx.arc(px,py,pellR*pulse,0,Math.PI*2); ctx.fill();
        }
      }
    }
  }

  function drawFruit() {
    if (!fruit) return;
    const px=fruit.col*TILE+TILE/2, py=fruit.row*TILE+TILE/2;

    if (fruit.popup) {
      const alpha=Math.min(1, fruit.popup.timer/500);
      ctx.globalAlpha=alpha;
      ctx.fillStyle='#FFE000';
      ctx.font=`bold ${Math.max(10,TILE*0.85)}px Montserrat,sans-serif`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(`+${fruit.popup.pts}`, px, py-TILE*0.7);
      ctx.globalAlpha=1;
      return;
    }

    // Flash in last 2 s
    if (fruit.timer<2000 && Math.floor(Date.now()/200)%2===0) return;

    ctx.font=`${Math.max(10,TILE*1.05)}px serif`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(fruit.info.emoji, px, py);
  }

  function drawPacman() {
    const p=pacman, r=TILE*0.44;
    const rotMap={right:0,down:Math.PI/2,left:Math.PI,up:-Math.PI/2};
    const rot=rotMap[p.dir]||0;
    const mA=p.mouth*Math.PI*0.35;

    ctx.fillStyle=C.pac;
    ctx.beginPath();
    ctx.moveTo(p.x,p.y);
    ctx.arc(p.x,p.y,r,rot+mA,rot+Math.PI*2-mA);
    ctx.closePath(); ctx.fill();

    const eX=p.x+Math.cos(rot-Math.PI/4)*r*0.5;
    const eY=p.y+Math.sin(rot-Math.PI/4)*r*0.5;
    ctx.fillStyle='#000';
    ctx.beginPath(); ctx.arc(eX,eY,r*0.12,0,Math.PI*2); ctx.fill();
  }

  function drawGhosts() {
    const flash=frightTimer<2000 && Math.floor(Date.now()/200)%2===0;
    for (const g of ghosts) {
      if (g.eaten){drawEyesOnly(g); continue;}
      const col=g.frightened ? (flash?C.frightEnd:C.frightened) : g.color;
      drawGhostBody(g,col,g.frightened,flash);
    }
  }

  function drawGhostBody(g,color,frightened,flash) {
    const {x,y}=g, r=TILE*0.44;
    const bumps=3, bw=(r*2)/bumps;

    ctx.fillStyle=color;
    ctx.beginPath();
    ctx.arc(x,y-r*0.1,r,Math.PI,0);
    ctx.lineTo(x+r,y+r);
    for(let i=0;i<bumps;i++) ctx.arc(x+r-i*bw-bw/2,y+r,bw/2,0,Math.PI,true);
    ctx.closePath(); ctx.fill();

    if (!frightened) {
      drawGhostEyes(g,x,y,r);
    } else {
      ctx.fillStyle=flash?'#f00':'#fff';
      ctx.beginPath(); ctx.arc(x-r*0.3,y-r*0.1,r*0.1,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x+r*0.3,y-r*0.1,r*0.1,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle=flash?'#f00':'#fff';
      ctx.lineWidth=Math.max(1,r*0.12);
      ctx.beginPath();
      ctx.moveTo(x-r*0.4,y+r*0.25);
      ctx.quadraticCurveTo(x-r*0.15,y+r*0.08,x,y+r*0.25);
      ctx.quadraticCurveTo(x+r*0.15,y+r*0.42,x+r*0.4,y+r*0.25);
      ctx.stroke();
    }
  }

  function drawGhostEyes(g,x,y,r) {
    const ox=r*0.34, oy=-r*0.15;
    const pl=DIRS[g.eyeDir]||{dc:0,dr:1};
    ctx.fillStyle='#fff';
    ctx.beginPath(); ctx.ellipse(x-ox,y+oy,r*0.21,r*0.27,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x+ox,y+oy,r*0.21,r*0.27,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#00c';
    ctx.beginPath(); ctx.ellipse(x-ox+pl.dc*r*0.1,y+oy+pl.dr*r*0.1,r*0.11,r*0.14,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x+ox+pl.dc*r*0.1,y+oy+pl.dr*r*0.1,r*0.11,r*0.14,0,0,Math.PI*2); ctx.fill();
  }

  function drawEyesOnly(g) { drawGhostEyes(g,g.x,g.y,TILE*0.44); }

  /* ── Input ───────────────────────────────────────────────── */
  document.addEventListener('keydown',e=>{
    const dm={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',
              KeyW:'up',KeyS:'down',KeyA:'left',KeyD:'right'};
    if (dm[e.code]){e.preventDefault(); if(gameState==='playing') pacman.nextDir=dm[e.code];}
    if (e.code==='KeyP'||e.code==='Escape'){e.preventDefault(); togglePause();}
  });

  function dpad(dir){if(gameState==='playing') pacman.nextDir=dir;}
  document.getElementById('dUp').addEventListener('click',    ()=>dpad('up'));
  document.getElementById('dDown').addEventListener('click',  ()=>dpad('down'));
  document.getElementById('dLeft').addEventListener('click',  ()=>dpad('left'));
  document.getElementById('dRight').addEventListener('click', ()=>dpad('right'));

  function togglePause(){
    if(gameState==='playing'){
      gameState='paused'; btnPause.textContent='Resume'; showOnly(ovPause);
    } else if(gameState==='paused'){
      gameState='playing'; btnPause.textContent='Pause'; showOnly(null); lastTime=undefined;
    }
  }

  document.getElementById('btnStart').addEventListener('click',    initGame);
  document.getElementById('btnRestart').addEventListener('click',  initGame);
  document.getElementById('btnNew').addEventListener('click',      initGame);
  btnPause.addEventListener('click', togglePause);
  document.getElementById('btnResume').addEventListener('click',   togglePause);
  document.getElementById('btnNextLevel').addEventListener('click',()=>{
    initLevel();
    showOnly(null);
    gameState='playing'; lastTime=undefined; updateHUD();
  });

  window.addEventListener('resize',()=>{
    resize();
    if(pacman) { pacman.x=pacman.col*TILE+TILE/2; pacman.y=pacman.row*TILE+TILE/2; }
  });

  /* ── Boot ────────────────────────────────────────────────── */
  highScore=loadHigh();
  map=cloneMap();
  gameState='idle';
  showOnly(ovStart);
  elHigh.textContent=highScore;
  resize();
  animId=requestAnimationFrame(loop);

})();