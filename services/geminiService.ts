
import { TestReport, Message, UserProfile, Avatar, AnalysisItem, SuggestionItem, LearningConfig, PlaybackSpeed } from "../types";
import { ASSESSMENT_SCRIPTS } from "../constants";

type GeminiProxyResponse = {
  text?: string;
  candidates?: any;
  usageMetadata?: any;
  error?: string;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const generateContentViaEdge = async (args: any): Promise<GeminiProxyResponse> => {
  // Simple retry for flaky networks (common for some Mainland networks).
  const delays = [0, 300, 900];
  let lastErr: any = null;

  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0) await sleep(delays[attempt]);
    try {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
      });

      const data = (await res.json().catch(() => ({}))) as GeminiProxyResponse;
      if (!res.ok) {
        const msg = data?.error || `Gemini proxy error (${res.status})`;
        // Retry on transient server errors / rate limit.
        if (res.status === 429 || res.status >= 500) {
          lastErr = new Error(msg);
          continue;
        }
        throw new Error(msg);
      }
      return data;
    } catch (e: any) {
      lastErr = e;
      // If it's a network failure (TypeError in fetch) we retry; otherwise lastErr will be thrown.
      continue;
    }
  }

  // Surface a more helpful error in console for debugging.
  console.error('Gemini proxy request failed after retries', lastErr, { model: args?.model });
  throw lastErr instanceof Error ? lastErr : new Error('Gemini proxy request failed');
};

const MODEL_NAME = "gemini-3-flash-preview"; 
const REPORT_MODEL_NAME = "gemini-3-flash-preview"; 
const NATIVE_AUDIO_MODEL = "gemini-2.5-flash-preview-tts";
const TTS_MODEL_NAME = "gemini-2.5-flash-preview-tts";

// Gemini 2.5 TTS Voices: Aoede (F), Puck (M), Charon (M), Kore (F), Fenrir (M)
const GEMINI_VOICE_MAP: Record<string, string> = {
  'Lily': 'Aoede', 'Emma': 'Aoede', 'James': 'Fenrir',
  'Sophia': 'Aoede', 'David': 'Charon', 'Olivia': 'Kore',
  'Harry': 'Fenrir', 'Kevin': 'Puck', 'Frank': 'Charon', 'Amy': 'Kore'
};

const AVATAR_TONE_MAP: Record<string, string> = {
  'Lily': 'Say in a soft, patient, and gentle voice: ',
  'Emma': 'Say in a warm and enthusiastic voice: ',
  'James': 'Say in a professional and clear voice: ',
  'Sophia': 'Say in a lively and casual voice: ',
  'David': 'Say in a calm, deep, and analytical voice: ',
  'Olivia': 'Say in a direct and confident professional voice: ',
  'Harry': 'Say in a very patient, slow, and encouraging friendly voice: ',
  'Kevin': 'Say in a witty, sarcastic, and energetic trend-setter voice: ',
  'Frank': 'Say in a deep, authoritative, and encyclopedic professional voice: ',
  'Amy': 'Say in a strict, neutral, and professional examiner voice: '
};

