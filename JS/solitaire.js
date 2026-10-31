/* ============================================================
   SOLITAIRE (Klondike) — Mark's Games Studio Edition
   Draw 1 / Draw 3 · Illustrated pips · Undo · Autocomplete
   Timed mode · Win animation (confetti)
   ============================================================ */

(function () {
'use strict';

/* ══════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════ */
const SUITS  = ['♠','♥','♦','♣'];
const RANKS  = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const RED    = new Set(['♥','♦']);
const CARD_W = 72, CARD_H = 100;  // canvas draw resolution

/* ══════════════════════════════════════════════════════════
   CARD CANVAS RENDERER — illustrated pips
══════════════════════════════════════════════════════════ */

// Pip layouts: positions as fractions of card [x, y]
const PIP_LAYOUTS = {
  1:  [[.5, .5]],
  2:  [[.5,.22],[.5,.78]],
  3:  [[.5,.22],[.5,.5],[.5,.78]],
  4:  [[.28,.22],[.72,.22],[.28,.78],[.72,.78]],
  5:  [[.28,.22],[.72,.22],[.5,.5],[.28,.78],[.72,.78]],
  6:  [[.28,.22],[.72,.22],[.28,.5],[.72,.5],[.28,.78],[.72,.78]],
  7:  [[.28,.22],[.72,.22],[.5,.36],[.28,.5],[.72,.5],[.28,.78],[.72,.78]],
  8:  [[.28,.22],[.72,.22],[.5,.33],[.28,.5],[.72,.5],[.5,.67],[.28,.78],[.72,.78]],
  9:  [[.28,.2],[.72,.2],[.28,.38],[.72,.38],[.5,.5],[.28,.62],[.72,.62],[.28,.8],[.72,.8]],
  10: [[.28,.18],[.72,.18],[.5,.3],[.28,.42],[.72,.42],[.28,.58],[.72,.58],[.5,.7],[.28,.82],[.72,.82]],
};

function suitSymbol(suit) { return suit; }

function drawSuitSymbol(ctx, suit, cx, cy, size) {
  ctx.font = `${size}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = RED.has(suit) ? '#C0392B' : '#1A1A1A';
  ctx.fillText(suit, cx, cy);
}

function drawFaceCard(ctx, rank, suit, w, h) {
  const isRed = RED.has(suit);
  const color = isRed ? '#C0392B' : '#1A1A1A';

  // Background
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);

  // Subtle inner border
  ctx.strokeStyle = isRed ? 'rgba(192,57,43,0.12)' : 'rgba(0,0,0,0.08)';
  ctx.lineWidth = 1;
  ctx.strokeRect(3, 3, w - 6, h - 6);

  // Corner rank + suit (top-left)
  ctx.fillStyle = color;
  ctx.font = `bold ${w * 0.18}px 'Montserrat', sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(rank, 5, 4);

  ctx.font = `${w * 0.14}px serif`;
  ctx.fillText(suit, 5, 4 + w * 0.2);

  // Corner rank + suit (bottom-right, rotated)
  ctx.save();
  ctx.translate(w, h);
  ctx.rotate(Math.PI);
  ctx.font = `bold ${w * 0.18}px 'Montserrat', sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = color;
  ctx.fillText(rank, 5, 4);
  ctx.font = `${w * 0.14}px serif`;
  ctx.fillText(suit, 5, 4 + w * 0.2);
  ctx.restore();

  // Center art for J, Q, K
  const cx = w / 2, cy = h / 2;
  if (rank === 'J') {
    ctx.font = `${w * 0.42}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText('♟', cx, cy);
  } else if (rank === 'Q') {
    ctx.font = `${w * 0.42}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText('♛', cx, cy);
  } else if (rank === 'K') {
    ctx.font = `${w * 0.42}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText('♚', cx, cy);
  }
}

function drawPipCard(ctx, rank, suit, w, h) {
  const isRed = RED.has(suit);
  const color = isRed ? '#C0392B' : '#1A1A1A';
  const rankNum = RANKS.indexOf(rank) + 1;

  // Background
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = isRed ? 'rgba(192,57,43,0.12)' : 'rgba(0,0,0,0.08)';
  ctx.lineWidth = 1;
  ctx.strokeRect(3, 3, w - 6, h - 6);

  ctx.fillStyle = color;

  // Corner rank
  ctx.font = `bold ${w * 0.18}px 'Montserrat', sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(rank, 5, 4);
  ctx.font = `${w * 0.14}px serif`;
  ctx.fillText(suit, 5, 4 + w * 0.2);

  ctx.save();
  ctx.translate(w, h);
  ctx.rotate(Math.PI);
  ctx.font = `bold ${w * 0.18}px 'Montserrat', sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(rank, 5, 4);
  ctx.font = `${w * 0.14}px serif`;
  ctx.fillText(suit, 5, 4 + w * 0.2);
  ctx.restore();

  // Ace: big centered suit
  if (rank === 'A') {
    ctx.font = `${w * 0.5}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(suit, w / 2, h / 2);
    return;
  }

  // Pips
  const layout = PIP_LAYOUTS[Math.min(rankNum, 10)];
  const pipSize = w * 0.22;
  if (layout) {
    ctx.font = `${pipSize}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    layout.forEach(([fx, fy]) => {
      ctx.fillText(suit, fx * w, fy * h);
    });
  }
}

function drawBack(ctx, w, h) {
  // Deep blue / dark card back with pattern
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const bg = isDark ? '#1a2540' : '#1e3a5f';

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Inner border
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(4, 4, w - 8, h - 8);

  // Diagonal hatch pattern
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let i = -h; i < w + h; i += 8) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + h, h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i - h, h); ctx.stroke();
  }

  // Center diamond
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.moveTo(w/2, h*0.22);
  ctx.lineTo(w*0.78, h/2);
  ctx.lineTo(w/2, h*0.78);
  ctx.lineTo(w*0.22, h/2);
  ctx.closePath();
  ctx.fill();
}

