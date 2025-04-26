// js/fileHandler.js

const FileHandler = (function(Utils, DataManager) {
    // Handles reading and processing JSON files

    // Access constants from Utils
    const QUESTION_TYPES = Utils.QUESTION_TYPES;
    const FILTER_VALUES = Utils.FILTER_VALUES;
    const showSuccessMessage = Utils.showSuccessMessage;
    const showWarningMessage = Utils.showWarningMessage;
    const showErrorMessage = Utils.showErrorMessage;

    // DataManager is passed as an argument
    // EventHandlers is not directly accessed here; a callback is used.


    function parseFilename(fname) {
        // Re-implement or call DataManager's parseFilename
         return DataManager.parseFilename(fname); // Use the function from DataManager
    }

    // Accept a callback function to be executed after files are processed
    function handleFileSelection(fileList, callback) {
        if (!fileList || fileList.length === 0) {
            if (callback) callback(); // Call callback even if no files
            return;
        }

        // Convert FileList to Array
        const files = Array.from(fileList);
        let filesProcessed = 0; // Counter for tracking when all files are done

        const processFile = (file) => {
             if (!file.name.toLowerCase().endsWith('.json')) {
                 showWarningMessage(`Skipping file "${file.name}": Not a JSON file.`);
                 filesProcessed++;
                 if (filesProcessed === files.length && callback) callback();
                 return;
             }

             const reader = new FileReader();

             reader.addEventListener('load', evt => {
                 try {
                     const content = JSON.parse(evt.target.result);
                     // Ensure content is treated as an array of questions
                     const arr = Array.isArray(content) ? content : [content];
                     const meta = parseFilename(file.name);

                     const newQs = arr.map((q, i) => {
                         // Basic validation for required fields
                         if (!q.Question || q.answer === undefined || q.answer === null) {
                             console.warn(`Skipping item ${i} in "${file.name}": Missing "Question" or "answer" field.`);
                             return null; // Skip this item
                         }

                         // Determine question type
                         const type = q.type || (q.Options ? (Array.isArray(q.answer) ? QUESTION_TYPES.MULTI_SELECT : QUESTION_TYPES.SINGLE) : QUESTION_TYPES.FILL_IN);

                         // Validate options for option-based types
                         if ((type === QUESTION_TYPES.SINGLE || type === QUESTION_TYPES.MULTI_SELECT || type === QUESTION_TYPES.ORDERING) && (!q.Options || !Array.isArray(q.Options) || q.Options.length === 0)) {
                             console.warn(`Skipping item ${i} in "${file.name}": Type "${type}" but missing or empty "Options" array.`);
                             return null; // Skip this item
                         }

                         // Construct the question object
                         return {
                             question: q.Question,
                             options: q.Options, // Will be undefined for fill-in
                             answer: q.answer,
                             rationale: q.Rationale || "No rationale provided.",
                             hint: q.hint || "",
                             type: type,
                             filenameData: meta,
                             questionId: `${file.name}_${i}` // Generate a unique ID based on file and index
                         };
                     }).filter(q => q !== null); // Filter out any null entries from validation failures

                     // Add valid questions to the DataManager and update UI
                     const addedCount = DataManager.addQuestionsAndUpdateFilters(newQs);

                     if (addedCount > 0) {
                         showSuccessMessage(`Successfully loaded ${addedCount} new questions from "${file.name}".`);
                     } else if (newQs.length > 0) {
                         // If newQs had items but none were added, they must have been duplicates
                          showWarningMessage(`No *new* questions added from "${file.name}" (might be duplicates).`);
                     } else {
                          // If newQs was empty after filtering, no valid questions were found in the file
                          showWarningMessage(`No valid questions found in "${file.name}".`);
                     }

                 } catch (err) {
                     showErrorMessage(`Error processing file "${file.name}": ${err.message}`);
                     console.error(`Error processing file "${file.name}":`, err);
                 } finally {
                      filesProcessed++;
                      // Call the callback when this file is done processing
                      if (filesProcessed === files.length && callback) {
                          callback();
                      }
                 }
             });

             reader.addEventListener('error', () => {
                 showErrorMessage(`Error reading file "${file.name}".`);
                 console.error(`Error reading file "${file.name}".`);
                  filesProcessed++;
                  // Call the callback on error too
                  if (filesProcessed === files.length && callback) {
                      callback();
                  }
             });

             // Start reading the file
             reader.readAsText(file);
        };

        // Process each file
        files.forEach(file => processFile(file));

    }


    // Public API
    return {
        handleFileSelection // Called by EventHandlers, takes files and a callback
    };
})(Utils, DataManager); // Pass Utils and DataManager as arguments