function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function pcmToWav(pcmData: Uint8Array, sampleRate: number = 24000): Blob {
  const numChannels = 1;
  const bitsPerSample = 16;
  const blockAlign = numChannels * bitsPerSample / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcmData.length;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  const pcmBytes = new Uint8Array(buffer, 44);
  pcmBytes.set(pcmData);
  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
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

class HybridVoiceService {
  private synth: SpeechSynthesis;
  private currentAudio: HTMLAudioElement | null = null;
  public lastEngine: 'GEMINI' | 'BROWSER' | null = null;
  private audioCache: Map<string, string> = new Map();
  private currentSpeed: PlaybackSpeed = 1.0;

  constructor() {
    this.synth = window.speechSynthesis;
  }

  public setSpeed(speed: PlaybackSpeed) {
    this.currentSpeed = speed;
    if (this.currentAudio) {
        this.currentAudio.playbackRate = speed;
    }
  }

  public ensureAudioContext() {}

  // Preload intro + conclusion
  public async preloadAvatarAudio(avatar: Avatar, onProgress?: (pct: number) => void): Promise<void> {
    const itemsToPreload = [
      { text: avatar.introMessage, key: 'intro' },
      { text: avatar.conclusionMessage, key: 'conclusion' }
    ];
    let completed = 0;
    for (const item of itemsToPreload) {
        await this.preloadSpecificText(item.text, avatar);
        completed++;
        if (onProgress) onProgress((completed / itemsToPreload.length) * 100);
    }
  }

  // Preload a list of texts (for session plan)
  public async preloadBatchAudio(texts: string[], avatar: Avatar, onProgress?: (pct: number) => void): Promise<void> {
      let completed = 0;
      const total = texts.length;
      for (const text of texts) {
          if (text) await this.preloadSpecificText(text, avatar);
          completed++;
          if (onProgress) onProgress(Math.floor((completed / total) * 100));
      }
  }

  public async preloadSpecificText(text: string, avatar: Avatar): Promise<void> {
    const cacheKey = `${avatar.name}_${text}`;
    if (this.audioCache.has(cacheKey)) return;

    try {
        const blobUrl = await this.fetchNativeAudioUrl(text, avatar);
        if (blobUrl) this.audioCache.set(cacheKey, blobUrl);
    } catch (e) {
        console.warn(`Preload failed for text: ${text.substring(0,20)}...`, e);
    }
  }

  private async fetchNativeAudioUrl(text: string, avatar: Avatar): Promise<string | null> {
      const voiceName = GEMINI_VOICE_MAP[avatar.name] || 'Puck';
      const tonePrefix = AVATAR_TONE_MAP[avatar.name] || '';

      const response = await generateContentViaEdge({
        model: TTS_MODEL_NAME,
        contents: [{ parts: [{ text: `${tonePrefix}${text}` }] }],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } }
          }
        }
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) return null;

      const pcmData = decodeBase64(base64Audio);
      const wavBlob = pcmToWav(pcmData, 24000);
      return URL.createObjectURL(wavBlob);
  }

  private playUrl(url: string, onEnd?: () => void) {
    this.stop(); 
    const audio = new Audio(url);
    audio.playbackRate = this.currentSpeed;
    
    audio.onended = () => { this.currentAudio = null; onEnd?.(); };
    audio.onerror = (e) => { console.error("Audio playback error", e); this.currentAudio = null; onEnd?.(); };

    this.currentAudio = audio;
    audio.play().catch(e => { console.error("Play failed", e); onEnd?.(); });
  }

  public async speak(
    text: string, 
    avatar: Avatar, 
    onStart?: () => void, 
    onEnd?: () => void,
    forceLocal: boolean = false,
    onError?: (errorMsg: string) => void
  ): Promise<void> {
    this.stop();
    onStart?.();

    if (!text || text.trim().length === 0) { onEnd?.(); return; }

    if (forceLocal) {
        this.speakBrowserTTS(text, avatar, onEnd);
        this.lastEngine = 'BROWSER';
        return;
    }

    try {
        const cacheKey = `${avatar.name}_${text}`;
        
        if (this.audioCache.has(cacheKey)) {
            this.playUrl(this.audioCache.get(cacheKey)!, onEnd);
            this.lastEngine = 'GEMINI';
            return;
        }

        const url = await this.fetchNativeAudioUrl(text, avatar);
        
        if (url) {
             this.audioCache.set(cacheKey, url);
             this.playUrl(url, onEnd);
             this.lastEngine = 'GEMINI';
        } else {
             if (onError) onError("Audio generation returned empty.");
             this.speakBrowserTTS(text, avatar, onEnd);
        }

    } catch (e: any) {
        console.error("Native Audio General Fail:", e);
        if (onError) onError(e.message || "Unknown Error");
        this.speakBrowserTTS(text, avatar, onEnd);
    }
  }

  private speakBrowserTTS(text: string, avatar: Avatar, onEnd?: () => void) {
      const utterance = new SpeechSynthesisUtterance(text);
      let voices = this.synth.getVoices();
      
      const hasChinese = /[\u4e00-\u9fa5]/.test(text);
      const isMale = avatar.gender === 'Male';
      let voice: SpeechSynthesisVoice | undefined = undefined;

      const edgeVoices = voices.filter(v => v.name.includes('Microsoft') && v.name.includes('Online') && v.name.includes('Natural'));

      if (hasChinese) {
        const cnEdge = edgeVoices.filter(v => v.lang.includes('zh'));
        const cnAll = voices.filter(v => v.lang.includes('zh'));
        if (isMale) {
            voice = cnEdge.find(v => v.name.includes('Yunxi'));
            if (!voice) voice = cnAll.find(v => v.name.includes('Male'));
        } else {
            voice = cnEdge.find(v => v.name.includes('Xiaoxiao'));
            if (!voice) voice = cnAll.find(v => !v.name.includes('Male'));
        }
        if (!voice) voice = cnAll.find(v => v.default) || cnAll[0];
      } else {
        const enEdge = edgeVoices.filter(v => v.lang.includes('en'));
        const enAll = voices.filter(v => v.lang.startsWith('en'));
        if (isMale) {
            if (avatar.name === 'Harry') voice = enEdge.find(v => v.name.includes('Ryan'));
            if (!voice) voice = enEdge.find(v => /Guy|Ryan|Christopher|Eric|Roger|Steffan/i.test(v.name));
            if (!voice) voice = enAll.find(v => v.name.includes('Google') && v.name.includes('Male'));
            if (!voice) voice = enAll.find(v => (/David|James|Mark|Daniel|Paul/i.test(v.name) || v.name.includes('Male')) && !/Female|Zira|Susan|Julie|Aria|Jenny/i.test(v.name));
        } else {
            voice = enEdge.find(v => /Aria|Jenny|Michelle|Ana/i.test(v.name));
            if (!voice) voice = enAll.find(v => v.name.includes('Google') && v.name.includes('US'));
        }
        if (!voice) {
             if (isMale) voice = enAll.find(v => !/Zira|Susan|Julie|Female/i.test(v.name));
             else voice = enAll.find(v => v.default) || enAll[0];
        }
      }

      if (voice) utterance.voice = voice;
      utterance.rate = this.currentSpeed; 
      utterance.onend = () => onEnd?.();
      utterance.onerror = () => onEnd?.();
      
      this.synth.speak(utterance);
  }

  public stop(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    if (this.synth.speaking) this.synth.cancel();
  }
}

