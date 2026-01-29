// ========================================
// Java MCQ Quiz - Enhanced Script
// ========================================

// State
let quiz = [];
let currentQuestion = 0;
let score = 0;
let responses = [];
let playerName = '';
let quizEndTime = null; // Target end time for global timer

// Timer Settings
const TIME_PER_QUESTION = 30;
let timerInterval;
let timeLeft;

// API URLs - uses config.js for base URL
const API_URL = getApiUrl('/api/results');
const QUESTIONS_URL = getApiUrl('/api/questions');
const STATE_KEY = 'quizState';

// Save state to localStorage
function saveState() {
    const state = {
        quiz: quiz,
        currentQuestion: currentQuestion,
        score: score,
        responses: responses,
        playerName: playerName,
        quizEndTime: quizEndTime, // Save end time
        currentSelection: currentSelection,
        inProgress: true
    };
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

// Load state from localStorage
function loadState() {
    try {
        const saved = localStorage.getItem(STATE_KEY);
        if (saved) {
            return JSON.parse(saved);
        }
    } catch (e) {
        console.log('Could not load saved state');
    }
    return null;
}

// Avatar Upload Logic
async function uploadAvatar(input) {
    const file = input.files[0];
    if (!file) return;

    if (file.size > 500000) { // Limit to ~500KB
        alert('File is too large. Please select an image under 500KB.');
        return;
    }

    const reader = new FileReader();
    reader.onload = async function (e) {
        const base64Image = e.target.result;

        // Update UI immediately
        const avatarEl = document.getElementById('userAvatar');
        if (avatarEl) {
            avatarEl.innerHTML = `<img src="${base64Image}" style="width: 100%; height: 100%; object-fit: cover;">`;
            avatarEl.style.background = 'transparent'; // Remove gradient
        }

        // Send to backend
        const rollNumber = sessionStorage.getItem('rollNumber');
        if (rollNumber && rollNumber !== 'N/A') {
            try {
                await fetch(getApiUrl('/api/student/update'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ rollNumber, avatar: base64Image })
                });
                // Update session storage if needed, or just rely on profile Load
                // Ideally we reload profile data on init
            } catch (err) {
                console.error('Failed to upload avatar', err);
            }
        }
    };
    reader.readAsDataURL(file);
}

// Clear saved state
function clearState() {
    localStorage.removeItem(STATE_KEY);
}

// Dark Mode Logic
function initDarkMode() {
    const isDark = localStorage.getItem('darkMode') === 'true';
    if (isDark) {
        document.body.classList.add('dark-mode');
        updateDarkModeIcon(true);
    }
}

function toggleDarkMode() {
    const body = document.body;
    body.classList.toggle('dark-mode');
    const isDark = body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDark);
    updateDarkModeIcon(isDark);
}

function updateDarkModeIcon(isDark) {
    const btn = document.getElementById('darkModeToggle');
    if (btn) {
        btn.innerHTML = isDark ? '☀️' : '🌙';
        btn.style.color = isDark ? '#fbbf24' : '#6b7280'; // Yellow sun, gray moon
    }
}

// Helper to set element styles dynamically if needed
function applyTheme() {
    // If we rely purely on CSS vars, this might be empty, 
    // but useful if we need to force update some inline styles.
}

// Initialize on load
document.addEventListener('DOMContentLoaded', initDarkMode);

