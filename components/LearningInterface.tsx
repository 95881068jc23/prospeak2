
import React, { useState, useEffect, useRef } from 'react';
import { Message, Avatar, LearningConfig, VoiceType, PlaybackSpeed } from '../types';
import { generateLearningResponse, transcribeAudio, voiceService, scorePronunciation } from '../services/geminiService';
import { Mic, Play, Pause, HelpCircle, Languages, FileText, LogOut, Square, Bot, GraduationCap, Sparkles, Wifi, AlertTriangle, Clock, Settings, Camera, ThumbsUp, XCircle, RefreshCw, BarChart, ArrowRight, Lightbulb, Star } from 'lucide-react';
import html2canvas from 'html2canvas';
import confetti from 'canvas-confetti';

interface Props {
  onComplete: (history: Message[]) => void;
  onQuit: () => void;
  config: LearningConfig;
  avatar: Avatar;
  initialMessage?: Message; // New prop for preloaded intro
}

const CEFR_LEVELS = ['PreA1', 'A1', 'A2', 'A2+', 'B1', 'B1+', 'B2', 'B2+', 'C1', 'C1+'];

export const LearningInterface: React.FC<Props> = ({ onComplete, onQuit, config, avatar, initialMessage }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [totalTurns, setTotalTurns] = useState(0); 
  const [showTranslation, setShowTranslation] = useState(false);
  const [showHints, setShowHints] = useState(false); 
  const [showAssistant, setShowAssistant] = useState(false); 
  const [elapsedTime, setElapsedTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1.0);
  
  // Practice Mode State
  const [isPracticeRecording, setIsPracticeRecording] = useState(false);
  const [practiceScore, setPracticeScore] = useState<{score: number, stars: number} | null>(null);
  const [isPracticeProcessing, setIsPracticeProcessing] = useState(false);

  // Dynamic Difficulty
  const [currentLevel, setCurrentLevel] = useState<string>(config.level);

  // Feedback Animations
  const [showGoodJob, setShowGoodJob] = useState(false);
  // Error Feedback
  const [voiceErrorMsg, setVoiceErrorMsg] = useState<string | null>(null);

  // Phase management: ACTIVE -> CONCLUSION_PLAYING -> CONCLUSION_DONE -> FINISHED
  const [phase, setPhase] = useState<'ACTIVE' | 'CONCLUSION_PLAYING' | 'CONCLUSION_DONE' | 'FINISHED'>('ACTIVE');

  // Voice State
  const [currentVoiceType, setCurrentVoiceType] = useState<VoiceType>(config.voiceType);

  // Exit Modal State
  const [showExitModal, setShowExitModal] = useState(false);
  
  // Updated Turn Logic: Light=12, Standard=20, Deep=30
  const targetTurns = config.duration === 'LIGHT' ? 12 : config.duration === 'STANDARD' ? 20 : 30;

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const practiceRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const practiceChunksRef = useRef<Blob[]>([]);
  const recordStartTimeRef = useRef<number>(0);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const latestModelMessage = [...messages].reverse().find(m => m.role === 'model');
  const latestUserMessage = [...messages].reverse().find(m => m.role === 'user');
  
  // Find the user message specifically for the latest model message (usually the one before it)
  // We need this to get the user's audio URL for the "You" section
  const previousUserMessage = messages.length >= 2 ? messages[messages.length - 2] : null;
  const userAudioUrl = previousUserMessage?.role === 'user' ? previousUserMessage.audioUrl : null;

  // Timer
  useEffect(() => {
      if (phase === 'FINISHED') return;
      const timer = setInterval(() => setElapsedTime(p => p + 1), 1000);
      return () => clearInterval(timer);
  }, [phase]);

  // Apply Speed Change
  useEffect(() => {
      voiceService.setSpeed(playbackSpeed);
  }, [playbackSpeed]);

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
            colors: ['#059669', '#10b981', '#34d399'] // Emerald shades
          });
          confetti({
            particleCount: 2,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: ['#059669', '#10b981', '#34d399']
          });
          if (Date.now() < end) requestAnimationFrame(frame);
        };
        frame();
    }
    // Cleanup confetti to remove canvas overlay
    return () => {
        try { confetti.reset(); } catch(e) {}
    };
  }, [phase]);

  // Initialize
  useEffect(() => {
    const start = async () => {
        if (initialMessage) {
            setMessages([initialMessage]);
            await playQuestionAudio(initialMessage.text);
        } else {
            // Fallback generation if no initial message
            setIsProcessing(true);
            const opening = await generateLearningResponse([], config, avatar, 0, currentLevel);
            const introMsg: Message = { 
                role: 'model', 
                text: opening.text, 
                timestamp: Date.now(),
                meta: { 
                    translation: opening.translation, 
                    feedbackCn: opening.feedbackCn,
                    questionCn: opening.questionCn,
                    hints: opening.hints, 
                    assistantMessage: opening.assistantMessage,
                    feedback: opening.feedback,
                    nextQuestion: opening.question,
                    exampleAnswer: opening.exampleAnswer
                } 
            };
            setMessages([introMsg]);
            setIsProcessing(false);
            await playQuestionAudio(opening.text);
        }
    };
    start();
    return () => { 
        voiceService.stop(); 
        if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
        if (practiceRecorderRef.current) practiceRecorderRef.current.stop();
    };
  }, []);

  const handleManualExitClick = () => {
      if (phase === 'FINISHED') return;
      // Check if turns are sufficient
      if (totalTurns < 6) {
          setShowExitModal(true);
      } else {
          setPhase('FINISHED');
      }
  };

  const confirmExit = () => {
      setShowExitModal(false);
      onQuit();
  };

  const playQuestionAudio = async (text: string, onAudioEnd?: () => void) => {
    const useLocal = currentVoiceType === 'STANDARD';
    
    // Ensure speed is set before playing
    voiceService.setSpeed(playbackSpeed);

    await voiceService.speak(
        text, 
        avatar, 
        () => setIsPlaying(true), 
        () => {
            setIsPlaying(false);
            if (onAudioEnd) onAudioEnd();
        },
        useLocal, 
        (err) => {
            console.warn("Audio failed", err);
            // If Native voice failed, switch to Standard and notify user
            if (!useLocal) {
                setCurrentVoiceType('STANDARD');
                setVoiceErrorMsg("Native voice unavailable. Switched to Standard voice.");
                setTimeout(() => setVoiceErrorMsg(null), 4000);
            }
        }
    );
  };

  const handlePlayUserAudio = (url: string) => {
      if (isPlaying) { voiceService.stop(); setIsPlaying(false); return; }
      const audio = new Audio(url);
      audio.onended = () => setIsPlaying(false);
      setIsPlaying(true);
      audio.play();
  };

  const handlePlayBetterExpression = (text: string) => {
      if (isPlaying) { voiceService.stop(); setIsPlaying(false); return; }
      playQuestionAudio(text);
  };

  const togglePlayback = () => {
    if (isPlaying) {
      voiceService.stop();
      setIsPlaying(false);
    } else {
        if (latestModelMessage) playQuestionAudio(latestModelMessage.text);
    }
  };

  const handleVoiceToggle = () => {
      // If currently STANDARD, try switching to HQ
      // If currently HQ, switch to STANDARD
      const nextType = currentVoiceType === 'HQ' ? 'STANDARD' : 'HQ';
      setCurrentVoiceType(nextType);
      
      // Feedback
      if (nextType === 'HQ') {
          // Verify by stopping current audio and maybe showing a "Native Enabled" toast
          voiceService.stop();
          setIsPlaying(false);
      } else {
          voiceService.stop();
          setIsPlaying(false);
      }
  };

  const exportChat = async () => {
    if (!chatContainerRef.current) return;
    try {
        const element = chatContainerRef.current;
        const canvas = await html2canvas(element, {
            scale: 2,
            backgroundColor: '#ffffff',
            useCORS: true
        });
        const link = document.createElement('a');
        link.download = `Learning-Session-${new Date().toISOString().slice(0,10)}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    } catch (e) {
        alert("Export failed. Please try again.");
    }
  };

  // --- PRACTICE MODE (Follow Read) ---
  const startPracticeRecording = async (targetText: string) => {
      if (isPracticeRecording || isPracticeProcessing) return;
      setPracticeScore(null); // Reset score
      
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const mediaRecorder = new MediaRecorder(stream);
          practiceRecorderRef.current = mediaRecorder;
          practiceChunksRef.current = [];
          
          mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) practiceChunksRef.current.push(e.data); };
          
          mediaRecorder.onstop = async () => {
              setIsPracticeProcessing(true);
              const blob = new Blob(practiceChunksRef.current, { type: 'audio/webm' });
              try {
                  const transcription = await transcribeAudio(blob);
                  const score = scorePronunciation(transcription, targetText);
                  setPracticeScore({
                      score: score,
                      stars: Math.round(score / 20)
                  });
              } catch (e) {
                  console.error("Practice error", e);
              } finally {
                  setIsPracticeProcessing(false);
                  setIsPracticeRecording(false);
              }
          };
          
          mediaRecorder.start();
          setIsPracticeRecording(true);
          voiceService.stop(); // Stop any playback
      } catch (e) {
          alert("Microphone required for practice.");
      }
  };

  const stopPracticeRecording = () => {
      if (practiceRecorderRef.current && isPracticeRecording) {
          practiceRecorderRef.current.stop();
      }
  };

  // --- MAIN RECORDING ---
  const startRecording = async () => {
    if (isProcessing || isRecording) return;
    // Reset any previous practice scores when moving to next turn
    setPracticeScore(null); 
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      recordStartTimeRef.current = Date.now();
      
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      
      mediaRecorder.onstop = async () => {
        if (Date.now() - recordStartTimeRef.current < 600) { setIsRecording(false); return; }
        setIsProcessing(true);
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const userAudioUrl = URL.createObjectURL(audioBlob); // Create local URL for playback
        
        try {
            const transcription = await transcribeAudio(audioBlob);
            if (!transcription) {
                setIsProcessing(false);
                return; 
            }

            // Trigger Encouragement Animation
            setShowGoodJob(true);
            setTimeout(() => setShowGoodJob(false), 2500);

            const userMsg: Message = { 
                role: 'user', 
                text: transcription, 
                timestamp: Date.now(),
                audioUrl: userAudioUrl // Save audio for playback
            };
            
            const newHistory = [...messages, userMsg];
            setMessages(newHistory);

            // Pass currentLevel to generateLearningResponse to adjust difficulty dynamically
            const aiResp = await generateLearningResponse(newHistory, config, avatar, totalTurns, currentLevel);
            
            // Build the Model Message with separated metadata
            const modelMsg: Message = { 
                role: 'model', 
                text: aiResp.text, 
                timestamp: Date.now(),
                meta: { 
                    translation: aiResp.translation, 
                    feedbackCn: aiResp.feedbackCn,
                    questionCn: aiResp.questionCn,
                    hints: aiResp.hints,
                    assistantMessage: aiResp.assistantMessage,
                    feedback: aiResp.feedback,
                    nextQuestion: aiResp.question,
                    betterExpression: aiResp.betterExpression,
                    exampleAnswer: aiResp.exampleAnswer
                } 
            };

            setMessages([...newHistory, modelMsg]);
            
            if (aiResp.isConclusion) {
                setIsProcessing(false);
                setPhase('CONCLUSION_PLAYING');
                // Play ending audio, then transition to DONE state
                await playQuestionAudio(avatar.conclusionMessage || aiResp.text, () => {
                    setPhase('CONCLUSION_DONE');
                });
            } else {
                // If the AI rephrased (clarification), DO NOT increment turn count
                if (!aiResp.isClarification) {
                    setTotalTurns(prev => prev + 1);
                }
                
                setIsProcessing(false);
                await playQuestionAudio(aiResp.text);
                setShowTranslation(false);
                setShowAssistant(false);
            }

        } catch (err) {
            console.error("Error", err);
            setIsProcessing(false);
        }
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      voiceService.stop();
      setIsPlaying(false);
    } catch (err) { alert("Microphone required"); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      setIsRecording(false);
    }
  };

  const formatTime = (sec: number) => {
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Helper to split hints
  const getHintsList = () => {
      if (!latestModelMessage?.meta?.hints) return [];
      const h = latestModelMessage.meta.hints;
      return typeof h === 'string' ? h.split(',') : [];
  };

  return (
    <div className="min-h-screen bg-emerald-50/30 flex flex-col relative overflow-hidden">
        {/* Exit Modal */}
        {showExitModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-gray-100 transform scale-100 animate-slideUp">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 mx-auto bg-orange-100 text-orange-600">
                        <AlertTriangle size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 text-center mb-2">Not enough practice / 练习量不足</h3>
                    <p className="text-gray-600 text-center text-sm leading-relaxed mb-6">
                        You need at least 6 turns to generate a report.
                        <br/>
                        <span className="text-xs opacity-70">对话少于6轮，无法生成报告。</span>
                        <br/>
                        <span className="text-xs font-bold mt-2 block">Quit now without report? / 立即退出（无报告）？</span>
                    </p>
                    <div className="flex gap-3">
                        <button onClick={() => setShowExitModal(false)} className="flex-1 px-6 py-3 rounded-xl border border-gray-200 text-gray-500 font-bold hover:bg-gray-50">Continue / 继续</button>
                        <button onClick={confirmExit} className="flex-1 px-6 py-3 rounded-xl text-white font-bold bg-red-600 hover:bg-red-700">Quit (No Report) / 退出</button>
                    </div>
                </div>
            </div>
        )}
        
        {/* Voice Error Toast */}
        {voiceErrorMsg && (
             <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[90] animate-slideDown">
                <div className="bg-gray-900/90 backdrop-blur text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-3 border border-gray-700">
                    <Wifi size={18} className="text-red-400" />
                    <span className="text-sm font-medium">{voiceErrorMsg}</span>
                    <button onClick={() => setVoiceErrorMsg(null)}><XCircle size={16} className="text-gray-400 hover:text-white"/></button>
                </div>
             </div>
        )}

        {/* Finished State Overlay */}
        {phase === 'FINISHED' && (
            <div className="fixed inset-0 z-[80] flex items-center justify-center p-6 bg-emerald-900/30 backdrop-blur-sm animate-fadeIn">
                <div className="bg-white p-8 rounded-3xl shadow-2xl text-center max-w-md w-full border border-emerald-100 transform scale-100 animate-slideUp">
                    <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600 animate-pulse">
                            <Sparkles size={40} />
                    </div>
                    <h3 className="text-2xl font-bold text-emerald-900 mb-2">Practice Complete! / 练习完成！</h3>
                    <p className="text-gray-500 mb-8">You've finished the session. Choose an option below. / 课程结束，请选择下一步。</p>
                    
                    <div className="grid grid-cols-1 gap-4">
                        <button 
                            onClick={() => onComplete(messages)}
                            className="w-full bg-emerald-600 text-white px-6 py-4 rounded-xl font-bold hover:bg-emerald-700 shadow-lg flex items-center justify-center gap-2"
                        >
                            <FileText size={20}/> Generate Report / 生成报告
                        </button>
                        <button 
                            onClick={exportChat}
                            className="w-full bg-white text-emerald-700 border-2 border-emerald-100 px-6 py-4 rounded-xl font-bold hover:bg-emerald-50 flex items-center justify-center gap-2"
                        >
                            <Camera size={20}/> Export Chat Image / 导出长图
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Header - Optimized for Mobile Layout */}
        <div className="relative z-20 px-4 md:px-6 py-4 flex justify-between items-start bg-white/80 backdrop-blur-sm shadow-sm">
            <div className="flex flex-col flex-1 min-w-0 mr-2">
                <div className="flex items-center gap-2 text-emerald-800 font-bold min-w-0 mb-1">
                    <GraduationCap size={18} className="shrink-0"/>
                    <span className="block break-words line-clamp-2 leading-tight">{config.mode === 'TOPIC' ? config.topic?.titleEn : 'Custom Practice'}</span>
                </div>
                
                {/* Level Adjuster - Dynamic Difficulty */}
                <div className="flex items-center gap-2 mb-2">
                     <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1 flex items-center gap-2">
                         <BarChart size={12} className="text-emerald-600"/>
                         <select 
                            value={currentLevel} 
                            onChange={(e) => setCurrentLevel(e.target.value)}
                            className="bg-transparent text-xs font-bold text-emerald-700 outline-none cursor-pointer"
                         >
                            {CEFR_LEVELS.map(lvl => <option key={lvl} value={lvl}>{lvl}</option>)}
                         </select>
                     </div>
                     <span className="text-[10px] text-gray-400">(Auto-adjusts / 自动调整)</span>
                </div>

                <div className="flex items-center gap-3 text-xs text-gray-500 mt-1 mb-2">
                     <span className="flex items-center gap-1 shrink-0"><RefreshCw size={10}/> Turns / 轮次: {totalTurns} / ~{targetTurns}</span>
                     <span className="flex items-center gap-1 shrink-0"><Clock size={10}/> {formatTime(elapsedTime)}</span>
                </div>

                <div className="flex gap-2">
                    {/* Voice Toggle */}
                    <button 
                        onClick={handleVoiceToggle}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all shrink-0
                            ${currentVoiceType === 'HQ' 
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100' 
                                : 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100'}
                        `}
                    >
                        {currentVoiceType === 'HQ' ? <Sparkles size={12} /> : <Wifi size={12} />}
                        {currentVoiceType === 'HQ' ? 'Native' : 'Standard'}
                    </button>
                    
                    {/* Speed Toggle */}
                    <button 
                        onClick={() => setPlaybackSpeed(prev => prev === 1.0 ? 1.25 : prev === 1.25 ? 0.75 : 1.0)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold border bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100 shrink-0"
                    >
                        <Settings size={12}/> {playbackSpeed}x
                    </button>
                </div>
            </div>
            <button onClick={handleManualExitClick} className="p-3 bg-white border border-gray-200 rounded-full text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all shadow-sm shrink-0">
                <LogOut size={20}/>
            </button>
        </div>

        {/* Main Area */}
        <div ref={chatContainerRef} className="flex-1 relative z-10 flex flex-col items-center justify-center p-6 bg-transparent">
            
            {/* Avatar */}
            <div className="relative mb-8 group">
                {isPlaying && <div className="absolute inset-0 rounded-full border-4 border-emerald-200 animate-ping opacity-20"></div>}
                <div className="relative w-32 h-32 md:w-48 md:h-48 rounded-full p-1 bg-white shadow-xl">
                    <img src={avatar.avatarUrl} className="w-full h-full rounded-full object-cover"/>
                </div>

                {/* Feedback Animation (Thumbs Up) */}
                {showGoodJob && (
                    <div className="absolute -top-10 right-0 animate-bounce transition-all">
                        <div className="bg-yellow-400 text-white p-3 rounded-full shadow-lg transform rotate-12 scale-110">
                            <ThumbsUp size={32} fill="currentColor"/>
                        </div>
                    </div>
                )}

                {/* Assistant Bubble */}
                {showAssistant && (latestModelMessage?.meta?.assistantMessage || latestModelMessage?.meta?.exampleAnswer) && (
                    <div className="absolute -top-4 -right-2 md:-right-48 z-50 w-64 animate-fadeIn">
                        <div className="bg-white border-2 border-emerald-400 rounded-xl rounded-bl-none p-3 shadow-lg relative">
                             <div className="absolute -bottom-2 -left-2 w-4 h-4 bg-white border-b-2 border-l-2 border-emerald-400 transform -rotate-45"></div>
                             {latestModelMessage.meta?.assistantMessage && (
                                <p className="text-xs text-emerald-800 font-medium mb-2">{latestModelMessage.meta.assistantMessage}</p>
                             )}
                             {latestModelMessage.meta?.exampleAnswer && (
                                <div className="mt-2 pt-2 border-t border-emerald-100/50">
                                    <p className="text-[10px] font-bold text-emerald-600 uppercase mb-1 flex items-center gap-1"><Lightbulb size={10}/> Example Answer</p>
                                    <p className="text-xs text-gray-800 italic mb-1">"{latestModelMessage.meta.exampleAnswer.en}"</p>
                                    <p className="text-[10px] text-gray-500">{latestModelMessage.meta.exampleAnswer.cn}</p>
                                </div>
                             )}
                        </div>
                    </div>
                )}
            </div>

            {/* Message Bubble - IMPROVED LAYOUT */}
            {latestModelMessage && (
                <div className="max-w-lg w-full bg-white rounded-2xl shadow-lg border border-emerald-100 relative overflow-hidden">
                     {/* Feedback Section (If available) */}
                     {latestModelMessage.meta?.feedback && (
                         <div className="bg-emerald-50/80 p-4 border-b border-emerald-100">
                             <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1 block">Feedback</span>
                             <p className="text-sm text-emerald-900 leading-relaxed font-medium">{latestModelMessage.meta.feedback}</p>
                             {/* Specific Feedback Translation */}
                             {showTranslation && latestModelMessage.meta.feedbackCn && (
                                 <p className="text-xs text-emerald-600/80 mt-2 pt-2 border-t border-emerald-100 italic">{latestModelMessage.meta.feedbackCn}</p>
                             )}
                         </div>
                     )}

                     {/* Better Expressions Section (New) */}
                     {latestModelMessage.meta?.betterExpression && (
                         <div className="bg-indigo-50/80 p-4 border-b border-indigo-100 animate-slideUp">
                             <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                                <Sparkles size={12}/> Better Expression / 建议表达
                             </span>
                             <div className="space-y-3">
                                {/* YOU */}
                                <div className="flex items-center justify-between bg-white/50 p-2 rounded-lg border border-indigo-100">
                                    <div className="flex flex-col text-xs text-gray-500 gap-1 flex-1 mr-2">
                                        <div className="flex items-center gap-2">
                                            <span className="bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-100 shrink-0 text-[10px] font-bold">You</span>
                                            {userAudioUrl && (
                                                <button 
                                                    onClick={() => handlePlayUserAudio(userAudioUrl)}
                                                    className="p-1 rounded-full bg-red-100 text-red-500 hover:bg-red-200 transition-colors"
                                                    title="Replay your recording"
                                                >
                                                    <Play size={10} fill="currentColor"/>
                                                </button>
                                            )}
                                        </div>
                                        <span className="line-through opacity-70 leading-snug">"{latestModelMessage.meta.betterExpression.original}"</span>
                                    </div>
                                </div>

                                {/* BETTER */}
                                <div className="flex items-center justify-between bg-white/50 p-2 rounded-lg border border-indigo-100">
                                    <div className="flex flex-col text-xs text-indigo-900 gap-1 flex-1 mr-2">
                                        <div className="flex items-center gap-2">
                                            <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200 shrink-0 text-[10px] font-bold">Better</span>
                                            <button 
                                                onClick={() => handlePlayBetterExpression(latestModelMessage.meta!.betterExpression!.improved)}
                                                className="p-1 rounded-full bg-indigo-100 text-indigo-600 hover:bg-indigo-200 transition-colors"
                                                title="Hear correct pronunciation"
                                            >
                                                <Play size={10} fill="currentColor"/>
                                            </button>
                                        </div>
                                        <span className="font-medium leading-snug">"{latestModelMessage.meta.betterExpression.improved}"</span>
                                    </div>
                                    {/* Practice Button */}
                                    <div className="flex flex-col items-center gap-1">
                                        <button 
                                            onClick={isPracticeRecording ? stopPracticeRecording : () => startPracticeRecording(latestModelMessage.meta!.betterExpression!.improved)}
                                            disabled={isPracticeProcessing}
                                            className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm border transition-all 
                                                ${isPracticeRecording ? 'bg-red-500 border-red-600 text-white animate-pulse' : 'bg-white border-indigo-200 text-indigo-500 hover:bg-indigo-50'}
                                            `}
                                            title="Practice this sentence"
                                        >
                                            {isPracticeRecording ? <Square size={10} fill="currentColor"/> : <Mic size={14}/>}
                                        </button>
                                        {practiceScore && (
                                            <div className="flex gap-0.5 animate-fadeIn">
                                                {[1,2,3].map(s => (
                                                    <Star key={s} size={8} fill={s <= practiceScore.stars ? "#FBBF24" : "#E5E7EB"} className="text-yellow-400"/>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {showTranslation && (
                                    <p className="text-xs text-indigo-700/70 pl-2 italic border-l-2 border-indigo-200">
                                        {latestModelMessage.meta.betterExpression.improvedCn}
                                    </p>
                                )}
                             </div>
                         </div>
                     )}

                     {/* Question/Text Section */}
                     <div className="p-6">
                        <p className="text-lg text-gray-800 font-medium leading-relaxed">
                            {latestModelMessage.meta?.nextQuestion || latestModelMessage.text}
                        </p>
                        
                        {/* Question Translation */}
                        {showTranslation && latestModelMessage.meta?.questionCn && (
                            <p className="text-gray-500 italic text-sm mt-3 pt-2 border-t border-gray-100">{latestModelMessage.meta.questionCn}</p>
                        )}
                        
                        {/* Fallback to generic translation if specifics missing but translation exists */}
                        {showTranslation && !latestModelMessage.meta?.questionCn && !latestModelMessage.meta?.feedbackCn && latestModelMessage.meta?.translation && (
                            <p className="text-gray-500 italic text-sm mt-3 pt-2 border-t border-gray-100">{latestModelMessage.meta.translation}</p>
                        )}
                        
                        {/* Hints Area */}
                        {showHints && getHintsList().length > 0 && (
                            <div className="mt-4 pt-4 border-t border-gray-100">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Keywords (Bilingual)</span>
                                <div className="flex flex-wrap gap-2">
                                    {getHintsList().map((h, i) => (
                                        <span key={i} className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs rounded-md border border-indigo-100">{h.trim()}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                     </div>
                </div>
            )}
            
            {latestUserMessage && !latestModelMessage && phase === 'ACTIVE' && (
                <div className="mt-4 bg-gray-100 px-4 py-2 rounded-xl text-gray-700">"{latestUserMessage.text}"</div>
            )}
        </div>

        {/* Controls */}
        <div className={`bg-white border-t border-gray-100 p-6 pb-8 transition-all ${phase === 'FINISHED' ? 'blur-sm pointer-events-none opacity-50' : ''}`}>
            <div className="max-w-md mx-auto flex items-center justify-between">
                
                {/* Learning Tools */}
                <div className="flex gap-2">
                    <button onClick={() => setShowTranslation(!showTranslation)} className={`p-3 rounded-full ${showTranslation ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}><Languages size={20}/></button>
                    <button onClick={() => setShowHints(!showHints)} className={`p-3 rounded-full ${showHints ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-400'}`}><HelpCircle size={20}/></button>
                    <button onClick={() => setShowAssistant(!showAssistant)} className={`p-3 rounded-full ${showAssistant ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-400'}`} title="AI Assistant"><Bot size={20}/></button>
                </div>

                {/* Mic / Finish Button */}
                <div className="relative -top-6">
                    {(phase === 'CONCLUSION_PLAYING' || phase === 'CONCLUSION_DONE') ? (
                        <button 
                            onClick={() => setPhase('FINISHED')}
                            className="w-auto px-6 h-14 rounded-full flex items-center justify-center shadow-xl transition-all transform hover:scale-105 bg-emerald-600 text-white font-bold gap-2 animate-pulse whitespace-nowrap"
                        >
                            <FileText size={20} /> <span className="text-sm">Complete</span>
                        </button>
                    ) : (
                        <button 
                            onClick={() => isRecording ? stopRecording() : startRecording()}
                            disabled={isProcessing || isPlaying || isPracticeRecording}
                            className={`w-20 h-20 rounded-full flex items-center justify-center shadow-xl border-4 border-white transition-all transform hover:scale-105 
                                ${isRecording ? 'bg-red-500' : isProcessing ? 'bg-gray-300' : 'bg-emerald-600'} text-white`}
                        >
                            {isRecording ? <Square size={28} fill="currentColor"/> : <Mic size={32}/>}
                        </button>
                    )}
                </div>

                {/* Playback/Text */}
                <div className="flex gap-2">
                    <button onClick={togglePlayback} className={`p-3 rounded-full ${isPlaying ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>{isPlaying ? <Pause size={20}/> : <Play size={20}/>}</button>
                    <button 
                        onClick={handleManualExitClick} 
                        className="p-3 rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200" title="Finish"
                    >
                        <FileText size={20}/>
                    </button>
                </div>
            </div>
            
            {/* Status Text Update */}
            <p className="text-center text-xs text-gray-400 mt-2">
                {phase === 'CONCLUSION_PLAYING' ? "Playing conclusion..." : 
                 phase === 'CONCLUSION_DONE' ? "Session finished. Click Complete." :
                 isPracticeRecording ? "Recording practice..." :
                 "Practice Mode - No Scoring Penalties"}
            </p>
        </div>
    </div>
  );
};
