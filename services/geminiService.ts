
import { GoogleGenAI, Type } from "@google/genai";
import { TestReport, Message, UserProfile, Avatar, AnalysisItem, SuggestionItem, LearningConfig, PlaybackSpeed, LessonPlan, Topic, UploadedFile } from "../types";
import { ASSESSMENT_SCRIPTS } from "../constants";

// Safe API Key retrieval
const getApiKey = (): string => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_KEY) {
      return import.meta.env.VITE_API_KEY;
    }
    if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
      return process.env.API_KEY;
    }
  } catch (e) {}
  return '';
};

const getAI = () => new GoogleGenAI({ 
  apiKey: getApiKey(),
  httpOptions: {
    baseUrl: "https://api.n1n.ai",
    apiVersion: "v1"
  }
});

const MODEL_NAME = "gemini-3-flash-preview"; 
const REPORT_MODEL_NAME = "gemini-3-flash-preview"; 
const TTS_MODEL_NAME = "gemini-2.5-flash-preview-tts";

// CACHE UTILITIES
// Bump version to v5 to invalidate old schema
const PLAN_CACHE_KEY = "marvel_prospeak_plans_cache_v5";

export const getStoredPlans = (): Record<string, LessonPlan> => {
    try {
        const data = localStorage.getItem(PLAN_CACHE_KEY);
        return data ? JSON.parse(data) : {};
    } catch { return {}; }
};

export const isPlanCached = (topicId: string, level: string): boolean => {
    const key = `TOPIC_${topicId}_${level}`;
    const plans = getStoredPlans();
    return !!plans[key];
};

const saveStoredPlan = (key: string, plan: LessonPlan) => {
    try {
        const plans = getStoredPlans();
        plans[key] = plan;
        localStorage.setItem(PLAN_CACHE_KEY, JSON.stringify(plans));
    } catch (e) {
        console.warn("Cache quota exceeded, clearing old plans.");
        try { localStorage.removeItem(PLAN_CACHE_KEY); } catch {}
    }
};

export const clearLessonPlanCache = () => {
    try { 
        localStorage.removeItem(PLAN_CACHE_KEY);
        alert("Local lesson cache cleared.");
    } catch {}
};

// Gemini 2.5 TTS Voices Map
// Puck (M), Charon (M), Fenrir (M), Aoede (F), Kore (F)
const GEMINI_VOICE_MAP: Record<string, string> = {
  'Lily': 'Aoede', 
  'Emma': 'Aoede', 
  'James': 'Fenrir',
  'Sophia': 'Kore', // Changed to Kore (Female)
  'David': 'Charon', 
  'Olivia': 'Kore',
  'Harry': 'Fenrir', 
  'Kevin': 'Puck', 
  'Frank': 'Charon', 
  'Amy': 'Kore'
};

function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function cleanJson(text: string): string {
  if (!text) return "{}";
  const firstBrace = text.indexOf('{');
  const firstBracket = text.indexOf('[');
  if (firstBrace === -1 && firstBracket === -1) return text;
  if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
      const lastBracket = text.lastIndexOf(']');
      if (lastBracket !== -1) return text.substring(firstBracket, lastBracket + 1);
  } else if (firstBrace !== -1) {
      const lastBrace = text.lastIndexOf('}');
      if (lastBrace !== -1) return text.substring(firstBrace, lastBrace + 1);
  }
  return text;
}

// --------------------------------------------------------------------------
// Content Parsing (PPT/PDF to Text)
// --------------------------------------------------------------------------

