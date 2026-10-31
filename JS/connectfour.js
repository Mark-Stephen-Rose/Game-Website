const boardEl = document.getElementById("board");
const statusEl = document.getElementById("status");
const overlay = document.getElementById("overlay");
const winnerText = document.getElementById("winner-text");
const winnerSymbol = document.getElementById("winner-symbol");
const drawSymbols = document.getElementById("draw-symbols");

const scorePurple = document.getElementById("score-purple");
const scoreGreen = document.getElementById("score-green");

const playerPurpleLabel = document.getElementById("player-purple");
const playerGreenLabel = document.getElementById("player-green");

const ROWS = 6;
const COLS = 7;

let board = Array(ROWS).fill(null).map(() => Array(COLS).fill(null));
let currentPlayer = "purple";
let gameOver = false;

let scores = { purple: 0, green: 0 };

// Game mode variables
let gameMode = "multiplayer"; // multiplayer, easy, medium, hard
let isAIThinking = false;

function createBoard() {
    boardEl.innerHTML = "";
    
    // Create cells (top to bottom, left to right)
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            const cell = document.createElement("div");
            cell.className = "cell";
            cell.dataset.col = col;
            cell.onclick = () => makeMove(col);
            boardEl.appendChild(cell);
        }
    }
}

function changeGameMode() {
    const select = document.getElementById("game-mode");
    gameMode = select.value;
    
    // Hide overlay if visible
    overlay.classList.add("hidden");
    const modal = overlay.querySelector(".modal");
    modal.classList.remove("popup");
    boardEl.classList.remove("falling");
    
    // Player labels stay the same for all modes
    playerPurpleLabel.querySelector(".player-name").textContent = "Player 1";
    playerGreenLabel.querySelector(".player-name").textContent = "Player 2";
    
    // Reset game and scores
    resetGame();
}

function makeMove(col) {
    if (gameOver || isAIThinking) return;
    
    // In single player mode, only allow player (purple) to click
    if (gameMode !== "multiplayer" && currentPlayer === "green") return;
    
    // Find the lowest empty row in this column
    let row = -1;
    for (let r = ROWS - 1; r >= 0; r--) {
        if (board[r][col] === null) {
            row = r;
            break;
        }
    }
    
    // Column is full
    if (row === -1) return;
    
    // Place the piece
    board[row][col] = currentPlayer;
    const cellIndex = row * COLS + col;
    const cellEl = boardEl.children[cellIndex];
    const token = document.createElement("div");
    token.className = `token ${currentPlayer} dropping`;
    cellEl.appendChild(token);
    
    // Wait for animation to complete before checking win
    setTimeout(() => {
        token.classList.remove("dropping");
        
        // Check for win
        const win = checkWinner(row, col);
        if (win) {
            highlightWinner(win);
            scores[currentPlayer]++;
            updateScore(currentPlayer);
            endGame("winner", currentPlayer);
            return;
        }
        
        // Check for draw
        if (board[0].every(cell => cell !== null)) {
            endGame("draw");
            return;
        }
        
        // Switch players
        currentPlayer = currentPlayer === "purple" ? "green" : "purple";
        const playerName = currentPlayer === "purple" ? "Player 1" : "Player 2";
        statusEl.textContent = `${playerName}'s Turn`;
        updateActivePlayer();
        
        // If single player mode and now AI's turn
        if (gameMode !== "multiplayer" && currentPlayer === "green") {
            statusEl.textContent = "Player 2 thinking...";
            isAIThinking = true;
            setTimeout(() => {
                makeAIMove();
            }, 500);
        }
    }, 500); // Match animation duration
}

function updateActivePlayer() {
    if (currentPlayer === "purple") {
        playerPurpleLabel.classList.add("active");
        playerGreenLabel.classList.remove("active");
    } else {
        playerGreenLabel.classList.add("active");
        playerPurpleLabel.classList.remove("active");
    }
}

