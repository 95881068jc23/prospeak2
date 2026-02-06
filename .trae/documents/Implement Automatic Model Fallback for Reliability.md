Based on the error message `No available channels for model gemini-2.5-flash`, the API provider (n1n.ai) currently does not have capacity or routing enabled for the `gemini-2.5-flash` model in your default group.

To resolve this permanently and prevent future service interruptions, I will implement an **Automatic Model Fallback Mechanism** in `services/geminiService.ts`.

**Plan:**

1. **Define Fallback Models**: Introduce a fallback list: `['gemini-2.0-flash', 'gemini-1.5-flash']`.
2. **Update** **`generateContentViaEdge`**: Refactor the function to automatically retry with a backup model if the primary model (e.g., `gemini-2.5-flash`) fails with a 503 (Service Unavailable) or 404 (Not Found) error.
3. **Benefit**: The app will attempt to use the latest model (2.5) first, but seamlessly switch to the stable 2.0 or 1.5 versions if the provider is experiencing issues, ensuring the app remains usable.
4. **Push to GitHub**: Commit and push the robust fix.