export const parseCourseMaterials = async (files: UploadedFile[]): Promise<string> => {
    if (!files || files.length === 0) return "";
    
    const ai = getAI();
    try {
        const parts = files.map(file => ({
            inlineData: {
                mimeType: file.mimeType || 'application/pdf',
                data: file.data
            }
        }));

        const prompt = `
        Analyze these course materials (PPT/PDF/Images).
        
        TASK: Extract a structured course context for an English tutor.
        Output Format (Plain Text):
        
        [Topic Summary]
        (Brief overview of what this is about)

        [Key Vocabulary]
        (List of important terms found in the slides)

        [Key Scenarios / Dialogue Context]
        (Describe specific situations, roleplays, or interactions mentioned)

        [Key Knowledge Points]
        (Bullet points of the core content)

        [Objection Handling / Q&A]
        (If present, list common questions and answers)

        INSTRUCTION: Ignore visual layout details. Focus on the TEXT content and TEACHING VALUE.
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview", // Use 2.5 Flash for Multimodal per user request
            contents: [{ 
                role: 'user', 
                parts: [
                    ...parts,
                    { text: prompt }
                ] 
            }]
        });

        return response.text.trim();
    } catch (e) {
        console.error("Material parsing failed", e);
        return "Error parsing materials. Please try pasting text manually.";
    }
};

// --------------------------------------------------------------------------
// Audio & Voice Service (Refactored for Pitch Preservation)
// --------------------------------------------------------------------------

// TTS Cleaning Function
// Removes Emojis, Markdown (*, #), and Action text (*laughs*)
function cleanTextForTTS(text: string): string {
    if (!text) return "";
    return text
        // Remove text between asterisks (e.g., *laughs*, *sigh*)
        .replace(/\*[^*]+\*/g, '')
        // Remove markdown symbols
        .replace(/[*#_`~]/g, '') 
        // Remove Emojis (Unicode ranges for Pictographs)
        .replace(/[\u{1F600}-\u{1F6FF}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F018}-\u{1F270}]/gu, '')
        // Collapse multiple spaces
        .replace(/\s+/g, ' ')
        .trim();
}

// WAV Header Helper
function buildWavHeader(dataLength: number, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44);
  const view = new DataView(buffer);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // file length
  view.setUint32(4, 36 + dataLength, true);
  // RIFF type
  writeString(view, 8, 'WAVE');
  // format chunk identifier
  writeString(view, 12, 'fmt ');
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (raw)
  view.setUint16(20, 1, true);
  // channel count (1)
  view.setUint16(22, 1, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sampleRate * blockAlign)
  view.setUint32(28, sampleRate * 2, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, 2, true);
  // bits per sample
  view.setUint16(34, 16, true);
  // data chunk identifier
  writeString(view, 36, 'data');
  // data chunk length
  view.setUint32(40, dataLength, true);

  return buffer;
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

class HybridVoiceService {
    private currentAudio: HTMLAudioElement | null = null;
    private playbackSpeed: number = 1.0;
    private audioCache: Record<string, string> = {}; // Key: text+voice, Value: Blob URL
    
    // Web Speech API fallback
    private synthesis: SpeechSynthesis = window.speechSynthesis;

    constructor() {}

    ensureAudioContext() {
        // Keeps context logical consistent for recording but not strictly needed for HTMLAudioElement
    }

    setSpeed(speed: PlaybackSpeed) {
        this.playbackSpeed = speed;
        if (this.currentAudio) {
            this.currentAudio.playbackRate = speed;
        }
    }

