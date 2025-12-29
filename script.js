// ========================================
// Java MCQ Quiz - Script
// ========================================

// State
let quiz = [];
let currentQuestion = 0;
let score = 0;
let responses = [];
let playerName = '';
let quizEndTime = null;
let currentSelection = null;
let timerInterval;
let timeLeft;

// Constants
const API_URL = getApiUrl('/api/results');
const QUESTIONS_URL = getApiUrl('/api/questions');
const STATE_KEY = 'quizState';
let supabaseClient = null;

// Initialize Supabase if available
if (typeof createClient !== 'undefined' && typeof SUPABASE_URL !== 'undefined') {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// DOM Elements
const screens = {
    start: document.getElementById('startScreen'),
    dashboard: document.getElementById('dashboardScreen'),
    quiz: document.getElementById('quizScreen'),
    result: document.getElementById('resultScreen'),
    review: document.getElementById('reviewScreen')
};

const elements = {
    loginBtn: document.getElementById('loginBtn'),
    header: document.querySelector('.nav-header'),
    optionsContainer: document.getElementById('options'),
    totalQuestions: document.getElementById('totalQuestions'),
    totalAttempts: document.getElementById('totalAttempts'),
    highScore: document.getElementById('highScore'),
    progressBar: document.getElementById('progressBar'),
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
    backToResultBtn: document.getElementById('backToResultBtn'),
    currentQuestionNum: document.getElementById('currentQuestionNum'),
    totalQuestionCount: document.getElementById('totalQuestionCount')
};

// --- State Management ---

function saveState() {
    const state = {
        quiz,
        currentQuestion,
        score,
        responses,
        playerName,
        quizEndTime,
        currentSelection,
        inProgress: true
    };
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

function loadState() {
    try {
        const saved = localStorage.getItem(STATE_KEY);
        return saved ? JSON.parse(saved) : null;
    } catch (e) {
        console.error('Could not load saved state', e);
        return null;
    }
}

function clearState() {
    localStorage.removeItem(STATE_KEY);
}

// --- Screen Management ---

function showScreen(screenName) {
    Object.values(screens).forEach(s => s.style.display = 'none');
    if (screens[screenName]) screens[screenName].style.display = 'block';

    // Header Logic
    if (screenName === 'quiz' || screenName === 'review') {
        elements.header.style.display = 'flex';
    } else {
        elements.header.style.display = 'none';
    }
}

// --- Utils ---

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// --- Auth Functions ---


// Duplicates removed

async function handleStudentLogin() {
    const rollno = document.getElementById('rollno').value.trim();
    const password = document.getElementById('studentPassword').value.trim();
    const errorEl = document.getElementById('loginError');

    if (!rollno || !password) {
        errorEl.textContent = 'Please enter Roll No and Password';
        errorEl.style.display = 'block';
        return;
    }

    try {
        const response = await fetch(getApiUrl('/api/student/login'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rollno, password })
        });

        const data = await response.json();
        if (data.success) {
            sessionStorage.setItem('studentProfile', JSON.stringify(data.student));
            handleAuthChange(data.student);
        } else {
            errorEl.textContent = data.message;
            errorEl.style.display = 'block';
        }
    } catch (e) {
        errorEl.textContent = 'Login failed';
        errorEl.style.display = 'block';
    }
}

