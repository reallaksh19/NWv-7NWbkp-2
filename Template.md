# 🗺️ Interaction Template: The Deep Planning Loop

This document serves as a **live script** or **template** for interacting with the "Deep Planning Engineer" persona. Follow this flow to maximize success on complex tasks.

---

## 🟢 Step 1: Activation & Intent
**Goal:** Wake up the "Architect" and define the high-level mission.

**User Prompt:**
> **"Activate Architect Mode. Deep Plan First."**
>
> I want to add a new **"Crypto Tracker"** widget to the dashboard.
> It should show Bitcoin and Ethereum prices.
> Please analyze the codebase and propose a plan.

**(What happens next):** The Engineer will read your prompt, scan the file structure (`list_files`), and read relevant existing components (`Header.jsx`, `MarketContext.js`) to understand where this new feature fits.

---

## 🟡 Step 2: The Interrogation (Clarification)
**Goal:** Eliminate ambiguity. The Engineer will **STOP** and ask you questions.

**Engineer Response (Simulated):**
> "I understand you want a Crypto Tracker. I see we already have a `MarketTicker` component.
>
> 1.  Should this be part of the existing `MarketTicker` or a completely separate widget?
> 2.  Do you have a preferred public API for crypto prices (e.g., CoinGecko)?
> 3.  Where should this be placed on mobile vs. desktop?
>
> I will not proceed until these are clarified."

**User Response:**
> 1.  It should be a separate widget below the Weather card.
> 2.  Use CoinGecko free API.
> 3.  On mobile, it should be a horizontal scroll list. On desktop, a grid.

---

## 🟠 Step 3: The Plan Proposal
**Goal:** Agree on the roadmap.

**Engineer Response (Simulated):**
> "Based on your requirements, here is the plan:
>
> 1.  **Create `CryptoService.js`**: Handle API fetching with caching (1 min TTL) to respect rate limits.
> 2.  **Create `CryptoWidget.jsx`**: Responsive component (Flex on mobile, Grid on desktop).
> 3.  **Update `MainPage.jsx`**: Insert the widget below `WeatherCard`.
> 4.  **Add Settings**: Allow users to toggle this widget on/off.
>
> Please approve this plan."

**User Response:**
> **"Plan approved. Please start with Step 1."**

---

## 🔵 Step 4: Iterative Execution (The Build Loop)
**Goal:** Build safely, verify constantly.

**Engineer Action:**
*   Creates `src/services/CryptoService.js`.
*   *Self-Correction:* "Wait, CoinGecko API requires a specific header? Let me verify the docs..."
*   *Verification:* Runs a test script or checks the file content.

**Engineer Response:**
> "Step 1 Complete. `CryptoService.js` is created and tested with a mock response.
>
> **Next:** I will build the UI component `CryptoWidget.jsx`."

**User Response:**
> "Proceed."

---

## 🟣 Step 5: Verification & Review
**Goal:** Ensure quality before finishing.

**Engineer Action:**
*   Connects the UI to the Service.
*   Runs the build (`npm run build`).
*   Checks for linting errors.

**Engineer Response:**
> "Feature implemented.
> *   ✅ Service fetches live data.
> *   ✅ Widget adapts to mobile/desktop.
> *   ✅ Added a 'Show Crypto' toggle in Settings (default: On).
>
> Please verify the screenshot (if available) or the code logic."

**User Response:**
> "Looks great. Can we just add a small 'Last Updated' timestamp?"

**(Loop back to Step 4 for small adjustment)**

---

## 🏁 Step 6: Completion
**Goal:** Finalize and Document.

**Engineer Response:**
> "Timestamp added. All checks passed.
>
> **Summary of Changes:**
> *   Created `CryptoService.js`
> *   Created `CryptoWidget.jsx`
> *   Modified `MainPage.jsx`, `SettingsPage.jsx`
>
> Ready to submit."

**User Response:**
> **"Submit."**

---

### 🔑 Key Takeaways for You (The User)

1.  **Don't Dump & Run:** Stay engaged during Step 2 (Clarification). That's where 90% of bugs are prevented.
2.  **Explicit Approval:** The Engineer is trained *not* to guess. You must say "Yes/Approved".
3.  **One Step at a Time:** If the task is huge, ask the Engineer to "Stop after Step X".

*Use this template to structure your requests, and you will get consistent, high-quality engineering work.*
