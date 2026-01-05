// Chapter data for all subjects
const chaptersData = {
  Mathematics: [
    "Commercial Mathematics",
    "Goods and Service Tax (GST)",
    "Banking",
    "Shares and Dividends",
    "Linear Inequations",
    "Quadratic Equations",
    "Ratio and Proportion",
    "Factorizations",
    "Matrices",
    "Arithmetic Progression",
    "Geometric Progression",
    "Coordinate Geometry",
    "Reflection",
    "Similarity",
    "Loci",
    "Circles",
    "Constructions",
    "Mensuration",
    "Trigonometry",
    "Statistics",
    "Probability"
  ],
  Physics: [
    "Force",
    "Work, Energy and Power",
    "Machines",
    "Refraction of Light",
    "Refraction through a Lens",
    "Spectrum",
    "Sound",
    "Current Electricity",
    "Household Circuits",
    "Magnetic Effect of Current",
    "Electromagnetic Induction",
    "Calorimetry",
    "Radioactivity"
  ],
  Chemistry: [
    "Periodic Table and Periodic Properties",
    "Chemical Bonding",
    "Study of Acids, Bases and Salts",
    "Analytical Chemistry",
    "Mole Concept and Stoichiometry",
    "Electrolysis",
    "Metallurgy",
    "Study of Compounds - Hydrogen Chloride",
    "Study of Compounds - Ammonia",
    "Study of Compounds - Nitric Acid",
    "Study of Compounds - Sulphuric Acid",
    "Organic Chemistry",
    "Practical Chemistry"
  ],
  Biology: [
    "Cell Division",
    "Genetics",
    "Absorption by Roots",
    "Transpiration",
    "Photosynthesis",
    "Chemical Coordination in Plants",
    "Nervous System",
    "Sense Organs",
    "Endocrine System",
    "Excretory System",
    "Circulatory System",
    "Respiratory System",
    "Reproductive System",
    "Population",
    "Pollution"
  ],
  English: [
    "Julius Caesar - Act 3",
    "Julius Caesar - Act 4",
    "Julius Caesar - Act 5",
    "Poetry - Haunted Houses",
    "Poetry - The Glove and The Lion",
    "Poetry - When Great Trees Fall",
    "Poetry - A Considerable Speck",
    "Poetry - Power of Music",
    "Prose - With the Photographer",
    "Prose - The Elevator",
    "Prose - The Girl Who Can",
    "Prose - The Pedestrian",
    "Prose - The Last Lesson"
  ],
  History: [
    "The First World War",
    "The Russian Revolution",
    "Rise of Dictatorships",
    "The Second World War",
    "United Nations",
    "The Union Legislature",
    "The Union Executive",
    "The Union Judiciary",
    "State Government",
    "Local Self Government"
  ],
  Geography: [
    "Climate of India",
    "Natural Vegetation",
    "Mineral Resources",
    "Power Resources",
    "Agriculture in India",
    "Manufacturing Industries",
    "Population",
    "Transport and Communication"
  ],
  Computer: [
    "Basics of Java",
    "Java Tokens",
    "Operators and Expressions",
    "Input and Output",
    "Conditional Statements",
    "Iterative Statements",
    "Arrays",
    "Functions",
    "Class and Objects",
    "Constructors"
  ]
};

// DOM Elements
const subjectButtons = document.querySelectorAll("#subjects button");
const subjectSelection = document.getElementById("subject-selection");
const plannerArea = document.getElementById("planner-area");
const currentSubjectTitle = document.getElementById("current-subject-title");
const backBtn = document.getElementById("back-btn");
const chaptersBody = document.getElementById("chapters-body");
const clearAllBtn = document.getElementById("clear-all-btn");
const exportBtn = document.getElementById("export-btn");

let currentSubject = null;

// Load progress from localStorage
function getProgress(subject) {
  const saved = localStorage.getItem(`planner_${subject}`);
  return saved ? JSON.parse(saved) : {};
}

// Save progress to localStorage
function saveProgress(subject, progress) {
  localStorage.setItem(`planner_${subject}`, JSON.stringify(progress));
}