// Card image cache
const cardCache = new Map();

function getCardCanvas(rank, suit, faceUp) {
  const key = faceUp ? `${rank}${suit}` : 'back';
  if (cardCache.has(key)) return cardCache.get(key);

  const c = document.createElement('canvas');
  c.width = CARD_W; c.height = CARD_H;
  const ctx = c.getContext('2d');

  if (!faceUp) {
    drawBack(ctx, CARD_W, CARD_H);
  } else if (['J','Q','K'].includes(rank)) {
    drawFaceCard(ctx, rank, suit, CARD_W, CARD_H);
  } else {
    drawPipCard(ctx, rank, suit, CARD_W, CARD_H);
  }

  cardCache.set(key, c);
  return c;
}

/* ══════════════════════════════════════════════════════════
   DOM HELPERS
══════════════════════════════════════════════════════════ */
function $(id) { return document.getElementById(id); }

function makeCardEl(card) {
  const div = document.createElement('div');
  div.className = 'sol-card' + (card.faceUp ? '' : ' face-down');
  div.dataset.rank = card.rank;
  div.dataset.suit = card.suit;
  div.dataset.faceUp = card.faceUp ? '1' : '0';

  const src = getCardCanvas(card.rank, card.suit, card.faceUp);
  div.style.width  = 'var(--card-w)';
  div.style.height = 'var(--card-h)';
  div.style.backgroundImage  = `url(${src.toDataURL()})`;
  div.style.backgroundSize   = '100% 100%';
  div.style.backgroundRepeat = 'no-repeat';

  return div;
}

/* ══════════════════════════════════════════════════════════
   GAME STATE
══════════════════════════════════════════════════════════ */
let G = {};

