/* ============================================================
   CHESS — Mark's Silly Games
   Full chess engine: legal move generation, Stockfish WASM,
   pre-game setup modal, timers, move history (SAN),
   captured pieces, promotion, drag & drop
   ============================================================ */

'use strict';

// ── PIECE UNICODE ─────────────────────────────────────────
const GLYPHS = {
  wK:'♔', wQ:'♕', wR:'♖', wB:'♗', wN:'♘', wP:'♙',
  bK:'♚', bQ:'♛', bR:'♜', bB:'♝', bN:'♞', bP:'♟'
};
const PIECE_VALUES = { P:1, N:3, B:3, R:5, Q:9, K:0 };

// ── GAME STATE ────────────────────────────────────────────
let board = [];
let turn = 'w';
let selected = null;
let legalMoves = [];
let lastMove = null;
let gameOver = false;
let checkmateColor = null;    // colour of the mated king ('w' or 'b')
let checkmateAttacker = null; // {r,c} of the piece that delivered mate
const botPositionHistory = [];
let moveHistory = [];
let fenHistory = [];
let halfmoveClock = 0;
let fullmoveNumber = 1;
let positionCounts = {};
let castling = { wK:true, wQ:true, bK:true, bQ:true };
let enPassant = null;

// Timer
let timerInterval = null;
let timeW = 600;
let timeB = 600;
let timeControl = 600;

// Setup selections
let setupMode     = 'bot';
let setupDiff     = 'intermediate';
let setupColor    = 'white';
let setupTime     = 600;

// Active game settings (locked in at start)
let gameMode      = 'bot';
let difficulty    = 'intermediate';
let playerColor   = 'white';

// Review mode
let reviewMode    = false;
let reviewIndex   = -1; // which move index we're viewing (-1 = live)

// Stockfish
let stockfish     = null;
let sfReady       = false;
let sfCallback    = null;
let botMoveTimeout = null;
let currentGameId = 0; // incremented on every newGame(); guards stale SF callbacks

// ── DRAG STATE ────────────────────────────────────────────
let dragFrom  = null;
let dragPiece = null;
let isDragging = false;
// Always look up drag-ghost fresh — the router rebuilds the DOM on each game load
// so a cached reference would point to a detached (dead) element after the first game.
function getGhost() {
  return document.getElementById('drag-ghost');
}

// ── INIT ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initStockfish();
  showSetup();
});

// ── SETUP MODAL ───────────────────────────────────────────
function showSetup() {
  clearInterval(timerInterval);
  document.getElementById('setup-overlay').classList.remove('hidden');
  syncSetupUI();
}

function syncSetupUI() {
  // Show/hide bot-only fields
  const isBot = setupMode === 'bot';
  document.getElementById('setup-diff-field').classList.toggle('hidden', !isBot);
  document.getElementById('setup-color-field').classList.toggle('hidden', !isBot);
}

function selectSetup(field, val, btn) {
  if (field === 'mode')  setupMode  = val;
  if (field === 'diff')  setupDiff  = val;
  if (field === 'color') setupColor = val;
  if (field === 'time')  setupTime  = parseInt(val);

  // Update active state in that group
  const groupId = { mode:'setup-mode-options', diff:'setup-diff-options', color:'setup-color-options', time:'setup-time-options' }[field];
  document.getElementById(groupId).querySelectorAll('.setup-opt').forEach(b => {
    b.classList.toggle('active', b.dataset.val === val);
  });

  syncSetupUI();
}

function startGameFromSetup() {
  // Resolve random color
  let resolvedColor = setupColor;
  if (setupMode === 'bot' && setupColor === 'random') {
    resolvedColor = Math.random() < 0.5 ? 'white' : 'black';
  }

  gameMode    = setupMode;
  difficulty  = setupDiff;
  playerColor = resolvedColor;
  timeControl = setupTime;

  document.getElementById('setup-overlay').classList.add('hidden');
  newGame();
}

// ── NEW GAME ──────────────────────────────────────────────
function newGame() {
  clearInterval(timerInterval);
  clearTimeout(botMoveTimeout);
  // Cancel any in-flight Stockfish search so it can't corrupt the new game
  if (stockfish) stockfish.postMessage('stop');
  // Remove any stale drag listeners that might have survived a mid-drag page transition
  document.removeEventListener('mousemove', onDocMousemove);
  document.removeEventListener('mouseup',   onDocMouseup);
  document.removeEventListener('touchmove', onDocTouchmove);
  document.removeEventListener('touchend',  onDocTouchend);
  dragFrom = null; dragPiece = null; isDragging = false;
  sfCallback = null;
  currentGameId++;           // invalidate any stale callbacks from the previous game

  gameOver = false;
  checkmateColor = null;
  checkmateAttacker = null;
  reviewMode = false;
  reviewIndex = -1;
  hideReviewBar();
  moveHistory = [];
  positionCounts = {};
  botPositionHistory.length = 0;
  halfmoveClock = 0;
  fullmoveNumber = 1;

  // Pick a fresh opening line for this game
  chooseOpening(difficulty);

  setupStartPosition();
  renderBoard();
  resetTimers();
  renderMoveHistory();
  renderCaptured();
  updatePlayerNames();
  updateGameInfo();

  document.getElementById('overlay').classList.add('hidden');
  document.getElementById('resign-overlay').classList.add('hidden');
  document.getElementById('promo-modal').classList.add('hidden');
  document.getElementById('engine-status-wrap').style.display = gameMode === 'bot' ? 'block' : 'none';

  setStatus('Get ready…');
  document.getElementById('btn-undo').disabled = true;
  document.getElementById('btn-resign').disabled = true;

  startCountdown(() => {
    document.getElementById('btn-undo').disabled = false;
    document.getElementById('btn-resign').disabled = false;
    setStatus('White to move');
    if (timeControl > 0) startTimer();
    if (gameMode === 'bot' && playerColor === 'black') {
      setTimeout(() => triggerBotMove(), 400);
    }
  });
}

function rematchGame() {
  // Re-use same settings, just restart
  document.getElementById('overlay').classList.add('hidden');
  newGame();
}

// ── COUNTDOWN ─────────────────────────────────────────────
function startCountdown(callback) {
  const overlay = document.getElementById('countdown-overlay');
  const numEl   = document.getElementById('countdown-number');
  let count = 3;

  overlay.classList.remove('hidden');
  numEl.textContent = count;
  numEl.classList.remove('pop');
  void numEl.offsetWidth; // reflow
  numEl.classList.add('pop');

  const interval = setInterval(() => {
    count--;
    if (count <= 0) {
      clearInterval(interval);
      numEl.textContent = 'Go!';
      numEl.classList.remove('pop');
      void numEl.offsetWidth;
      numEl.classList.add('pop');
      setTimeout(() => {
        overlay.classList.add('hidden');
        callback();
      }, 600);
    } else {
      numEl.textContent = count;
      numEl.classList.remove('pop');
      void numEl.offsetWidth;
      numEl.classList.add('pop');
    }
  }, 800);
}

function setupStartPosition() {
  board = Array.from({length:8}, () => Array(8).fill(null));
  castling = { wK:true, wQ:true, bK:true, bQ:true };
  enPassant = null;
  turn = 'w';
  selected = null;
  legalMoves = [];
  lastMove = null;

  const backRank = ['R','N','B','Q','K','B','N','R'];
  for (let c = 0; c < 8; c++) {
    board[0][c] = 'b' + backRank[c];
    board[1][c] = 'bP';
    board[6][c] = 'wP';
    board[7][c] = 'w' + backRank[c];
  }

  // Save AFTER pieces are placed so undo on move 1 restores proper start position
  fenHistory = [JSON.stringify({
    board: board.map(r=>[...r]),
    turn, castling:{...castling}, enPassant,
    halfmoveClock, fullmoveNumber, lastMove
  })];
}

function updateGameInfo() {
  const modeEl = document.getElementById('info-mode');
  const timeEl = document.getElementById('info-time');
  if (gameMode === 'bot') {
    const diffNames = { beginner:'Beginner', intermediate:'Intermediate', master:'Master' };
    modeEl.textContent = 'You vs ' + diffNames[difficulty] + ' Bot';
    modeEl.textContent += ' (' + (playerColor === 'white' ? 'White' : 'Black') + ')';
  } else {
    modeEl.textContent = 'White vs Black (Local)';
  }
  timeEl.textContent = timeControl === 0 ? 'No time limit' : formatTime(timeControl) + ' per side';
}

