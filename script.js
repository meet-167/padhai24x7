import { db, auth, signInAnonymously } from "./firebase.js";
import {
collection,
getDocs,
doc,
setDoc,
getDoc,
query,
orderBy,
limit,
updateDoc
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const subjectButtons = document.querySelectorAll("#subjects button");
const subjectSelection = document.getElementById("subject-selection");
const quizArea = document.getElementById("quiz-area");
const questionBox = document.getElementById("question-box");
const optionsBox = document.getElementById("options-box");
const nextBtn = document.getElementById("next-btn");
const resultArea = document.getElementById("result-area");
const finalScore = document.getElementById("final-score");
const restartBtn = document.getElementById("restart-btn");
const leaderboardSection = document.getElementById("leaderboard-section");
const leaderboardList = document.getElementById("leaderboard-list");
const playerNameDisplay = document.getElementById("player-name-display");
const playerEloDisplay = document.getElementById("player-elo-display");

const summaryBox = document.createElement("div");
summaryBox.id = "summary-box";
resultArea.appendChild(summaryBox);

let questions = [];
let currentIndex = 0;
let score = 0;
let answersSummary = [];
let currentUserId = null;
let playerName = null;
let playerElo = 1000; // Starting ELO

// Sign in and setup player
signInAnonymously(auth)
.then(async (userCredential) => {
currentUserId = userCredential.user.uid;
console.log("Signed in with ID:", currentUserId);
await setupPlayer();
await loadLeaderboard();
})
.catch((err) => console.error("Auth error:", err));

async function setupPlayer() {
const playerRef = doc(db, "players", currentUserId);
const playerSnap = await getDoc(playerRef);

if (playerSnap.exists()) {
// Existing player
const data = playerSnap.data();
playerName = data.name;
playerElo = data.elo || 1000;
console.log("Welcome back:", playerName, "ELO:", playerElo);
} else {
// New player - ask for name
playerName = prompt("Welcome to Padhlo67! 🎓\n\nPlease enter your name:");


if (!playerName || playerName.trim() === "") {
  playerName = "Player" + Math.floor(Math.random() * 10000);
}

playerName = playerName.trim();
playerElo = 1000; // Starting ELO

// Save to Firestore
await setDoc(playerRef, {
  name: playerName,
  elo: playerElo,
  gamesPlayed: 0,
  createdAt: new Date().toISOString()
});

console.log("New player created:", playerName);


}

// Display player info
playerNameDisplay.textContent = playerName;
playerEloDisplay.textContent = `ELO: ${Math.round(playerElo)}`;
}

async function loadLeaderboard() {
try {
const playersRef = collection(db, "players");
const q = query(playersRef, orderBy("elo", "desc"), limit(100));
const querySnapshot = await getDocs(q);


leaderboardList.innerHTML = "";

if (querySnapshot.empty) {
  leaderboardList.innerHTML = "<p>No players yet. Be the first! 🏆</p>";
  return;
}

let rank = 1;
querySnapshot.forEach((doc) => {
  const player = doc.data();
  const isCurrentPlayer = doc.id === currentUserId;
  
  const row = document.createElement("div");
  row.className = "leaderboard-row" + (isCurrentPlayer ? " current-player" : "");
  
  let medal = "";
  if (rank === 1) medal = "🥇";
  else if (rank === 2) medal = "🥈";
  else if (rank === 3) medal = "🥉";
  
  row.innerHTML = `
    <span class="rank">${medal || `#${rank}`}</span>
    <span class="player-name">${player.name}</span>
    <span class="player-elo">${Math.round(player.elo)}</span>
  `;
  
  leaderboardList.appendChild(row);
  rank++;
});


} catch (error) {
console.error("Error loading leaderboard:", error);
leaderboardList.innerHTML = "<p>Error loading leaderboard 😢</p>";
}
}

function calculateEloChange(score, maxScore) {
// Calculate performance ratio (0 to 1)
const performanceRatio = score / maxScore;

// K-factor (how much ELO changes per game)
const K = 32;

// Expected score (0.5 means 50% expected)
const expectedScore = 0.5;

// ELO change formula
const eloChange = K * (performanceRatio - expectedScore);

return Math.round(eloChange);
}

async function updatePlayerElo(scoreEarned, maxScore) {
const eloChange = calculateEloChange(scoreEarned, maxScore);
const newElo = playerElo + eloChange;

const playerRef = doc(db, "players", currentUserId);

try {
const playerSnap = await getDoc(playerRef);
const currentData = playerSnap.data();


await updateDoc(playerRef, {
  elo: newElo,
  gamesPlayed: (currentData.gamesPlayed || 0) + 1,
  lastPlayed: new Date().toISOString()
});

playerElo = newElo;
playerEloDisplay.textContent = `ELO: ${Math.round(playerElo)}`;

// Show ELO change in result
const eloChangeText = document.createElement("p");
eloChangeText.className = "elo-change";
eloChangeText.innerHTML = `
  <strong>ELO Change: ${eloChange > 0 ? '+' : ''}${eloChange}</strong><br>
  <span style="font-size: 0.9rem;">New ELO: ${Math.round(newElo)}</span>
`;
resultArea.insertBefore(eloChangeText, summaryBox);

// Reload leaderboard
await loadLeaderboard();

return eloChange;


} catch (error) {
console.error("Error updating ELO:", error);
}
}

subjectButtons.forEach((btn) => {
btn.addEventListener("click", () => {
startGame(btn.dataset.subject);
});
});

function shuffleArray(array) {
const arr = array.slice();
for (let i = arr.length - 1; i > 0; i = i - 1) {
const j = Math.floor(Math.random() * (i + 1));
[arr[i], arr[j]] = [arr[j], arr[i]];
}
return arr;
}

async function startGame(subject) {
subjectSelection.classList.add("hidden");
leaderboardSection.classList.add("hidden");
quizArea.classList.remove("hidden");
resultArea.classList.add("hidden");
score = 0;
currentIndex = 0;
answersSummary = [];

try {
const itemsRef = collection(db, "questions", subject, "items");
const qSnap = await getDocs(itemsRef);


if (qSnap.empty) {
  alert(`No questions found for ${subject}!`);
  quizArea.classList.add("hidden");
  subjectSelection.classList.remove("hidden");
  leaderboardSection.classList.remove("hidden");
  return;
}

let allQuestions = [];
qSnap.forEach((doc) => allQuestions.push(doc.data()));

questions = shuffleArray(allQuestions).slice(0, Math.min(10, allQuestions.length));
showQuestion();


} catch (error) {
alert("Error loading questions: " + error.message);
quizArea.classList.add("hidden");
subjectSelection.classList.remove("hidden");
leaderboardSection.classList.remove("hidden");
}
}

function showQuestion() {
if (currentIndex >= questions.length) {
return endGame();
}

const q = questions[currentIndex];
questionBox.textContent = `Q${currentIndex + 1}. ${q.question}`;
optionsBox.innerHTML = "";

const correctAnswer = q.options[q.correctIndex];
const shuffledOptions = shuffleArray(q.options);
const newCorrectIndex = shuffledOptions.indexOf(correctAnswer);

shuffledOptions.forEach((opt, i) => {
const btn = document.createElement("button");
btn.textContent = opt;
btn.onclick = () => checkAnswer(i, newCorrectIndex, opt, correctAnswer, q.question);
optionsBox.appendChild(btn);
});

nextBtn.style.display = "none";
}

function checkAnswer(selected, correct, selectedText, correctAnswer, questionText) {
const buttons = optionsBox.querySelectorAll("button");
buttons.forEach((btn) => {
btn.disabled = true;
btn.style.cursor = "not-allowed";
});

let isCorrect = false;
if (selected === correct) {
score += 10;
buttons[selected].classList.add("correct");
isCorrect = true;
} else {
buttons[selected].classList.add("wrong");
buttons[correct].classList.add("correct");
}

answersSummary.push({
question: questionText,
yourAnswer: selectedText,
correctAnswer: correctAnswer,
correct: isCorrect,
});

nextBtn.style.display = "block";
}

nextBtn.addEventListener("click", () => {
currentIndex++;
showQuestion();
});

async function endGame() {
quizArea.classList.add("hidden");
resultArea.classList.remove("hidden");
finalScore.textContent = `${score} / ${questions.length * 10}`;

// Update ELO
await updatePlayerElo(score, questions.length * 10);

// Generate summary
summaryBox.innerHTML = "<h3>Question Summary</h3>";
answersSummary.forEach((a, i) => {
const div = document.createElement("div");
div.classList.add("summary-item");
div.innerHTML = `<p><strong>Q${i + 1}.</strong> ${a.question}</p> <p>${a.correct ? "✅" : "❌"} Your answer: <b>${a.yourAnswer}</b></p> ${a.correct ? "" :`<p>✔ Correct answer: <b>${a.correctAnswer}</b></p>`} <hr> `;
summaryBox.appendChild(div);
});
}

restartBtn.addEventListener("click", () => {
resultArea.classList.add("hidden");
subjectSelection.classList.remove("hidden");
leaderboardSection.classList.remove("hidden");
});