function newDeck() {
  const deck = [];
  for (const suit of SUITS)
    for (const rank of RANKS)
      deck.push({ rank, suit, faceUp: false });
  return shuffle(deck);
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function initGame(drawMode) {
  clearInterval(G.timerInterval);
  G = {
    drawMode:     drawMode || 1,
    stock:        [],
    waste:        [],
    foundations:  [[], [], [], []],  // ♠ ♥ ♦ ♣
    tableau:      [[], [], [], [], [], [], []],
    undoStack:    [],
    moves:        0,
    seconds:      0,
    timerStarted: false,
    timerInterval: null,
    won:          false,
    autoRunning:  false,
  };

  const deck = newDeck();

  // Deal tableau
  for (let col = 0; col < 7; col++) {
    for (let row = 0; row <= col; row++) {
      const card = deck.pop();
      card.faceUp = (row === col);
      G.tableau[col].push(card);
    }
  }

  // Rest to stock (face down)
  G.stock = deck;

  render();
  updateStats();
  $('btnUndo').disabled = true;
  $('btnAutoComplete').style.display = 'none';
}

/* ══════════════════════════════════════════════════════════
   UNDO
══════════════════════════════════════════════════════════ */
function snapshot() {
  return JSON.parse(JSON.stringify({
    stock:       G.stock,
    waste:       G.waste,
    foundations: G.foundations,
    tableau:     G.tableau,
    moves:       G.moves,
  }));
}

function pushUndo() {
  G.undoStack.push(snapshot());
  if (G.undoStack.length > 80) G.undoStack.shift();
  $('btnUndo').disabled = false;
}

function undo() {
  if (!G.undoStack.length) return;
  const s = G.undoStack.pop();
  G.stock       = s.stock;
  G.waste       = s.waste;
  G.foundations = s.foundations;
  G.tableau     = s.tableau;
  G.moves       = s.moves;
  if (!G.undoStack.length) $('btnUndo').disabled = true;
  render();
  updateStats();
}

/* ══════════════════════════════════════════════════════════
   RULES
══════════════════════════════════════════════════════════ */
function rankIndex(r) { return RANKS.indexOf(r); }

function canPlaceOnTableau(card, colCards) {
  if (!colCards.length) return card.rank === 'K';
  const top = colCards[colCards.length - 1];
  if (!top.faceUp) return false;
  return RED.has(card.suit) !== RED.has(top.suit)
      && rankIndex(card.rank) === rankIndex(top.rank) - 1;
}

function canPlaceOnFoundation(card, pile) {
  if (!pile.length) return card.rank === 'A';
  const top = pile[pile.length - 1];
  return card.suit === top.suit
      && rankIndex(card.rank) === rankIndex(top.rank) + 1;
}

function foundationIndexForCard(card) {
  const order = ['♠','♥','♦','♣'];
  return order.indexOf(card.suit);
}

/* ══════════════════════════════════════════════════════════
   STOCK / WASTE
══════════════════════════════════════════════════════════ */
function clickStock() {
  if (G.won) return;
  startTimer();
  pushUndo();

  if (G.stock.length === 0) {
    // Reset: flip waste back to stock
    G.stock = G.waste.slice().reverse().map(c => ({ ...c, faceUp: false }));
    G.waste = [];
  } else {
    const draw = Math.min(G.drawMode, G.stock.length);
    for (let i = 0; i < draw; i++) {
      const c = G.stock.pop();
      c.faceUp = true;
      G.waste.push(c);
    }
    G.moves++;
  }
  render();
  updateStats();
  checkAutoComplete();
}

/* ══════════════════════════════════════════════════════════
   MOVE CARD(S)
══════════════════════════════════════════════════════════ */
// Try to auto-move top waste or tapped tableau card to foundation
function tryAutoToFoundation(card) {
  const fi = foundationIndexForCard(card);
  if (canPlaceOnFoundation(card, G.foundations[fi])) return fi;
  return -1;
}

function moveWasteToFoundation() {
  if (!G.waste.length) return false;
  const card = G.waste[G.waste.length - 1];
  const fi = tryAutoToFoundation(card);
  if (fi < 0) return false;
  pushUndo();
  G.foundations[fi].push(G.waste.pop());
  G.moves++;
  render();
  updateStats();
  checkWin();
  checkAutoComplete();
  return true;
}

function moveWasteToTableau(colIdx) {
  if (!G.waste.length) return false;
  const card = G.waste[G.waste.length - 1];
  if (!canPlaceOnTableau(card, G.tableau[colIdx])) return false;
  pushUndo();
  G.tableau[colIdx].push(G.waste.pop());
  G.moves++;
  render();
  updateStats();
  checkAutoComplete();
  return true;
}

function moveTableauToFoundation(colIdx) {
  const col = G.tableau[colIdx];
  if (!col.length) return false;
  const card = col[col.length - 1];
  if (!card.faceUp) return false;
  const fi = tryAutoToFoundation(card);
  if (fi < 0) return false;
  pushUndo();
  G.foundations[fi].push(col.pop());
  flipTopTableau(colIdx);
  G.moves++;
  render();
  updateStats();
  checkWin();
  checkAutoComplete();
  return true;
}

function moveTableauToTableau(fromCol, cardIdx, toCol) {
  const from = G.tableau[fromCol];
  const to   = G.tableau[toCol];
  const cards = from.slice(cardIdx);
  if (!canPlaceOnTableau(cards[0], to)) return false;
  pushUndo();
  G.tableau[toCol] = to.concat(cards);
  G.tableau[fromCol] = from.slice(0, cardIdx);
  flipTopTableau(fromCol);
  G.moves++;
  render();
  updateStats();
  checkAutoComplete();
  return true;
}

function flipTopTableau(colIdx) {
  const col = G.tableau[colIdx];
  if (col.length && !col[col.length - 1].faceUp) {
    col[col.length - 1].faceUp = true;
  }
}

/* ══════════════════════════════════════════════════════════
   AUTO-COMPLETE
══════════════════════════════════════════════════════════ */
function canAutoComplete() {
  // All tableau cards must be face-up
  for (const col of G.tableau)
    for (const card of col)
      if (!card.faceUp) return false;
  return true;
}

function checkAutoComplete() {
  if (canAutoComplete() && !G.won) {
    $('btnAutoComplete').style.display = 'flex';
  }
}

function autoCompleteStep() {
  if (G.won) return;

  // Try waste → foundation
  if (G.waste.length) {
    const card = G.waste[G.waste.length - 1];
    const fi = tryAutoToFoundation(card);
    if (fi >= 0) {
      G.foundations[fi].push(G.waste.pop());
      G.moves++;
      render(); updateStats();
      if (checkWin()) return;
      setTimeout(autoCompleteStep, 80);
      return;
    }
  }

  // Try stock → waste, then foundation
  if (G.stock.length) {
    const c = G.stock.pop(); c.faceUp = true; G.waste.push(c);
    const fi = tryAutoToFoundation(c);
    if (fi >= 0) {
      G.foundations[fi].push(G.waste.pop());
      G.moves++;
      render(); updateStats();
      if (checkWin()) return;
      setTimeout(autoCompleteStep, 80);
      return;
    }
  }

  // Try each tableau col top card → foundation
  for (let ci = 0; ci < 7; ci++) {
    const col = G.tableau[ci];
    if (!col.length) continue;
    const card = col[col.length - 1];
    if (!card.faceUp) continue;
    const fi = tryAutoToFoundation(card);
    if (fi >= 0) {
      G.foundations[fi].push(col.pop());
      G.moves++;
      render(); updateStats();
      if (checkWin()) return;
      setTimeout(autoCompleteStep, 80);
      return;
    }
  }
}

/* ══════════════════════════════════════════════════════════
   WIN CHECK
══════════════════════════════════════════════════════════ */
function checkWin() {
  if (G.foundations.every(f => f.length === 13)) {
    G.won = true;
    clearInterval(G.timerInterval);
    $('btnAutoComplete').style.display = 'none';
    setTimeout(triggerWin, 300);
    return true;
  }
  return false;
}

/* ══════════════════════════════════════════════════════════
   TIMER
══════════════════════════════════════════════════════════ */
function startTimer() {
  if (G.timerStarted) return;
  G.timerStarted = true;
  G.timerInterval = setInterval(() => {
    G.seconds++;
    updateStats();
  }, 1000);
}

function fmtTime(s) {
  const m = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, '0');
  return `${m}:${ss}`;
}