// ── BOARD RENDERING ───────────────────────────────────────
function renderBoard() {
  const boardEl = document.getElementById('board');
  boardEl.innerHTML = '';
  const flipped = (gameMode === 'bot' && playerColor === 'black');

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const dr = flipped ? 7 - r : r;
      const dc = flipped ? 7 - c : c;

      const sq = document.createElement('div');
      sq.className = 'sq ' + ((dr + dc) % 2 === 0 ? 'light' : 'dark');
      sq.dataset.r = dr;
      sq.dataset.c = dc;

      if (selected && selected.r === dr && selected.c === dc) sq.classList.add('selected');
      if (lastMove) {
        if ((lastMove.from.r===dr&&lastMove.from.c===dc)||(lastMove.to.r===dr&&lastMove.to.c===dc))
          sq.classList.add('last-move');
      }
      const isMove = legalMoves.find(m => m.r===dr && m.c===dc);
      if (isMove) sq.classList.add(board[dr][dc] ? 'move-capture' : 'move-target');

      if (isKingInCheck(turn)) {
        const kp = findKing(turn);
        if (kp && kp.r===dr && kp.c===dc) sq.classList.add('in-check');
      }

      // Checkmate highlights — pulse the mated king and the attacking piece
      if (checkmateColor) {
        const kp = findKing(checkmateColor);
        if (kp && kp.r===dr && kp.c===dc) sq.classList.add('in-checkmate');
      }
      if (checkmateAttacker && checkmateAttacker.r===dr && checkmateAttacker.c===dc) {
        sq.classList.add('checkmate-attacker');
      }

      const piece = board[dr][dc];
      if (piece) {
        const pieceEl = document.createElement('span');
        pieceEl.className = 'piece';
        pieceEl.textContent = GLYPHS[piece];
        pieceEl.dataset.r = dr;
        pieceEl.dataset.c = dc;
        pieceEl.dataset.color = piece[0]; // 'w' or 'b' for CSS styling
        pieceEl.addEventListener('mousedown', onPieceMousedown);
        pieceEl.addEventListener('touchstart', onPieceTouchstart, {passive:false});
        sq.appendChild(pieceEl);
      }

      sq.addEventListener('click', onSquareClick);
      // Allow drop
      sq.addEventListener('dragover', e => e.preventDefault());
      boardEl.appendChild(sq);
    }
  }
  renderCoords(flipped);
}

function renderCoords(flipped) {
  const rankEl = document.getElementById('coords-rank');
  const fileEl = document.getElementById('coords-file');
  rankEl.innerHTML = ''; fileEl.innerHTML = '';
  const ranks = flipped ? ['1','2','3','4','5','6','7','8'] : ['8','7','6','5','4','3','2','1'];
  const files = flipped ? ['h','g','f','e','d','c','b','a'] : ['a','b','c','d','e','f','g','h'];
  ranks.forEach(r => { const s=document.createElement('span'); s.className='coord-label'; s.textContent=r; rankEl.appendChild(s); });
  files.forEach(f => { const s=document.createElement('span'); s.className='coord-label'; s.textContent=f; fileEl.appendChild(s); });
}

// ── CLICK INTERACTION ─────────────────────────────────────
function onSquareClick(e) {
  if (isDragging) return; // don't process click after drag
  if (gameOver) return;
  const sq = e.currentTarget;
  const r = parseInt(sq.dataset.r);
  const c = parseInt(sq.dataset.c);
  handleSquareSelect(r, c);
}

function handleSquareSelect(r, c) {
  if (reviewMode) return;
  if (gameOver) return;
  if (gameMode === 'bot' && ((turn==='w') !== (playerColor==='white'))) return;

  const piece = board[r][c];

  if (selected) {
    const move = legalMoves.find(m => m.r===r && m.c===c);
    if (move) {
      executeMove(selected.r, selected.c, r, c, move.special);
      return;
    }
    if (piece && piece[0] === turn) {
      selected = {r, c};
      legalMoves = getLegalMoves(r, c);
      renderBoard();
      return;
    }
    selected = null; legalMoves = [];
    renderBoard();
    return;
  }

  if (piece && piece[0] === turn) {
    selected = {r, c};
    legalMoves = getLegalMoves(r, c);
    renderBoard();
  }
}

// ── DRAG & DROP ───────────────────────────────────────────
function canDragPiece(r, c) {
  if (reviewMode) return false;
  if (gameOver) return false;
  const piece = board[r][c];
  if (!piece || piece[0] !== turn) return false;
  if (gameMode === 'bot' && ((turn==='w') !== (playerColor==='white'))) return false;
  return true;
}

function onPieceMousedown(e) {
  const r = parseInt(e.currentTarget.dataset.r);
  const c = parseInt(e.currentTarget.dataset.c);
  if (!canDragPiece(r, c)) return;
  e.preventDefault();

  isDragging = false;
  dragFrom = {r, c};
  dragPiece = board[r][c];

  // Highlight selected + legal moves immediately
  selected = {r, c};
  legalMoves = getLegalMoves(r, c);
  renderBoard();

  const ghost1 = getGhost();
  if (ghost1) { ghost1.textContent = GLYPHS[dragPiece]; ghost1.style.display = 'block'; }
  positionGhost(e.clientX, e.clientY);

  document.addEventListener('mousemove', onDocMousemove);
  document.addEventListener('mouseup', onDocMouseup);
}

function onPieceTouchstart(e) {
  const r = parseInt(e.currentTarget.dataset.r);
  const c = parseInt(e.currentTarget.dataset.c);
  if (!canDragPiece(r, c)) return;
  e.preventDefault();

  isDragging = false;
  dragFrom = {r, c};
  dragPiece = board[r][c];

  selected = {r, c};
  legalMoves = getLegalMoves(r, c);
  renderBoard();

  const t = e.touches[0];
  const ghost2 = getGhost();
  if (ghost2) { ghost2.textContent = GLYPHS[dragPiece]; ghost2.style.display = 'block'; }
  positionGhost(t.clientX, t.clientY);

  document.addEventListener('touchmove', onDocTouchmove, {passive:false});
  document.addEventListener('touchend', onDocTouchend);
}

function onDocMousemove(e) {
  isDragging = true;
  positionGhost(e.clientX, e.clientY);
  // Dim the piece on board
  const pieceEl = document.querySelector(`.piece[data-r="${dragFrom.r}"][data-c="${dragFrom.c}"]`);
  if (pieceEl) pieceEl.style.opacity = '0.2';
}

function onDocTouchmove(e) {
  e.preventDefault();
  isDragging = true;
  const t = e.touches[0];
  positionGhost(t.clientX, t.clientY);
  const pieceEl = document.querySelector(`.piece[data-r="${dragFrom.r}"][data-c="${dragFrom.c}"]`);
  if (pieceEl) pieceEl.style.opacity = '0.2';
}

function positionGhost(x, y) {
  const g = getGhost();
  if (!g) return;
  g.style.left = x + 'px';
  g.style.top  = y + 'px';
}

function onDocMouseup(e) {
  document.removeEventListener('mousemove', onDocMousemove);
  document.removeEventListener('mouseup', onDocMouseup);
  finishDrag(e.clientX, e.clientY);
}

function onDocTouchend(e) {
  document.removeEventListener('touchmove', onDocTouchmove);
  document.removeEventListener('touchend', onDocTouchend);
  const t = e.changedTouches[0];
  finishDrag(t.clientX, t.clientY);
}

function finishDrag(x, y) {
  const g = getGhost();
  if (g) g.style.display = 'none';
  if (!dragFrom) { isDragging = false; return; }

  const el = document.elementFromPoint(x, y);
  const sqEl = el && (el.classList.contains('sq') ? el : el.closest('.sq'));

  if (sqEl && isDragging) {
    const tr = parseInt(sqEl.dataset.r);
    const tc = parseInt(sqEl.dataset.c);
    const move = legalMoves.find(m => m.r===tr && m.c===tc);
    if (move && (tr !== dragFrom.r || tc !== dragFrom.c)) {
      dragFrom = null; dragPiece = null;
      isDragging = false;
      executeMove(selected.r, selected.c, tr, tc, move.special);
      return;
    }
  }

  // Drop back on same square or invalid — keep selected
  dragFrom = null; dragPiece = null;

  // Small delay so click handler sees isDragging=true, then reset
  setTimeout(() => { isDragging = false; }, 50);
  renderBoard();
}

