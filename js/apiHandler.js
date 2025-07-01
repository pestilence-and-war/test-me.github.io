// player/js/apiHandler.js
const APIHandler = (function(Utils) {
    const API_BASE_URL = 'https://quiz-backend-613338700440.us-central1.run.app';

    async function loadQuizByCode(quizCode) {
        if (!quizCode || quizCode.trim() === '') {
            Utils.showWarningMessage("Please enter a quiz code.");
            return null;
        }
        const url = `${API_BASE_URL}/api/load-quiz/${quizCode.trim()}`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Failed to load quiz.');
            }
            return data.quiz; // Returns the array of question objects
        } catch (error) {
            Utils.showErrorMessage(error.message);
            return null;
        }
    }

    async function startQuizSession(quizCode, playerName) {
        const url = `${API_BASE_URL}/api/quiz-session/start`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quiz_code: quizCode, player_name: playerName })
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Could not start session.');
            }
            return data.session_id; // Returns the unique ID for this test attempt
        } catch (error) {
            Utils.showErrorMessage(error.message);
            return null;
        }
    }

    async function submitResults(sessionId, userAnswers) {
        const url = `${API_BASE_URL}/api/quiz-session/submit`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: sessionId, user_answers: userAnswers })
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Could not submit results.');
            }
            return data;
        } catch (error) {
            Utils.showErrorMessage(error.message);
            return null;
        }
    }

    return { loadQuizByCode, startQuizSession, submitResults };
})(Utils);