    stop() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            this.currentAudio = null;
        }
        if (this.synthesis.speaking) {
            this.synthesis.cancel();
        }
    }

    async preloadSpecificText(text: string, avatar: Avatar): Promise<void> {
        // Apply cleaning before caching key or generating
        const cleanText = cleanTextForTTS(text);
        if (!cleanText) return;

        const cacheKey = `${avatar.name}_${cleanText}`;
        if (this.audioCache[cacheKey]) return;

        try {
            const ai = getAI();
            const voiceName = GEMINI_VOICE_MAP[avatar.name] || 'Puck';
            
            const response = await ai.models.generateContent({
                model: TTS_MODEL_NAME,
                contents: [{ parts: [{ text: cleanText }] }],
                config: {
                    responseModalities: ['AUDIO'],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName }
                        }
                    }
                }
            });

            const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
                const pcmBytes = decodeBase64(base64Audio);
                const wavHeader = buildWavHeader(pcmBytes.length, 24000); // Gemini is 24kHz typically
                const wavBlob = new Blob([wavHeader, pcmBytes], { type: 'audio/wav' });
                const audioUrl = URL.createObjectURL(wavBlob);
                this.audioCache[cacheKey] = audioUrl;
            }
        } catch (e) {
            console.warn(`Preload failed for: ${cleanText}`, e);
        }
    }

    async speak(
        text: string, 
        avatar: Avatar, 
        onStart?: () => void, 
        onEnd?: () => void, 
        forceLocal?: boolean, 
        onError?: (msg: string) => void
    ) {
        this.stop();

        // Apply cleaning immediately
        const cleanText = cleanTextForTTS(text);
        if (!cleanText) {
            if (onEnd) onEnd();
            return;
        }

        if (forceLocal) {
            this.speakLocal(cleanText, avatar, onStart, onEnd);
            return;
        }

        const cacheKey = `${avatar.name}_${cleanText}`;
        let audioUrl = this.audioCache[cacheKey];

        if (!audioUrl) {
            try {
                await this.preloadSpecificText(cleanText, avatar);
                audioUrl = this.audioCache[cacheKey];
            } catch (e) {
                if (onError) onError("Network/API Error");
                this.speakLocal(cleanText, avatar, onStart, onEnd);
                return;
            }
        }

        if (audioUrl) {
            const audio = new Audio(audioUrl);
            audio.playbackRate = this.playbackSpeed;
            // IMPORTANT: Preserves pitch while changing speed
            (audio as any).preservesPitch = true; 
            // Also for Safari/Webkit
            (audio as any).mozPreservesPitch = true; 
            (audio as any).webkitPreservesPitch = true;

            audio.onended = () => {
                this.currentAudio = null;
                if (onEnd) onEnd();
            };
            
            audio.onerror = (e) => {
                console.error("Audio playback error", e);
                if (onError) onError("Playback Error");
                // Fallback
                this.speakLocal(cleanText, avatar, onStart, onEnd);
            };

            this.currentAudio = audio;
            if (onStart) onStart();
            try {
                await audio.play();
            } catch (err) {
                console.error("Play failed", err);
                if (onError) onError("Autoplay Blocked");
                this.speakLocal(cleanText, avatar, onStart, onEnd);
            }
        } else {
             // Fallback
             this.speakLocal(cleanText, avatar, onStart, onEnd);
        }
    }

    private speakLocal(text: string, avatar: Avatar, onStart?: () => void, onEnd?: () => void) {
        const utterance = new SpeechSynthesisUtterance(text);
        // Browsers handle rate changes with time stretching usually, so pitch is preserved
        utterance.rate = this.playbackSpeed * avatar.speechRate; 
        
        // Try to match gender and language
        const voices = this.synthesis.getVoices();
        const gender = avatar.gender.toLowerCase();
        
        const femaleKeywords = ['female', 'zira', 'samantha', 'jenny', 'aria', 'ava', 'sophia', 'lily', 'emma', 'olivia', 'google us english', 'google uk english female'];
        const maleKeywords = ['male', 'david', 'mark', 'daniel', 'james', 'kevin', 'frank', 'harry', 'google uk english male'];

        let preferred = voices.find(v => {
            const name = v.name.toLowerCase();
            const lang = v.lang.toLowerCase();
            if (!lang.startsWith('en')) return false;
            
            if (gender === 'female') {
                return femaleKeywords.some(k => name.includes(k));
            } else {
                return maleKeywords.some(k => name.includes(k));
            }
        });

        if (!preferred) {
            preferred = voices.find(v => v.lang.startsWith('en'));
        }

        if (preferred) utterance.voice = preferred;

        utterance.onstart = () => { if (onStart) onStart(); };
        utterance.onend = () => { if (onEnd) onEnd(); };
        utterance.onerror = () => { if (onEnd) onEnd(); };
        
        this.synthesis.speak(utterance);
    }
}

export const voiceService = new HybridVoiceService();

// --------------------------------------------------------------------------
// Audio Transcription & Processing
// --------------------------------------------------------------------------

const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            // Remove data url prefix (e.g. "data:audio/webm;base64,")
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

export const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
    const ai = getAI();
    try {
        const base64 = await blobToBase64(audioBlob);
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: {
                parts: [
                    { inlineData: { mimeType: audioBlob.type || 'audio/webm', data: base64 } },
                    { text: "Transcribe what the user said exactly in English. Return ONLY the transcription text." }
                ]
            }
        });
        return response.text.trim();
    } catch (e) {
        console.error("Transcription failed", e);
        return "";
    }
};

export const scorePronunciation = (transcript: string, target: string): number => {
    if (!transcript || !target) return 0;
    
    const cleanT = transcript.toLowerCase().replace(/[^\w\s]/g, '');
    const cleanTarget = target.toLowerCase().replace(/[^\w\s]/g, '');
    
    if (cleanT === cleanTarget) return 100;
    
    const wordsT = cleanT.split(/\s+/);
    const wordsTarget = cleanTarget.split(/\s+/);
    
    let match = 0;
    wordsTarget.forEach(w => {
        if (wordsT.includes(w)) match++;
    });
    
    const score = Math.round((match / wordsTarget.length) * 100);
    const lengthDiff = Math.abs(wordsT.length - wordsTarget.length);
    const penalty = lengthDiff * 5;
    
    return Math.max(0, Math.min(100, score - penalty));
};