// ── MOVE EXECUTION ────────────────────────────────────────
function executeMove(fr, fc, tr, tc, special, promoChoice) {
  const piece = board[fr][fc];
  if (!piece) return;
  const captured = board[tr][tc];
  const color = piece[0];
  const type  = piece[1];

  if (type === 'P' && (tr === 0 || tr === 7) && !promoChoice) {
    showPromoModal(fr, fc, tr, tc, special, color);
    return;
  }

  // Save state for undo
  fenHistory.push(JSON.stringify({
    board: board.map(r=>[...r]),
    turn, castling:{...castling}, enPassant,
    halfmoveClock, fullmoveNumber, lastMove
  }));

  const sanStr = buildSAN(fr, fc, tr, tc, special, promoChoice || null);

  const prevEP = enPassant;
  enPassant = null;

  if (special === 'ep') { const epRow = color==='w'?tr+1:tr-1; board[epRow][tc]=null; }
  if (special === 'castleK') { board[tr][5]=board[tr][7]; board[tr][7]=null; }
  if (special === 'castleQ') { board[tr][3]=board[tr][0]; board[tr][0]=null; }

  board[tr][tc] = promoChoice ? (color+promoChoice) : piece;
  board[fr][fc] = null;

  if (type==='K') { castling[color+'K']=false; castling[color+'Q']=false; }
  if (type==='R') { if(fc===7)castling[color+'K']=false; if(fc===0)castling[color+'Q']=false; }
  if(tr===0&&tc===7)castling.bK=false; if(tr===0&&tc===0)castling.bQ=false;
  if(tr===7&&tc===7)castling.wK=false; if(tr===7&&tc===0)castling.wQ=false;

  if (type==='P' && Math.abs(fr-tr)===2) enPassant={r:(fr+tr)/2,c:fc};

  if (type==='P'||captured) halfmoveClock=0; else halfmoveClock++;

  lastMove = {from:{r:fr,c:fc}, to:{r:tr,c:tc}};

  const nextTurn = turn==='w'?'b':'w';
  if (turn==='b') fullmoveNumber++;
  turn = nextTurn;

  const capturedPiece = captured||(special==='ep'?(color==='w'?'bP':'wP'):null);
  moveHistory.push({san:sanStr,fr,fc,tr,tc,piece,captured:capturedPiece,special,promotion:promoChoice||null});

  const fen = getBoardFen();
  positionCounts[fen] = (positionCounts[fen]||0)+1;

  selected = null; legalMoves = [];
  renderBoard();
  renderMoveHistory();
  renderCaptured();

  const over = checkGameEnd();
  if (!over) {
    updateTurnIndicator();
    if (gameMode==='bot' && ((turn==='w')!==(playerColor==='white'))) {
      setStatus('Bot is thinking…');
      setTimeout(()=>triggerBotMove(), 200); // triggerBotMove pauses timer itself
    } else {
      // Resume/start clock for the player whose turn it now is
      if(timeControl>0){ clearInterval(timerInterval); startTimer(); }
    }
  }
}

// ── LEGAL MOVE GENERATION ─────────────────────────────────
function getLegalMoves(r, c) {
  const piece = board[r][c];
  if (!piece) return [];
  const color = piece[0], type = piece[1];
  return getRawMoves(r,c,color,type).filter(m=>!moveLeavesKingInCheck(r,c,m.r,m.c,m.special,color));
}

