// ========================================
// LMS Script - Quiz Application
// ========================================

// State
let quiz = [];
let currentQuestion = 0;
let score = 0;
let responses = [];
let playerName = '';
let playerRollNo = '';
let quizEndTime = null;
let currentSelection = null;
let timerInterval;
let timeLeft;
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();

// Initialize Supabase
let supabaseClient = null;
if (typeof createClient !== 'undefined' && typeof SUPABASE_URL !== 'undefined') {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// ========== Page Navigation ==========

function showLmsPage(page) {
    // Hide all pages
    document.getElementById('dashboardPage').style.display = 'none';
    document.getElementById('coursesPage').style.display = 'none';
    document.getElementById('quizPage').style.display = 'none';
    document.getElementById('resultPage').style.display = 'none';
    document.getElementById('reviewPage').style.display = 'none';
    if (document.getElementById('profilePage')) document.getElementById('profilePage').style.display = 'none';
    if (document.getElementById('gradesPage')) document.getElementById('gradesPage').style.display = 'none';

    // Update nav
    document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));

    // Close dropdown
    document.getElementById('userDropdown').style.display = 'none';

    // Show selected page
    if (page === 'dashboard' || page === 'home') {
        document.getElementById('dashboardPage').style.display = 'block';
        document.getElementById('navDashboard').classList.add('active');
        loadTimeline();
    } else if (page === 'courses') {
        document.getElementById('coursesPage').style.display = 'block';
        document.getElementById('navCourses').classList.add('active');
        if (typeof loadAvailableTests === 'function') loadAvailableTests();
    } else if (page === 'quiz') {
        document.getElementById('quizPage').style.display = 'block';
    } else if (page === 'result') {
        document.getElementById('resultPage').style.display = 'block';
    } else if (page === 'review') {
        document.getElementById('reviewPage').style.display = 'block';
    } else if (page === 'profile') {
        document.getElementById('profilePage').style.display = 'block';
        loadProfile();
    } else if (page === 'grades') {
        document.getElementById('gradesPage').style.display = 'block';
        loadGrades();
    }
}

// ========== Auth ==========

async function handleStudentLogin(event) {
    if (event) event.preventDefault();

    const rollno = document.getElementById('rollno').value.trim();
    const password = document.getElementById('studentPassword').value.trim();
    const errorEl = document.getElementById('loginError');

    if (!rollno || !password) {
        errorEl.textContent = 'Please enter Username and Password';
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
            showMainApp(data.student);
        } else {
            errorEl.textContent = data.message || 'Invalid credentials';
            errorEl.style.display = 'block';
        }
    } catch (e) {
        errorEl.textContent = 'Login failed. Please try again.';
        errorEl.style.display = 'block';
    }
}

function showMainApp(student) {
    playerName = student.name;
    playerRollNo = student.rollno;

    // Update UI
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';

    // Update nav user info
    const initials = student.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    document.getElementById('userInitials').textContent = initials;
    document.getElementById('navUserName').textContent = student.name;

    // Load dashboard data
    loadDashboard(student);
    renderCalendar();
    showLmsPage('dashboard');
}

function handleLogout() {
    sessionStorage.removeItem('studentProfile');
    location.reload();
}

function toggleUserDropdown() {
    const dropdown = document.getElementById('userDropdown');
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';

    // Update dropdown info
    document.getElementById('dropdownName').textContent = playerName;
    document.getElementById('dropdownEmail').textContent = `Roll: ${playerRollNo}`;
}

function toggleNotifications() {
    alert('No new notifications');
}

function showPreferences() {
    alert('Preferences coming soon!');
    document.getElementById('userDropdown').style.display = 'none';
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('userDropdown');
    const userMenu = document.querySelector('.user-menu-container');
    if (dropdown && userMenu && !userMenu.contains(e.target)) {
        dropdown.style.display = 'none';
    }
});

// ========== Dashboard ==========

let allResults = [];

async function loadDashboard(student) {
    try {
        const response = await fetch(getApiUrl(`/api/student/results?rollno=${student.rollno}`));
        allResults = await response.json();

        // Update History
        renderHistory(allResults);

        // Update dropdown info
        if (document.getElementById('dropdownName')) {
            document.getElementById('dropdownName').textContent = student.name;
            document.getElementById('dropdownEmail').textContent = `Roll: ${student.rollno}`;
        }
    } catch (e) {
        console.error('Failed to load dashboard', e);
    }
}