// --------------------------------------------------------------------------
// Assessment Logic
// --------------------------------------------------------------------------

export const getAssessmentPlan = (profile: UserProfile): string[] => {
    if (profile.assessmentType === 'SPEED_RUN') {
        const focus = profile.testFocus === 'Business' ? 'Business' : 
                      profile.testFocus === 'Academic' ? 'Academic' : 
                      profile.testFocus === 'Travel' ? 'Travel' : 'Comprehensive';
        return ASSESSMENT_SCRIPTS[focus].slice(0, 6); 
    }
    return ASSESSMENT_SCRIPTS['Comprehensive'];
};

export const preloadSessionAudio = async (plan: string[], avatar: Avatar) => {
    for (const text of plan.slice(0, 3)) {
        await voiceService.preloadSpecificText(text, avatar);
    }
};

export const preloadAvatarAudio = async (avatar: Avatar, onProgress: (pct: number) => void) => {
    const messages = [avatar.introMessage, avatar.conclusionMessage];
    for (let i = 0; i < messages.length; i++) {
        await voiceService.preloadSpecificText(messages[i], avatar);
        onProgress(((i + 1) / messages.length) * 100);
    }
};

export const generateNextQuestion = async (
    history: Message[],
    profile: UserProfile,
    avatar: Avatar,
    currentTurn: number,
    maxTurns: number,
    rephraseCount: number,
    plan: string[]
): Promise<{
    questionText: string;
    isRephrase: boolean;
    isConclusion: boolean;
    translation?: string;
    hints?: string;
    assistantMessage?: string;
}> => {
    if (currentTurn >= maxTurns) {
        return { questionText: "", isRephrase: false, isConclusion: true };
    }

    let nextScriptQ = "";
    if (plan && plan.length > currentTurn) {
        nextScriptQ = plan[currentTurn];
    }

    const ai = getAI();
    
    const systemPrompt = `
    You are ${avatar.name}, an English Examiner (${avatar.personality}).
    User Level: ${profile.previousCefrLevel || 'Unknown'}.
    Current Turn: ${currentTurn + 1} / ${maxTurns}.
    Goal: Assessment.
    
    Task:
    1. Analyze user's last response (if any).
    2. If user did not understand or asked for help, set 'isRephrase': true and simplify the previous question.
    3. If user answered, provide the NEXT question.
       ${nextScriptQ ? `The NEXT question MUST be: "${nextScriptQ}"` : "Generate a relevant follow-up question."}
    
    Output JSON:
    {
        "question": "...",
        "questionCn": "Chinese translation",
        "isRephrase": boolean,
        "isConclusion": boolean,
        "hints": "Keywords",
        "assistantMessage": "Advice in Chinese"
    }
    `;

    const chatHistory = history.map(h => ({
        role: h.role,
        parts: [{ text: h.text }]
    }));

    try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: [...chatHistory, { role: 'user', parts: [{ text: "Proceed." }] }],
            config: {
                systemInstruction: systemPrompt,
                responseMimeType: "application/json"
            }
        });
        
        const json = JSON.parse(cleanJson(response.text));
        return {
            questionText: json.question,
            isRephrase: json.isRephrase || false,
            isConclusion: json.isConclusion || false,
            translation: json.questionCn,
            hints: json.hints,
            assistantMessage: json.assistantMessage
        };
    } catch (e) {
        if (nextScriptQ) {
            return { questionText: nextScriptQ, isRephrase: false, isConclusion: false };
        }
        return { questionText: "Let's move to the next topic.", isRephrase: false, isConclusion: false };
    }
};

export const generateConclusion = async (history: Message[]): Promise<string> => {
    return "Thank you for completing the assessment.";
};

