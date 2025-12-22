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
const infoFooter = document.getElementById("info-footer");
let timerDisplay = null;
let timerBar = null;

const summaryBox = document.createElement("div");
summaryBox.id = "summary-box";
resultArea.appendChild(summaryBox);

let questions = [];
let currentIndex = 0;
let score = 0;
let answersSummary = [];
let currentUserId = null;
let playerName = null;
let playerElo = 1000;

// Timer variables
let questionStartTime = null;
let timerInterval = null;
const MAX_TIME_PER_QUESTION = 10; // 10 seconds per question

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
    const data = playerSnap.data();
    playerName = data.name;
    playerElo = data.elo || 1000;
    console.log("Welcome back:", playerName, "ELO:", playerElo);
  } else {
    playerName = prompt("Welcome to Padhlo67! 🎓\n\nPlease enter your name:");

    if (!playerName || playerName.trim() === "") {
      playerName = "Player" + Math.floor(Math.random() * 10000);
    }

    playerName = playerName.trim();
    playerElo = 1000;

    await setDoc(playerRef, {
      name: playerName,
      elo: playerElo,
      gamesPlayed: 0,
      createdAt: new Date().toISOString()
    });

    console.log("New player created:", playerName);
  }

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

function calculateScore(timeTaken, isCorrect) {
  // Points system: 100 to -100 range for 10 questions
  // Correct answer: 0 to +10 points (based on speed)
  // Wrong answer: -10 points (fixed penalty)
  // Unanswered: 0 points
  
  if (!isCorrect) {
    return -10; // Wrong answer penalty
  }
  
  // Correct answer - give points based on speed
  // Answer in 0-1s: 10 points
  // Answer in 5s: 5 points
  // Answer in 10s: 1 point
  
  if (timeTaken <= 5) {
    // Linear scale from 10 points (0s) to 5 points (5s)
    return Math.round(10 - (timeTaken * 1));
  } else {
    // Linear scale from 5 points (5s) to 1 point (10s)
    return Math.round(5 - ((timeTaken - 5) * 0.8));
  }
}

function calculateEloChange(score, maxScore) {
  // Normalize score to 0-1 range (handling negative scores)
  // If score is negative, performance ratio will be less than 0.5
  // If score is positive, performance ratio will be more than 0.5
  const performanceRatio = (score + 100) / 200; // Convert -100 to +100 range to 0 to 1
  const K = 32;
  const expectedScore = 0.5;
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

    const eloChangeText = document.createElement("p");
    eloChangeText.className = "elo-change";
    eloChangeText.innerHTML = `
      <strong>ELO Change: ${eloChange > 0 ? '+' : ''}${eloChange}</strong><br>
      <span style="font-size: 0.9rem;">New ELO: ${Math.round(newElo)}</span>
    `;
    resultArea.insertBefore(eloChangeText, summaryBox);

    await loadLeaderboard();

    return eloChange;
  } catch (error) {
    console.error("Error updating ELO:", error);
  }
}

function startTimer() {
  stopTimer();

  if (!timerDisplay) timerDisplay = document.getElementById("timer-display");
  if (!timerBar) timerBar = document.getElementById("timer-bar");

  questionStartTime = Date.now();
  let timeLeft = MAX_TIME_PER_QUESTION;

  timerDisplay.textContent = `⏱️ ${timeLeft}s`;
  timerBar.style.width = "100%";
  timerBar.style.background = "linear-gradient(90deg, #44bd32 0%, #4cd137 100%)";

  timerInterval = setInterval(() => {
    const elapsed = (Date.now() - questionStartTime) / 1000;
    timeLeft = Math.ceil(MAX_TIME_PER_QUESTION - elapsed);

    if (timeLeft <= 0) {
      stopTimer();
      handleTimeout();
      return;
    }

    timerDisplay.textContent = `⏱️ ${timeLeft}s`;
    timerBar.style.width = `${(timeLeft / MAX_TIME_PER_QUESTION) * 100}%`;

    if (timeLeft <= 5) {
      timerBar.style.background = "linear-gradient(90deg, #e74c3c 0%, #c0392b 100%)";
    } else {
      timerBar.style.background = "linear-gradient(90deg, #f39c12 0%, #e67e22 100%)";
    }
  }, 100);
}


  
  timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - questionStartTime) / 1000);
    timeLeft = MAX_TIME_PER_QUESTION - elapsed;
    
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      handleTimeout();
      return;
    }
    
    if (timerDisplay) timerDisplay.textContent = `⏱️ ${timeLeft}s`;
    if (timerBar) {
      const percentage = (timeLeft / MAX_TIME_PER_QUESTION) * 100;
      timerBar.style.width = percentage + "%";
      
      // Change color based on time remaining
      if (timeLeft <= 5) {
        timerBar.style.background = "linear-gradient(90deg, #e74c3c 0%, #c0392b 100%)";
      } else if (timeLeft <= 10) {
        timerBar.style.background = "linear-gradient(90deg, #f39c12 0%, #e67e22 100%)";
      }
    }
  }, 100);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function getTimeTaken() {
  if (!questionStartTime) return MAX_TIME_PER_QUESTION;
  const elapsed = (Date.now() - questionStartTime) / 1000;
  return Math.min(elapsed, MAX_TIME_PER_QUESTION);
}