async function loadDashboard(student) {
    if (!student) return;

    // Update Profile
    document.getElementById('dashName').textContent = student.name;
    document.getElementById('dashRoll').textContent = `Roll: ${student.rollno}`;
    document.getElementById('dashAvatar').src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(student.name);

    // Fetch Stats
    try {
        const response = await fetch(getApiUrl(`/api/student/results?rollno=${student.rollno}`));
        const results = await response.json();

        // Stats
        const attempts = results.length;
        // const totalScore = results.reduce((acc, r) => acc + r.score, 0); 
        const avgPct = attempts ? results.reduce((acc, r) => acc + parseFloat(r.percentage), 0) / attempts : 0;
        const bestPct = attempts ? Math.max(...results.map(r => parseFloat(r.percentage))) : 0;

        document.getElementById('dashTotal').textContent = attempts;
        document.getElementById('dashAvg').textContent = Math.round(avgPct) + '%';
        document.getElementById('dashBest').textContent = Math.round(bestPct) + '%';

        // History Table
        const list = document.getElementById('historyList');
        if (attempts === 0) {
            list.innerHTML = '<div style="color: var(--text-muted);">No attempts yet.</div>';
        } else {
            list.innerHTML = results.slice(0, 10).map(r => `
                <div class="result-item" style="padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px; display: flex; justify-content: space-between;">
                     <div>
                         <div style="font-weight: 500; margin-bottom: 0.25rem;">${r.date}</div>
                         <div style="font-size: 0.8rem; color: var(--text-muted);">Time: ${r.time}</div>
                     </div>
                     <div style="font-weight: bold; color: var(--primary); font-size: 1.1rem;">
                         ${r.percentage}%
                     </div>
                </div>
            `).join('');
        }
    } catch (e) {
        console.error('Failed to load dashboard', e);
    }
}

async function handleLogout() {
    sessionStorage.removeItem('studentProfile');
    window.location.reload();
}

function handleAuthChange(student) {
    const loginSection = document.getElementById('loginSection');

    if (student) {
        // Logged In -> Show Dashboard
        playerName = student.name;

        // Hide login, show dashboard
        screens.start.style.display = 'none';
        loginSection.style.display = 'none';

        loadDashboard(student);
        showScreen('dashboard');
    } else {
        // Logged Out -> Show Login
        playerName = '';
        showScreen('start');
        loginSection.style.display = 'block';
    }
}

// --- Timer Logic ---

async function startGlobalTimer() {
    clearInterval(timerInterval);

    // If no end time set (new quiz), fetch duration
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

        quizEndTime = Date.now() + (durationMinutes * 60 * 1000);
        saveState();
    }

    if (elements.timer) elements.timer.style.display = 'inline-flex';
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

    // Visual cues
    if (timeLeft <= 30) {
        elements.timer.style.color = 'var(--danger)';
    } else if (timeLeft <= 60) {
        elements.timer.style.color = 'var(--warning)';
    } else {
        elements.timer.style.color = 'var(--primary)';
    }
}

function handleTimeout() {
    clearInterval(timerInterval);
    alert("Time's up! Submitting quiz...");
    clearState();
    showResults();
}

// --- Quiz Logic ---

async function loadQuestions() {
    try {
        const response = await fetch(QUESTIONS_URL);
        if (response.ok) {
            quiz = await response.json();
            elements.totalQuestions.textContent = quiz.length;
        }
    } catch (e) {
        console.log('Using default questions');
        quiz = getDefaultQuestions();
    }

    if (!quiz || quiz.length === 0) {
        quiz = getDefaultQuestions();
    }
}

function getDefaultQuestions() {
    return [
        { question: "Which keyword is used to create a class in Java?", options: { A: "class", B: "new", C: "object", D: "create" }, answer: "A" },
        { question: "What is the entry point method of a Java program?", options: { A: "start()", B: "run()", C: "main()", D: "init()" }, answer: "C" },
        { question: "What is the size of int in Java (in bits)?", options: { A: "8", B: "16", C: "32", D: "64" }, answer: "C" },
        { question: "Which is NOT a primitive data type in Java?", options: { A: "int", B: "float", C: "String", D: "boolean" }, answer: "C" },
        { question: "Which keyword creates an object in Java?", options: { A: "class", B: "new", C: "this", D: "object" }, answer: "B" }
    ];
}

async function loadStats() {
    try {
        const response = await fetch(API_URL);
        if (response.ok) {
            const data = await response.json();
            elements.totalAttempts.textContent = data.statistics.totalAttempts || 0;
            elements.highScore.textContent = data.statistics.highestScore || 0;
        }
    } catch (e) {
        console.log('Could not load stats');
    }
}