function renderHistory(results) {
    const historyList = document.getElementById('historyList');
    if (results.length === 0) {
        historyList.innerHTML = '<p class="empty-state">No quiz attempts yet.</p>';
    } else {
        historyList.innerHTML = results.slice(0, 5).map(r => `
            <div class="course-item" style="cursor: default;">
                <div class="course-icon" style="background: ${parseFloat(r.percentage) >= 50 ? 'var(--lms-success)' : 'var(--lms-danger)'};">
                    ${parseFloat(r.percentage) >= 50 ? '✓' : '✗'}
                </div>
                <div class="course-info">
                    <h3>Java MCQ Quiz</h3>
                    <p>${r.date} at ${r.time} • Score: ${r.percentage}%</p>
                </div>
            </div>
        `).join('');
    }
}

// ========== Timeline ==========

function loadTimeline() {
    const timelineContent = document.getElementById('timelineContent');

    // Check if there are upcoming quizzes (for now, show available quiz)
    const hasQuiz = true; // Always show at least one quiz available

    if (hasQuiz) {
        timelineContent.innerHTML = `
            <div class="timeline-item">
                <div class="timeline-item-icon">☕</div>
                <div class="timeline-item-content">
                    <h4>Java MCQ Quiz</h4>
                    <p>Available now • Click "My Quizzes" to start</p>
                </div>
            </div>
        `;
    } else {
        timelineContent.innerHTML = `
            <div class="timeline-empty">
                <div class="timeline-empty-icon">📋</div>
                <p>No activities require action</p>
            </div>
        `;
    }
}

function filterTimeline() {
    // Get filter values
    const range = document.getElementById('timelineRange').value;
    const sort = document.getElementById('timelineSort').value;
    const search = document.getElementById('timelineSearch').value.toLowerCase();

    // For now, just show the quiz if search matches
    const timelineContent = document.getElementById('timelineContent');

    if (search && !('java mcq quiz'.includes(search))) {
        timelineContent.innerHTML = `
            <div class="timeline-empty">
                <div class="timeline-empty-icon">🔍</div>
                <p>No matching activities found</p>
            </div>
        `;
    } else {
        loadTimeline();
    }
}

// ========== Profile ==========

async function loadProfile() {
    const student = JSON.parse(sessionStorage.getItem('studentProfile') || '{}');

    // Update profile info
    const initials = (student.name || 'NA').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    document.getElementById('profileAvatar').textContent = initials;
    document.getElementById('profileName').textContent = student.name || 'Unknown';
    document.getElementById('profileRoll').textContent = `Roll Number: ${student.rollno || 'N/A'}`;

    // Calculate stats from results
    if (allResults.length === 0) {
        try {
            const response = await fetch(getApiUrl(`/api/student/results?rollno=${student.rollno}`));
            allResults = await response.json();
        } catch (e) {
            console.error('Failed to load results', e);
        }
    }

    const attempts = allResults.length;
    const avgPct = attempts ? allResults.reduce((acc, r) => acc + parseFloat(r.percentage), 0) / attempts : 0;
    const bestPct = attempts ? Math.max(...allResults.map(r => parseFloat(r.percentage))) : 0;

    document.getElementById('profileQuizzes').textContent = attempts;
    document.getElementById('profileAvgScore').textContent = Math.round(avgPct) + '%';
    document.getElementById('profileBestScore').textContent = Math.round(bestPct) + '%';
}

// ========== Grades ==========

async function loadGrades() {
    const student = JSON.parse(sessionStorage.getItem('studentProfile') || '{}');

    if (allResults.length === 0) {
        try {
            const response = await fetch(getApiUrl(`/api/student/results?rollno=${student.rollno}`));
            allResults = await response.json();
        } catch (e) {
            console.error('Failed to load results', e);
        }
    }

    const tbody = document.getElementById('gradesTableBody');

    if (allResults.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No grades available yet.</td></tr>';
    } else {
        tbody.innerHTML = allResults.map(r => {
            const pct = parseFloat(r.percentage);
            let grade, gradeClass;
            if (pct >= 90) { grade = 'A'; gradeClass = 'grade-a'; }
            else if (pct >= 80) { grade = 'B'; gradeClass = 'grade-b'; }
            else if (pct >= 70) { grade = 'C'; gradeClass = 'grade-c'; }
            else if (pct >= 60) { grade = 'D'; gradeClass = 'grade-d'; }
            else { grade = 'F'; gradeClass = 'grade-f'; }

            return `
                <tr>
                    <td>Java MCQ Quiz</td>
                    <td>${r.date}</td>
                    <td>${r.percentage}%</td>
                    <td><span class="grade-badge ${gradeClass}">${grade}</span></td>
                </tr>
            `;
        }).join('');
    }
}

// ========== Calendar ==========

