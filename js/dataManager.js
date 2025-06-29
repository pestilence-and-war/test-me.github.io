// player/js/dataManager.js (Simplified for API loading)
const DataManager = (function(Utils) {
    let questionBank = [];

    function loadQuizData(quizDataArray) {
        if (!Array.isArray(quizDataArray)) {
            questionBank = [];
            return;
        }
        // The data from the API is now our question bank
        questionBank = quizDataArray.map((q, i) => ({
            question: q.Question,
            options: q.Options,
            answer: q.answer,
            rationale: q.Rationale || "No rationale provided.",
            hint: q.hint || "",
            type: q.type,
            questionId: q.id || `q_${Date.now()}_${i}` 
        }));
    }
    
    // This function now just returns the entire loaded quiz
    function filterQuestions() {
        return [...questionBank];
    }

    return { loadQuizData, filterQuestions };
})(Utils);