function checkWinner(row, col) {
    const player = board[row][col];
    
    // Check horizontal
    let positions = [];
    for (let c = 0; c < COLS; c++) {
        if (board[row][c] === player) {
            positions.push([row, c]);
            if (positions.length === 4) {
                return positions;
            }
        } else {
            positions = [];
        }
    }
    
    // Check vertical
    positions = [];
    for (let r = 0; r < ROWS; r++) {
        if (board[r][col] === player) {
            positions.push([r, col]);
            if (positions.length === 4) {
                return positions;
            }
        } else {
            positions = [];
        }
    }
    
    // Check diagonal (bottom-left to top-right)
    positions = [];
    let startRow = row - Math.min(row, col);
    let startCol = col - Math.min(row, col);
    while (startRow < ROWS && startCol < COLS) {
        if (board[startRow][startCol] === player) {
            positions.push([startRow, startCol]);
            if (positions.length === 4) {
                return positions;
            }
        } else {
            positions = [];
        }
        startRow++;
        startCol++;
    }
    
    // Check diagonal (top-left to bottom-right)
    positions = [];
    startRow = row + Math.min(ROWS - 1 - row, col);
    startCol = col - Math.min(ROWS - 1 - row, col);
    while (startRow >= 0 && startCol < COLS) {
        if (board[startRow][startCol] === player) {
            positions.push([startRow, startCol]);
            if (positions.length === 4) {
                return positions;
            }
        } else {
            positions = [];
        }
        startRow--;
        startCol++;
    }
    
    return null;
}

function highlightWinner(positions) {
    positions.forEach(([row, col]) => {
        const cellIndex = row * COLS + col;
        boardEl.children[cellIndex].classList.add("winner");
    });
}

function endGame(type, winner) {
    gameOver = true;
    statusEl.textContent = "Game Over";
    document.querySelectorAll(".cell").forEach(c => c.classList.add("disabled"));
    
    // Trigger board falling animation
    boardEl.classList.add("falling");
    
    // Setup modal content
    if (type === "winner") {
        winnerText.textContent = "WINNER";
        winnerSymbol.className = `winner-symbol ${winner}`;
        winnerSymbol.style.display = "block";
        drawSymbols.style.display = "none";
    } else {
        winnerText.textContent = "DRAW";
        winnerSymbol.style.display = "none";
        drawSymbols.style.display = "flex";
    }
    
    // Show overlay and trigger popup animation after delay
    setTimeout(() => {
        overlay.classList.remove("hidden");
        const modal = overlay.querySelector(".modal");
        modal.classList.add("popup");
    }, 300);
}

function playAgain() {
    overlay.classList.add("hidden");
    const modal = overlay.querySelector(".modal");
    modal.classList.remove("popup");
    boardEl.classList.remove("falling");
    board = Array(ROWS).fill(null).map(() => Array(COLS).fill(null));
    gameOver = false;
    isAIThinking = false;
    currentPlayer = "purple";
    statusEl.textContent = "Player 1's Turn";
    createBoard();
    updateActivePlayer();
}

function resetGame() {
    const modal = overlay.querySelector(".modal");
    modal.classList.remove("popup");
    boardEl.classList.remove("falling");
    board = Array(ROWS).fill(null).map(() => Array(COLS).fill(null));
    gameOver = false;
    isAIThinking = false;
    currentPlayer = "purple";
    statusEl.textContent = "Player 1's Turn";
    scores = { purple: 0, green: 0 };
    updateScore();
    createBoard();
    updateActivePlayer();
}