export const voiceService = new HybridVoiceService();

export const preloadAvatarAudio = async (avatar: Avatar, onProgress?: (percent: number) => void) => {
    await voiceService.preloadAvatarAudio(avatar, onProgress);
};

// NEW: Preload full session audio based on a plan
export const preloadSessionAudio = async (questions: string[], avatar: Avatar, onProgress?: (percent: number) => void) => {
    await voiceService.preloadBatchAudio(questions, avatar, onProgress);
};

// NEW: Generator for Assessment Plan (Uses Static Constants)
export const getAssessmentPlan = (profile: UserProfile): string[] => {
    const focus = profile.testFocus || 'Comprehensive';
    return ASSESSMENT_SCRIPTS[focus] || ASSESSMENT_SCRIPTS['Comprehensive'];
};

// NEW: Generator for Learning Plan (Uses LLM for dynamic topics)
export const generateLearningPlan = async (config: LearningConfig): Promise<string[]> => {
    if (config.mode === 'TOPIC' && config.topic) {
        const topic = config.topic;
        const systemPrompt = `You are an expert English curriculum designer. 
        Create a list of 10 discussion questions for an adult learner about the topic: "${topic.titleEn} (${topic.titleCn})".
        Level: ${config.level}.
        
        The questions should progress from simple introduction to detailed description, and then to abstract opinion.
        Return ONLY a JSON array of strings. No markdown.
        Example: ["Question 1", "Question 2"]`;
        
        try {
            const response = await generateContentViaEdge({
                model: MODEL_NAME,
                contents: [{ parts: [{ text: systemPrompt }] }],
                config: { responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } }
            });
            const text = cleanJson(response.text);
            return JSON.parse(text);
        } catch (e) {
            console.error("Plan generation failed, using fallback", e);
            return ["Tell me about this topic.", "What do you like about it?", "Can you describe a specific example?", "How does this affect your daily life?", "What are the pros and cons?", "How do you see this changing in the future?"];
        }
    } else {
        // Custom Mode Plan - Generic structure adapted to context
        return [
            "Could you explain the context of what we are practicing today?",
            "What is the specific goal you want to achieve in this scenario?",
            "Let's start the roleplay. Please set the scene.",
            "Tell me more about your specific role in this situation.",
            "What is the biggest challenge you anticipate here?",
            "How would you handle a disagreement in this context?",
            "Can you summarize the main points so far?",
            "What is your backup plan if things go wrong?",
            "How do you feel about your performance in this area usually?",
            "Let's wrap up with a final thought on this topic."
        ];
    }
};