function updateProgress() {
    const progress = ((currentQuestion + 1) / quiz.length) * 100;
    elements.progressBar.style.width = progress + '%';

    if (elements.currentQuestionNum) elements.currentQuestionNum.textContent = currentQuestion + 1;
    if (elements.totalQuestionCount) elements.totalQuestionCount.textContent = quiz.length;
}

function loadQuestion() {
    const q = quiz[currentQuestion];
    elements.questionText.textContent = q.question;
    elements.questionText.style.opacity = '1';

    // Reset options
    const optionBtns = elements.optionsContainer.querySelectorAll('.option-btn');

    // Check if already answered in this session
    const answered = responses[currentQuestion];

    optionBtns.forEach(btn => {
        const option = btn.dataset.option;
        btn.querySelector('.option-text').textContent = q.options[option];

        // Remove old classes
        btn.classList.remove('selected', 'correct', 'wrong');

        if (answered) {
            // Restore state
            if (option === answered.selected) btn.classList.add('selected');
            btn.disabled = true;
        } else {
            // New state
            btn.disabled = false;
        }
    });

    if (answered) {
        currentSelection = answered.selected;
        elements.nextBtn.style.display = 'inline-flex';
    } else {
        currentSelection = null;
        elements.nextBtn.style.display = 'none';
    }

    updateProgress();
    elements.prevBtn.style.visibility = currentQuestion > 0 ? 'visible' : 'hidden';
}

function handleOptionClick(e) {
    const btn = e.currentTarget;
    const selectedOption = btn.dataset.option;

    if (currentSelection === selectedOption) return;

    currentSelection = selectedOption;

    // UI Update
    const optionBtns = elements.optionsContainer.querySelectorAll('.option-btn');
    optionBtns.forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');

    elements.nextBtn.style.display = 'inline-flex';
}

function handlePrevClick() {
    if (currentQuestion > 0) {
        currentQuestion--;
        loadQuestion();
    }
}

function handleNextClick() {
    const q = quiz[currentQuestion];

    // Save response
    responses[currentQuestion] = {
        question: q.question,
        options: q.options,
        selected: currentSelection,
        correctAnswer: q.answer,
        isCorrect: currentSelection === q.answer
    };

    // Calculate score
    score = responses.reduce((acc, curr) => acc + (curr && curr.isCorrect ? 1 : 0), 0);

    currentQuestion++;
    saveState();

    if (currentQuestion < quiz.length) {
        elements.questionText.style.opacity = '0';
        setTimeout(() => {
            loadQuestion();
            elements.questionText.style.opacity = '1';
        }, 200);
    } else {
        clearInterval(timerInterval);
        clearState();
        showResults();
    }
}

async function showResults() {
    const percentage = Math.round((score / quiz.length) * 100);

    elements.finalScore.textContent = score;
    elements.scoreTotal.textContent = '/' + quiz.length;
    elements.scorePercent.textContent = percentage + '%';

    // Result Message
    if (percentage >= 80) {
        elements.resultTitle.textContent = 'Excellent!';
        elements.resultMessage.textContent = "Outstanding performance! You're a Java expert!";
        elements.scorePercent.style.color = 'var(--success)';
    } else if (percentage >= 60) {
        elements.resultTitle.textContent = 'Good Job!';
        elements.resultMessage.textContent = 'Great effort! Keep practicing.';
        elements.scorePercent.style.color = 'var(--primary)';
    } else if (percentage >= 40) {
        elements.resultTitle.textContent = 'Keep Trying!';
        elements.resultMessage.textContent = "You're making progress.";
        elements.scorePercent.style.color = 'var(--warning)';
    } else {
        elements.resultTitle.textContent = 'Study More!';
        elements.resultMessage.textContent = 'Review Java basics and try again.';
        elements.scorePercent.style.color = 'var(--danger)';
    }

    const result = {
        name: playerName || 'Anonymous',
        score: score,
        total: quiz.length,
        percentage: percentage,
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString()
    };

    await saveResultToServer(result);
    showScreen('result');
}

