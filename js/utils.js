// js/utils.js

const Utils = (function() {
    // --------------- CONSTANTS ---------------
    const LOCAL_STORAGE_KEYS = {
        QUESTIONS: 'mathQuestions',
        STAR_COUNT: 'starCount',
        BADGES: 'badges'
    };

    const FILTER_VALUES = {
        ALL: 'all',
        UNKNOWN: 'unknown',
        GENERAL: 'general'
    };

    const QUESTION_TYPES = {
        SINGLE: 'single',
        MULTI_SELECT: 'multi-select',
        FILL_IN: 'fill-in',
        ORDERING: 'ordering'
    };

    const CSS_CLASSES = {
        DRAG_OVER: 'drag-over',
        DRAGGING: 'dragging',
        SELECTED: 'selected',
        CORRECT: 'correct',
        INCORRECT: 'incorrect',
        DISABLED: 'disabled',
        DRAGGABLE: 'draggable',
        PULSE: 'pulse',
        SHAKE: 'shake',
        FILL_IN_INPUT: 'fill-in-input',
        OPTION: 'option'
        
    };

    const BADGE_THRESHOLDS = {
        BRONZE: 5,
        SILVER: 10,
        GOLD: 25,
        PLATINUM: 50,
        DIAMOND: 100
    };

     const BADGE_INFO = {
         [BADGE_THRESHOLDS.BRONZE]: { type: 'bronze', icon: 'fas fa-medal', text: 'Bronze' },
         [BADGE_THRESHOLDS.SILVER]: { type: 'silver', icon: 'fas fa-award', text: 'Silver' },
         [BADGE_THRESHOLDS.GOLD]: { type: 'gold', icon: 'fas fa-trophy', text: 'Gold' },
         [BADGE_THRESHOLDS.PLATINUM]: { type: 'platinum', icon: 'fas fa-crown', text: 'Platinum' },
         [BADGE_THRESHOLDS.DIAMOND]: { type: 'diamond', icon: 'fas fa-gem', text: 'Diamond' },
     };


    // --------------- UTILITY FUNCTIONS ---------------
    function shuffle(arr) {
        let currentIndex = arr.length,
            randomIndex;
        while (currentIndex !== 0) {
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;
            [arr[currentIndex], arr[randomIndex]] = [arr[randomIndex], arr[currentIndex]];
        }
        return arr;
    }

     function arraysAreEqual(arr1, arr2) {
         if (arr1.length !== arr2.length) return false;
         for (let i = 0; i < arr1.length; i++) {
             if (String(arr1[i]) !== String(arr2[i])) return false;
         }
         return true;
     }

     function showSuccessMessage(message) {
         console.log('Success:', message);
         // TODO: Implement user-facing message display (e.g., temporary banner)
     }

     function showWarningMessage(message) {
         console.warn('Warning:', message);
         // TODO: Implement user-facing warning display
     }

     function showErrorMessage(message) {
         console.error('Error:', message);
         // TODO: Implement user-facing error display
     }


    // Public API
    return {
        LOCAL_STORAGE_KEYS,
        FILTER_VALUES,
        QUESTION_TYPES,
        CSS_CLASSES,
        BADGE_THRESHOLDS,
        BADGE_INFO,
        shuffle,
        arraysAreEqual,
        showSuccessMessage,
        showWarningMessage,
        showErrorMessage
    };
})();