export const generateFinalReport = async (history: Message[], durationType?: string): Promise<TestReport> => {
    const ai = getAI();
    const isLearning = !!durationType;
    
    const context = history.map(h => `${h.role}: ${h.text}`).join('\n');
    
    const prompt = `
    Analyze this conversation history and generate a ${isLearning ? 'Learning' : 'Assessment'} Report.
    
    IMPORTANT: Provide EVERY text field in bilingual format (English text followed by Chinese translation).
    Example: "Good vocabulary usage. / 词汇运用很好。"

    SCORING RULES:
    1. **Fluency**: DO NOT penalize natural filler words (e.g., "um", "uh", "you know", "like") if used in moderation. Native speakers use them. Focus on flow and coherence.
    2. **Pronunciation**: Evaluate based on Intonation, Stress, and Native-likeness (Authenticity). Do not just judge basic clarity.
    
    Output JSON Schema:
    {
        "cefrLevel": "B1",
        "toeflScore": "20",
        "ieltsScore": "6.0",
        "overallSummary": "Bilingual summary...",
        "simpleAnalysis": "Bilingual analysis...",
        "radarScores": { "listening": 8, "vocabulary": 7, "grammar": 6, "pronunciation": 7, "fluency": 7, "idiomatic": 5, "coherence": 6 },
        "strengths": ["English strength / 中文优势", "..."],
        "weaknesses": ["English weakness / 中文劣势", "..."],
        "suggestions": [ { "category": "Vocabulary", "content": "English suggestion / 中文建议", "isKeyImprovement": true } ],
        ${isLearning ? `"learningScore": 85, "learningStars": 4, "coreVocabulary": ["Word (Meaning) / 单词(释义)"], "coreSentences": ["Sentence / 句子"], "nativeExpressions": ["Expression / 表达"]` : ""}
    }
    
    Transcript:
    ${context}
    `;

    try {
        const response = await ai.models.generateContent({
            model: REPORT_MODEL_NAME,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { responseMimeType: "application/json" }
        });
        
        const json = JSON.parse(cleanJson(response.text));
        
        const radarData = Object.keys(json.radarScores).map(key => ({
            subject: key.charAt(0).toUpperCase() + key.slice(1),
            A: json.radarScores[key],
            fullMark: 10
        }));

        return { ...json, radarData };
    } catch (e) {
        console.error("Report gen failed", e);
        throw e;
    }
};

// --------------------------------------------------------------------------
// Learning & Lesson Plans
// --------------------------------------------------------------------------

// --- STRICT PERSONA DEFINITIONS ---
// Use strict, hard-coded prompts to override general behaviors
const PERSONA_STYLES: Record<string, string> = {
    'Kevin': `
        IDENTITY: You are Kevin, a trendy, sarcastic, and "cool" English coach.
        TONE: Casual, street-smart, witty, playfully roasting.
        VOCABULARY: Use Gen Z slang (e.g., "bet", "vibes", "slay", "lowkey", "sus") NATURALLY.
        BEHAVIOR:
        - **CRITICAL**: Do NOT start every sentence with "Yo", "Dude", or "No cap". Vary your openers.
        - **CRITICAL**: Do NOT overuse "no cap". Use it only when emphasizing truth, maximum once per 3 turns.
        - Tease the student playfully if they make a mistake, then help them fix it.
        - Treat the user like a close friend, not a student.
    `,
    'Frank': `
        IDENTITY: You are Frank, a serious, encyclopedic, and highly professional executive coach.
        TONE: Formal, precise, dry, intellectual, authoritative.
        VOCABULARY: Use sophisticated, academic, and business-level vocabulary.
        BEHAVIOR:
        - Do NOT use slang, emojis, or contractions (unless necessary).
        - Focus heavily on precision and logic.
        - If the student is vague, critique their lack of clarity immediately.
        - Act like a strict Oxford professor or a CEO.
    `,
    'Lily': `
        IDENTITY: You are Lily, an extremely gentle and patient tutor for absolute beginners.
        TONE: Soft, slow, very encouraging, motherly/sisterly warmth.
        VOCABULARY: Simple words, short sentences.
        BEHAVIOR:
        - Treat the student like they are very nervous and need protection.
        - Over-praise: "Wow!", "Amazing effort!", "Don't worry!".
        - Use gentle emojis 🌸✨ in text, but do not read them out loud.
    `,
    'Olivia': `
        IDENTITY: You are Olivia, a sharp, direct, no-nonsense executive.
        TONE: Fast, efficient, critical, demanding.
        VOCABULARY: Business-focused, concise.
        BEHAVIOR:
        - Do not waste time on pleasantries or small talk.
        - Critique effectiveness: "That was too wordy.", "Get to the point."
        - Push the student to be professional and concise.
    `,
    'Sophia': `
        IDENTITY: You are Sophia, an energetic social butterfly and party expert.
        TONE: High energy, chatty, curious, fun-loving.
        VOCABULARY: Social, emotional, expressive.
        BEHAVIOR:
        - Act like you are at a party with the student.
        - Use exclamation marks! Be very engaged.
    `,
    'Emma': `
        IDENTITY: You are Emma, a warm and friendly conversationalist.
        TONE: Natural, balanced, supportive but normal.
        BEHAVIOR:
        - Act like a supportive friend.
        - Balance correction with conversation.
    `
};

