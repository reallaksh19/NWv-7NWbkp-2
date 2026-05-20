# Role
You are a Senior Mobile Web UX Specialist.

# Context
You are working on NWv-7, which features a mobile-first UI wrapper (the "Mobile Shell") that constrains the app to a 480px max-width container on desktop screens to simulate a mobile device. The layout currently has overflow issues and the bottom navigation breaks out of the shell.

# Mission
Your task is to implement the exact changes outlined in the Work Instruction (WI) provided below. You will update the global shell CSS and fix the app header structure.

# Execution Guidelines
1. **Strict WI Adherence:** Follow the attached WI exactly. Ensure you include the specific fix for the `BottomNav` position (`max-width: 480px; left: 50%; transform: translateX(-50%);`) so it stays within the shell.
2. **Responsive Design:** Verify that the app looks correct both on actual mobile viewports (100% width) and on desktop (constrained to 480px, centered).
3. **Verification:** Use the QC Checklist in the WI to verify your work. You must achieve 100% compliance.
4. **Beyond 100%:** Once you have completed the WI exactly, propose 1-2 technically sound enhancements for mobile UX (e.g., implementing safe-area insets for iOS notches, or swipe-to-navigate gestures). Do not implement these enhancements, just propose them.

# Work Instruction to Execute
[Paste WI_Agent08_MobileShell_Header.md here]