// Update progress counts
function updateProgressCounts() {
  const progress = getProgress(currentSubject);
  const chapters = chaptersData[currentSubject];
  const total = chapters.length;

  let learningCount = 0;
  let revisionCount = 0;
  let practiceCount = 0;
  let completedCount = 0;

  chapters.forEach((chapter, index) => {
    const chapterProgress = progress[index] || {};
    if (chapterProgress.learning) learningCount++;
    if (chapterProgress.revision) revisionCount++;
    if (chapterProgress.practice) practiceCount++;
    if (chapterProgress.learning && chapterProgress.revision && chapterProgress.practice) {
      completedCount++;
    }
  });

  document.getElementById("learning-count").textContent = `${learningCount}/${total}`;
  document.getElementById("revision-count").textContent = `${revisionCount}/${total}`;
  document.getElementById("practice-count").textContent = `${practiceCount}/${total}`;
  document.getElementById("completed-count").textContent = `${completedCount}/${total}`;
}

// Handle checkbox change
function handleCheckboxChange(chapterIndex, type, isChecked) {
  const progress = getProgress(currentSubject);
  
  if (!progress[chapterIndex]) {
    progress[chapterIndex] = {};
  }
  
  progress[chapterIndex][type] = isChecked;
  saveProgress(currentSubject, progress);
  updateProgressCounts();
  
  // Highlight completed rows
  const row = chaptersBody.children[chapterIndex];
  const chapterProgress = progress[chapterIndex];
  if (chapterProgress.learning && chapterProgress.revision && chapterProgress.practice) {
    row.style.background = '#d4edda';
  } else {
    row.style.background = '';
  }
}

// Load chapters for selected subject
function loadChapters(subject) {
  currentSubject = subject;
  currentSubjectTitle.textContent = subject;
  
  const chapters = chaptersData[subject];
  const progress = getProgress(subject);
  
  chaptersBody.innerHTML = '';
  
  chapters.forEach((chapter, index) => {
    const chapterProgress = progress[index] || {};
    const isCompleted = chapterProgress.learning && chapterProgress.revision && chapterProgress.practice;
    
    const row = document.createElement('tr');
    if (isCompleted) {
      row.style.background = '#d4edda';
    }
    
    row.innerHTML = `
      <td>${chapter}</td>
      <td class="checkbox-cell">
        <input type="checkbox" class="custom-checkbox" 
               data-index="${index}" data-type="learning"
               ${chapterProgress.learning ? 'checked' : ''}>
      </td>
      <td class="checkbox-cell">
        <input type="checkbox" class="custom-checkbox" 
               data-index="${index}" data-type="revision"
               ${chapterProgress.revision ? 'checked' : ''}>
      </td>
      <td class="checkbox-cell">
        <input type="checkbox" class="custom-checkbox" 
               data-index="${index}" data-type="practice"
               ${chapterProgress.practice ? 'checked' : ''}>
      </td>
    `;
    
    chaptersBody.appendChild(row);
  });
  
  // Add event listeners to checkboxes
  const checkboxes = chaptersBody.querySelectorAll('.custom-checkbox');
  checkboxes.forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const index = parseInt(e.target.dataset.index);
      const type = e.target.dataset.type;
      handleCheckboxChange(index, type, e.target.checked);
    });
  });
  
  updateProgressCounts();
  
  subjectSelection.classList.add('hidden');
  plannerArea.classList.remove('hidden');
}

// Subject button click handlers
subjectButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const subject = btn.dataset.subject;
    loadChapters(subject);
  });
});

// Back button handler
backBtn.addEventListener('click', () => {
  plannerArea.classList.add('hidden');
  subjectSelection.classList.remove('hidden');
  currentSubject = null;
});

// Clear all progress handler
clearAllBtn.addEventListener('click', () => {
  if (confirm(`Are you sure you want to clear all progress for ${currentSubject}? This cannot be undone.`)) {
    localStorage.removeItem(`planner_${currentSubject}`);
    loadChapters(currentSubject);
  }
});

// Export progress handler
exportBtn.addEventListener('click', () => {
  const progress = getProgress(currentSubject);
  const chapters = chaptersData[currentSubject];
  
  let text = `${currentSubject} - Study Progress\n`;
  text += `Generated on: ${new Date().toLocaleDateString()}\n\n`;
  
  chapters.forEach((chapter, index) => {
    const chapterProgress = progress[index] || {};
    const learning = chapterProgress.learning ? '✓' : '✗';
    const revision = chapterProgress.revision ? '✓' : '✗';
    const practice = chapterProgress.practice ? '✓' : '✗';
    
    text += `${index + 1}. ${chapter}\n`;
    text += `   Learning: ${learning}  Revision: ${revision}  Practice: ${practice}\n\n`;
  });
  
  // Create download
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${currentSubject}_Progress.txt`;
  a.click();
  URL.revokeObjectURL(url);
});