function updateStats() {
  $('timerDisplay').textContent = fmtTime(G.seconds);
  $('movesDisplay').textContent = G.moves;
}

/* ══════════════════════════════════════════════════════════
   RENDER
══════════════════════════════════════════════════════════ */
function render() {
  renderStock();
  renderWaste();
  renderFoundations();
  renderTableau();
}

function renderStock() {
  const el = $('stock');
  el.innerHTML = '';
  el.className = 'sol-zone stock-zone' + (G.stock.length === 0 ? ' empty' : '');
  if (G.stock.length > 0) {
    const card = makeCardEl({ rank: 'X', suit: '♠', faceUp: false });
    card.style.position = 'relative';
    el.appendChild(card);
  }
}

function renderWaste() {
  const el = $('waste');
  el.innerHTML = '';
  el.className = 'sol-zone waste-zone';
  if (G.waste.length === 0) return;

  // Show up to 3 fanned cards in draw-3 mode
  const show = G.drawMode === 3 ? Math.min(3, G.waste.length) : 1;
  const startIdx = G.waste.length - show;
  const FAN_OFFSET = G.drawMode === 3 ? 18 : 0;

  for (let i = 0; i < show; i++) {
    const card = G.waste[startIdx + i];
    const cardEl = makeCardEl(card);
    cardEl.style.position = 'absolute';
    cardEl.style.left = (i * FAN_OFFSET) + 'px';
    cardEl.style.top = '0';
    cardEl.style.zIndex = i + 1;
    if (i === show - 1) {
      cardEl.dataset.source = 'waste';
      cardEl.dataset.idx = String(G.waste.length - 1);
    } else {
      cardEl.style.pointerEvents = 'none';
    }
    el.appendChild(cardEl);
  }
}