function getRawMoves(r, c, color, type) {
  const moves=[], opp=color==='w'?'b':'w';
  const add=(tr,tc,special)=>{
    if(tr<0||tr>7||tc<0||tc>7)return;
    const t=board[tr][tc];
    if(t&&t[0]===color)return;
    moves.push({r:tr,c:tc,special:special||null});
  };
  const slide=(dr,dc)=>{
    let tr=r+dr,tc=c+dc;
    while(tr>=0&&tr<=7&&tc>=0&&tc<=7){
      const t=board[tr][tc];
      if(t){if(t[0]===opp)moves.push({r:tr,c:tc,special:null});break;}
      moves.push({r:tr,c:tc,special:null});tr+=dr;tc+=dc;
    }
  };
  if(type==='P'){
    const dir=color==='w'?-1:1,startRow=color==='w'?6:1;
    if(r+dir>=0&&r+dir<=7&&!board[r+dir][c]){
      moves.push({r:r+dir,c,special:null});
      if(r===startRow&&!board[r+2*dir][c])moves.push({r:r+2*dir,c,special:null});
    }
    [-1,1].forEach(dc=>{
      const tr=r+dir,tc=c+dc;
      if(tr<0||tr>7||tc<0||tc>7)return;
      if(board[tr][tc]&&board[tr][tc][0]===opp)moves.push({r:tr,c:tc,special:null});
      if(enPassant&&enPassant.r===tr&&enPassant.c===tc)moves.push({r:tr,c:tc,special:'ep'});
    });
  }
  if(type==='N')[[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([dr,dc])=>add(r+dr,c+dc));
  if(type==='B'||type==='Q')[[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([dr,dc])=>slide(dr,dc));
  if(type==='R'||type==='Q')[[-1,0],[1,0],[0,-1],[0,1]].forEach(([dr,dc])=>slide(dr,dc));
  if(type==='K'){
    [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]].forEach(([dr,dc])=>add(r+dr,c+dc));
    const row=color==='w'?7:0;
    if(r===row&&c===4){
      if(castling[color+'K']&&!board[row][5]&&!board[row][6]&&
         !isSquareAttacked(row,4,opp)&&!isSquareAttacked(row,5,opp)&&!isSquareAttacked(row,6,opp))
        moves.push({r:row,c:6,special:'castleK'});
      if(castling[color+'Q']&&!board[row][3]&&!board[row][2]&&!board[row][1]&&
         !isSquareAttacked(row,4,opp)&&!isSquareAttacked(row,3,opp)&&!isSquareAttacked(row,2,opp))
        moves.push({r:row,c:2,special:'castleQ'});
    }
  }
  return moves;
}

function moveLeavesKingInCheck(fr,fc,tr,tc,special,color){
  const saved=board.map(r=>[...r]),savedEP=enPassant;
  if(special==='ep'){const epR=color==='w'?tr+1:tr-1;board[epR][tc]=null;}
  if(special==='castleK'){board[tr][5]=board[tr][7];board[tr][7]=null;}
  if(special==='castleQ'){board[tr][3]=board[tr][0];board[tr][0]=null;}
  board[tr][tc]=board[fr][fc];board[fr][fc]=null;
  const inCheck=isKingInCheck(color);
  for(let i=0;i<8;i++)board[i]=[...saved[i]];
  enPassant=savedEP;
  return inCheck;
}

function isKingInCheck(color){
  const kp=findKing(color);
  if(!kp)return false;
  return isSquareAttacked(kp.r,kp.c,color==='w'?'b':'w');
}

function findKing(color){
  for(let r=0;r<8;r++)for(let c=0;c<8;c++)if(board[r][c]===color+'K')return{r,c};
  return null;
}

function isSquareAttacked(r,c,byColor){
  for(let fr=0;fr<8;fr++)for(let fc=0;fc<8;fc++){
    const p=board[fr][fc];
    if(!p||p[0]!==byColor)continue;
    if(getRawMoves(fr,fc,byColor,p[1]).find(m=>m.r===r&&m.c===c))return true;
  }
  return false;
}

function hasAnyLegalMoves(color){
  for(let r=0;r<8;r++)for(let c=0;c<8;c++){
    const p=board[r][c];
    if(!p||p[0]!==color)continue;
    if(getLegalMoves(r,c).length>0)return true;
  }
  return false;
}

function getBoardFen(){
  let fen='';
  for(let r=0;r<8;r++){
    let empty=0;
    for(let c=0;c<8;c++){
      const p=board[r][c];
      if(!p){empty++;}else{if(empty){fen+=empty;empty=0;}fen+=p[0]==='w'?p[1]:p[1].toLowerCase();}
    }
    if(empty)fen+=empty;
    if(r<7)fen+='/';
  }
  return fen+' '+turn;
}

// ── GAME END ──────────────────────────────────────────────
function checkGameEnd(){
  if(!hasAnyLegalMoves(turn)){
    gameOver=true;clearInterval(timerInterval);
    if(isKingInCheck(turn)){
      // 1. Mark the mated king for the pulsing highlight
      checkmateColor = turn;
      // 2. Find the piece that delivered the last move (the attacker)
      //    and mark it so renderBoard can highlight it too
      if (lastMove) {
        checkmateAttacker = { r: lastMove.to.r, c: lastMove.to.c };
      }
      // 3. Re-render to show the highlights
      renderBoard();
      setStatus((turn==='w'?'Black':'White')+' wins by checkmate!');
      // 4. Show modal after a generous pause so the player can see the position
      setTimeout(()=>showEndModal('♛',(turn==='w'?'Black':'White')+' Wins!','Checkmate'), 2500);
    }else{
      showEndModal('½','Draw','Stalemate — no legal moves');
    }
    return true;
  }
  if(halfmoveClock>=100){gameOver=true;clearInterval(timerInterval);showEndModal('½','Draw','50-move rule');return true;}
  if((positionCounts[getBoardFen()]||0)>=3){gameOver=true;clearInterval(timerInterval);showEndModal('½','Draw','Threefold repetition');return true;}
  if(isInsufficientMaterial()){gameOver=true;clearInterval(timerInterval);showEndModal('½','Draw','Insufficient material');return true;}
  return false;
}

function isInsufficientMaterial(){
  const pieces=[];
  for(let r=0;r<8;r++)for(let c=0;c<8;c++)if(board[r][c])pieces.push(board[r][c]);
  if(pieces.length===2)return true;
  if(pieces.length===3&&pieces.some(p=>p[1]==='N'||p[1]==='B'))return true;
  return false;
}

// ── PROMOTION ─────────────────────────────────────────────
let pendingPromo=null;
function showPromoModal(fr,fc,tr,tc,special,color){
  pendingPromo={fr,fc,tr,tc,special};
  const modal=document.getElementById('promo-modal'),box=document.getElementById('promo-pieces');
  box.innerHTML='';
  ['Q','R','B','N'].forEach(p=>{
    const btn=document.createElement('div');
    btn.className='promo-piece';btn.textContent=GLYPHS[color+p];
    btn.onclick=()=>{modal.classList.add('hidden');executeMove(pendingPromo.fr,pendingPromo.fc,pendingPromo.tr,pendingPromo.tc,pendingPromo.special,p);};
    box.appendChild(btn);
  });
  modal.classList.remove('hidden');
}

// ── SAN ───────────────────────────────────────────────────
function buildSAN(fr,fc,tr,tc,special,promotion){
  const piece=board[fr][fc],type=piece[1],color=piece[0];
  const captured=board[tr][tc]||(special==='ep'?'ep':null);
  if(special==='castleK')return'O-O';
  if(special==='castleQ')return'O-O-O';
  let san='';
  if(type!=='P')san+=type;
  if(type!=='P'){
    const ambig=[];
    for(let r=0;r<8;r++)for(let c=0;c<8;c++){
      if(r===fr&&c===fc)continue;
      if(board[r][c]!==piece)continue;
      if(getLegalMoves(r,c).find(m=>m.r===tr&&m.c===tc))ambig.push({r,c});
    }
    if(ambig.length){
      const sameFile=ambig.some(a=>a.c===fc),sameRank=ambig.some(a=>a.r===fr);
      if(!sameFile)san+=String.fromCharCode(97+fc);
      else if(!sameRank)san+=(8-fr);
      else san+=String.fromCharCode(97+fc)+(8-fr);
    }
  }
  if(captured){if(type==='P')san+=String.fromCharCode(97+fc);san+='x';}
  san+=String.fromCharCode(97+tc)+(8-tr);
  if(promotion)san+='='+promotion;
  // Check/mate suffix via simulation
  const saved=board.map(r=>[...r]),savedC={...castling},savedEP=enPassant;
  board[tr][tc]=promotion?(color+promotion):piece;board[fr][fc]=null;
  if(special==='ep'){const epR=color==='w'?tr+1:tr-1;board[epR][tc]=null;}
  if(special==='castleK'){board[tr][5]=board[tr][7];board[tr][7]=null;}
  if(special==='castleQ'){board[tr][3]=board[tr][0];board[tr][0]=null;}
  const nc=color==='w'?'b':'w';
  const inChk=isKingInCheck(nc),hasMv=hasAnyLegalMoves(nc);
  if(inChk)san+=hasMv?'+':'#';
  for(let i=0;i<8;i++)board[i]=[...saved[i]];
  Object.assign(castling,savedC);enPassant=savedEP;
  return san;
}

// ── TIMERS ────────────────────────────────────────────────
function resetTimers(){
  clearInterval(timerInterval);
  timeW=timeControl; timeB=timeControl;
  renderTimers();
  // Timer is NOT started here — startTimer() is called after the countdown finishes.
}

function startTimer(){
  timerInterval=setInterval(()=>{
    if(gameOver){clearInterval(timerInterval);return;}
    if(turn==='w')timeW--;else timeB--;
    if(timeW<=0||timeB<=0){
      gameOver=true;clearInterval(timerInterval);
      showEndModal('⏱',(timeW<=0?'Black':'White')+' Wins!','On time');return;
    }
    renderTimers();
  },1000);
}

function renderTimers(){
  const wEl=document.getElementById('timer-white'),bEl=document.getElementById('timer-black');
  wEl.textContent=timeControl===0?'∞':formatTime(timeW);
  bEl.textContent=timeControl===0?'∞':formatTime(timeB);
  wEl.classList.toggle('low',timeControl>0&&timeW<=30);
  bEl.classList.toggle('low',timeControl>0&&timeB<=30);
}

function formatTime(s){
  const m=Math.floor(s/60),ss=s%60;
  return m+':'+String(ss).padStart(2,'0');
}

// ── CAPTURED PIECES ───────────────────────────────────────
function renderCaptured(){
  const byW=[],byB=[];
  moveHistory.forEach(m=>{
    if(!m.captured)return;
    if(m.captured[0]==='b')byW.push(m.captured);
    else byB.push(m.captured);
  });
  const order=['Q','R','B','N','P'];
  const sort=arr=>arr.sort((a,b)=>order.indexOf(b[1])-order.indexOf(a[1]));
  document.getElementById('captured-by-white').textContent=sort(byW).map(p=>GLYPHS[p]).join('');
  document.getElementById('captured-by-black').textContent=sort(byB).map(p=>GLYPHS[p]).join('');
  const sW=byW.reduce((s,p)=>s+PIECE_VALUES[p[1]],0);
  const sB=byB.reduce((s,p)=>s+PIECE_VALUES[p[1]],0);
  document.getElementById('adv-white').textContent=sW>sB?'+'+(sW-sB):'';
  document.getElementById('adv-black').textContent=sB>sW?'+'+(sB-sW):'';
}

// ── MOVE HISTORY ──────────────────────────────────────────
function renderMoveHistory(){
  const el=document.getElementById('move-list');
  el.innerHTML='';
  for(let i=0;i<moveHistory.length;i+=2){
    const row=document.createElement('div');row.className='move-row';
    const num=document.createElement('span');num.className='move-num';num.textContent=(i/2+1)+'.';
    row.appendChild(num);

    const isLastMove=(idx)=>!reviewMode&&idx===moveHistory.length-1;
    const isReviewing=(idx)=>reviewMode&&idx===reviewIndex;

    const m1=document.createElement('span');
    m1.className='move-san clickable'+(isLastMove(i)||isReviewing(i)?' current':'');
    m1.textContent=moveHistory[i].san;
    m1.title='Jump to move '+(i+1);
    m1.addEventListener('click',()=>jumpToMove(i));
    row.appendChild(m1);

    const m2=document.createElement('span');
    m2.className='move-san'+(moveHistory[i+1]?' clickable':'')+(moveHistory[i+1]&&(isLastMove(i+1)||isReviewing(i+1))?' current':'');
    m2.textContent=moveHistory[i+1]?moveHistory[i+1].san:'';
    if(moveHistory[i+1]){
      m2.title='Jump to move '+(i+2);
      m2.addEventListener('click',()=>jumpToMove(i+1));
    }
    row.appendChild(m2);
    el.appendChild(row);
  }
  const currentEl=el.querySelector('.move-san.current');
  if(currentEl) currentEl.scrollIntoView({block:'nearest'});
  else el.scrollTop=el.scrollHeight;
}

// ── REVIEW MODE ───────────────────────────────────────────
function jumpToMove(idx){
  if(idx < 0 || idx >= moveHistory.length) return;
  // If the bot is currently thinking, cancel it cleanly before swapping the board
  if(sfCallback){
    sfCallback = null;
    clearTimeout(botMoveTimeout);
    if(stockfish) stockfish.postMessage('stop');
  }
  reviewMode  = true;
  reviewIndex = idx;
  const state = JSON.parse(fenHistory[idx + 1]);
  board          = state.board;
  turn           = state.turn;
  castling       = state.castling;
  enPassant      = state.enPassant;
  halfmoveClock  = state.halfmoveClock;
  fullmoveNumber = state.fullmoveNumber;
  lastMove       = state.lastMove;
  selected = null; legalMoves = [];
  renderBoard();
  renderMoveHistory();
  showReviewBar();
}

function exitReview(){
  reviewMode  = false;
  reviewIndex = -1;
  const state = JSON.parse(fenHistory[fenHistory.length - 1]);
  board          = state.board;
  turn           = state.turn;
  castling       = state.castling;
  enPassant      = state.enPassant;
  halfmoveClock  = state.halfmoveClock;
  fullmoveNumber = state.fullmoveNumber;
  lastMove       = state.lastMove;
  selected = null; legalMoves = [];
  renderBoard();
  renderMoveHistory();
  hideReviewBar();
  // If the bot's turn was interrupted by review, re-trigger it now
  if(!gameOver && gameMode === 'bot' && ((turn==='w') !== (playerColor==='white'))){
    setStatus('Bot is thinking…');
    setTimeout(() => triggerBotMove(), 200);
  } else if(!gameOver && timeControl > 0){
    clearInterval(timerInterval);
    startTimer();
  }
}

function reviewStepBack(){
  if(reviewIndex <= 0) return;
  jumpToMove(reviewIndex - 1);
}

function reviewStepForward(){
  if(reviewIndex >= moveHistory.length - 1) return;
  jumpToMove(reviewIndex + 1);
}

function showReviewBar(){
  let bar = document.getElementById('review-bar');
  if(!bar){
    bar = document.createElement('div');
    bar.id = 'review-bar';
    bar.className = 'review-bar';
    bar.innerHTML =
      '<button class="review-btn" onclick="jumpToMove(0)" title="First move">\u23EE</button>' +
      '<button class="review-btn" onclick="reviewStepBack()" title="Previous move">\u25C0</button>' +
      '<span class="review-label" id="review-label"></span>' +
      '<button class="review-btn" onclick="reviewStepForward()" title="Next move">\u25B6</button>' +
      '<button class="review-btn" onclick="jumpToMove(moveHistory.length-1)" title="Last move">\u23ED</button>' +
      '<button class="review-exit-btn" onclick="exitReview()">&times; Back to Live</button>';
    const boardWrap = document.querySelector('.board-wrap');
    boardWrap.parentNode.insertBefore(bar, boardWrap.nextSibling);
  }
  bar.classList.remove('hidden');
  updateReviewLabel();
}

function updateReviewLabel(){
  const lbl = document.getElementById('review-label');
  if(!lbl) return;
  const m = moveHistory[reviewIndex];
  const moveNum = Math.floor(reviewIndex / 2) + 1;
  const color   = reviewIndex % 2 === 0 ? 'White' : 'Black';
  lbl.textContent = moveNum + '. ' + color + ': ' + m.san;
}

function hideReviewBar(){
  const bar = document.getElementById('review-bar');
  if(bar) bar.classList.add('hidden');
}

function enterReviewFromModal(){
  document.getElementById('overlay').classList.add('hidden');
  jumpToMove(moveHistory.length - 1);
}

// ── UI HELPERS ────────────────────────────────────────────
function setStatus(msg){document.getElementById('status').textContent=msg;}

function updateTurnIndicator(){
  document.getElementById('block-white').classList.toggle('active',turn==='w');
  document.getElementById('block-black').classList.toggle('active',turn==='b');
  let msg=turn==='w'?'White to move':'Black to move';
  if(isKingInCheck(turn))msg=(turn==='w'?'White':'Black')+' is in check!';
  setStatus(msg);
}

function updatePlayerNames(){
  if(gameMode==='bot'){
    const names={beginner:'Beginner Bot',intermediate:'Intermediate Bot',master:'Master Bot'};
    if(playerColor==='white'){
      document.getElementById('name-white').textContent='You';
      document.getElementById('name-black').textContent=names[difficulty];
    }else{
      document.getElementById('name-white').textContent=names[difficulty];
      document.getElementById('name-black').textContent='You';
    }
  }else{
    document.getElementById('name-white').textContent='White';
    document.getElementById('name-black').textContent='Black';
  }
}

function showEndModal(icon,title,sub){
  document.getElementById('modal-icon').textContent=icon;
  document.getElementById('modal-title').textContent=title;
  document.getElementById('modal-sub').textContent=sub;
  document.getElementById('overlay').classList.remove('hidden');
  setStatus(title);
}

function exitGame(){window.location.href='index.html';}

function showResignDialog() {
  if (gameOver) return;
  document.getElementById('resign-overlay').classList.remove('hidden');
}

function confirmResign() {
  document.getElementById('resign-overlay').classList.add('hidden');
  gameOver = true;
  clearInterval(timerInterval);
  const winner = playerColor === 'white' ? 'Black' : 'White';
  showEndModal('🏳️', winner + ' Wins!', 'You resigned');
}

// ── UNDO ──────────────────────────────────────────────────
function undoMove(){
  if(fenHistory.length<=1)return;
  if(gameOver){gameOver=false;document.getElementById('overlay').classList.add('hidden');}
  const undoCount=(gameMode==='bot'&&moveHistory.length>=2)?2:1;
  for(let i=0;i<undoCount;i++){
    if(fenHistory.length<=1||moveHistory.length<1)break;
    fenHistory.pop();
    moveHistory.pop();
    // Read the previous state after both arrays are popped so they stay in lockstep
    const state=JSON.parse(fenHistory[fenHistory.length-1]);
    board=state.board;turn=state.turn;castling=state.castling;
    enPassant=state.enPassant;halfmoveClock=state.halfmoveClock;
    fullmoveNumber=state.fullmoveNumber;lastMove=state.lastMove;
  }
  selected=null;legalMoves=[];
  renderBoard();renderMoveHistory();renderCaptured();updateTurnIndicator();
  if(timeControl>0){clearInterval(timerInterval);startTimer();}
}

// ── STOCKFISH ─────────────────────────────────────────────
// new Worker('https://...') is blocked on file:// protocol due to same-origin policy.
// Fix: fetch the JS text and create a blob URL — works on file://, http://, and https://.
const SF_URLS = [
  'JS/stockfish.js',                                              // local copy (primary)
  'https://unpkg.com/stockfish.js@10.0.2/stockfish.js',          // CDN fallbacks
  'https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js'
];

function spawnWorkerFromBlob(scriptText) {
  const blob = new Blob([scriptText], { type: 'application/javascript' });
  const url  = URL.createObjectURL(blob);
  const w    = new Worker(url);
  URL.revokeObjectURL(url); // safe to revoke immediately after Worker is created
  return w;
}

function initStockfish(urlIndex) {
  urlIndex = (urlIndex !== undefined) ? urlIndex : 0;
  if (urlIndex >= SF_URLS.length) { sfReady = false; setEngineStatus('offline'); return; }
  if (urlIndex === 0) setEngineStatus('loading');

  fetch(SF_URLS[urlIndex])
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
    .then(text => {
      try {
        const worker = spawnWorkerFromBlob(text);
        const initTimeout = setTimeout(() => { worker.terminate(); initStockfish(urlIndex + 1); }, 8000);
        worker.onmessage = function(e) {
          const msg = e.data;
          if (msg === 'uciok') { worker.postMessage('isready'); }
          if (msg === 'readyok') {
            clearTimeout(initTimeout);
            stockfish = worker; sfReady = true; setEngineStatus('ready');
          }
          if (typeof msg === 'string' && msg.startsWith('bestmove') && sfCallback) {
            const cb = sfCallback; sfCallback = null; cb(msg);
          }
        };
        worker.onerror = () => { clearTimeout(initTimeout); worker.terminate(); initStockfish(urlIndex + 1); };
        worker.postMessage('uci');
      } catch(e) { initStockfish(urlIndex + 1); }
    })
    .catch(() => initStockfish(urlIndex + 1));
}

function setEngineStatus(state){
  const dot=document.getElementById('engine-dot'),txt=document.getElementById('engine-status-text');
  if(state==='loading') {dot.className='engine-dot thinking';txt.textContent='Loading…';}
  if(state==='ready')   {dot.className='engine-dot ready';   txt.textContent='Ready';}
  if(state==='thinking'){dot.className='engine-dot thinking'; txt.textContent='Thinking…';}
  if(state==='offline') {dot.className='engine-dot';          txt.textContent='Offline (fallback)';}
}

function boardToFen(){
  let fen='';
  for(let r=0;r<8;r++){
    let empty=0;
    for(let c=0;c<8;c++){
      const p=board[r][c];
      if(!p){empty++;}else{
        if(empty){fen+=empty;empty=0;}
        const ch=p[1]==='N'?(p[0]==='w'?'N':'n'):(p[0]==='w'?p[1]:p[1].toLowerCase());
        fen+=ch;
      }
    }
    if(empty)fen+=empty;if(r<7)fen+='/';
  }
  fen+=' '+turn+' ';
  let cast='';
  if(castling.wK)cast+='K';if(castling.wQ)cast+='Q';if(castling.bK)cast+='k';if(castling.bQ)cast+='q';
  fen+=(cast||'-')+' ';
  fen+=enPassant?(String.fromCharCode(97+enPassant.c)+(8-enPassant.r)):'-';
  fen+=' '+halfmoveClock+' '+fullmoveNumber;
  return fen;
}

function triggerBotMove(){
  if(gameOver)return;
  if(sfCallback)return; // already waiting for a move, don't stack requests

  setEngineStatus('thinking');
  clearInterval(timerInterval); // pause clock while bot thinks

  const myGameId = currentGameId;

  // ── Check opening book first (applies whether Stockfish is on or not) ────────
  const bookMove = (difficulty !== 'beginner') ? tryOpeningBook(turn) : null;

  // ── Variable think-time per difficulty ───────────────────────────────────────
  const thinkConfig = {
    beginner:     { base:300,  spread:700  },
    intermediate: { base:800,  spread:1200 },
    master:       { base:1500, spread:2500 },
  };
  const cfg = thinkConfig[difficulty] || thinkConfig.intermediate;
  const deepThink = Math.random() < 0.2;
  const movetime  = cfg.base + Math.floor(Math.random() * cfg.spread) + (deepThink ? cfg.base : 0);

  // If we have a book move, just play it after a brief human-like delay
  if (bookMove) {
    setTimeout(()=>{
      if(myGameId!==currentGameId)return;
      if(reviewMode)return; // don't play into a historical board
      setEngineStatus('ready');
      try { doExecuteBot(bookMove); } catch(e) {
        console.warn('book move failed:', e);
        if(!gameOver && timeControl>0){ clearInterval(timerInterval); startTimer(); }
      }
    }, Math.min(movetime, 1200)); // book moves are fast, cap at 1.2s
    return;
  }

  if(sfReady&&stockfish){
    const depthMap={beginner:5,intermediate:10,master:16};
    const depth=depthMap[difficulty];

    clearTimeout(botMoveTimeout);
    botMoveTimeout=setTimeout(()=>{
      if(myGameId!==currentGameId)return;
      // Always clean up — sfCallback may have already been cleared by a race but timer still needs restart
      sfCallback=null;
      if(!gameOver && !reviewMode){
        setEngineStatus('offline');
        if(timeControl>0){ clearInterval(timerInterval); startTimer(); }
        fallbackBotMove();
      }
    }, movetime+4000);

    sfCallback=(msg)=>{
      clearTimeout(botMoveTimeout);
      if(myGameId!==currentGameId){ sfCallback=null; return; }
      // If user entered review mode while the bot was thinking, discard the move
      // and restart the bot once they return to live (exitReview handles that)
      if(reviewMode){ sfCallback=null; setEngineStatus('ready'); return; }
      setEngineStatus('ready');
      const parts=msg.split(' '),moveStr=parts[1];
      if(!moveStr||moveStr==='(none)'){ if(timeControl>0){clearInterval(timerInterval);startTimer();} fallbackBotMove(); return; }
      applyUCIMove(moveStr);
    };
    stockfish.postMessage('position fen '+boardToFen());
    stockfish.postMessage('go depth '+depth+' movetime '+movetime);
  }else{
    setTimeout(()=>{
      if(myGameId!==currentGameId)return;
      setEngineStatus('offline'); if(timeControl>0){clearInterval(timerInterval);startTimer();} fallbackBotMove();
    }, Math.min(movetime, 2500));
  }
}

function applyUCIMove(uci){
  if(gameOver)return;
  const fc=uci.charCodeAt(0)-97,fr=8-parseInt(uci[1]);
  const tc=uci.charCodeAt(2)-97,tr=8-parseInt(uci[3]);
  const promo=uci[4]?uci[4].toUpperCase():null;
  const piece=board[fr][fc];
  // Guard: missing or wrong-colour piece means the board is out of sync — recover gracefully
  if(!piece||piece[0]!==turn){
    console.warn('applyUCIMove: piece mismatch for', uci, '— using fallback');
    if(timeControl>0){ clearInterval(timerInterval); startTimer(); }
    fallbackBotMove();
    return;
  }
  let special=null;
  if(piece[1]==='K'&&Math.abs(fc-tc)===2)special=tc>fc?'castleK':'castleQ';
  if(piece[1]==='P'&&tc!==fc&&!board[tr][tc])special='ep';
  executeMove(fr,fc,tr,tc,special,promo);
}

// ── FALLBACK BOT ─────────────────────────────────────────
// Piece-square tables (white's perspective; flip row for black)
const PST={
  P:[[0,0,0,0,0,0,0,0],[5,10,10,-20,-20,10,10,5],[5,-5,-10,0,0,-10,-5,5],[0,0,0,20,20,0,0,0],[5,5,10,25,25,10,5,5],[10,10,20,30,30,20,10,10],[50,50,50,50,50,50,50,50],[0,0,0,0,0,0,0,0]],
  N:[[-50,-40,-30,-30,-30,-30,-40,-50],[-40,-20,0,5,5,0,-20,-40],[-30,5,10,15,15,10,5,-30],[-30,0,15,20,20,15,0,-30],[-30,5,15,20,20,15,5,-30],[-30,0,10,15,15,10,0,-30],[-40,-20,0,0,0,0,-20,-40],[-50,-40,-30,-30,-30,-30,-40,-50]],
  B:[[-20,-10,-10,-10,-10,-10,-10,-20],[-10,5,0,0,0,0,5,-10],[-10,10,10,10,10,10,10,-10],[-10,0,10,10,10,10,0,-10],[-10,5,5,10,10,5,5,-10],[-10,0,5,10,10,5,0,-10],[-10,0,0,0,0,0,0,-10],[-20,-10,-10,-10,-10,-10,-10,-20]],
  R:[[0,0,0,5,5,0,0,0],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[5,10,10,10,10,10,10,5],[0,0,0,0,0,0,0,0]],
  Q:[[-20,-10,-10,-5,-5,-10,-10,-20],[-10,0,5,0,0,0,0,-10],[-10,5,5,5,5,5,0,-10],[0,0,5,5,5,5,0,-5],[-5,0,5,5,5,5,0,-5],[-10,0,5,5,5,5,0,-10],[-10,0,0,0,0,0,0,-10],[-20,-10,-10,-5,-5,-10,-10,-20]],
  K:[[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-20,-30,-30,-40,-40,-30,-30,-20],[-10,-20,-20,-20,-20,-20,-20,-10],[20,20,0,0,0,0,20,20],[20,30,10,0,0,10,30,20]],
  // Endgame king table: king should be active in the endgame
  Ke:[[-50,-40,-30,-20,-20,-30,-40,-50],[-30,-20,-10,0,0,-10,-20,-30],[-30,-10,20,30,30,20,-10,-30],[-30,-10,30,40,40,30,-10,-30],[-30,-10,30,40,40,30,-10,-30],[-30,-10,20,30,30,20,-10,-30],[-30,-30,0,0,0,0,-30,-30],[-50,-30,-30,-30,-30,-30,-30,-50]]
};

// Opening book: named lines per difficulty.
// Each line is an array of [fr,fc,tr,tc] half-moves (both colours interleaved).
// At game start we pick ONE line at random (weighted by difficulty) and follow it.

const NAMED_OPENINGS = {
  // ── Beginner: simple centre grabs ───────────────────────────────────────────
  beginner: [
    { name:'e4 e5', moves:[[6,4,4,4],[1,4,3,4],[7,6,5,5],[0,6,2,5]] },
    { name:'d4 d5', moves:[[6,3,4,3],[1,3,3,3],[7,6,5,5],[0,1,2,2]] },
    { name:'e4 c5', moves:[[6,4,4,4],[1,2,3,2],[7,1,5,2],[0,6,2,5]] },
  ],
  // ── Intermediate: real named openings ───────────────────────────────────────
  intermediate: [
    { name:'Italian Game',        moves:[[6,4,4,4],[1,4,3,4],[7,6,5,5],[0,1,2,2],[7,5,4,2],[0,5,2,3],[7,4,7,6]] },
    { name:'Spanish (Ruy Lopez)', moves:[[6,4,4,4],[1,4,3,4],[7,6,5,5],[0,1,2,2],[7,5,3,1],[0,0,2,0],[6,3,5,3]] },
    { name:"Queen's Gambit",      moves:[[6,3,4,3],[1,3,3,3],[6,2,4,2],[1,2,3,2],[7,1,5,2],[0,6,2,5]] },
    { name:'London System',       moves:[[6,3,4,3],[1,3,3,3],[7,6,5,5],[0,6,2,5],[7,2,4,5],[1,2,2,2],[6,4,5,4]] },
    { name:'Sicilian Defence',    moves:[[6,4,4,4],[1,2,3,2],[7,6,5,5],[1,3,3,3],[6,3,5,3],[0,6,2,5]] },
    { name:"King's Indian",       moves:[[6,3,4,3],[1,6,2,5],[6,2,4,2],[0,6,2,5],[7,1,5,2],[0,5,1,4],[6,4,5,4]] },
    { name:'Caro-Kann',           moves:[[6,4,4,4],[1,2,3,2],[6,3,4,3],[1,3,3,3],[7,1,5,2],[0,1,2,2]] },
  ],
  // ── Master: theory-accurate lines ───────────────────────────────────────────
  master: [
    { name:'Italian Giuoco Piano',moves:[[6,4,4,4],[1,4,3,4],[7,6,5,5],[0,1,2,2],[7,5,4,2],[0,5,2,3],[6,2,5,3],[0,0,2,0],[7,4,7,6]] },
    { name:'Spanish Closed',      moves:[[6,4,4,4],[1,4,3,4],[7,6,5,5],[0,1,2,2],[7,5,3,1],[0,0,2,0],[6,0,5,0],[0,6,2,5],[7,4,7,6],[0,4,0,6]] },
    { name:"Queen's Gambit Accepted", moves:[[6,3,4,3],[1,3,3,3],[6,2,4,2],[1,2,3,2],[7,6,5,5],[0,6,2,5],[6,4,5,4],[1,4,3,4],[7,5,3,3]] },
    { name:'Nimzo-Indian',        moves:[[6,3,4,3],[1,6,2,5],[6,2,4,2],[0,5,2,1],[7,1,5,2],[1,3,3,3],[7,6,5,5],[0,1,1,3]] },
    { name:'French Defence',      moves:[[6,4,4,4],[1,4,3,4],[6,3,4,3],[1,3,3,3],[7,1,5,2],[0,5,2,3],[6,4,5,5]] },
    { name:'Sicilian Najdorf',    moves:[[6,4,4,4],[1,2,3,2],[7,6,5,5],[1,3,3,3],[6,3,5,3],[0,0,2,0],[7,5,4,2],[1,4,3,4],[7,4,7,6]] },
    { name:"King's Indian Defence", moves:[[6,3,4,3],[1,6,2,5],[6,2,4,2],[0,6,2,4],[7,1,5,2],[0,3,3,3],[6,4,5,4],[0,5,1,4],[7,5,4,2],[0,4,0,6]] },
    { name:'English Opening',     moves:[[6,2,4,2],[1,4,3,4],[7,1,5,2],[0,6,2,5],[6,6,5,6],[0,1,2,2],[7,5,4,2]] },
  ]
};

// Chosen at game-start and shared across both colours
let activeOpening = null;
let openingMoveIndex = 0;   // which half-move in activeOpening.moves we're on

function chooseOpening(diff) {
  const pool = NAMED_OPENINGS[diff] || NAMED_OPENINGS.intermediate;
  // Uniform random — every game picks a different line
  activeOpening = pool[Math.floor(Math.random() * pool.length)];
  openingMoveIndex = 0;
}

// ── EVALUATION ───────────────────────────────────────────
// Returns centipawn score from WHITE's perspective.
function isEndgame() {
  let material = 0;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = board[r][c];
    if (p && p[1] !== 'K' && p[1] !== 'P') material += PIECE_VALUES[p[1]];
  }
  return material <= 13; // roughly: both sides missing queen + rook
}

