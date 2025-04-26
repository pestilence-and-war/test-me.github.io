// js/uiRenderer.js

const UIRenderer = (function(Utils, TestManager) {
    // --------------- DOM ELEMENTS ---------------
    const DOM = {
        subjectFilter: document.getElementById('subject-filter'),
        gradeFilter: document.getElementById('grade-filter'),
        identifierFilter: document.getElementById('identifier-filter'),
        testLengthSelect: document.getElementById('test-length'),
        startTestBtn: document.getElementById('start-test'),
        testContainer: document.querySelector('.test-container'),
        questionText: document.getElementById('question-text'),
        optionsContainer: document.getElementById('options-container'),
        prevQuestionBtn: document.getElementById('prev-question'),
        nextQuestionBtn: document.getElementById('next-question'),
        submitAnswerBtn: document.getElementById('submit-answer'),
        resultsContainer: document.querySelector('.results'),
        finalScoreSpan: document.getElementById('final-score'),
        feedbackContainer: document.getElementById('feedback-container'),
        newTestBtn: document.getElementById('new-test'),
        fileUpload: document.getElementById('file-upload'),
        browseFilesBtn: document.getElementById('browse-files'),
        fileInput: document.getElementById('file-input'),
        questionStats: document.getElementById('question-stats'),
        deleteQuestionsBtn: document.getElementById('delete-questions'),
        resetBadgesBtn: document.getElementById('reset-badges'),
        progressBar: document.getElementById('progress-bar'), // Gamification progress bar
        starCountSpan: document.getElementById('star-count'), // Star count display
        badgeContainer: document.getElementById('badge-container'), // Badge container
        header: document.getElementById('header'),
        mainTitle: document.getElementById('main-title'),
        mainSubtitle: document.getElementById('main-subtitle'),
        hintIcon: document.getElementById('hint-icon'),
        questionArea: document.querySelector('.question-area'), // Container for question text and hint
        orderingInstructions: document.getElementById('ordering-instructions'), // Instructions for ordering/multi-select
        currentQuestionSpan: document.getElementById('current-question'), // Current question number in test progress
        totalQuestionsSpan: document.getElementById('total-questions'), // Total questions in test progress
        testProgressDiv: document.querySelector('.test-container .progress'), // The progress display div
    };

    // Access constants from Utils
    const FILTER_VALUES = Utils.FILTER_VALUES;
    const QUESTION_TYPES = Utils.QUESTION_TYPES;
    const CSS_CLASSES = Utils.CSS_CLASSES;

    // Variables for Touch Drag (UI state specific)
    let touchDraggedElement = null;
    let touchDragOffset = { x: 0, y: 0 };
    let initialOptionRects = []; // Store initial bounding boxes of options for touch move


    // --------------- UI RENDERING AND STATE UPDATES ---------------

    function updateFilterDropdowns(subjectList, gradeLevelList) {
        // Update Subject Filter
        const currentSubjectVal = DOM.subjectFilter.value;
        DOM.subjectFilter.innerHTML = `<option value="${FILTER_VALUES.ALL}">All Subjects</option>`;
        Array.from(subjectList).sort().forEach(subject => {
            const opt = new Option(subject.charAt(0).toUpperCase() + subject.slice(1), subject);
            DOM.subjectFilter.appendChild(opt);
        });
        DOM.subjectFilter.value = subjectList.has(currentSubjectVal) ? currentSubjectVal : FILTER_VALUES.ALL;

        // Update Grade Filter
        const currentGradeVal = DOM.gradeFilter.value;
        DOM.gradeFilter.innerHTML = `<option value="${FILTER_VALUES.ALL}">All Levels</option>`;
        const gradeOptions = Array.from(gradeLevelList)
            .map(g => ({
                value: g,
                text: isNaN(parseInt(g)) ? (g === FILTER_VALUES.UNKNOWN ? 'Unknown Grade' : g) : `Grade ${g}`,
                isNum: !isNaN(parseInt(g))
            }))
            .sort((a, b) => a.isNum === b.isNum ? (a.isNum ? a.value - b.value : a.text.localeCompare(b.text)) : (b.isNum - a.isNum));

        gradeOptions.forEach(g => {
            const opt = new Option(g.text, g.value);
            DOM.gradeFilter.appendChild(opt);
        });
        DOM.gradeFilter.value = gradeLevelList.has(currentGradeVal) ? currentGradeVal : FILTER_VALUES.ALL;

        // Identifier filter options are updated in updateQuestionStats because they depend on selected subject/grade
    }

     // This function should be called whenever filters change or questions are loaded/deleted
     function updateQuestionStats(totalQuestionsInBank, matchingQuestionsCount, subjectList, gradeLevelList, identifierListForCurrentFilters, minTestLength) {
         if (totalQuestionsInBank === 0) {
             DOM.questionStats.innerHTML = 'No questions loaded. Add question files to begin.';
             DOM.startTestBtn.disabled = true;
             DOM.deleteQuestionsBtn.disabled = true;
             // Also clear identifier filter options if no questions exist
             DOM.identifierFilter.innerHTML = `<option value="${FILTER_VALUES.ALL}">All Question Sets</option>`;
             return;
         }

         DOM.deleteQuestionsBtn.disabled = false;

         // Update Identifier Filter options based on the current subject/grade filters
         const currentIdentifierVal = DOM.identifierFilter.value;
         DOM.identifierFilter.innerHTML = `<option value="${FILTER_VALUES.ALL}">All Question Sets</option>`;
         // Sort identifiers alphabetically, putting UNKNOWN last
         const sortedIdentifiers = Array.from(identifierListForCurrentFilters).sort((a, b) => {
             if (a === FILTER_VALUES.UNKNOWN) return 1;
             if (b === FILTER_VALUES.UNKNOWN) return -1;
             return a.localeCompare(b);
         });
         sortedIdentifiers.forEach(id => {
             const opt = new Option(id === FILTER_VALUES.UNKNOWN ? 'Unnamed Set' : id, id);
             DOM.identifierFilter.appendChild(opt);
         });
         // Restore the previous value if it still exists in the new list, otherwise default to ALL
         const identifierOptions = Array.from(DOM.identifierFilter.options).map(opt => opt.value);
         DOM.identifierFilter.value = identifierOptions.includes(currentIdentifierVal) ? currentIdentifierVal : FILTER_VALUES.ALL;


         const subs = Array.from(subjectList).join(', ') || 'None';
         // Sort grades numerically where possible, then alphabetically
         const sortedGrades = Array.from(gradeLevelList).sort((a, b) => {
             const numA = parseInt(a);
             const numB = parseInt(b);
             if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
             if (a === FILTER_VALUES.UNKNOWN) return 1;
             if (b === FILTER_VALUES.UNKNOWN) return -1;
             return a.localeCompare(b);
         });
         const grades = sortedGrades.map(g => isNaN(parseInt(g)) ? (g === FILTER_VALUES.UNKNOWN ? 'Unknown Grade' : g) : `Grade ${g}`).join(', ') || 'None';
         const ids = sortedIdentifiers.map(id => id === FILTER_VALUES.UNKNOWN ? 'Unnamed Set' : id).join(', ') || 'None';


         let statsHTML = `<strong>${totalQuestionsInBank}</strong> questions loaded.<br>
    <strong>${matchingQuestionsCount}</strong> matching current filters.<br>
    Subjects: ${subs}<br> Grades: ${grades}<br> Sets: ${ids}`;

         DOM.startTestBtn.disabled = matchingQuestionsCount < minTestLength;
         if (matchingQuestionsCount < minTestLength) {
             statsHTML += `<br><span style="color:var(--danger);">Not enough questions for selected test length.</span>`;
         }
         DOM.questionStats.innerHTML = statsHTML;
     }


    function showSettings() {
        document.querySelector('.settings-panel').style.display = 'block';
        DOM.testContainer.style.display = 'none';
        DOM.resultsContainer.style.display = 'none';
        if (DOM.mainTitle) DOM.mainTitle.style.display = 'block';
        if (DOM.mainSubtitle) DOM.mainSubtitle.style.display = 'block';
        if (DOM.header) DOM.header.style.display = 'block';
        if (DOM.testProgressDiv) DOM.testProgressDiv.style.display = 'none';

        // Remove any active drag/touch states from previous test
        handleTouchCancel(); // Clean up touch drag if active

        // Remove container drag listeners when leaving test view
        // Check if listeners are added before removing
         if (DOM.optionsContainer.dataset.mouseDragListenersAdded === 'true') {
             DOM.optionsContainer.removeEventListener('dragover', handleMouseDragOver);
             DOM.optionsContainer.removeEventListener('drop', handleMouseDrop);
             delete DOM.optionsContainer.dataset.mouseDragListenersAdded; // Remove the flag
         }
        // Individual option listeners are removed when optionsContainer.innerHTML is cleared
    }

    function showTest(totalQuestions) {
        document.querySelector('.settings-panel').style.display = 'none';
        DOM.resultsContainer.style.display = 'none';
        DOM.testContainer.style.display = 'block';
        if (DOM.mainTitle) DOM.mainTitle.style.display = 'none';
        if (DOM.mainSubtitle) DOM.mainSubtitle.style.display = 'none';
        if (DOM.header) DOM.header.style.display = 'block'; // Keep header for gamification
        if (DOM.testProgressDiv) DOM.testProgressDiv.style.display = 'flex';

        DOM.totalQuestionsSpan.textContent = totalQuestions;
    }

    function showResults() {
        DOM.testContainer.style.display = 'none';
        document.querySelector('.settings-panel').style.display = 'none'; // Ensure settings is also hidden
        DOM.resultsContainer.style.display = 'block';
         // Decide what to show on results page - title/subtitle or just header
         if (DOM.mainTitle) DOM.mainTitle.style.display = 'block'; // Show title again on results? Or keep header?
         if (DOM.mainSubtitle) DOM.mainSubtitle.style.display = 'block'; // Show subtitle?
         if (DOM.header) DOM.header.style.display = 'block'; // Keep header for gamification
         if (DOM.testProgressDiv) DOM.testProgressDiv.style.display = 'none'; // Hide progress


        // Remove any active drag/touch states from previous test
        handleTouchCancel(); // Clean up touch drag if active

        // Remove container drag listeners when leaving test view
         if (DOM.optionsContainer.dataset.mouseDragListenersAdded === 'true') {
             DOM.optionsContainer.removeEventListener('dragover', handleMouseDragOver);
             DOM.optionsContainer.removeEventListener('drop', handleMouseDrop);
             delete DOM.optionsContainer.dataset.mouseDragListenersAdded; // Remove the flag
         }
        // Individual option listeners are removed when optionsContainer.innerHTML is cleared
    }


    function displayQuestion(questionObject, userSavedAnswer, totalQuestions, currentIndex) {
        if (!questionObject) {
            console.error("displayQuestion called with invalid question object:", questionObject);
            Utils.showErrorMessage("An error occurred displaying the question.");
            DOM.submitAnswerBtn.disabled = true;
            DOM.optionsContainer.innerHTML = ''; // Clear options
            // Ensure all navigation buttons are disabled if question cannot render
             DOM.prevQuestionBtn.disabled = true;
             DOM.nextQuestionBtn.disabled = true;
            return;
        }

        const questionType = questionObject.type || QUESTION_TYPES.SINGLE;
        DOM.optionsContainer.dataset.type = questionType; // Store type on container

        // Clear previous options and instructions
        DOM.optionsContainer.innerHTML = '';
        DOM.orderingInstructions.style.display = 'none';
        DOM.orderingInstructions.textContent = '';

        // Set question text and hint
        DOM.questionText.innerHTML = questionObject.question || "[No Question Text]";
        const hasValidHint = questionObject.hint && questionObject.hint.trim() !== "" && questionObject.hint.trim().toLowerCase() !== "no hint available." && questionObject.hint.trim().toLowerCase() !== "no hint.";
        DOM.hintIcon.style.display = hasValidHint ? 'inline-block' : 'none';
        DOM.hintIcon.dataset.hint = hasValidHint ? questionObject.hint : "";

        // Render options based on type
        let renderSuccessful = false;
        switch (questionType) {
            case QUESTION_TYPES.SINGLE:
                renderSuccessful = renderSingleChoiceOptions(questionObject, DOM.optionsContainer, userSavedAnswer);
                DOM.orderingInstructions.textContent = 'Select the single correct answer.';
                DOM.orderingInstructions.style.display = 'block';
                break;
            case QUESTION_TYPES.MULTI_SELECT:
                renderSuccessful = renderMultiSelectOptions(questionObject, DOM.optionsContainer, userSavedAnswer);
                 DOM.orderingInstructions.textContent = 'Select all options that apply.';
                 DOM.orderingInstructions.style.display = 'block';
                break;
            case QUESTION_TYPES.FILL_IN:
                renderSuccessful = renderFillInOptions(questionObject, DOM.optionsContainer, userSavedAnswer);
                 DOM.orderingInstructions.textContent = 'Type your answer in the box.';
                 DOM.orderingInstructions.style.display = 'block';
                break;
            case QUESTION_TYPES.ORDERING:
                renderSuccessful = renderOrderingOptions(questionObject, DOM.optionsContainer, userSavedAnswer);
                 DOM.orderingInstructions.textContent = 'Drag and drop the items to put them in the correct order.';
                 DOM.orderingInstructions.style.display = 'block';
                break;
            default:
                DOM.optionsContainer.innerHTML = `<p style="color:var(--danger);">Error: Unknown question type "${questionType}".</p>`;
                Utils.showErrorMessage(`Unknown question type: ${questionType}`);
                renderSuccessful = false;
        }

        if (!renderSuccessful) {
             DOM.submitAnswerBtn.disabled = true;
             DOM.nextQuestionBtn.disabled = true;
             DOM.prevQuestionBtn.disabled = true; // Disable navigation if question couldn't render
             return;
        }


        // Update navigation buttons and progress display
        DOM.prevQuestionBtn.disabled = currentIndex === 0;
        DOM.nextQuestionBtn.textContent = currentIndex === totalQuestions - 1 ? "Finish" : "Next";
        // DOM.currentQuestionSpan.textContent = currentIndex + 1; // Updated by updateProgressBar


        // Apply feedback or enable interaction based on whether the question is answered
        const isAnswered = userSavedAnswer !== null;
        if (isAnswered) {
            applyFeedbackStyles(questionObject, userSavedAnswer.userAnswer, userSavedAnswer.correct);
            disableOptions();
            DOM.submitAnswerBtn.style.display = 'none';
            DOM.nextQuestionBtn.disabled = false;
        } else {
            enableOptions();
            DOM.submitAnswerBtn.style.display = 'inline-block';
            DOM.nextQuestionBtn.disabled = true; // Next is disabled until submitted
        }
    }

    // Helper to create a basic option element
    function createOptionElement(text, index) {
        const optElement = document.createElement('div');
        optElement.classList.add(CSS_CLASSES.OPTION); // Use constant
        optElement.textContent = text;
        optElement.dataset.index = index; // Store original index if needed
        optElement.dataset.value = text; // Store value
        return optElement;
    }

    // --------------- TYPE-SPECIFIC RENDERERS ---------------

    function renderSingleChoiceOptions(q, container, userSavedAnswer) {
        if (!q.options || !Array.isArray(q.options)) {
            container.innerHTML = `<p style="color:var(--danger);">Error: Options missing or invalid.</p>`;
            return false;
        }
        q.options.forEach((option, index) => {
            const optElement = createOptionElement(option, index);
            // Event listener for selection is handled by delegated listener in eventHandlers.js
            container.appendChild(optElement);
        });
        return true;
    }

    function renderFillInOptions(q, container, userSavedAnswer) {
        // For fill-in, the answer is the input value, options array is not used
        const inputElement = document.createElement('input');
        inputElement.type = 'text';
        inputElement.classList.add(CSS_CLASSES.FILL_IN_INPUT);
        inputElement.placeholder = 'Enter your answer';
        if (userSavedAnswer && userSavedAnswer.userAnswer !== null && userSavedAnswer.userAnswer !== undefined) {
             inputElement.value = userSavedAnswer.userAnswer;
        }
        container.appendChild(inputElement);
        return true;
    }

    function renderMultiSelectOptions(q, container, userSavedAnswer) {
        if (!q.options || !Array.isArray(q.options)) {
            container.innerHTML = `<p style="color:var(--danger);">Error: Options missing or invalid.</p>`;
            return false;
        }
        q.options.forEach((option, index) => {
            const optElement = createOptionElement(option, index);
             // Event listener for toggling is handled by delegated listener in eventHandlers.js
            container.appendChild(optElement);
        });
        return true;
    }

    function renderOrderingOptions(q, container, userSavedAnswer) {
        if (!q.options || !Array.isArray(q.options)) {
            container.innerHTML = `<p style="color:var(--danger);">Error: Options missing or invalid.</p>`;
            return false;
        }

        let optionsToRender = [...q.options];

        // If the question has been answered, render using the user's saved order
        if (userSavedAnswer && userSavedAnswer.userAnswer && Array.isArray(userSavedAnswer.userAnswer)) {
             optionsToRender = userSavedAnswer.userAnswer;
             // Ensure all user's answers are actually valid options in the question
             optionsToRender = optionsToRender.filter(userOpt => q.options.includes(userOpt));
             // If user's answer is incomplete or contains invalid options, fall back to original options
             if (optionsToRender.length !== q.options.length) {
                  console.warn("User's saved ordering answer is incomplete or invalid, falling back to original options for rendering.");
                  optionsToRender = [...q.options]; // Use original options
             }
        } else {
             // If not answered, shuffle the options for the initial display
             optionsToRender = Utils.shuffle([...q.options]);
        }


        optionsToRender.forEach((optionText, index) => {
            // Find the original option index if needed, but for rendering text content is enough
            const optElement = createOptionElement(optionText, index); // Index here is the index in the *current* display order
            optElement.classList.add(CSS_CLASSES.DRAGGABLE);
            optElement.draggable = true; // Enable mouse drag

            // Add Mouse Drag Listeners (bound directly to the element)
            optElement.addEventListener('dragstart', handleMouseDragStart);
            optElement.addEventListener('dragend', handleMouseDragEnd);

            // Add Touch Drag Listeners (bound directly to the element)
            optElement.addEventListener('touchstart', handleTouchStart);
            optElement.addEventListener('touchmove', handleTouchMove);
            optElement.addEventListener('touchend', handleTouchEnd);
            optElement.addEventListener('touchcancel', handleTouchCancel); // Good practice

            container.appendChild(optElement);
        });

        // Add container listeners for mouse dragover/drop (bound only once when ordering question is rendered)
        // Check if listeners are already added before adding again
        if (!container.dataset.mouseDragListenersAdded) {
             container.addEventListener('dragover', handleMouseDragOver);
             container.addEventListener('drop', handleMouseDrop);
             container.dataset.mouseDragListenersAdded = 'true'; // Mark that listeners are added
        }


        return true;
    }


    // --------------- FEEDBACK AND STATE STYLES ---------------

    function applyFeedbackStyles(question, userAnswer, correct) {
        const questionType = question.type || QUESTION_TYPES.SINGLE;
        const correctAnswer = question.answer;
        const options = DOM.optionsContainer.children; // Get current children after potential reordering

        // Remove previous feedback/selection styles from all options/inputs
        Array.from(options).forEach(opt => {
            opt.classList.remove(CSS_CLASSES.SELECTED, CSS_CLASSES.CORRECT, CSS_CLASSES.INCORRECT);
             // Remove any extra feedback text added for fill-in (check by class)
            if (opt.classList.contains('correct-answer') || opt.classList.contains('user-mistake')) {
                 opt.remove();
            }
        });
        const inputElement = DOM.optionsContainer.querySelector(`.${CSS_CLASSES.FILL_IN_INPUT}`);
        if (inputElement) {
             inputElement.classList.remove(CSS_CLASSES.CORRECT, CSS_CLASSES.INCORRECT);
              // Remove any feedback text associated with fill-in input
             const feedbackText = DOM.optionsContainer.querySelector('.correct-answer, .user-mistake');
             if(feedbackText) feedbackText.remove();
        }


        if (questionType === QUESTION_TYPES.FILL_IN) {
            if (inputElement) {
                // Apply correct/incorrect styles to the input field
                inputElement.classList.add(correct ? CSS_CLASSES.CORRECT : CSS_CLASSES.INCORRECT);
                 // Optionally display the correct answer near the input for feedback if incorrect
                 if (!correct) {
                    const feedbackText = document.createElement('p');
                    feedbackText.classList.add('correct-answer');
                    feedbackText.textContent = `Correct Answer: ${correctAnswer}`;
                    // Check if feedback already exists to avoid duplicates (redundant with clearing above, but safe)
                    if (!DOM.optionsContainer.querySelector('.correct-answer')) {
                         DOM.optionsContainer.appendChild(feedbackText);
                    }
                 }
            }
        } else { // Single, Multi-Select, Ordering
             // Get correct answers and user answers as arrays of strings for easy comparison
            const correctAnswersArray = Array.isArray(correctAnswer) ? correctAnswer.map(String) : (correctAnswer !== null && correctAnswer !== undefined ? [String(correctAnswer)] : []);
            const userAnswersArray = Array.isArray(userAnswer) ? userAnswer.map(String) : (userAnswer !== null && userAnswer !== undefined ? [String(userAnswer)] : []);


            Array.from(options).forEach(opt => {
                // Only process actual option elements (not potential feedback text added for fill-in)
                if (!opt.classList.contains(CSS_CLASSES.OPTION)) return;

                const optionText = String(opt.textContent);

                // Highlight correct options for ALL types (except fill-in handled above)
                if (correctAnswersArray.includes(optionText)) {
                    opt.classList.add(CSS_CLASSES.CORRECT);
                }

                // Highlight user's selection and incorrect choices (for Single/Multi-Select)
                if (questionType !== QUESTION_TYPES.ORDERING) {
                    const isUserAnswer = userAnswersArray.includes(optionText);
                     if (isUserAnswer) {
                         opt.classList.add(CSS_CLASSES.SELECTED); // Keep user selection highlighted
                         // Highlight incorrect user selections
                         if (!correctAnswersArray.includes(optionText)) {
                            opt.classList.add(CSS_CLASSES.INCORRECT);
                        }
                     }
                } else {
                     // For Ordering questions, the correctness is based on the order.
                     // Individual options are marked correct if they are part of the correct answer set,
                     // but we don't mark individual options as "incorrect" based on the user's order.
                     // The feedback shows the correct order vs user's order separately.
                }
            });

             // For Ordering, if incorrect, might show the correct order visually?
             // This could be complex. Simple text feedback might be sufficient.
        }
    }


    function disableOptions() {
        const questionType = DOM.optionsContainer.dataset.type;
        if (questionType === QUESTION_TYPES.FILL_IN) {
            const input = DOM.optionsContainer.querySelector(`.${CSS_CLASSES.FILL_IN_INPUT}`);
            if (input) input.disabled = true;
        } else {
            Array.from(DOM.optionsContainer.children).forEach(opt => {
                // Only disable actual option elements
                if (!opt.classList.contains(CSS_CLASSES.OPTION)) return;

                opt.style.pointerEvents = 'none'; // Disable click/touch
                opt.classList.add(CSS_CLASSES.DISABLED);
                // For mouse drag, explicitly disable
                if (opt.classList.contains(CSS_CLASSES.DRAGGABLE)) opt.draggable = false;
                // Touch handlers check for CSS_CLASSES.DISABLED internally if needed, but pointer-events: none is usually sufficient
            });
        }
    }

    function enableOptions() {
        const questionType = DOM.optionsContainer.dataset.type;
        if (questionType === QUESTION_TYPES.FILL_IN) {
            const input = DOM.optionsContainer.querySelector(`.${CSS_CLASSES.FILL_IN_INPUT}`);
            if (input) input.disabled = false;
        } else {
            Array.from(DOM.optionsContainer.children).forEach(opt => {
                // Only enable actual option elements
                 if (!opt.classList.contains(CSS_CLASSES.OPTION)) return;

                opt.style.pointerEvents = 'auto'; // Enable click/touch
                opt.classList.remove(CSS_CLASSES.DISABLED);
                // For mouse drag, re-enable (only if it's a draggable type)
                if (opt.classList.contains(CSS_CLASSES.DRAGGABLE)) opt.draggable = true;
            });
        }
    }

    function getUserAnswerFromUI(questionType) {
        // Reads the user's answer directly from the state of the UI elements
        const container = DOM.optionsContainer;

        switch (questionType) {
            case QUESTION_TYPES.SINGLE:
                const selectedOption = container.querySelector(`.option.${CSS_CLASSES.SELECTED}`);
                return selectedOption ? selectedOption.textContent : null;
            case QUESTION_TYPES.FILL_IN:
                const inputElement = container.querySelector(`.${CSS_CLASSES.FILL_IN_INPUT}`);
                const inputValue = inputElement ? inputElement.value.trim() : null;
                return inputValue === '' ? null : inputValue; // Return null if empty string after trim
            case QUESTION_TYPES.MULTI_SELECT:
                const selectedOptions = container.querySelectorAll(`.option.${CSS_CLASSES.SELECTED}`);
                return Array.from(selectedOptions).map(opt => opt.textContent);
            case QUESTION_TYPES.ORDERING:
                // For ordering, the user's answer is the current order in the DOM
                const orderedOptions = container.children;
                // Filter to only include draggable options (to exclude potential feedback text or placeholders)
                const orderedDraggableOptions = Array.from(orderedOptions).filter(opt => opt.classList.contains(CSS_CLASSES.DRAGGABLE));
                return Array.from(orderedDraggableOptions).map(opt => opt.textContent);
            default:
                return null;
        }
    }


     function displayFeedback(userAnswers) {
         DOM.feedbackContainer.innerHTML = '';
         userAnswers.forEach((answer, index) => {
             if (!answer) return; // Skip questions that weren't answered

             const item = document.createElement('div');
             item.classList.add('feedback-item');

             const questionText = document.createElement('p');
             questionText.innerHTML = `<strong>Question ${index + 1}:</strong> ${answer.question.question}`;
             item.appendChild(questionText);

             const correctAnswerP = document.createElement('p');
             correctAnswerP.classList.add('correct-answer');
             const correctDisplay = Array.isArray(answer.question.answer) ? `[${answer.question.answer.join(', ')}]` : answer.question.answer;
             correctAnswerP.innerHTML = `<strong>Correct Answer:</strong> ${correctDisplay}`;
             item.appendChild(correctAnswerP);

             // Only show "Your Answer" if it's different from the correct answer OR if it's an array type
             // Use TestManager.isCorrect to compare the saved answer against the correct answer
             const isUserAnswerDifferent = !TestManager.isCorrect(answer.question, answer.userAnswer);
             const isArrayType = Array.isArray(answer.question.answer); // Ordering and Multi-select use arrays

             if (isUserAnswerDifferent || isArrayType) {
                 const userAnswerP = document.createElement('p');
                 userAnswerP.classList.add(answer.correct ? 'correct-answer' : 'user-mistake');
                 let userDisplay;
                 if (Array.isArray(answer.userAnswer)) {
                     userDisplay = answer.userAnswer.length > 0 ? `[${answer.userAnswer.join(', ')}]` : 'No answer provided';
                 } else if (answer.userAnswer !== null && answer.userAnswer !== undefined && answer.userAnswer !== '') {
                     userDisplay = answer.userAnswer;
                 } else {
                     userDisplay = 'No answer provided';
                 }
                 userAnswerP.innerHTML = `<strong>Your Answer:</strong> ${userDisplay}`;
                 item.appendChild(userAnswerP);
             }


             const rationale = document.createElement('p');
             rationale.innerHTML = `<strong>Rationale:</strong> ${answer.question.rationale || 'No rationale provided.'}`;
             item.appendChild(rationale);

             DOM.feedbackContainer.appendChild(item);
         });
     }


     function updateScoreDisplay(scorePercentage) {
         DOM.finalScoreSpan.textContent = scorePercentage.toFixed(0);
     }

     function updateProgressBar(current, total) {
          const percentage = total > 0 ? (current / total) * 100 : 0;
          DOM.progressBar.style.width = `${percentage}%`;
          // Also update the current question number display
          DOM.currentQuestionSpan.textContent = current; // current is 1-based count
     }

     function updateStarCount(count) {
         DOM.starCountSpan.textContent = count;
     }

     function renderBadges(badges) {
         DOM.badgeContainer.innerHTML = '';
         badges.forEach(badgeInfo => {
             const badgeElement = document.createElement('span');
             badgeElement.classList.add('badge');
             badgeElement.dataset.badgeType = badgeInfo.type;
             badgeElement.innerHTML = `<i class="${badgeInfo.icon}"></i> ${badgeInfo.text}`;
             DOM.badgeContainer.appendChild(badgeElement);
         });
     }

     // --------------- DRAG AND DROP (MOUSE & TOUCH) HANDLERS FOR ORDERING ---------------

     // These handlers directly manipulate the UI (DOM) state for drag feedback and reordering.
     // They are part of the UI rendering logic.

     // Mouse Drag Handlers
     function handleMouseDragStart(event) {
          // Ensure we are on an ordering question and the target is draggable and enabled
          if (DOM.optionsContainer.dataset.type !== QUESTION_TYPES.ORDERING) return;
          const draggable = event.target.closest(`.${CSS_CLASSES.DRAGGABLE}`);
          if (!draggable || draggable.classList.contains(CSS_CLASSES.DISABLED)) return;

          draggable.classList.add(CSS_CLASSES.DRAGGING);
          event.dataTransfer.setData('text/plain', null); // Necessary for Firefox
          // console.log('Mouse drag start', draggable.textContent);
     }

     function handleMouseDragEnd(event) {
          // Ensure we are on an ordering question and the target is draggable
          if (DOM.optionsContainer.dataset.type !== QUESTION_TYPES.ORDERING) return;
          const draggable = event.target.closest(`.${CSS_CLASSES.DRAGGABLE}`);
          if (!draggable) return;
          draggable.classList.remove(CSS_CLASSES.DRAGGING);
          // console.log('Mouse drag end');
     }

     function handleMouseDragOver(e) {
         // This should only apply if the container is for ordering
         if (DOM.optionsContainer.dataset.type !== QUESTION_TYPES.ORDERING) return;

         e.preventDefault(); // Necessary to allow dropping

         // Add a visual indicator to the container when dragging over
         DOM.optionsContainer.classList.add(CSS_CLASSES.DRAG_OVER);

         const afterElement = getDragAfterElement(DOM.optionsContainer, e.clientY);
         const draggable = DOM.optionsContainer.querySelector(`.${CSS_CLASSES.DRAGGING}`);

         if (draggable) {
             if (afterElement == null) {
                 // Append to the end if no element is found after the drag position
                 DOM.optionsContainer.appendChild(draggable);
             } else {
                 // Insert before the element found after the drag position
                 DOM.optionsContainer.insertBefore(draggable, afterElement);
             }
         }
          // console.log('Mouse drag over');
     }

      function handleMouseDrop(e) {
          // This should only apply if the container is for ordering
          if (DOM.optionsContainer.dataset.type !== QUESTION_TYPES.ORDERING) return;

          e.preventDefault();
          // The element was already moved in dragover, nothing more to do here for simple reordering

          // Remove the visual indicator from the container
          DOM.optionsContainer.classList.remove(CSS_CLASSES.DRAG_OVER);
          // console.log('Mouse drop');
      }

     // Helper function for mouse dragover logic
     function getDragAfterElement(container, y) {
         // Get all draggable elements *except* the one currently being dragged
         const draggableElements = [...container.querySelectorAll(`.${CSS_CLASSES.DRAGGABLE}:not(.${CSS_CLASSES.DRAGGING})`)];

         // Use reduce to find the element that the dragged item should be inserted before
         return draggableElements.reduce((closest, child) => {
             const box = child.getBoundingClientRect();
             // Calculate the offset from the center of the child element to the mouse Y position
             const offset = y - box.top - box.height / 2;
             // Find the element with the smallest negative offset (i.e., the first element below the mouse position)
             if (offset < 0 && offset > closest.offset) {
                 return {
                     offset: offset,
                     element: child
                 };
             } else {
                 return closest;
             }
         }, {
             offset: Number.NEGATIVE_INFINITY // Start with a very small offset
         }).element; // Return the element found
     }


     // Touch Drag Handlers
     function handleTouchStart(event) {
         // Only handle if the container is for ordering
          if (DOM.optionsContainer.dataset.type !== QUESTION_TYPES.ORDERING) return;

         // Only handle the first touch point
         if (event.touches.length !== 1) return;

         const touchedElement = event.target.closest(`.${CSS_CLASSES.DRAGGABLE}`);
         if (!touchedElement || touchedElement.classList.contains(CSS_CLASSES.DISABLED)) return; // Don't drag if disabled

         // Prevent default scrolling/zooming
         event.preventDefault();

         touchDraggedElement = touchedElement;
         touchDraggedElement.classList.add(CSS_CLASSES.DRAGGING);

         // Get initial position and calculate offset
         const rect = touchDraggedElement.getBoundingClientRect();
         const touch = event.touches[0];
         touchDragOffset = {
             x: touch.clientX - rect.left,
             y: touch.clientY - rect.top
         };

         // Store initial bounding boxes of all options *once* at the start of the drag
         initialOptionRects = [];
         Array.from(DOM.optionsContainer.children).forEach(opt => {
              // Only consider draggable options
              if (opt.classList.contains(CSS_CLASSES.DRAGGABLE)) {
                 initialOptionRects.push({
                     element: opt, // Store reference to the actual element
                     rect: opt.getBoundingClientRect() // Store its initial dimensions/position
                 });
              }
         });


         // Set element to fixed position for dragging relative to viewport
         touchDraggedElement.style.position = 'fixed';
         touchDraggedElement.style.zIndex = 1000; // Bring to front
         touchDraggedElement.style.width = `${rect.width}px`; // Maintain initial width


         // Position element under finger considering the offset
         touchDraggedElement.style.left = `${touch.clientX - touchDragOffset.x}px`;
         touchDraggedElement.style.top = `${touch.clientY - touchDragOffset.y}px`;


         // Optional: Add a placeholder to maintain space in the original list
         // Placeholder logic is commented out for simplicity but can be added
         // console.log('Touch drag start', touchDraggedElement.textContent);
     }

     function handleTouchMove(event) {
         // Only handle if a drag is in progress and it's the first touch
         if (!touchDraggedElement || event.touches.length !== 1) return;

         event.preventDefault(); // Prevent scrolling

         const touch = event.touches[0];

         // Update element position based on current touch location and initial offset
         touchDraggedElement.style.left = `${touch.clientX - touchDragOffset.x}px`;
         touchDraggedElement.style.top = `${touch.clientY - touchDragOffset.y}px`;

         // Determine potential drop target based on touch Y position and *initial* rects
         let insertBeforeElement = null; // Element to insert before, or null to append

         // Find the element whose *initial* bounding box the touch Y is currently over
         // We iterate through the *original* order of elements based on the stored rects
         for (const rectInfo of initialOptionRects) {
              // Skip the element being dragged
              if (rectInfo.element === touchDraggedElement) continue;

              // Check if the touch Y is above the vertical midpoint of this option's initial position
              const optionMidpointY = rectInfo.rect.top + rectInfo.rect.height / 2;
              const touchY = touch.clientY;

              if (touchY < optionMidpointY) {
                  // The touch is above the midpoint of this option's initial position.
                  // This means the dragged element should be inserted *before* this element.
                  insertBeforeElement = rectInfo.element;
                  break; // Found our insertion point, stop checking
              }
              // If the loop finishes without finding an insertion point, it means
              // the touch is below the midpoint of the last element's initial position,
              // so the dragged element should be inserted at the end.
         }

          // Visually reorder elements in the DOM temporarily to show insertion point
          // This reordering uses the standard DOM structure, similar to mouse dragover
          // It only happens if the dragged element is not already in the correct place relative to the potential insertion point
          if (touchDraggedElement.parentElement === DOM.optionsContainer && touchDraggedElement !== insertBeforeElement) {
              // Check if insertBeforeElement is actually a child of optionsContainer
              // This is important if initialOptionRects includes elements not currently in the container (e.g., removed placeholders)
              if (insertBeforeElement === null || DOM.optionsContainer.contains(insertBeforeElement)) {
                  DOM.optionsContainer.insertBefore(touchDraggedElement, insertBeforeElement);
              } else {
                   // If the target element is somehow not in the container, just append to end
                   DOM.optionsContainer.appendChild(touchDraggedElement);
              }
          }

         // Optional: Update placeholder position if using one
         // console.log('Touch move', touch.clientX, touch.clientY, 'Target:', insertBeforeElement ? insertBeforeElement.textContent : 'End');
     }

     function handleTouchEnd(event) {
         // Only handle if a drag was in progress
         if (!touchDraggedElement) return;

         // Prevent default browser behavior (like click after touch)
         // event.preventDefault(); // Prevent default here might interfere with submit button click after drag end

         // The element is already in the correct temporary position in the DOM
         // from the last `touchmove` event. Now we just finalize styles.

         touchDraggedElement.classList.remove(CSS_CLASSES.DRAGGING);

         // Reset positioning styles applied during the drag
         touchDraggedElement.style.position = '';
         touchDraggedElement.style.zIndex = '';
         touchDraggedElement.style.left = '';
         touchDraggedElement.style.top = '';
         touchDraggedElement.style.width = ''; // Remove fixed width

         // Clean up state variables
         touchDraggedElement = null;
         touchDragOffset = { x: 0, y: 0 };
         initialOptionRects = []; // Clear stored rects
         // if (touchPlaceholder && touchPlaceholder.parentElement) {
         //     touchPlaceholder.parentElement.removeChild(touchPlaceholder);
         // }
         // touchPlaceholder = null;

         // console.log('Touch drag end');
     }

     function handleTouchCancel(event) {
          // Handle touch cancellation (e.g., too many touches, touch outside browser viewport)
          // Reset styles and state if a drag was in progress
          if (touchDraggedElement) {
             touchDraggedElement.classList.remove(CSS_CLASSES.DRAGGING);
             // Reset positioning styles
             touchDraggedElement.style.position = '';
             touchDraggedElement.style.zIndex = '';
             touchDraggedElement.style.left = '';
             touchDraggedElement.style.top = '';
             touchDraggedElement.style.width = '';
          }

          // Clean up state
          touchDraggedElement = null;
          touchDragOffset = { x: 0, y: 0 };
          initialOptionRects = [];
         // if (touchPlaceholder && touchPlaceholder.parentElement) {
         //     touchPlaceholder.parentElement.removeChild(touchPlaceholder);
         // }
         // touchPlaceholder = null;

         // console.log('Touch drag cancelled');
     }


    // Public API
    return {
        DOM, // Expose DOM elements for eventHandlers.js
        updateFilterDropdowns,
        updateQuestionStats,
        showSettings,
        showTest,
        showResults,
        displayQuestion,
        applyFeedbackStyles, // Needed by EventHandlers after submit
        disableOptions, // Needed by EventHandlers after submit
        enableOptions, // Needed by EventHandlers before displaying
        getUserAnswerFromUI, // Needed by EventHandlers on submit
        displayFeedback, // Needed by TestManager/App on finish
        updateScoreDisplay, // Needed by TestManager/App on finish
        updateProgressBar, // Needed by App/TestManager
        updateStarCount, // Needed by Gamification
        renderBadges, // Needed by Gamification
        // Note: Drag/Touch handlers are internal to UIRenderer as they manage UI state directly
        // They are attached to elements/container within renderOrderingOptions.
    };
})(Utils, TestManager); // Pass Utils and TestManager as arguments