function updateScore(playerWon = null) {
    const prevScorePurple = parseInt(scorePurple.textContent === '-' ? 0 : scorePurple.textContent);
    const prevScoreGreen = parseInt(scoreGreen.textContent === '-' ? 0 : scoreGreen.textContent);
    
    scorePurple.textContent = scores.purple === 0 ? '-' : scores.purple;
    scoreGreen.textContent = scores.green === 0 ? '-' : scores.green;
    
    // Add animation if score increased
    if (playerWon === 'purple' && scores.purple > prevScorePurple) {
        scorePurple.classList.remove('increment');
        void scorePurple.offsetWidth;
        scorePurple.classList.add('increment');
        setTimeout(() => scorePurple.classList.remove('increment'), 600);
    } else if (playerWon === 'green' && scores.green > prevScoreGreen) {
        scoreGreen.classList.remove('increment');
        void scoreGreen.offsetWidth;
        scoreGreen.classList.add('increment');
        setTimeout(() => scoreGreen.classList.remove('increment'), 600);
    }
}

function exitGame() {
    window.location.href = "index.html";
}

// AI Functions
function makeAIMove() {
    let col;
    
    if (gameMode === "easy") {
        col = getRandomMove();
    } else if (gameMode === "medium") {
        col = getMediumMove();
    } else if (gameMode === "hard") {
        col = getBestMove();
    }
    
    if (col !== -1 && !gameOver) {
        // Find the lowest empty row in this column
        let row = -1;
        for (let r = ROWS - 1; r >= 0; r--) {
            if (board[r][col] === null) {
                row = r;
                break;
            }
        }
        
        if (row !== -1) {
            // Place AI move
            board[row][col] = "green";
            const cellIndex = row * COLS + col;
            const cellEl = boardEl.children[cellIndex];
            const token = document.createElement("div");
            token.className = "token green dropping";
            cellEl.appendChild(token);
            
            // Wait for animation to complete before checking win
            setTimeout(() => {
                token.classList.remove("dropping");
                
                // Check for win
                const win = checkWinner(row, col);
                if (win) {
                    highlightWinner(win);
                    scores["green"]++;
                    updateScore("green");
                    endGame("winner", "green");
                    isAIThinking = false;
                    return;
                }
                
                // Check for draw
                if (board[0].every(cell => cell !== null)) {
                    endGame("draw");
                    isAIThinking = false;
                    return;
                }
                
                // Switch back to player
                currentPlayer = "purple";
                statusEl.textContent = "Player 1's Turn";
                updateActivePlayer();
                isAIThinking = false;
            }, 500); // Match animation duration
        }
    }
}

// Easy AI - Random move
function getRandomMove() {
    const availableCols = [];
    for (let col = 0; col < COLS; col++) {
        if (board[0][col] === null) {
            availableCols.push(col);
        }
    }
    if (availableCols.length === 0) return -1;
    return availableCols[Math.floor(Math.random() * availableCols.length)];
}

// Medium AI - Try to win, block player, otherwise random
function getMediumMove() {
    // Try to win
    const winMove = findWinningMove("green");
    if (winMove !== -1) return winMove;
    
    // Try to block player
    const blockMove = findWinningMove("purple");
    if (blockMove !== -1) return blockMove;
    
    // Otherwise random
    return getRandomMove();
}

// Hard AI - Minimax with alpha-beta pruning and position evaluation
function getBestMove() {
    let bestScore = -Infinity;
    let bestCol = -1;
    
    // Increase search depth for harder difficulty
    for (let col = 0; col < COLS; col++) {
        const row = getLowestEmptyRow(col);
        if (row !== -1) {
            board[row][col] = "green";
            const score = minimax(6, -Infinity, Infinity, false); // Increased from 4 to 6
            board[row][col] = null;
            
            if (score > bestScore) {
                bestScore = score;
                bestCol = col;
            }
        }
    }
    
    return bestCol;
}

