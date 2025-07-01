// js/eventHandlers.js (Simplified for API-driven player)

const EventHandlers = (function(Utils, UIRenderer, TestManager, Gamification) {
    // This module binds event listeners for test navigation and defines
    // the logic for those events. It coordinates calls to other modules.

    // Access constants and DOM elements from other modules
    const DOM = UIRenderer.DOM;
    const QUESTION_TYPES = Utils.QUESTION_TYPES;
    const CSS_CLASSES = Utils.CSS_CLASSES;

    // --------------- BINDING LISTENERS ---------------\n
    function bindEventListeners() {
        // Bind listeners using DOM elements exposed by UIRenderer
        DOM.newTestBtn.addEventListener('click', handleNewTestClick);
        DOM.prevQuestionBtn.addEventListener('click', handlePrevQuestionClick);
        DOM.nextQuestionBtn.addEventListener('click', handleNextQuestionClick);
        DOM.submitAnswerBtn.addEventListener('click', handleSubmitAnswerClick);

        // Add delegated listeners for options container clicks (single/multi-select)
        DOM.optionsContainer.addEventListener('click', handleOptionsContainerClick);
    }

    // --------------- EVENT HANDLERS ---------------\n
    function handleNewTestClick() {
        // In the new flow, "Start New Test" reloads the app to the initial quiz code entry view.
        if (confirm("Are you sure you want to start a new quiz? This will return you to the home screen.")) {
            window.location.reload();
        }
    }

    function handlePrevQuestionClick() {
        TestManager.showPreviousQuestion(); // Update index in TestManager
        displayCurrentQuestion(); // Display the new current question
        // Update progress bar
        UIRenderer.updateProgressBar(
            TestManager.getCurrentQuestionIndex(), // Current index is now 0-based
            TestManager.getQuestionCount()
        );
    }

    function handleNextQuestionClick() {
        if (TestManager.isTestFinished()) {
            showTestResults();
        } else {
            TestManager.showNextQuestion(); // Update index in TestManager
            displayCurrentQuestion(); // Display the new current question
            // Update progress bar
            UIRenderer.updateProgressBar(
                TestManager.getCurrentQuestionIndex(),
                TestManager.getQuestionCount()
            );
        }
    }

    function handleSubmitAnswerClick() {
        const currentQuestion = TestManager.getCurrentQuestion();
        if (!currentQuestion) return; // Should not happen if submit button is visible

        const questionType = currentQuestion.type || Utils.QUESTION_TYPES.SINGLE;
        // Get the user's answer from the UI state
        const userAnswer = UIRenderer.getUserAnswerFromUI(questionType);

        // Submit the answer via TestManager
        const submitResult = TestManager.submitAnswer(userAnswer);

        if (submitResult.success) {
            // Answer was successfully recorded
            UIRenderer.applyFeedbackStyles(currentQuestion, userAnswer, submitResult.correct);
            UIRenderer.disableOptions();
            DOM.submitAnswerBtn.style.display = 'none';
            DOM.nextQuestionBtn.disabled = false;

            if (submitResult.correct) {
                Gamification.incrementStars(1);
            }

            // Update progress bar (increment current count because it's now answered)
            UIRenderer.updateProgressBar(
                TestManager.getCurrentQuestionIndex() + 1, // +1 because it's now answered
                TestManager.getQuestionCount()
            );

        } else if (submitResult.noAnswer) {
            // Handle case where no answer was provided
            const input = DOM.optionsContainer.querySelector(`.${CSS_CLASSES.FILL_IN_INPUT}`);
            if (input) input.classList.add(CSS_CLASSES.SHAKE);
            DOM.optionsContainer.classList.add(CSS_CLASSES.SHAKE);
            setTimeout(() => {
                if (input) input.classList.remove(CSS_CLASSES.SHAKE);
                DOM.optionsContainer.classList.remove(CSS_CLASSES.SHAKE);
            }, 500);
        }
    }

    // Helper to display the question managed by TestManager
    function displayCurrentQuestion() {
        const currentQuestion = TestManager.getCurrentQuestion();
        const userSavedAnswer = TestManager.getUserAnswerForCurrentQuestion();
        const totalQuestions = TestManager.getQuestionCount();
        const currentIndex = TestManager.getCurrentQuestionIndex();

        UIRenderer.displayQuestion(currentQuestion, userSavedAnswer, totalQuestions, currentIndex);

        // Update progress bar after displaying the question
        const answeredCount = TestManager.isQuestionAnswered() ? currentIndex + 1 : currentIndex;
        UIRenderer.updateProgressBar(answeredCount, totalQuestions);
    }

    function showTestResults() {
        const results = TestManager.getCurrentTestResults();
        // We need the currentSessionId from app.js; for now we'll assume it's globally accessible
        // A better approach would be to pass it through TestManager
        if (window.currentSessionId) {
            APIHandler.submitResults(window.currentSessionId, results.userAnswers)
                .then(response => {
                    if (response && response.success) {
                        console.log("Results successfully submitted to server.");
                    } else {
                        console.warn("Failed to submit results to server.");
                    }
                });
        }
        UIRenderer.updateScoreDisplay(results.score);
        UIRenderer.displayFeedback(results.userAnswers);
        UIRenderer.showResults();
        // Update progress bar to 100% on results page
        UIRenderer.updateProgressBar(TestManager.getQuestionCount(), TestManager.getQuestionCount());
    }

    // Handler for option selection (delegated)
    function handleOptionsContainerClick(event) {
        const target = event.target;
        const container = DOM.optionsContainer;

        if (target.classList.contains(CSS_CLASSES.OPTION) && !target.classList.contains(CSS_CLASSES.DISABLED)) {
            const questionType = container.dataset.type;

            if (!TestManager.isQuestionAnswered()) {
                if (questionType === QUESTION_TYPES.SINGLE) {
                    container.querySelectorAll(`.${CSS_CLASSES.OPTION}`).forEach(opt => opt.classList.remove(CSS_CLASSES.SELECTED));
                    target.classList.add(CSS_CLASSES.SELECTED);
                } else if (questionType === QUESTION_TYPES.MULTI_SELECT) {
                    target.classList.toggle(CSS_CLASSES.SELECTED);
                }
            }
        }
    }

    // Public API
    return {
        bindEventListeners,
        displayCurrentQuestion // Expose for app.js to call initially
    };
})(Utils, UIRenderer, TestManager, Gamification);