export const generateLearningResponse = async (
    history: Message[],
    config: LearningConfig,
    avatar: Avatar,
    turnCount: number,
    currentLevelOverride?: string,
    lessonPlan?: LessonPlan // Passed to provide context
): Promise<{ 
    feedback: string, 
    question: string, 
    text: string, 
    translation: string, 
    feedbackCn: string, 
    questionCn: string, 
    hints: string, 
    assistantMessage: string, 
    exampleAnswer?: { en: string, cn: string }, // New field
    isConclusion: boolean, 
    isClarification: boolean,
    betterExpression?: { original: string, improved: string, improvedCn: string }
}> => {
    const historyContext = history.slice(-30).map(h => `${h.role === 'user' ? 'Student' : 'Tutor'}: ${h.text}`).join('\n');
    
    const targetTurns = config.duration === 'LIGHT' ? 12 : config.duration === 'STANDARD' ? 20 : 30;
    const remainingTurns = targetTurns - turnCount;
    const activeLevel = currentLevelOverride || config.level;

    // --- PHASE LOGIC ---
    let phaseInstruction = "";
    let isLastTurn = false;

    if (remainingTurns <= 0) {
        // Force conclusion if exceeded
        isLastTurn = true;
        phaseInstruction = "This is the FINAL turn. You MUST END the conversation now. Provide a warm, encouraging closing statement. Set 'isConclusion' to true.";
    } else if (remainingTurns <= 2) {
        // Wrap up phase
        phaseInstruction = `The session is almost over (${remainingTurns} turns left). Start wrapping up the conversation naturally. Ask one final reflective or closing question related to the topic. Do NOT start a new complex sub-topic.`;
    } else {
        // Active learning phase
        phaseInstruction = "Continue the roleplay. You MUST ask a CONCRETE, SCENARIO-BASED question. Do NOT ask abstract questions like 'What is your opinion on X?'. Instead, ask 'If you were in X situation, what would you do?'. Incorporate the Target Vocabulary where possible.";
    }

    // --- PERSONA CONSTRUCTION ---
    // Use hard-coded style if available, otherwise fallback to generic description
    const specificPersonaGuide = PERSONA_STYLES[avatar.name] || PERSONA_STYLES['DEFAULT'] || `IDENTITY: You are ${avatar.name}, an English Coach. PERSONALITY: ${avatar.personality}`;

    // --- CONTEXT INJECTION ---
    let targetVocabContext = "";
    if (lessonPlan) {
        const vocabList = lessonPlan.vocabulary.map(v => v.en).join(", ");
        const sentList = lessonPlan.sentences.map(s => s.en).join(", ");
        targetVocabContext = `Target Vocabulary: ${vocabList}. Target Sentences: ${sentList}. Try to weave these into your questions naturally.`;
    }

    let enterpriseContext = "";
    if (config.topic?.pptContext) {
        enterpriseContext = `\nENTERPRISE COURSE MATERIAL (PPT Content):\n"${config.topic.pptContext}"\n\nINSTRUCTION: You are teaching this specific material. Use the scenarios, objections, and key points found in the material for your questions and feedback. Ensure the student masters this specific content.`;
    }

    const bilingualInstruction = config.allowBilingual
        ? `**IMPORTANT**: BILINGUAL MODE ACTIVE. Provide Chinese feedback.`
        : "**IMPORTANT**: Keep responses primarily in English.";

    const SYSTEM_INSTRUCTION = `
    ### STRICT PERSONA DIRECTIVES (DO NOT BREAK CHARACTER)
    ${specificPersonaGuide}

    ### CONTEXT
    Topic: ${(config.mode === 'TOPIC' || config.mode === 'ENTERPRISE') ? config.topic?.titleEn : config.customContext?.focusArea}.
    Student Level: ${activeLevel}.
    ${targetVocabContext}
    ${enterpriseContext}
    
    ### CRITICAL RULES (MUST FOLLOW)
    1. **ONE QUESTION ONLY**: You must ask **EXACTLY ONE** follow-up question at the end. 
       - NEVER ask "X or Y?".
       - NEVER ask two consecutive questions.
       - NEVER chain questions like "Why? And when?".
    2. **NO REPETITION**: Check the chat history. Do NOT ask a question that has already been asked or is semantically identical to a previous one.
    3. **NATURAL FLOW**:
       - First, acknowledge or react to the student's answer naturally (bridge the conversation).
       - Then, ask the new question based on their answer.
       - Do not be robotic. Connect the new question to the previous answer if possible.
    4. **DIFFICULTY**: Adjust vocabulary and grammar to CEFR Level ${activeLevel}.

    ### TASK
    1. Provide 'feedback' on the student's last message (grammar, naturalness) **USING YOUR SPECIFIC PERSONA TONE**.
    2. Ask the next 'question' based on the phase instruction.
    3. Generate 'assistantMessage' ONLY in Chinese (advice, encouragement).
    4. **GENERATE 'exampleAnswer'**: Provide a specific, natural, bilingual example sentence that answers the question you just asked. This helps the student if they get stuck.
    5. If the student made a mistake or could say it better, provide a 'betterExpression' object.
    
    Current Phase: ${phaseInstruction}
    
    Generate JSON:
    {
        "feedback": "English feedback (In Character)",
        "feedbackCn": "Chinese feedback",
        "question": "Next Question",
        "questionCn": "Chinese Question",
        "hints": "Key words (English & Chinese)",
        "assistantMessage": "Chinese Advice",
        "exampleAnswer": { "en": "Example English Answer", "cn": "中文回答示例" },
        "isConclusion": ${isLastTurn}, 
        "isClarification": false,
        "betterExpression": { 
            "original": "What student said", 
            "improved": "Better English version",
            "improvedCn": "Chinese translation of better version"
        } 
    }
    `;

    const ai = getAI();
    try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: [{ role: 'user', parts: [{ text: `Chat History:\n${historyContext}\n\nGenerate your response following the PERSONA and RULES.` }] }],
            config: {
                systemInstruction: SYSTEM_INSTRUCTION,
                responseMimeType: "application/json"
            }
        });
        const json = JSON.parse(cleanJson(response.text));
        
        // Force conclusion flag if turn count exceeded even if AI forgot
        if (remainingTurns <= 0) json.isConclusion = true;

        return {
            ...json,
            text: `${json.feedback} ${json.question}`,
            translation: `${json.feedbackCn} ${json.questionCn}`,
            feedbackCn: json.feedbackCn || json.feedback,
            questionCn: json.questionCn || json.question,
            hints: json.hints || "",
            assistantMessage: json.assistantMessage || "",
            exampleAnswer: json.exampleAnswer || null,
            betterExpression: json.betterExpression || null
        };
    } catch (e) {
         return { 
             feedback: "Hello!", 
             question: "Let's start.", 
             text: `Hello! Let's start.`, 
             translation: "你好！开始吧。", 
             feedbackCn: "你好！",
             questionCn: "开始吧。",
             hints: "", 
             assistantMessage: "", 
             isConclusion: false, 
             isClarification: false 
         }; 
    }
};

