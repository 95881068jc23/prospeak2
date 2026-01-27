
import React, { useState } from 'react';
import { AssessmentType, AppMode } from '../types';
import { Lightbulb, HeartHandshake, Play, Layers, FileText, ChevronRight, ArrowLeft, BrainCircuit, Zap, GraduationCap, Mic2, LayoutGrid, Heart } from 'lucide-react';
import { StudentHub } from './StudentHub'; // New import

interface Props {
  onStartAssessment: (type: AssessmentType) => void;
  onStartLearning: () => void;
}

export const WelcomeScreen: React.FC<Props> = ({ onStartAssessment, onStartLearning }) => {
  const [view, setView] = useState<'HOME' | 'ASSESSMENT_SELECT'>('HOME');
  const [showHub, setShowHub] = useState(false);

  const renderHome = () => (
    <div className="w-full max-w-5xl animate-fadeIn">
        <div className="flex flex-col gap-6 mb-12">
            
            {/* 1. PRIMARY: Learning Path (Large Card) */}
            <button 
                onClick={onStartLearning}
                className="bg-gradient-to-br from-white to-emerald-50 hover:to-emerald-100 border-2 border-emerald-100 hover:border-emerald-300 rounded-3xl p-8 text-left shadow-xl transition-all transform hover:-translate-y-1 group flex flex-col md:flex-row items-center md:items-start gap-6 relative overflow-hidden"
            >
                <div className="absolute top-0 right-0 bg-emerald-600 text-white text-xs font-bold px-4 py-1.5 rounded-bl-2xl uppercase tracking-wider shadow-sm">Recommended</div>
                
                <div className="bg-emerald-100 w-24 h-24 rounded-full flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform shadow-inner shrink-0">
                    <GraduationCap size={48} />
                </div>
                
                <div className="flex-1 text-center md:text-left">
                    <h3 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-2">Learning Partner<br/><span className="text-xl md:text-2xl font-normal text-emerald-700">AI 口语陪练</span></h3>
                    <p className="text-gray-600 text-lg mb-6 leading-relaxed">
                        Practice specific topics or custom scenarios with AI tutors. Stress-free environment with instant feedback.
                        <br/><span className="text-sm opacity-80">基于核心话题或自定义场景进行陪练。无扣分压力，纯享学习与即时反馈。</span>
                    </p>
                    <div className="inline-flex items-center bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold text-lg shadow-lg group-hover:bg-emerald-700 transition-colors">
                        Start Learning <ChevronRight className="ml-2 group-hover:translate-x-1 transition-transform" size={20} />
                    </div>
                </div>
            </button>

            {/* 2. SECONDARY: Assessment Path (Smaller Card) */}
            <button 
                onClick={() => setView('ASSESSMENT_SELECT')}
                className="bg-white hover:bg-gray-50 border border-gray-200 hover:border-brand-300 rounded-2xl p-6 text-left shadow-md transition-all group flex items-center gap-6"
            >
                <div className="bg-brand-50 w-16 h-16 rounded-2xl flex items-center justify-center text-brand-600 group-hover:scale-110 transition-transform shrink-0">
                    <Mic2 size={32} />
                </div>
                <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        Professional Assessment <span className="text-base font-normal text-gray-500">/ 专业测评</span>
                    </h3>
                    <p className="text-gray-500 text-sm mt-1">
                        Take a formal test to get your CEFR Level and detailed radar report.
                        <span className="hidden md:inline"> / 进行专业测试，获取CEFR定级报告。</span>
                    </p>
                </div>
                <div className="bg-gray-100 p-2 rounded-full text-gray-400 group-hover:bg-brand-100 group-hover:text-brand-600 transition-colors">
                    <ChevronRight size={24} />
                </div>
            </button>
        </div>

        {/* Student Hub Entry */}
        <div className="flex justify-center">
            <button 
                onClick={() => setShowHub(true)}
                className="flex items-center gap-3 bg-white px-8 py-4 rounded-2xl shadow-md border border-gray-100 hover:shadow-lg hover:border-gray-200 transition-all group"
            >
                <div className="bg-orange-100 p-2 rounded-full text-orange-600 group-hover:scale-110 transition-transform">
                    <LayoutGrid size={24} />
                </div>
                <div className="text-left">
                    <span className="block font-bold text-gray-800">Student Hub / 学员中心</span>
                    <span className="text-xs text-gray-500">Favorites & Training Center</span>
                </div>
            </button>
        </div>
    </div>
  );

  const renderAssessmentSelection = () => (
    <div className="w-full max-w-6xl animate-fadeIn">
       <button onClick={() => setView('HOME')} className="flex items-center text-gray-500 hover:text-gray-800 mb-6 transition-colors">
          <ArrowLeft size={20} className="mr-2" /> Back / 返回
       </button>
       <h2 className="text-3xl font-bold text-gray-800 mb-8 text-center">Select Assessment Type / 选择测评类型</h2>
       
       {/* Initial Mode Selection */}
       <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* 1. Speed Run */}
          <button 
            onClick={() => onStartAssessment('SPEED_RUN')}
            className="bg-white hover:bg-amber-50 border border-gray-100 hover:border-amber-200 rounded-2xl p-6 text-left shadow-md transition-all group relative overflow-hidden flex flex-col h-full"
          >
            <div className="absolute top-0 right-0 bg-amber-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg uppercase tracking-wider">Fast • 10 Mins</div>
            <div className="flex justify-between items-start mb-4 gap-4">
               <h3 className="text-xl font-bold text-gray-900">Speed Run<br/><span className="text-base font-normal text-gray-600">速通测试</span></h3>
               <div className="bg-amber-100 p-2.5 rounded-xl text-amber-600 shadow-sm shrink-0"><Zap size={24} fill="currentColor"/></div>
            </div>
            <p className="text-sm text-gray-500 mb-4 flex-grow">
              Auto-matched examiner. 6 Questions.
              <br/>自动匹配考官，6个问题，快速出分。
            </p>
          </button>

          {/* 2. Regular Initial */}
          <button 
            onClick={() => onStartAssessment('INITIAL_REGULAR')}
            className="bg-white hover:bg-blue-50 border border-gray-100 hover:border-blue-200 rounded-2xl p-6 text-left shadow-md transition-all group flex flex-col h-full relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 bg-blue-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg uppercase tracking-wider">Standard • 20 Mins</div>
            <div className="flex justify-between items-start mb-4 gap-4">
               <h3 className="text-xl font-bold text-gray-900">Regular<br/><span className="text-base font-normal text-gray-600">常规测评</span></h3>
               <div className="bg-blue-100 p-2.5 rounded-xl text-blue-600 shadow-sm shrink-0"><Play size={24}/></div>
            </div>
            <p className="text-sm text-gray-500 mb-4 flex-grow">
              Standard 4-part assessment. 12 Questions.
              <br/>标准的4部分测评，12个问题。
            </p>
          </button>

          {/* 3. Deep Initial */}
          <button 
            onClick={() => onStartAssessment('INITIAL_DEEP')}
            className="bg-white hover:bg-indigo-50 border border-gray-100 hover:border-indigo-200 rounded-2xl p-6 text-left shadow-md transition-all group relative overflow-hidden flex flex-col h-full"
          >
            <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg uppercase tracking-wider">Deep • 30 Mins</div>
            <div className="flex justify-between items-start mb-4 gap-4">
               <h3 className="text-xl font-bold text-gray-900">Deep<br/><span className="text-base font-normal text-gray-600">深度测评</span></h3>
               <div className="bg-indigo-100 p-2.5 rounded-xl text-indigo-600 shadow-sm shrink-0"><BrainCircuit size={24}/></div>
            </div>
            <p className="text-sm text-gray-500 mb-4 flex-grow">
               Includes C1-C2 Challenge. 18 Questions.
              <br/>包含高阶挑战，18个问题，深度分析。
            </p>
          </button>
       </div>

       <div className="border-t border-gray-200 pt-8">
            <h3 className="text-lg font-bold text-gray-600 mb-6 px-1">Stage Assessments (For Existing Students) / 阶段测评</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <button 
                    onClick={() => onStartAssessment('STAGE_REGULAR')}
                    className="bg-gray-50 hover:bg-purple-50 border border-transparent hover:border-purple-200 rounded-2xl p-6 text-left transition-all flex items-center gap-4 relative overflow-hidden group"
                >
                    <div className="bg-purple-100 p-3 rounded-full text-purple-600"><Layers size={20}/></div>
                    <div>
                        <h4 className="font-bold text-gray-800">Regular Stage / 常规阶段</h4>
                        <p className="text-xs text-gray-500">Adaptive progress check.</p>
                    </div>
                    <div className="absolute top-4 right-4 text-[10px] font-bold text-purple-400 bg-purple-100 px-2 py-0.5 rounded-full">30 Mins</div>
                </button>
                <button 
                    onClick={() => onStartAssessment('STAGE_CUSTOM')}
                    className="bg-gray-50 hover:bg-teal-50 border border-transparent hover:border-teal-200 rounded-2xl p-6 text-left transition-all flex items-center gap-4 relative overflow-hidden group"
                >
                    <div className="bg-teal-100 p-3 rounded-full text-teal-600"><FileText size={20}/></div>
                    <div>
                        <h4 className="font-bold text-gray-800">Custom Stage / 定制阶段</h4>
                        <p className="text-xs text-gray-500">Based on uploaded materials.</p>
                    </div>
                    <div className="absolute top-4 right-4 text-[10px] font-bold text-teal-400 bg-teal-100 px-2 py-0.5 rounded-full">30 Mins</div>
                </button>
            </div>
       </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-brand-50 flex flex-col items-center justify-center p-4 md:p-6 relative">
      {showHub && <StudentHub onClose={() => setShowHub(false)} />}
      
      <div className="max-w-6xl w-full flex flex-col items-center">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-5xl font-extrabold text-brand-900 mb-2 tracking-tight">Marvel ProSpeak</h1>
          <p className="text-brand-600 text-lg md:text-xl max-w-2xl mx-auto font-medium">Professional English Assessment & Learning Platform</p>
          <p className="text-brand-400 text-xs md:text-sm mt-1">麦迩威英语专业口语测评与陪练系统</p>
        </div>

        {view === 'HOME' && renderHome()}
        {view === 'ASSESSMENT_SELECT' && renderAssessmentSelection()}

        {/* Info Footer */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl w-full text-xs md:text-sm text-gray-500">
           <div className="text-center md:text-left">
              © Marvel English. AI-Powered Education.
           </div>
           <div className="text-center md:text-right">
              Based on CEFR Standards.
           </div>
        </div>
      </div>
    </div>
  );
};
