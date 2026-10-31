/* ============================================================
   MARK'S SILLY GAMES — Router
   Handles SPA navigation without separate HTML files.
   ============================================================ */

const GAMES = {
  tictactoe: {
    title: "Tic Tac Toe",
    css: "Style/tictactoe.css",
    scripts: ["JS/tictactoe.js"],
    render: () => `
<!-- LEFT PLAYER PANEL -->
<div class="side left">
    <div class="player-label active" id="player-x">
        <div class="player-name">Player X</div>
        <div class="player-score" id="score-x">-</div>
    </div>
    <div class="player-label" id="player-o">
        <div class="player-name">Player O</div>
        <div class="player-score" id="score-o">-</div>
    </div>
</div>
<!-- GAME -->
<div class="game-container">
    <h1>Tic Tac Toe</h1>
    <div id="status">Player X's Turn</div>
    <div class="board" id="board"></div>
    <!-- MODAL -->
    <div id="overlay" class="overlay hidden">
        <div class="modal">
            <div class="winner-text" id="winner-text">Winner</div>
            <div class="winner-symbol" id="winner-symbol">X</div>
            <div class="draw-symbols hidden" id="draw-symbols">
                <span class="mark-x">X</span>
                <span class="mark-o">O</span>
            </div>
            <div class="modal-buttons">
                <button onclick="playAgain()">Another Round</button>
                <button onclick="exitGame()">Leave Game</button>
            </div>
        </div>
    </div>
    <div class="controls">
        <button onclick="resetGame()">Reset Board</button>
        <button onclick="exitGame()">Leave Game</button>
    </div>
</div>
<!-- RIGHT PANEL -->
<div class="side right">
    <div class="mode-selector">
        <label for="game-mode">Game Mode</label>
        <select id="game-mode" onchange="changeGameMode()">
            <option value="multiplayer">Multiplayer</option>
            <option value="easy">Single Player - Easy</option>
            <option value="medium">Single Player - Medium</option>
            <option value="hard">Single Player - Hard</option>
        </select>
    </div>
</div>`
  },

  connectfour: {
    title: "Connect Four",
    css: "Style/connectfour.css",
    scripts: ["JS/connectfour.js"],
    render: () => `
<!-- LEFT PLAYER PANEL -->
<div class="side left">
    <div class="player-label active purple-player" id="player-purple">
        <div class="player-name">Player 1</div>
        <div class="player-score" id="score-purple">-</div>
    </div>
    <div class="player-label green-player" id="player-green">
        <div class="player-name">Player 2</div>
        <div class="player-score" id="score-green">-</div>
    </div>
</div>
<!-- GAME -->
<div class="game-container">
    <h1>Connect Four</h1>
    <div id="status">Player 1's Turn</div>
    <div class="board" id="board"></div>
    <!-- MODAL -->
    <div id="overlay" class="overlay hidden">
        <div class="modal">
            <div class="winner-text" id="winner-text">Winner</div>
            <div class="winner-symbol" id="winner-symbol"></div>
            <div class="draw-symbols hidden" id="draw-symbols">
                <span class="token purple"></span>
                <span class="token green"></span>
            </div>
            <div class="modal-buttons">
                <button onclick="playAgain()">Drop Again</button>
                <button onclick="exitGame()">Leave Game</button>
            </div>
        </div>
    </div>
    <div class="controls">
        <button onclick="resetGame()">Clear Board</button>
        <button onclick="exitGame()">Leave Game</button>
    </div>
</div>
<!-- RIGHT PANEL -->
<div class="side right">
    <div class="mode-selector">
        <label for="game-mode">Game Mode</label>
        <select id="game-mode" onchange="changeGameMode()">
            <option value="multiplayer">Multiplayer</option>
            <option value="easy">Single Player - Easy</option>
            <option value="medium">Single Player - Medium</option>
            <option value="hard">Single Player - Hard</option>
        </select>
    </div>
</div>`
  },

  minesweeper: {
    title: "Minesweeper",
    css: "Style/minesweeper.css",
    scripts: ["JS/minesweeper.js"],
    render: () => `
<!-- LEFT PANEL -->
<div class="side left">
    <div class="stat-display"><div class="stat-label">Mines</div><div class="stat-value" id="mine-counter">10</div></div>
    <div class="stat-display"><div class="stat-label">Time</div><div class="stat-value" id="timer">000</div></div>
    <div class="stat-display"><div class="stat-label">Clicks</div><div class="stat-value" id="click-counter">0</div></div>
    <div class="stat-display"><div class="stat-label">Best Time</div><div class="stat-value best-time" id="best-time">---</div></div>
</div>
<!-- GAME -->
<div class="game-container">
    <h1>Minesweeper</h1>
    <div id="status">Select a tile to begin</div>
    <div class="board-container">
        <div class="board" id="board"></div>
    </div>
    <div class="controls">
        <button onclick="resetGame()">New Field</button>
        <button onclick="exitGame()">Leave Game</button>
    </div>
</div>
<!-- RIGHT PANEL -->
<div class="side right">
    <div class="mode-selector">
        <label for="difficulty">Difficulty</label>
        <select id="difficulty" onchange="changeDifficulty()">
            <option value="easy">Easy (8×8)</option>
            <option value="medium">Medium (16×16)</option>
            <option value="hard">Hard (16×30)</option>
        </select>
    </div>
    <div class="autocomplete-section">
        <label class="autocomplete-label">
            <input type="checkbox" id="autocomplete" onchange="toggleAutocomplete()">
            <span>Auto-Solve</span>
        </label>
    </div>
</div>`
  },

  sudoku: {
    title: "Sudoku",
    css: "Style/sudoku.css",
    scripts: ["JS/sudoku.js"],
    render: () => `
<!-- LEFT PANEL -->
<div class="side left">
    <div class="stat-display">
        <div class="stat-label">Difficulty</div>
        <div class="stat-value difficulty-display" id="diff-display">Medium</div>
    </div>
    <div class="errors-display">
        <div class="stat-label">Mistakes</div>
        <div class="errors-pips">
            <div class="error-pip" id="pip-0"></div>
            <div class="error-pip" id="pip-1"></div>
            <div class="error-pip" id="pip-2"></div>
            <div class="error-pip" id="pip-3"></div>
            <div class="error-pip" id="pip-4"></div>
        </div>
    </div>
</div>
<!-- GAME -->
<div class="game-container">
    <h1>Sudoku</h1>
    <div id="status">Select a cell to begin</div>
    <div class="sudoku-board" id="sudoku-board"></div>
    <div class="numpad">
        <button class="numpad-btn" onclick="sudokuEnterNumber(1)">1</button>
        <button class="numpad-btn" onclick="sudokuEnterNumber(2)">2</button>
        <button class="numpad-btn" onclick="sudokuEnterNumber(3)">3</button>
        <button class="numpad-btn" onclick="sudokuEnterNumber(4)">4</button>
        <button class="numpad-btn" onclick="sudokuEnterNumber(5)">5</button>
        <button class="numpad-btn" onclick="sudokuEnterNumber(6)">6</button>
        <button class="numpad-btn" onclick="sudokuEnterNumber(7)">7</button>
        <button class="numpad-btn" onclick="sudokuEnterNumber(8)">8</button>
        <button class="numpad-btn" onclick="sudokuEnterNumber(9)">9</button>
    </div>
    <div class="controls">
        <button onclick="sudokuNewGame()">New Puzzle</button>
        <button onclick="sudokuExit()">Leave Game</button>
    </div>
    <!-- MODAL -->
    <div id="overlay" class="overlay hidden">
        <div class="modal">
            <div class="modal-icon" id="modal-icon">✓</div>
            <div class="winner-text" id="winner-text">Solved!</div>
            <div class="winner-sub" id="winner-sub"></div>
            <div class="modal-buttons">
                <button onclick="sudokuPlayAgain()">New Puzzle</button>
                <button onclick="sudokuExit()">Leave Game</button>
            </div>
        </div>
    </div>
</div>
<!-- RIGHT PANEL -->
<div class="side right">
    <div class="mode-selector">
        <label for="difficulty">Difficulty</label>
        <select id="difficulty" onchange="sudokuChangeDiff()">
            <option value="easy">Easy</option>
            <option value="medium" selected>Medium</option>
            <option value="hard">Hard</option>
            <option value="expert">Expert</option>
        </select>
    </div>
</div>`
  },

  checkers: {
    title: "Checkers",
    css: "Style/checkers.css",
    scripts: ["JS/checkers.js"],
    render: () => `
<!-- LEFT PLAYER PANEL -->
<div class="side left">
    <div class="player-block active" id="player-red">
        <div class="player-name-label"><span class="player-dot red"></span><span id="player-red-name">You</span></div>
        <div class="player-id">Red</div>
        <div class="player-score" id="score-red">-</div>
    </div>
    <div class="player-block" id="player-black">
        <div class="player-name-label"><span class="player-dot black"></span><span id="player-black-name">AI</span></div>
        <div class="player-id">Black</div>
        <div class="player-score" id="score-black">-</div>
    </div>
</div>
<!-- GAME -->
<div class="game-container">
    <div class="game-header">
        <a class="back-btn" href="index.html" title="Back to games">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </a>
        <h1>Checkers</h1>
    </div>
    <div id="status">Your turn</div>
    <div id="board"></div>
    <!-- MODAL -->
    <div id="overlay" class="overlay hidden">
        <div class="modal">
            <div class="winner-text" id="winner-text">Winner</div>
            <div class="winner-symbol" id="winner-symbol">🔴</div>
            <div class="modal-buttons">
                <button onclick="playAgain()">Play Again</button>
                <button onclick="exitGame()">Leave Game</button>
            </div>
        </div>
    </div>
    <div class="controls">
        <button onclick="resetGame()">New Game</button>
        <button onclick="exitGame()">Leave Game</button>
    </div>
</div>
<!-- RIGHT PANEL -->
<div class="side right">
    <div class="mode-selector">
        <label for="game-mode">Game Mode</label>
        <select id="game-mode" onchange="changeGameMode()">
            <option value="easy">vs AI — Easy</option>
            <option value="medium">vs AI — Medium</option>
            <option value="hard">vs AI — Hard</option>
            <option value="multiplayer">2 Player Local</option>
        </select>
    </div>
</div>`
  },

  chess: {
    title: "Chess",
    css: "Style/chess.css",
    scripts: ["JS/chess.js"],
    render: () => `
<!-- PRE-GAME SETUP MODAL -->
<div class="setup-overlay" id="setup-overlay">
  <div class="setup-modal">
    <a href="index.html" class="setup-back">← Back to Games</a>
    <div class="setup-icon">♟</div>
    <h2 class="setup-title">Chess</h2>
    <p class="setup-sub">Configure your match before you begin</p>
    <div class="setup-field">
      <label class="setup-label">Game Mode</label>
      <div class="setup-options" id="setup-mode-options">
        <button class="setup-opt active" data-val="bot" onclick="selectSetup('mode','bot',this)">vs Bot</button>
        <button class="setup-opt" data-val="friend" onclick="selectSetup('mode','friend',this)">vs Friend</button>
      </div>
    </div>
    <div class="setup-field" id="setup-diff-field">
      <label class="setup-label">Bot Difficulty</label>
      <div class="setup-options" id="setup-diff-options">
        <button class="setup-opt" data-val="beginner" onclick="selectSetup('diff','beginner',this)">Beginner</button>
        <button class="setup-opt active" data-val="intermediate" onclick="selectSetup('diff','intermediate',this)">Intermediate</button>
        <button class="setup-opt" data-val="master" onclick="selectSetup('diff','master',this)">Master</button>
      </div>
    </div>
    <div class="setup-field" id="setup-color-field">
      <label class="setup-label">Play As</label>
      <div class="setup-options" id="setup-color-options">
        <button class="setup-opt active" data-val="white" onclick="selectSetup('color','white',this)">White</button>
        <button class="setup-opt" data-val="black" onclick="selectSetup('color','black',this)">Black</button>
        <button class="setup-opt" data-val="random" onclick="selectSetup('color','random',this)">Random</button>
      </div>
    </div>
    <div class="setup-field">
      <label class="setup-label">Time Control</label>
      <div class="setup-options" id="setup-time-options">
        <button class="setup-opt" data-val="180" onclick="selectSetup('time','180',this)">3 min</button>
        <button class="setup-opt" data-val="300" onclick="selectSetup('time','300',this)">5 min</button>
        <button class="setup-opt active" data-val="600" onclick="selectSetup('time','600',this)">10 min</button>
        <button class="setup-opt" data-val="900" onclick="selectSetup('time','900',this)">15 min</button>
        <button class="setup-opt" data-val="0" onclick="selectSetup('time','0',this)">∞</button>
      </div>
    </div>
    <button class="setup-start" onclick="startGameFromSetup()">Start Game →</button>
  </div>
</div>
<!-- LEFT PANEL -->
<div class="side left">
  <div class="player-block" id="block-black">
    <div class="player-name-label"><span class="player-color-dot black"></span>Black</div>
    <div class="player-name-val" id="name-black">Opponent</div>
    <div class="player-timer" id="timer-black">10:00</div>
    <div class="captured-label">Captured</div>
    <div class="captured-pieces" id="captured-by-black"></div>
    <div class="material-advantage" id="adv-black"></div>
  </div>
  <div class="player-block active" id="block-white">
    <div class="player-name-label"><span class="player-color-dot white"></span>White</div>
    <div class="player-name-val" id="name-white">You</div>
    <div class="player-timer" id="timer-white">10:00</div>
    <div class="captured-label">Captured</div>
    <div class="captured-pieces" id="captured-by-white"></div>
    <div class="material-advantage" id="adv-white"></div>
  </div>
</div>
<!-- GAME CENTER -->
<div class="game-container">
  <div class="game-header">
    <a href="index.html" class="back-btn" title="Back to games">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
    </a>
    <h1>Chess</h1>
  </div>
  <div id="status">Select a piece to begin</div>
  <div class="board-wrap">
    <div class="board-coords-rank" id="coords-rank"></div>
    <div id="board"></div>
    <div class="board-coords-file" id="coords-file"></div>
  </div>
  <div class="promo-modal hidden" id="promo-modal">
    <div class="promo-box">
      <div class="promo-label">Promote Pawn</div>
      <div class="promo-pieces" id="promo-pieces"></div>
    </div>
  </div>
  <div class="countdown-overlay hidden" id="countdown-overlay">
    <div class="countdown-number" id="countdown-number">3</div>
  </div>
  <div class="overlay hidden" id="overlay">
    <div class="modal">
      <span class="modal-icon" id="modal-icon">&#9822;</span>
      <div class="modal-title" id="modal-title">Game Over</div>
      <div class="modal-sub" id="modal-sub"></div>
      <div class="modal-buttons">
        <button onclick="enterReviewFromModal()">Review Game</button>
        <button onclick="rematchGame()">Rematch</button>
        <button onclick="showSetup()">New Game</button>
        <button onclick="exitGame()">Leave</button>
      </div>
    </div>
  </div>
  <div class="overlay hidden" id="resign-overlay">
    <div class="modal">
      <span class="modal-icon">🏳️</span>
      <div class="modal-title">Resign?</div>
      <div class="modal-sub">Are you sure you want to resign this game?</div>
      <div class="modal-buttons">
        <button onclick="confirmResign()">Yes, Resign</button>
        <button onclick="document.getElementById('resign-overlay').classList.add('hidden')">Cancel</button>
      </div>
    </div>
  </div>
  <div class="controls">
    <button id="btn-undo" onclick="undoMove()">↩ Undo</button>
    <button onclick="showResignDialog()" id="btn-resign">🏳 Resign</button>
    <button onclick="showSetup()">New Game</button>
  </div>
</div>
<!-- RIGHT PANEL -->
<div class="side right">
  <div class="panel-section">
    <div class="panel-label">Current Game</div>
    <div class="game-info-row" id="info-mode">— vs —</div>
    <div class="game-info-row faint" id="info-time">—</div>
  </div>
  <div class="panel-section" id="engine-status-wrap">
    <div class="panel-label">Engine</div>
    <div class="engine-status">
      <span class="engine-dot" id="engine-dot"></span>
      <span id="engine-status-text">Loading Stockfish…</span>
    </div>
  </div>
  <div class="panel-section move-history-panel">
    <div class="panel-label">Move History</div>
    <div class="move-list" id="move-list"></div>
  </div>
</div>
<div id="drag-ghost"></div>`
  },

  blackjack: {
    title: "Blackjack",
    css: "Style/blackjack.css",
    scripts: ["JS/blackjack.js"],
    render: () => `
<div class="table-wrap">
  <div class="setup-modal" id="setupModal">
    <div class="setup-inner">
      <div class="setup-eyebrow">Blackjack</div>
      <h2 class="setup-title">Before We Deal</h2>
      <div class="setup-section">
        <div class="setup-label">How many players?</div>
        <div class="setup-options" id="setupPlayers">
          <button class="setup-opt active" data-val="1">1</button>
          <button class="setup-opt" data-val="2">2</button>
          <button class="setup-opt" data-val="3">3</button>
        </div>
      </div>
      <div class="setup-section setup-mode-section hidden" id="setupModeSection">
        <div class="setup-label">Play style?</div>
        <div class="setup-options" id="setupMode">
          <button class="setup-opt active" data-val="vs-bots" title="You play, others are AI">vs Bots</button>
          <button class="setup-opt" data-val="multiplayer" title="All players take turns on this device">Multiplayer</button>
        </div>
        <div class="setup-mode-hint" id="setupModeHint">You play — other seats are AI opponents</div>
      </div>
      <div class="setup-section">
        <div class="setup-label">Betting?</div>
        <div class="setup-options" id="setupBetting">
          <button class="setup-opt active" data-val="off">Off</button>
          <button class="setup-opt" data-val="on">On</button>
        </div>
      </div>
      <button class="setup-start" id="btnSetupStart">Deal Cards →</button>
      <a class="setup-back" href="index.html">← Back to Games</a>
    </div>
  </div>
  <header class="bj-header">
    <a class="bj-back" href="index.html">
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
      Games
    </a>
    <div class="bj-title-block">
      <span class="bj-eyebrow">House Always Wins</span>
      <h1 class="bj-title">Blackjack</h1>
    </div>
    <div class="bj-settings" id="bjSettings">
      <div class="settings-group">
        <span class="settings-label">Players</span>
        <div class="settings-opts" id="settingsPlayers">
          <button class="settings-opt active" data-val="1">1</button>
          <button class="settings-opt" data-val="2">2</button>
          <button class="settings-opt" data-val="3">3</button>
        </div>
      </div>
      <div class="settings-divider settings-mode-divider hidden" id="settingsModeDivider"></div>
      <div class="settings-group hidden" id="settingsModeGroup">
        <span class="settings-label">Mode</span>
        <div class="settings-opts" id="settingsMode">
          <button class="settings-opt active" data-val="vs-bots">vs Bots</button>
          <button class="settings-opt" data-val="multiplayer">Multi</button>
        </div>
      </div>
      <div class="settings-divider"></div>
      <div class="settings-group">
        <span class="settings-label">Betting</span>
        <div class="settings-opts" id="settingsBetting">
          <button class="settings-opt active" data-val="off">Off</button>
          <button class="settings-opt" data-val="on">On</button>
        </div>
      </div>
    </div>
  </header>
  <div class="felt-table">
    <div class="dealer-zone">
      <div class="zone-label">Dealer <span class="score-badge" id="dealerScore"></span></div>
      <div class="card-row" id="dealerCards"></div>
    </div>
    <div class="players-row" id="playersRow"></div>
    <div class="action-bar" id="actionBar"></div>
  </div>
  <div class="result-banner hidden" id="resultBanner">
    <div class="result-inner">
      <div class="result-hands" id="resultHands"></div>
      <div class="result-text" id="resultText"></div>
      <div class="result-actions">
        <button class="deal-btn" id="btnNewRound">Deal Again</button>
        <a class="exit-btn" href="index.html">Exit</a>
      </div>
    </div>
  </div>
</div>`
  },

  solitaire: {
    title: "Solitaire",
    css: "Style/solitaire.css",
    scripts: ["JS/solitaire.js"],
    render: () => `
<div class="sol-modal" id="setupModal">
  <div class="sol-modal-inner">
    <div class="sol-eyebrow">Klondike Solitaire</div>
    <h2 class="sol-modal-title">Deal the Cards</h2>
    <div class="sol-option-group">
      <div class="sol-option-label">Draw Style</div>
      <div class="sol-option-btns" id="drawOpts">
        <button class="sol-opt active" data-val="1">Draw 1</button>
        <button class="sol-opt" data-val="3">Draw 3</button>
      </div>
    </div>
    <button class="sol-primary-btn" id="btnDeal">Deal →</button>
    <a class="sol-back-link" href="index.html">← Back to Games</a>
  </div>
</div>
<div class="sol-wrap hidden" id="gameWrap">
  <header class="sol-header">
    <a class="sol-back" href="index.html">
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
      Games
    </a>
    <div class="sol-title-block">
      <span class="sol-eyebrow-sm">Patience</span>
      <h1 class="sol-title">Solitaire</h1>
    </div>
    <div class="sol-header-controls">
      <div class="sol-stat"><span class="sol-stat-label">Time</span><span class="sol-stat-val" id="timerDisplay">0:00</span></div>
      <div class="sol-stat"><span class="sol-stat-label">Moves</span><span class="sol-stat-val" id="movesDisplay">0</span></div>
      <button class="sol-icon-btn" id="btnUndo" title="Undo">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M3 13C5.2 7.4 11 4 17 5.7A9 9 0 0 1 21 13"/></svg>
      </button>
      <button class="sol-icon-btn" id="btnAutoComplete" title="Auto-complete" style="display:none">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>
      </button>
      <button class="sol-icon-btn" id="btnNew" title="New Game">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
      </button>
    </div>
  </header>
  <main class="sol-table" id="solTable">
    <div class="sol-top-row">
      <div class="sol-zone stock-zone" id="stock"></div>
      <div class="sol-zone waste-zone" id="waste"></div>
      <div class="sol-spacer"></div>
      <div class="sol-zone foundation-zone" id="f0" data-suit="♠"></div>
      <div class="sol-zone foundation-zone" id="f1" data-suit="♥"></div>
      <div class="sol-zone foundation-zone" id="f2" data-suit="♦"></div>
      <div class="sol-zone foundation-zone" id="f3" data-suit="♣"></div>
    </div>
    <div class="sol-tableau" id="tableau">
      <div class="sol-col" id="t0"></div>
      <div class="sol-col" id="t1"></div>
      <div class="sol-col" id="t2"></div>
      <div class="sol-col" id="t3"></div>
      <div class="sol-col" id="t4"></div>
      <div class="sol-col" id="t5"></div>
      <div class="sol-col" id="t6"></div>
    </div>
  </main>
  <div class="sol-win-overlay hidden" id="winOverlay">
    <div class="sol-win-inner">
      <div class="sol-win-emoji">🃏</div>
      <h2 class="sol-win-title">You Won!</h2>
      <div class="sol-win-stats" id="winStats"></div>
      <button class="sol-primary-btn" id="btnWinNew">Play Again</button>
      <a class="sol-back-link" href="index.html">← Back to Games</a>
    </div>
    <canvas id="confettiCanvas"></canvas>
  </div>
</div>
<div class="drag-ghost hidden" id="dragGhost"></div>`
  },

  tetris: {
    title: "Tetris",
    css: "Style/tetris.css",
    scripts: ["JS/tetris.js"],
    render: () => `
<div class="tetris-wrap">
  <header class="t-header">
    <a class="t-back" href="index.html">
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
      Games
    </a>
    <div class="t-title-block">
      <span class="t-eyebrow">Stack &amp; Clear</span>
      <h1 class="t-title">Tetris</h1>
    </div>
    <div class="t-header-spacer"></div>
  </header>
  <div class="t-layout">
    <aside class="t-panel t-panel-left">
      <div class="stat-block"><div class="stat-label">Score</div><div class="stat-value" id="score">0</div></div>
      <div class="stat-block"><div class="stat-label">Best</div><div class="stat-value" id="highScore">0</div></div>
      <div class="stat-block"><div class="stat-label">Level</div><div class="stat-value" id="level">1</div></div>
      <div class="stat-block"><div class="stat-label">Lines</div><div class="stat-value" id="lines">0</div></div>
    </aside>
    <div class="t-board-wrap">
      <canvas id="board" width="300" height="600"></canvas>
      <div class="t-overlay" id="overlayStart">
        <div class="overlay-inner">
          <div class="overlay-title">Tetris</div>
          <div class="overlay-sub">Stack the blocks. Clear the lines.</div>
          <button class="t-btn" id="btnStart">Start Game</button>
          <div class="overlay-keys">
            <span>← → Move</span><span>↑ Rotate</span>
            <span>↓ Soft drop</span><span>Space Hard drop</span>
          </div>
        </div>
      </div>
      <div class="t-overlay hidden" id="overlayPause">
        <div class="overlay-inner">
          <div class="overlay-title">Paused</div>
          <button class="t-btn" id="btnResume">Resume</button>
        </div>
      </div>
      <div class="t-overlay hidden" id="overlayGameOver">
        <div class="overlay-inner">
          <div class="overlay-title">Game Over</div>
          <div class="overlay-score" id="finalScore"></div>
          <button class="t-btn" id="btnRestart">Play Again</button>
          <a class="t-exit" href="index.html">← Back to Games</a>
        </div>
      </div>
    </div>
    <aside class="t-panel t-panel-right">
      <div class="next-block">
        <div class="stat-label">Next</div>
        <canvas id="nextCanvas" width="120" height="120"></canvas>
      </div>
      <div class="ctrl-block">
        <button class="t-ctrl-btn" id="btnPause">Pause</button>
        <button class="t-ctrl-btn" id="btnNew">New Game</button>
      </div>
    </aside>
  </div>
</div>`
  },

  pacman: {
    title: "Pac-Man",
    css: "Style/pacman.css",
    scripts: ["JS/pacman.js"],
    render: () => `
<div class="pac-wrap">
  <header class="t-header">
    <a class="t-back" href="index.html">
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
      Games
    </a>
    <div class="t-title-block">
      <span class="t-eyebrow">Eat &amp; Evade</span>
      <h1 class="t-title">Pac-Man</h1>
    </div>
    <div class="t-header-spacer"></div>
  </header>
  <div class="t-layout">
    <aside class="t-panel t-panel-left">
      <div class="stat-block"><div class="stat-label">Score</div><div class="stat-value" id="score">0</div></div>
      <div class="stat-block"><div class="stat-label">Best</div><div class="stat-value" id="highScore">0</div></div>
      <div class="stat-block"><div class="stat-label">Level</div><div class="stat-value" id="level">1</div></div>
      <div class="stat-block"><div class="stat-label">Lives</div><div class="stat-value" id="lives">3</div></div>
    </aside>
    <div class="t-board-wrap">
      <canvas id="board"></canvas>
      <div class="t-overlay" id="overlayStart">
        <div class="overlay-inner">
          <div class="overlay-title">Pac-Man</div>
          <div class="overlay-sub">Eat all the dots. Avoid the ghosts. Power pellets turn the tables.</div>
          <button class="t-btn" id="btnStart">Start Game</button>
          <div class="overlay-keys"><span>← → ↑ ↓ &nbsp; Move</span><span>P &nbsp; Pause</span></div>
        </div>
      </div>
      <div class="t-overlay hidden" id="overlayPause">
        <div class="overlay-inner">
          <div class="overlay-title">Paused</div>
          <button class="t-btn" id="btnResume">Resume</button>
        </div>
      </div>
      <div class="t-overlay hidden" id="overlayGameOver">
        <div class="overlay-inner">
          <div class="overlay-title">Game Over</div>
          <div class="overlay-score" id="finalScore"></div>
          <button class="t-btn" id="btnRestart">Play Again</button>
          <a class="t-exit" href="index.html">← Back to Games</a>
        </div>
      </div>
      <div class="t-overlay hidden" id="overlayLevel">
        <div class="overlay-inner">
          <div class="overlay-title" id="levelTitle">Level 2</div>
          <div class="overlay-sub">Ghosts are getting faster…</div>
          <button class="t-btn" id="btnNextLevel">Continue</button>
        </div>
      </div>
    </div>
    <aside class="t-panel t-panel-right">
      <div class="ghost-legend">
        <div class="stat-label" style="margin-bottom:0.6rem;">Ghosts</div>
        <div class="ghost-item"><span class="ghost-dot" style="background:#FF0000;"></span>Blinky</div>
        <div class="ghost-item"><span class="ghost-dot" style="background:#FFB8FF;"></span>Pinky</div>
        <div class="ghost-item"><span class="ghost-dot" style="background:#00FFFF;"></span>Inky</div>
        <div class="ghost-item"><span class="ghost-dot" style="background:#FFB852;"></span>Clyde</div>
      </div>
      <div class="ctrl-block">
        <button class="t-ctrl-btn" id="btnPause">Pause</button>
        <button class="t-ctrl-btn" id="btnNew">New Game</button>
      </div>
      <div class="dpad">
        <button class="dpad-btn dpad-up"    id="dUp">▲</button>
        <button class="dpad-btn dpad-left"  id="dLeft">◀</button>
        <button class="dpad-btn dpad-right" id="dRight">▶</button>
        <button class="dpad-btn dpad-down"  id="dDown">▼</button>
      </div>
    </aside>
  </div>
</div>`
  },

  pinball: {
    title: "Pinball",
    css: "Style/pinball.css",
    scripts: ["JS/pinball.js"],
    render: () => `
<div class="pb-wrap">
  <header class="t-header">
    <a class="t-back" href="index.html">
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
      Games
    </a>
    <div class="t-title-block">
      <span class="t-eyebrow">Flip &amp; Score</span>
      <h1 class="t-title">Pinball</h1>
    </div>
    <div class="t-header-spacer"></div>
  </header>
  <div class="t-layout">
    <aside class="t-panel t-panel-left">
      <div class="stat-block"><div class="stat-label">Score</div><div class="stat-value" id="score">0</div></div>
      <div class="stat-block"><div class="stat-label">Best</div><div class="stat-value" id="highScore">0</div></div>
      <div class="stat-block"><div class="stat-label">Ball</div><div class="stat-value" id="ballNum">1</div></div>
      <div class="stat-block"><div class="stat-label">Balls</div><div class="stat-value" id="balls">3</div></div>
      <div class="stat-block"><div class="stat-label">Multi</div><div class="stat-value" id="multiplier">×1</div></div>
    </aside>
    <div class="t-board-wrap">
      <canvas id="board"></canvas>
      <div class="t-overlay" id="overlayStart">
        <div class="overlay-inner">
          <div class="overlay-title">Pinball</div>
          <div class="overlay-sub">Classic arcade pinball. Hit bumpers, targets and ramps to rack up points.</div>
          <button class="t-btn" id="btnStart">Insert Coin</button>
          <div class="overlay-keys">
            <span>Z / ← &nbsp; Left Flipper</span><span>X / → &nbsp; Right Flipper</span>
            <span>Space &nbsp; Launch Ball</span><span>Shift &nbsp; Tilt</span>
          </div>
        </div>
      </div>
      <div class="t-overlay hidden" id="overlayPause">
        <div class="overlay-inner"><div class="overlay-title">Paused</div><button class="t-btn" id="btnResume">Resume</button></div>
      </div>
      <div class="t-overlay hidden" id="overlayTilt">
        <div class="overlay-inner"><div class="overlay-title" style="color:#ff4444;">TILT!</div><div class="overlay-sub">Easy there. Ball lost.</div></div>
      </div>
      <div class="t-overlay hidden" id="overlayBonus">
        <div class="overlay-inner">
          <div class="overlay-title" id="bonusTitle">Bonus!</div>
          <div class="overlay-score" id="bonusScore"></div>
          <button class="t-btn" id="btnNextBall">Next Ball</button>
        </div>
      </div>
      <div class="t-overlay hidden" id="overlayGameOver">
        <div class="overlay-inner">
          <div class="overlay-title">Game Over</div>
          <div class="overlay-score" id="finalScore"></div>
          <button class="t-btn" id="btnRestart">Play Again</button>
          <a class="t-exit" href="index.html">← Back to Games</a>
        </div>
      </div>
      <div class="t-overlay hidden" id="overlayMultiball">
        <div class="overlay-inner"><div class="overlay-title" style="color:#ffcc00;">MULTIBALL!</div><div class="overlay-sub">3 balls in play. Good luck.</div></div>
      </div>
    </div>
    <aside class="t-panel t-panel-right">
      <div class="mode-block" id="modeBlock">
        <div class="stat-label" style="margin-bottom:0.4rem;">Mode</div>
        <div class="mode-name" id="modeName">Normal</div>
      </div>
      <div class="target-block">
        <div class="stat-label" style="margin-bottom:0.4rem;">Targets</div>
        <div class="target-lights" id="targetLights">
          <span class="tl" id="tl0"></span><span class="tl" id="tl1"></span>
          <span class="tl" id="tl2"></span><span class="tl" id="tl3"></span>
          <span class="tl" id="tl4"></span>
        </div>
      </div>
      <div class="ctrl-block">
        <button class="t-ctrl-btn" id="btnPause">Pause</button>
        <button class="t-ctrl-btn" id="btnNew">New Game</button>
      </div>
      <div class="key-hint">
        <div class="kh-row"><kbd>Z</kbd> Left flipper</div>
        <div class="kh-row"><kbd>X</kbd> Right flipper</div>
        <div class="kh-row"><kbd>Space</kbd> Launch</div>
      </div>
    </aside>
  </div>
</div>`
  }
};