export const generateLessonPlan = async (config: LearningConfig): Promise<LessonPlan> => {
    if ((config.mode === 'TOPIC' || config.mode === 'ENTERPRISE') && config.topic) {
        const key = `TOPIC_${config.topic.id}_${config.level}`;
        const cached = isPlanCached(config.topic.id, config.level);
        if (cached) return getStoredPlans()[key];
    }

    const pptContext = config.topic?.pptContext || "";
    const pptInstruction = pptContext 
        ? `IMPORTANT: This is a CUSTOM ENTERPRISE COURSE based on uploaded PPTs. You MUST generate content based on the following PPT/Context material:\n"${pptContext}"\nExtract key terms, scenarios, and knowledge strictly from this material.` 
        : "";

    const ai = getAI();
    const prompt = `
    Create an English Lesson Plan.
    Topic: ${(config.mode === 'TOPIC' || config.mode === 'ENTERPRISE') ? config.topic?.titleEn : config.customContext?.focusArea}.
    Level: ${config.level}.
    ${pptInstruction}
    
    REQUIREMENTS:
    1. vocabulary: Generate EXACTLY 10 items. Include 'exampleCn' (Chinese translation of example).
    2. sentences: Generate EXACTLY 10 items. Include 'usageCn' (Chinese translation of usage).
    3. expressionComparison: Generate EXACTLY 5 items. Include 'explanationCn' (Chinese translation of explanation).
    4. knowledge: Provide basic intro and cultural insights. **MUST SPLIT ENGLISH AND CHINESE INTO SEPARATE FIELDS**.
    
    Output JSON:
    {
        "topicTitleEn": "...",
        "topicTitleCn": "...",
        "knowledge": { 
            "basicEn": "English Intro paragraph...", 
            "basicCn": "中文介绍段落...", 
            "culturalEn": "English Cultural insight...",
            "culturalCn": "中文文化洞察..."
        },
        "vocabulary": [ {"en": "word", "ipa": "/.../", "cn": "...", "example": "...", "exampleCn": "..."} ],
        "sentences": [ {"en": "...", "cn": "...", "usage": "...", "usageCn": "..."} ],
        "expressionComparison": [ {"written": "...", "writtenCn": "...", "spoken": "...", "spokenCn": "...", "explanation": "...", "explanationCn": "..."} ]
    }
    `;

    try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { responseMimeType: "application/json" }
        });
        const plan = JSON.parse(cleanJson(response.text));
        
        if (config.mode === 'TOPIC' && config.topic) {
             const key = `TOPIC_${config.topic.id}_${config.level}`;
             saveStoredPlan(key, plan);
        }
        
        return plan;
    } catch (e) {
        console.error("Lesson Plan Gen Failed", e);
        throw e;
    }
};