function evaluateBoard() {
  let score = 0;
  const eg = isEndgame();
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = board[r][c];
    if (!p) continue;
    const color = p[0], type = p[1];
    const isWhite = color === 'w';
    const sign = isWhite ? 1 : -1;

    // Material
    score += sign * PIECE_VALUES[type] * 100;

    // PST
    const pstRow = isWhite ? r : 7 - r;
    const pstTable = (type === 'K' && eg) ? PST.Ke : PST[type];
    if (pstTable) score += sign * pstTable[pstRow][c];

    // Mobility bonus (counts legal targets — cheap approximation)
    if (type !== 'K' && type !== 'P') {
      const moves = getRawMoves(r, c, color, type);
      score += sign * moves.length * 2;
    }
  }

  // Pawn structure: doubled/isolated pawn penalties
  for (let c = 0; c < 8; c++) {
    let wPawns = 0, bPawns = 0;
    for (let r = 0; r < 8; r++) {
      if (board[r][c] === 'wP') wPawns++;
      if (board[r][c] === 'bP') bPawns++;
    }
    if (wPawns > 1) score -= (wPawns - 1) * 15;
    if (bPawns > 1) score += (bPawns - 1) * 15;
  }

  // Bishop pair bonus
  const wBishops = countPiece('w','B'), bBishops = countPiece('b','B');
  if (wBishops >= 2) score += 30;
  if (bBishops >= 2) score -= 30;

  // King safety: penalise exposed king (attacked squares near king)
  if (!eg) {
    score += evalKingSafety('w');
    score -= evalKingSafety('b');
  }

  return score;
}