// ── Dynamic CSS loader — resolves when stylesheet is parsed ──
let _activeStylesheet = null;

function loadCSS(href) {
  return new Promise((resolve) => {
    if (_activeStylesheet) _activeStylesheet.remove();
    const link = document.createElement('link');
    link.rel  = 'stylesheet';
    link.href = href;
    link.id   = 'game-stylesheet';
    link.onload  = resolve;
    link.onerror = resolve; // don't block forever on failure
    document.head.appendChild(link);
    _activeStylesheet = link;
  });
}

// ── Dynamic script loader — resolves when script has executed ─
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-game-script="${src}"]`);
    if (existing) existing.remove();
    const s = document.createElement('script');
    s.src = src;
    s.setAttribute('data-game-script', src);
    s.onload  = resolve;
    s.onerror = reject;
    document.body.appendChild(s);
  });
}

// ── Layout shim ─────────────────────────────────────────────
// The game CSS files target `body` (or a top-level wrapper div)
// as the grid/flex container, and were originally written to
// fill the entire viewport (100vw / 100vh) as standalone pages.
// In the SPA, game content lives inside #app, next to the
// persistent sidebar — so instead of sizing to the *viewport*,
// we size everything to the *main-content column* (which is
// already viewport-width minus the sidebar, thanks to flexbox).
// This keeps the sidebar visible and in place for every game.
const LAYOUT_SHIMS = {
  tictactoe:   'grid-template-columns: 1fr 600px 1fr',
  connectfour: 'grid-template-columns: 1fr 600px 1fr',
  minesweeper: 'grid-template-columns: 1fr auto 1fr',
  chess:       'grid-template-columns: 240px 1fr 240px',
  checkers:    'grid-template-columns: 220px 1fr 220px',
  sudoku:      'grid-template-columns: 1fr 600px 1fr',
};

// Breakpoint at which the 3-column layouts above collapse to a
// single stacked column. Bumped up from the original 900px by
// roughly the sidebar's width, since the game area now has that
// much less room to work with than the full viewport did.
const STACK_BREAKPOINT = 1160;

let _sheetEl = null;
function injectLayoutShim(game) {
  if (_sheetEl) _sheetEl.remove();
  const cols = LAYOUT_SHIMS[game.key];
  const css = cols
    ? `
      #page-game {
        width: 100%;
        min-height: 100vh;
      }
      #app {
        width: 100%;
      }
      .game-layout {
        display: grid;
        ${cols};
        width: 100%;
        min-height: 100vh;
      }
      @media (max-width: ${STACK_BREAKPOINT}px) {
        .game-layout { grid-template-columns: 1fr; grid-template-rows: auto 1fr auto; }
      }
    `
    : `
      #page-game, #app {
        display: block;
        width: 100%;
        min-height: 100vh;
      }
    `;
  _sheetEl = document.createElement('style');
  _sheetEl.setAttribute('data-layout-shim', '');
  _sheetEl.textContent = css;
  document.head.appendChild(_sheetEl);
}

// ── Main router ──────────────────────────────────────────────
async function route() {
  const params  = new URLSearchParams(window.location.search);
  const gameKey = params.get('game');
  const appEl   = document.getElementById('app');

  if (!gameKey || !GAMES[gameKey]) return;

  const game = GAMES[gameKey];
  game.key = gameKey;
  document.title = game.title + ' — Mark\'s Games';

  // 1. Load CSS first so the page is styled before any HTML appears.
  //    This eliminates the white flash on solitaire / blackjack.
  await loadCSS(game.css);

  // 2. Inject a layout shim so games that use `body { display:grid }` 
  //    work correctly inside #app instead of body, and stay confined
  //    to the main-content column instead of the full viewport.
  injectLayoutShim(game);

  // 3. Inject HTML now that styles are available.
  // Wrap in a single .game-layout div so grid shim has one container to target.
  const needsWrapper = !!LAYOUT_SHIMS[game.key];
  appEl.innerHTML = needsWrapper
    ? `<div class="game-layout">${game.render()}</div>`
    : game.render();

  // 4. Load game scripts sequentially.
  for (const src of game.scripts) {
    await loadScript(src);
  }

  // 5. Re-fire DOMContentLoaded so games that listen for it (e.g. chess)
  //    will run their init code against the now-present DOM.
  document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }));
}

// Run on load
route();

// Handle browser back/forward
window.addEventListener('popstate', () => {
  window.location.reload();
});