export const generateNextQuestion = async (
  history: Message[],
  userProfile: UserProfile,
  avatar: Avatar,
  currentQuestionCount: number,
  maxQuestions: number,
  consecutiveRephraseCount: number,
  sessionPlan?: string[]
): Promise<{ 
    questionText: string, 
    translation: string, 
    hints: string, 
    assistantMessage: string,
    isRephrase: boolean,
    isConclusion: boolean
}> => {
  const historyContext = history.slice(-8).map(h => `${h.role === 'user' ? 'Candidate' : 'Examiner'}: ${h.text}`).join('\n');
  const isSpeedRun = userProfile.assessmentType === 'SPEED_RUN';
  const enableAssistant = (avatar.name === 'Lily') || (isSpeedRun);
  
  // --- 70/30 LOGIC: Preset vs Derived ---
  const isDerivedTurn = (currentQuestionCount % 3 === 2);
  
  let presetText = "";
  if (!isDerivedTurn && sessionPlan && sessionPlan.length > 0) {
      const planIndex = currentQuestionCount - Math.floor(currentQuestionCount / 3);
      if (planIndex < sessionPlan.length) {
          presetText = sessionPlan[planIndex];
      }
  }

  const phaseInstruction = presetText 
      ? `**MANDATORY INSTRUCTION**: The next question is PRE-DETERMINED. You MUST output exactly this text in 'questionText': "${presetText}". Do not change it. Translate it in 'translation'.`
      : `**DERIVED PHASE (Deep Dive)**: Ignore the standard list. Look at the Candidate's LAST answer. Pick ONE specific detail they mentioned and ask a challenging follow-up question about it (Why? How? How did that feel?). If their answer was short, ask them to expand.`;

  const SYSTEM_INSTRUCTION = `You are ${avatar.name}, acting as a professional Adult English Examiner.
  
  CONTEXT: 
  Role: ${userProfile.role}, Industry: ${userProfile.industry}, Focus: ${userProfile.testFocus || 'General'}
  Progress: ${currentQuestionCount} / ${maxQuestions} questions.
  
  CURRENT TASK: ${phaseInstruction}

  TASK:
  1. Analyze the Candidate's latest response.
  2. Brief positive reinforcement (Max 5 words).
  3. Generate the Next Question based on the CURRENT TASK instruction.
  4. Ensure the question is professionally phrased suitable for adults.

  Output JSON format (NO MARKDOWN):
  {
    "questionText": "string",
    "translation": "string",
    "hints": "Bilingual keywords (English + Chinese)",
    "assistantMessage": "string",
    "isRephrase": boolean,
    "isConclusion": boolean
  }`;
  
  try {
    const response = await generateContentViaEdge({
      model: MODEL_NAME,
      contents: [{ role: 'user', parts: [{ text: `History:\n${historyContext}\n\nGenerate next response.` }] }],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 }
      }
    });
    return JSON.parse(cleanJson(response.text));
  } catch (error) {
    return { 
        questionText: presetText || "That's interesting. Let's move to the next topic. Tell me about your daily work routine.", 
        translation: "很有趣。我们换个话题。跟我说说你的日常工作。", 
        hints: "Routine (日常), Work (工作), Tasks (任务)",
        assistantMessage: enableAssistant ? "网络波动，我们换个话题继续。" : "",
        isRephrase: false, 
        isConclusion: false
    };
  }
};

