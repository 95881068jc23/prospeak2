
import React, { useState } from 'react';
import { AssessmentType, AppMode } from '../types';
import { Lightbulb, HeartHandshake, Play, Layers, FileText, ChevronRight, ArrowLeft, BrainCircuit, Zap, GraduationCap, Mic2 } from 'lucide-react';

interface Props {
  onStartAssessment: (type: AssessmentType) => void;
  onStartLearning: () => void;
}

export const WelcomeScreen: React.FC<Props> = ({ onStartAssessment, onStartLearning }) => {
  const [view, setView] = useState<'HOME' | 'ASSESSMENT_SELECT'>('HOME');

  const renderHome = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl animate-fadeIn">
        {/* Assessment Path */}
        <button 
            onClick={() => setView('ASSESSMENT_SELECT')}
            className="bg-white hover:bg-brand-50 border-2 border-transparent hover:border-brand-200 rounded-3xl p-8 text-left shadow-xl transition-all transform hover:-translate-y-1 group flex flex-col h-full min-h-[300px]"
        >
            <div className="bg-brand-100 w-20 h-20 rounded-3xl flex items-center justify-center text-brand-600 mb-6 group-hover:scale-110 transition-transform shadow-inner">
                <Mic2 size={40} />
            </div>
            <h3 className="text-3xl font-bold text-gray-900 mb-3">Assessment<br/><span className="text-xl font-normal text-gray-500">专业测评</span></h3>
            <p className="text-gray-500 text-lg mb-8 flex-grow leading-relaxed">
                Take a professional oral proficiency test. Get CEFR Level, detailed scores, and analysis.
                <br/><span className="text-sm opacity-70">进行专业口语测试，获取CEFR定级、雷达图及详细分析报告。</span>
            </p>
            <div className="flex items-center text-brand-600 font-bold text-lg mt-auto">
                Start Assessment <ChevronRight className="ml-2 group-hover:translate-x-1 transition-transform" size={20} />
            </div>
        </button>

        {/* Learning Path */}
        <button 
            onClick={onStartLearning}
            className="bg-white hover:bg-emerald-50 border-2 border-transparent hover:border-emerald-200 rounded-3xl p-8 text-left shadow-xl transition-all transform hover:-translate-y-1 group flex flex-col h-full min-h-[300px]"
        >
            <div className="bg-emerald-100 w-20 h-20 rounded-3xl flex items-center justify-center text-emerald-600 mb-6 group-hover:scale-110 transition-transform shadow-inner">
                <GraduationCap size={40} />
            </div>
            <h3 className="text-3xl font-bold text-gray-900 mb-3">Learning<br/><span className="text-xl font-normal text-gray-500">口语陪练</span></h3>
            <p className="text-gray-500 text-lg mb-8 flex-grow leading-relaxed">
                Practice specific topics or custom scenarios with AI tutors. Stress-free environment.
                <br/><span className="text-sm opacity-70">基于核心话题或自定义场景进行陪练。无扣分压力，纯享学习。</span>
            </p>
            <div className="flex items-center text-emerald-600 font-bold text-lg mt-auto">
                Start Learning <ChevronRight className="ml-2 group-hover:translate-x-1 transition-transform" size={20} />
            </div>
        </button>
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
    <div className="min-h-screen bg-brand-50 flex flex-col items-center justify-center p-6">
      <div className="max-w-6xl w-full flex flex-col items-center">
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-6xl font-extrabold text-brand-900 mb-4 tracking-tight">Marvel ProSpeak</h1>
          <p className="text-brand-600 text-xl max-w-2xl mx-auto font-medium">Professional English Assessment & Learning Platform</p>
          <p className="text-brand-400 text-sm mt-1">麦迩威英语专业口语测评与陪练系统</p>
        </div>

        {view === 'HOME' && renderHome()}
        {view === 'ASSESSMENT_SELECT' && renderAssessmentSelection()}

        {/* Info Footer */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl w-full text-sm">
           <div className="bg-white/60 border border-white rounded-xl p-4 flex gap-3 shadow-sm">
              <HeartHandshake className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
              <div className="text-gray-600">
                 <strong className="block mb-1 text-gray-900">Safe Environment / 轻松开口</strong>
                 Assessment or Learning, we provide a supportive AI environment. / 无论是测评还是陪练，我们提供支持性的AI环境。
              </div>
           </div>
           <div className="bg-white/60 border border-white rounded-xl p-4 flex gap-3 shadow-sm">
              <Lightbulb className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
              <div className="text-gray-600">
                 <strong className="block mb-1 text-gray-900">Smart Analysis / 智能分析</strong>
                 Get detailed feedback on every sentence you speak. / 获取对您所说每一句话的详细反馈。
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};
