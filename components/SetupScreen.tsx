
import React, { useState, useRef } from 'react';
import { Avatar, UserProfile, UploadedFile, AssessmentType } from '../types';
import { AVATARS } from '../constants';
import { User, Briefcase, Building, Heart, Check, PlayCircle, Paperclip, X, FileText, Image as ImageIcon, Globe, ChevronRight, Upload, BarChart, ArrowLeft, Target, Zap } from 'lucide-react';
import { voiceService } from '../services/geminiService';

interface Props {
  onComplete: (profile: UserProfile, avatar: Avatar) => void;
  assessmentType: AssessmentType;
  onBack: () => void;
}

export const SetupScreen: React.FC<Props> = ({ onComplete, assessmentType, onBack }) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [profile, setProfile] = useState<UserProfile>({
    name: '',
    role: '',
    industry: '',
    hobbies: '',
    companyContext: '',
    files: [],
    assessmentType: assessmentType,
    previousCefrLevel: '',
    testFocus: ''
  });
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>('0');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleProfileChange = (field: keyof UserProfile, value: any) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const autoMatchAvatar = (level: string, focus: string): Avatar => {
    // Priority: Low Level -> Lily (A0, A1)
    if (['A0', 'A1'].includes(level)) {
        return AVATARS.find(a => a.name === 'Lily') || AVATARS[0];
    }

    // Then check Focus
    if (focus === 'Academic') return AVATARS.find(a => a.name === 'David') || AVATARS[4];
    
    if (focus === 'Business') {
        if (['B2', 'C1', 'C2'].includes(level)) return AVATARS.find(a => a.name === 'Olivia') || AVATARS[5];
        return AVATARS.find(a => a.name === 'James') || AVATARS[2];
    }
    
    if (focus === 'Travel') {
        if (['B2', 'C1', 'C2'].includes(level)) return AVATARS.find(a => a.name === 'Sophia') || AVATARS[3];
        return AVATARS.find(a => a.name === 'Emma') || AVATARS[1];
    }

    // Default / Daily Life / Comprehensive
    if (['A0', 'A1', 'A2'].includes(level)) return AVATARS.find(a => a.name === 'Lily') || AVATARS[0];
    return AVATARS.find(a => a.name === 'Emma') || AVATARS[1];
  };

  const handleNext = () => {
    if (!profile.name || !profile.role || !profile.hobbies) {
      alert("Please fill in all required fields. / 请填写所有必填项。");
      return;
    }
    
    const requiresCefr = assessmentType === 'STAGE_REGULAR' || assessmentType === 'STAGE_CUSTOM' || assessmentType === 'SPEED_RUN';
    if (requiresCefr && !profile.previousCefrLevel) {
        alert("Please select your previous/current CEFR level. / 请选择您的CEFR等级。");
        return;
    }

    if (assessmentType === 'SPEED_RUN' && !profile.testFocus) {
        alert("Please select a Test Focus. / 请选择测试方向。");
        return;
    }

    if (assessmentType === 'STAGE_CUSTOM' && profile.files.length === 0) {
        alert("Please upload your learning materials for Custom Assessment. / 请上传学习资料以便进行定制测评。");
        return;
    }

    if (assessmentType === 'SPEED_RUN') {
        const matchedAvatar = autoMatchAvatar(profile.previousCefrLevel || 'A1', profile.testFocus || 'Daily');
        voiceService.ensureAudioContext();
        onComplete(profile, matchedAvatar);
        return;
    }

    setStep(2);
  };

  const handleStart = () => {
    const avatar = AVATARS.find(a => a.id === selectedAvatarId);
    if (avatar) {
      voiceService.ensureAudioContext();
      onComplete(profile, avatar);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      
      filesArray.forEach((item) => {
        const file = item as File;
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result as string;
          const base64 = base64String.split(',')[1];
          const newFile: UploadedFile = {
            name: file.name,
            mimeType: file.type,
            data: base64
          };
          setProfile(prev => ({ ...prev, files: [...prev.files, newFile] }));
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeFile = (index: number) => {
    setProfile(prev => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index)
    }));
  };

  const getTutorDescription = (tagline: string) => {
      return tagline.replace(/^LEVEL: [^.]+\.\s*/, '');
  };

  const labelClass = "block text-sm font-semibold text-gray-700 mb-1.5 ml-1";
  const inputWrapperClass = "relative group";
  const inputIconClass = "absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-brand-600 transition-colors pointer-events-none";
  const inputClass = "w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-100 focus:border-brand-500 transition-all outline-none text-gray-800 placeholder-gray-400";

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 lg:p-8">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col md:flex-row min-h-[650px] border border-gray-100">
        
        {/* Left Sidebar */}
        <div className="bg-gradient-to-br from-brand-600 to-brand-800 text-white p-8 md:w-1/3 flex flex-col relative overflow-hidden">
          <div className="absolute top-0 left-0 w-64 h-64 bg-white opacity-5 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl"></div>
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-brand-400 opacity-10 rounded-full translate-x-1/3 translate-y-1/3 blur-3xl"></div>

          <div className="relative z-10 flex flex-col h-full">
            <button 
                onClick={onBack}
                className="self-start flex items-center text-brand-100 hover:text-white transition-colors mb-6 group"
            >
                <ArrowLeft size={20} className="mr-1 group-hover:-translate-x-1 transition-transform" />
                <span>Back</span>
            </button>

            <h2 className="text-3xl font-bold mb-2">Setup Profile</h2>
            <p className="text-brand-100 mb-6 text-lg">设置您的个人资料</p>
            
            <div className="inline-block bg-white/10 px-3 py-1 rounded-full text-sm font-medium border border-white/20 mb-8 self-start">
               {assessmentType === 'INITIAL_REGULAR' && 'Regular Assessment / 常规测评'}
               {assessmentType === 'INITIAL_DEEP' && 'Deep Assessment / 深度测评'}
               {assessmentType === 'STAGE_REGULAR' && 'Regular Stage / 常规阶段测评'}
               {assessmentType === 'STAGE_CUSTOM' && 'Custom Stage / 定制阶段测评'}
               {assessmentType === 'SPEED_RUN' && <span className="flex items-center gap-1"><Zap size={14} fill="currentColor"/> Speed Run / 速通测试</span>}
            </div>
            
            <div className="space-y-8 relative">
              <div className="absolute left-[15px] top-4 bottom-4 w-0.5 bg-brand-500/30"></div>
              <div className={`relative flex items-center space-x-4 transition-all duration-300 ${step === 1 ? 'opacity-100 translate-x-2' : 'opacity-60'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold border-2 z-10 transition-all shadow-lg ${step === 1 ? 'bg-white text-brand-700 border-white scale-110' : 'bg-brand-700 text-brand-200 border-brand-500'}`}>1</div>
                <div><span className="block font-bold text-lg">Your Info</span><span className="text-xs text-brand-200 uppercase tracking-wider">个人信息</span></div>
              </div>
              {assessmentType !== 'SPEED_RUN' && (
                  <div className={`relative flex items-center space-x-4 transition-all duration-300 ${step === 2 ? 'opacity-100 translate-x-2' : 'opacity-60'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold border-2 z-10 transition-all shadow-lg ${step === 2 ? 'bg-white text-brand-700 border-white scale-110' : 'bg-brand-700 text-brand-200 border-brand-500'}`}>2</div>
                    <div><span className="block font-bold text-lg">Select Examiner</span><span className="text-xs text-brand-200 uppercase tracking-wider">选择考官</span></div>
                  </div>
              )}
              {assessmentType === 'SPEED_RUN' && (
                  <div className="relative flex items-center space-x-4 opacity-60">
                     <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold border-2 border-brand-500 bg-brand-700 text-brand-200 z-10"><Zap size={14} /></div>
                     <div><span className="block font-bold text-lg">Auto Match</span><span className="text-xs text-brand-200 uppercase tracking-wider">自动匹配考官</span></div>
                  </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Content Area */}
        <div className="p-8 md:p-10 md:w-2/3 flex flex-col bg-white relative">
          {step === 1 ? (
            <div className="flex flex-col h-full animate-fadeIn">
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-gray-800">Tell us about yourself</h3>
                <p className="text-gray-500 mt-1">请简单介绍一下你自己，以便我们为您定制测试。</p>
              </div>
              
              <div className="space-y-5 overflow-y-auto pr-2 scrollbar-hide flex-1 pb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className={labelClass}>Full Name / 姓名 *</label>
                    <div className={inputWrapperClass}>
                        <User className={inputIconClass} size={18} />
                        <input type="text" value={profile.name} onChange={(e) => handleProfileChange('name', e.target.value)} className={inputClass} placeholder="e.g. John Doe" />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Current Role / 职位 *</label>
                    <div className={inputWrapperClass}>
                        <Briefcase className={inputIconClass} size={18} />
                        <input type="text" value={profile.role} onChange={(e) => handleProfileChange('role', e.target.value)} className={inputClass} placeholder="e.g. Marketing Manager" />
                    </div>
                  </div>
                </div>

                {(assessmentType === 'STAGE_REGULAR' || assessmentType === 'STAGE_CUSTOM' || assessmentType === 'SPEED_RUN') && (
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                        <label className={`${labelClass} text-blue-800`}>Current/Previous Level / 当前等级 *</label>
                        <div className={inputWrapperClass}>
                            <BarChart className={inputIconClass} size={18} />
                            <select value={profile.previousCefrLevel} onChange={(e) => handleProfileChange('previousCefrLevel', e.target.value)} className={inputClass}>
                                <option value="">Select Level</option>
                                <option value="A0">A0 (Absolute Beginner)</option>
                                <option value="A1">A1 (Beginner)</option>
                                <option value="A2">A2 (Elementary)</option>
                                <option value="B1">B1 (Intermediate)</option>
                                <option value="B2">B2 (Upper Intermediate)</option>
                                <option value="C1">C1 (Advanced)</option>
                                <option value="C2">C2 (Mastery)</option>
                            </select>
                        </div>
                    </div>
                )}

                {assessmentType === 'SPEED_RUN' && (
                    <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                        <label className={`${labelClass} text-amber-800`}>Test Focus / 测试方向 *</label>
                        <div className={inputWrapperClass}>
                            <Target className={inputIconClass} size={18} />
                            <select value={profile.testFocus} onChange={(e) => handleProfileChange('testFocus', e.target.value)} className={inputClass}>
                                <option value="">Select Focus</option>
                                <option value="Comprehensive">Comprehensive / 综合能力</option>
                                <option value="Business">Business & Career / 商务职场</option>
                                <option value="Daily">Daily Life & Hobbies / 日常生活</option>
                                <option value="Academic">Academic & Study / 学术研究</option>
                                <option value="Travel">Travel & Culture / 旅游文化</option>
                            </select>
                        </div>
                    </div>
                )}
                
                <div>
                  <label className={labelClass}>Company / 公司 (Website or Name)</label>
                  <div className={inputWrapperClass}>
                    <Globe className={inputIconClass} size={18} />
                    <input type="text" value={profile.companyContext} onChange={(e) => handleProfileChange('companyContext', e.target.value)} className={inputClass} placeholder="e.g. Google, or www.example.com" />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Industry / 行业 (Optional)</label>
                  <div className={inputWrapperClass}>
                    <Building className={inputIconClass} size={18} />
                    <input type="text" value={profile.industry} onChange={(e) => handleProfileChange('industry', e.target.value)} className={inputClass} placeholder="e.g. Tech / Internet" />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Hobbies / 兴趣爱好 *</label>
                  <div className={inputWrapperClass}>
                    <Heart className={inputIconClass} size={18} />
                    <input type="text" value={profile.hobbies} onChange={(e) => handleProfileChange('hobbies', e.target.value)} className={inputClass} placeholder="e.g. Photography, Reading, Traveling" />
                  </div>
                </div>

                <div>
                   <label className={labelClass}>{assessmentType === 'STAGE_CUSTOM' ? 'Upload Learning Materials / 上传学习资料 *' : 'Upload Resume / 上传简历 (Optional)'}</label>
                   <div onClick={() => fileInputRef.current?.click()} className={`mt-2 border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all group ${assessmentType === 'STAGE_CUSTOM' ? 'border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 hover:border-emerald-400' : 'border-gray-200 hover:border-brand-400 hover:bg-brand-50'}`}>
                     <div className={`p-3 rounded-full mb-3 transition-colors ${assessmentType === 'STAGE_CUSTOM' ? 'bg-emerald-100' : 'bg-gray-50 group-hover:bg-white'}`}><Upload className={assessmentType === 'STAGE_CUSTOM' ? 'text-emerald-600' : 'text-brand-500'} size={24} /></div>
                     <span className="text-sm font-medium text-gray-700">Click to upload PDF, Word, or Images</span>
                     <input type="file" ref={fileInputRef} className="hidden" accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" multiple onChange={handleFileUpload} />
                   </div>
                   {profile.files.length > 0 && (
                     <div className="mt-4 grid grid-cols-1 gap-2">
                       {profile.files.map((file, idx) => (
                         <div key={idx} className="flex items-center justify-between bg-white border border-gray-100 p-3 rounded-lg shadow-sm">
                            <span className="text-sm font-medium text-gray-700 truncate max-w-[200px]">{file.name}</span>
                            <button onClick={() => removeFile(idx)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"><X size={16} /></button>
                         </div>
                       ))}
                     </div>
                   )}
                </div>
              </div>

              <div className="pt-6 mt-auto border-t border-gray-100 flex justify-end">
                <button onClick={handleNext} className="bg-brand-600 hover:bg-brand-700 text-white font-bold py-3.5 px-8 rounded-xl shadow-lg shadow-brand-500/30 flex items-center space-x-2 transition-all transform hover:-translate-y-1">
                  <span>{assessmentType === 'SPEED_RUN' ? 'Start Speed Run / 开始' : 'Next Step / 下一步'}</span>
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full animate-fadeIn">
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-gray-800">Choose your Examiner</h3>
                <p className="text-gray-500 mt-1">Select an AI persona that fits your preferred testing style.</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto max-h-[420px] pr-2 -mr-2 pb-4 scrollbar-hide">
                {AVATARS.map((avatar) => {
                  const [engPersona, cnPersona] = avatar.personality.split(' / ');
                  const description = getTutorDescription(avatar.selectionTagline);
                  const [descEn, descCn] = description.split(' / ');

                  return (
                  <div 
                    key={avatar.id}
                    onClick={() => setSelectedAvatarId(avatar.id)}
                    className={`relative p-4 rounded-2xl border-2 cursor-pointer transition-all duration-200 group
                      ${selectedAvatarId === avatar.id 
                        ? 'border-brand-500 bg-brand-50/60 shadow-md scale-[1.02]' 
                        : 'border-gray-100 bg-white hover:border-brand-200 hover:shadow-sm'
                      }
                    `}
                  >
                     <div className="flex items-start gap-4">
                        <div className="relative">
                            <img src={avatar.avatarUrl} alt={avatar.name} className="w-16 h-16 rounded-2xl object-cover shadow-sm group-hover:shadow-md transition-shadow" />
                            {selectedAvatarId === avatar.id && (
                              <div className="absolute -bottom-2 -right-2 bg-brand-500 text-white rounded-full p-1 shadow-sm border-2 border-white"><Check size={12} /></div>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-lg text-gray-900 truncate">{avatar.name}</h4>
                            <div className="flex flex-col gap-0.5 mt-1">
                                <div className="text-xs font-bold text-gray-700 truncate">{engPersona}</div>
                                <div className="text-[10px] text-gray-500 truncate">{cnPersona}</div>
                            </div>
                        </div>
                     </div>
                     <div className="mt-3 pt-3 border-t border-gray-100/50">
                        <p className="text-xs text-gray-600 font-medium leading-relaxed">{descEn}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{descCn}</p>
                     </div>
                  </div>
                )})}
              </div>

              <div className="mt-auto pt-6 flex justify-between items-center border-t border-gray-100">
                <button onClick={() => setStep(1)} className="text-gray-500 hover:text-gray-900 font-medium px-4 py-2 hover:bg-gray-100 rounded-lg transition-colors">Back / 返回</button>
                <button onClick={handleStart} className="bg-brand-600 hover:bg-brand-700 text-white font-bold py-3.5 px-8 rounded-xl shadow-lg shadow-brand-500/30 flex items-center space-x-2 transition-all transform hover:-translate-y-1 hover:shadow-xl">
                  <span className="text-left leading-tight">Start Test<span className="block text-[10px] font-normal opacity-80">开始测试</span></span>
                  <PlayCircle size={24} className="ml-1" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