export const generateLearningResponse = async (
    history: Message[],
    config: LearningConfig,
    avatar: Avatar,
    turnCount: number,
    currentLevelOverride?: string,
    sessionPlan?: string[]
): Promise<{ 
    feedback: string, 
    question: string, 
    text: string, 
    translation: string, 
    feedbackCn: string, 
    questionCn: string, 
    hints: string, 
    assistantMessage: string, 
    isConclusion: boolean, 
    isClarification: boolean 
}> => {
    const historyContext = history.slice(-6).map(h => `${h.role === 'user' ? 'Student' : 'Tutor'}: ${h.text}`).join('\n');
    
    // Updated Turn Logic Definitions
    // LIGHT (8 mins): Max 12 turns.
    // STANDARD (15 mins): Max 20 turns.
    // DEEP (25 mins): Max 30 turns.
    const targetTurns = config.duration === 'LIGHT' ? 12 : config.duration === 'STANDARD' ? 20 : 30;
    const isConclusion = turnCount >= targetTurns;
    const activeLevel = currentLevelOverride || config.level;

    // Detect specialized mode for Zero Basis
    const isZeroBasis = config.mode === 'TOPIC' && config.topic?.category === 'ZERO_BASIS';

    // --- Pedagogical Mode Logic ---
    let strategyInstruction = "";
    
    if (isZeroBasis) {
       // Zero Basis Loop: Input -> Output -> Feedback
       strategyInstruction = `**SPECIAL MODE: ZERO BASIS TEACHING (Input-Output-Feedback Loop)**
       You are a patient Drill Instructor for absolute beginners.
       DO NOT hold a normal conversation.
       
       **YOUR TASK PER TURN:**
       1. **INPUT (Teach)**: Briefly explain the specific concept (sound, word, or sentence pattern) in Chinese/English.
       2. **OUTPUT REQUEST (Practice)**: Explicitly ask the student to repeat a word, read a sound, or make a simple sentence using the pattern.
       3. **FEEDBACK (Correct)**: Strictly evaluate their previous audio. If wrong, ask to try again. If good, move to the next item.
       `;
    } else if (config.duration === 'DEEP') {
       // Deep Learning Loop: Input -> Output -> Feedback (Concept-based)
       strategyInstruction = `**MODE: DEEP LEARNING (25 mins)**
       Goal: Deep mastery of the topic via Input-Output-Feedback Loop.
       Turn Limit: 30 turns.
       
       **YOUR STRATEGY:**
       1. **Analyze**: Identify a specific weakness or a new expression related to the topic.
       2. **Teach (Input)**: Briefly explain a better way to say it or introduce a new relevant phrase/idiom.
       3. **Practice (Output)**: Ask the user to use that specific phrase/grammar in their next sentence.
       4. **Feedback**: Verify if they used it correctly.
       Do not just chat casually. Drive learning outcomes.
       `;
    } else if (config.duration === 'STANDARD') {
       // Standard: Regular + Derived Questions
       strategyInstruction = `**MODE: STANDARD PRACTICE (15 mins)**
       Goal: Fluency and expansion.
       Turn Limit: 20 turns.
       
       **YOUR STRATEGY:**
       - Alternate between standard topic questions and **derived follow-up questions** based on the user's specific answers.
       - Dig deeper into their stories. Ask "Why?", "How did you feel?", "What happened next?".
       `;
    } else {
       // Light: Standard Q&A
       strategyInstruction = `**MODE: LIGHT PRACTICE (8 mins)**
       Goal: Quick conversational warmup.
       Turn Limit: 12 turns.
       
       **YOUR STRATEGY:**
       - Keep questions straightforward and directly related to the topic.
       - Focus on encouraging the user to speak.
       `;
    }

    let context = "";
    if (config.mode === 'TOPIC' && config.topic) {
        context = `CONTEXT: Topic-Based Learning. 
        LEVEL: ${activeLevel}
        TOPIC: ${config.topic.titleEn} (${config.topic.titleCn})
        CATEGORY: ${config.topic.category}`;
    } else if (config.mode === 'CUSTOM' && config.customContext) {
        context = `CONTEXT: Custom Practice.
        LEVEL: ${activeLevel}
        FOCUS: ${config.customContext.focusArea}`;
    }

    const bilingualInstruction = config.allowBilingual || isZeroBasis
        ? `**IMPORTANT**: BILINGUAL MODE ACTIVE.
        STRATEGY:
        1. 'feedback' field: MUST be in **CHINESE** (Mandarin).
        2. 'question' field: MUST be in **ENGLISH** (Use the Mandatory text if provided).
        3. 'hints': Provide bilingual keywords.
        `
        : "**IMPORTANT**: Keep responses primarily in English. Only use Chinese in 'assistantMessage' or 'translation'.";

    const feedbackReq = (config.allowBilingual || isZeroBasis)
        ? "1. 'feedback': Your reaction/correction/guidance in **CHINESE**."
        : "1. 'feedback': Your reaction/correction/guidance in **ENGLISH**. **MUST BE CONCISE**.";

    const feedbackInitReq = (config.allowBilingual || isZeroBasis)
        ? `"feedback": "Opening greeting in CHINESE",`
        : `"feedback": "Opening greeting in ENGLISH",`;

    let avatarInstruction = `You are ${avatar.name}, acting as a professional Adult English Coach (${avatar.personality}).`;
    if (avatar.name === 'Kevin') avatarInstruction += `\nSTYLE: Use slang, be sarcastic but encouraging.`;
    else if (avatar.name === 'Frank') avatarInstruction += `\nSTYLE: Use precise industry terminology.`;
    else if (avatar.name === 'Amy') avatarInstruction += `\nSTYLE: Act like a strict IELTS/TOEFL examiner.`;
    else if (avatar.name === 'Harry') avatarInstruction += `\nSTYLE: Be extremely patient. Speak simply.`;

    // --- NEW STRICT LEVEL CONSTRAINT ---
    const levelConstraint = `
    **CRITICAL LANGUAGE LEVEL & LOGIC CONSTRAINT**:
    The user's English level is: **${activeLevel}**.
    
    1. **Vocabulary & Grammar**:
       - PreA1/A1/A2: Use VERY simple words (top 500-1000), short sentences (5-10 words). NO complex compound sentences. NO idioms.
       - B1: Standard conversational English. Avoid overly academic words.
       - B2+: Natural, complex, idiomatic English allowed.
    
    2. **Logic & Cognitive Load**:
       - **PreA1-B1**: Ask concrete, direct questions (Who, What, Where). DO NOT ask complex "Why" or "How" questions that require deep abstract thinking. Keep logic simple.
       - **B2+**: You may ask complex, abstract, or hypothetical questions.
    
    **PRIORITY**: This level constraint overrides your default persona's complexity.
    `;

    // --- ADAPTIVE REPHRASING INSTRUCTION ---
    const rephraseInstruction = `
    **ADAPTIVE REPHRASING**:
    If the user's last message indicates they **did not understand** (e.g., "pardon?", "what?", "don't understand", silence, or irrelevant answer):
    1. Set "isClarification": true.
    2. Rephrase the SAME question using much SIMPLER words.
    3. If they still fail, suggest they look at the translation.
    `;

    // --- ASSISTANT INSTRUCTION ---
    const assistantInstruction = `
    **ASSISTANT MESSAGE RULE**:
    The 'assistantMessage' field is for users who are stuck.
    It MUST contain:
    1. **Logic/Strategy**: How to answer this question (in Chinese).
    2. **Example**: A sample sentence they can use (English + Chinese).
    Format: "[思路]... [例句]..."
    `;

    if (history.length === 0) {
        const SYSTEM_INSTRUCTION_INIT = `${avatarInstruction}
        ${context}
        MISSION: Start the conversation naturally based on the topic/context.
        ${bilingualInstruction}
        ${levelConstraint}
        ${strategyInstruction}
        ${assistantInstruction}
        
        Output JSON format: 
        { 
          ${feedbackInitReq}
          "feedbackCn": "Chinese translation",
          "question": "First question in English", 
          "questionCn": "Chinese translation of question",
          "hints": "Keywords (English + Chinese)", 
          "assistantMessage": "[思路]... [例句]...", 
          "isConclusion": false, 
          "isClarification": false 
        }`;
        
        try {
            const response = await generateContentViaEdge({
                model: MODEL_NAME,
                contents: [{ role: 'user', parts: [{ text: "Start the lesson." }] }],
                config: { systemInstruction: SYSTEM_INSTRUCTION_INIT, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } }
            });
            const json = JSON.parse(cleanJson(response.text));
            return {
                ...json,
                text: `${json.feedback} ${json.question}`,
                translation: `${json.feedbackCn} ${json.questionCn}`,
                feedbackCn: json.feedbackCn || json.feedback,
                questionCn: json.questionCn || json.question,
                hints: json.hints || ""
            };
        } catch (e) { 
             return { 
                 feedback: "Hello!", 
                 question: "Let's start.", 
                 text: `Hello! Let's start.`, 
                 translation: "你好！开始吧。", 
                 feedbackCn: "你好！",
                 questionCn: "开始吧。",
                 hints: "Start (开始), Hello (你好)", 
                 assistantMessage: "", 
                 isConclusion: false, 
                 isClarification: false 
             }; 
        }
    }

    const SYSTEM_INSTRUCTION = `${avatarInstruction}
    ${context}
    CURRENT TURN: ${turnCount} / ${targetTurns}.
    MISSION: Conduct a natural, engaging conversation.
    TEACHING STYLE: Supportive, encouraging, but PROFESSIONAL (Adult-oriented).
    CORRECTION: Gently rephrase mistakes.
    HINTS: Always provide 3-5 key vocab words. **MUST BE BILINGUAL**.
    ${bilingualInstruction}
    ${levelConstraint}
    ${strategyInstruction}
    ${rephraseInstruction}
    ${assistantInstruction}

    **STRUCTURE REQUIREMENT**:
    ${feedbackReq}
    2. 'feedbackCn': Chinese translation of the feedback.
    3. 'question': The specific follow-up question.
    4. 'questionCn': Chinese translation of the question ONLY.
    5. 'hints': KEYWORDS for the NEW question in format "Word (Chinese Translation)".
    6. 'assistantMessage': Detailed help (Logic + Example).
    
    IF ${isConclusion} is TRUE (and NOT clarification):
    - Wrap up politely. Set 'isConclusion': true.

    Output JSON format:
    {
        "feedback": "...",
        "feedbackCn": "...",
        "question": "Now tell me...",
        "questionCn": "问题的中文...",
        "hints": "Word (词义), Word (词义)",
        "assistantMessage": "[思路]... [例句]...",
        "isConclusion": boolean,
        "isClarification": boolean
    }`;

    try {
        const response = await generateContentViaEdge({
            model: MODEL_NAME,
            contents: [{ role: 'user', parts: [{ text: `History:\n${historyContext}\n\nGenerate next tutor response.` }] }],
            config: {
                systemInstruction: SYSTEM_INSTRUCTION,
                responseMimeType: "application/json",
                thinkingConfig: { thinkingBudget: 0 }
            }
        });
        const json = JSON.parse(cleanJson(response.text));
        return {
            ...json,
            text: `${json.feedback} ${json.question}`,
            translation: `${json.feedbackCn || ''} ${json.questionCn || ''}`,
            feedbackCn: json.feedbackCn || "",
            questionCn: json.questionCn || "",
            hints: json.hints || "" 
        };
    } catch (e) {
        return {
            feedback: "I'm having a bit of trouble connecting.",
            feedbackCn: "连接有点问题。",
            question: "Let's continue.",
            questionCn: "我们继续。",
            text: "I'm having a bit of trouble connecting. Let's continue.",
            translation: "连接有点问题，我们继续。",
            hints: "Continue (继续), Problem (问题)",
            assistantMessage: "网络波动，请继续。",
            isConclusion: false,
            isClarification: false
        };
    }
};

