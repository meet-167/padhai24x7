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
  updateDoc,
  runTransaction,
  increment
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
const missionStatement = document.getElementById("mission-statement");
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

// Timer variables - CHANGED TO TOTAL QUIZ TIMER
let quizStartTime = null;
let questionStartTime = null;
let timerInterval = null;
const TOTAL_QUIZ_TIME = 180; // 3 minutes in seconds

async function incrementVisitCounter(counterId) {
  const counterRef = doc(db, "visits", counterId);
  console.log(`Checking counter: ${counterId}...`);

  try {
    const snap = await getDoc(counterRef);
    if (!snap.exists()) {
      console.log(`${counterId} doesn't exist. Creating now...`);
      await setDoc(counterRef, { number: 1 });
    } else {
      console.log(`${counterId} exists. Incrementing...`);

      await updateDoc(counterRef, {
        number: increment(1) 
      });
    }
    console.log(`✅ ${counterId} updated successfully!`);
  } catch (e) {
    console.error(`❌ Error updating ${counterId}:`, e);
  }
}
signInAnonymously(auth)
  .then(async (userCredential) => {
    currentUserId = userCredential.user.uid;
    console.log("Signed in with ID:", currentUserId);
    
    await setupPlayer();
    await loadLeaderboard();
    await incrementVisitCounter("totalVisits");
  })
  .catch((err) => console.error("Auth error:", err));

async function setupPlayer() {
  const playerRef = doc(db, "players", currentUserId);

  try {
    const playerSnap = await getDoc(playerRef);

    if (playerSnap.exists()) {
      const data = playerSnap.data();

      if (
        typeof data.name === "string" &&
        data.name.trim().length > 0 &&
        typeof data.elo === "number"
      ) {
        playerName = data.name;
        playerElo = data.elo;
        playerNameDisplay.textContent = playerName;
        playerEloDisplay.textContent = `ELO: ${Math.round(playerElo)}`;
        return;
      }
    } else {
      // IF PLAYER DOES NOT EXIST: This is a brand new user
      console.log("New user detected! Logging join...");
      await incrementVisitCounter("newUserJoined"); 
    }

    // This handles both brand new users and corrupted data resets
    await resetPlayer(playerRef);

  } catch (error) {
    console.error("Error loading player data:", error);
    await resetPlayer(playerRef);
  }
}

