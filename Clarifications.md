# AI Interaction Clarifications & Best Practices

## Frequently Asked Questions

### 1. Does a long chat reduce AI response accuracy?
**Yes, significantly.**
*   **Why?** AI models have a fixed "Context Window" (e.g., 128k tokens). As the chat grows, older information gets pushed out or "compressed" to fit new messages.
*   **Impact:**
    *   **Hallucinations:** The AI may "forget" early instructions or hallucinate details it can no longer "see".
    *   **Loss of Focus:** It struggles to maintain the original goal if distracted by many unrelated side-tasks.
    *   **Performance:** Processing a huge history takes longer and increases the chance of timeout or error.
*   **Recommendation:** Start a **fresh session** for each distinct task or feature. Summarize key context (e.g., "We are using the `Deep Planning Engineer` prompt") at the start.

### 2. Does an inactive window make AI response slower?
**Technically No, but functionally Yes.**
*   **Server-Side:** The AI runs on a remote server, so your browser window state doesn't directly slow down the *computation*.
*   **Client-Side:** Modern browsers (Chrome, Edge) aggressively throttle background tabs to save battery/CPU. If the tab is inactive, the *network response* or *rendering* of the AI's reply might be delayed or paused until you focus the tab again.
*   **Recommendation:** Keep the AI tab active or check back frequently.

### 3. Does a multi-tab session make AI response slow or use a lower model?
**It depends on the platform.**
*   **Resource Limits:** Most platforms limit concurrent sessions per user. Opening multiple tabs might split your allocated resources, leading to queuing or slower generation speeds.
*   **Model Quality:** Some platforms might downgrade you to a faster, cheaper model if you are consuming excessive resources across multiple tabs simultaneously.
*   **State Confusion:** If tabs share local storage or session cookies, actions in one tab might confusingly bleed into another (though rare in well-designed apps).
*   **Recommendation:** Focus on **one active task** at a time for optimal performance and quality.

---

## ✅ Best Practices Checklist for "Deep Planning Engineer" Mode

To get the most out of the **Deep Planning Engineer** persona, follow this checklist:

### 1. 🚀 Start Fresh
- [ ] **New Session:** Always start a major feature or refactor in a clean chat.
- [ ] **Activate Mode:** Paste the **Activation Prompt** or use a trigger phrase like *"Activate Architect Mode"*.

### 2. 🎯 Define the Goal Clearly
- [ ] **Specific Outcome:** Instead of "Fix the bug", say "Fix the `DateParser` regex to handle ordinal dates like '10th Feb'".
- [ ] **Constraints:** Explicitly state what *not* to do (e.g., "Do not change the UI layout", "Do not add new dependencies").
- [ ] **Context:** Briefly mention relevant files if you know them (e.g., "Check `src/utils/dateExtractor.js`").

### 3. 🤝 Interactive Planning
- [ ] **Wait for the Plan:** Do not just say "Go". Let the Engineer propose a plan first.
- [ ] **Review the Plan:** Check if the plan misses anything (e.g., "Did you consider mobile view?", "What about error handling?").
- [ ] **Approve Explicitly:** Say "Plan looks good, proceed" or "Adjust step 2 to include..."

### 4. 🔄 Iterative Execution
- [ ] **One Step at a Time:** If a task is huge, ask the Engineer to "Do step 1 and stop for verification".
- [ ] **Verify Early:** Run the app or check the preview after major changes. Don't wait until the end.

### 5. 🧹 cleanup
- [ ] **Reflect:** Ask "Did we miss anything?" or "Is there any unused code to clean up?" before finishing.
- [ ] **Document:** Ask the Engineer to update `README.md` or `AGENTS.md` with new features or config options.

---
*Created by Deep Planning Engineer*
