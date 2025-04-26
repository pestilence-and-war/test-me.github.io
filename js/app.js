// js/app.js

Gamification.init(UIRenderer.updateStarCount, UIRenderer.renderBadges);

// Main application initialization
document.addEventListener('DOMContentLoaded', () => {
    console.log("Quiz App DOM fully loaded. Initializing...");

    // 1. Load initial data (questions)
    DataManager.loadSavedQuestions();
    DataManager.rebuildMasterFilterLists(); // Populate filter lists from loaded questions

    // Gamification is initialized by calling Gamification.init() after UIRenderer is ready
    // Gamification.loadGamificationData() is called *inside* Gamification.init()

    // 2. Update initial UI based on loaded data
    // Populate filter dropdowns and update stats based on initial state
    EventHandlers.updateFilterDropdownsAndStats(); // Call the combined function

    // 3. Bind all event listeners
    EventHandlers.bindEventListeners();

    // 4. Show the initial view (settings panel)
    UIRenderer.showSettings();

    console.log("Quiz App initialization complete.");
});

// Optional: Expose modules globally for debugging in the browser console
// window.Utils = Utils;
// window.DataManager = DataManager;
// window.TestManager = TestManager;
// window.UIRenderer = UIRenderer;
// window.EventHandlers = EventHandlers;
// window.Gamification = Gamification;
// window.FileHandler = FileHandler;
