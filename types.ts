
export enum TestStage {
  WELCOME = 'WELCOME',
  // Assessment Stages
  SETUP = 'SETUP',
  LOADING = 'LOADING',
  TESTING = 'TESTING',
  ANALYZING = 'ANALYZING',
  REPORT = 'REPORT',
  TRANSCRIPT = 'TRANSCRIPT',
  // Learning Stages
  LEARN_SETUP = 'LEARN_SETUP',
  LEARN_LOADING = 'LEARN_LOADING',
  LESSON_PREVIEW = 'LESSON_PREVIEW', // New Stage
  LEARNING = 'LEARNING',
  LEARN_REPORT = 'LEARN_REPORT',
  // Hub
  STUDENT_HUB = 'STUDENT_HUB',
  // Admin
  ADMIN_MANAGER = 'ADMIN_MANAGER'
}

export type AssessmentType = 'INITIAL_REGULAR' | 'INITIAL_DEEP' | 'STAGE_REGULAR' | 'STAGE_CUSTOM' | 'SPEED_RUN';

export type AppMode = 'ASSESSMENT' | 'LEARNING';
export type LearningMode = 'TOPIC' | 'CUSTOM' | 'ENTERPRISE';
export type LearningDuration = 'LIGHT' | 'STANDARD' | 'DEEP'; // 10m/12t, 15m/20t, 25m/35t
export type VoiceType = 'HQ' | 'STANDARD';
export type PlaybackSpeed = 0.75 | 1.0 | 1.25;

export interface UploadedFile {
  name: string;
  mimeType: string;
  data: string; // Base64 encoded data
}

export interface UserProfile {
  name: string;
  role: string;
  industry: string;
  hobbies: string;
  companyContext: string;
  files: UploadedFile[];
  assessmentType?: AssessmentType; // Optional now as it's for assessment only
  previousCefrLevel?: string;
  testFocus?: string;
}

export interface LearningConfig {
  mode: LearningMode;
  level: string; // CEFR Level
  duration: LearningDuration;
  voiceType: VoiceType; // Added back
  allowBilingual?: boolean; // New flag for PreA1/A1 support
  topic?: Topic; // For Topic Mode
  customContext?: {
    files: UploadedFile[];
    contextText: string;
    focusArea: string; // Business, Life, Academic, Interview, Debate, Presentation
    userRole: string;
    aiRole: string;
    additionalRequirements?: string; // New field for extra instructions
  };
}

export interface Topic {
  id: string;
  titleEn: string;
  titleCn: string;
  category: 'LIFE' | 'BUSINESS' | 'ZERO_BASIS';
  level: string;
  description?: string;
  // Enterprise fields
  isEnterprise?: boolean;
  department?: string[]; // Changed to string array for Multi-select
  subDepartment?: string[]; // New: Optional Sub-departments
  enterpriseId?: string;
  pptContext?: string; // Content extracted from PPT
}

// New Interface for Lesson Plan
export interface LessonPlan {
    topicTitleEn: string;
    topicTitleCn: string;
    knowledge: {
        basicEn: string; // Split for bilingual display
        basicCn: string; 
        culturalEn: string; 
        culturalCn: string;
    };
    vocabulary: Array<{
        en: string;
        ipa: string; // Added IPA
        cn: string;
        example?: string;
    }>;
    sentences: Array<{
        en: string;
        cn: string;
        usage?: string; // Bilingual usage explanation
    }>;
    expressionComparison?: Array<{
        written: string; // Textbook style English
        writtenCn: string; // Textbook style Chinese
        spoken: string;  // Native/Authentic style English
        spokenCn: string; // Native/Authentic style Chinese
        explanation: string; // Bilingual explanation
    }>;
}

export interface Avatar {
  id: string;
  name: string;
  gender: string;
  personality: string;
  speedDescription: string;
  speechRate: number;
  color: string;
  avatarUrl: string;
  selectionTagline: string;
  introMessage: string;
  conclusionMessage: string;
  voiceName: string;
}

export interface Message {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  audioUrl?: string; // New: Store User's audio blob URL
  replayCount?: number;
  meta?: {
    translation?: string; // Keeping for backward compatibility or combined view
    feedbackCn?: string;  // New: Specific translation for feedback
    questionCn?: string;  // New: Specific translation for question
    hints?: string;
    assistantMessage?: string;
    // NEW: Bilingual Example Answer for the Assistant
    exampleAnswer?: {
        en: string;
        cn: string;
    };
    feedback?: string; // New: Feedback part of the response
    nextQuestion?: string; // New: Question part of the response
    // NEW: Structured Better Expressions
    betterExpression?: {
        original: string;
        improved: string;
        improvedCn: string;
    };
  };
  hasRevealedText?: boolean;
  hasUsedTranslation?: boolean;
}

export interface AnalysisItem {
  question: string;
  questionCn?: string; // New: Translated Context
  original: string;
  originalCn?: string; // New: Translated User Speech
  improved: string;
  improvedCn?: string; // New: Translated Improved Speech
  explanation: string;
  type: "grammar" | "vocabulary" | "naturalness" | "pronunciation";
}

export interface SuggestionItem {
  category: string;
  content: string;
  isKeyImprovement: boolean;
}

export interface TestReport {
  isLearningReport?: boolean; // Flag to distinguish
  topicTitle?: string; // New: To store the specific topic or focus area name
  cefrLevel: string;
  toeflScore: string;
  ieltsScore: string;
  overallSummary: string;
  simpleAnalysis: string;
  radarScores: {
    listening: number;
    vocabulary: number;
    grammar: number;
    pronunciation: number;
    fluency: number;
    idiomatic: number;
    coherence: number;
  };
  radarData: {
    subject: string;
    A: number;
    fullMark: number;
  }[];
  // New: Detailed Analysis for Assessment Report
  dimensionAnalysis?: {
    listening: string;
    vocabulary: string;
    grammar: string;
    pronunciation: string;
    fluency: string;
    native: string;
    logic: string;
  };
  strengths: string[];
  weaknesses: string[];
  suggestions: SuggestionItem[];
  detailedAnalysis?: AnalysisItem[];
  
  // New Learning Report Fields
  coreVocabulary?: string[];
  coreSentences?: string[];
  nativeExpressions?: string[];
  learningScore?: number; // 0-100 score
  learningStars?: number; // 1-5 stars
}

// --- NEW TYPES FOR HUB ---
export interface FavoriteItem {
    id: string;
    type: 'VOCAB' | 'SENTENCE' | 'EXPRESSION';
    content: {
        en: string;
        cn: string;
        ipa?: string;
        example?: string; // For expressions/vocab
        usage?: string; // For sentences
    };
    timestamp: number;
}

export interface MistakeItem {
    id: string;
    original: string;
    originalCn?: string; // New
    improved: string;
    improvedCn?: string; 
    explanation: string;
    type: "grammar" | "vocabulary" | "naturalness" | "pronunciation";
    context: string; // The question asked
    contextCn?: string; // New
    timestamp: number;
}
