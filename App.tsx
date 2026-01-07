
import React, { useState, useEffect, useRef } from 'react';
import { WelcomeScreen } from './components/WelcomeScreen';
import { SetupScreen } from './components/SetupScreen';
import { TestInterface } from './components/TestInterface';
import { LearningSetupScreen } from './components/LearningSetupScreen';
import { LearningInterface } from './components/LearningInterface';
import { ReportScreen } from './components/ReportScreen';
import { TestStage, Message, TestReport, UserProfile, Avatar, AssessmentType, LearningConfig } from './types';
import { generateFinalReport, preloadAvatarAudio, generateLearningResponse, voiceService } from './services/geminiService';
import { Loader2, Play, ChevronRight, ArrowLeft, Languages, MessageSquare, FileText, Download, Image as ImageIcon, Printer } from 'lucide-react';
import html2canvas from 'html2canvas';

const App: React.FC = () => {
  const [stage, setStage] = useState<TestStage>(TestStage.WELCOME);
  
  // Assessment State
  const [report, setReport] = useState<TestReport | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [selectedAssessmentType, setSelectedAssessmentType] = useState<AssessmentType>('INITIAL_REGULAR');
  
  // Learning State
  const [learningConfig, setLearningConfig] = useState<LearningConfig | null>(null);
  const [initialLearningMessage, setInitialLearningMessage] = useState<Message | undefined>(undefined);

  // Common State
  const [selectedAvatar, setSelectedAvatar] = useState<Avatar | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isPreloadComplete, setIsPreloadComplete] = useState(false);
  const [testHistory, setTestHistory] = useState<Message[]>([]);
  const [testFinishedManually, setTestFinishedManually] = useState(false);

  // Ref for Transcript Capture
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (window as any).onReviewTranscript = (history: Message[]) => {
      setTestHistory(history);
      setTestFinishedManually(true);
      setStage(TestStage.TRANSCRIPT);
    };
  }, []);

  // --- Assessment Flow ---
  const startAssessmentSetup = (type: AssessmentType) => {
    setSelectedAssessmentType(type);
    setStage(TestStage.SETUP);
  };

  const handleAssessmentSetupComplete = async (profile: UserProfile, avatar: Avatar) => {
    setUserProfile(profile);
    setSelectedAvatar(avatar);
    setStage(TestStage.LOADING);
    startLoading(avatar, TestStage.TESTING);
  };

  // --- Learning Flow ---
  const startLearningSetup = () => {
    setStage(TestStage.LEARN_SETUP);
  };

  const handleLearningSetupComplete = async (config: LearningConfig, avatar: Avatar) => {
      setLearningConfig(config);
      setSelectedAvatar(avatar);
      setStage(TestStage.LEARN_LOADING);
      // Pass config to loader
      startLoading(avatar, TestStage.LEARNING, config);
  };

  // --- Common Loading Logic ---
  const startLoading = async (avatar: Avatar, nextStage: TestStage, learningCfg?: LearningConfig) => {
    setIsPreloadComplete(false);
    setInitialLearningMessage(undefined); // Reset
    setLoadingProgress(5);
    
    try {
        setLoadingProgress(10);
        
        // 1. Preload Avatar standard audio (Intro/Conclusion)
        // Always preload for HQ experience
        await preloadAvatarAudio(avatar, (pct) => {
           setLoadingProgress(10 + Math.floor(pct * 0.4)); // Up to 50%
        });

        // 2. If Learning Mode, Generate and Preload Intro Context
        if (nextStage === TestStage.LEARNING && learningCfg) {
             setLoadingProgress(55);
             
             // Step A: Generate the opening Text (LLM) - Always needed
             const opening = await generateLearningResponse([], learningCfg, avatar, 0);
             setLoadingProgress(75);

             // Step B: Preload the Audio (TTS)
             // Always preload specific intro text
             await voiceService.preloadSpecificText(opening.text, avatar);
             
             setInitialLearningMessage({
                 role: 'model',
                 text: opening.text,
                 timestamp: Date.now(),
                 meta: {
                     translation: opening.translation,
                     hints: opening.hints,
                     assistantMessage: opening.assistantMessage
                 }
             });
             setLoadingProgress(95);
        }

        setLoadingProgress(100);
        setIsPreloadComplete(true);
    } catch (e) {
        console.error("Audio preparation failed", e);
        setIsPreloadComplete(true);
    }
  };

  const handleStartSession = () => {
      if (stage === TestStage.LOADING) setStage(TestStage.TESTING);
      if (stage === TestStage.LEARN_LOADING) setStage(TestStage.LEARNING);
  };

  const handleSessionComplete = async (history: Message[], forceReport: boolean = false) => {
    setTestHistory(history);
    setTestFinishedManually(true);
    
    // Check if learning mode and if turns are sufficient
    // ONLY check threshold if NOT forced
    if (!forceReport && learningConfig) {
        // Calculate user turns (approx half of messages)
        const userTurns = history.filter(m => m.role === 'user').length;
        if (userTurns < 6) {
            // Less than 6 turns, skip report generation
            alert("Session too short for analysis report. Showing transcript only. \n会话过短无法生成报告，仅显示记录。");
            setStage(TestStage.TRANSCRIPT);
            return;
        }
    }

    setStage(TestStage.ANALYZING);
    try {
      // Pass the duration to generateFinalReport to determine vocab quantity
      const result = await generateFinalReport(history, learningConfig?.duration);
      
      // Post-process for Learning Mode
      if (stage === TestStage.LEARNING || learningConfig) {
          result.isLearningReport = true;
          result.simpleAnalysis = "Great practice! Review your detailed analysis below. (练习很棒！请查看下方的详细分析。)";
          
          // Inject Topic Title
          if (learningConfig) {
             if (learningConfig.mode === 'TOPIC' && learningConfig.topic) {
                 result.topicTitle = `${learningConfig.topic.titleEn} ${learningConfig.topic.titleCn}`;
             } else if (learningConfig.mode === 'CUSTOM' && learningConfig.customContext) {
                 result.topicTitle = `Custom Practice: ${learningConfig.customContext.focusArea}`;
             }
          }
      }

      setReport(result);
      setStage(TestStage.REPORT);
    } catch (error) {
      console.error("Failed to generate report", error);
      alert("生成报告时出错，请重试。");
      setStage(TestStage.TRANSCRIPT); 
    }
  };

  const handleRestart = (force: boolean = false) => {
    if (!force && (stage === TestStage.TRANSCRIPT || stage === TestStage.REPORT || stage === TestStage.TESTING || stage === TestStage.LEARNING)) {
        if (!window.confirm("Return to home? Unsaved progress will be lost. / 返回首页？未保存的进度将丢失。")) return;
    }
    setReport(null);
    setUserProfile(null);
    setLearningConfig(null);
    setSelectedAvatar(null);
    setTestHistory([]);
    setTestFinishedManually(false);
    setStage(TestStage.WELCOME);
    setIsPreloadComplete(false);
  };

  const handleBackToResults = () => {
    if (report) {
        setStage(TestStage.REPORT);
    } else {
        // If no report exists (e.g. short learning session or manual review without report),
        // Back acts as Exit to Home
        if (window.confirm("Return to Home? / 返回首页？")) {
             handleRestart(true);
        }
    }
  };

  const handleSaveTranscriptImage = async () => {
    if (!transcriptRef.current) return;
    
    // Create a deep clone to manipulate for capture without affecting UI
    const originalElement = transcriptRef.current;
    const clone = originalElement.cloneNode(true) as HTMLElement;
    
    // Style the clone to expand fully
    clone.style.height = 'auto';
    clone.style.maxHeight = 'none';
    clone.style.overflow = 'visible';
    clone.style.width = `${originalElement.offsetWidth}px`;
    clone.style.position = 'absolute';
    clone.style.left = '-9999px';
    clone.style.top = '0';
    clone.style.background = '#f8fafc'; // Match bg-slate-50
    clone.style.padding = '40px'; // Add some padding for the image
    
    document.body.appendChild(clone);
    
    try {
        const canvas = await html2canvas(clone, {
            scale: 2, // Higher quality
            useCORS: true,
            logging: false,
            backgroundColor: '#f8fafc'
        });
        
        const link = document.createElement('a');
        link.download = `Transcript-${new Date().toISOString().slice(0,10)}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    } catch (e) {
        console.error("Screenshot failed", e);
        alert("Failed to export transcript.");
    } finally {
        document.body.removeChild(clone);
    }
  };

  const handlePrintTranscript = () => {
      window.print();
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      
      {stage === TestStage.WELCOME && (
          <WelcomeScreen onStartAssessment={startAssessmentSetup} onStartLearning={startLearningSetup} />
      )}
      
      {stage === TestStage.SETUP && (
          <SetupScreen onComplete={handleAssessmentSetupComplete} assessmentType={selectedAssessmentType} onBack={() => setStage(TestStage.WELCOME)} />
      )}

      {stage === TestStage.LEARN_SETUP && (
          <LearningSetupScreen onComplete={handleLearningSetupComplete} onBack={() => setStage(TestStage.WELCOME)} />
      )}

      {(stage === TestStage.LOADING || stage === TestStage.LEARN_LOADING) && (
          <div className="min-h-screen flex flex-col items-center justify-center bg-brand-50 p-6 text-center animate-fadeIn">
              <div className="relative w-32 h-32 mb-8">
                <div className="absolute inset-0 border-4 border-gray-200 rounded-full"></div>
                <div className={`absolute inset-0 border-4 rounded-full transition-all duration-300 ${stage === TestStage.LEARN_LOADING ? 'border-emerald-600' : 'border-brand-600'}`} style={{ clipPath: `inset(${100 - loadingProgress}% 0 0 0)` }}></div>
                <div className={`absolute inset-0 flex items-center justify-center font-bold text-2xl ${stage === TestStage.LEARN_LOADING ? 'text-emerald-700' : 'text-brand-700'}`}>{loadingProgress}%</div>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">{isPreloadComplete ? 'Ready!' : 'Preparing...'}</h2>
              <p className="text-gray-500 mb-6 text-sm">
                  {stage === TestStage.LEARN_LOADING 
                    ? "Preloading high-quality neural voice for smoothness..." 
                    : "Initializing session..."}
              </p>
              {isPreloadComplete && (
                  <button 
                    onClick={handleStartSession} 
                    className={`${stage === TestStage.LEARN_LOADING ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-brand-600 hover:bg-brand-700'} text-white font-bold py-5 px-10 rounded-2xl shadow-2xl flex items-center gap-3 transition-all transform hover:-translate-y-1`}
                  >
                      <Play size={24} fill="currentColor" /> {stage === TestStage.LEARN_LOADING ? 'Start Practice / 开始练习' : 'Enter Exam Room / 进入考场'}
                  </button>
              )}
          </div>
      )}

      {stage === TestStage.TESTING && userProfile && selectedAvatar && (
          <TestInterface onComplete={(history) => handleSessionComplete(history, false)} onQuit={() => handleRestart(true)} userProfile={userProfile} avatar={selectedAvatar} />
      )}

      {stage === TestStage.LEARNING && learningConfig && selectedAvatar && (
          <LearningInterface 
            onComplete={(history) => handleSessionComplete(history, false)} 
            onQuit={() => handleRestart(true)} 
            config={learningConfig} 
            avatar={selectedAvatar} 
            initialMessage={initialLearningMessage}
          />
      )}

      {stage === TestStage.ANALYZING && (
        <div className="min-h-screen flex flex-col items-center justify-center bg-brand-50 p-6 text-center">
          <Loader2 className="w-16 h-16 text-brand-600 animate-spin mb-6" />
          <h2 className="text-2xl font-bold text-gray-800">Generating Analysis...<br/><span className="text-lg font-normal text-gray-600">正在生成报告...</span></h2>
        </div>
      )}

      {stage === TestStage.REPORT && report && (
        <div className="flex flex-col">
            <div className="bg-white border-b p-4 flex justify-between no-print sticky top-0 z-[50] shadow-sm">
                 <button onClick={() => handleRestart(false)} className="text-gray-500 hover:text-gray-800 font-bold flex items-center gap-2"><ArrowLeft size={18}/> Home</button>
                 <button onClick={() => setStage(TestStage.TRANSCRIPT)} className="bg-brand-50 text-brand-700 px-4 py-2 rounded-xl font-bold border border-brand-200 hover:bg-brand-100 flex items-center gap-2"><MessageSquare size={18}/> Review Transcript</button>
            </div>
            <ReportScreen report={report} onRestart={() => handleRestart(true)} history={testHistory} />
        </div>
      )}

      {stage === TestStage.TRANSCRIPT && (
        <div className="min-h-screen bg-gray-50 p-6 flex flex-col items-center print:p-0 print:bg-white">
            <div className="max-w-3xl w-full bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col h-[85vh] print:h-auto print:shadow-none print:rounded-none print:max-w-none">
                <div className={`p-6 text-white flex justify-between items-center no-print ${learningConfig ? 'bg-emerald-600' : 'bg-brand-600'}`}>
                    <div>
                        <h2 className="text-2xl font-bold">Review Transcript / 会话复盘</h2>
                        <p className="text-white/80 text-sm mt-1">{testHistory.length} Messages</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleSaveTranscriptImage} className="p-3 bg-white/10 rounded-xl hover:bg-white/20 transition-all flex items-center gap-2 font-bold" title="Save as Image">
                            <ImageIcon size={20} />
                        </button>
                        <button onClick={handlePrintTranscript} className="p-3 bg-white/10 rounded-xl hover:bg-white/20 transition-all flex items-center gap-2 font-bold" title="Print / Save PDF">
                            <Printer size={20} />
                        </button>
                        <button onClick={handleBackToResults} className="p-3 bg-white/10 rounded-xl hover:bg-white/20 transition-all flex items-center gap-2 font-bold ml-2">
                            <ArrowLeft size={20} /> Back
                        </button>
                    </div>
                </div>
                
                {/* Print-only Header */}
                <div className="hidden print:block p-8 border-b text-center">
                    <h1 className="text-3xl font-bold text-gray-900">Conversation Transcript</h1>
                    <p className="text-gray-500">Marvel English ProSpeak</p>
                </div>

                <div ref={transcriptRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50 print:overflow-visible print:h-auto print:bg-white">
                    {testHistory.map((msg, i) => (
                        <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} print:break-inside-avoid`}>
                            <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm relative ${msg.role === 'user' ? (learningConfig ? 'bg-emerald-600 text-white print:border print:border-emerald-600 print:text-black print:bg-white' : 'bg-brand-600 text-white print:border print:border-brand-600 print:text-black print:bg-white') : 'bg-white border text-gray-800 print:border-gray-300'}`}>
                                <p className="text-xs font-bold mb-1 opacity-70 uppercase tracking-wider">{msg.role === 'user' ? (learningConfig ? 'You (Student)' : 'You (Candidate)') : (selectedAvatar?.name || 'AI Tutor')}</p>
                                <p className="text-lg leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                                {msg.role === 'model' && msg.meta?.translation && (
                                    <div className="mt-3 pt-3 border-t border-gray-100/30 italic text-sm opacity-90 flex items-start gap-2 print:border-gray-200">
                                        <Languages size={14} className="shrink-0 mt-1" /><span>{msg.meta.translation}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="p-6 bg-white border-t flex justify-center gap-4 no-print">
                    {!report && <button onClick={() => handleSessionComplete(testHistory, true)} className={`${learningConfig ? 'bg-emerald-600' : 'bg-brand-600'} text-white px-8 py-3 rounded-xl font-bold shadow-lg flex items-center gap-2`}><FileText size={18}/> Generate Analysis Report</button>}
                    {report && <button onClick={() => setStage(TestStage.REPORT)} className={`${learningConfig ? 'bg-emerald-600' : 'bg-brand-600'} text-white px-8 py-3 rounded-xl font-bold shadow-lg flex items-center gap-2`}><MessageSquare size={18}/> View Report</button>}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
export default App;