function countPiece(color, type) {
  let n = 0;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++)
    if (board[r][c] === color + type) n++;
  return n;
}

function evalKingSafety(color) {
  const kp = findKing(color);
  if (!kp) return 0;
  const opp = color === 'w' ? 'b' : 'w';
  let penalty = 0;
  // Count attacked squares in a ring around the king
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (dr === 0 && dc === 0) continue;
    const rr = kp.r + dr, rc = kp.c + dc;
    if (rr < 0 || rr > 7 || rc < 0 || rc > 7) continue;
    if (isSquareAttacked(rr, rc, opp)) penalty -= 10;
    // Bonus for pawn shield
    const shieldRow = color === 'w' ? kp.r - 1 : kp.r + 1;
    if (dr === (color === 'w' ? -1 : 1) && board[rr][rc] === color + 'P') penalty += 8;
  }
  return penalty;
}

// ── MOVE ORDERING (for alpha-beta efficiency) ─────────────
function orderMoves(moves, colorToMove) {
  return moves.map(m => {
    let priority = 0;
    const piece  = board[m.fr][m.fc];
    const target = board[m.r][m.c];
    if (!piece) return { m, priority: 0 };
    const t = piece[1];

    // MVV-LVA: most valuable victim / least valuable attacker
    if (target) priority += PIECE_VALUES[target[1]] * 10 - PIECE_VALUES[t];

    // Promotions
    if (t === 'P' && (m.r === 0 || m.r === 7)) priority += 90;

    // Castling
    if (m.special === 'castleK' || m.special === 'castleQ') priority += 5;

    return { m, priority };
  }).sort((a, b) => b.priority - a.priority).map(x => x.m);
}

