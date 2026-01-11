/* ==============================
   WORDLE - Vanilla JS
   Features:
   - Random target from array
   - Input validation + message UI
   - New Game button after win/lose
   - Enter key support
   - Shows correct word on loss
   - Flip animation
   - Correct duplicate-letter logic
   - Basic stats: played, win%, streak
================================ */

const WORDS = [
  "table", "chair", "piano", "mouse", "house",
  "plant", "brain", "cloud", "beach", "fruit",
  "media", "candy", "stone", "light", "water"
];

const MAX_TRIES = 6;
const WORD_LEN = 5;

// DOM
const boardEl = document.getElementById("board");
const inputEl = document.getElementById("guessInput");
const guessBtn = document.getElementById("guessButton");
const newGameBtn = document.getElementById("newGameButton");
const messageEl = document.getElementById("message");

const gamesPlayedEl = document.getElementById("gamesPlayed");
const winPercentEl = document.getElementById("winPercent");
const streakEl = document.getElementById("streak");

// Game state
let targetWord = "";
let currentRow = 0;
let gameOver = false;

// Stats (simple, in memory)
let stats = {
  played: 0,
  wins: 0,
  streak: 0
};

// Board references
let cells = []; // 6 x 5

function pickRandomWord() {
  const idx = Math.floor(Math.random() * WORDS.length);
  return WORDS[idx].toLowerCase();
}

function setMessage(text, type = "") {
  messageEl.textContent = text;
  messageEl.classList.remove("error", "success");
  if (type) messageEl.classList.add(type);
}

function updateStatsUI() {
  gamesPlayedEl.textContent = String(stats.played);

  const winPct = stats.played === 0 ? 0 : Math.round((stats.wins / stats.played) * 100);
  winPercentEl.textContent = `${winPct}%`;

  streakEl.textContent = String(stats.streak);
}

function buildBoard() {
  boardEl.innerHTML = "";
  cells = [];

  for (let r = 0; r < MAX_TRIES; r++) {
    const row = document.createElement("div");
    row.className = "row";

    const rowCells = [];
    for (let c = 0; c < WORD_LEN; c++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.textContent = "";
      row.appendChild(cell);
      rowCells.push(cell);
    }

    boardEl.appendChild(row);
    cells.push(rowCells);
  }
}

function clearBoardStyles() {
  for (let r = 0; r < MAX_TRIES; r++) {
    for (let c = 0; c < WORD_LEN; c++) {
      const cell = cells[r][c];
      cell.textContent = "";
      cell.className = "cell";
    }
  }
}

function sanitizeGuess(raw) {
  return raw.trim().toLowerCase();
}

function validateGuess(guess) {
  if (guess.length !== WORD_LEN) {
    return `Guess must be exactly ${WORD_LEN} letters.`;
  }
  if (!/^[a-z]+$/.test(guess)) {
    return "Use only letters (A-Z).";
  }
  return "";
}

/*
  Wordle-like feedback with duplicates handled:

  Step 1: Mark greens, and "consume" matched letters from target counts
  Step 2: For remaining letters, mark yellow if still available in target counts, else red
*/
function getFeedback(guess, target) {
  const feedback = Array(WORD_LEN).fill("red");
  const targetCounts = {};

  // count target letters
  for (const ch of target) {
    targetCounts[ch] = (targetCounts[ch] || 0) + 1;
  }

  // pass 1: greens
  for (let i = 0; i < WORD_LEN; i++) {
    if (guess[i] === target[i]) {
      feedback[i] = "green";
      targetCounts[guess[i]] -= 1;
    }
  }

  // pass 2: yellows (only if still available)
  for (let i = 0; i < WORD_LEN; i++) {
    if (feedback[i] === "green") continue;

    const ch = guess[i];
    if (targetCounts[ch] > 0) {
      feedback[i] = "yellow";
      targetCounts[ch] -= 1;
    } else {
      feedback[i] = "red";
    }
  }

  return feedback;
}

function paintRow(rowIndex, guess, feedback) {
  // Put letters first
  for (let c = 0; c < WORD_LEN; c++) {
    const cell = cells[rowIndex][c];
    cell.textContent = guess[c].toUpperCase();
    cell.classList.add("filled");
  }

  // Reveal with small stagger for nicer effect
  for (let c = 0; c < WORD_LEN; c++) {
    const cell = cells[rowIndex][c];
    setTimeout(() => {
      cell.classList.add("reveal");
      // apply color class after flip reaches "hidden" phase
      setTimeout(() => {
        cell.classList.add(feedback[c]);
      }, 280);
    }, c * 90);
  }
}

function endGame(won) {
  gameOver = true;
  inputEl.disabled = true;
  guessBtn.disabled = true;
  newGameBtn.classList.remove("hidden");

  stats.played += 1;

  if (won) {
    stats.wins += 1;
    stats.streak += 1;
    setMessage("You won! 🎉", "success");
    alert("You won! 🎉");
  } else {
    stats.streak = 0;
    const upper = targetWord.toUpperCase();
    setMessage(`You lost! The word was: ${upper}`, "error");
    alert(`You lost! The word was: ${upper}`);
  }

  updateStatsUI();
}

function handleGuess() {
  if (gameOver) return;

  const guess = sanitizeGuess(inputEl.value);
  const error = validateGuess(guess);

  if (error) {
    setMessage(error, "error");
    return;
  }

  setMessage(""); // clear message

  const feedback = getFeedback(guess, targetWord);
  paintRow(currentRow, guess, feedback);

  // Check win
  if (guess === targetWord) {
    // wait for reveal to look nicer
    setTimeout(() => endGame(true), 900);
    return;
  }

  currentRow += 1;

  if (currentRow >= MAX_TRIES) {
    setTimeout(() => endGame(false), 900);
    return;
  }

  inputEl.value = "";
  inputEl.focus();
}

function newGame() {
  targetWord = pickRandomWord();
  currentRow = 0;
  gameOver = false;

  clearBoardStyles();
  setMessage("New game started. Good luck!");

  inputEl.value = "";
  inputEl.disabled = false;
  guessBtn.disabled = false;
  newGameBtn.classList.add("hidden");

  inputEl.focus();

  // (Optional debug)
  // console.log("Target:", targetWord);
}

function wireEvents() {
  guessBtn.addEventListener("click", handleGuess);

  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleGuess();
  });

  // Force only 5 letters visually + keep clean
  inputEl.addEventListener("input", () => {
    inputEl.value = inputEl.value.replace(/[^a-zA-Z]/g, "").slice(0, WORD_LEN);
  });

  newGameBtn.addEventListener("click", newGame);
}

// Init
buildBoard();
wireEvents();
updateStatsUI();
newGame();
