const boardEl = document.getElementById("board");
const statusEl = document.getElementById("status");
const overlay = document.getElementById("overlay");
const winnerText = document.getElementById("winner-text");
const winnerSymbol = document.getElementById("winner-symbol");
const drawSymbols = document.getElementById("draw-symbols");

const scoreX = document.getElementById("score-x");
const scoreO = document.getElementById("score-o");

const playerXLabel = document.getElementById("player-x");
const playerOLabel = document.getElementById("player-o");

let board = Array(9).fill(null);
let currentPlayer = "X";
let gameOver = false;

let scores = { X: 0, O: 0 };

// Game mode variables
let gameMode = "multiplayer"; // multiplayer, easy, medium, hard
let isAIThinking = false;

function createBoard() {
    // Clear all cells
    boardEl.innerHTML = "";
    
    // Create new cells
    board.forEach((_, i) => {
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.onclick = () => makeMove(i);
        boardEl.appendChild(cell);
    });
}

// Stamps a cell with the player's mark and the matching
// mark-x / mark-o class so CSS can color it with that
// player's accent color.
function markCell(i, player) {
    const cell = boardEl.children[i];
    cell.textContent = player;
    cell.classList.remove("mark-x", "mark-o");
    cell.classList.add(player === "X" ? "mark-x" : "mark-o");
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
    playerXLabel.querySelector(".player-name").textContent = "Player X";
    playerOLabel.querySelector(".player-name").textContent = "Player O";
    
    // Reset game and scores
    resetGame();
}

function makeMove(i) {
    if (board[i] || gameOver || isAIThinking) return;
    
    // In single player mode, only allow player (X) to click
    if (gameMode !== "multiplayer" && currentPlayer === "O") return;

    board[i] = currentPlayer;
    markCell(i, currentPlayer);

    const win = checkWinner();
    if (win) {
        highlightWinner(win);
        scores[currentPlayer]++;
        updateScore(currentPlayer);
        endGame("winner", currentPlayer);
        return;
    }

    if (board.every(c => c !== null)) {
        endGame("draw");
        return;
    }

    currentPlayer = currentPlayer === "X" ? "O" : "X";
    statusEl.textContent = `Player ${currentPlayer}'s Turn`;
    updateActivePlayer();
    
    // If single player mode and now AI's turn
    if (gameMode !== "multiplayer" && currentPlayer === "O") {
        statusEl.textContent = "Player O is thinking...";
        isAIThinking = true;
        setTimeout(() => {
            makeAIMove();
        }, 500); // Small delay to make it feel more natural
    }
}

function updateActivePlayer() {
    if (currentPlayer === "X") {
        playerXLabel.classList.add("active");
        playerOLabel.classList.remove("active");
    } else {
        playerOLabel.classList.add("active");
        playerXLabel.classList.remove("active");
    }
}

function checkWinner() {
    const wins = [
        [0,1,2],[3,4,5],[6,7,8],
        [0,3,6],[1,4,7],[2,5,8],
        [0,4,8],[2,4,6]
    ];
    return wins.find(([a,b,c]) =>
        board[a] && board[a] === board[b] && board[a] === board[c]
    );
}

function highlightWinner(cells) {
    cells.forEach(i => boardEl.children[i].classList.add("winner"));
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
        winnerSymbol.textContent = winner;
        winnerSymbol.classList.remove("mark-x", "mark-o");
        winnerSymbol.classList.add(winner === "X" ? "mark-x" : "mark-o");
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
    board = Array(9).fill(null);
    gameOver = false;
    isAIThinking = false;
    currentPlayer = "X";
    statusEl.textContent = "Player X's Turn";
    createBoard();
    updateActivePlayer();
}

function resetGame() {
    const modal = overlay.querySelector(".modal");
    modal.classList.remove("popup");
    boardEl.classList.remove("falling");
    board = Array(9).fill(null);
    gameOver = false;
    isAIThinking = false;
    currentPlayer = "X";
    statusEl.textContent = "Player X's Turn";
    scores = { X: 0, O: 0 };
    updateScore();
    createBoard();
    updateActivePlayer();
}