function renderFoundations() {
  const order = ['♠','♥','♦','♣'];
  for (let fi = 0; fi < 4; fi++) {
    const el = $(`f${fi}`);
    el.innerHTML = '';
    el.dataset.suit = order[fi];
    el.className = 'sol-zone foundation-zone';
    const pile = G.foundations[fi];
    if (pile.length) {
      const card = pile[pile.length - 1];
      const cardEl = makeCardEl({ ...card, faceUp: true });
      cardEl.style.position = 'relative';
      cardEl.dataset.source = `foundation:${fi}`;
      el.appendChild(cardEl);
    }
  }
}

function renderTableau() {
  const PEEK = getCSSVar('--peek');
  const FAN  = getCSSVar('--fan');

  for (let ci = 0; ci < 7; ci++) {
    const col = G.tableau[ci];
    const el = $(`t${ci}`);
    el.innerHTML = '';

    // Set column height so parent doesn't clip
    const faceDownCount = col.filter(c => !c.faceUp).length;
    const faceUpCount   = col.filter(c =>  c.faceUp).length;
    const colH = col.length === 0 ? CARD_H
      : faceDownCount * PEEK + Math.max(faceUpCount - 1, 0) * FAN + CARD_H;
    el.style.height = colH + 'px';

    let yOffset = 0;
    for (let i = 0; i < col.length; i++) {
      const card = col[i];
      const cardEl = makeCardEl(card);
      cardEl.style.top  = yOffset + 'px';
      cardEl.style.left = '0';
      cardEl.style.zIndex = i + 1;
      cardEl.dataset.source = `tableau:${ci}:${i}`;

      el.appendChild(cardEl);
      yOffset += card.faceUp ? FAN : PEEK;
    }
  }
}

function getCSSVar(name) {
  return parseInt(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;
}

/* ══════════════════════════════════════════════════════════
   DRAG AND DROP
══════════════════════════════════════════════════════════ */
let drag = null;
const ghost = $('dragGhost');

function startDrag(e, source, cards, originEl) {
  if (!cards.length) return;
  e.preventDefault();

  const cardW = getCSSVar('--card-w') || 72;
  const cardH = getCSSVar('--card-h') || 100;
  const FAN   = getCSSVar('--fan') || 28;
  const totalH = (cards.length - 1) * FAN + cardH;

  // Build ghost
  ghost.innerHTML = '';
  ghost.style.width  = cardW + 'px';
  ghost.style.height = totalH + 'px';
  ghost.classList.remove('hidden');

  cards.forEach((card, i) => {
    const src = getCardCanvas(card.rank, card.suit, card.faceUp);
    const img = document.createElement('div');
    img.style.cssText = `
      position:absolute; top:${i * FAN}px; left:0;
      width:${cardW}px; height:${cardH}px;
      background:url(${src.toDataURL()}) 100% 100% / 100% 100%;
      border-radius:${getCSSVar('--card-radius') || 7}px;
      box-shadow:0 6px 20px rgba(0,0,0,0.35);
    `;
    ghost.appendChild(img);
  });

  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;

  drag = {
    source,
    cards,
    originEl,
    offsetX: cardW / 2,
    offsetY: 20,
  };

  moveGhost(clientX, clientY);
  originEl.style.opacity = '0.35';
}

function moveGhost(x, y) {
  ghost.style.left = (x - drag.offsetX) + 'px';
  ghost.style.top  = (y - drag.offsetY) + 'px';
}

function endDrag(e) {
  if (!drag) return;

  ghost.classList.add('hidden');
  ghost.innerHTML = '';
  drag.originEl.style.opacity = '';

  const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
  const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;

  // Find drop target
  const target = getDropTarget(clientX, clientY);

  if (target) {
    dropCards(drag.source, drag.cards, target);
  }

  drag = null;
}

function getDropTarget(x, y) {
  // Check foundations
  for (let fi = 0; fi < 4; fi++) {
    const el = $(`f${fi}`);
    const r = el.getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom)
      return { type: 'foundation', idx: fi };
  }
  // Check tableau columns
  for (let ci = 0; ci < 7; ci++) {
    const el = $(`t${ci}`);
    const r = el.getBoundingClientRect();
    // expand hit area downward since columns can be short
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom + 80)
      return { type: 'tableau', idx: ci };
  }
  return null;
}

