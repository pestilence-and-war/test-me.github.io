// player/js/app.js (New Controller Logic)

// --- GLOBAL STATE ---
let currentQuizData = null;
let currentQuizCode = null;
let currentSessionId = null;

// --- DOM ELEMENTS ---
const loaderView = document.getElementById('loaderView');
const nicknameView = document.getElementById('nicknameView');
const testView = document.getElementById('testView');
const resultsView = document.getElementById('resultsView');
const loadQuizBtn = document.getElementById('load-quiz-btn');
const startTestBtn = document.getElementById('start-test-btn');
const quizCodeInput = document.getElementById('quiz-code-input');
const nicknameInput = document.getElementById('nickname-input');
const loaderStatus = document.getElementById('loader-status');
const nicknameQuizTitle = document.getElementById('nickname-quiz-title');

// --- VIEW MANAGEMENT ---
function showView(viewName) {
    loaderView.style.display = 'none';
    nicknameView.style.display = 'none';
    testView.style.display = 'none';
    resultsView.style.display = 'none';

    if (viewName === 'loader') loaderView.style.display = 'block';
    if (viewName === 'nickname') nicknameView.style.display = 'block';
    if (viewName === 'test') testView.style.display = 'block';
    if (viewName === 'results') resultsView.style.display = 'block';
}

// --- EVENT HANDLERS ---
async function handleLoadQuiz() {
    loaderStatus.textContent = 'Loading...';
    loadQuizBtn.disabled = true;
    currentQuizCode = quizCodeInput.value;

    const quizData = await APIHandler.loadQuizByCode(currentQuizCode);

    if (quizData && quizData.questions) {
        currentQuizData = quizData.questions;
        DataManager.loadQuizData(quizData.questions); // Load data into your existing system
        loaderStatus.textContent = `Quiz loaded successfully!`;
        nicknameQuizTitle.textContent = quizData.title || 'Quiz Ready';
        showView('nickname');
    } else {
        loaderStatus.textContent = 'Failed to load quiz. Please check the code.';
    }
    loadQuizBtn.disabled = false;
}

async function handleStartTest() {
    const playerName = nicknameInput.value;
    if (!playerName.trim()) {
        alert("Please enter your name.");
        return;
    }

    startTestBtn.disabled = true;
    const sessionId = await APIHandler.startQuizSession(currentQuizCode, playerName);

    if (sessionId) {
        currentSessionId = sessionId;
        // Now, start the test using your existing TestManager logic
        const questions = DataManager.filterQuestions(); // Gets all questions
        const testLength = questions.length; // Use all questions from the loaded quiz
        TestManager.startNewTest(questions, testLength);
        
        UIRenderer.showTest(testLength); // Use your existing UI function
        EventHandlers.displayCurrentQuestion(); // Use your existing UI function
        showView('test');
    } else {
        alert("Could not start the quiz session. Please try again.");
    }
    startTestBtn.disabled = false;
}

// --- INITIALIZATION ---
function initializeApp() {
    // We need to re-wire the event handlers.
    // The old EventHandlers module can be simplified.
    loadQuizBtn.addEventListener('click', handleLoadQuiz);
    startTestBtn.addEventListener('click', handleStartTest);

    // Your existing navigation buttons (next, prev, submit) will still be
    // handled by a simplified EventHandlers module.
    EventHandlers.bindEventListeners();

    showView('loader'); // Start at the loader view
    Gamification.init(UIRenderer.updateStarCount, UIRenderer.renderBadges);
}

document.addEventListener('DOMContentLoaded', initializeApp);