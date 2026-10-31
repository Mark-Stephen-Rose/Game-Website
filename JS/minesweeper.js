const boardEl = document.getElementById("board");
const statusEl = document.getElementById("status");
const mineCounterEl = document.getElementById("mine-counter");
const timerEl = document.getElementById("timer");
const bestTimeEl = document.getElementById("best-time");
const clickCounterEl = document.getElementById("click-counter");

// Difficulty settings
const DIFFICULTIES = {
    easy: { rows: 8, cols: 8, mines: 10 },
    medium: { rows: 16, cols: 16, mines: 40 },
    hard: { rows: 16, cols: 30, mines: 99 }
};

let currentDifficulty = 'easy';
let rows, cols, totalMines;
let board = [];
let revealed = [];
let flagged = [];
let gameStarted = false;
let gameOver = false;
let firstClick = true;
let timer = 0;
let timerInterval = null;
let minesRemaining = 0;
let clickCount = 0;
let autocompleteEnabled = false;

// Load best times from localStorage
let bestTimes = JSON.parse(localStorage.getItem('minesweeperBestTimes')) || {
    easy: null,
    medium: null,
    hard: null
};

function initGame() {
    const settings = DIFFICULTIES[currentDifficulty];
    rows = settings.rows;
    cols = settings.cols;
    totalMines = settings.mines;
    
    board = Array(rows).fill(null).map(() => Array(cols).fill(0));
    revealed = Array(rows).fill(null).map(() => Array(cols).fill(false));
    flagged = Array(rows).fill(null).map(() => Array(cols).fill(false));
    
    gameStarted = false;
    gameOver = false;
    firstClick = true;
    timer = 0;
    minesRemaining = totalMines;
    clickCount = 0;
    
    updateMineCounter();
    updateTimer();
    updateBestTime();
    updateClickCounter();
    clearInterval(timerInterval);
    
    statusEl.textContent = "Click any cell to start";
    
    createBoard();
}

function createBoard() {
    boardEl.innerHTML = "";
    boardEl.className = `board ${currentDifficulty}`;
    
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const cell = document.createElement("div");
            cell.className = "cell";
            cell.dataset.row = row;
            cell.dataset.col = col;
            
            cell.addEventListener('click', (e) => handleLeftClick(row, col));
            cell.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                handleRightClick(row, col);
            });
            
            boardEl.appendChild(cell);
        }
    }
}

function placeMines(avoidRow, avoidCol) {
    let minesPlaced = 0;
    
    while (minesPlaced < totalMines) {
        const row = Math.floor(Math.random() * rows);
        const col = Math.floor(Math.random() * cols);
        
        // Don't place mine on first click or adjacent cells
        if (board[row][col] === -1) continue;
        if (Math.abs(row - avoidRow) <= 1 && Math.abs(col - avoidCol) <= 1) continue;
        
        board[row][col] = -1; // -1 represents a mine
        minesPlaced++;
    }
    
    // Calculate numbers
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            if (board[row][col] !== -1) {
                board[row][col] = countAdjacentMines(row, col);
            }
        }
    }
}

function countAdjacentMines(row, col) {
    let count = 0;
    for (let r = row - 1; r <= row + 1; r++) {
        for (let c = col - 1; c <= col + 1; c++) {
            if (r >= 0 && r < rows && c >= 0 && c < cols) {
                if (board[r][c] === -1) count++;
            }
        }
    }
    return count;
}

function handleLeftClick(row, col) {
    if (gameOver || flagged[row][col]) return;
    
    // Count the click
    clickCount++;
    updateClickCounter();
    
    // First click - place mines avoiding this cell
    if (firstClick) {
        placeMines(row, col);
        firstClick = false;
        gameStarted = true;
        startTimer();
        statusEl.textContent = "Game in progress...";
    }
    
    if (revealed[row][col]) return;
    
    revealCell(row, col);
    
    // Trigger auto-solve if enabled (after revealing the clicked cell)
    if (autocompleteEnabled && gameStarted && !gameOver) {
        setTimeout(() => autoSolve(), 100);
    }
}

function handleRightClick(row, col) {
    if (gameOver || revealed[row][col]) return;
    if (!gameStarted) return; // Can't flag before game starts
    
    flagged[row][col] = !flagged[row][col];
    minesRemaining += flagged[row][col] ? -1 : 1;
    updateMineCounter();
    
    const cellEl = getCellElement(row, col);
    if (flagged[row][col]) {
        cellEl.classList.add('flagged');
        cellEl.textContent = '🚩';
    } else {
        cellEl.classList.remove('flagged');
        cellEl.textContent = '';
    }
}