// ── MINIMAX WITH ALPHA-BETA PRUNING ──────────────────────
// depth: half-moves remaining. isMaximising: true = white's turn.
function minimax(depth, alpha, beta, isMaximising) {
  if (depth === 0) return quiescenceSearch(alpha, beta, isMaximising);

  const color = isMaximising ? 'w' : 'b';
  let allMoves = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = board[r][c];
    if (!p || p[0] !== color) continue;
    getLegalMoves(r, c).forEach(m => allMoves.push({ fr: r, fc: c, r: m.r, c: m.c, special: m.special }));
  }

  if (allMoves.length === 0) {
    // Terminal node: checkmate or stalemate
    if (isKingInCheck(color)) return isMaximising ? -100000 + depth : 100000 - depth;
    return 0; // stalemate
  }

  allMoves = orderMoves(allMoves, color);

  if (isMaximising) {
    let maxEval = -Infinity;
    for (const m of allMoves) {
      applyTempMove(m);
      const evalScore = minimax(depth - 1, alpha, beta, false);
      undoTempMove(m);
      if (evalScore > maxEval) maxEval = evalScore;
      if (maxEval > alpha) alpha = maxEval;
      if (beta <= alpha) break; // β cutoff
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const m of allMoves) {
      applyTempMove(m);
      const evalScore = minimax(depth - 1, alpha, beta, true);
      undoTempMove(m);
      if (evalScore < minEval) minEval = evalScore;
      if (minEval < beta) beta = minEval;
      if (beta <= alpha) break; // α cutoff
    }
    return minEval;
  }
}

