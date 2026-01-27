
import React, { useState, useEffect, useRef } from 'react';
import { FavoriteItem, MistakeItem } from '../types';
import { storageService } from '../services/storageService';
import { voiceService, scorePronunciation, transcribeAudio } from '../services/geminiService';
import { X, Heart, Dumbbell, Volume2, Trash2, CheckCircle, RefreshCw, Mic, Square, ArrowRight, Eye, EyeOff, Sparkles, BookOpen, Quote, Star } from 'lucide-react';

interface Props {
    onClose: () => void;
}

export const StudentHub: React.FC<Props> = ({ onClose }) => {
    const [activeTab, setActiveTab] = useState<'FAVORITES' | 'TRAINING'>('FAVORITES');
    const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
    const [mistakes, setMistakes] = useState<MistakeItem[]>([]);
    
    // Playback State
    const [isPlaying, setIsPlaying] = useState<string | null>(null);

    // Training State
    const [currentMistakeIndex, setCurrentMistakeIndex] = useState(0);
    const [userAnswer, setUserAnswer] = useState('');
    const [trainingFeedback, setTrainingFeedback] = useState<'CORRECT' | 'WRONG' | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    // Favorites Shadowing State
    const [recordingFavId, setRecordingFavId] = useState<string | null>(null);
    const [favScores, setFavScores] = useState<Record<string, number>>({});

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    useEffect(() => {
        setFavorites(storageService.getFavorites());
        setMistakes(storageService.getMistakes());
    }, []);

    const handleDeleteFavorite = (id: string) => {
        storageService.removeFavorite(id);
        setFavorites(prev => prev.filter(i => i.id !== id));
    };

    const cleanTextForTTS = (text: string): string => {
        // Remove Chinese characters and common separators for TTS
        return text.replace(/[\u4e00-\u9fa5].*/g, '').trim();
    };

    const handlePlay = (text: string, id: string) => {
        if (isPlaying) { voiceService.stop(); setIsPlaying(null); return; }
        
        const cleanText = cleanTextForTTS(text);
        if (!cleanText) return;

        setIsPlaying(id);
        // Use a generic avatar for playback
        const dummyAvatar = { name: 'Emma', gender: 'Female' } as any;
        voiceService.speak(cleanText, dummyAvatar, undefined, () => setIsPlaying(null), false);
    };

    // --- FAVORITES SHADOWING LOGIC ---
    const startFavRecording = async (id: string, targetText: string) => {
        if (recordingFavId || isProcessing) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];
            
            mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
            
            mediaRecorder.onstop = async () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                try {
                    const transcription = await transcribeAudio(blob);
                    const score = scorePronunciation(transcription, cleanTextForTTS(targetText));
                    setFavScores(prev => ({ ...prev, [id]: score }));
                } catch (e) {
                    console.error("Transcription error", e);
                }
                setRecordingFavId(null);
            };
            
            mediaRecorder.start();
            setRecordingFavId(id);
        } catch (e) {
            alert("Microphone required");
        }
    };

    const stopFavRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
             mediaRecorderRef.current.stop();
        }
    };

    // --- TRAINING LOGIC ---
    const currentMistake = mistakes[currentMistakeIndex];

    const startRecording = async () => {
        if (isRecording || isProcessing) return;
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];
            
            mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
            
            mediaRecorder.onstop = async () => {
                setIsProcessing(true);
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                
                try {
                    const transcription = await transcribeAudio(blob);
                    
                    if (!transcription) {
                        setTrainingFeedback('WRONG');
                        setIsProcessing(false);
                        setIsRecording(false);
                        return;
                    }

                    const target = cleanTextForTTS(currentMistake.improved);
                    const score = scorePronunciation(transcription, target);
                    
                    if (score >= 80) {
                        handleSuccess();
                    } else {
                        setTrainingFeedback('WRONG');
                    }
                } catch (e) {
                    console.error("Transcription error", e);
                    setTrainingFeedback('WRONG');
                }
                setIsProcessing(false);
                setIsRecording(false);
            };
            
            mediaRecorder.start();
            setIsRecording(true);
            voiceService.stop(); // Stop any playback
        } catch (e) {
            alert("Microphone required");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
             mediaRecorderRef.current.stop();
        }
    };

    const handleSuccess = () => {
        setTrainingFeedback('CORRECT');
        const audio = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-positive-notification-951.mp3'); // Simple success sound
        audio.play().catch(() => {});

        setTimeout(() => {
            // Remove mistake
            storageService.removeMistake(currentMistake.id);
            setMistakes(prev => prev.filter(m => m.id !== currentMistake.id));
            setTrainingFeedback(null);
            setUserAnswer('');
            // Since we remove index 0 (or current), array shifts, index 0 is next item
            // No need to change index unless it was last item, handled by render check
        }, 1500);
    };

    const renderStars = (score: number) => {
        const stars = Math.round(score / 20);
        return (
            <div className="flex gap-0.5">
                {[1,2,3,4,5].map(s => (
                    <Star key={s} size={10} fill={s <= stars ? "#fbbf24" : "#e5e7eb"} className={s <= stars ? "text-yellow-400" : "text-gray-200"} />
                ))}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[100] bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-0 md:p-8 animate-fadeIn">
            {/* MATCH WIDTH TO MAIN APP (max-w-6xl) */}
            <div className="bg-white md:rounded-3xl w-full max-w-6xl h-full md:h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-slideUp">
                
                {/* Header */}
                <div className="bg-white border-b p-4 md:p-6 flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-xl md:text-2xl font-bold text-gray-800">Student Hub</h2>
                        <p className="text-xs text-gray-500">Review & Practice / 复习与训练</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X size={24}/></button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-100 bg-gray-50/50 shrink-0">
                    <button 
                        onClick={() => setActiveTab('FAVORITES')}
                        className={`flex-1 py-3 md:py-4 text-center font-bold transition-all border-b-2 text-sm md:text-base ${activeTab === 'FAVORITES' ? 'border-brand-500 text-brand-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <Heart size={16} fill={activeTab === 'FAVORITES' ? "currentColor" : "none"}/>
                            Favorites ({favorites.length})
                        </div>
                    </button>
                    <button 
                        onClick={() => setActiveTab('TRAINING')}
                        className={`flex-1 py-3 md:py-4 text-center font-bold transition-all border-b-2 text-sm md:text-base ${activeTab === 'TRAINING' ? 'border-orange-500 text-orange-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <Dumbbell size={16} />
                            Training Center ({mistakes.length})
                        </div>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden bg-gray-50 relative">
                    
                    {activeTab === 'FAVORITES' && (
                        <div className="h-full overflow-y-auto p-4 md:p-6 space-y-3 md:space-y-4">
                            {favorites.length === 0 && (
                                <div className="text-center py-20 text-gray-400">
                                    <div className="bg-gray-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Heart size={32} className="opacity-40"/>
                                    </div>
                                    <p className="font-bold text-gray-500">No favorites yet</p>
                                    <p className="text-sm">Add them from Lesson Preview or Report.</p>
                                </div>
                            )}
                            {favorites.map((item) => (
                                <div key={item.id} className="bg-white p-4 md:p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-start justify-between group hover:shadow-md transition-shadow gap-3">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider
                                                ${item.type === 'VOCAB' ? 'bg-blue-50 text-blue-600' : 
                                                  item.type === 'SENTENCE' ? 'bg-indigo-50 text-indigo-600' : 
                                                  'bg-amber-50 text-amber-600'}
                                            `}>
                                                {item.type === 'VOCAB' && <BookOpen size={10}/>}
                                                {item.type === 'SENTENCE' && <Quote size={10}/>}
                                                {item.type === 'EXPRESSION' && <Sparkles size={10}/>}
                                                {item.type}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap items-baseline gap-2">
                                            <h3 className="text-base md:text-lg font-bold text-gray-900 break-words">{item.content.en}</h3>
                                            {item.content.ipa && <span className="text-xs text-gray-400 font-mono bg-gray-50 px-1.5 py-0.5 rounded">{item.content.ipa}</span>}
                                        </div>
                                        {item.content.cn && <p className="text-gray-600 text-sm mt-1">{item.content.cn}</p>}
                                        {(item.content.example || item.content.usage) && (
                                            <div className="mt-2 pt-2 border-t border-gray-50 text-xs text-gray-500 italic bg-gray-50/50 p-2 rounded-lg">
                                                {item.content.example || item.content.usage}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 justify-end md:flex-col md:justify-start shrink-0">
                                        {favScores[item.id] !== undefined && (
                                            <div className="flex flex-col items-end md:items-center mb-1">
                                                {renderStars(favScores[item.id])}
                                                <span className="text-[10px] font-bold text-green-600">{favScores[item.id]}%</span>
                                            </div>
                                        )}
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => recordingFavId === item.id ? stopFavRecording() : startFavRecording(item.id, item.content.en)}
                                                className={`p-2.5 rounded-full transition-all shadow-sm flex items-center justify-center ${recordingFavId === item.id ? 'bg-red-500 text-white animate-pulse' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                                                title="Shadow / Practice"
                                            >
                                                {recordingFavId === item.id ? <Square size={16} fill="currentColor"/> : <Mic size={18}/>}
                                            </button>
                                            <button 
                                                onClick={() => handlePlay(item.content.en, item.id)}
                                                className={`p-2.5 rounded-full transition-colors shadow-sm ${isPlaying === item.id ? 'bg-brand-100 text-brand-600' : 'bg-gray-50 text-gray-400 hover:bg-brand-50 hover:text-brand-500'}`}
                                            >
                                                <Volume2 size={18} className={isPlaying === item.id ? 'animate-pulse' : ''} />
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteFavorite(item.id)}
                                                className="p-2.5 rounded-full bg-gray-50 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors shadow-sm"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === 'TRAINING' && (
                        <div className="h-full flex flex-col p-4 md:p-6">
                            {mistakes.length === 0 ? (
                                <div className="text-center py-20 text-gray-400 m-auto">
                                    <div className="bg-green-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
                                        <CheckCircle size={48} className="text-green-500"/>
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-800 mb-2">All Caught Up!</h3>
                                    <p className="text-gray-500">You have cleared all your mistakes. Great job!</p>
                                </div>
                            ) : (
                                <div className="max-w-3xl mx-auto w-full bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden flex flex-col h-full animate-fadeIn relative">
                                    
                                    {/* Progress Header */}
                                    <div className="bg-gray-50/80 px-6 py-4 border-b border-gray-100 flex justify-between items-center backdrop-blur-sm shrink-0 z-10">
                                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Mistake Queue</span>
                                        <div className="flex items-center gap-3">
                                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase shadow-sm
                                                ${currentMistake.type === 'grammar' ? 'bg-red-100 text-red-600' : 'bg-purple-100 text-purple-600'}
                                            `}>
                                                {currentMistake.type} Error
                                            </span>
                                            <span className="bg-orange-100 text-orange-600 px-3 py-1 rounded-full text-xs font-bold">{mistakes.length} Remaining</span>
                                        </div>
                                    </div>

                                    {/* Scrollable Content Area */}
                                    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 relative">
                                        {/* 1. Context */}
                                        <div className="text-center">
                                            <p className="text-gray-400 text-xs font-bold uppercase mb-2 tracking-wide">Context / 问题</p>
                                            <p className="text-gray-700 text-base md:text-lg font-medium italic">"{currentMistake.context}"</p>
                                            {currentMistake.contextCn && <p className="text-gray-500 text-sm mt-1">{currentMistake.contextCn}</p>}
                                        </div>

                                        {/* 2. User Mistake */}
                                        <div className="bg-red-50 p-6 rounded-2xl border border-red-100 text-center relative">
                                            <p className="text-red-400 text-xs font-bold uppercase mb-2">You said / 你的回答</p>
                                            <p className="text-lg md:text-xl font-medium text-red-800 line-through decoration-red-300/50 break-words decoration-2 leading-relaxed">"{currentMistake.original}"</p>
                                            {currentMistake.originalCn && <p className="text-red-600/70 text-sm mt-2">{currentMistake.originalCn}</p>}
                                        </div>

                                        {/* 3. Improved Version */}
                                        <div className="text-center pb-4">
                                            <div className="flex items-center justify-center gap-2 mb-4">
                                                <p className="text-gray-800 font-bold">Better Version / 建议表达</p>
                                                <button onClick={() => handlePlay(currentMistake.improved, 'correct')} className="p-1.5 bg-gray-100 hover:bg-brand-50 rounded-full text-brand-600 shadow-sm border border-gray-200 transition-colors">
                                                    <Volume2 size={16} className={isPlaying === 'correct' ? 'animate-pulse' : ''} />
                                                </button>
                                            </div>
                                            
                                            <div className="text-xl md:text-2xl font-bold text-gray-800 bg-gradient-to-r from-gray-50 to-white p-6 rounded-2xl border border-gray-100 shadow-inner break-words leading-relaxed">
                                                "{currentMistake.improved}"
                                            </div>
                                            {currentMistake.improvedCn && (
                                                <p className="text-sm text-gray-500 italic mt-3">{currentMistake.improvedCn}</p>
                                            )}
                                        </div>
                                        
                                        {/* Spacer for scroll */}
                                        <div className="h-10"></div>
                                    </div>

                                    {/* Fixed Bottom Controls */}
                                    <div className="p-6 border-t border-gray-100 bg-white z-20 shrink-0 flex flex-col items-center">
                                        <p className="text-xs text-gray-400 font-bold uppercase mb-4 tracking-wider">Tap to Record & Practice</p>
                                        
                                        <div className="flex justify-center items-center gap-6 relative">
                                            <button 
                                                onClick={isRecording ? stopRecording : startRecording}
                                                disabled={isProcessing}
                                                className={`w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center shadow-xl border-4 border-white transition-all transform hover:scale-105 active:scale-95
                                                    ${isRecording 
                                                        ? 'bg-red-500 animate-pulse shadow-red-200' 
                                                        : isProcessing 
                                                            ? 'bg-gray-300' 
                                                            : 'bg-brand-600 shadow-brand-200'
                                                    }
                                                `}
                                            >
                                                {isRecording ? <Square size={32} className="text-white" fill="currentColor"/> : <Mic size={40} className="text-white"/>}
                                            </button>
                                        </div>
                                        <div className="h-6 mt-2 text-center w-full">
                                            {isProcessing && <p className="text-xs text-gray-400 font-medium animate-pulse">Analyzing pronunciation...</p>}
                                        </div>
                                    </div>

                                    {/* Feedback Overlays */}
                                    {trainingFeedback === 'CORRECT' && (
                                        <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center z-50 animate-fadeIn">
                                            <div className="bg-green-100 p-6 rounded-full mb-4 animate-bounce shadow-lg">
                                                <CheckCircle size={64} className="text-green-600" />
                                            </div>
                                            <h3 className="text-3xl font-bold text-green-700 mb-2">Perfect!</h3>
                                            <p className="text-gray-500">Mistake cleared.</p>
                                        </div>
                                    )}
                                    {trainingFeedback === 'WRONG' && (
                                        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-red-100 text-red-600 px-6 py-3 rounded-full text-base font-bold shadow-lg animate-shake flex items-center gap-2 z-50 border border-red-200">
                                            <X size={20} /> Try Again / 再试一次
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