export const generateConclusion = async (
  history: Message[],
  avatar?: Avatar
): Promise<{ questionText: string, translation: string }> => {
  return { 
      questionText: avatar?.conclusionMessage || "Thank you for the session. We are done!", 
      translation: "感谢这次交流。测评结束了！" 
  };
};

export const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
  try {
    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(audioBlob);
    });
    const base64Audio = await base64Promise;
    const response = await generateContentViaEdge({
      model: MODEL_NAME,
      contents: [{ parts: [{ inlineData: { mimeType: audioBlob.type, data: base64Audio } }, { text: "Transcribe exactly. If empty audio/noise, return ''." }] }],
      config: { temperature: 0, thinkingConfig: { thinkingBudget: 0 } }
    });
    return response.text?.trim() || "";
  } catch (error) { return ""; }
};

export const generateFinalReport = async (history: Message[], learningDuration?: string): Promise<TestReport> => {
  const isLearning = (history.length > 0); 
  const transcript = history.map(h => {
     let meta = "";
     if (h.role === 'user' && h.replayCount && h.replayCount > 0) {
        meta = ` [METADATA: User replayed the question ${h.replayCount} times]`;
     }
     return `${h.role.toUpperCase()}: ${h.text}${meta}`;
  }).join('\n');

  const prompt = `Analyze this oral English transcript.
  Return JSON. All content bilingual (English + Chinese).
  MODE: ${isLearning ? 'LEARNING/PRACTICE' : 'PROFESSIONAL ASSESSMENT'}
  **CRITICAL SCORING INSTRUCTION (ASSESSMENT MODE):**
  - Act as a **STRICT CEFR EXAMINER**.
  **REQUIRED FIELDS for REPORT:**
  1. 'suggestions': Provide 3-5 CONCRETE, ACTIONABLE study suggestions.
  2. 'dimensionAnalysis' (NEW): Provide a detailed bilingual evaluation paragraph for EACH of the following dimensions.
  3. Standard Fields: cefrLevel, scores, summary, etc.
  REQUIRED FIELDS for LEARNING MODE (STRICT):
  - coreVocabulary: Extract **AT LEAST 10** useful words.
  - coreSentences: Extract **AT LEAST 10** useful sentence structures.
  - nativeExpressions: Extract **AT LEAST 5** idiomatic expressions.
  - learningScore: Score 0-100.
  - learningStars: Integer 1-5.
  
  Output Schema:
  {
    "cefrLevel": "A1/A2/B1/B2/C1/C2",
    "toeflScore": "0-30",
    "ieltsScore": "0-9.0",
    "overallSummary": "Bilingual summary",
    "simpleAnalysis": "Bilingual quick feedback",
    "dimensionAnalysis": { "listening": "...", "vocabulary": "...", "grammar": "...", "pronunciation": "...", "fluency": "...", "native": "...", "logic": "..." },
    "strengths": ["..."],
    "weaknesses": ["..."],
    "suggestions": [ { "category": "VOCABULARY", "content": "...", "isKeyImprovement": true } ],
    "radarScores": { ... },
    "coreVocabulary": ["..."],
    "coreSentences": ["..."],
    "nativeExpressions": ["..."],
    "learningScore": 95,
    "learningStars": 5
  }
  Transcript:\n${transcript}`;

  try {
    const response = await generateContentViaEdge({
      model: REPORT_MODEL_NAME, 
      contents: prompt,
      config: { responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } }
    });
    
    const text = cleanJson(response.text);
    const json = JSON.parse(text);

    return { 
        cefrLevel: json.cefrLevel || "B1",
        toeflScore: json.toeflScore || "16",
        ieltsScore: json.ieltsScore || "4.5",
        overallSummary: json.overallSummary || "Assessment completed.",
        simpleAnalysis: json.simpleAnalysis || "You completed the assessment.",
        dimensionAnalysis: json.dimensionAnalysis,
        strengths: json.strengths || [],
        weaknesses: json.weaknesses || [],
        suggestions: json.suggestions || [],
        radarScores: json.radarScores || {},
        coreVocabulary: json.coreVocabulary || [],
        coreSentences: json.coreSentences || [],
        nativeExpressions: json.nativeExpressions || [],
        learningScore: json.learningScore,
        learningStars: json.learningStars || 4,
        detailedAnalysis: [], 
        radarData: [
            { subject: 'Listening', A: json.radarScores?.listening || 5, fullMark: 10 },
            { subject: 'Vocab', A: json.radarScores?.vocabulary || 5, fullMark: 10 },
            { subject: 'Grammar', A: json.radarScores?.grammar || 5, fullMark: 10 },
            { subject: 'Pronun.', A: json.radarScores?.pronunciation || 5, fullMark: 10 },
            { subject: 'Fluency', A: json.radarScores?.fluency || 5, fullMark: 10 },
            { subject: 'Native', A: json.radarScores?.idiomatic || 5, fullMark: 10 },
            { subject: 'Logic', A: json.radarScores?.coherence || 5, fullMark: 10 },
        ]
    };
  } catch (error) { 
    return {
        cefrLevel: "Evaluation Pending",
        toeflScore: "-",
        ieltsScore: "-",
        overallSummary: "Error generating report.",
        simpleAnalysis: "Unavailable.",
        radarScores: { listening: 5, vocabulary: 5, grammar: 5, pronunciation: 5, fluency: 5, idiomatic: 5, coherence: 5 },
        radarData: [],
        strengths: [],
        weaknesses: [],
        suggestions: [],
        detailedAnalysis: [] 
    };
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
  const prompt = `Analyze this English session sentence-by-sentence.
  TASK: Generate a detailed analysis table.
  CONTEXT: Level: ${cefrLevel || 'General'}. Mode: ${isLearningMode ? 'Learning' : 'Assessment'}
  REQUIREMENTS:
  1. 'question': The context/question.
  2. 'original': Student's answer.
  3. 'improved': Better, native version. **MUST BE BILINGUAL**.
  4. 'explanation': **MUST BE BILINGUAL**.
  5. 'type': One of "grammar", "vocabulary", "naturalness", "pronunciation".
  Return JSON Array: [{ "question": "...", "original": "...", "improved": "...", "explanation": "...", "type": "grammar" }]
  Transcript:\n${transcriptContext}`;

  try {
     const response = await generateContentViaEdge({
        model: REPORT_MODEL_NAME, 
        contents: prompt,
        config: { responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } }
     });
     return JSON.parse(cleanJson(response.text));
  } catch (e) { return []; }
}