function revealCell(row, col) {
    if (revealed[row][col] || flagged[row][col]) return;
    
    revealed[row][col] = true;
    const cellEl = getCellElement(row, col);
    cellEl.classList.add('revealed', 'animated');
    
    if (board[row][col] === -1) {
        // Hit a mine - game over
        cellEl.classList.add('mine', 'exploded');
        cellEl.textContent = '💣';
        endGame(false);
        return;
    }
    
    if (board[row][col] > 0) {
        cellEl.textContent = board[row][col];
        cellEl.classList.add(`n${board[row][col]}`);
    } else {
        // Empty cell - reveal adjacent cells
        for (let r = row - 1; r <= row + 1; r++) {
            for (let c = col - 1; c <= col + 1; c++) {
                if (r >= 0 && r < rows && c >= 0 && c < cols) {
                    if (!revealed[r][c]) {
                        revealCell(r, c);
                    }
                }
            }
        }
    }
    
    // Check for win
    checkWin();
}

function checkWin() {
    let revealedCount = 0;
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            if (revealed[row][col]) revealedCount++;
        }
    }
    
    // Win if all non-mine cells are revealed
    if (revealedCount === rows * cols - totalMines) {
        endGame(true);
    }
}

function endGame(won) {
    gameOver = true;
    clearInterval(timerInterval);
    
    if (won) {
        statusEl.textContent = "You Win! 🎉";
        
        // Check and update best time (only if autocomplete wasn't used)
        if (!autocompleteEnabled) {
            if (bestTimes[currentDifficulty] === null || timer < bestTimes[currentDifficulty]) {
                bestTimes[currentDifficulty] = timer;
                localStorage.setItem('minesweeperBestTimes', JSON.stringify(bestTimes));
                updateBestTime();
                statusEl.textContent = "You Win! 🎉 New Best Time!";
            }
        } else {
            statusEl.textContent = "You Win! 🎉 (Auto-Solve)";
        }
        
        // Flag all remaining mines
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                if (board[row][col] === -1 && !flagged[row][col]) {
                    const cellEl = getCellElement(row, col);
                    cellEl.classList.add('flagged');
                    cellEl.textContent = '🚩';
                }
            }
        }
    } else {
        statusEl.textContent = "Game Over! 💥";
        
        // Reveal all mines
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                if (board[row][col] === -1) {
                    const cellEl = getCellElement(row, col);
                    cellEl.classList.add('mine');
                    if (!revealed[row][col]) {
                        cellEl.textContent = '💣';
                    }
                }
            }
        }
    }
}

function getCellElement(row, col) {
    const index = row * cols + col;
    return boardEl.children[index];
}

function startTimer() {
    timerInterval = setInterval(() => {
        timer++;
        updateTimer();
    }, 1000);
}

function updateTimer() {
    timerEl.textContent = String(timer).padStart(3, '0');
}

function updateMineCounter() {
    mineCounterEl.textContent = minesRemaining;
}

function updateClickCounter() {
    clickCounterEl.textContent = clickCount;
}

function updateBestTime() {
    const best = bestTimes[currentDifficulty];
    if (best !== null) {
        bestTimeEl.textContent = String(best).padStart(3, '0');
    } else {
        bestTimeEl.textContent = '---';
    }
}

function changeDifficulty() {
    const select = document.getElementById("difficulty");
    currentDifficulty = select.value;
    resetGame();
}

function resetGame() {
    clearInterval(timerInterval);
    autocompleteEnabled = false;
    document.getElementById("autocomplete").checked = false;
    initGame();
}

function exitGame() {
    window.location.href = "index.html";
}

function toggleAutocomplete() {
    const checkbox = document.getElementById("autocomplete");
    autocompleteEnabled = checkbox.checked;
    
    if (autocompleteEnabled && gameStarted && !gameOver) {
        autoSolve();
    }
}

function autoSolve() {
    if (gameOver) return;
    
    // Auto-solve algorithm: reveal all safe cells
    let foundSafeCell = true;
    
    const solveInterval = setInterval(() => {
        if (gameOver || !autocompleteEnabled) {
            clearInterval(solveInterval);
            return;
        }
        
        foundSafeCell = false;
        
        // Find and reveal safe cells
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                if (!revealed[row][col] && !flagged[row][col] && board[row][col] !== -1) {
                    revealCell(row, col);
                    foundSafeCell = true;
                    return; // Reveal one cell per interval for animation
                }
            }
        }
        
        // If no more safe cells, auto-flag all remaining mines
        if (!foundSafeCell) {
            for (let row = 0; row < rows; row++) {
                for (let col = 0; col < cols; col++) {
                    if (board[row][col] === -1 && !flagged[row][col]) {
                        handleRightClick(row, col);
                    }
                }
            }
            clearInterval(solveInterval);
        }
    }, 50); // 50ms delay between reveals for smooth animation
}

// Initialize game on load
initGame();
