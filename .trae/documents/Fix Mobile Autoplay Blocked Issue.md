Based on the "Autoplay Blocked" error on mobile, this is a known behavior in mobile browsers (iOS Safari, Android Chrome) where audio cannot play automatically without a direct user interaction (like a tap).

**The Issue:**
The "Autoplay Blocked" alert you are seeing is triggered by the error callback in `playQuestionAudio` (lines 165-178 of `TestInterface.tsx`). This happens when the browser prevents the audio from playing because it wasn't triggered by a direct user click.

**The Solution:**
I will implement a "Tap to Play" overlay pattern for mobile devices when autoplay is blocked.

1. **Modify** **`TestInterface.tsx`**:

   * Add a new state `showPlayOverlay` to control the visibility of a manual play button.

   * Update the error handling in `playQuestionAudio`: Instead of immediately showing a confusing `window.confirm` alert, I will set `showPlayOverlay(true)`.

   * Render a "Tap to Play Audio" overlay button when `showPlayOverlay` is true.

   * When the user taps this button, it will resume/play the audio (which counts as a user interaction) and then hide the overlay.

This approach is standard for mobile web apps to handle audio autoplay restrictions gracefully.

**Steps:**

1. Update `components/TestInterface.tsx` to include the `showPlayOverlay` state and UI.
2. Refactor the `playQuestionAudio` error callback to trigger this overlay instead of the `window.confirm` dialog for autoplay errors.
3. Commit and push the changes.

