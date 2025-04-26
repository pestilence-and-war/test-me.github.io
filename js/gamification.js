// js/gamification.js

const Gamification = (function(Utils) {
    // --------------- VARIABLES ---------------
    let unlockedBadges = new Set();
    let updateStarCountUI = null; // Placeholder for UIRenderer function
    let renderBadgesUI = null; // Placeholder for UIRenderer function


    // Access constants from Utils
    const LOCAL_STORAGE_KEYS = Utils.LOCAL_STORAGE_KEYS;
    const BADGE_THRESHOLDS = Utils.BADGE_THRESHOLDS;
    const BADGE_INFO = Utils.BADGE_INFO;
    const CSS_CLASSES = Utils.CSS_CLASSES;
    // We no longer directly access DOM elements here, delegate to UIRenderer via passed functions


    // --------------- INITIALIZATION (Called by App.js) ---------------
    function init(uiUpdateStarCount, uiRenderBadges) {
         updateStarCountUI = uiUpdateStarCount;
         renderBadgesUI = uiRenderBadges;
         loadGamificationData();
    }


    // --------------- GAMIFICATION LOGIC ---------------

    function loadGamificationData() {
        // Load stars
        const savedStars = parseInt(localStorage.getItem(LOCAL_STORAGE_KEYS.STAR_COUNT) || '0');
        if (updateStarCountUI) updateStarCountUI(savedStars); // Update UI immediately

        // Load badges
        const savedBadges = localStorage.getItem(LOCAL_STORAGE_KEYS.BADGES);
        if (savedBadges) {
            try {
                const parsedBadges = JSON.parse(savedBadges);
                if (Array.isArray(parsedBadges)) {
                    unlockedBadges = new Set(parsedBadges);
                     console.log(`Loaded ${unlockedBadges.size} badges from local storage.`);
                } else {
                     Utils.showWarningMessage("Local storage badges format is unexpected. Clearing badges.");
                     console.warn("Local storage badges format is unexpected or old HTML. Clearing badges.");
                     unlockedBadges = new Set(); // Reset badges
                     localStorage.removeItem(LOCAL_STORAGE_KEYS.BADGES); // Clear the bad entry
                }
            } catch (e) {
                Utils.showErrorMessage('Error parsing local storage badges. Assuming old format and clearing.');
                console.error('Error parsing local storage badges as JSON. Assuming old format and clearing.', e);
                unlockedBadges = new Set(); // Reset badges
                localStorage.removeItem(LOCAL_STORAGE_KEYS.BADGES); // Clear the bad entry
            }
        } else {
            unlockedBadges = new Set(); // No saved badges
             console.log("No badges found in local storage.");
        }

        renderBadges(); // Render badges based on loaded state
        maybeUnlockBadge(); // Check if any new badges are unlocked based on loaded stars (e.g., if threshold was lowered)
    }

    function saveGamificationData() {
        try {
             // Get current star count from the UI element using the provided update function
             const currentStars = parseInt(document.getElementById('star-count').textContent || '0'); // Direct DOM access is okay here as it's the source of truth for UI state
            localStorage.setItem(LOCAL_STORAGE_KEYS.STAR_COUNT, currentStars);
            localStorage.setItem(LOCAL_STORAGE_KEYS.BADGES, JSON.stringify(Array.from(unlockedBadges)));
             console.log("Gamification data saved.");
        } catch (e) {
             Utils.showErrorMessage('Error saving gamification data.');
            console.error('Error saving gamification data', e);
        }
    }

    function incrementStars(n) {
         const starSpan = document.getElementById('star-count'); // Direct DOM access
         if (!starSpan) return;

        let val = parseInt(starSpan.textContent || '0');
        val += n;
        if (updateStarCountUI) updateStarCountUI(val); // Update UI via passed function
        starSpan.classList.add(CSS_CLASSES.PULSE); // Add animation class directly
        setTimeout(() => starSpan.classList.remove(CSS_CLASSES.PULSE), 1000); // Remove after animation
        saveGamificationData(); // Save the updated star count
        maybeUnlockBadge(); // Check if a new badge is unlocked
    }

    function maybeUnlockBadge() {
        const currentStars = parseInt(document.getElementById('star-count').textContent || '0'); // Direct DOM access is okay

        let badgesUnlockedThisCheck = false;

        // Iterate through badge thresholds
        Object.entries(BADGE_THRESHOLDS).forEach(([key, threshold]) => {
            const badgeInfo = BADGE_INFO[threshold];
            // Check if threshold is met and badge is not already unlocked
            if (currentStars >= threshold && badgeInfo && !unlockedBadges.has(badgeInfo.type)) {
                unlockedBadges.add(badgeInfo.type);
                badgesUnlockedThisCheck = true;
                console.log(`Badge Unlocked: ${badgeInfo.text}!`);
                // Optional: Add a visual notification for the user
            }
        });

        if (badgesUnlockedThisCheck) {
            renderBadges(); // Re-render the badge display
            saveGamificationData(); // Save the new badge state
        }
    }

    function renderBadges() {
        // Get badge info for unlocked types, sort by threshold
        const badgeThresholds = Object.values(BADGE_THRESHOLDS).sort((a, b) => a - b); // Ensure thresholds are sorted numerically
        const badgesToRender = Array.from(unlockedBadges)
            .map(type => Object.values(BADGE_INFO).find(info => info.type === type))
            .filter(info => info) // Filter out any types not found in BADGE_INFO (shouldn't happen if keys are correct)
            .sort((a, b) => {
                // Find the numerical threshold for sorting
                const thresholdA = Object.keys(BADGE_THRESHOLDS).find(key => BADGE_INFO[BADGE_THRESHOLDS[key]].type === a.type);
                const thresholdB = Object.keys(BADGE_THRESHOLDS).find(key => BADGE_INFO[BADGE_THRESHOLDS[key]].type === b.type);
                return BADGE_THRESHOLDS[thresholdA] - BADGE_THRESHOLDS[thresholdB];
            });

        if (renderBadgesUI) renderBadgesUI(badgesToRender); // Delegate rendering to UIRenderer via passed function
    }

    function resetProgress() {
        // Reset in-memory state
        if (updateStarCountUI) updateStarCountUI(0); // Reset star count UI via passed function
        unlockedBadges = new Set(); // Clear the set of unlocked badges

        // Update UI
        renderBadges(); // Render the now empty badge container

        // Save to local storage
        saveGamificationData(); // Save the reset state
    }


    // Public API
    return {
        init, // New init function called by App.js
        incrementStars, // Called by EventHandlers on correct answer
        resetProgress, // Called by EventHandlers (Danger Zone)
        // renderBadges is now called internally or via init
    };
})(Utils); // Pass Utils as an argument