// DOM Elements
const screens = {
    start: document.getElementById('startScreen'),
    dashboard: document.getElementById('dashboardScreen'),
    quiz: document.getElementById('quizScreen'),
    result: document.getElementById('resultScreen'),
    review: document.getElementById('reviewScreen')
};

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const username = document.getElementById('username')?.value;
            const rollNumber = document.getElementById('rollNumber')?.value;
            const password = document.getElementById('password')?.value;
            const btn = document.getElementById('loginBtn');

            // UI Feedback
            const originalText = btn.innerText;
            btn.innerText = 'Verifying...';
            btn.disabled = true;

            try {
                const response = await fetch(getApiUrl('/api/student/login'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, rollNumber, password })
                });
                const data = await response.json();

                if (data.success) {
                    playerName = data.student.name;
                    const rollNo = data.student.rollNumber || 'N/A';

                    // Clean up existing state for a fresh start
                    clearState();

                    // Save session info
                    sessionStorage.setItem('username', data.student.name || data.student.username);
                    sessionStorage.setItem('rollNumber', data.student.rollNumber || 'N/A');

                    // Also save object for other uses
                    const session = {
                        name: data.student.name,
                        rollNo: data.student.rollNumber,
                        loggedIn: true
                    };
                    localStorage.setItem('studentSession', JSON.stringify(session));

                    // Redirect to student dashboard
                    window.location.href = 'student.html';
                } else {
                    alert(data.message || 'Login failed');
                }
            } catch (e) {
                console.error('Login error:', e);
                alert('Login error. Check console.');
            } finally {
                if (btn) {
                    btn.innerText = originalText;
                    btn.disabled = false;
                }
            }
        });
    }
});

const elements = {
    // startBtn removed
    totalQuestions: document.getElementById('totalQuestions'),
    totalAttempts: document.getElementById('totalAttempts'),
    highScore: document.getElementById('highScore'),
    progressBar: document.getElementById('progressBar'),
    quizProgressText: document.getElementById('quizProgressText'),
    currentScore: document.getElementById('currentScore'),
    questionText: document.getElementById('questionText'),
    optionsContainer: document.getElementById('optionsContainer'),
    prevBtn: document.getElementById('prevBtn'),
    nextBtn: document.getElementById('nextBtn'),
    resultIcon: document.getElementById('resultIcon'),
    resultTitle: document.getElementById('resultTitle'),
    finalScore: document.getElementById('finalScore'),
    scoreTotal: document.getElementById('scoreTotal'),
    scorePercent: document.getElementById('scorePercent'),
    resultMessage: document.getElementById('resultMessage'),
    reviewBtn: document.getElementById('reviewBtn'),
    timer: document.getElementById('timer'),

    reviewList: document.getElementById('reviewList'),
    backToResultBtn: document.getElementById('backToResultBtn')
};

// Screen Management
function showScreen(screenName) {
    if (!screens[screenName]) return; // Guard clause
    Object.values(screens).forEach(s => {
        if (s) s.classList.remove('active');
    });
    screens[screenName].classList.add('active');
}

// Shuffle Array
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Timer Functions - Global
async function startGlobalTimer() {
    clearInterval(timerInterval);

    // If no end time set (new quiz), fetch duration and set it
    if (!quizEndTime) {
        let durationMinutes = 10;
        try {
            const response = await fetch(getApiUrl('/api/settings'));
            if (response.ok) {
                const data = await response.json();
                durationMinutes = data.duration || 10;
            }
        } catch (e) {
            console.log('Using default duration');
        }

        // Set target end time
        quizEndTime = Date.now() + (durationMinutes * 60 * 1000);
        saveState(); // Save immediately so reload works
    }

    if (elements.timer) elements.timer.style.display = 'flex';

    // Initial display update
    updateTimerLogic();

    timerInterval = setInterval(updateTimerLogic, 1000);
}

function updateTimerLogic() {
    const now = Date.now();
    const diff = Math.ceil((quizEndTime - now) / 1000);

    timeLeft = diff > 0 ? diff : 0;

    updateTimerDisplay();

    if (timeLeft <= 0) {
        handleTimeout();
    }
}

function updateTimerDisplay() {
    if (!elements.timer) return;

    const m = Math.floor(timeLeft / 60);
    const s = timeLeft % 60;
    elements.timer.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

    // Visual styling
    elements.timer.classList.remove('warning', 'danger');
    if (timeLeft <= 60) elements.timer.classList.add('warning'); // Last minute
    if (timeLeft <= 30) elements.timer.classList.add('danger');  // Last 30s
}

function handleTimeout() {
    clearInterval(timerInterval);
    alert("Time's up! Submitting quiz...");
    // Finish quiz immediately
    clearState();
    showResults();
}

