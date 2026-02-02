
import React, { useState, useEffect, useRef } from 'react';
import { Message, UserProfile, Avatar } from '../types';
import { generateNextQuestion, generateConclusion, transcribeAudio, voiceService, getAssessmentPlan, preloadSessionAudio } from '../services/geminiService';
import { Mic, Play, Pause, HelpCircle, Languages, FileText, Eye, LogOut, AlertTriangle, Clock, Activity, Square, Volume2, MicOff, RefreshCw, Bot, Signal, WifiOff } from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  onComplete: (history: Message[]) => void;
  onQuit: () => void;
  userProfile: UserProfile;
  avatar: Avatar;
}

export const TestInterface: React.FC<Props> = ({ onComplete, onQuit, userProfile, avatar }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [phase, setPhase] = useState<'TESTING' | 'FINISHED'>('TESTING');
  const [totalTurns, setTotalTurns] = useState(0); 
  const [rephraseCount, setRephraseCount] = useState(0); // Track consecutive rephrases
  const [currentReplayCount, setCurrentReplayCount] = useState(0); // Track replays for current question
  const [showTranslation, setShowTranslation] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false); // New state for assistant visibility
  const [showPlayOverlay, setShowPlayOverlay] = useState<{show: boolean, text?: string}>({ show: false });
  
  // Audio Mode State: 'CLOUD' (Gemini) or 'LOCAL' (Browser TTS)
  const [audioMode, setAudioMode] = useState<'CLOUD' | 'LOCAL'>('CLOUD');
  
  // Session Plan State
  const [sessionPlan, setSessionPlan] = useState<string[]>([]);

  // Determine timer and question limit based on type
  const isSpeedRun = userProfile.assessmentType === 'SPEED_RUN';
  const isDeep = userProfile.assessmentType === 'INITIAL_DEEP';
  const isStage = userProfile.assessmentType === 'STAGE_REGULAR' || userProfile.assessmentType === 'STAGE_CUSTOM';
  
  const MAX_QUESTIONS = isSpeedRun ? 6 : (isDeep ? 18 : 12);
  
  // Timer Logic:
  // Speed Run: 10 mins (600s)
  // Regular (Initial): 20 mins (1200s)
  // Deep (Initial): 30 mins (1800s)
  // Stage (Regular & Custom): 30 mins (1800s)
  let initialTimeSeconds = 1200; // Default Regular (20m)
  if (isSpeedRun) initialTimeSeconds = 600; // 10m
  else if (isDeep) initialTimeSeconds = 1800; // 30m
  else if (isStage) initialTimeSeconds = 1800; // 30m

  const [timeLeft, setTimeLeft] = useState(initialTimeSeconds);

  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    type: 'REVEAL' | 'TRANSLATE' | 'QUIT';
    targetTimestamp?: number;
  }>({ show: false, type: 'REVEAL' });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordStartTimeRef = useRef<number>(0);

  // Get the latest examiner message to display
  const latestModelMessage = [...messages].reverse().find(m => m.role === 'model');
  const latestUserMessage = [...messages].reverse().find(m => m.role === 'user');

  useEffect(() => {
    if (phase === 'FINISHED' || timeLeft <= 0) return;
    const timer = setInterval(() => {
        setTimeLeft(prev => {
            if (prev <= 1) {
                clearInterval(timer);
                handleTimeUp();
                return 0;
            }
            return prev - 1;
        });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  // Trigger Confetti on Finish
  useEffect(() => {
    if (phase === 'FINISHED') {
        const duration = 3000;
        const end = Date.now() + duration;

        const frame = () => {
          confetti({
            particleCount: 2,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: ['#0ea5e9', '#ec4899', '#f59e0b']
          });
          confetti({
            particleCount: 2,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: ['#0ea5e9', '#ec4899', '#f59e0b']
          });
          if (Date.now() < end) requestAnimationFrame(frame);
        };
        frame();
    }
  }, [phase]);

  const handleTimeUp = () => {
    alert("Time is up! Let's review your assessment results. / 时间到！正在生成您的测评报告。");
    onComplete(messages);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const start = async () => {
        // Generate Plan
        const plan = getAssessmentPlan(userProfile);
        setSessionPlan(plan);
        
        // Preload plan audio
        preloadSessionAudio(plan, avatar);

        let introText = avatar.introMessage;

        // Logic for English-only Welcome
        // Default to English-only unless it is SpeedRun AND User is Beginner (PreA1/A1)
        const isBeginner = ['PreA1', 'A1', 'A0'].includes(userProfile.previousCefrLevel || '');
        const allowBilingualIntro = isSpeedRun && isBeginner;
        
        if (!allowBilingualIntro) {
            // Strip Chinese part. Assume separator " / " or first occurrence of Chinese char if separator missing
            // The constants use " / " consistently.
            const parts = introText.split(' / ');
            if (parts.length > 0) {
                introText = parts[0];
            }
        }

        const introMsg: Message = { role: 'model', text: introText, timestamp: Date.now() };
        setMessages([introMsg]);
        await playQuestionAudio(introText);
    };
    start();
    return () => { 
        voiceService.stop(); 
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
    };
  }, []);

  const playQuestionAudio = async (text: string) => {
    await voiceService.speak(
        text, 
        avatar, 
        () => setIsPlaying(true), 
        () => setIsPlaying(false),
        audioMode === 'LOCAL', // Force Local Mode if state is LOCAL
        (errorMsg) => {
            // Error Callback
            setIsPlaying(false);
            const userWantsLocal = window.confirm(
                `Native Voice Failed: ${errorMsg}\n\nThis usually happens due to API Key restrictions or network issues on the server.\n\nSwitch to Local Voice (Browser TTS) for better stability?`
            );
            
            if (userWantsLocal) {
                setAudioMode('LOCAL');
                // Retry immediately with local voice
                voiceService.speak(text, avatar, () => setIsPlaying(true), () => setIsPlaying(false), true);
            }
        }
    );
  };

  const togglePlayback = () => {
    if (isPlaying) {
      voiceService.stop();
      setIsPlaying(false);
    } else {
        // Increment replay count when user manually triggers playback
        setCurrentReplayCount(prev => prev + 1);
        if (latestModelMessage) playQuestionAudio(latestModelMessage.text);
    }
  };

  const triggerRevealConfirm = () => {
    if (!latestModelMessage || latestModelMessage.hasRevealedText) return; 
    setConfirmModal({ show: true, type: 'REVEAL', targetTimestamp: latestModelMessage.timestamp });
  };

  const triggerTranslateConfirm = () => {
    if (!latestModelMessage) return;
    if (latestModelMessage.hasUsedTranslation) {
        setShowTranslation(!showTranslation);
        return;
    }
    if (showTranslation) { setShowTranslation(false); } 
    else { setConfirmModal({ show: true, type: 'TRANSLATE' }); }
  };

  const handleConfirmedAction = () => {
    if (confirmModal.type === 'QUIT') {
        onQuit(); 
        return;
    } else if (confirmModal.type === 'REVEAL' && confirmModal.targetTimestamp) {
        setMessages(prev => prev.map(m => m.timestamp === confirmModal.targetTimestamp ? { ...m, hasRevealedText: true } : m));
    } else if (confirmModal.type === 'TRANSLATE') {
        setShowTranslation(true);
        setMessages(prev => {
            const lastModelIdx = [...prev].reverse().findIndex(m => m.role === 'model');
            if (lastModelIdx === -1) return prev;
            const actualIdx = prev.length - 1 - lastModelIdx;
            const newArr = [...prev];
            newArr[actualIdx] = { ...newArr[actualIdx], hasUsedTranslation: true };
            return newArr;
        });
    }
    setConfirmModal({ ...confirmModal, show: false });
  };

  const startRecording = async () => {
    if (isProcessing || isRecording) return;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      recordStartTimeRef.current = Date.now();
      
      mediaRecorder.ondataavailable = (e) => { 
        if (e.data.size > 0) chunksRef.current.push(e.data); 
      };
      
      mediaRecorder.onstop = async () => {
        const duration = Date.now() - recordStartTimeRef.current;
        if (duration < 600) { 
            setIsProcessing(false); 
            setIsRecording(false); 
            return; 
        }

        setIsProcessing(true);
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        
        try {
            const transcription = await transcribeAudio(audioBlob);
            
            if (!transcription) {
                setIsProcessing(false);
                const errorMsg: Message = { role: 'model', text: "I'm sorry, I didn't catch that. Could you repeat please?", timestamp: Date.now() };
                setMessages(prev => [...prev, errorMsg]);
                await playQuestionAudio("I'm sorry, I didn't catch that. Could you repeat please?");
                return;
            }

            // ATTACH REPLAY COUNT to the user message
            const userMsg: Message = { 
                role: 'user', 
                text: transcription, 
                timestamp: Date.now(),
                replayCount: currentReplayCount // Capture how many times they needed to hear the Q
            };

            setMessages(prev => {
                const newHistory = [...prev, userMsg];
                const handleAIResponse = async () => {
                    try {
                        // GENERATE NEXT QUESTION
                        const nextQ = await generateNextQuestion(
                            newHistory, 
                            userProfile, 
                            avatar, 
                            totalTurns, 
                            MAX_QUESTIONS,
                            rephraseCount, 
                            sessionPlan
                        );
                        
                        // STRICT FINISH LOGIC:
                        // If it's NOT a clarification/rephrase, AND we've reached the Max Questions count (totalTurns tracks completed previous questions)
                        // totalTurns starts at 0. Intro is Q1. 
                        // When user answers Q(MAX), totalTurns will be MAX-1.
                        // Example: MAX=6. User answers Q6. totalTurns=5. 5 >= 5 is True. Stop.
                        const hitQuestionLimit = !nextQ.isRephrase && totalTurns >= MAX_QUESTIONS - 1;

                        if (nextQ.isConclusion || hitQuestionLimit) {
                            // Instant conclusion - either natural or forced by limit
                            // If forced by limit, we use the avatar's standard conclusion message instead of a generated question
                            const conclusionText = nextQ.isConclusion ? nextQ.questionText : avatar.conclusionMessage;
                            
                            const endMsg: Message = { role: 'model', text: conclusionText, timestamp: Date.now(), meta: { translation: "测评结束，生成报告中..." } };
                            setMessages(p => [...p, endMsg]);
                            setPhase('FINISHED');
                            setIsProcessing(false);
                            // Audio should be preloaded and cached now
                            await playQuestionAudio(conclusionText);
                        } else {
                            const modelMsg: Message = { 
                                role: 'model', 
                                text: nextQ.questionText, 
                                timestamp: Date.now(), 
                                meta: { 
                                    translation: nextQ.translation, 
                                    hints: nextQ.hints,
                                    assistantMessage: nextQ.assistantMessage
                                } 
                            };
                            setMessages(p => [...p, modelMsg]);
                            setIsProcessing(false);
                            await playQuestionAudio(nextQ.questionText);
                            setShowTranslation(false);
                            setShowHints(false);
                            setShowAssistant(false); // Reset Assistant visibility on new Q

                            // RESET Replay Count for the next turn
                            setCurrentReplayCount(0);

                            if (nextQ.isRephrase) {
                                setRephraseCount(prev => prev + 1);
                            } else {
                                setTotalTurns(prev => prev + 1);
                                setRephraseCount(0); // Reset on new question
                            }
                        }
                    } catch (aiErr) {
                        console.error("AI Error:", aiErr);
                        setIsProcessing(false); 
                    }
                };
                handleAIResponse();
                return newHistory;
            });
        } catch (err) {
            console.error("Process Error:", err);
            setIsProcessing(false); 
        }
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      voiceService.stop();
      setIsPlaying(false);
    } catch (err) { 
        alert("Microphone access is required."); 
        setIsRecording(false);
        setIsProcessing(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      setIsRecording(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col relative overflow-hidden">
      {/* Background Ambience */}
      <div className={`absolute inset-0 transition-colors duration-1000 ${isRecording ? 'bg-orange-50' : isPlaying ? 'bg-blue-50' : 'bg-gray-50'}`}></div>

      {confirmModal.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-brand-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-gray-100 transform scale-100">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 mx-auto ${confirmModal.type === 'QUIT' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                    <AlertTriangle size={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 text-center mb-2">{confirmModal.type === 'QUIT' ? 'Quit Assessment?' : 'Support Feature'}</h3>
                <p className="text-gray-600 text-center text-sm leading-relaxed mb-8">
                    {confirmModal.type === 'QUIT' ? "Are you sure? Progress will be lost." : "This will impact your score."}
                </p>
                <div className="flex gap-3">
                    <button onClick={() => setConfirmModal({ ...confirmModal, show: false })} className="flex-1 px-6 py-3 rounded-xl border border-gray-200 text-gray-500 font-bold hover:bg-gray-50">Cancel</button>
                    <button onClick={handleConfirmedAction} className={`flex-1 px-6 py-3 rounded-xl text-white font-bold ${confirmModal.type === 'QUIT' ? 'bg-red-600' : 'bg-brand-600'}`}>Confirm</button>
                </div>
            </div>
        </div>
      )}

      {/* Header */}
      <div className="relative z-20 px-6 py-4 flex justify-between items-start">
        <div className="flex flex-col">
            <div className="flex items-center gap-2 text-gray-600">
                <div className={`w-2 h-2 rounded-full ${isProcessing ? 'bg-yellow-400 animate-pulse' : 'bg-green-500'}`}></div>
                <span className="text-xs font-bold uppercase tracking-wider">{phase === 'FINISHED' ? 'Completed' : 'Live Assessment'}</span>
            </div>
            {/* Audio Mode Toggle */}
            <button 
                onClick={() => setAudioMode(prev => prev === 'CLOUD' ? 'LOCAL' : 'CLOUD')}
                className={`mt-2 flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors
                    ${audioMode === 'CLOUD' 
                        ? 'bg-brand-50 text-brand-600 border-brand-200' 
                        : 'bg-gray-100 text-gray-500 border-gray-200'}
                `}
            >
                {audioMode === 'CLOUD' ? <Signal size={12} /> : <WifiOff size={12} />}
                {audioMode === 'CLOUD' ? 'AI Voice On' : 'Local Voice'}
            </button>
        </div>
        
        <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-4">
                 {phase === 'TESTING' && (
                    <div className="bg-white/80 backdrop-blur-sm px-4 py-1.5 rounded-full border border-gray-200 text-xs font-bold text-gray-600 shadow-sm">
                        {Math.max(0, MAX_QUESTIONS - totalTurns)} Questions Left
                    </div>
                 )}
                 <button onClick={() => setConfirmModal({ show: true, type: 'QUIT' })} className="p-2.5 bg-white/80 backdrop-blur-sm rounded-full text-gray-500 hover:text-red-500 hover:bg-red-50 transition-all border shadow-sm">
                    <LogOut size={18} />
                 </button>
            </div>
             <div className="flex items-center gap-1 text-gray-400 text-sm font-mono bg-white/50 px-2 py-0.5 rounded-md">
                <Clock size={14} />
                <span>{formatTime(timeLeft)}</span>
            </div>
        </div>
      </div>

      {/* Main Content: Avatar & Visualization */}
      <div className="flex-1 relative z-10 flex flex-col items-center justify-center p-6">
         
         {/* Avatar Container */}
         <div className="relative mb-10 group">
            {/* Ripples for AI Speaking */}
            {isPlaying && (
                <>
                    <div className="absolute inset-0 rounded-full border-4 border-brand-200 animate-ping opacity-20"></div>
                    <div className="absolute -inset-4 rounded-full border border-brand-300 animate-pulse opacity-30"></div>
                </>
            )}
            
            {/* Thinking Halo */}
            {isProcessing && (
                <div className="absolute -inset-2 rounded-full border-t-4 border-yellow-400 animate-spin"></div>
            )}

            <div className="relative w-40 h-40 md:w-56 md:h-56 rounded-full p-1.5 bg-white shadow-2xl overflow-hidden ring-1 ring-gray-100">
                <img src={avatar.avatarUrl} alt={avatar.name} className="w-full h-full rounded-full object-cover" />
            </div>
            
            {/* --- SEPARATE ASSISTANT AVATAR (Conditional Visibility) --- */}
            {latestModelMessage?.meta?.assistantMessage && showAssistant && phase === 'TESTING' && (
                <div className="absolute -top-12 -right-8 md:-right-40 md:top-4 flex flex-col items-center z-50 w-48 pointer-events-none transition-all duration-500 transform translate-y-0 opacity-100 animate-fadeIn">
                    {/* Assistant Avatar Icon */}
                    <div className="w-12 h-12 bg-orange-100 rounded-full border-2 border-white shadow-lg flex items-center justify-center mb-1 z-20 relative">
                        <Bot size={24} className="text-orange-500" />
                        <div className="absolute -bottom-1 -right-1 bg-green-500 w-3 h-3 rounded-full border border-white"></div>
                    </div>
                    {/* Speech Bubble */}
                    <div className="bg-white border border-orange-200 rounded-2xl rounded-tr-none p-3 shadow-xl w-full relative z-10 text-left">
                         <div className="absolute -top-2 right-4 w-3 h-3 bg-white border-t border-r border-orange-200 transform -rotate-45"></div>
                        <p className="text-[10px] font-bold text-orange-600 uppercase mb-0.5 tracking-wider">Assistant</p>
                        <p className="text-sm text-gray-700 leading-snug">
                            {latestModelMessage.meta.assistantMessage}
                        </p>
                    </div>
                </div>
            )}

            {/* Status Badge */}
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur shadow-lg px-4 py-1.5 rounded-full flex items-center gap-2 border border-gray-100">
                 {isProcessing ? (
                     <>
                        <RefreshCw size={14} className="animate-spin text-brand-600" />
                        <span className="text-xs font-bold text-gray-600">Thinking...</span>
                     </>
                 ) : isPlaying ? (
                     <>
                        <Volume2 size={14} className={`text-brand-600 ${audioMode === 'CLOUD' ? 'animate-pulse' : ''}`} />
                        <span className="text-xs font-bold text-brand-600">{audioMode === 'CLOUD' ? 'Speaking (AI)...' : 'Speaking (Local)...'}</span>
                     </>
                 ) : isRecording ? (
                     <>
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                        <span className="text-xs font-bold text-red-500">Listening...</span>
                     </>
                 ) : (
                     <span className="text-xs font-bold text-gray-400">Waiting</span>
                 )}
            </div>
         </div>

         {/* Message Bubble (Current Question) */}
         {latestModelMessage && phase !== 'FINISHED' && (
             <div className="max-w-md w-full transition-all duration-500">
                 <div className={`bg-white/90 backdrop-blur-md rounded-2xl p-6 shadow-xl border border-gray-100 text-center relative overflow-visible transition-all
                     ${!latestModelMessage.hasRevealedText ? 'cursor-pointer hover:bg-white' : ''}
                 `}
                 onClick={triggerRevealConfirm}
                 >
                     {!latestModelMessage.hasRevealedText ? (
                        <div className="flex flex-col items-center justify-center py-4">
                            <div className="filter blur-md opacity-30 select-none text-lg mb-2">
                                {latestModelMessage.text.substring(0, 50)}...
                            </div>
                            <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                                <Eye size={24} className="text-brand-500 mb-2" />
                                <span className="text-sm font-bold text-gray-500">Tap to Reveal Text</span>
                            </div>

                            {/* HINTS (Visible even when blurred if toggled) */}
                           {showHints && latestModelMessage.meta?.hints && (
                               <div className="absolute bottom-2 left-0 right-0 flex justify-center z-20 px-2 pointer-events-none">
                                   <div className="flex flex-wrap justify-center gap-2 bg-white/80 backdrop-blur-md p-2 rounded-xl border border-indigo-100 shadow-sm">
                                       {latestModelMessage.meta.hints.split(',').map((hint, i) => (
                                           <span key={i} className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md text-xs font-bold border border-indigo-100">
                                               {hint.trim()}
                                           </span>
                                       ))}
                                   </div>
                               </div>
                           )}
                        </div>
                     ) : (
                        <div>
                            <p className="text-lg md:text-xl font-medium text-gray-800 leading-relaxed">
                                {latestModelMessage.text}
                            </p>
                            {/* Translation */}
                            {showTranslation && latestModelMessage.meta?.translation && (
                                <div className="mt-4 pt-4 border-t border-gray-100 text-gray-500 italic">
                                    {latestModelMessage.meta.translation}
                                </div>
                            )}
                            
                            {/* Hints */}
                            {showHints && latestModelMessage.meta?.hints && (
                                <div className="mt-4 flex flex-wrap justify-center gap-2">
                                    {latestModelMessage.meta.hints.split(',').map((hint, i) => (
                                        <span key={i} className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold border border-indigo-100">
                                            {hint.trim()}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                     )}
                 </div>
             </div>
         )}
         
         {/* Finished State View */}
         {phase === 'FINISHED' && (
            <div className="text-center">
                <h3 className="text-2xl font-bold text-gray-800 mb-2">Assessment Complete!</h3>
                <p className="text-gray-500 mb-8">Great job. Your results are ready.</p>
                <div className="flex gap-4 justify-center">
                    <button 
                        onClick={() => (window as any).onReviewTranscript && (window as any).onReviewTranscript(messages)} 
                        className="bg-white border-2 border-brand-200 text-brand-700 px-6 py-3 rounded-xl font-bold hover:bg-brand-50 shadow-sm"
                    >
                        Transcript
                    </button>
                    <button 
                        onClick={() => onComplete(messages)} 
                        className="bg-brand-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-brand-700 shadow-lg"
                    >
                        View Report
                    </button>
                </div>
            </div>
         )}

         {/* User Speech Transcript Preview (Temporary) */}
         {latestUserMessage && !latestModelMessage && (
             <div className="mt-6 text-center max-w-md">
                 <p className="text-gray-400 text-sm mb-1">You said:</p>
                 <p className="text-gray-800 font-medium bg-gray-100 px-4 py-2 rounded-xl inline-block">"{latestUserMessage.text}"</p>
             </div>
         )}
      </div>

      {/* Controls Bar */}
      {phase === 'TESTING' && (
      <div className="relative z-20 bg-white border-t border-gray-100 p-6 pb-8 md:pb-10 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
         <div className="max-w-lg mx-auto flex items-center justify-between">
            
            {/* Left Controls */}
            <div className="flex gap-3">
                <button 
                    onClick={triggerTranslateConfirm} 
                    className={`p-3 rounded-full transition-all ${showTranslation ? 'bg-brand-100 text-brand-600' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                    title="Translate"
                >
                    <Languages size={20} />
                </button>
                <button 
                    onClick={() => setShowHints(!showHints)} 
                    className={`p-3 rounded-full transition-all ${showHints ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                    title="Hints"
                >
                    <HelpCircle size={20} />
                </button>
                <button 
                    onClick={() => setShowAssistant(!showAssistant)} 
                    className={`p-3 rounded-full transition-all ${showAssistant ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                    title="Assistant Help"
                >
                    <Bot size={20} />
                </button>
            </div>

            {/* Mic Button (Center) */}
            <div className="relative -top-6">
                <div className={`absolute inset-0 rounded-full bg-brand-200 animate-ping opacity-50 ${isRecording ? 'block' : 'hidden'}`}></div>
                <button 
                    onClick={() => { if (isRecording) stopRecording(); else startRecording(); }}
                    disabled={isProcessing || isPlaying}
                    className={`relative w-20 h-20 rounded-full flex items-center justify-center shadow-xl transition-all transform hover:scale-105 active:scale-95 border-4 border-white
                        ${isRecording ? 'bg-red-500 shadow-red-200' : isProcessing ? 'bg-gray-300 cursor-not-allowed' : 'bg-brand-600 shadow-brand-200'}
                    `}
                >
                    {isRecording ? <Square size={28} fill="currentColor" className="text-white" /> : <Mic size={32} className="text-white" />}
                </button>
            </div>

            {/* Right Controls */}
            <div className="flex gap-3">
                <button 
                    onClick={togglePlayback} 
                    disabled={isRecording || isProcessing}
                    className={`p-3 rounded-full transition-all ${isPlaying ? 'bg-brand-100 text-brand-600' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                    title="Replay Audio"
                >
                    {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                </button>
                <button
                    onClick={() => triggerRevealConfirm()}
                    className={`p-3 rounded-full transition-all ${latestModelMessage?.hasRevealedText ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                    title="Reveal Text"
                >
                   {latestModelMessage?.hasRevealedText ? <FileText size={20} /> : <Eye size={20} />}
                </button>
            </div>

         </div>
         <p className="text-center text-xs text-gray-400 mt-2 font-medium">
             {isRecording ? "Tap to Stop" : "Tap Microphone to Answer"}
         </p>
      </div>
      )}
    </div>
  );
};
