/* ============================================================
   MARK'S SILLY GAMES — Sudoku
   Full puzzle generator, solver, and UI
   ============================================================ */

(function() {
  'use strict';

  // ── State ──────────────────────────────────────────────────
  let solution   = [];   // 9x9 solved grid
  let puzzle     = [];   // 9x9 puzzle (0 = empty)
  let userGrid   = [];   // 9x9 user entries
  let given      = [];   // 9x9 boolean — is this cell pre-filled?
  let selected   = null; // { r, c }
  let errors     = 0;
  let maxErrors  = 5;
  let difficulty = 'medium';
  let gameOver   = false;
  let solved     = false;

  const CLUES = { easy: 45, medium: 36, hard: 28, expert: 22 };

  // ── Puzzle Generation ─────────────────────────────────────

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function isValid(grid, r, c, num) {
    // Row
    for (let col = 0; col < 9; col++) if (grid[r][col] === num) return false;
    // Col
    for (let row = 0; row < 9; row++) if (grid[row][c] === num) return false;
    // Box
    const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
    for (let dr = 0; dr < 3; dr++)
      for (let dc = 0; dc < 3; dc++)
        if (grid[br + dr][bc + dc] === num) return false;
    return true;
  }

  function fillGrid(grid) {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (grid[r][c] === 0) {
          const nums = shuffle([1,2,3,4,5,6,7,8,9]);
          for (const n of nums) {
            if (isValid(grid, r, c, n)) {
              grid[r][c] = n;
              if (fillGrid(grid)) return true;
              grid[r][c] = 0;
            }
          }
          return false;
        }
      }
    }
    return true;
  }

  // Returns count of solutions (up to limit)
  function countSolutions(grid, limit = 2) {
    let count = 0;
    function solve(g) {
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (g[r][c] === 0) {
            for (let n = 1; n <= 9; n++) {
              if (isValid(g, r, c, n)) {
                g[r][c] = n;
                solve(g);
                g[r][c] = 0;
                if (count >= limit) return;
              }
            }
            return;
          }
        }
      }
      count++;
    }
    const copy = grid.map(r => [...r]);
    solve(copy);
    return count;
  }

  function generatePuzzle(diff) {
    // 1. Build a full solved grid
    const sol = Array.from({ length: 9 }, () => Array(9).fill(0));
    fillGrid(sol);

    // 2. Remove cells while keeping unique solution
    const puz = sol.map(r => [...r]);
    const cells = shuffle([...Array(81).keys()]);
    const clues = CLUES[diff] || 36;
    let removed = 0;
    const target = 81 - clues;

    for (const idx of cells) {
      if (removed >= target) break;
      const r = Math.floor(idx / 9), c = idx % 9;
      const backup = puz[r][c];
      puz[r][c] = 0;
      if (countSolutions(puz) === 1) {
        removed++;
      } else {
        puz[r][c] = backup;
      }
    }

    return { sol, puz };
  }

  // ── UI Helpers ────────────────────────────────────────────

  function getCell(r, c) {
    return document.querySelector(`.sudoku-cell[data-row="${r}"][data-col="${c}"]`);
  }

  function updateErrorPips() {
    const pips = document.querySelectorAll('.error-pip');
    pips.forEach((pip, i) => {
      pip.classList.toggle('active', i < errors);
    });
    const stat = document.querySelector('.stat-value.errors-count');
    if (stat) stat.textContent = errors;
  }

  function highlightRelated(r, c) {
    // Clear all highlights
    document.querySelectorAll('.sudoku-cell').forEach(el => {
      el.classList.remove('selected', 'highlight', 'same-num');
    });

    if (r === null) return;

    const val = userGrid[r][c] || puzzle[r][c];
    const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;

    document.querySelectorAll('.sudoku-cell').forEach(el => {
      const er = +el.dataset.row, ec = +el.dataset.col;
      if (er === r && ec === c) {
        el.classList.add('selected');
      } else if (er === r || ec === c ||
                 (Math.floor(er/3)*3 === br && Math.floor(ec/3)*3 === bc)) {
        el.classList.add('highlight');
      }
      // Same number
      if (val && (userGrid[er][ec] === val || (given[er][ec] && puzzle[er][ec] === val))) {
        el.classList.add('same-num');
      }
    });
  }

  function renderCell(r, c) {
    const el = getCell(r, c);
    if (!el) return;
    const val = given[r][c] ? puzzle[r][c] : userGrid[r][c];
    el.textContent = val || '';
    el.classList.toggle('given', !!given[r][c]);
    el.classList.toggle('user-input', !given[r][c] && !!userGrid[r][c]);
    el.classList.remove('error');
  }

  function setStatus(msg, cls = '') {
    const el = document.getElementById('status');
    if (!el) return;
    el.textContent = msg;
    el.className = cls;
  }

  // ── Input Handling ────────────────────────────────────────

  function selectCell(r, c) {
    if (gameOver || solved) return;
    selected = { r, c };
    highlightRelated(r, c);
  }

  function enterNumber(num) {
    if (!selected || gameOver || solved) return;
    const { r, c } = selected;
    if (given[r][c]) return;

    if (num === 0) {
      // Erase
      userGrid[r][c] = 0;
      renderCell(r, c);
      highlightRelated(r, c);
      setStatus('');
      return;
    }

    userGrid[r][c] = num;
    const cell = getCell(r, c);

    if (num !== solution[r][c]) {
      // Wrong
      errors++;
      updateErrorPips();
      cell.classList.add('error');
      cell.classList.add('user-input');
      cell.textContent = num;
      setStatus(`× Not quite — ${maxErrors - errors} mistake${maxErrors - errors !== 1 ? 's' : ''} remaining`, 'error');

      if (errors >= maxErrors) {
        cell.classList.add('complete-anim');
        setTimeout(() => showModal('game-over'), 600);
        gameOver = true;
        return;
      }
      // Clear error highlight after a beat
      setTimeout(() => {
        userGrid[r][c] = 0;
        renderCell(r, c);
        if (selected && selected.r === r && selected.c === c) highlightRelated(r, c);
        if (errors < maxErrors) setStatus('');
      }, 900);
      return;
    }

    // Correct
    renderCell(r, c);
    cell.classList.add('complete-anim');
    highlightRelated(r, c);

    // Check win
    if (checkSolved()) {
      solved = true;
      setStatus('Puzzle complete!', 'success');
      document.querySelectorAll('.sudoku-cell').forEach((el, i) => {
        setTimeout(() => el.classList.add('complete-anim'), i * 8);
      });
      setTimeout(() => showModal('win'), 900);
    } else {
      setStatus('');
    }
  }

  function checkSolved() {
    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 9; c++)
        if (!given[r][c] && userGrid[r][c] !== solution[r][c]) return false;
    return true;
  }

  // ── Modal ─────────────────────────────────────────────────

  function showModal(type) {
    const overlay = document.getElementById('overlay');
    const winnerText = document.getElementById('winner-text');
    const winnerSub  = document.getElementById('winner-sub');
    const icon       = document.getElementById('modal-icon');

    if (type === 'win') {
      icon.textContent        = '✓';
      winnerText.textContent  = 'Solved!';
      winnerSub.textContent   = `Finished on ${difficulty} with ${errors} mistake${errors !== 1 ? 's' : ''}.`;
    } else {
      icon.textContent        = '✕';
      winnerText.textContent  = 'Game Over';
      winnerSub.textContent   = `Too many mistakes. Better luck next time.`;
    }

    overlay.classList.remove('hidden');
  }

  // ── Board Rendering ───────────────────────────────────────

  function buildBoard() {
    const board = document.getElementById('sudoku-board');
    if (!board) return;
    board.innerHTML = '';

    // Grid is 11 columns/rows: 9 cells + 2 thick-gap spacers (after col/row 2 and 5)
    // We place cells manually using grid-column/grid-row
    // Column/row mapping: visual 1-3 -> grid 1-3, gap at 4, visual 4-6 -> grid 5-7, gap at 8, visual 7-9 -> grid 9-11
    const toGrid = i => i < 3 ? i + 1 : i < 6 ? i + 2 : i + 3;

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const cell = document.createElement('div');
        cell.className = 'sudoku-cell';
        cell.dataset.row = r;
        cell.dataset.col = c;
        cell.style.gridColumn = toGrid(c);
        cell.style.gridRow    = toGrid(r);

        const val = given[r][c] ? puzzle[r][c] : userGrid[r][c];
        cell.textContent = val || '';
        if (given[r][c]) cell.classList.add('given');
        if (!given[r][c] && userGrid[r][c]) cell.classList.add('user-input');

        cell.addEventListener('click', () => selectCell(r, c));
        board.appendChild(cell);
      }
    }

    // Inject gap spacer divs for the thick box borders (col 4 and 8, row 4 and 8)
    for (let i = 1; i <= 11; i++) {
      // Vertical gap columns (col 4 and 8)
      for (const gapCol of [4, 8]) {
        const g = document.createElement('div');
        g.className = 'sudoku-gap';
        g.style.gridColumn = gapCol;
        g.style.gridRow = i;
        board.appendChild(g);
      }
      // Horizontal gap rows (row 4 and 8)
      for (const gapRow of [4, 8]) {
        const g = document.createElement('div');
        g.className = 'sudoku-gap';
        g.style.gridColumn = i;
        g.style.gridRow = gapRow;
        board.appendChild(g);
      }
    }
  }

  // ── New Game ──────────────────────────────────────────────

  function newGame(diff) {
    difficulty = diff || difficulty;
    errors = 0;
    gameOver = false;
    solved = false;
    selected = null;

    setStatus('Select a cell to begin');

    const { sol, puz } = generatePuzzle(difficulty);
    solution = sol;
    puzzle   = puz;
    userGrid = Array.from({ length: 9 }, () => Array(9).fill(0));
    given    = Array.from({ length: 9 }, (_, r) =>
                 Array.from({ length: 9 }, (__, c) => puz[r][c] !== 0));

    buildBoard();
    updateErrorPips();

    const overlay = document.getElementById('overlay');
    if (overlay) overlay.classList.add('hidden');
  }

  // ── Keyboard Support ──────────────────────────────────────

  function handleKey(e) {
    if (!selected) return;
    const { r, c } = selected;

    if (e.key >= '1' && e.key <= '9') { enterNumber(+e.key); return; }
    if (e.key === '0' || e.key === 'Backspace' || e.key === 'Delete') { enterNumber(0); return; }

    const moves = { ArrowUp:[-1,0], ArrowDown:[1,0], ArrowLeft:[0,-1], ArrowRight:[0,1] };
    if (moves[e.key]) {
      e.preventDefault();
      const [dr, dc] = moves[e.key];
      const nr = Math.max(0, Math.min(8, r + dr));
      const nc = Math.max(0, Math.min(8, c + dc));
      selectCell(nr, nc);
    }
  }

  // ── Global functions (called from HTML) ───────────────────

  window.sudokuEnterNumber = enterNumber;
  window.sudokuNewGame    = function() { newGame(difficulty); };
  function exitGame() { window.location.href = 'index.html'; }
  window.sudokuExit       = exitGame;
  window.sudokuPlayAgain  = function() { newGame(difficulty); };
  window.sudokuChangeDiff = function() {
    const sel = document.getElementById('difficulty');
    if (sel) { difficulty = sel.value; newGame(difficulty); }
  };

  // ── Init ──────────────────────────────────────────────────

  document.addEventListener('keydown', handleKey);
  newGame('medium');

})();