function handleTimeout() {
  const q = questions[currentIndex];
  const correctAnswer = q.options[q.correctIndex];
  const shuffledOptions = shuffleArray(q.options);
  const newCorrectIndex = shuffledOptions.indexOf(correctAnswer);
  
  const buttons = optionsBox.querySelectorAll("button");
  buttons.forEach((btn, i) => {
    btn.disabled = true;
    btn.style.cursor = "not-allowed";
    if (i === newCorrectIndex) {
      btn.classList.add("correct");
    }
  });
  
  answersSummary.push({
    question: q.question,
    yourAnswer: "⏱️ Time's up!",
    correctAnswer: correctAnswer,
    correct: false,
    timeTaken: MAX_TIME_PER_QUESTION,
    pointsEarned: 0
  });
  
  if (timerDisplay) timerDisplay.textContent = "⏱️ Time's up!";
  nextBtn.style.display = "block";
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
  infoFooter.classList.add("hidden");
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
      infoFooter.classList.remove("hidden");
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
    infoFooter.classList.remove("hidden");
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
  startTimer();
}

function checkAnswer(selected, correct, selectedText, correctAnswer, questionText) {
  stopTimer();
  const timeTaken = getTimeTaken();
  
  const buttons = optionsBox.querySelectorAll("button");
  buttons.forEach((btn) => {
    btn.disabled = true;
    btn.style.cursor = "not-allowed";
  });

  let isCorrect = false;
  let pointsEarned = 0;
  
  if (selected === correct) {
    pointsEarned = calculateScore(timeTaken, true);
    score += pointsEarned;
    buttons[selected].classList.add("correct");
    isCorrect = true;
  } else {
    pointsEarned = calculateScore(timeTaken, false);
    score += pointsEarned;
    buttons[selected].classList.add("wrong");
    buttons[correct].classList.add("correct");
  }

  answersSummary.push({
    question: questionText,
    yourAnswer: selectedText,
    correctAnswer: correctAnswer,
    correct: isCorrect,
    timeTaken: timeTaken.toFixed(1),
    pointsEarned: pointsEarned
  });

  nextBtn.style.display = "block";
}

nextBtn.addEventListener("click", () => {
  currentIndex++;
  showQuestion();
});

async function endGame() {
  stopTimer();
  quizArea.classList.add("hidden");
  resultArea.classList.remove("hidden");
  
  const maxScore = 100; // Best possible: all correct in <5s
  const correctAnswers = answersSummary.filter(a => a.correct).length;
  const percentage = Math.round((correctAnswers / questions.length) * 100);
  
  // Calculate score color based on percentage
  let scoreColor = "#44bd32"; // green
  if (percentage < 40) {
    scoreColor = "#e74c3c"; // red
  } else if (percentage < 70) {
    scoreColor = "#f39c12"; // orange
  }
  
  finalScore.innerHTML = `
    <div style="font-size: 3rem; color: ${scoreColor}; font-weight: bold; margin: 20px 0;">
      ${correctAnswers}/${questions.length}
    </div>
    <div style="font-size: 1.5rem; color: #667eea; margin: 10px 0;">
      ${percentage}% Correct
    </div>
    <div style="font-size: 1rem; color: #667eea; margin-top: 15px;">
      Average time: ${(answersSummary.reduce((sum, a) => sum + parseFloat(a.timeTaken), 0) / questions.length).toFixed(1)}s
    </div>
  `;

  await updatePlayerElo(score, maxScore);

  summaryBox.innerHTML = "<h3>Question Summary</h3>";
  answersSummary.forEach((a, i) => {
    const div = document.createElement("div");
    div.classList.add("summary-item");
    
    let pointsColor = "#44bd32";
    if (a.pointsEarned < 0) pointsColor = "#e74c3c";
    else if (a.pointsEarned < 5) pointsColor = "#f39c12";
    
    div.innerHTML = `
      <p><strong>Q${i + 1}.</strong> ${a.question}</p>
      <p>${a.correct ? "✅" : "❌"} Your answer: <b>${a.yourAnswer}</b></p>
      ${a.correct ? "" : `<p>✔ Correct answer: <b>${a.correctAnswer}</b></p>`}
      <p style="color: #667eea; font-weight: 600;">⏱️ Time: ${a.timeTaken}s | <span style="color: ${pointsColor}">Points: ${a.pointsEarned > 0 ? '+' : ''}${a.pointsEarned}</span></p>
      <hr>
    `;
    summaryBox.appendChild(div);
  });
}

restartBtn.addEventListener("click", () => {
  resultArea.classList.add("hidden");
  subjectSelection.classList.remove("hidden");
  leaderboardSection.classList.remove("hidden");
  infoFooter.classList.remove("hidden");
});