// Quiescence search: only look at captures to avoid horizon effect
function quiescenceSearch(alpha, beta, isMaximising) {
  const standPat = evaluateBoard();
  if (isMaximising) {
    if (standPat >= beta) return beta;
    if (standPat > alpha) alpha = standPat;
  } else {
    if (standPat <= alpha) return alpha;
    if (standPat < beta) beta = standPat;
  }

  const color = isMaximising ? 'w' : 'b';
  let captures = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = board[r][c];
    if (!p || p[0] !== color) continue;
    getLegalMoves(r, c).forEach(m => {
      if (board[m.r][m.c] || m.special === 'ep') {
        captures.push({ fr: r, fc: c, r: m.r, c: m.c, special: m.special });
      }
    });
  }
  captures = orderMoves(captures, color);

  if (isMaximising) {
    for (const m of captures) {
      applyTempMove(m);
      const s = quiescenceSearch(alpha, beta, false);
      undoTempMove(m);
      if (s > alpha) alpha = s;
      if (alpha >= beta) break;
    }
    return alpha;
  } else {
    for (const m of captures) {
      applyTempMove(m);
      const s = quiescenceSearch(alpha, beta, true);
      undoTempMove(m);
      if (s < beta) beta = s;
      if (beta <= alpha) break;
    }
    return beta;
  }
}

// Lightweight board mutation for search (no UI side-effects)
let tempMoveStack = [];

function applyTempMove(m) {
  const saved = {
    board: board.map(r => [...r]),
    castling: { ...castling },
    enPassant,
    turn,
    m
  };
  tempMoveStack.push(saved);

  const piece = board[m.fr][m.fc];
  const color = piece[0], type = piece[1];

  if (m.special === 'ep') {
    const epRow = color === 'w' ? m.r + 1 : m.r - 1;
    board[epRow][m.c] = null;
  }
  if (m.special === 'castleK') { board[m.r][5] = board[m.r][7]; board[m.r][7] = null; }
  if (m.special === 'castleQ') { board[m.r][3] = board[m.r][0]; board[m.r][0] = null; }

  // Auto-promote to queen in search
  const promo = (type === 'P' && (m.r === 0 || m.r === 7)) ? color + 'Q' : null;
  board[m.r][m.c] = promo || piece;
  board[m.fr][m.fc] = null;

  if (type === 'K') { castling[color + 'K'] = false; castling[color + 'Q'] = false; }
  if (type === 'R') {
    if (m.fc === 7) castling[color + 'K'] = false;
    if (m.fc === 0) castling[color + 'Q'] = false;
  }
  if (type === 'P' && Math.abs(m.fr - m.r) === 2) enPassant = { r: (m.fr + m.r) / 2, c: m.fc };
  else enPassant = null;

  turn = turn === 'w' ? 'b' : 'w';
}

function undoTempMove(m) {
  const saved = tempMoveStack.pop();
  for (let i = 0; i < 8; i++) board[i] = [...saved.board[i]];
  castling   = saved.castling;
  enPassant  = saved.enPassant;
  turn       = saved.turn;
}

// ── DETERMINISTIC POSITION KEY (for repetition detection) ─
function positionKey() {
  // Simple hash: piece positions + turn. No Math.random involved.
  let key = turn;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) key += (board[r][c] || '.');
  key += (castling.wK?'K':'') + (castling.wQ?'Q':'') + (castling.bK?'k':'') + (castling.bQ?'q':'');
  return key;
}

function tryOpeningBook(color) {
  if (!activeOpening) return null;
  if (openingMoveIndex >= activeOpening.moves.length) return null;

  // The moves array interleaves white/black, one half-move per entry.
  // openingMoveIndex tracks the next half-move regardless of colour.
  const [fr, fc, tr, tc] = activeOpening.moves[openingMoveIndex];

  // Verify this half-move is for the current colour
  const piece = board[fr][fc];
  if (!piece || piece[0] !== color) return null;

  const legal = getLegalMoves(fr, fc);
  const target = legal.find(m => m.r === tr && m.c === tc);
  if (!target) {
    // Opening line no longer applicable (opponent deviated); abandon it
    activeOpening = null;
    return null;
  }

  openingMoveIndex++;
  return { fr, fc, r: tr, c: tc, special: target.special };
}

function doExecuteBot(m) {
  const bp = board[m.fr][m.fc];
  const promo = (bp && bp[1]==='P' && (m.r===0||m.r===7)) ? 'Q' : null;
  botPositionHistory.push(positionKey());
  if (botPositionHistory.length > 16) botPositionHistory.shift();
  executeMove(m.fr, m.fc, m.r, m.c, m.special, promo);
}

// Stable tiebreaker: encode a move as a number so equal-scoring moves
// always resolve the same way (no Math.random drift).
function moveTiebreaker(m) {
  return m.fr * 512 + m.fc * 64 + m.r * 8 + m.c;
}

function fallbackBotMove() {
  const color = turn;
  let allMoves = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = board[r][c]; if (!p || p[0] !== color) continue;
    getLegalMoves(r, c).forEach(m => allMoves.push({ fr: r, fc: c, r: m.r, c: m.c, special: m.special }));
  }
  if (!allMoves.length) return;

  // ── Beginner: mostly random, occasionally takes a capture ───────────────────
  if (difficulty === 'beginner') {
    // Shuffle using a seedable-ish shuffle (based on moveHistory length so it
    // varies game-to-game but is still deterministic for a given game state)
    const seed = moveHistory.length * 31 + (board[0].join('').length);
    const rng  = lcg(seed);
    allMoves.sort(() => rng() - 0.5);
    if (rng() < 0.45) {
      // Occasionally prefer a capture
      const captures = allMoves.filter(m => board[m.r][m.c]);
      if (captures.length) { doExecuteBot(captures[0]); return; }
    }
    doExecuteBot(allMoves[0]);
    return;
  }

  // ── Opening book (intermediate + master) ────────────────────────────────────
  const bookMove = tryOpeningBook(color);
  if (bookMove) { doExecuteBot(bookMove); return; }

  // ── Minimax search ──────────────────────────────────────────────────────────
  // Depth by difficulty. Quiescence extends every leaf so actual effective
  // depth is higher for tactical positions.
  const depthMap = { intermediate: 3, master: 4 };
  const depth    = depthMap[difficulty] || 3;

  const isWhite      = color === 'w';
  const isMaximising = isWhite;

  let best      = null;
  let bestScore = isMaximising ? -Infinity : Infinity;

  // Order moves before the root search too
  allMoves = orderMoves(allMoves, color);

  // Repetition-avoidance penalty applied at root level
  const recentKeys = new Set(botPositionHistory.slice(-6));

  for (const m of allMoves) {
    applyTempMove(m);

    // Penalise moves that would repeat a recent position
    const newKey     = positionKey();
    const repeatPenalty = recentKeys.has(newKey) ? 80 : 0;

    const rawScore   = minimax(depth - 1, -Infinity, Infinity, !isMaximising);
    const evalScore  = isMaximising ? rawScore - repeatPenalty : rawScore + repeatPenalty;
    undoTempMove(m);

    const better = isMaximising ? evalScore > bestScore
                                : evalScore < bestScore;
    const equal  = evalScore === bestScore;

    if (better || (equal && moveTiebreaker(m) < moveTiebreaker(best))) {
      bestScore = evalScore;
      best      = m;
    }
  }

  if (best) doExecuteBot(best);
}

// Simple LCG pseudo-random (deterministic but varied per seed)
function lcg(seed) {
  let s = seed | 0;
  return function() {
    s = (Math.imul(1664525, s) + 1013904223) | 0;
    return (s >>> 0) / 0xFFFFFFFF;
  };
}