function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    const title = document.getElementById('calendarTitle');

    const months = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    title.textContent = `${months[currentMonth]} ${currentYear}`;

    // Get first day of month and days in month
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();

    // Adjust for Monday start (0 = Monday, 6 = Sunday)
    let startDay = firstDay.getDay() - 1;
    if (startDay < 0) startDay = 6;

    // Build grid
    let html = days.map(d => `<div class="calendar-day-header">${d}</div>`).join('');

    // Previous month days
    const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = startDay - 1; i >= 0; i--) {
        html += `<div class="calendar-day other-month">${prevMonthDays - i}</div>`;
    }

    // Current month days
    const today = new Date();
    for (let i = 1; i <= daysInMonth; i++) {
        const isToday = (i === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear());
        html += `<div class="calendar-day ${isToday ? 'today' : ''}">${i}</div>`;
    }

    // Next month days
    const totalCells = Math.ceil((startDay + daysInMonth) / 7) * 7;
    const remaining = totalCells - startDay - daysInMonth;
    for (let i = 1; i <= remaining; i++) {
        html += `<div class="calendar-day other-month">${i}</div>`;
    }

    grid.innerHTML = html;
}

function changeMonth(delta) {
    currentMonth += delta;
    if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    } else if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    }
    renderCalendar();
}

// ========== Quiz Logic ==========

// ========== Courses / Tests ==========

let currentTestId = null;

async function loadAvailableTests() {
    const list = document.getElementById('coursesList');
    list.innerHTML = '<p class="empty-state">Loading available tests...</p>';

    try {
        const response = await fetch(getApiUrl('/api/tests'));
        const tests = await response.json();

        if (tests.length === 0) {
            list.innerHTML = '<p class="empty-state">No tests available at the moment.</p>';
            return;
        }

        list.innerHTML = tests.filter(t => t.is_active).map(t => `
            <div class="lms-card" style="cursor: pointer; transition: transform 0.2s;" onclick="startQuiz('${t.id}')">
                <div class="lms-card-body" style="display: flex; gap: 1rem; align-items: center;">
                    <div class="course-icon" style="background: var(--lms-primary); width: 50px; height: 50px; font-size: 1.5rem; display: flex; align-items: center; justify-content: center; border-radius: 8px; color: white;">
                        ☕
                    </div>
                    <div style="flex: 1;">
                        <h3 style="margin-bottom: 0.25rem;">${t.name}</h3>
                        <p style="color: var(--lms-text-muted); font-size: 0.9rem;">${t.description || 'Test your knowledge'}</p>
                        <div style="margin-top: 0.5rem; display: flex; gap: 1rem; font-size: 0.8rem; color: var(--lms-text-muted);">
                            <span>⏱️ ${t.duration} mins</span>
                            <span>📝 Questions</span>
                        </div>
                    </div>
                    <button class="lms-btn lms-btn-primary">Start</button>
                </div>
            </div>
        `).join('');
    } catch (e) {
        console.error('Failed to load tests', e);
        list.innerHTML = '<p class="empty-state" style="color: var(--lms-danger);">Failed to load tests. Please try again.</p>';
    }
}

// ========== Quiz Logic ==========

async function loadQuestions(testId = null) {
    try {
        const url = testId ? getApiUrl(`/api/questions?test_id=${testId}`) : getApiUrl('/api/questions');
        const response = await fetch(url);
        quiz = await response.json();
        const settings = await loadSettings(); // Fallback if test has no duration
        if (settings) {
            // Keep specialized test duration if passed in startQuiz
        }
        if (document.getElementById('testShuffle') && document.getElementById('testShuffle').checked) {
            shuffle(quiz);
        } else {
            shuffle(quiz); // Default shuffle
        }
    } catch (e) {
        console.error('Failed to load questions', e);
        quiz = [];
    }
}