async function saveResultToServer(result) {
    try {
        await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(result)
        });
    } catch (e) {
        console.error('Failed to save result', e);
    }
}

function showReview() {
    elements.reviewList.innerHTML = '';

    responses.forEach((r, i) => {
        if (!r) return;
        const item = document.createElement('div');
        item.style.background = 'var(--background)';
        item.style.padding = '1rem';
        item.style.borderRadius = 'var(--radius)';
        item.style.marginBottom = '1rem';
        item.style.borderLeft = r.isCorrect ? '4px solid var(--success)' : '4px solid var(--danger)';

        let optionsHtml = '';
        for (let key in r.options) {
            let style = 'padding: 0.5rem; margin-top: 0.25rem; border-radius: 0.25rem; font-size: 0.9rem;';
            let marker = '';

            if (key === r.correctAnswer) {
                style += ' background: #ECFDF5; color: #047857; font-weight: 500;';
                marker = ' ✓';
            } else if (key === r.selected && !r.isCorrect) {
                style += ' background: #FEF2F2; color: #B91C1C;';
                marker = ' ✗';
            } else {
                style += ' background: white; border: 1px solid var(--border);';
            }

            optionsHtml += `<div style="${style}">${key}. ${r.options[key]}${marker}</div>`;
        }

        item.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 0.5rem;">Q${i + 1}: ${r.question}</div>
            <div>${optionsHtml}</div>
        `;

        elements.reviewList.appendChild(item);
    });

    showScreen('review');
}

function startQuiz() {
    // If authenticated, use that name. If not (fallback), uses 'Anonymous'
    if (!playerName && supabaseClient) {
        // Should not happen if button hidden/shown correctly
        alert('Please login first');
        return;
    }

    currentQuestion = 0;
    score = 0;
    responses = [];
    currentSelection = null;
    quizEndTime = null;

    shuffle(quiz);
    loadQuestion();
    startGlobalTimer();
    saveState();
    showScreen('quiz');
}

// --- Event Listeners ---

// elements.startBtn.addEventListener('click', startQuiz); // Removed
elements.nextBtn.addEventListener('click', handleNextClick);
elements.prevBtn.addEventListener('click', handlePrevClick);
elements.reviewBtn.addEventListener('click', showReview);
elements.backToResultBtn.addEventListener('click', () => showScreen('result'));

elements.optionsContainer.querySelectorAll('.option-btn').forEach(btn => {
    btn.addEventListener('click', handleOptionClick);
});


// Removed obsolete playerNameInput listener


// --- Initialization ---

async function init() {
    await loadQuestions();
    await loadStats();

    // Setup Auth
    elements.loginBtn.onclick = handleStudentLogin;

    // Check session from storage
    const student = JSON.parse(sessionStorage.getItem('studentProfile') || 'null');
    if (student) {
        handleAuthChange(student);
    } else {
        handleAuthChange(null);
    }

    /*
    // Setup Auth Listeners (GitHub Auth - Deprecated for RollNo)
    if (supabaseClient) {
        // elements.loginBtn.onclick = signInWithGithub;
        
        // Check session
        const { data: { session } } = await supabaseClient.auth.getSession();
        handleAuthChange(session);

        supabaseClient.auth.onAuthStateChange((_event, session) => {
            handleAuthChange(session);
        });
    }
    */

    const savedState = loadState();
    if (savedState && savedState.inProgress && savedState.quiz && savedState.quiz.length > 0) {
        // Restore
        quiz = savedState.quiz;
        currentQuestion = savedState.currentQuestion;
        score = savedState.score;
        responses = savedState.responses || [];
        playerName = savedState.playerName || 'Anonymous';
        currentSelection = savedState.currentSelection || null;
        quizEndTime = savedState.quizEndTime;

        loadQuestion();
        showScreen('quiz');
        if (quizEndTime) startGlobalTimer();
        console.log('✅ Restored quiz progress');
    } else {
        showScreen('start');
    }
}

init();
