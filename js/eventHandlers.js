// js/eventHandlers.js

const EventHandlers = (function(Utils, UIRenderer, DataManager, TestManager, Gamification, FileHandler) {
    // This module binds all event listeners and defines the core logic
    // executed when events occur. It coordinates calls to other modules.

    // Access constants and DOM elements from other modules
    const DOM = UIRenderer.DOM;
    const QUESTION_TYPES = Utils.QUESTION_TYPES;
    const CSS_CLASSES = Utils.CSS_CLASSES;

    // --------------- BINDING LISTENERS ---------------

    function bindEventListeners() {
        // Bind listeners using DOM elements exposed by UIRenderer
        DOM.startTestBtn.addEventListener('click', handleStartTestClick);
        DOM.newTestBtn.addEventListener('click', handleNewTestClick);
        DOM.prevQuestionBtn.addEventListener('click', handlePrevQuestionClick);
        DOM.nextQuestionBtn.addEventListener('click', handleNextQuestionClick);
        DOM.submitAnswerBtn.addEventListener('click', handleSubmitAnswerClick);

        DOM.browseFilesBtn.addEventListener('click', handleBrowseFilesClick);
        DOM.fileInput.addEventListener('change', handleFileInputChange);
        DOM.fileUpload.addEventListener('dragover', handleFileUploadDragOver);
        DOM.fileUpload.addEventListener('dragleave', handleFileUploadDragLeave);
        DOM.fileUpload.addEventListener('drop', handleFileUploadDrop);

        DOM.deleteQuestionsBtn.addEventListener('click', handleDeleteQuestionsClick);
        DOM.resetBadgesBtn.addEventListener('click', handleResetBadgesClick);

        DOM.subjectFilter.addEventListener('change', handleFilterChange);
        DOM.gradeFilter.addEventListener('change', handleFilterChange);
        DOM.identifierFilter.addEventListener('change', updateQuestionStats); // Identifier filter only needs to update stats

        // Add delegated listeners for options container clicks (single/multi-select)
        DOM.optionsContainer.addEventListener('click', handleOptionsContainerClick);

        // Note: Drag/Touch listeners for Ordering questions are bound directly to elements/container
        // within UIRenderer.renderOrderingOptions when that question type is displayed.
    }

    // --------------- EVENT HANDLERS ---------------

    function handleStartTestClick() {
        const selectedSubject = DOM.subjectFilter.value;
        const selectedGrade = DOM.gradeFilter.value;
        const selectedIdentifier = DOM.identifierFilter.value;
        const testLength = parseInt(DOM.testLengthSelect.value);

        const availableQuestions = DataManager.filterQuestions(selectedSubject, selectedGrade, selectedIdentifier);

        // Attempt to start the test
        const testStarted = TestManager.startNewTest(availableQuestions, testLength);

        if (testStarted) {
            UIRenderer.showTest(TestManager.getQuestionCount());
            displayCurrentQuestion(); // Display the first question
             // Update progress bar initially (0 answered out of total)
             UIRenderer.updateProgressBar(0, TestManager.getQuestionCount());
        } else {
            // TestManager.startNewTest already showed a warning if not enough questions
            // No action needed here other than not proceeding to show the test
        }
    }

    function handleNewTestClick() {
        TestManager.resetTestState(); // Reset test variables
        UIRenderer.showSettings(); // Show settings panel
        updateFilterDropdownsAndStats(); // Update filter options and stats
    }

    function handlePrevQuestionClick() {
        TestManager.showPreviousQuestion(); // Update index in TestManager
        displayCurrentQuestion(); // Display the new current question
         // Update progress bar
         UIRenderer.updateProgressBar(
             TestManager.getCurrentQuestionIndex() + (TestManager.isQuestionAnswered() ? 1 : 0), // Add 1 to current index if answered, otherwise just show current index
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
                 TestManager.getCurrentQuestionIndex() + (TestManager.isQuestionAnswered() ? 1 : 0), // Add 1 to current index if answered, otherwise just show current index
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
            // Answer was successfully recorded (not already answered, answer was provided)
            // Apply feedback styles based on correctness
            UIRenderer.applyFeedbackStyles(currentQuestion, userAnswer, submitResult.correct);

            // Disable options after submission
            UIRenderer.disableOptions();

            // Hide submit button and enable next button
            DOM.submitAnswerBtn.style.display = 'none';
            DOM.nextQuestionBtn.disabled = false;

            // Update gamification if correct
            if (submitResult.correct) {
                Gamification.incrementStars(1);
            }

             // Update progress bar (increment current count because it's now answered)
             UIRenderer.updateProgressBar(
                 TestManager.getCurrentQuestionIndex() + 1, // +1 because it's now answered
                 TestManager.getQuestionCount()
             );


        } else if (submitResult.noAnswer) {
            // Handle case where no answer was provided (e.g., shake effect)
            const input = DOM.optionsContainer.querySelector(`.${CSS_CLASSES.FILL_IN_INPUT}`);
            if (input) input.classList.add(CSS_CLASSES.SHAKE);
            DOM.optionsContainer.classList.add(CSS_CLASSES.SHAKE);
            setTimeout(() => {
                if (input) input.classList.remove(CSS_CLASSES.SHAKE);
                DOM.optionsContainer.classList.remove(CSS_CLASSES.SHAKE);
            }, 500);
        }
        // If alreadyAnswered is true, submitAnswer did nothing, so no UI update needed
    }

    // Helper to display the question managed by TestManager
    function displayCurrentQuestion() {
        const currentQuestion = TestManager.getCurrentQuestion();
        const userSavedAnswer = TestManager.getUserAnswerForCurrentQuestion(); // Get saved answer if exists
        const totalQuestions = TestManager.getQuestionCount();
        const currentIndex = TestManager.getCurrentQuestionIndex();

        UIRenderer.displayQuestion(currentQuestion, userSavedAnswer, totalQuestions, currentIndex);

         // updateProgressBar is now called separately after navigation/submit
    }

    function showTestResults() {
        const results = TestManager.getCurrentTestResults();
        UIRenderer.updateScoreDisplay(results.score);
        UIRenderer.displayFeedback(results.userAnswers);
        UIRenderer.showResults();
         // Update progress bar to 100% on results page
         UIRenderer.updateProgressBar(TestManager.getQuestionCount(), TestManager.getQuestionCount());
    }


    // Handlers for file upload
    function handleBrowseFilesClick() {
        DOM.fileInput.click(); // Trigger the hidden file input
    }

    function handleFileInputChange(event) {
        const files = event.target.files;
        if (!files || files.length === 0) return;
        // Pass the file list and a callback to FileHandler
        FileHandler.handleFileSelection(files, updateFilterDropdownsAndStats); // Callback updates stats after processing
        DOM.fileInput.value = ''; // Clear input so same file can be selected again
    }

    function handleFileUploadDragOver(event) {
        event.preventDefault();
        DOM.fileUpload.classList.add(CSS_CLASSES.DRAG_OVER);
    }

    function handleFileUploadDragLeave() {
        DOM.fileUpload.classList.remove(CSS_CLASSES.DRAG_OVER);
    }

    function handleFileUploadDrop(event) {
        event.preventDefault();
        DOM.fileUpload.classList.remove(CSS_CLASSES.DRAG_OVER);
        const files = event.dataTransfer.files;
        if (!files || files.length === 0) return;
        // Pass the file list and a callback to FileHandler
        FileHandler.handleFileSelection(files, updateFilterDropdownsAndStats); // Callback updates stats after processing
    }

    // Handlers for settings/danger zone
    function handleDeleteQuestionsClick() {
        if (confirm("Are you sure you want to delete ALL loaded questions? This action cannot be undone.")) {
            DataManager.deleteQuestions(); // Delete questions from storage and bank
            updateFilterDropdownsAndStats(); // Update UI filters and stats
            Utils.showSuccessMessage('All questions deleted.');
        }
    }

    function handleResetBadgesClick() {
        if (confirm("Are you sure you want to reset your badge progress? This will set your stars to zero and remove all earned badges.")) {
            Gamification.resetProgress(); // Reset gamification state
            Utils.showSuccessMessage('Badge progress reset.');
        }
    }

    // Handlers for filters
    function handleFilterChange() {
        // This handler is for subject and grade filters
        // Changing these filters affects the available identifiers
        // So, we need to re-populate the identifier filter options
        // and then update the stats based on the new filter combination.
        updateQuestionStats(); // This function will handle updating identifiers and stats
    }

    // Helper function to update filter dropdowns and stats together
    function updateFilterDropdownsAndStats() {
        const filterLists = DataManager.getFilterLists();
        // Update subject and grade filters first
        UIRenderer.updateFilterDropdowns(
            filterLists.subjectList,
            filterLists.gradeLevelList
        );
        // Then update stats, which will populate the identifier filter based on current subject/grade
        updateQuestionStats();
    }


    // Function to update question stats display (called after file load, filter change, delete)
    function updateQuestionStats() {
        // Get current filter values from the UI
        const selectedSubject = DOM.subjectFilter.value;
        const selectedGrade = DOM.gradeFilter.value;
        const selectedIdentifier = DOM.identifierFilter.value; // Get this value *before* updating identifier options

        // Get data from DataManager
        const totalQuestionsInBank = DataManager.getQuestionCount();
        const matchingQuestions = DataManager.filterQuestions(selectedSubject, selectedGrade, selectedIdentifier); // Filter by all three
        const matchingQuestionsCount = matchingQuestions.length;
        const filterLists = DataManager.getFilterLists(); // Get master lists for subjects/grades

         // Get the list of identifiers *available* under the current subject and grade filters
         const availableIdentifiersForSubjectGrade = DataManager.filterQuestions(selectedSubject, selectedGrade, Utils.FILTER_VALUES.ALL)
             .map(q => q.filenameData.identifier || Utils.FILTER_VALUES.UNKNOWN);
         const uniqueAvailableIdentifiers = new Set(availableIdentifiersForSubjectGrade);


        // Get the selected test length
        const minTestLength = parseInt(DOM.testLengthSelect.value);


        // Update the UI display via UIRenderer
        UIRenderer.updateQuestionStats(
            totalQuestionsInBank,
            matchingQuestionsCount,
            filterLists.subjectList, // Pass master lists for subjects/grades
            filterLists.gradeLevelList,
            uniqueAvailableIdentifiers, // Pass the list of relevant identifiers for populating the dropdown
            minTestLength
        );
    }

    // Handler for option selection (delegated)
    function handleOptionsContainerClick(event) {
         const target = event.target;
         const container = DOM.optionsContainer;

         // Check if it's an option element and not disabled
         if (target.classList.contains(CSS_CLASSES.OPTION) && !target.classList.contains(CSS_CLASSES.DISABLED)) {
             const questionType = container.dataset.type;

             // Only allow selection if the question hasn't been answered yet
             if (!TestManager.isQuestionAnswered()) {
                 if (questionType === QUESTION_TYPES.SINGLE) {
                     // Single choice: deselect others, select this one
                     container.querySelectorAll(`.${CSS_CLASSES.OPTION}`).forEach(opt => opt.classList.remove(CSS_CLASSES.SELECTED));
                     target.classList.add(CSS_CLASSES.SELECTED);
                 } else if (questionType === QUESTION_TYPES.MULTI_SELECT) {
                     // Multi-select: toggle selection
                     target.classList.toggle(CSS_CLASSES.SELECTED);
                 }
                 // Note: Ordering clicks are handled by touch/drag listeners directly attached by UIRenderer
             }
         }
    }


    // Public API
    return {
        bindEventListeners, // Called by App.js
        updateQuestionStats, // Called by App.js (initial load) and FileHandler.js (after file processing)
        updateFilterDropdownsAndStats // Called by handleNewTestClick, expose if needed elsewhere
    };
})(Utils, UIRenderer, DataManager, TestManager, Gamification, FileHandler); // Pass all dependencies