function updateScore(playerWon = null) {
    const prevScoreX = parseInt(scoreX.textContent === '-' ? 0 : scoreX.textContent);
    const prevScoreO = parseInt(scoreO.textContent === '-' ? 0 : scoreO.textContent);
    
    scoreX.textContent = scores.X === 0 ? '-' : scores.X;
    scoreO.textContent = scores.O === 0 ? '-' : scores.O;
    
    // Add animation if score increased
    if (playerWon === 'X' && scores.X > prevScoreX) {
        scoreX.classList.remove('increment');
        void scoreX.offsetWidth; // Trigger reflow
        scoreX.classList.add('increment');
        setTimeout(() => scoreX.classList.remove('increment'), 600);
    } else if (playerWon === 'O' && scores.O > prevScoreO) {
        scoreO.classList.remove('increment');
        void scoreO.offsetWidth; // Trigger reflow
        scoreO.classList.add('increment');
        setTimeout(() => scoreO.classList.remove('increment'), 600);
    }
}

function exitGame() {
    window.location.href = "index.html";
}

// AI Functions
function makeAIMove() {
    let move;
    
    if (gameMode === "easy") {
        move = getRandomMove();
    } else if (gameMode === "medium") {
        move = getMediumMove();
    } else if (gameMode === "hard") {
        move = getBestMove();
    }
    
    if (move !== -1 && !gameOver) {
        // Place AI move
        board[move] = "O";
        markCell(move, "O");
        
        // Check for win or draw
        const win = checkWinner();
        if (win) {
            highlightWinner(win);
            scores["O"]++;
            updateScore("O");
            endGame("winner", "O");
            isAIThinking = false;
            return;
        }
        
        if (board.every(c => c !== null)) {
            endGame("draw");
            isAIThinking = false;
            return;
        }
        
        // Switch back to player
        currentPlayer = "X";
        statusEl.textContent = "Player X's Turn";
        updateActivePlayer();
        isAIThinking = false;
    }
}

// Easy AI - Random move
function getRandomMove() {
    const availableMoves = board.map((cell, idx) => cell === null ? idx : null).filter(val => val !== null);
    if (availableMoves.length === 0) return -1;
    return availableMoves[Math.floor(Math.random() * availableMoves.length)];
}

// Medium AI - Block player wins, otherwise random
function getMediumMove() {
    // Try to win
    const winMove = findWinningMove("O");
    if (winMove !== -1) return winMove;
    
    // Try to block player
    const blockMove = findWinningMove("X");
    if (blockMove !== -1) return blockMove;
    
    // Otherwise random
    return getRandomMove();
}

// Hard AI - Minimax algorithm (unbeatable)
function getBestMove() {
    let bestScore = -Infinity;
    let bestMove = -1;
    
    for (let i = 0; i < 9; i++) {
        if (board[i] === null) {
            board[i] = "O";
            let score = minimax(board, 0, false);
            board[i] = null;
            
            if (score > bestScore) {
                bestScore = score;
                bestMove = i;
            }
        }
    }
    
    return bestMove;
}

function minimax(board, depth, isMaximizing) {
    const winner = checkWinnerForMinimax();
    
    if (winner === "O") return 10 - depth;
    if (winner === "X") return depth - 10;
    if (board.every(c => c !== null)) return 0;
    
    if (isMaximizing) {
        let bestScore = -Infinity;
        for (let i = 0; i < 9; i++) {
            if (board[i] === null) {
                board[i] = "O";
                let score = minimax(board, depth + 1, false);
                board[i] = null;
                bestScore = Math.max(score, bestScore);
            }
        }
        return bestScore;
    } else {
        let bestScore = Infinity;
        for (let i = 0; i < 9; i++) {
            if (board[i] === null) {
                board[i] = "X";
                let score = minimax(board, depth + 1, true);
                board[i] = null;
                bestScore = Math.min(score, bestScore);
            }
        }
        return bestScore;
    }
}

function findWinningMove(player) {
    for (let i = 0; i < 9; i++) {
        if (board[i] === null) {
            board[i] = player;
            const isWin = checkWinner();
            board[i] = null;
            if (isWin) return i;
        }
    }
    return -1;
}

function checkWinnerForMinimax() {
    const wins = [
        [0,1,2],[3,4,5],[6,7,8],
        [0,3,6],[1,4,7],[2,5,8],
        [0,4,8],[2,4,6]
    ];
    
    for (let [a,b,c] of wins) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a];
        }
    }
    return null;
}

createBoard();