async function loadSettings() {
    try {
        const response = await fetch(getApiUrl('/api/settings'));
        const settings = await response.json();
        return settings.duration || 10;
    } catch (e) {
        return 10;
    }
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

async function startQuiz(testId = null) {
    currentTestId = testId;

    // Show loading or preparing state

    let duration = 10;
    if (testId) {
        // Fetch specific test details to get duration
        try {
            // In a real app we might fetch the specific test, but for now we rely on the list or settings
            // Let's assume we load questions and get duration from the test object if we had it, 
            // but here we'll just load questions.
            // A better way is to pass duration into startQuiz, but let's stick to simple.
            // We'll refetch settings or use default.
        } catch (e) { }
    }

    await loadQuestions(testId);
    // Reload settings just in case or use test specific duration if we had it
    duration = await loadSettings();

    if (quiz.length === 0) {
        alert('No questions available for this test. Please contact admin.');
        return;
    }

    currentQuestion = 0;
    score = 0;
    responses = quiz.map(() => null);
    currentSelection = null;
    timeLeft = duration * 60;

    loadQuestion();
    startTimer();
    showLmsPage('quiz');
}

function loadQuestion() {
    const q = quiz[currentQuestion];
    document.getElementById('questionNumber').textContent = `Question ${currentQuestion + 1} of ${quiz.length}`;
    document.getElementById('questionText').textContent = q.question;

    // Update progress
    const progress = ((currentQuestion + 1) / quiz.length) * 100;
    document.getElementById('progressFill').style.width = progress + '%';

    // Render options
    const optionsContainer = document.getElementById('options');
    const options = q.options;
    optionsContainer.innerHTML = Object.entries(options).map(([key, value]) => `
        <button class="lms-btn option-btn ${responses[currentQuestion] === key ? 'selected' : ''}" 
                onclick="selectOption('${key}')"
                style="text-align: left; padding: 1rem; background: ${responses[currentQuestion] === key ? 'var(--lms-primary)' : '#f5f5f5'}; color: ${responses[currentQuestion] === key ? 'white' : 'inherit'}; border: 1px solid var(--lms-border);">
            <strong>${key}.</strong> ${value}
        </button>
    `).join('');

    // Update nav buttons
    document.getElementById('prevBtn').style.visibility = currentQuestion === 0 ? 'hidden' : 'visible';
    document.getElementById('nextBtn').textContent = currentQuestion === quiz.length - 1 ? 'Finish Quiz' : 'Next →';
}

function selectOption(key) {
    responses[currentQuestion] = key;
    loadQuestion();
}

function handleNextClick() {
    if (currentQuestion === quiz.length - 1) {
        finishQuiz();
    } else {
        currentQuestion++;
        loadQuestion();
    }
}

function handlePrevClick() {
    if (currentQuestion > 0) {
        currentQuestion--;
        loadQuestion();
    }
}

function startTimer() {
    clearInterval(timerInterval);
    updateTimerDisplay();

    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            finishQuiz();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;
    document.getElementById('timer').textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

async function finishQuiz() {
    clearInterval(timerInterval);

    // Calculate score
    score = 0;
    quiz.forEach((q, i) => {
        if (responses[i] === q.answer) score++;
    });

    const percentage = Math.round((score / quiz.length) * 100);

    // Update result UI
    document.getElementById('scoreDisplay').textContent = `${score}/${quiz.length}`;
    document.getElementById('percentageDisplay').textContent = `${percentage}%`;

    let message = '';
    if (percentage >= 80) message = 'Excellent work! You\'re a Java pro! 🏆';
    else if (percentage >= 60) message = 'Good job! Keep practicing! 👍';
    else if (percentage >= 40) message = 'Not bad, but there\'s room for improvement. 📚';
    else message = 'Keep studying and try again! 💪';
    document.getElementById('resultMessage').textContent = message;

    // Save result
    const now = new Date();
    const result = {
        name: playerName,
        roll_number: playerRollNo,
        score: score,
        total: quiz.length,
        percentage: percentage.toFixed(2),
        date: now.toISOString().split('T')[0],
        time: now.toTimeString().split(' ')[0]
    };

    try {
        await fetch(getApiUrl('/api/results'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(result)
        });
    } catch (e) {
        console.error('Failed to save result', e);
    }

    showLmsPage('result');
}

function showReview() {
    const reviewContent = document.getElementById('reviewContent');
    reviewContent.innerHTML = quiz.map((q, i) => {
        const userAnswer = responses[i];
        const isCorrect = userAnswer === q.answer;
        return `
            <div style="margin-bottom: 1.5rem; padding: 1rem; border: 1px solid var(--lms-border); border-radius: 8px; border-left: 4px solid ${isCorrect ? 'var(--lms-success)' : 'var(--lms-danger)'};">
                <p style="font-weight: 500; margin-bottom: 0.5rem;">Q${i + 1}. ${q.question}</p>
                <p style="color: ${isCorrect ? 'var(--lms-success)' : 'var(--lms-danger)'};">
                    Your answer: ${userAnswer ? q.options[userAnswer] : 'Not answered'}
                </p>
                ${!isCorrect ? `<p style="color: var(--lms-success);">Correct answer: ${q.options[q.answer]}</p>` : ''}
            </div>
        `;
    }).join('');

    showLmsPage('review');
}

// ========== Initialization ==========

async function init() {
    // Check for existing session
    const student = JSON.parse(sessionStorage.getItem('studentProfile') || 'null');
    if (student) {
        showMainApp(student);
    }
}

// Run on load
init();
