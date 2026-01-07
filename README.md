<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1SzFilmfzFvI7PXcr2HZkYd0I_Yp9Uc1a

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the environment variable `GEMINI_API_KEY` (used by Vercel Edge Function via `process.env.GEMINI_API_KEY`)
   - Local: put it in `.env.local` (it is gitignored)
   - Vercel: add it in Project Settings → Environment Variables
3. Run locally with Vercel (so `/api/gemini` is available):
   `npm run dev:vercel`
