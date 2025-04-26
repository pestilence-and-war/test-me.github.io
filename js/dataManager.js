// js/dataManager.js

const DataManager = (function(Utils) {
    // --------------- VARIABLES ---------------
    let questionBank = [];
    let subjectList = new Set();
    let gradeLevelList = new Set();
    let identifierList = new Set();

    // Access constants from Utils
    const LOCAL_STORAGE_KEYS = Utils.LOCAL_STORAGE_KEYS;
    const FILTER_VALUES = Utils.FILTER_VALUES;

    // --------------- QUESTION MANAGEMENT ---------------

    function loadSavedQuestions() {
        try {
            const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.QUESTIONS);
            questionBank = saved ? JSON.parse(saved) : [];
            console.log(`Loaded ${questionBank.length} questions from local storage.`);
        } catch (e) {
            Utils.showErrorMessage('Error parsing saved questions. Clearing saved data.');
            console.error('Error parsing saved questions', e);
            localStorage.removeItem(LOCAL_STORAGE_KEYS.QUESTIONS);
            questionBank = [];
        }
    }

    function rebuildMasterFilterLists() {
        subjectList.clear();
        gradeLevelList.clear();
        identifierList.clear();
        questionBank.forEach(q => {
            subjectList.add(q.filenameData.subject || FILTER_VALUES.GENERAL);
            gradeLevelList.add(q.filenameData.gradeLevel || FILTER_VALUES.UNKNOWN);
            identifierList.add(q.filenameData.identifier || FILTER_VALUES.UNKNOWN);
        });
         console.log(`Rebuilt filter lists: Subjects(${subjectList.size}), Grades(${gradeLevelList.size}), Identifiers(${identifierList.size})`);
    }

    function saveQuestionsToLocalStorage() {
        try {
            localStorage.setItem(LOCAL_STORAGE_KEYS.QUESTIONS, JSON.stringify(questionBank));
            console.log("Questions saved to local storage.");
        } catch (e) {
             Utils.showErrorMessage('Error saving questions to local storage.');
            console.error('Error saving questions', e);
        }
    }

     function parseFilename(fname) {
         const parts = fname.replace('.json', '').split('_');
         const subject = parts[0] || FILTER_VALUES.GENERAL;
         let gradeLevel = FILTER_VALUES.UNKNOWN;
         let identifier = FILTER_VALUES.UNKNOWN;
         const gi = parts.findIndex(p => p.startsWith('grade') && !isNaN(parseInt(p.replace('grade', ''))));
         if (gi !== -1) {
             gradeLevel = parts[gi].replace('grade', '');
             identifier = parts.slice(gi + 1).join('_') || FILTER_VALUES.UNKNOWN;
         } else {
             identifier = parts.slice(1).join('_') || FILTER_VALUES.UNKNOWN;
         }
         identifier = identifier.replace(/_+$/, '');
         identifier = identifier || FILTER_VALUES.UNKNOWN;
         return {
             subject,
             gradeLevel,
             identifier,
             full: fname
         };
     }


    function addQuestionToBankInternal(q) {
        // Ensure question has a unique ID
        q.questionId = q.questionId || `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Check if a question with the same ID already exists
        if (!questionBank.some(qq => qq.questionId === q.questionId)) {
            // Ensure filenameData exists
            q.filenameData = q.filenameData || {
                subject: FILTER_VALUES.GENERAL,
                gradeLevel: FILTER_VALUES.UNKNOWN,
                identifier: FILTER_VALUES.UNKNOWN,
                full: 'unknown.json'
            };
            questionBank.push(q);
            return true; // Question was added
        }
        return false; // Question was a duplicate
    }

    function addQuestionsAndUpdateFilters(qs) {
        let count = 0;
        qs.forEach(q => {
            if (addQuestionToBankInternal(q)) count++;
        });
        if (count > 0) {
            saveQuestionsToLocalStorage();
            rebuildMasterFilterLists(); // Rebuild filter lists after adding new questions
        }
        return count; // Return number of new questions added
    }

     function deleteQuestions() {
         questionBank = [];
         localStorage.removeItem(LOCAL_STORAGE_KEYS.QUESTIONS);
         rebuildMasterFilterLists(); // Rebuild filter lists after deleting
     }


    // --------------- FILTERING ---------------
    function filterQuestions(subject, grade, identifier) {
        return questionBank.filter(q => {
            const qSubject = q.filenameData.subject || FILTER_VALUES.GENERAL;
            const qGrade = q.filenameData.gradeLevel || FILTER_VALUES.UNKNOWN;
            const qIdentifier = q.filenameData.identifier || FILTER_VALUES.UNKNOWN;
            const sm = subject === FILTER_VALUES.ALL || qSubject === subject;
            const gm = grade === FILTER_VALUES.ALL || qGrade === grade;
            const im = identifier === FILTER_VALUES.ALL || qIdentifier === identifier;
            return sm && gm && im;
        });
    }

    // --------------- GETTERS ---------------
    function getFilterLists() {
        return {
            subjectList: new Set(subjectList), // Return copies to prevent external modification
            gradeLevelList: new Set(gradeLevelList),
            identifierList: new Set(identifierList)
        };
    }

    function getQuestionBank() {
        return [...questionBank]; // Return a copy of the array
    }

    function getQuestionCount() {
        return questionBank.length;
    }


    // Public API
    return {
        loadSavedQuestions,
        rebuildMasterFilterLists,
        saveQuestionsToLocalStorage, // Might be needed externally if other modules trigger saves
        parseFilename, // Needed by FileHandler
        addQuestionsAndUpdateFilters, // Needed by FileHandler
        deleteQuestions, // Needed by EventHandlers (Danger Zone)
        filterQuestions, // Needed by TestManager (to get test pool) and EventHandlers (to update stats)
        getFilterLists, // Needed by UIRenderer (to populate filters) and EventHandlers (to update stats)
        getQuestionBank, // Might be needed for debugging or future features
        getQuestionCount // Needed by EventHandlers (to update stats)
    };
})(Utils); // Pass Utils as an argument