function minimax(depth, alpha, beta, isMaximizing) {
    // Check terminal states
    const winner = checkAllWins();
    if (winner === "green") return 1000 - (6 - depth); // Prefer faster wins
    if (winner === "purple") return -1000 + (6 - depth); // Delay losses
    if (board[0].every(cell => cell !== null) || depth === 0) {
        return evaluatePosition();
    }
    
    if (isMaximizing) {
        let maxScore = -Infinity;
        // Prioritize center columns
        const colOrder = [3, 2, 4, 1, 5, 0, 6];
        for (let col of colOrder) {
            const row = getLowestEmptyRow(col);
            if (row !== -1) {
                board[row][col] = "green";
                const score = minimax(depth - 1, alpha, beta, false);
                board[row][col] = null;
                maxScore = Math.max(score, maxScore);
                alpha = Math.max(alpha, score);
                if (beta <= alpha) break;
            }
        }
        return maxScore;
    } else {
        let minScore = Infinity;
        // Prioritize center columns
        const colOrder = [3, 2, 4, 1, 5, 0, 6];
        for (let col of colOrder) {
            const row = getLowestEmptyRow(col);
            if (row !== -1) {
                board[row][col] = "purple";
                const score = minimax(depth - 1, alpha, beta, true);
                board[row][col] = null;
                minScore = Math.min(score, minScore);
                beta = Math.min(beta, score);
                if (beta <= alpha) break;
            }
        }
        return minScore;
    }
}

function evaluatePosition() {
    let score = 0;
    
    // Evaluate all possible 4-in-a-row positions
    // Horizontal
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS - 3; col++) {
            score += evaluateWindow([board[row][col], board[row][col+1], board[row][col+2], board[row][col+3]]);
        }
    }
    
    // Vertical
    for (let col = 0; col < COLS; col++) {
        for (let row = 0; row < ROWS - 3; row++) {
            score += evaluateWindow([board[row][col], board[row+1][col], board[row+2][col], board[row+3][col]]);
        }
    }
    
    // Diagonal (positive slope)
    for (let row = 0; row < ROWS - 3; row++) {
        for (let col = 0; col < COLS - 3; col++) {
            score += evaluateWindow([board[row][col], board[row+1][col+1], board[row+2][col+2], board[row+3][col+3]]);
        }
    }
    
    // Diagonal (negative slope)
    for (let row = 3; row < ROWS; row++) {
        for (let col = 0; col < COLS - 3; col++) {
            score += evaluateWindow([board[row][col], board[row-1][col+1], board[row-2][col+2], board[row-3][col+3]]);
        }
    }
    
    // Bonus for center column control
    let centerCount = 0;
    for (let row = 0; row < ROWS; row++) {
        if (board[row][3] === "green") centerCount++;
    }
    score += centerCount * 3;
    
    return score;
}

function evaluateWindow(window) {
    let score = 0;
    let aiCount = 0;
    let playerCount = 0;
    let emptyCount = 0;
    
    for (let cell of window) {
        if (cell === "green") aiCount++;
        else if (cell === "purple") playerCount++;
        else emptyCount++;
    }
    
    // AI scoring
    if (aiCount === 4) score += 100;
    else if (aiCount === 3 && emptyCount === 1) score += 10;
    else if (aiCount === 2 && emptyCount === 2) score += 5;
    
    // Block player
    if (playerCount === 3 && emptyCount === 1) score -= 80; // High priority to block
    else if (playerCount === 2 && emptyCount === 2) score -= 10;
    
    return score;
}

function getLowestEmptyRow(col) {
    for (let row = ROWS - 1; row >= 0; row--) {
        if (board[row][col] === null) {
            return row;
        }
    }
    return -1;
}

function findWinningMove(player) {
    for (let col = 0; col < COLS; col++) {
        const row = getLowestEmptyRow(col);
        if (row !== -1) {
            board[row][col] = player;
            const isWin = checkWinner(row, col);
            board[row][col] = null;
            if (isWin) return col;
        }
    }
    return -1;
}

function checkAllWins() {
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            if (board[row][col] !== null) {
                const win = checkWinner(row, col);
                if (win) return board[row][col];
            }
        }
    }
    return null;
}

createBoard();