function dropCards(source, cards, target) {
  if (!startTimer || !G.timerStarted) startTimer();

  if (target.type === 'foundation') {
    if (cards.length !== 1) return;
    const card = cards[0];
    if (!canPlaceOnFoundation(card, G.foundations[target.idx])) return;

    pushUndo();

    if (source.type === 'waste') {
      G.waste.pop();
    } else if (source.type === 'tableau') {
      G.tableau[source.col].pop();
      flipTopTableau(source.col);
    } else if (source.type === 'foundation') {
      G.foundations[source.idx].pop();
    }

    G.foundations[target.idx].push(card);
    G.moves++;
    startTimer();
    render();
    updateStats();
    checkWin();
    checkAutoComplete();

  } else if (target.type === 'tableau') {
    if (!canPlaceOnTableau(cards[0], G.tableau[target.idx])) return;

    pushUndo();

    if (source.type === 'waste') {
      G.waste.pop();
    } else if (source.type === 'tableau') {
      const col = G.tableau[source.col];
      G.tableau[source.col] = col.slice(0, source.cardIdx);
      flipTopTableau(source.col);
    } else if (source.type === 'foundation') {
      G.foundations[source.idx].pop();
    }

    G.tableau[target.idx].push(...cards);
    G.moves++;
    startTimer();
    render();
    updateStats();
    checkAutoComplete();
  }
}

/* ══════════════════════════════════════════════════════════
   CLICK HANDLING (double-click to auto-move)
══════════════════════════════════════════════════════════ */
let lastTap = { el: null, time: 0 };

function handleCardClick(e) {
  const cardEl = e.currentTarget;
  const source = cardEl.dataset.source;
  if (!source) return;
  startTimer();

  const now = Date.now();
  const isDouble = (lastTap.el === cardEl && now - lastTap.time < 400);
  lastTap = { el: cardEl, time: now };

  if (isDouble) {
    handleDoubleClick(source);
    return;
  }

  // Single click on face-down tableau card → flip
  if (source.startsWith('tableau:')) {
    const [, col, idx] = source.split(':').map(Number);
    const card = G.tableau[col][idx];
    if (!card.faceUp && idx === G.tableau[col].length - 1) {
      pushUndo();
      card.faceUp = true;
      G.moves++;
      render(); updateStats();
    }
  }
}

function handleDoubleClick(source) {
  if (source === 'waste') {
    moveWasteToFoundation();
    return;
  }
  if (source.startsWith('tableau:')) {
    const [, col] = source.split(':').map(Number);
    moveTableauToFoundation(col);
  }
}

