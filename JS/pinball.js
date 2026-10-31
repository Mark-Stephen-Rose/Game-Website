/* ============================================================
   PINBALL — Mark's Games Studio Edition
   Full-featured classic retro pinball:
   · Arcade-style physics (snappy, forgiving)
   · Flippers, bumpers, slingshots, drop targets, ramps
   · Multiplier system, multiball, tilt, end-of-ball bonus
   · Wood-grain / neon classic aesthetic on canvas
   ============================================================ */

(function () {
  'use strict';

  /* ── Canvas setup ────────────────────────────────────────── */
  const canvas = document.getElementById('board');
  const ctx    = canvas.getContext('2d');

  /* ── Dimensions (logical — scaled to canvas) ─────────────── */
  const LW = 400;   // logical width
  const LH = 700;   // logical height
  let   scaleX = 1, scaleY = 1;

  function resize() {
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    scaleX = canvas.width  / LW;
    scaleY = canvas.height / LH;
  }
  window.addEventListener('resize', resize);

  /* ── Colours ─────────────────────────────────────────────── */
  const C = {
    bg:          '#05050F',
    wood:        '#0A0A1E',          // cabinet side walls — deep midnight blue
    woodLight:   '#1A1A3A',          // subtle edge highlight
    lane:        '#080814',          // main playfield floor
    laneLine:    '#0E0E22',          // subtle grid lines
    ball:        '#C8D4E0',
    ballShine:   '#FFFFFF',
    ballShadow:  '#304050',
    flipper:     '#BF00FF',          // neon purple
    flipperEdge: '#E060FF',
    bumperOff:   '#0A0A1A',
    bumperOn:    '#FFE600',          // neon yellow
    bumperRing:  '#FF6B00',          // neon orange
    slingOff:    '#051810',
    slingOn:     '#39FF14',          // neon green
    targetOff:   '#0F0518',
    targetOn:    '#FF2D78',          // neon pink
    ramp:        '#001440',
    rampLight:   '#00F5FF',          // neon cyan
    gutterWall:  '#0A0A1E',
    plunger:     '#808090',
    plungerRod:  '#303040',
    text:        '#FFE600',
    scoreFlash:  '#FFFFFF',
  };

  /* ── Physics constants ───────────────────────────────────── */
  const GRAVITY        = 0.38;
  const FRICTION       = 0.995;
  const BALL_R         = 9;
  const FLIPPER_L      = 58;
  const FLIPPER_UP_ANG = -0.52;   // radians (up position)
  const FLIPPER_DN_ANG =  0.48;   // down position
  const FLIPPER_SPEED  = 0.38;    // rad per frame
  const LAUNCH_POWER_MAX = 22;
  const TILT_BUDGET    = 5;       // max tilts before penalty

  /* ── Table geometry ──────────────────────────────────────── */
  const WALL_L    = 42;   // left gutter wall x
  const WALL_R    = 358;  // right gutter wall x
  const LANE_R    = 375;  // plunger lane right edge
  const PLUNGER_X = 366;  // plunger centre x
  const DRAIN_Y   = 670;  // ball loss line

  /* ── Flipper geometry ────────────────────────────────────── */
  const FL = { // Left flipper
    px: 108, py: 628,
    dir: 1,   // 1 = left-side
    ang: FLIPPER_DN_ANG, target: FLIPPER_DN_ANG, active: false
  };
  const FR = { // Right flipper
    px: 292, py: 628,
    dir: -1,
    ang: FLIPPER_DN_ANG, target: FLIPPER_DN_ANG, active: false
  };

  /* ── Game state ──────────────────────────────────────────── */
  let score, highScore, balls, ballNum, multiplier;
  let tiltCount, tilted, tiltFlash;
  let gameState; // 'idle'|'launch'|'playing'|'paused'|'ballend'|'gameover'|'tilt'|'multiball'
  let plungerCharge, plungerReleased;
  let multiballActive, multiBalls;
  let modeTimer, currentMode;
  let scorePopups;    // [{x,y,text,life,maxLife}]
  let animId, lastTime;
  let targetHits;     // bitmask of 5 drop targets
  let dropTargets;    // array of target objects
  let bumpers;
  let slingshots;
  let bonusPoints;    // accumulated end-of-ball bonus
  let ballsInPlay;    // array of ball objects for multiball
  let mainBall;       // reference to single ball (non-multiball)
  // Ball save
  let ballSaveActive, ballSaveTimer;
  const BALL_SAVE_DURATION = 180; // ~3 seconds at 60fps
  // Jackpot / skill shot
  let skillShotActive, skillShotLit, skillShotCooldown;
  const SKILL_SHOT_WINDOW = 90; // frames after launch where skill shot is live
  // Attract mode
  let attractFrame;

  /* ── UI refs ─────────────────────────────────────────────── */
  const elScore      = document.getElementById('score');
  const elHigh       = document.getElementById('highScore');
  const elBallNum    = document.getElementById('ballNum');
  const elBalls      = document.getElementById('balls');
  const elMulti      = document.getElementById('multiplier');
  const elModeName   = document.getElementById('modeName');
  const elBonusTitle = document.getElementById('bonusTitle');
  const elBonusScore = document.getElementById('bonusScore');
  const elFinal      = document.getElementById('finalScore');

  const ovStart     = document.getElementById('overlayStart');
  const ovPause     = document.getElementById('overlayPause');
  const ovTilt      = document.getElementById('overlayTilt');
  const ovBonus     = document.getElementById('overlayBonus');
  const ovGameOver  = document.getElementById('overlayGameOver');
  const ovMultiball = document.getElementById('overlayMultiball');

  function showOnly(el) {
    [ovStart, ovPause, ovTilt, ovBonus, ovGameOver, ovMultiball]
      .forEach(o => o.classList.add('hidden'));
    if (el) el.classList.remove('hidden');
  }

  /* ── Local storage ───────────────────────────────────────── */
  function loadHigh() { return parseInt(localStorage.getItem('marks-pinball-high') || '0', 10); }
  function saveHigh(s){ localStorage.setItem('marks-pinball-high', String(s)); }

  /* ── HUD update ──────────────────────────────────────────── */
  function updateHUD() {
    elScore.textContent   = score.toLocaleString();
    elHigh.textContent    = highScore.toLocaleString();
    elBallNum.textContent = ballNum;
    elBalls.textContent   = balls;
    elMulti.textContent   = '×' + multiplier;
    elModeName.textContent = currentMode;

    // Target lights
    for (let i = 0; i < 5; i++) {
      const el = document.getElementById('tl' + i);
      if (el) el.classList.toggle('on', !!(targetHits & (1 << i)));
    }
  }

  /* ══════════════════════════════════════════════════════════
     TABLE OBJECTS
  ══════════════════════════════════════════════════════════ */

  function makeBumpers() {
    return [
      { x:140, y:180, r:22, lit:0, pts:100 },
      { x:220, y:155, r:22, lit:0, pts:100 },
      { x:270, y:195, r:22, lit:0, pts:100 },
      { x:180, y:230, r:18, lit:0, pts:75  },
      { x:240, y:250, r:18, lit:0, pts:75  },
    ];
  }

  function makeDropTargets() {
    // 5 horizontal drop targets in a row
    const targets = [];
    const startX = 120, y = 320, gap = 46;
    for (let i = 0; i < 5; i++) {
      targets.push({
        x: startX + i * gap, y,
        w: 28, h: 10,
        down: false,    // knocked down
        lit: 0,
        pts: 500,
        id: i,
      });
    }
    return targets;
  }

  function makeSlingshots() {
    return [
      // Left slingshot triangle
      { x:72, y:490, x2:72, y2:560, w:10, lit:0, side:'left'  },
      // Right slingshot
      { x:328, y:490, x2:328, y2:560, w:10, lit:0, side:'right' },
    ];
  }

  /* ══════════════════════════════════════════════════════════
     BALL OBJECT
  ══════════════════════════════════════════════════════════ */

  function makeBall(x, y, vx, vy) {
    return { x, y, vx: vx||0, vy: vy||0, r: BALL_R, active: true };
  }

  /* ══════════════════════════════════════════════════════════
     INIT
  ══════════════════════════════════════════════════════════ */

  function initGame() {
    resize();
    highScore      = loadHigh();
    score          = 0;
    balls          = 3;
    ballNum        = 0;
    multiplier     = 1;
    tiltCount      = 0;
    tilted         = false;
    tiltFlash      = 0;
    scorePopups    = [];
    bonusPoints    = 0;
    multiballActive= false;
    multiBalls     = [];
    currentMode    = 'Normal';
    modeTimer      = 0;
    targetHits     = 0;
    bumpers        = makeBumpers();
    dropTargets    = makeDropTargets();
    slingshots     = makeSlingshots();
    ballSaveActive = false;
    ballSaveTimer  = 0;
    skillShotActive= false;
    skillShotLit   = 0;
    skillShotCooldown = 0;
    attractFrame   = 0;

    launchNewBall();
    showOnly(null);
    gameState = 'launch';
    updateHUD();
    lastTime = undefined;
    cancelAnimationFrame(animId);
    animId = requestAnimationFrame(loop);
  }

  function launchNewBall() {
    ballNum++;
    tilted         = false;
    plungerCharge  = 0;
    plungerReleased= false;
    mainBall       = makeBall(PLUNGER_X, 620, 0, 0);
    ballsInPlay    = [mainBall];
    // Reset drop targets each ball
    dropTargets.forEach(t => { t.down = false; });
    targetHits = 0;
    bonusPoints = 0;
    multiplier  = Math.max(1, multiplier); // keep multiplier across balls
    // Ball save: active for first few seconds after each launch
    ballSaveActive = true;
    ballSaveTimer  = BALL_SAVE_DURATION;
    // Skill shot: active immediately after launch
    skillShotActive  = true;
    skillShotLit     = SKILL_SHOT_WINDOW;
    skillShotCooldown = 0;
  }

  /* ══════════════════════════════════════════════════════════
     PHYSICS & MOVEMENT
  ══════════════════════════════════════════════════════════ */

  function stepBall(ball) {
    if (!ball.active) return;

    ball.vy += GRAVITY;
    ball.vx *= FRICTION;
    ball.vy *= FRICTION;

    // Sub-step to prevent tunneling at high speeds
    const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    const steps = Math.max(1, Math.ceil(speed / (ball.r * 0.8)));
    const dvx = ball.vx / steps, dvy = ball.vy / steps;

    for (let s = 0; s < steps; s++) {
      ball.x += dvx;
      ball.y += dvy;
      _resolveBallCollisions(ball);
    }
  }

  function _resolveBallCollisions(ball) {
    if (ball.x - ball.r < WALL_L) {
      ball.x  = WALL_L + ball.r;
      ball.vx = Math.abs(ball.vx) * 0.72;
    }
    if (ball.x + ball.r > WALL_R && ball.y > 120 && ball.x <= WALL_R + 2) {
      // Only bounce off right wall when in the main field (not in lane)
      ball.x  = WALL_R - ball.r;
      ball.vx = -Math.abs(ball.vx) * 0.72;
    }
    if (ball.y - ball.r < 20) {
      ball.y  = 20 + ball.r;
      ball.vy = Math.abs(ball.vy) * 0.6;
    }

    // Plunger lane: keep ball inside the lane until it exits at the top arch
    // While in the lane (x > WALL_R), only allow it to move freely once above y=100.
    if (ball.x > WALL_R) {
      if (ball.y > 100) {
        // Still in the lane corridor — clamp to lane bounds
        if (ball.x + ball.r > LANE_R) {
          ball.x  = LANE_R - ball.r;
          ball.vx = -Math.abs(ball.vx) * 0.65;
        }
        if (ball.x - ball.r < WALL_R + 2) {
          // Lane left wall — only push right while inside lane
          ball.x  = WALL_R + 2 + ball.r;
          ball.vx = Math.abs(ball.vx) * 0.65;
        }
      } else {
        // Ball has reached the top arch — give it the classic leftward curve
        // into the main field (only once, when crossing from lane into field)
        if (ball.vx === 0 || Math.abs(ball.vx) < 1) {
          ball.vx = -3.5;
        }
      }
    }

    // Bumper collisions
    for (const b of bumpers) {
      const dx = ball.x - b.x, dy = ball.y - b.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < ball.r + b.r) {
        const nx = dx/dist, ny = dy/dist;
        const speed = Math.max(Math.sqrt(ball.vx**2+ball.vy**2), 7);
        ball.vx = nx * speed * 1.3;
        ball.vy = ny * speed * 1.3;
        ball.x  = b.x + nx*(ball.r + b.r + 1);
        ball.y  = b.y + ny*(ball.r + b.r + 1);
        b.lit   = 8; // flash frames
        bumperHits++;
        // Skill shot: first bumper hit after launch scores a jackpot
        if (skillShotActive) {
          skillShotActive = false;
          const jackpot = 5000 * multiplier;
          addScore(jackpot, LW/2, 200);
          scorePopups.push({ x: LW/2, y: 170, text: '🎯 SKILL SHOT!', life: 100, maxLife: 100 });
        }
        addScore(b.pts * multiplier, b.x, b.y - b.r - 10);
        bonusPoints += 50;
      }
    }

    // Drop target collisions
    for (const t of dropTargets) {
      if (t.down) continue;
      if (ball.x + ball.r > t.x && ball.x - ball.r < t.x + t.w &&
          ball.y + ball.r > t.y && ball.y - ball.r < t.y + t.h) {
        ball.vy = -Math.abs(ball.vy) * 0.75;
        ball.vx *= 0.8;
        t.down  = true;
        t.lit   = 12;
        targetHits |= (1 << t.id);
        addScore(t.pts * multiplier, t.x + t.w/2, t.y - 12);
        bonusPoints += 200;
        checkTargetCompletion();
        updateHUD();
      }
    }

    // Slingshot collisions
    for (const s of slingshots) {
      const side   = s.side === 'left' ? 1 : -1;
      const wallX  = s.side === 'left' ? WALL_L + 30 : WALL_R - 30;
      const edgeX  = s.side === 'left' ? WALL_L      : WALL_R;
      // Ball must be between the slingshot edge and the inner wall, and in the Y range
      const inX = s.side === 'left'
        ? (ball.x - ball.r < wallX + 4 && ball.x > edgeX)
        : (ball.x + ball.r > wallX - 4 && ball.x < edgeX);
      if (inX && ball.y > s.y && ball.y < s.y2) {
        // Only kick if moving toward the wall
        if ((s.side === 'left' && ball.vx < 0) || (s.side === 'right' && ball.vx > 0)) {
          ball.vx = side * (Math.abs(ball.vx) + 3) * 1.2;
          ball.vy -= 2;
          s.lit = 10;
          addScore(50 * multiplier, ball.x, ball.y - 10);
        }
      }
    }

    // Flipper collisions
    collideFlipper(ball, FL);
    collideFlipper(ball, FR);

    // Ramp / funnel guide walls (angled walls leading to flippers)
    collideGuide(ball);
  }

  /* ── Flipper collision ───────────────────────────────────── */
  function flipperEndpoint(f) {
    const a = f.ang;
    return {
      x: f.px + Math.cos(a) * FLIPPER_L * f.dir,
      y: f.py + Math.sin(a) * FLIPPER_L
    };
  }

  function collideFlipper(ball, f) {
    const ex = f.px + Math.cos(f.ang) * FLIPPER_L * f.dir;
    const ey = f.py + Math.sin(f.ang) * FLIPPER_L;

    // Closest point on flipper segment to ball
    const dx = ex - f.px, dy = ey - f.py;
    const len2 = dx*dx + dy*dy;
    let t = ((ball.x - f.px)*dx + (ball.y - f.py)*dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const cx = f.px + t*dx, cy = f.py + t*dy;
    const bx = ball.x - cx,  by = ball.y - cy;
    const dist = Math.sqrt(bx*bx + by*by);

    if (dist < ball.r + 4) {
      const nx = bx/dist, ny = by/dist;

      // Push out of flipper
      ball.x = cx + nx*(ball.r + 5);
      ball.y = cy + ny*(ball.r + 5);

      // Reflect velocity + add flipper kick if active
      const dot = ball.vx*nx + ball.vy*ny;
      ball.vx -= 2*dot*nx;
      ball.vy -= 2*dot*ny;
      ball.vx *= 0.75;
      ball.vy *= 0.75;

      if (f.active) {
        // Flipper kick — left flipper kicks upper-right, right flipper kicks upper-left
        const kickAngle = f.dir === 1 ? -1.1 : -Math.PI + 1.1;
        ball.vx += Math.cos(kickAngle) * 7;
        ball.vy += Math.sin(kickAngle) * 7;
      }
    }
  }

  /* ── Guide walls (funnel toward flippers) ────────────────── */
  function collideGuide(ball) {
    // Left guide: from (WALL_L, 590) to (FL.px-20, FL.py)
    reflectSegment(ball, WALL_L, 590, FL.px - 20, FL.py - 4, 0.65);
    // Right guide: from (WALL_R, 590) to (FR.px+20, FR.py)
    reflectSegment(ball, WALL_R, 590, FR.px + 20, FR.py - 4, 0.65);
    // Left outer wall slope (top-left inward guide)
    reflectSegment(ball, WALL_L, 120, WALL_L + 30, 290, 0.6);
    // Right outer wall slope
    reflectSegment(ball, WALL_R, 120, WALL_R - 30, 290, 0.6);
  }

  function reflectSegment(ball, x1, y1, x2, y2, restitution) {
    const dx = x2-x1, dy = y2-y1;
    const len2 = dx*dx+dy*dy;
    if (len2 === 0) return;
    let t = ((ball.x-x1)*dx+(ball.y-y1)*dy)/len2;
    t = Math.max(0, Math.min(1, t));
    const cx = x1+t*dx, cy = y1+t*dy;
    const bx = ball.x-cx, by = ball.y-cy;
    const dist = Math.sqrt(bx*bx+by*by);
    if (dist < ball.r + 3 && dist > 0) {
      const nx = bx/dist, ny = by/dist;
      ball.x = cx + nx*(ball.r+4);
      ball.y = cy + ny*(ball.r+4);
      const dot = ball.vx*nx + ball.vy*ny;
      if (dot < 0) {
        ball.vx -= (1+restitution)*dot*nx;
        ball.vy -= (1+restitution)*dot*ny;
      }
    }
  }

  /* ── Flipper animation ───────────────────────────────────── */
  function stepFlippers() {
    [FL, FR].forEach(f => {
      // Both flippers: rest = FLIPPER_DN_ANG (tip droops), active = FLIPPER_UP_ANG (tip rises)
      // The dir field (-1 for right) is applied inside the endpoint/draw calc, not here
      f.target = f.active ? FLIPPER_UP_ANG : FLIPPER_DN_ANG;

      const diff = f.target - f.ang;
      if (Math.abs(diff) < FLIPPER_SPEED) f.ang = f.target;
      else f.ang += Math.sign(diff) * FLIPPER_SPEED;
    });
  }

  /* ══════════════════════════════════════════════════════════
     SCORE POPUPS
  ══════════════════════════════════════════════════════════ */

  function addScore(pts, x, y) {
    score += pts;
    if (score > highScore) { highScore = score; saveHigh(highScore); }
    scorePopups.push({ x, y, text: '+' + pts.toLocaleString(), life: 55, maxLife: 55 });
    updateHUD();
  }

  function stepPopups() {
    for (const p of scorePopups) { p.y -= 0.7; p.life--; }
    scorePopups = scorePopups.filter(p => p.life > 0);
  }

  /* ══════════════════════════════════════════════════════════
     GAME LOGIC
  ══════════════════════════════════════════════════════════ */

  function checkTargetCompletion() {
    if (targetHits === 0b11111) {
      // All 5 targets hit — bonus + multiplier up
      multiplier = Math.min(multiplier + 1, 6);
      addScore(5000 * multiplier, LW/2, 300);
      bonusPoints += 1000;
      targetHits = 0;
      dropTargets.forEach(t => { t.down = false; });
      scorePopups.push({ x: LW/2, y: 260, text: 'MULTIPLIER ×' + multiplier, life: 90, maxLife: 90 });
      updateHUD();
    }
  }

  function checkBallLost(ball) {
    return ball.y - ball.r > DRAIN_Y;
  }

  function triggerTilt() {
    tiltCount++;
    tiltFlash = 40;
    if (tiltCount >= TILT_BUDGET) {
      tilted = true;
      gameState = 'tilt';
      showOnly(ovTilt);
      setTimeout(() => {
        showOnly(null);
        endBall(true);
      }, 1400);
    }
  }

  function endBall(forced) {
    if (multiballActive) {
      multiballActive = false;
      multiBalls = [];
    }

    const bonus = bonusPoints * multiplier;
    balls--;
    updateHUD();

    if (balls <= 0) {
      // End of game bonus then game over
      score += bonus;
      if (score > highScore) { highScore = score; saveHigh(highScore); }
      elFinal.textContent = 'Final Score: ' + score.toLocaleString();
      updateHUD();
      gameState = 'gameover';
      showOnly(ovGameOver);
    } else {
      elBonusTitle.textContent = forced ? 'Ball Lost' : 'End of Ball';
      elBonusScore.textContent = bonus > 0
        ? `Bonus: +${bonus.toLocaleString()}`
        : 'No bonus this ball.';
      score += bonus;
      if (score > highScore) { highScore = score; saveHigh(highScore); }
      updateHUD();
      gameState = 'ballend';
      showOnly(ovBonus);
    }
  }

  function triggerMultiball() {
    if (multiballActive) return;
    multiballActive = true;
    multiBalls = [
      makeBall(mainBall.x - 15, mainBall.y - 30, -4, -8),
      makeBall(mainBall.x + 15, mainBall.y - 50,  4, -10),
    ];
    ballsInPlay = [mainBall, ...multiBalls];
    currentMode = 'MULTIBALL';
    showOnly(ovMultiball);
    setTimeout(() => showOnly(null), 1600);
    updateHUD();
  }

  /* ── Mode timers / special events ────────────────────────── */
  let bumperHits = 0;
  let rampHits   = 0;

  function checkSpecialEvents() {
    // Every 20 bumper hits → multiball
    if (bumperHits > 0 && bumperHits % 20 === 0 && !multiballActive) {
      triggerMultiball();
      bumperHits = 0;
    }
    // Ramp hit mode
    if (rampHits >= 3) {
      currentMode = 'RAMP FRENZY';
      modeTimer = 600;
      rampHits = 0;
      multiplier = Math.min(multiplier + 1, 6);
      updateHUD();
    }
    if (modeTimer > 0) {
      modeTimer--;
      if (modeTimer === 0) {
        currentMode = 'Normal';
        updateHUD();
      }
    }
  }

  /* ── Ramp hit detection (top loop + side ramps) ──────────── */
  const rampCooldown = { top: 0, left: 0, right: 0 };

  function checkRamps(ball) {
    // Top loop: ball in upper zone moving upward (negative vy) fast enough
    if (rampCooldown.top <= 0 && ball.y < 55 && ball.vy < -4) {
      rampHits++;
      addScore(300 * multiplier, ball.x, ball.y + 20);
      rampCooldown.top = 45; // ~0.75s cooldown so it only scores once per pass
    }
    // Left side ramp: ball hugging left wall in the ramp zone moving leftward
    if (rampCooldown.left <= 0 &&
        ball.x - ball.r < WALL_L + 38 && ball.x > WALL_L &&
        ball.y > 290 && ball.y < 490 && ball.vx < -1.5) {
      rampHits++;
      addScore(200 * multiplier, ball.x + 30, ball.y);
      rampCooldown.left = 30;
    }
    // Right side ramp: mirror
    if (rampCooldown.right <= 0 &&
        ball.x + ball.r > WALL_R - 38 && ball.x < WALL_R &&
        ball.y > 290 && ball.y < 490 && ball.vx > 1.5) {
      rampHits++;
      addScore(200 * multiplier, ball.x - 30, ball.y);
      rampCooldown.right = 30;
    }
    if (rampCooldown.top   > 0) rampCooldown.top--;
    if (rampCooldown.left  > 0) rampCooldown.left--;
    if (rampCooldown.right > 0) rampCooldown.right--;
  }

  /* ══════════════════════════════════════════════════════════
     MAIN LOOP
  ══════════════════════════════════════════════════════════ */

  function loop(ts) {
    animId = requestAnimationFrame(loop);
    resize();

    if (gameState !== 'playing' && gameState !== 'launch' && gameState !== 'multiball') {
      attractFrame++;
      draw();
      return;
    }

    // Tick bumper flash
    for (const b of bumpers) { if (b.lit > 0) b.lit--; }
    for (const t of dropTargets) { if (t.lit > 0) t.lit--; }
    for (const s of slingshots)  { if (s.lit > 0) s.lit--; }
    if (tiltFlash > 0) tiltFlash--;

    stepFlippers();
    stepPopups();

    if (gameState === 'launch') {
      // Ball sitting on plunger — charge on space hold
      mainBall.x = PLUNGER_X;
      mainBall.y = 620 - plungerCharge * 0.8;
      attractFrame++;
    } else {
      // Step all active balls
      for (const ball of ballsInPlay) {
        if (!ball.active) continue;
        stepBall(ball);
        checkRamps(ball);

        if (checkBallLost(ball)) {
          ball.active = false;
        }
      }

      // Ball save: tick down and catch drain
      if (ballSaveActive) {
        ballSaveTimer--;
        if (ballSaveTimer <= 0) ballSaveActive = false;
      }

      // Skill shot: tick down
      if (skillShotActive) {
        skillShotLit--;
        if (skillShotLit <= 0) skillShotActive = false;
      }

      // Attract mode frame counter (used in draw even during play for idle)
      attractFrame++;

      // Multiball: remove inactive extra balls
      if (multiballActive) {
        multiBalls = multiBalls.filter(b => b.active);
        ballsInPlay = [mainBall, ...multiBalls];
        if (multiBalls.length === 0) {
          multiballActive = false;
          currentMode = 'Normal';
          updateHUD();
        }
      }

      // Main ball lost — check ball save first
      if (!mainBall.active) {
        if (ballSaveActive) {
          // Ball save! Respawn on plunger
          ballSaveActive = false;
          ballSaveTimer  = 0;
          scorePopups.push({ x: LW/2, y: LH/2 - 40, text: '⚡ BALL SAVED!', life: 100, maxLife: 100 });
          launchNewBall();
          showOnly(null);
          gameState = 'launch';
          updateHUD();
        } else {
          endBall(false);
        }
        return;
      }

      checkSpecialEvents();
    }

    draw();
  }

  /* ══════════════════════════════════════════════════════════
     DRAWING
  ══════════════════════════════════════════════════════════ */

  function draw() {
    ctx.save();
    ctx.scale(scaleX, scaleY);

    drawTable();
    drawRamps();
    drawSlingshots();
    drawBumpers();
    drawDropTargets();
    drawFlippers();
    drawAttractLights();

    for (const ball of ballsInPlay) {
      if (ball.active || gameState === 'launch') drawBall(ball);
    }

    if (gameState === 'launch') drawPlunger();

    drawPopups();
    drawBallSaveIndicator();
    drawSkillShotIndicator();

    if (tiltFlash > 0 && tiltFlash % 4 < 2) {
      ctx.fillStyle = 'rgba(255,0,0,0.12)';
      ctx.fillRect(0, 0, LW, LH);
      ctx.font = 'bold 28px Montserrat,sans-serif';
      ctx.fillStyle = '#ff4444';
      ctx.textAlign = 'center';
      ctx.fillText('TILT!', LW/2, LH/2 - 20);
    }

    ctx.restore();
  }

  /* ── Table background ────────────────────────────────────── */
  function drawTable() {
    // Background
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, LW, LH);

    // Main playfield — deep dark with subtle radial glow at centre
    const fieldGrad = ctx.createRadialGradient(LW/2, LH*0.45, 20, LW/2, LH*0.45, 240);
    fieldGrad.addColorStop(0, '#0D0D22');
    fieldGrad.addColorStop(1, '#06060F');
    ctx.fillStyle = fieldGrad;
    ctx.fillRect(WALL_L, 0, WALL_R - WALL_L, LH);

    // Grid lines — cyan-tinted like an arcade horizon
    ctx.strokeStyle = 'rgba(0,245,255,0.06)';
    ctx.lineWidth = 0.5;
    for (let y = 0; y < LH; y += 36) {
      ctx.beginPath(); ctx.moveTo(WALL_L, y); ctx.lineTo(WALL_R, y); ctx.stroke();
    }
    for (let x = WALL_L; x < WALL_R; x += 36) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, LH); ctx.stroke();
    }

    // Cabinet side walls — deep midnight, not wood
    ctx.fillStyle = C.wood;
    ctx.fillRect(0, 0, WALL_L, LH);
    ctx.fillRect(WALL_R, 0, LW - WALL_R, LH);

    // Neon edge glow on the inner wall edges
    const leftGlow = ctx.createLinearGradient(WALL_L, 0, WALL_L + 18, 0);
    leftGlow.addColorStop(0, 'rgba(0,245,255,0.3)');
    leftGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = leftGlow;
    ctx.fillRect(WALL_L, 0, 18, LH);

    const rightGlow = ctx.createLinearGradient(WALL_R, 0, WALL_R - 18, 0);
    rightGlow.addColorStop(0, 'rgba(0,245,255,0.3)');
    rightGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = rightGlow;
    ctx.fillRect(WALL_R - 18, 0, 18, LH);

    // Neon wall stripe
    ctx.fillStyle = 'rgba(0,245,255,0.55)';
    ctx.fillRect(WALL_L - 2, 0, 2, LH);
    ctx.fillRect(WALL_R, 0, 2, LH);

    // Plunger lane
    ctx.fillStyle = '#04040D';
    ctx.fillRect(WALL_R, 0, LANE_R - WALL_R, LH);
    ctx.fillStyle = 'rgba(0,245,255,0.15)';
    ctx.fillRect(WALL_R + 2, 0, 2, LH);

    // Guide walls (angled funnel to flippers) — neon purple
    ctx.shadowColor = '#BF00FF';
    ctx.shadowBlur  = 8;
    ctx.strokeStyle = '#7700AA';
    ctx.lineWidth   = 4;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(WALL_L, 590); ctx.lineTo(FL.px - 20, FL.py - 4); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(WALL_R, 590); ctx.lineTo(FR.px + 20, FR.py - 4); ctx.stroke();
    ctx.shadowBlur = 0;

    // Top side wall slopes — neon cyan
    ctx.shadowColor = '#00F5FF';
    ctx.shadowBlur  = 6;
    ctx.strokeStyle = '#0088AA';
    ctx.lineWidth   = 3;
    ctx.beginPath();
    ctx.moveTo(WALL_L, 120); ctx.lineTo(WALL_L + 30, 290); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(WALL_R, 120); ctx.lineTo(WALL_R - 30, 290); ctx.stroke();
    ctx.shadowBlur = 0;

    // Drain zone — pulsing red line
    const drainAlpha = 0.4 + 0.3 * Math.sin(attractFrame * 0.06);
    ctx.strokeStyle = `rgba(255,45,120,${drainAlpha})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(WALL_L, DRAIN_Y); ctx.lineTo(WALL_R, DRAIN_Y); ctx.stroke();
    ctx.setLineDash([]);

    // Top arch / shooter lane entrance — neon cyan ring
    ctx.shadowColor = '#00F5FF';
    ctx.shadowBlur  = 10;
    ctx.strokeStyle = 'rgba(0,245,255,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(LW/2, 40, 80, Math.PI*0.7, Math.PI*2.3);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  /* ── Ramps ───────────────────────────────────────────────── */
  function drawRamps() {
    // Ramp base
    ctx.shadowColor = '#00F5FF';
    ctx.shadowBlur  = 12;
    ctx.strokeStyle = '#004466';
    ctx.lineWidth   = 6;
    ctx.lineCap     = 'round';

    ctx.beginPath();
    ctx.arc(WALL_L + 30, 390, 100, -Math.PI * 0.5, Math.PI * 0.3, false);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(WALL_R - 30, 390, 100, Math.PI * 0.7, Math.PI * 1.5, false);
    ctx.stroke();

    // Neon light strip
    ctx.strokeStyle = C.rampLight;
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.arc(WALL_L + 30, 390, 97, -Math.PI * 0.5, Math.PI * 0.3, false);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(WALL_R - 30, 390, 97, Math.PI * 0.7, Math.PI * 1.5, false);
    ctx.stroke();
    ctx.shadowBlur  = 0;
  }

  /* ── Bumpers ─────────────────────────────────────────────── */
  function drawBumpers() {
    for (const b of bumpers) {
      const lit = b.lit > 0;

      // Outer ring
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r + 4, 0, Math.PI*2);
      ctx.fillStyle = lit ? C.bumperRing : '#1a1a2a';
      ctx.fill();
      if (lit) {
        ctx.shadowColor = C.bumperOn;
        ctx.shadowBlur  = 18;
      }

      // Body
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI*2);
      const grad = ctx.createRadialGradient(b.x - b.r*0.3, b.y - b.r*0.3, 2, b.x, b.y, b.r);
      if (lit) {
        grad.addColorStop(0, '#fff8aa');
        grad.addColorStop(1, C.bumperOn);
      } else {
        grad.addColorStop(0, '#2a2a3a');
        grad.addColorStop(1, C.bumperOff);
      }
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Bumper cap
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 0.45, 0, Math.PI*2);
      ctx.fillStyle = lit ? '#ffffff' : '#3a3a4a';
      ctx.fill();

      // Score label
      ctx.fillStyle = lit ? '#000' : '#666';
      ctx.font = `bold ${b.r * 0.55}px Montserrat,sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.pts, b.x, b.y + 0.5);
    }
    ctx.textBaseline = 'alphabetic';
  }

  /* ── Drop targets ────────────────────────────────────────── */
  function drawDropTargets() {
    for (const t of dropTargets) {
      if (t.down) {
        // Knocked down — just draw a faint outline
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.strokeRect(t.x, t.y + t.h - 2, t.w, 2);
        continue;
      }
      const lit = t.lit > 0 || !!(targetHits & (1 << t.id));
      ctx.fillStyle = lit ? C.targetOn : C.targetOff;
      ctx.fillRect(t.x, t.y, t.w, t.h);
      ctx.strokeStyle = lit ? '#ff88ee' : '#442244';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(t.x, t.y, t.w, t.h);
      if (lit) {
        ctx.shadowColor = C.targetOn;
        ctx.shadowBlur  = 10;
        ctx.fillRect(t.x, t.y, t.w, t.h);
        ctx.shadowBlur  = 0;
      }
    }
  }

  /* ── Slingshots ──────────────────────────────────────────── */
  function drawSlingshots() {
    for (const s of slingshots) {
      const lit = s.lit > 0;
      const wallX = s.side === 'left' ? WALL_L + 30 : WALL_R - 30;

      ctx.beginPath();
      if (s.side === 'left') {
        ctx.moveTo(WALL_L, s.y);
        ctx.lineTo(wallX, s.y);
        ctx.lineTo(wallX, s.y2);
        ctx.lineTo(WALL_L, s.y2);
      } else {
        ctx.moveTo(WALL_R, s.y);
        ctx.lineTo(wallX, s.y);
        ctx.lineTo(wallX, s.y2);
        ctx.lineTo(WALL_R, s.y2);
      }
      ctx.closePath();
      ctx.fillStyle = lit ? 'rgba(0,255,136,0.25)' : 'rgba(0,80,40,0.3)';
      ctx.fill();
      ctx.strokeStyle = lit ? C.slingOn : C.slingOff;
      ctx.lineWidth   = lit ? 2.5 : 1.5;
      if (lit) { ctx.shadowColor = C.slingOn; ctx.shadowBlur = 10; }
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  /* ── Flippers ────────────────────────────────────────────── */
  function drawFlippers() {
    drawFlipper(FL);
    drawFlipper(FR);
  }

  function drawFlipper(f) {
    const ex = f.px + Math.cos(f.ang) * FLIPPER_L * f.dir;
    const ey = f.py + Math.sin(f.ang) * FLIPPER_L;

    ctx.lineCap     = 'round';
    ctx.lineWidth   = 14;
    ctx.strokeStyle = f.active ? C.flipperEdge : C.flipper;
    if (f.active) { ctx.shadowColor = C.flipperEdge; ctx.shadowBlur = 12; }

    ctx.beginPath();
    ctx.moveTo(f.px, f.py);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Tip (narrower)
    ctx.lineWidth   = 7;
    ctx.strokeStyle = f.active ? '#ffaa77' : '#aa2200';
    ctx.beginPath();
    ctx.moveTo(f.px + (ex-f.px)*0.6, f.py + (ey-f.py)*0.6);
    ctx.lineTo(ex, ey);
    ctx.stroke();

    // Pivot dot
    ctx.beginPath();
    ctx.arc(f.px, f.py, 7, 0, Math.PI*2);
    ctx.fillStyle = '#220800';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(f.px, f.py, 4, 0, Math.PI*2);
    ctx.fillStyle = f.active ? C.flipperEdge : C.flipper;
    ctx.fill();
  }

  /* ── Ball ────────────────────────────────────────────────── */
  function drawBall(ball) {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI*2);
    const grad = ctx.createRadialGradient(
      ball.x - ball.r*0.35, ball.y - ball.r*0.35, 1,
      ball.x, ball.y, ball.r
    );
    grad.addColorStop(0, C.ballShine);
    grad.addColorStop(0.4, C.ball);
    grad.addColorStop(1,   C.ballShadow);
    ctx.fillStyle = grad;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur  = 6;
    ctx.fill();
    ctx.shadowBlur  = 0;
  }

  /* ── Plunger ─────────────────────────────────────────────── */
  function drawPlunger() {
    const rodTop = mainBall.y + mainBall.r + 2;
    const rodBot = 650;

    // Rod
    ctx.fillStyle = C.plungerRod;
    ctx.fillRect(PLUNGER_X - 3, rodTop, 6, rodBot - rodTop);

    // Handle
    const handleY = rodBot - plungerCharge * 0.8;
    ctx.beginPath();
    ctx.arc(PLUNGER_X, handleY, 10, 0, Math.PI*2);
    const pg = ctx.createRadialGradient(PLUNGER_X-3, handleY-3, 1, PLUNGER_X, handleY, 10);
    pg.addColorStop(0, '#ccc');
    pg.addColorStop(1, '#555');
    ctx.fillStyle = pg;
    ctx.fill();

    // Power bar
    if (plungerCharge > 0) {
      const bx = PLUNGER_X - 16, by = 655, bh = 25;
      const bw = 32 * (plungerCharge / LAUNCH_POWER_MAX);
      ctx.fillStyle = '#111';
      ctx.fillRect(bx, by, 32, bh);
      const hue = 120 - (plungerCharge / LAUNCH_POWER_MAX) * 120;
      ctx.fillStyle = `hsl(${hue},100%,50%)`;
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, 32, bh);
    }
  }

  /* ── Attract mode animated lights ───────────────────────── */
  function drawAttractLights() {
    const t = attractFrame * 0.05;

    // Top arch marquee — 12 chasing lights
    const cx = LW / 2, cy = 40, r = 80;
    const numLights = 12;
    for (let i = 0; i < numLights; i++) {
      const ang = (Math.PI * 0.7) + ((Math.PI * 1.6) / (numLights - 1)) * i;
      const lx = cx + Math.cos(ang) * r;
      const ly = cy + Math.sin(ang) * r;
      const phase = (t * 2 + i * 0.55) % numLights;
      const lit   = phase < 2.2;
      const hue   = (attractFrame * 3 + i * 30) % 360;

      ctx.beginPath();
      ctx.arc(lx, ly, 4.5, 0, Math.PI * 2);
      if (lit) {
        ctx.shadowColor = `hsl(${hue},100%,60%)`;
        ctx.shadowBlur  = 14;
        ctx.fillStyle   = `hsl(${hue},100%,75%)`;
      } else {
        ctx.shadowBlur = 0;
        ctx.fillStyle  = '#080818';
      }
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Side wall neon dots — stacked chase patterns
    const dotCount = 8;
    for (let i = 0; i < dotCount; i++) {
      const yPos  = 120 + i * 62;
      const phase = (t * 1.8 + i * 0.4) % dotCount;
      const lit   = phase < 1.5;
      const hue   = (attractFrame * 4 + i * 45) % 360;

      // Left wall
      ctx.beginPath();
      ctx.arc(WALL_L - 14, yPos, 3.5, 0, Math.PI * 2);
      if (lit) {
        ctx.shadowColor = `hsl(${hue},100%,60%)`;
        ctx.shadowBlur  = 10;
        ctx.fillStyle   = `hsl(${hue},100%,70%)`;
      } else {
        ctx.shadowBlur = 0;
        ctx.fillStyle  = '#0A0A14';
      }
      ctx.fill();

      // Right wall
      ctx.beginPath();
      ctx.arc(WALL_R + 14, yPos, 3.5, 0, Math.PI * 2);
      if (lit) {
        ctx.shadowColor = `hsl(${hue},100%,60%)`;
        ctx.shadowBlur  = 10;
        ctx.fillStyle   = `hsl(${hue},100%,70%)`;
      } else {
        ctx.shadowBlur = 0;
        ctx.fillStyle  = '#0A0A14';
      }
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  /* ── Ball save indicator ─────────────────────────────────── */
  function drawBallSaveIndicator() {
    if (!ballSaveActive) return;
    const progress = ballSaveTimer / BALL_SAVE_DURATION;
    const barW = (WALL_R - WALL_L - 20) * progress;
    const barX = WALL_L + 10;
    const barY = DRAIN_Y + 4;

    ctx.fillStyle = 'rgba(0,200,255,0.15)';
    ctx.fillRect(barX, barY, WALL_R - WALL_L - 20, 5);

    const hue = 190 + (1 - progress) * 60; // cyan → yellow as it runs out
    ctx.fillStyle = `hsl(${hue},100%,55%)`;
    ctx.shadowColor = `hsl(${hue},100%,55%)`;
    ctx.shadowBlur = 6;
    ctx.fillRect(barX, barY, barW, 5);
    ctx.shadowBlur = 0;

    // Pulsing label
    if (ballSaveTimer % 30 < 20) {
      ctx.fillStyle = `hsla(${hue},100%,70%,0.85)`;
      ctx.font = 'bold 8px Montserrat,sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('BALL SAVE', LW / 2, DRAIN_Y - 3);
    }
  }

  /* ── Skill shot indicator ────────────────────────────────── */
  function drawSkillShotIndicator() {
    if (!skillShotActive) return;
    const progress = skillShotLit / SKILL_SHOT_WINDOW;
    // Pulsing halo around the bumper cluster while skill shot is live
    const pulse = 0.5 + 0.5 * Math.sin(attractFrame * 0.25);
    ctx.strokeStyle = `rgba(255,220,0,${0.3 + 0.4 * pulse})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(200, 205, 75, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;

    // Label
    ctx.fillStyle = `rgba(255,220,0,${0.6 + 0.4 * pulse})`;
    ctx.font = 'bold 9px Montserrat,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SKILL SHOT', LW / 2, 130);
  }

  /* ── Score popups ────────────────────────────────────────── */
  function drawPopups() {
    for (const p of scorePopups) {
      const alpha = p.life / p.maxLife;
      const size  = p.maxLife > 60 ? 13 : 10; // big for mode messages
      ctx.globalAlpha = alpha;
      ctx.fillStyle   = p.maxLife > 60 ? C.bumperOn : C.scoreFlash;
      ctx.font        = `bold ${size}px Montserrat,sans-serif`;
      ctx.textAlign   = 'center';
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }

  /* ══════════════════════════════════════════════════════════
     INPUT
  ══════════════════════════════════════════════════════════ */

  const keys = {};

  document.addEventListener('keydown', e => {
    keys[e.code] = true;

    if (e.code === 'KeyZ' || e.code === 'ArrowLeft')  { FL.active = true; }
    if (e.code === 'KeyX' || e.code === 'ArrowRight') { FR.active = true; }

    if ((e.code === 'KeyP' || e.code === 'Escape') && gameState === 'playing') {
      e.preventDefault(); togglePause();
    }
    if ((e.code === 'KeyP' || e.code === 'Escape') && gameState === 'paused') {
      e.preventDefault(); togglePause();
    }

    if (e.code === 'Space') {
      e.preventDefault();
      if (gameState === 'launch') {
        // Already handled in charge loop below
      }
    }

    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      if (gameState === 'playing' && !tilted) triggerTilt();
    }
  });

  document.addEventListener('keyup', e => {
    keys[e.code] = false;

    if (e.code === 'KeyZ' || e.code === 'ArrowLeft')  { FL.active = false; }
    if (e.code === 'KeyX' || e.code === 'ArrowRight') { FR.active = false; }

    if (e.code === 'Space' && gameState === 'launch') {
      // Release plunger — ball travels straight UP the lane (vx=0) until
      // it clears the lane entrance at y≈100, then curves into the field.
      const vy = -(plungerCharge * 1.05 + 6);
      mainBall.vy = vy;
      mainBall.vx = 0;          // no sideways kick — plunger lane is vertical
      mainBall.x  = PLUNGER_X; // lock X to lane centre so it can't tunnel out
      plungerCharge    = 0;
      plungerReleased  = true;
      gameState        = 'playing';
    }
  });

  // Plunger charging (held space in launch state)
  setInterval(() => {
    if (gameState === 'launch' && keys['Space']) {
      plungerCharge = Math.min(plungerCharge + 0.8, LAUNCH_POWER_MAX);
    }
  }, 16);

  function togglePause() {
    if (gameState === 'playing') {
      gameState = 'paused';
      document.getElementById('btnPause').textContent = 'Resume';
      showOnly(ovPause);
    } else if (gameState === 'paused') {
      gameState = 'playing';
      document.getElementById('btnPause').textContent = 'Pause';
      showOnly(null);
      lastTime = undefined;
    }
  }

  /* ── Button wiring ───────────────────────────────────────── */
  document.getElementById('btnStart').addEventListener('click', initGame);
  document.getElementById('btnRestart').addEventListener('click', initGame);
  document.getElementById('btnNew').addEventListener('click', initGame);
  document.getElementById('btnPause').addEventListener('click', togglePause);
  document.getElementById('btnResume').addEventListener('click', togglePause);
  document.getElementById('btnNextBall').addEventListener('click', () => {
    if (balls > 0) {
      launchNewBall();
      showOnly(null);
      gameState = 'launch';
      updateHUD();
    }
  });

  /* ══════════════════════════════════════════════════════════
     BOOT
  ══════════════════════════════════════════════════════════ */

  highScore  = loadHigh();
  gameState  = 'idle';
  score      = 0;
  balls      = 3;
  ballNum    = 0;
  multiplier = 1;
  currentMode = 'Normal';
  bumpers     = makeBumpers();
  dropTargets = makeDropTargets();
  slingshots  = makeSlingshots();
  mainBall    = makeBall(PLUNGER_X, 620, 0, 0);
  ballsInPlay = [mainBall];
  scorePopups = [];
  targetHits  = 0;
  FL.ang = FLIPPER_DN_ANG; FR.ang = FLIPPER_DN_ANG;
  ballSaveActive   = false;
  ballSaveTimer    = 0;
  skillShotActive  = false;
  skillShotLit     = 0;
  attractFrame     = 0;

  showOnly(ovStart);
  elHigh.textContent = highScore.toLocaleString();
  resize();
  animId = requestAnimationFrame(loop);

})();
