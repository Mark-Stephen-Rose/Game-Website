/* ============================================================
   CHECKERS — Mark's Silly Games
   English Draughts with AI (Easy / Medium / Hard) + local multiplayer
   Kings only (no forced captures)
   ============================================================ */

(function () {
  'use strict';

  // ── Constants ────────────────────────────────────────────────
  const ROWS = 8, COLS = 8;
  const EMPTY = 0, RED = 1, BLACK = 2, RED_KING = 3, BLACK_KING = 4;

  // ── State ────────────────────────────────────────────────────
  let board = [];
  let currentTurn = RED;           // RED = human (or P1), BLACK = AI/P2
  let selectedCell = null;
  let validMoves = [];
  let gameMode = 'easy';           // 'multiplayer' | 'easy' | 'medium' | 'hard'
  let gameActive = false;
  let scores = { red: 0, black: 0 };
  let aiThinking = false;

  // ── DOM refs ─────────────────────────────────────────────────
  let boardEl, statusEl, overlayEl, winnerTextEl, winnerSymbolEl;

  // ── Init ─────────────────────────────────────────────────────
  function init() {
    boardEl      = document.getElementById('board');
    statusEl     = document.getElementById('status');
    overlayEl    = document.getElementById('overlay');
    winnerTextEl = document.getElementById('winner-text');
    winnerSymbolEl = document.getElementById('winner-symbol');

    resetGame();
    applyTheme();
  }

  function resetGame() {
    board = buildInitialBoard();
    currentTurn = RED;
    selectedCell = null;
    validMoves = [];
    gameActive = true;
    aiThinking = false;
    if (overlayEl) overlayEl.classList.add('hidden');
    renderBoard();
    updateStatus();
    updatePlayerPanels();
  }

  function buildInitialBoard() {
    const b = [];
    for (let r = 0; r < ROWS; r++) {
      b[r] = [];
      for (let c = 0; c < COLS; c++) {
        if ((r + c) % 2 === 1) {
          if (r < 3)       b[r][c] = BLACK;
          else if (r > 4)  b[r][c] = RED;
          else             b[r][c] = EMPTY;
        } else {
          b[r][c] = EMPTY;
        }
      }
    }
    return b;
  }

  // ── Rendering ─────────────────────────────────────────────────
  function renderBoard() {
    boardEl.innerHTML = '';
    const moveSet = new Set(validMoves.map(m => `${m.toR},${m.toC}`));

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = document.createElement('div');
        cell.className = 'chk-cell ' + ((r + c) % 2 === 0 ? 'light' : 'dark');
        cell.dataset.r = r;
        cell.dataset.c = c;

        const piece = board[r][c];
        if (piece !== EMPTY) {
          const pieceEl = document.createElement('div');
          pieceEl.className = 'chk-piece ' +
            (piece === RED || piece === RED_KING ? 'red' : 'black') +
            (piece === RED_KING || piece === BLACK_KING ? ' king' : '');

          if (selectedCell && selectedCell.r === r && selectedCell.c === c) {
            pieceEl.classList.add('selected');
          }
          if (piece === RED_KING || piece === BLACK_KING) {
            const crown = document.createElement('span');
            crown.className = 'crown';
            crown.textContent = '♛';
            pieceEl.appendChild(crown);
          }
          cell.appendChild(pieceEl);
        }

        // Highlight valid move targets
        if (moveSet.has(`${r},${c}`)) {
          const dot = document.createElement('div');
          dot.className = 'move-dot';
          cell.appendChild(dot);
        }

        cell.addEventListener('click', onCellClick);
        boardEl.appendChild(cell);
      }
    }
  }

  function updateStatus() {
    if (!gameActive) return;
    const isAI   = gameMode !== 'multiplayer';
    const isHuman = currentTurn === RED;
    let msg;
    if (isAI) {
      msg = isHuman ? "Your turn" : "AI is thinking…";
    } else {
      msg = currentTurn === RED ? "Red's turn" : "Black's turn";
    }
    statusEl.textContent = msg;
  }

  function updatePlayerPanels() {
    const redEl   = document.getElementById('score-red');
    const blackEl = document.getElementById('score-black');
    if (redEl)   redEl.textContent   = scores.red   || '-';
    if (blackEl) blackEl.textContent = scores.black || '-';

    const panelRed   = document.getElementById('player-red');
    const panelBlack = document.getElementById('player-black');
    if (panelRed)   panelRed.classList.toggle('active',   currentTurn === RED);
    if (panelBlack) panelBlack.classList.toggle('active', currentTurn === BLACK);
  }

  // ── Cell click handler ────────────────────────────────────────
  function onCellClick(e) {
    if (!gameActive || aiThinking) return;
    if (gameMode !== 'multiplayer' && currentTurn === BLACK) return;

    const r = +e.currentTarget.dataset.r;
    const c = +e.currentTarget.dataset.c;
    const piece = board[r][c];

    if (selectedCell) {
      // Try to move to this cell — if multiple moves share the destination,
      // prefer the one with fewest captures so the player stops at this square.
      const candidates = validMoves.filter(m => m.toR === r && m.toC === c);
      const move = candidates.length
        ? candidates.reduce((a, b) => a.captures.length <= b.captures.length ? a : b)
        : null;


      if (move) {
        applyMove(move);
        return;
      }
      // Clicked a different piece of the same color
      if (piece !== EMPTY && isCurrentColor(piece)) {
        selectPiece(r, c);
        return;
      }
      // Deselect
      selectedCell = null;
      validMoves = [];
      renderBoard();
      return;
    }

    if (piece !== EMPTY && isCurrentColor(piece)) {
      selectPiece(r, c);
    }
  }

  function isCurrentColor(piece) {
    if (currentTurn === RED)   return piece === RED   || piece === RED_KING;
    if (currentTurn === BLACK) return piece === BLACK || piece === BLACK_KING;
    return false;
  }

  function selectPiece(r, c) {
    selectedCell = { r, c };
    validMoves   = getMovesForPiece(board, r, c);
    renderBoard();
  }

  // ── Move application ─────────────────────────────────────────
  function applyMove(move) {
    const newBoard = cloneBoard(board);
    const piece    = newBoard[move.fromR][move.fromC];
    newBoard[move.fromR][move.fromC] = EMPTY;

    // King promotion
    let promoted = piece;
    if (piece === RED   && move.toR === 0)        promoted = RED_KING;
    if (piece === BLACK && move.toR === ROWS - 1) promoted = BLACK_KING;
    newBoard[move.toR][move.toC] = promoted;

    // Remove captured pieces
    if (move.captures) {
      for (const cap of move.captures) {
        newBoard[cap.r][cap.c] = EMPTY;
      }
    }

    board = newBoard;
    selectedCell = null;
    validMoves   = [];

    // Check win
    const winner = checkWinner();
    if (winner) {
      renderBoard();
      endGame(winner);
      return;
    }

    switchTurn();
    renderBoard();
    updateStatus();
    updatePlayerPanels();

    // AI turn
    if (gameMode !== 'multiplayer' && currentTurn === BLACK && gameActive) {
      scheduleAI();
    }
  }

  function switchTurn() {
    currentTurn = currentTurn === RED ? BLACK : RED;
    selectedCell = null;
    validMoves   = [];
  }

  // ── Win detection ─────────────────────────────────────────────
  function checkWinner() {
    const redPieces   = countPieces(board, RED,   RED_KING);
    const blackPieces = countPieces(board, BLACK, BLACK_KING);
    if (redPieces   === 0) return BLACK;
    if (blackPieces === 0) return RED;

    // Stalemate — current player has pieces but no legal moves → draw
    const redMoves   = getAllMoves(board, RED);
    const blackMoves = getAllMoves(board, BLACK);
    if (currentTurn === RED   && redMoves.length   === 0) return 'draw';
    if (currentTurn === BLACK && blackMoves.length === 0) return 'draw';

    return null;
  }

  function countPieces(b, ...types) {
    let count = 0;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (types.includes(b[r][c])) count++;
    return count;
  }

  function endGame(winner) {
    gameActive = false;
    const isAI = gameMode !== 'multiplayer';

    if (winner === 'draw') {
      winnerTextEl.textContent   = "It's a Draw!";
      winnerSymbolEl.textContent = '🤝';
    } else if (winner === RED) {
      scores.red++;
      winnerTextEl.textContent  = isAI ? 'You Win!' : 'Red Wins!';
      winnerSymbolEl.textContent = '🔴';
    } else {
      scores.black++;
      winnerTextEl.textContent  = isAI ? 'AI Wins' : 'Black Wins!';
      winnerSymbolEl.textContent = '⚫';
    }

    updatePlayerPanels();
    overlayEl.classList.remove('hidden');
  }

  // ── Move generation ───────────────────────────────────────────
  function getMovesForPiece(b, r, c) {
    const piece   = b[r][c];
    const jumps   = getJumpsForPiece(b, r, c, piece, []);
    const simple  = getSimpleMovesForPiece(b, r, c, piece);
    // Return all available moves so both jumps and simple moves are highlighted;
    // the player can freely choose which to take.
    return [...jumps, ...simple];
  }

  function getSimpleMovesForPiece(b, r, c, piece) {
    const dirs = getMoveDirections(piece);
    const moves = [];
    for (const [dr, dc] of dirs) {
      const nr = r + dr, nc = c + dc;
      if (inBounds(nr, nc) && b[nr][nc] === EMPTY) {
        moves.push({ fromR: r, fromC: c, toR: nr, toC: nc, captures: [] });
      }
    }
    return moves;
  }

  function getJumpsForPiece(b, r, c, piece, alreadyCaptured) {
    const dirs   = getMoveDirections(piece);
    const jumps  = [];
    for (const [dr, dc] of dirs) {
      const mr = r + dr,  mc = c + dc;   // middle (enemy)
      const lr = r + dr*2, lc = c + dc*2; // landing
      if (!inBounds(lr, lc)) continue;
      if (b[lr][lc] !== EMPTY) continue;
      const mid = b[mr][mc];
      if (mid === EMPTY) continue;
      if (isCurrentColorPiece(piece, mid)) continue;
      // Check not already captured in this chain
      if (alreadyCaptured.some(cp => cp.r === mr && cp.c === mc)) continue;

      const newCaptures = [...alreadyCaptured, { r: mr, c: mc }];

      // Try continuing the chain
      const tmp = cloneBoard(b);
      tmp[mr][mc] = EMPTY;  // temporarily remove to allow multi-jump
      const further = getJumpsForPiece(tmp, lr, lc, piece, newCaptures);

      // Always offer stopping here after this single jump
      jumps.push({
        fromR: r, fromC: c,
        toR: lr, toC: lc,
        captures: newCaptures
      });

      // Also offer all multi-jump continuations from here
      for (const f of further) {
        jumps.push({
          fromR: r, fromC: c,
          toR: f.toR, toC: f.toC,
          captures: newCaptures.concat(f.captures.slice(newCaptures.length))
        });
      }
    }
    return jumps;
  }

  function isCurrentColorPiece(mover, target) {
    const redPieces   = [RED,   RED_KING];
    const blackPieces = [BLACK, BLACK_KING];
    if (redPieces.includes(mover))   return redPieces.includes(target);
    if (blackPieces.includes(mover)) return blackPieces.includes(target);
    return false;
  }

  function getMoveDirections(piece) {
    if (piece === RED_KING || piece === BLACK_KING) {
      return [[-1,-1],[-1,1],[1,-1],[1,1]];
    }
    if (piece === RED)   return [[-1,-1],[-1,1]];
    if (piece === BLACK) return [[1,-1],[1,1]];
    return [];
  }

  function getAllMoves(b, color) {
    const moves = [];
    const pieces = color === RED ? [RED, RED_KING] : [BLACK, BLACK_KING];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (pieces.includes(b[r][c])) {
          moves.push(...getMovesForPiece(b, r, c));
        }
      }
    }
    return moves;
  }

  function inBounds(r, c) { return r >= 0 && r < ROWS && c >= 0 && c < COLS; }

  function cloneBoard(b) {
    return b.map(row => [...row]);
  }

  // ── AI ────────────────────────────────────────────────────────
  function scheduleAI() {
    aiThinking = true;
    const delay = gameMode === 'easy' ? 400 : gameMode === 'medium' ? 600 : 800;
    setTimeout(() => {
      const move = getBestMove(board, BLACK, gameMode);
      aiThinking = false;
      if (move && gameActive) {
        applyMove(move);
      }
    }, delay);
  }

  function getBestMove(b, color, difficulty) {
    const moves = getAllMoves(b, color);
    if (!moves.length) return null;

    if (difficulty === 'easy') {
      // ~60% random, ~40% prefers jumps
      const jumps = moves.filter(m => m.captures.length);
      if (jumps.length && Math.random() < 0.4) {
        return jumps[Math.floor(Math.random() * jumps.length)];
      }
      return moves[Math.floor(Math.random() * moves.length)];
    }

    if (difficulty === 'medium') {
      // Minimax depth 3
      let best = null, bestScore = -Infinity;
      for (const move of moves) {
        const nb = applyMoveToBoard(b, move);
        const score = minimax(nb, 3, -Infinity, Infinity, false, RED);
        if (score > bestScore) { bestScore = score; best = move; }
      }
      return best;
    }

    // Hard — minimax depth 5
    let best = null, bestScore = -Infinity;
    for (const move of moves) {
      const nb = applyMoveToBoard(b, move);
      const score = minimax(nb, 5, -Infinity, Infinity, false, RED);
      if (score > bestScore) { bestScore = score; best = move; }
    }
    return best;
  }

  function applyMoveToBoard(b, move) {
    const nb = cloneBoard(b);
    const piece = nb[move.fromR][move.fromC];
    nb[move.fromR][move.fromC] = EMPTY;
    let promoted = piece;
    if (piece === RED   && move.toR === 0)        promoted = RED_KING;
    if (piece === BLACK && move.toR === ROWS - 1) promoted = BLACK_KING;
    nb[move.toR][move.toC] = promoted;
    if (move.captures) {
      for (const cap of move.captures) nb[cap.r][cap.c] = EMPTY;
    }
    return nb;
  }

  function minimax(b, depth, alpha, beta, isMaximising, turnColor) {
    if (depth === 0) return evaluateBoard(b);

    const moves = getAllMoves(b, turnColor);
    if (!moves.length) return isMaximising ? -1000 : 1000;

    const nextColor = turnColor === RED ? BLACK : RED;

    if (isMaximising) {
      let maxEval = -Infinity;
      for (const move of moves) {
        const nb = applyMoveToBoard(b, move);
        const ev = minimax(nb, depth - 1, alpha, beta, false, nextColor);
        maxEval = Math.max(maxEval, ev);
        alpha   = Math.max(alpha, ev);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const move of moves) {
        const nb = applyMoveToBoard(b, move);
        const ev = minimax(nb, depth - 1, alpha, beta, true, nextColor);
        minEval = Math.min(minEval, ev);
        beta    = Math.min(beta, ev);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  }

  function evaluateBoard(b) {
    // Positive = good for BLACK (AI), negative = good for RED
    let score = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const p = b[r][c];
        if (p === BLACK)       score += 10 + (r * 0.3);        // advance bonus
        else if (p === BLACK_KING) score += 18;
        else if (p === RED)    score -= (10 + ((ROWS - 1 - r) * 0.3));
        else if (p === RED_KING)   score -= 18;
      }
    }
    return score;
  }

  // ── Public API ────────────────────────────────────────────────
  window.resetGame = resetGame;

  window.changeGameMode = function () {
    const sel = document.getElementById('game-mode');
    if (!sel) return;
    gameMode = sel.value;
    scores = { red: 0, black: 0 };
    const redEl   = document.getElementById('score-red');
    const blackEl = document.getElementById('score-black');
    if (redEl)   redEl.textContent   = '-';
    if (blackEl) blackEl.textContent = '-';

    // Update right panel labels based on mode
    const p1Name = document.getElementById('player-red-name');
    const p2Name = document.getElementById('player-black-name');
    if (p1Name) p1Name.textContent = 'You';
    if (p2Name) p2Name.textContent = gameMode === 'multiplayer' ? 'Player 2' : 'AI';

    resetGame();
  };

  window.playAgain = resetGame;

  window.exitGame = function () {
    window.location.href = 'index.html';
  };

  // ── Theme support ──────────────────────────────────────────────
  function applyTheme() {
    const theme = document.documentElement.getAttribute('data-theme') || 'light';
    document.documentElement.setAttribute('data-theme', theme);
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