// Load Questions from Server
async function loadQuestions() {
    try {
        const response = await fetch(QUESTIONS_URL);
        if (response.ok) {
            quiz = await response.json();
            if (elements.totalQuestions) elements.totalQuestions.textContent = quiz.length;
        }
    } catch (e) {
        console.log('Using default questions');
        quiz = getDefaultQuestions();
    }

    if (quiz.length === 0) {
        quiz = getDefaultQuestions();
    }
}

// ... (skipping defaultQuestions)

// Load Stats from Server
async function loadStats() {
    try {
        const response = await fetch(API_URL);
        if (response.ok) {
            const data = await response.json();
            if (elements.totalAttempts) elements.totalAttempts.textContent = data.statistics.totalAttempts;
            if (elements.highScore) elements.highScore.textContent = data.statistics.highestScore;
        }
    } catch (e) {
        console.log('Could not load stats');
    }
}

// Save Result to Server
async function saveResult(result) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(result)
        });

        if (response.ok) {
            console.log('Result saved successfully');
            // Reload stats and history if on dashboard
            loadStats();
        } else {
            console.error('Failed to save result');
        }
    } catch (e) {
        console.error('Error saving result:', e);
    }
}

// Load Student History
async function loadStudentHistory() {
    const listContainer = document.querySelector('.card:nth-child(2) > div');
    // ^ Targeting "Recent Quiz Activity" container. 
    // In student.html, it's the second card in the left column.
    // The specific div has "No quiz attempts yet." text initially.

    if (!listContainer) return;

    try {
        const response = await fetch(API_URL);
        if (response.ok) {
            const data = await response.json();
            const myResults = data.results.filter(r => r.name === playerName).reverse(); // Newest first

            if (myResults.length > 0) {
                listContainer.style.display = 'block';
                listContainer.style.height = 'auto';
                listContainer.innerHTML = myResults.map(r => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 15px; border-bottom: 1px solid #f3f4f6;">
                        <div>
                            <div style="font-weight: 600; color: #1f2937;">Java MCQ Quiz</div>
                            <div style="font-size: 0.85rem; color: #6b7280;">${new Date(r.timestamp || Date.now()).toLocaleDateString()} • ${r.score}/${r.total}</div>
                        </div>
                        <div style="font-weight: 700; color: ${r.percentage >= 60 ? '#10b981' : '#f59e0b'};">
                            ${r.percentage}%
                        </div>
                    </div>
                `).join('');

                // Add a "View All" link if many results? Maybe later.
            } else {
                listContainer.innerHTML = 'No quiz attempts yet.';
                listContainer.style.display = 'flex';
                listContainer.style.alignItems = 'center';
                listContainer.style.justifyContent = 'center';
                listContainer.style.height = '100px';
                listContainer.style.color = '#9ca3af';
            }
        }
    } catch (e) {
        console.error('Error loading history:', e);
    }
}

// Update Progress
function updateProgress() {
    const progress = ((currentQuestion + 1) / quiz.length) * 100;
    if (elements.progressBar) elements.progressBar.style.width = progress + '%';

    if (elements.quizProgressText) {
        elements.quizProgressText.textContent = `Question ${currentQuestion + 1} of ${quiz.length}`;
    }
}

// Update Score Display (only if element exists)
function updateScoreDisplay() {
    if (elements.currentScore) {
        elements.currentScore.textContent = score;
    }
}

// Load Question
function loadQuestion() {
    const q = quiz[currentQuestion];
    elements.questionText.textContent = q.question;
    elements.questionText.style.opacity = '1';

    // Check if already answered
    if (responses[currentQuestion]) {
        // Question completed - lock options (timer runs globally)
        // No timer manipulation here

        // Restore selection and lock options
        currentSelection = responses[currentQuestion].selected;

        const optionBtns = elements.optionsContainer.querySelectorAll('.option-btn');
        optionBtns.forEach(btn => {
            const option = btn.dataset.option;
            btn.querySelector('.option-text').textContent = q.options[option];

            // Reset classes
            btn.classList.remove('selected', 'correct', 'wrong');

            // Highlight selected
            if (option === currentSelection) {
                btn.classList.add('selected');
            }

            // Disable button
            btn.disabled = true;
        });

        // Show next button
        elements.nextBtn.style.display = 'inline-flex';
    } else {
        // New question
        // Global timer continues running...

        // Update options normally
        const optionBtns = elements.optionsContainer.querySelectorAll('.option-btn');
        optionBtns.forEach(btn => {
            const option = btn.dataset.option;
            btn.querySelector('.option-text').textContent = q.options[option];
            btn.classList.remove('selected', 'correct', 'wrong');
            btn.disabled = false;
        });

        currentSelection = null;
        elements.nextBtn.style.display = 'none';

        // Ensure timer is visible
        if (elements.timer) elements.timer.style.display = 'flex';
    }

    updateProgress();
    elements.prevBtn.style.display = currentQuestion > 0 ? 'inline-flex' : 'none';

    // Update Next Button text/style for last question
    if (currentQuestion === quiz.length - 1) {
        elements.nextBtn.innerHTML = 'Submit Quiz <span class="btn-icon">✓</span>';
        elements.nextBtn.classList.remove('btn-secondary');
        elements.nextBtn.classList.add('btn-primary');
    } else {
        elements.nextBtn.innerHTML = 'Next Question <span class="btn-icon">→</span>';
        elements.nextBtn.classList.add('btn-secondary');
        elements.nextBtn.classList.remove('btn-primary');
    }
}

// Handle Option Click - allows changing answer
let currentSelection = null;

function handleOptionClick(e) {
    const btn = e.currentTarget;
    const selectedOption = btn.dataset.option;
    const q = quiz[currentQuestion];

    // If clicking same option, do nothing
    if (currentSelection === selectedOption) return;

    // Update selection
    currentSelection = selectedOption;

    // Highlight selected
    const optionBtns = elements.optionsContainer.querySelectorAll('.option-btn');
    optionBtns.forEach(b => {
        b.classList.remove('selected');
    });
    btn.classList.add('selected');

    // Show next button
    elements.nextBtn.style.display = 'inline-flex';
}

// Handle Next Click
// Handle Previous Click
function handlePrevClick() {
    if (currentQuestion > 0) {
        currentQuestion--;
        loadQuestion();
    }
}

// Calculate Score from Responses
function calculateScore() {
    score = responses.reduce((acc, curr) => acc + (curr && curr.isCorrect ? 1 : 0), 0);
    updateScoreDisplay();
}

// Handle Next Click
// Handle Next Click
function handleNextClick() {
    // Store the response at current index
    const q = quiz[currentQuestion];
    responses[currentQuestion] = {
        question: q.question,
        options: q.options,
        selected: currentSelection,
        correctAnswer: q.answer,
        isCorrect: currentSelection === q.answer
    };

    // Only increment score if this is a new answer or changed result
    calculateScore();

    currentQuestion++;

    // Save progress
    saveState();

    if (currentQuestion < quiz.length) {
        // Animate question transition
        elements.questionText.style.opacity = '0';
        setTimeout(() => {
            loadQuestion();
            elements.questionText.style.opacity = '1';
        }, 200);
    } else {
        // Quiz complete
        clearInterval(timerInterval); // Stop global timer
        clearState();
        showResults();
    }
}

// Show Results
async function showResults() {
    const percentage = Math.round((score / quiz.length) * 100);

    // Update result display
    elements.finalScore.textContent = score;
    elements.scoreTotal.textContent = '/' + quiz.length;
    elements.scorePercent.textContent = percentage + '%';

    // Set icon and message based on score
    if (percentage >= 80) {
        elements.resultIcon.textContent = '🏆';
        elements.resultTitle.textContent = 'Excellent!';
        elements.resultMessage.textContent = "Outstanding performance! You're a Java expert!";
        elements.scorePercent.style.color = '#10b981';
    } else if (percentage >= 60) {
        elements.resultIcon.textContent = '🎉';
        elements.resultTitle.textContent = 'Good Job!';
        elements.resultMessage.textContent = 'Great effort! Keep practicing to master Java.';
        elements.scorePercent.style.color = '#06b6d4';
    } else if (percentage >= 40) {
        elements.resultIcon.textContent = '💪';
        elements.resultTitle.textContent = 'Keep Trying!';
        elements.resultMessage.textContent = "You're making progress. Review and try again!";
        elements.scorePercent.style.color = '#f59e0b';
    } else {
        elements.resultIcon.textContent = '📚';
        elements.resultTitle.textContent = 'Study More!';
        elements.resultMessage.textContent = 'Review Java basics and try again. You got this!';
        elements.scorePercent.style.color = '#ef4444';
    }

    // Save result
    const result = {
        id: Date.now(),
        name: playerName || 'Anonymous',
        score: score,
        total: quiz.length,
        percentage: percentage,
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
        timestamp: new Date().toISOString(),
        responses: responses.map(r => ({
            question: r.question,
            yourAnswer: r.selected || 'Not answered',
            correctAnswer: r.correctAnswer,
            result: r.isCorrect ? 'Correct' : 'Wrong'
        }))
    };

    await saveResult(result);

    showScreen('result');
}

// Show Review
function showReview() {
    elements.reviewList.innerHTML = '';

    responses.forEach((r, i) => {
        if (!r) return; // Skip if empty (shouldn't happen)
        const item = document.createElement('div');
        item.className = 'review-item' + (r.isCorrect ? '' : ' wrong');

        let optionsHtml = '';
        for (let key in r.options) {
            let optionClass = 'review-option';
            let marker = '';

            if (key === r.correctAnswer) {
                optionClass += ' correct-answer';
                marker = ' ✓';
            }
            if (key === r.selected && !r.isCorrect) {
                optionClass += ' user-wrong';
                marker = ' ✗';
            }

            optionsHtml += `<div class="${optionClass}">${key}. ${r.options[key]}${marker}</div>`;
        }

        item.innerHTML = `
            <div class="review-question">Q${i + 1}: ${r.question}</div>
            <div class="review-options">${optionsHtml}</div>
        `;

        elements.reviewList.appendChild(item);
    });

    showScreen('review');
}

// Start Quiz
async function startQuiz() {
    // Check if quiz is loaded
    if (!quiz || quiz.length === 0) {
        // Try to load again
        await loadQuestions();
        if (!quiz || quiz.length === 0) {
            alert("No questions available! Please contact your administrator.");
            return;
        }
    }

    // playerName is already set by login
    currentQuestion = 0;
    score = 0;
    responses = [];
    currentSelection = null;
    quizEndTime = null; // Reset timer for new quiz

    shuffle(quiz);
    updateScoreDisplay();

    try {
        loadQuestion();
        startGlobalTimer(); // Start global timer
        saveState(); // Save initial state
        showScreen('quiz');
    } catch (e) {
        console.error("Error starting quiz:", e);
        alert("Error starting quiz. Please try again.");
    }
}

function exitQuiz() {
    if (confirm('Are you sure you want to exit? Progress will be lost.')) {
        clearState();
        if (typeof timerInterval !== 'undefined') clearInterval(timerInterval);
        showScreen('dashboard');
    }
}

// Event Listeners
// Start button listener removed - replaced by loginBtn specific listener
// Event Listeners
// Start button listener removed - replaced by loginBtn specific listener
if (elements.nextBtn) elements.nextBtn.addEventListener('click', handleNextClick);
if (elements.prevBtn) elements.prevBtn.addEventListener('click', handlePrevClick);
if (elements.reviewBtn) elements.reviewBtn.addEventListener('click', showReview);

if (elements.backToResultBtn) elements.backToResultBtn.addEventListener('click', () => showScreen('result'));

// Option buttons
if (elements.optionsContainer) {
    elements.optionsContainer.querySelectorAll('.option-btn').forEach(btn => {
        btn.addEventListener('click', handleOptionClick);
    });
}

// Enter key to start - Removed as playerNameInput doesn't exist
// elements.playerNameInput?.addEventListener('keypress', (e) => {
//     if (e.key === 'Enter') startQuiz();
// });

// Initialize
// Initialize
async function init() {
    // Check which page we are on
    const isStudentPage = window.location.pathname.includes('student.html');
    const isIndexPage = window.location.pathname.includes('index.html') || window.location.pathname.endsWith('/');

    if (isStudentPage) {
        // We are on the student dashboard/app

        // Check authentication
        const sessionWithStr = localStorage.getItem('studentSession');
        if (!sessionWithStr) {
            // Not logged in, redirect to login
            window.location.href = 'index.html';
            return;
        }

        const session = JSON.parse(sessionWithStr);
        playerName = session.name;

        // Initialize UI with session data
        if (document.getElementById('navProfileName')) document.getElementById('navProfileName').textContent = session.name;

        const initials = session.name.substring(0, 2).toUpperCase();
        const profileDiv = document.querySelector('.profile-dropdown div');
        if (profileDiv) profileDiv.textContent = initials;

        if (document.getElementById('dropdownName')) document.getElementById('dropdownName').textContent = session.name;
        if (document.getElementById('dropdownRoll')) document.getElementById('dropdownRoll').textContent = `Roll: ${session.rollNo}`;

        // Load app data
        await loadQuestions();
        await loadStats();
        await loadStudentHistory();

        // Check for saved quiz progress only
        const savedState = loadState();
        if (savedState && savedState.inProgress && savedState.quiz && savedState.quiz.length > 0) {
            // Restore saved state
            quiz = savedState.quiz;
            currentQuestion = savedState.currentQuestion;
            score = savedState.score;
            responses = savedState.responses || [];
            // playerName is already set from session
            currentSelection = savedState.currentSelection || null;
            quizEndTime = savedState.quizEndTime || null; // Restore end time

            // Resume quiz
            loadQuestion();
            showScreen('quiz');
            if (quizEndTime) {
                startGlobalTimer(); // Resume timer
            }
            console.log('✅ Restored quiz progress');
        } else {
            // Default to dashboard
            showScreen('dashboard');
        }

    } else if (isIndexPage) {
        // We are on the login page
        // Check if already logged in -> redirect to student
        const sessionWithStr = localStorage.getItem('studentSession');
        if (sessionWithStr) {
            try {
                const session = JSON.parse(sessionWithStr);
                if (session.loggedIn) {
                    window.location.href = 'student.html';
                    return;
                }
            } catch (e) {
                localStorage.removeItem('studentSession');
            }
        }

        // Ensure start screen is active
        if (screens.start) screens.start.classList.add('active');
    }
}

// Dashboard Functions
function switchDashboardTab(tabName) {
    // Update Nav Links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        link.style.borderBottom = 'none';
        link.style.color = '#6b7280';
        link.style.paddingBottom = '0';
    });

    // Find clicked link based on onclick attribute (simple approximation)
    const clickedLink = Array.from(document.querySelectorAll('.nav-link')).find(l => l.getAttribute('onclick')?.includes(tabName));
    if (clickedLink) {
        clickedLink.classList.add('active');
        clickedLink.style.borderBottom = '3px solid #6366f1';
        clickedLink.style.color = '#6366f1';
        clickedLink.style.paddingBottom = '24px';
    }

    // Toggle Content
    const dashboardTab = document.getElementById('dashboardTab');
    const myQuizzesTab = document.getElementById('myQuizzesTab');

    if (tabName === 'dashboard') {
        dashboardTab.style.display = 'block';
        myQuizzesTab.style.display = 'none';
    } else {
        dashboardTab.style.display = 'none';
        myQuizzesTab.style.display = 'block';
    }
}

function toggleProfileDropdown() {
    const menu = document.getElementById('profileDropdownMenu');
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
}

function logout() {
    playerName = "";
    localStorage.removeItem('studentSession');
    localStorage.removeItem(STATE_KEY); // Also clear quiz progress
    window.location.href = 'index.html';
}

// Close dropdown when clicking outside
window.addEventListener('click', (e) => {
    const dropdown = document.querySelector('.profile-dropdown');
    const menu = document.getElementById('profileDropdownMenu');
    if (dropdown && !dropdown.contains(e.target) && menu && menu.style.display === 'block') {
        menu.style.display = 'none';
    }
});

// Initialize
init();
