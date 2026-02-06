I will update the model configuration in `services/geminiService.ts` to switch from the unavailable `gemini-3-flash-preview` to the stable `gemini-2.0-flash`.

**Planned Changes:**
*   **File**: `services/geminiService.ts`
    *   Update `MODEL_NAME` from `"gemini-3-flash-preview"` to `"gemini-2.0-flash"`.
    *   Update `REPORT_MODEL_NAME` from `"gemini-3-flash-preview"` to `"gemini-2.0-flash"`.

This change will resolve the "No available channels" error (503) you are experiencing.