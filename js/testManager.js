// js/testManager.js

const TestManager = (function(Utils) {
    // --------------- VARIABLES ---------------
    let currentTest = [];
    let currentQuestionIndex = 0;
    let userAnswers = []; // Stores objects like { question: {}, userAnswer: any, correct: boolean }
    let userScore = 0;

     // Access constants and utilities from Utils
     const QUESTION_TYPES = Utils.QUESTION_TYPES;
     const arraysAreEqual = Utils.arraysAreEqual;
     const shuffle = Utils.shuffle;
     const showWarningMessage = Utils.showWarningMessage;

    // --------------- TEST LOGIC ---------------
    function startNewTest(questions, length) {
        if (!questions || questions.length === 0) {
            showWarningMessage("No questions available for the test.");
            return false; // Indicate test could not start
        }
        if (questions.length < length) {
             showWarningMessage("Not enough questions matching your filters for the selected test length.");
             return false; // Indicate test could not start
        }

        // Select and shuffle questions
        currentTest = shuffle([...questions]).slice(0, length); // Use a copy of the array
        userAnswers = new Array(currentTest.length).fill(null);
        userScore = 0;
        currentQuestionIndex = 0;

        console.log(`Starting new test with ${currentTest.length} questions.`);
        return true; // Indicate test started successfully
    }

    function getCurrentQuestion() {
        if (currentQuestionIndex >= 0 && currentQuestionIndex < currentTest.length) {
            return currentTest[currentQuestionIndex];
        }
        return null;
    }

    function getUserAnswerForCurrentQuestion() {
        if (currentQuestionIndex >= 0 && currentQuestionIndex < userAnswers.length) {
            return userAnswers[currentQuestionIndex];
        }
        return null;
    }

     // Check if an answer was actually provided (relevant for non-ordering types)
     function isAnswerProvided(userAnswer, questionType) {
         if ((userAnswer === null || userAnswer === undefined || userAnswer === "") && questionType !== QUESTION_TYPES.ORDERING && questionType !== QUESTION_TYPES.MULTI_SELECT) {
             return false;
         }
         if (Array.isArray(userAnswer) && userAnswer.length === 0 && questionType !== QUESTION_TYPES.ORDERING && questionType !== QUESTION_TYPES.MULTI_SELECT) {
             return false;
         }
         return true;
     }


    function submitAnswer(userAnswer) {
        // Prevent submitting if already answered
        if (userAnswers[currentQuestionIndex] !== null) {
             console.warn("Attempted to submit answer for already answered question.");
            return { success: false, correct: false, alreadyAnswered: true };
        }

        const currentQuestion = getCurrentQuestion();
         const questionType = currentQuestion.type || Utils.QUESTION_TYPES.SINGLE;

         // Check if an answer was actually provided (relevant for non-ordering types)
         if (!isAnswerProvided(userAnswer, questionType)) {
             showWarningMessage("Please provide an answer before submitting.");
             return { success: false, correct: false, noAnswer: true };
         }


        const correct = isCorrect(currentQuestion, userAnswer);

        // Store the answer and its correctness
        userAnswers[currentQuestionIndex] = {
            question: currentQuestion,
            userAnswer: userAnswer,
            correct: correct
        };

        // Update score if correct
        if (correct) {
            userScore++;
        }

        console.log(`Answer submitted for question ${currentQuestionIndex + 1}. Correct: ${correct}`);

        return { success: true, correct: correct };
    }

     function isCorrect(question, userAnswer) {
         // This logic was previously in the main script, now moved here
         const correctAnswer = question.answer;
         const questionType = question.type || Utils.QUESTION_TYPES.SINGLE;

         // isAnswerProvided check already happened in submitAnswer, but good to be defensive
          if (!isAnswerProvided(userAnswer, questionType)) {
              return false;
          }

         switch (questionType) {
             case QUESTION_TYPES.FILL_IN:
                 const cleanUser = String(userAnswer).trim().replace(/[, ]/g, "");
                 const cleanCorrect = String(correctAnswer).trim().replace(/[, ]/g, "");

                 const userNum = parseFloat(cleanUser);
                 const correctNum = parseFloat(cleanCorrect);

                 // Compare numbers if both are valid, otherwise compare strings case-insensitively
                 if (!isNaN(userNum) && !isNaN(correctNum)) {
                     return Math.abs(userNum - correctNum) < 1e-9; // Use a small tolerance for floating point comparison
                 } else {
                     return cleanUser.toLowerCase() === cleanCorrect.toLowerCase();
                 }

             case QUESTION_TYPES.MULTI_SELECT:
                 const correctAnswersArray = Array.isArray(correctAnswer) ? correctAnswer.map(String) : [String(correctAnswer)];
                 const userAnswersArray = Array.isArray(userAnswer) ? userAnswer.map(String) : [];

                 if (correctAnswersArray.length !== userAnswersArray.length) return false;

                 // Need sorted copies for comparison
                 const sortedCorrect = [...correctAnswersArray].sort();
                 const sortedUser = [...userAnswersArray].sort();

                 return arraysAreEqual(sortedCorrect, sortedUser);

             case QUESTION_TYPES.ORDERING:
                 const correctOrderArray = Array.isArray(correctAnswer) ? correctAnswer.map(String) : [];
                 const userOrderArray = Array.isArray(userAnswer) ? userAnswer.map(String) : [];

                 return arraysAreEqual(userOrderArray, correctOrderArray);

             default: // Single choice
                 return String(userAnswer) === String(correctAnswer);
         }
     }


    function showNextQuestion() {
        if (currentQuestionIndex < currentTest.length - 1) {
            currentQuestionIndex++;
            console.log(`Moving to question ${currentQuestionIndex + 1}`);
            return currentTest[currentQuestionIndex];
        }
        return null; // Indicates end of test
    }

    function showPreviousQuestion() {
        if (currentQuestionIndex > 0) {
            currentQuestionIndex--;
             console.log(`Moving to previous question ${currentQuestionIndex + 1}`);
            return currentTest[currentQuestionIndex];
        }
        return null; // Indicates already at the first question
    }

    function isTestFinished() {
        // A test is finished when the last question has been answered
        return currentTest.length > 0 && currentQuestionIndex === currentTest.length - 1 && userAnswers[currentQuestionIndex] !== null;
    }

     function resetTestState() {
         currentTest = [];
         currentQuestionIndex = 0;
         userAnswers = [];
         userScore = 0;
         console.log("Test state reset.");
     }

     function getCurrentTestResults() {
         const correctCount = userAnswers.filter(a => a && a.correct).length;
         const totalQuestions = currentTest.length;
         const finalPercentage = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;

         return {
             score: finalPercentage,
             correctCount: correctCount,
             totalQuestions: totalQuestions,
             userAnswers: [...userAnswers] // Return a copy
         };
     }

     function getQuestionCount() {
         return currentTest.length;
     }

     function getCurrentQuestionIndex() {
         return currentQuestionIndex;
     }

     function isQuestionAnswered(index) {
         const idx = index !== undefined ? index : currentQuestionIndex;
         return userAnswers[idx] !== null;
     }

     function isFirstQuestion() {
         return currentQuestionIndex === 0;
     }

     function isLastQuestion() {
         return currentQuestionIndex === currentTest.length - 1;
     }


    // Public API
    return {
        startNewTest,
        getCurrentQuestion,
        getUserAnswerForCurrentQuestion,
        submitAnswer,
        showNextQuestion,
        showPreviousQuestion,
        isTestFinished,
        resetTestState,
        getCurrentTestResults,
        getQuestionCount,
        getCurrentQuestionIndex,
        isQuestionAnswered,
        isFirstQuestion,
        isLastQuestion,
        isCorrect // Expose for UI rendering feedback
    };
})(Utils); // Pass Utils as an argument