/* ══════════════════════════════════════════════════════════
   EVENT WIRING
══════════════════════════════════════════════════════════ */
function attachDragListeners() {
  document.addEventListener('mousemove', e => {
    if (!drag) return;
    moveGhost(e.clientX, e.clientY);
  });
  document.addEventListener('mouseup', endDrag);
  document.addEventListener('touchmove', e => {
    if (!drag) return;
    e.preventDefault();
    moveGhost(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: false });
  document.addEventListener('touchend', endDrag);

  // Delegate from table
  const table = $('solTable');
  table.addEventListener('mousedown', onPointerDown);
  table.addEventListener('touchstart', onPointerDown, { passive: false });

  // Stock click
  $('stock').addEventListener('click', clickStock);
  $('stock').addEventListener('touchend', e => { e.preventDefault(); clickStock(); });

  // Waste click (top card)
  $('waste').addEventListener('mousedown', e => {
    const cardEl = e.target.closest('.sol-card');
    if (!cardEl || cardEl.dataset.source !== 'waste') return;
    startDragFromEl(e, cardEl);
  });
  $('waste').addEventListener('touchstart', e => {
    const cardEl = e.target.closest('.sol-card');
    if (!cardEl || cardEl.dataset.source !== 'waste') return;
    e.preventDefault();
    startDragFromEl(e, cardEl);
  }, { passive: false });

  // Waste click for single-click move
  $('waste').addEventListener('click', e => {
    const cardEl = e.target.closest('.sol-card');
    if (!cardEl) return;
    handleCardClick({ currentTarget: cardEl });
  });

  // Foundation drag
  for (let fi = 0; fi < 4; fi++) {
    const el = $(`f${fi}`);
    el.addEventListener('mousedown', e => {
      const cardEl = e.target.closest('.sol-card');
      if (cardEl) startDragFromEl(e, cardEl, 'foundation', fi);
    });
  }
}

function onPointerDown(e) {
  const cardEl = e.target.closest('.sol-card');
  if (!cardEl) return;
  const source = cardEl.dataset.source;
  if (!source || !source.startsWith('tableau:')) return;

  const [, colStr, idxStr] = source.split(':');
  const col = parseInt(colStr), idx = parseInt(idxStr);
  const card = G.tableau[col][idx];
  if (!card.faceUp) {
    // Face-down: click to flip, but only if topmost
    if (idx === G.tableau[col].length - 1) {
      if (e.type === 'mousedown') {
        cardEl.addEventListener('click', handleCardClick, { once: true });
      }
    }
    return;
  }

  // Start drag of card + all below it in column
  const cards = G.tableau[col].slice(idx);
  startDrag(e, { type: 'tableau', col, cardIdx: idx }, cards, cardEl);
}

function startDragFromEl(e, cardEl, type, idx) {
  if (type === 'foundation') {
    const fi = idx;
    const pile = G.foundations[fi];
    if (!pile.length) return;
    startDrag(e, { type: 'foundation', idx: fi }, [pile[pile.length - 1]], cardEl);
  } else {
    // waste
    if (!G.waste.length) return;
    startDrag(e, { type: 'waste' }, [G.waste[G.waste.length - 1]], cardEl);
  }
}

/* ══════════════════════════════════════════════════════════
   WIN ANIMATION — confetti
══════════════════════════════════════════════════════════ */
function triggerWin() {
  const overlay = $('winOverlay');
  overlay.classList.remove('hidden');

  const elapsed = fmtTime(G.seconds);
  $('winStats').textContent = `${G.moves} moves  ·  ${elapsed}`;

  const canvas = $('confettiCanvas');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');

  const COLORS = ['#BC4B51','#F7C948','#5BCC6E','#4DD9E0','#B36BE0','#F0944D','#5A7FE0'];
  const pieces = Array.from({ length: 160 }, () => ({
    x:  Math.random() * canvas.width,
    y:  Math.random() * canvas.height - canvas.height,
    r:  Math.random() * 6 + 3,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    vx: (Math.random() - 0.5) * 3,
    vy: Math.random() * 4 + 2,
    rot: Math.random() * Math.PI * 2,
    vr: (Math.random() - 0.5) * 0.2,
    shape: Math.random() > 0.5 ? 'rect' : 'circle',
    w: Math.random() * 10 + 5,
    h: Math.random() * 6 + 3,
  }));

  let frame = 0;
  function animate() {
    if (frame++ > 300) { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => {
      p.x  += p.vx;
      p.y  += p.vy;
      p.rot += p.vr;
      if (p.y > canvas.height) { p.y = -10; p.x = Math.random() * canvas.width; }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, 1 - frame / 280);
      if (p.shape === 'rect') {
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
    requestAnimationFrame(animate);
  }
  animate();
}

/* ══════════════════════════════════════════════════════════
   SETUP UI
══════════════════════════════════════════════════════════ */
let chosenDraw = 1;

document.querySelectorAll('#drawOpts .sol-opt').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#drawOpts .sol-opt').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    chosenDraw = parseInt(btn.dataset.val);
  });
});

$('btnDeal').addEventListener('click', () => {
  $('setupModal').classList.add('hidden');
  $('gameWrap').classList.remove('hidden');
  cardCache.clear();
  initGame(chosenDraw);
  attachDragListeners();
});

$('btnNew').addEventListener('click', () => {
  $('setupModal').classList.remove('hidden');
  $('gameWrap').classList.add('hidden');
  $('winOverlay').classList.add('hidden');
  clearInterval(G.timerInterval);
  G = {};
});

$('btnWinNew').addEventListener('click', () => {
  $('winOverlay').classList.add('hidden');
  $('setupModal').classList.remove('hidden');
  $('gameWrap').classList.add('hidden');
  clearInterval(G.timerInterval);
  G = {};
});

$('btnUndo').addEventListener('click', undo);
$('btnUndo').disabled = true;

$('btnAutoComplete').addEventListener('click', () => {
  $('btnAutoComplete').style.display = 'none';
  autoCompleteStep();
});

})();