export const preloadLessonAssets = async (plan: LessonPlan, avatar: Avatar, onProgress: (pct: number) => void) => {
    const items = [
        ...plan.vocabulary.map(v => v.en),
        ...plan.sentences.map(s => s.en),
        ...(plan.expressionComparison?.map(e => e.spoken) || [])
    ];
    
    let loaded = 0;
    for (const text of items) {
        await voiceService.preloadSpecificText(text, avatar);
        loaded++;
        onProgress((loaded / items.length) * 100);
    }
};

export const generateDetailedTranscriptAnalysis = async (
  history: Message[], 
  cefrLevel?: string, 
  isLearningMode?: boolean
): Promise<AnalysisItem[]> => {
  const pairs: { q: string, a: string, assistant?: string }[] = [];
  let currentQuestion = "Start";
  let currentAssistant = "";
  for (const msg of history) {
    if (msg.role === 'model') {
        currentQuestion = msg.text;
        currentAssistant = msg.meta?.assistantMessage || "";
    } else if (msg.role === 'user') {
        pairs.push({ q: currentQuestion, a: msg.text, assistant: currentAssistant });
    }
  }
  if (pairs.length === 0) return [];
  const transcriptContext = pairs.map((pair, i) => `Turn ${i+1}:\nTutor Asked: "${pair.q}"\nStudent Answered: "${pair.a}"`).join('\n\n');
  const ai = getAI();
  const prompt = `Analyze this English session sentence-by-sentence.
  TASK: Generate a detailed analysis table.
  CONTEXT: Level: ${cefrLevel || 'General'}. Mode: ${isLearningMode ? 'Learning' : 'Assessment'}
  REQUIREMENTS:
  1. 'question': The context/question.
  2. 'questionCn': **MANDATORY**. Translate the context/question into Chinese.
  3. 'original': Student's answer.
  4. 'originalCn': **MANDATORY**. Translate the student's answer into Chinese.
  5. 'improved': Better, native version. **ENGLISH ONLY**.
  6. 'improvedCn': **MANDATORY**. Chinese translation of the improved version.
  7. 'explanation': **MUST BE BILINGUAL** (Explanation of why the improved version is better).
  8. 'type': One of "grammar", "vocabulary", "naturalness", "pronunciation".
  Return JSON Array: [{ "question": "...", "questionCn": "...", "original": "...", "originalCn": "...", "improved": "...", "improvedCn": "...", "explanation": "...", "type": "grammar" }]
  Transcript:\n${transcriptContext}`;

  try {
     const response = await ai.models.generateContent({
        model: REPORT_MODEL_NAME, 
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { responseMimeType: "application/json" }
     });
     return JSON.parse(cleanJson(response.text));
  } catch (e) { return []; }
}