// Prevents null names
async function resetPlayer(playerRef) {
  let name = prompt("Welcome to Padhai 24x7! 🎓\n\nPlease enter your name:");
  
  if (name === null || name.trim() === "") {
    name = "Student_" + Math.floor(Math.random() * 9000 + 1000);
  }

  playerName = name.trim().substring(0, 20);
  playerElo = 1000;

  await setDoc(playerRef, {
    name: playerName,
    elo: playerElo,
    gamesPlayed: 0,
    createdAt: new Date().toISOString()
  });

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

/* ===============================
   ANTI-REPEAT RANDOMNESS
================================ */
const RECENT_LIMIT = 30;

function getQuestionFingerprint(q) {
  return q.question.trim() + "|" + q.options.join("|");
}

function getRecentQuestions() {
  return JSON.parse(localStorage.getItem("recentQuestions") || "[]");
}

function saveRecentQuestions(arr) {
  localStorage.setItem(
    "recentQuestions",
    JSON.stringify(arr.slice(-RECENT_LIMIT))
  );
}

function calculateSpeedBonus(totalTimeSeconds) {
  // Speed bonus based on total quiz completion time
  if (totalTimeSeconds < 60) return 30;
  if (totalTimeSeconds < 120) return 20;
  if (totalTimeSeconds < 180) return 10;
  return 0;
}

function calculateEloChange(scoreEarned) {
  return scoreEarned; 
}

async function updatePlayerElo(scoreEarned) {
  
  const eloChange = calculateEloChange(scoreEarned);
  const newElo = playerElo + eloChange; 

  const playerRef = doc(db, "players", currentUserId);

  try {
    const playerSnap = await getDoc(playerRef);
    const currentData = playerSnap.data();

    // Update the database with the new total
    await updateDoc(playerRef, {
      elo: newElo,
      gamesPlayed: (currentData.gamesPlayed || 0) + 1,
      lastPlayed: new Date().toISOString()
    });

    // Update the local variables and UI
    playerElo = newElo;
    playerEloDisplay.textContent = `ELO: ${Math.round(playerElo)}`;

    // Show the change to the user
    const eloChangeText = document.createElement("p");
    eloChangeText.className = "elo-change";
    eloChangeText.innerHTML = `
      <strong>Score added to ELO: ${eloChange > 0 ? '+' : ''}${eloChange}</strong><br>
      <span style="font-size: 0.9rem;">Total ELO: ${Math.round(newElo)}</span>
    `;
    
    // Clear old elo change messages before adding new one
    const oldChange = resultArea.querySelector(".elo-change");
    if(oldChange) oldChange.remove();
    
    resultArea.insertBefore(eloChangeText, summaryBox);

    await loadLeaderboard();

    return eloChange;
  } catch (error) {
    console.error("Error updating ELO:", error);
  }
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function startQuizTimer() {
  stopTimer();

  if (!timerDisplay) timerDisplay = document.getElementById("timer-display");
  if (!timerBar) timerBar = document.getElementById("timer-bar");

  quizStartTime = Date.now();
  let timeLeft = TOTAL_QUIZ_TIME;

  timerDisplay.textContent = `⏱️ ${formatTime(timeLeft)}`;
  timerBar.style.width = "100%";
  timerBar.style.background = "linear-gradient(90deg, #44bd32 0%, #4cd137 100%)";

  timerInterval = setInterval(() => {
    const elapsed = (Date.now() - quizStartTime) / 1000;
    timeLeft = TOTAL_QUIZ_TIME - elapsed;

    if (timeLeft <= 0) {
      stopTimer();
      handleQuizTimeout();
      return;
    }

    timerDisplay.textContent = `⏱️ ${formatTime(timeLeft)}`;
    timerBar.style.width = `${(timeLeft / TOTAL_QUIZ_TIME) * 100}%`;

    if (timeLeft <= 30) {
      timerBar.style.background = "linear-gradient(90deg, #e74c3c 0%, #c0392b 100%)";
    } else if (timeLeft <= 60) {
      timerBar.style.background = "linear-gradient(90deg, #f39c12 0%, #e67e22 100%)";
    }
  }, 100);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function getTotalTimeTaken() {
  if (!quizStartTime) return 0;
  return (Date.now() - quizStartTime) / 1000;
}

function getQuestionTimeTaken() {
  if (!questionStartTime) return 0;
  return (Date.now() - questionStartTime) / 1000;
}

function handleQuizTimeout() {
  // Mark all remaining questions as unanswered
  while (currentIndex < questions.length) {
    const q = questions[currentIndex];
    answersSummary.push({
      question: q.question,
      yourAnswer: "⏱️ Time's up!",
      correctAnswer: q.options[q.correctIndex],
      correct: false,
      timeTaken: 0,
      pointsEarned: 0
    });
    currentIndex++;
  }
  
  endGame();
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
  document.querySelector("header").style.position = "static";
  subjectSelection.classList.add("hidden");
  leaderboardSection.classList.add("hidden");
  infoFooter.classList.add("hidden");
  quizArea.classList.remove("hidden");
  resultArea.classList.add("hidden");
  missionStatement.classList.add("hidden");
  score = 0;
  currentIndex = 0;
  answersSummary = [];
  quizStartTime = null;

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

    const recent = getRecentQuestions();

    let freshQuestions = allQuestions.filter(
      q => !recent.includes(getQuestionFingerprint(q))
    );

    if (freshQuestions.length < 10) {
      freshQuestions = allQuestions;
    }

    questions = shuffleArray(freshQuestions)
      .slice(0, Math.min(10, freshQuestions.length));

    saveRecentQuestions([
      ...recent,
      ...questions.map(getQuestionFingerprint)
    ]);
    
    startQuizTimer(); // Start the 3-minute timer
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
  questionStartTime = Date.now(); // Track when this question started
}

function checkAnswer(selected, correct, selectedText, correctAnswer, questionText) {
  const timeTaken = getQuestionTimeTaken();
  
  const buttons = optionsBox.querySelectorAll("button");
  buttons.forEach((btn) => {
    btn.disabled = true;
    btn.style.cursor = "not-allowed";
  });

  let isCorrect = false;
  let pointsEarned = 0;
  
  if (selected === correct) {
    pointsEarned = 10; // Fixed points for correct answer
    score += pointsEarned;
    buttons[selected].classList.add("correct");
    isCorrect = true;
  } else {
    pointsEarned = -10; // Penalty for wrong answer
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
  
  const totalTimeTaken = getTotalTimeTaken();
  const correctAnswers = answersSummary.filter(a => a.correct).length;
  const percentage = Math.round((correctAnswers / questions.length) * 100);
  const speedBonus = calculateSpeedBonus(totalTimeTaken);
  const finalScoreValue = score + speedBonus;
  
  // Calculate average time per question
  const totalQuestionTime = answersSummary.reduce((sum, a) => sum + parseFloat(a.timeTaken || 0), 0);
  const avgTimePerQuestion = totalQuestionTime / questions.length;
  
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
    <div style="font-size: 1.1rem; color: #273c75; margin: 15px 0;">
      ⏱️ Total Time: <strong>${formatTime(totalTimeTaken)}</strong>
    </div>
    <div style="font-size: 1rem; color: #667eea; margin: 10px 0;">
      Average per question: ${avgTimePerQuestion.toFixed(1)}s
    </div>
    <div style="font-size: 1.3rem; color: #44bd32; margin: 20px 0; font-weight: bold;">
      ${speedBonus > 0 ? `🚀 Speed Bonus: +${speedBonus} points!` : ''}
    </div>
    <div style="font-size: 1.2rem; color: #273c75; margin: 10px 0;">
      Final Score: <strong style="color: ${scoreColor}">${finalScoreValue > 0 ? '+' : ''}${finalScoreValue}</strong>
    </div>
  `;

  const maxScore = 130; // 10 correct (100) + max speed bonus (30)
  await updatePlayerElo(finalScoreValue);

  summaryBox.innerHTML = "<h3>Question Summary</h3>";
  answersSummary.forEach((a, i) => {
    const div = document.createElement("div");
    div.classList.add("summary-item");
    
    let pointsColor = "#44bd32";
    if (a.pointsEarned < 0) pointsColor = "#e74c3c";
    
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
  document.querySelector("header").style.position = "sticky";
  resultArea.classList.add("hidden");
  subjectSelection.classList.remove("hidden");
  leaderboardSection.classList.remove("hidden");
  infoFooter.classList.remove("hidden");
  missionStatement.classList.remove("hidden");
});
