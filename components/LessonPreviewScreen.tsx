
import React, { useState, useRef } from 'react';
import { LessonPlan, Avatar } from '../types';
import { voiceService, scorePronunciation, transcribeAudio } from '../services/geminiService';
import { storageService } from '../services/storageService';
import { BookOpen, Mic, Volume2, ArrowRight, Star, RefreshCw, CheckCircle, Lightbulb, GraduationCap, Play, Square, Check, Cloud, ArrowLeft, MessageCircle, Sparkles, Globe, Quote, AlertCircle, Heart } from 'lucide-react';

interface Props {
  plan: LessonPlan;
  avatar: Avatar;
  onStart: () => void;
  onBack: () => void;
}

type Tab = 'KNOWLEDGE' | 'VOCAB' | 'SENTENCES' | 'NATIVE';

export const LessonPreviewScreen: React.FC<Props> = ({ plan, avatar, onStart, onBack }) => {
  const [activeTab, setActiveTab] = useState<Tab>('KNOWLEDGE');
  const [isPlaying, setIsPlaying] = useState<string | null>(null);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState<Record<string, 'good' | 'retry' | null>>({});
  
  // Track favorite state locally for UI updates
  const [favorites, setFavorites] = useState<Record<string, boolean>>(() => {
      const map: Record<string, boolean> = {};
      // Initial check (simplified, in real app might need effect)
      return map;
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const toggleFavorite = (type: 'VOCAB' | 'SENTENCE' | 'EXPRESSION', content: any) => {
      const id = content.en || content.spoken;
      const isFav = storageService.isFavorite(id);
      
      if (isFav) {
          // Remove by ID logic is tricky without ID, so we loop up in service but here we assume we can remove by finding it
          // For simplicity in this prototype, we just toggle ADD. Removing from list is done in Hub usually.
          // But let's implement remove for UX.
          const favs = storageService.getFavorites();
          const item = favs.find(f => f.content.en === id);
          if (item) storageService.removeFavorite(item.id);
          setFavorites(prev => ({ ...prev, [id]: false }));
      } else {
          storageService.addFavorite({
              id: id,
              type,
              content: {
                  en: id,
                  cn: content.cn || content.spokenCn,
                  ipa: content.ipa,
                  example: content.example || content.explanation,
                  usage: content.usage
              }
          });
          setFavorites(prev => ({ ...prev, [id]: true }));
      }
  };

  // Helper to check favorite status on render
  const isFav = (text: string) => {
      // Check local state first, fallback to service (sync issue potential in react but ok for prototype)
      if (favorites[text] !== undefined) return favorites[text];
      return storageService.isFavorite(text);
  };

  const handlePlay = (text: string, id: string) => {
    if (isPlaying) {
        voiceService.stop();
        if (isPlaying === id) {
            setIsPlaying(null);
            return;
        }
    }
    setIsPlaying(id);
    voiceService.speak(text, avatar, undefined, () => setIsPlaying(null), false); 
  };

  const startRecording = async (id: string, targetTextOverride?: string) => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        chunksRef.current = [];
        
        mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
        
        mediaRecorder.onstop = async () => {
            const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
            const transcription = await transcribeAudio(blob);
            
            // Find target text
            let targetText = targetTextOverride || "";
            if (!targetText) {
                const vocabItem = plan.vocabulary.find(v => v.en === id);
                const sentItem = plan.sentences.find(s => s.en === id);
                
                if (vocabItem) targetText = vocabItem.en;
                else if (sentItem) targetText = sentItem.en;
            }

            const score = scorePronunciation(transcription, targetText);
            
            setScores(prev => ({ ...prev, [id]: score }));
            setFeedback(prev => ({ ...prev, [id]: score >= 80 ? 'good' : 'retry' }));
            setRecordingId(null);
        };
        
        mediaRecorder.start();
        setRecordingId(id);
    } catch (e) {
        alert("Microphone required.");
        setRecordingId(null);
    }
  };

  const stopRecording = () => {
      if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
  };

  const renderStars = (score: number) => {
      const stars = Math.round(score / 20);
      return (
          <div className="flex gap-0.5">
              {[1,2,3,4,5].map(s => (
                  <Star key={s} size={12} fill={s <= stars ? "#fbbf24" : "#e5e7eb"} className={s <= stars ? "text-yellow-400" : "text-gray-200"} />
              ))}
          </div>
      );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-0 md:p-4 lg:p-8 animate-fadeIn">
        <div className="bg-white md:rounded-3xl shadow-none md:shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col h-screen md:h-auto md:min-h-[700px] border-none md:border border-gray-100">
            
            {/* Header */}
            <div className="bg-emerald-600 p-4 md:p-6 text-white flex justify-between items-center shadow-md z-10 shrink-0">
                <div className="flex items-center gap-3 md:gap-4">
                    <button 
                        onClick={onBack}
                        className="p-2 hover:bg-white/20 rounded-full transition-colors text-white"
                        title="Back to Setup"
                    >
                        <ArrowLeft size={20} className="md:w-6 md:h-6" />
                    </button>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 md:mb-1">
                            <GraduationCap size={20} className="md:w-6 md:h-6 shrink-0" />
                            <h1 className="text-lg md:text-2xl font-bold truncate">Lesson Preview</h1>
                        </div>
                        <div className="flex items-center gap-2 overflow-hidden">
                            <p className="text-emerald-100 text-xs md:text-sm truncate max-w-[150px] md:max-w-md">
                                {plan.topicTitleEn} ({plan.topicTitleCn})
                            </p>
                        </div>
                    </div>
                </div>
                <button 
                    onClick={onStart}
                    className="bg-white text-emerald-700 px-4 py-2 md:px-6 md:py-2.5 rounded-xl font-bold hover:bg-emerald-50 transition-colors shadow-lg flex items-center gap-2 text-sm md:text-base shrink-0"
                >
                    <span className="hidden md:inline">Start Chat</span>
                    <span className="md:hidden">Start</span>
                    <ArrowRight size={16} className="md:w-[18px] md:h-[18px]" />
                </button>
            </div>

            <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                {/* Navigation */}
                <div className="w-full md:w-64 bg-gray-50 border-b md:border-b-0 md:border-r border-gray-100 flex flex-row md:flex-col p-2 md:p-4 gap-2 overflow-x-auto md:overflow-visible shrink-0 no-scrollbar">
                    {[
                        { id: 'KNOWLEDGE', icon: Lightbulb, label: 'Concepts', sub: '核心概念' },
                        { id: 'VOCAB', icon: BookOpen, label: 'Vocab', sub: '核心词汇' },
                        { id: 'SENTENCES', icon: Quote, label: 'Sentences', sub: '实用句型' },
                        { id: 'NATIVE', icon: Sparkles, label: 'Native', sub: '地道表达' },
                    ].map((tab) => (
                        <button 
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as Tab)}
                            className={`
                                flex items-center gap-2 md:gap-3 p-2 md:p-3 rounded-xl transition-all whitespace-nowrap
                                ${activeTab === tab.id 
                                    ? 'bg-emerald-100 text-emerald-700 shadow-sm ring-1 ring-emerald-200' 
                                    : 'bg-white md:bg-transparent text-gray-500 hover:bg-gray-100 border border-gray-100 md:border-transparent'}
                                flex-1 md:flex-none justify-center md:justify-start min-w-[90px] md:min-w-0
                            `}
                        >
                            <tab.icon size={18} className={`shrink-0 ${activeTab === tab.id ? 'text-emerald-600' : ''}`}/> 
                            <div className="text-left leading-tight">
                                <span className={`block text-xs md:text-sm font-bold ${activeTab === tab.id ? 'text-emerald-800' : 'text-gray-700'}`}>
                                    {tab.label}
                                </span>
                                <span className={`hidden md:block text-[10px] font-normal ${activeTab === tab.id ? 'text-emerald-600' : 'text-gray-400'}`}>
                                    {tab.sub}
                                </span>
                            </div>
                        </button>
                    ))}
                </div>

                {/* Main Content */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-white relative pb-20 md:pb-8">
                    
                    {activeTab === 'KNOWLEDGE' && (
                        <div className="space-y-6 animate-fadeIn">
                            {/* Basic Intro */}
                            <div className="bg-gradient-to-br from-emerald-50 to-white rounded-2xl p-5 md:p-6 border border-emerald-100 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-100/30 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                                <h3 className="text-base md:text-lg font-bold text-emerald-800 mb-4 flex items-center gap-2 border-b border-emerald-200/50 pb-2">
                                    <BookOpen size={18} className="text-emerald-600"/> 
                                    <span>Course Introduction <span className="text-xs md:text-sm font-normal text-emerald-600 ml-1">/ 课程介绍</span></span>
                                </h3>
                                <div className="text-gray-700 leading-relaxed text-sm md:text-base font-sans">
                                    <p className="mb-3 font-medium text-emerald-900">{plan.knowledge.basicEn}</p>
                                    <p className="text-gray-500 bg-emerald-50/50 p-3 rounded-lg border border-emerald-50">{plan.knowledge.basicCn}</p>
                                </div>
                            </div>
                            
                            {/* Cultural Case Study */}
                            <div className="bg-gradient-to-br from-amber-50 to-white rounded-2xl p-5 md:p-6 border border-amber-100 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-100/30 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                                <h3 className="text-base md:text-lg font-bold text-amber-800 mb-4 flex items-center gap-2 border-b border-amber-200/50 pb-2">
                                    <Globe size={18} className="text-amber-600"/> 
                                    <span>Cultural Insights <span className="text-xs md:text-sm font-normal text-amber-600 ml-1">/ 文化差异</span></span>
                                </h3>
                                <div className="bg-white/80 rounded-xl p-4 border border-amber-100/50 shadow-sm">
                                    <div className="text-gray-700 leading-relaxed text-sm md:text-base">
                                        <p className="mb-3 font-medium text-amber-900">{plan.knowledge.culturalEn}</p>
                                        <p className="text-gray-500 bg-amber-50/50 p-3 rounded-lg border border-amber-50">{plan.knowledge.culturalCn}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'VOCAB' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 animate-fadeIn">
                            {plan.vocabulary.map((item, idx) => (
                                <div key={idx} className="border border-gray-100 rounded-xl p-4 hover:shadow-md transition-shadow relative bg-white group shadow-sm">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex-1 min-w-0 pr-2">
                                            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
                                                <h3 className="text-lg md:text-xl font-bold text-gray-800 leading-tight">{item.en}</h3>
                                                {item.ipa && <span className="text-xs text-gray-400 font-mono bg-gray-50 px-1.5 py-0.5 rounded">{item.ipa}</span>}
                                            </div>
                                            <p className="text-sm text-gray-600 font-medium mt-1">{item.cn}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => toggleFavorite('VOCAB', item)}
                                                className={`p-2.5 rounded-full shrink-0 transition-all ${isFav(item.en) ? 'bg-rose-50 text-rose-500' : 'bg-gray-50 text-gray-300 hover:bg-gray-100'}`}
                                            >
                                                <Heart size={18} fill={isFav(item.en) ? "currentColor" : "none"}/>
                                            </button>
                                            <button 
                                                onClick={() => handlePlay(item.en, item.en)}
                                                className={`p-2.5 rounded-full shrink-0 transition-all active:scale-95 ${isPlaying === item.en ? 'bg-emerald-100 text-emerald-600 ring-2 ring-emerald-200' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                                            >
                                                {isPlaying === item.en ? <Volume2 size={18} className="animate-pulse"/> : <Volume2 size={18}/>}
                                            </button>
                                        </div>
                                    </div>
                                    {item.example && (
                                        <div className="bg-gray-50 rounded-lg p-2.5 mt-3 border border-gray-100">
                                            <p className="text-xs text-gray-500 italic leading-snug">"{item.example}"</p>
                                        </div>
                                    )}
                                    
                                    {/* Practice Area */}
                                    <div className="flex items-center justify-between border-t border-gray-100 pt-3 mt-3">
                                        <div className="flex items-center gap-2">
                                            {feedback[item.en] === 'good' && <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full flex items-center gap-1 border border-green-100"><CheckCircle size={10}/> Good</span>}
                                            {feedback[item.en] === 'retry' && <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full flex items-center gap-1 border border-orange-100"><RefreshCw size={10}/> Retry</span>}
                                            {scores[item.en] !== undefined && renderStars(scores[item.en])}
                                        </div>
                                        <button 
                                            onClick={() => recordingId === item.en ? stopRecording() : startRecording(item.en)}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm active:scale-95 ${recordingId === item.en ? 'bg-red-500 text-white animate-pulse' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                        >
                                            {recordingId === item.en ? <Square size={12} fill="currentColor"/> : <Mic size={12}/>}
                                            {recordingId === item.en ? 'Stop' : 'Read'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === 'SENTENCES' && (
                        <div className="space-y-4 animate-fadeIn">
                            {plan.sentences.map((item, idx) => (
                                <div key={idx} className="border border-gray-100 rounded-xl p-4 md:p-5 hover:shadow-md transition-shadow bg-white shadow-sm">
                                    <div className="flex gap-3 md:gap-4 items-start">
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-base md:text-lg font-semibold text-gray-800 mb-1 leading-snug">{item.en}</h3>
                                            <p className="text-sm text-gray-500 mb-3">{item.cn}</p>
                                            {item.usage && (
                                                <div className="bg-indigo-50/70 border border-indigo-100 rounded-lg p-2.5 flex gap-2">
                                                    <Lightbulb size={14} className="text-indigo-500 shrink-0 mt-0.5"/>
                                                    <p className="text-xs text-indigo-800 leading-relaxed">
                                                        {item.usage}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-col gap-2 shrink-0">
                                            <button 
                                                onClick={() => toggleFavorite('SENTENCE', item)}
                                                className={`p-2.5 rounded-full shrink-0 transition-all ${isFav(item.en) ? 'bg-rose-50 text-rose-500' : 'bg-gray-50 text-gray-300 hover:bg-gray-100'}`}
                                            >
                                                <Heart size={20} fill={isFav(item.en) ? "currentColor" : "none"}/>
                                            </button>
                                            <button 
                                                onClick={() => handlePlay(item.en, item.en)}
                                                className={`p-2.5 rounded-full shrink-0 transition-all active:scale-95 ${isPlaying === item.en ? 'bg-indigo-100 text-indigo-600 ring-2 ring-indigo-200' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                                            >
                                                <Volume2 size={20}/>
                                            </button>
                                        </div>
                                    </div>
                                    
                                     {/* Practice Area */}
                                     <div className="flex items-center justify-between border-t border-gray-100 pt-3 mt-3">
                                        <div className="flex items-center gap-2">
                                            {scores[item.en] !== undefined && (
                                                <div className="flex items-center gap-2">
                                                    {renderStars(scores[item.en])}
                                                    <span className={`text-[10px] font-bold ${feedback[item.en] === 'good' ? 'text-green-600' : 'text-orange-500'}`}>
                                                        {scores[item.en]}%
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        <button 
                                            onClick={() => recordingId === item.en ? stopRecording() : startRecording(item.en)}
                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm active:scale-95 ${recordingId === item.en ? 'bg-red-500 text-white animate-pulse' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                        >
                                            {recordingId === item.en ? <Square size={12} fill="currentColor"/> : <Mic size={12}/>}
                                            {recordingId === item.en ? 'Stop' : 'Practice'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === 'NATIVE' && (
                        <div className="space-y-4 md:space-y-6 animate-fadeIn">
                            {/* Intro Card */}
                            <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-4 md:p-5 rounded-2xl border border-amber-100 flex gap-4 items-start shadow-sm">
                                <div className="bg-white p-2 rounded-full shadow-sm text-amber-500 shrink-0 mt-1">
                                    <Sparkles size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-amber-900 text-sm md:text-lg mb-1">Authentic Expressions / 地道表达</h3>
                                    <p className="text-amber-800/80 text-xs md:text-sm leading-relaxed">
                                        Learn how native speakers actually talk. / 像母语者一样说话，摆脱“教科书味”。
                                    </p>
                                </div>
                            </div>

                            {plan.expressionComparison && plan.expressionComparison.length > 0 ? (
                                <div className="grid grid-cols-1 gap-4 md:gap-6">
                                    {plan.expressionComparison.map((item, idx) => (
                                        <div key={idx} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col md:flex-row hover:shadow-md transition-shadow">
                                            
                                            {/* Left: Textbook */}
                                            <div className="p-4 md:p-6 md:w-5/12 border-b md:border-b-0 md:border-r border-gray-100 bg-gray-50/50 flex flex-col justify-center relative">
                                                <span className="inline-block px-2 py-0.5 bg-gray-200 text-gray-600 text-[10px] font-bold rounded uppercase tracking-wide w-fit mb-2">
                                                    Textbook / 书面
                                                </span>
                                                <p className="text-base md:text-lg text-gray-600 font-serif italic mb-1 leading-snug">"{item.written}"</p>
                                                <p className="text-xs md:text-sm text-gray-400">{item.writtenCn}</p>
                                            </div>

                                            {/* Center: Arrow (Desktop only) */}
                                            <div className="hidden md:flex items-center justify-center w-12 bg-white -ml-6 z-10">
                                                <div className="bg-amber-100 text-amber-600 p-1.5 rounded-full">
                                                    <ArrowRight size={16} />
                                                </div>
                                            </div>

                                            {/* Right: Native */}
                                            <div className="p-4 md:p-6 md:w-7/12 relative bg-amber-50/20 flex flex-col justify-center">
                                                <div className="mb-3">
                                                    <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded uppercase tracking-wide flex items-center gap-1 w-fit mb-2">
                                                        <Sparkles size={10}/> Native / 地道
                                                    </span>
                                                    <p className="text-lg md:text-xl font-bold text-amber-900 mb-1 leading-snug">"{item.spoken}"</p>
                                                    <p className="text-xs md:text-sm text-amber-800/70 font-medium">{item.spokenCn}</p>
                                                </div>
                                                
                                                <div className="bg-white/60 rounded-lg p-2.5 border border-amber-100/50 mb-3">
                                                    <p className="text-xs text-gray-600 leading-relaxed">
                                                        <span className="font-bold text-amber-600 mr-1">Why:</span>
                                                        {item.explanation}
                                                    </p>
                                                </div>

                                                {/* Audio Controls */}
                                                <div className="flex items-center justify-between mt-auto">
                                                    <div className="flex gap-2">
                                                        <button 
                                                            onClick={() => toggleFavorite('EXPRESSION', item)}
                                                            className={`p-2 rounded-full transition-colors active:scale-95 ${isFav(item.spoken) ? 'bg-rose-50 text-rose-500' : 'bg-white border border-gray-200 text-gray-300 hover:bg-gray-50'}`}
                                                        >
                                                            <Heart size={18} fill={isFav(item.spoken) ? "currentColor" : "none"}/>
                                                        </button>
                                                        <button 
                                                            onClick={() => handlePlay(item.spoken, item.spoken)}
                                                            className={`p-2 rounded-full transition-colors active:scale-95 ${isPlaying === item.spoken ? 'bg-amber-200 text-amber-800' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                                                        >
                                                            <Volume2 size={18} className={isPlaying === item.spoken ? 'animate-pulse' : ''} />
                                                        </button>
                                                    </div>
                                                    
                                                    <div className="flex items-center gap-3">
                                                        {feedback[item.spoken] && (
                                                            <div className="text-right">
                                                                {scores[item.spoken] !== undefined && renderStars(scores[item.spoken])}
                                                            </div>
                                                        )}
                                                        <button 
                                                            onClick={() => recordingId === item.spoken ? stopRecording() : startRecording(item.spoken, item.spoken)}
                                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm active:scale-95 ${recordingId === item.spoken ? 'bg-red-500 text-white animate-pulse' : 'bg-white border border-amber-200 text-amber-700 hover:bg-amber-50'}`}
                                                        >
                                                            {recordingId === item.spoken ? <Square size={12} fill="currentColor"/> : <Mic size={12}/>}
                                                            {recordingId === item.spoken ? 'Stop' : 'Try'}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 text-gray-400 text-sm">
                                    No expression comparisons available for this lesson.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};
