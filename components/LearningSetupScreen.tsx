
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Avatar, LearningConfig, LearningMode, Topic, UploadedFile, LearningDuration, VoiceType } from '../types';
import { AVATARS, TOPICS_DB } from '../constants';
import { BookOpen, PenTool, Clock, User, Briefcase, FileText, Upload, X, Image as ImageIcon, Check, PlayCircle, ArrowLeft, Target, Globe, ToggleLeft, ToggleRight, Sparkles, Zap, Mic2, Wifi, Search, ArrowRight, BarChart, MessageCircleQuestion, Tag, RefreshCcw, LayoutTemplate, BriefcaseBusiness, LibraryBig, Trash2, CloudDownload, DownloadCloud, Loader2, ListChecks, CheckSquare, Square, Coffee, Plane, Home, Users, Heart, Sun, Moon, Cloud, Music, Video, Camera, ShoppingBag, DollarSign, TrendingUp, Cpu, Activity, Utensils, MapPin, Calendar, Smile, MessageCircle, Handshake, Monitor, Smartphone, Dumbbell,  Shirt, Ticket, Gift, Film, GraduationCap, Building2, Car, Train, CreditCard, PieChart, Lightbulb, Brain, Laugh, Trophy, Leaf, Palette, Newspaper, Laptop, Tv } from 'lucide-react';
import { voiceService, clearLessonPlanCache, isPlanCached, generateLessonPlan, preloadLessonAssets } from '../services/geminiService';
import { storageService } from '../services/storageService';

interface Props {
  onComplete: (config: LearningConfig, avatar: Avatar) => void;
  onBack: () => void;
}

const CEFR_LEVELS = ['PreA1', 'A1', 'A2', 'A2+', 'B1', 'B1+', 'B2', 'B2+', 'C1', 'C1+'];

// Role Options Constants
const ROLE_OPTIONS = [
    { value: 'Student', label: 'Student / 学生' },
    { value: 'Teacher', label: 'Teacher / 老师' },
    { value: 'Interviewer', label: 'Interviewer / 面试官' },
    { value: 'Interviewee', label: 'Interviewee / 面试者' },
    { value: 'Leader', label: 'Leader / 领导' },
    { value: 'Employee', label: 'Employee / 员工' },
    { value: 'Speaker', label: 'Speaker / 演讲者' },
    { value: 'Audience', label: 'Audience / 提问观众' },
    { value: 'Host', label: 'Host / 会议主持' },
    { value: 'Participant', label: 'Participant / 参会人员' }
];

const FOCUS_OPTIONS = [
    { value: 'Business', label: 'Business / 商务' },
    { value: 'Daily Life', label: 'Daily Life / 生活' },
    { value: 'Academic', label: 'Academic / 学术' },
    { value: 'Interview', label: 'Job Interview / 面试' },
    { value: 'Presentation', label: 'Presentation / 汇报' },
    { value: 'Debate', label: 'Debate / 辩论' }
];

// Hot Tags Configuration
const HOT_TAGS = [
    // Life Tags
    { type: 'LIFE', label: '👋 Intro / 介绍', query: 'Intro' },
    { type: 'LIFE', label: '🗣️ Share / 分享', query: 'Share' },
    { type: 'LIFE', label: '👨‍👩‍👧 Family / 家庭', query: 'Family' },
    { type: 'LIFE', label: '🍔 Food / 饮食', query: 'Food' },
    { type: 'LIFE', label: '👗 Fashion / 穿搭', query: 'Clothing' },
    { type: 'LIFE', label: '✈️ Travel / 出行', query: 'Travel' },
    { type: 'LIFE', label: '💬 Social / 社交', query: 'Social' },
    { type: 'LIFE', label: '🛍️ Shop / 购物', query: 'Shopping' },
    { type: 'LIFE', label: '🏃 Sport / 运动', query: 'Sport' },
    { type: 'LIFE', label: '💻 Tech / 科技', query: 'Tech' },
    { type: 'LIFE', label: '🐱 Pet / 宠物', query: 'Pet' },
    { type: 'LIFE', label: '🧠 Psych / 心理', query: 'Psychology' },
    
    // Business Tags
    { type: 'BUSINESS', label: '🤝 Meet / 会议', query: 'Meeting' },
    { type: 'BUSINESS', label: '🗣️ Nego / 谈判', query: 'Negotiation' },
    { type: 'BUSINESS', label: '🎤 Speech / 演讲', query: 'Presentation' },
    { type: 'BUSINESS', label: '📧 Email / 邮件', query: 'Email' },
    { type: 'BUSINESS', label: '🌏 Culture / 文化', query: 'Culture' },
    { type: 'BUSINESS', label: '👑 Lead / 领导', query: 'Leadership' },
    { type: 'BUSINESS', label: '🌍 Global / 出海', query: 'Global' },
    { type: 'BUSINESS', label: '💵 Fin / 金融', query: 'Finance' },
    { type: 'BUSINESS', label: '💰 Sales / 销售', query: 'Sales' },
    { type: 'BUSINESS', label: '👥 HR / 人事', query: 'HR' },
    { type: 'BUSINESS', label: '📈 Market / 市场', query: 'Marketing' },
    { type: 'BUSINESS', label: '👔 Manage / 管理', query: 'Management' },
];

// Helper: Intelligent Icon Mapping (Replaces External Images)
const getTopicVisuals = (topic: Topic) => {
    const key = `${topic.titleEn} ${topic.category}`.toLowerCase();
    
    // 1. Icon Selection Logic
    let Icon = Sparkles;
    // Fallback Icon for Scale if not available, using BarChart
    let Scale = BarChart;

    if (key.includes('meet') || key.includes('introduc') || key.includes('greet')) Icon = Handshake;
    else if (key.includes('negotiat') || key.includes('deal') || key.includes('contract')) Icon = Scale;
    else if (key.includes('email') || key.includes('messag')) Icon = MessageCircle;
    else if (key.includes('present') || key.includes('speech')) Icon = Mic2;
    else if (key.includes('lead') || key.includes('manage') || key.includes('boss')) Icon = Briefcase;
    else if (key.includes('financ') || key.includes('money') || key.includes('bank') || key.includes('invest')) Icon = DollarSign;
    else if (key.includes('market') || key.includes('brand') || key.includes('advert')) Icon = Target;
    else if (key.includes('sale')) Icon = ShoppingBag;
    else if (key.includes('strateg') || key.includes('plan')) Icon = TrendingUp;
    else if (key.includes('custom') || key.includes('support')) Icon = Heart;
    else if (key.includes('team') || key.includes('colleague')) Icon = Users;
    else if (key.includes('office') || key.includes('work')) Icon = Building2;
    else if (key.includes('career') || key.includes('job') || key.includes('interview')) Icon = BriefcaseBusiness;
    else if (key.includes('communicat')) Icon = MessageCircleQuestion;
    else if (key.includes('coffee') || key.includes('drink')) Icon = Coffee;
    else if (key.includes('shop') || key.includes('buy') || key.includes('mall')) Icon = ShoppingBag;
    else if (key.includes('fashion') || key.includes('cloth') || key.includes('outfit')) Icon = Shirt;
    else if (key.includes('food') || key.includes('eat') || key.includes('meal') || key.includes('cook') || key.includes('restaurant')) Icon = Utensils;
    else if (key.includes('travel') || key.includes('trip') || key.includes('flight') || key.includes('airport')) Icon = Plane;
    else if (key.includes('hotel')) Icon = Building2;
    else if (key.includes('transport') || key.includes('car') || key.includes('train')) Icon = Car;
    else if (key.includes('fam') || key.includes('parent') || key.includes('kid')) Icon = Home;
    else if (key.includes('friend')) Icon = Users;
    else if (key.includes('pet') || key.includes('dog') || key.includes('cat')) Icon = Heart;
    else if (key.includes('tech') || key.includes('digital') || key.includes('app') || key.includes('phone') || key.includes('internet')) Icon = Smartphone;
    else if (key.includes('music')) Icon = Music;
    else if (key.includes('movie') || key.includes('film') || key.includes('cinema')) Icon = Film;
    else if (key.includes('sport') || key.includes('gym') || key.includes('run') || key.includes('fit')) Icon = Dumbbell;
    else if (key.includes('health') || key.includes('doctor')) Icon = Activity;
    else if (key.includes('cultur') || key.includes('global') || key.includes('world')) Icon = Globe;
    else if (key.includes('news')) Icon = Newspaper;
    else if (key.includes('psycho') || key.includes('mind') || key.includes('brain')) Icon = Brain;
    else if (key.includes('book') || key.includes('read')) Icon = BookOpen;
    else if (key.includes('art') || key.includes('design')) Icon = Palette;
    else if (key.includes('tv') || key.includes('show')) Icon = Tv;
    else if (key.includes('laptop') || key.includes('computer')) Icon = Laptop;
    else if (key.includes('gift')) Icon = Gift;
    else if (key.includes('laugh') || key.includes('funny') || key.includes('humor')) Icon = Laugh;
    else if (key.includes('prize') || key.includes('award') || key.includes('success')) Icon = Trophy;
    else if (key.includes('natur') || key.includes('environment')) Icon = Leaf;

    // 2. Color Selection Logic
    let colorClass = "bg-emerald-100 text-emerald-600";
    if (topic.category === 'BUSINESS') {
        colorClass = "bg-gradient-to-br from-blue-50 to-indigo-100 text-indigo-600";
        if (key.includes('money') || key.includes('financ')) colorClass = "bg-gradient-to-br from-emerald-50 to-teal-100 text-teal-600";
        if (key.includes('market') || key.includes('sale')) colorClass = "bg-gradient-to-br from-orange-50 to-red-100 text-orange-600";
        if (key.includes('leader') || key.includes('manage')) colorClass = "bg-gradient-to-br from-purple-50 to-violet-100 text-purple-600";
    } else {
        colorClass = "bg-gradient-to-br from-orange-50 to-amber-100 text-amber-600";
        if (key.includes('tech') || key.includes('digit')) colorClass = "bg-gradient-to-br from-cyan-50 to-sky-100 text-cyan-600";
        if (key.includes('health') || key.includes('sport')) colorClass = "bg-gradient-to-br from-rose-50 to-pink-100 text-rose-500";
        if (key.includes('food') || key.includes('cook')) colorClass = "bg-gradient-to-br from-yellow-50 to-orange-100 text-orange-500";
        if (key.includes('travel') || key.includes('natur')) colorClass = "bg-gradient-to-br from-green-50 to-emerald-100 text-emerald-600";
        if (key.includes('art') || key.includes('music')) colorClass = "bg-gradient-to-br from-fuchsia-50 to-pink-100 text-fuchsia-600";
    }

    return { Icon, colorClass };
};

// Helper Components
interface DurationCardProps {
    val: LearningDuration;
    label: string;
    desc: string;
    turns: string;
    isSelected: boolean;
    onSelect: (val: LearningDuration) => void;
}

const DurationCard: React.FC<DurationCardProps> = ({ val, label, desc, turns, isSelected, onSelect }) => (
    <button 
      onClick={() => onSelect(val)}
      className={`flex-1 p-3 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-0.5
          ${isSelected ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-100 bg-white hover:border-emerald-200'}
      `}
    >
        <span className="text-sm font-bold">{label}</span>
        <span className={`text-xs font-bold ${isSelected ? 'text-emerald-600' : 'text-gray-500'}`}>{desc}</span>
        <span className="text-[10px] opacity-60">{turns}</span>
    </button>
);

interface TopicCardProps {
    topic: Topic;
    isSelected: boolean;
    isBatchMode: boolean;
    isChecked: boolean;
    searchQuery: string;
    downloadStatus: 'idle' | 'loading' | 'ready';
    onSelect: (id: string) => void;
    onDownload: (e: React.MouseEvent) => void;
}

const TopicCard: React.FC<TopicCardProps> = ({ topic, isSelected, isBatchMode, isChecked, searchQuery, downloadStatus, onSelect, onDownload }) => {
    // Generate Visuals locally - instant, no network, no errors
    const { Icon, colorClass } = useMemo(() => getTopicVisuals(topic), [topic.id]);

    return (
        <button 
            onClick={() => onSelect(topic.id)}
            className={`rounded-xl border text-left transition-all relative group flex overflow-hidden
                ${isBatchMode 
                    ? (isChecked ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' : 'bg-white border-gray-200 hover:border-blue-300')
                    : (isSelected ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' : 'bg-white border-gray-200 hover:border-emerald-300 text-gray-700')
                }
            `}
        >
            <div className="flex h-20 w-full p-2 gap-3 items-center">
                {/* Visual Icon Section (Replaces Image) */}
                <div className={`w-20 h-16 shrink-0 rounded-lg flex items-center justify-center shadow-inner relative overflow-hidden ${colorClass}`}>
                    <div className="absolute inset-0 opacity-20">
                        <Icon size={80} className="absolute -right-4 -bottom-4 transform rotate-12"/>
                    </div>
                    <Icon size={28} className="relative z-10 drop-shadow-sm" strokeWidth={2.5} />
                    
                    {/* Overlay for selection state when not in batch mode */}
                    {isSelected && !isBatchMode && (
                        <div className="absolute inset-0 bg-emerald-900/30 mix-blend-multiply flex items-center justify-center">
                            <Check size={24} className="text-white drop-shadow-md"/>
                        </div>
                    )}
                </div>

                {/* Content Section */}
                <div className="flex-1 flex flex-col justify-between py-0.5 min-w-0 h-full">
                    <div className="flex justify-between items-start w-full">
                         <div className="font-bold text-sm leading-snug truncate pr-2">{topic.titleEn}</div>
                        
                         {/* Selection Checkbox (Batch Mode) */}
                        {isBatchMode && (
                            <div className={`shrink-0 transition-colors ${isChecked ? 'text-blue-600' : 'text-gray-300'}`}>
                                {isChecked ? <CheckSquare size={18} fill="currentColor" className="text-white" /> : <Square size={18} />}
                            </div>
                        )}

                        {/* Action Area (Normal Mode) */}
                        {!isBatchMode && (
                            <div className="flex items-center gap-2 shrink-0">
                                {downloadStatus === 'ready' && (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase flex items-center gap-1 ${isSelected ? 'bg-white/20 text-white' : 'bg-green-100 text-green-600'}`}>
                                        <Check size={10} />
                                    </span>
                                )}
                                
                                {downloadStatus === 'loading' && (
                                    <div className={`p-1 rounded-full ${isSelected ? 'bg-white/20' : 'bg-gray-100'}`}>
                                        <Loader2 size={12} className="animate-spin" />
                                    </div>
                                )}

                                {downloadStatus === 'idle' && (
                                    <div 
                                        onClick={onDownload}
                                        className={`p-1.5 rounded-full hover:scale-110 transition-transform cursor-pointer z-10 relative
                                            ${isSelected ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-gray-100 hover:bg-emerald-100 text-gray-400 hover:text-emerald-600'}
                                        `}
                                        title="Pre-download assets"
                                    >
                                        <CloudDownload size={14} />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    <div className={`text-xs mt-auto truncate ${!isBatchMode && isSelected ? 'text-emerald-100' : 'text-gray-400'}`}>{topic.titleCn}</div>
                </div>
            </div>
        </button>
    );
};

export const LearningSetupScreen: React.FC<Props> = ({ onComplete, onBack }) => {
  const [mode, setMode] = useState<LearningMode>('TOPIC');
  
  // Common State
  const [selectedDuration, setSelectedDuration] = useState<LearningDuration>('LIGHT');
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>('0'); 
  // VoiceType is now DEFAULT 'HQ' and hidden from user selection here
  const [allowBilingual, setAllowBilingual] = useState(false);

  // Topic Mode State
  const [selectedLevel, setSelectedLevel] = useState<string>('A1');
  const [selectedCategory, setSelectedCategory] = useState<'LIFE' | 'BUSINESS'>('LIFE');
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Enterprise Mode State
  const [selectedDepartment, setSelectedDepartment] = useState<string>('Sales');
  const [enterpriseTopics, setEnterpriseTopics] = useState<Topic[]>([]);
  const [enterpriseSearchQuery, setEnterpriseSearchQuery] = useState('');
  const [enterpriseLevel, setEnterpriseLevel] = useState<string>('A1');

  const filteredEnterpriseTopics = useMemo(() => {
      const filtered = enterpriseTopics.filter(t => {
          const matchesSearch = !enterpriseSearchQuery.trim() || 
              t.titleEn.toLowerCase().includes(enterpriseSearchQuery.toLowerCase()) || 
              t.titleCn.includes(enterpriseSearchQuery);
          const matchesLevel = !enterpriseLevel || t.level === enterpriseLevel;
          return matchesSearch && matchesLevel;
      });

      // Split into General and Role Specific
      const general = filtered.filter(t => 
          !t.subDepartment || t.subDepartment.length === 0 || t.subDepartment.includes('General')
      );
      const specific = filtered.filter(t => 
          t.subDepartment && t.subDepartment.length > 0 && !t.subDepartment.includes('General')
      );

      return { general, specific, all: filtered };
  }, [enterpriseTopics, enterpriseSearchQuery, enterpriseLevel]);

  // Batch Selection State
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedBatchIds, setSelectedBatchIds] = useState<Set<string>>(new Set());

  // Download Management
  const [downloadStates, setDownloadStates] = useState<Record<string, 'idle' | 'loading' | 'ready'>>({});
  const [isBatchDownloading, setIsBatchDownloading] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });

  // Custom Mode State
  const [customLevel, setCustomLevel] = useState<string>('');
  const [focusSelect, setFocusSelect] = useState<string>('Business');
  const [customFocusInput, setCustomFocusInput] = useState<string>('');
  const [customFiles, setCustomFiles] = useState<UploadedFile[]>([]);
  const [contextText, setContextText] = useState('');
  const [additionalReq, setAdditionalReq] = useState(''); 
  const [userRoleSelect, setUserRoleSelect] = useState<string>('Student');
  const [userRoleInput, setUserRoleInput] = useState<string>('');
  const [aiRoleSelect, setAiRoleSelect] = useState<string>('Teacher');
  const [aiRoleInput, setAiRoleInput] = useState<string>('');

  const [showBilingualPrompt, setShowBilingualPrompt] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize Cache Check on Mount and Level Change
  useEffect(() => {
      // Check existing cache for displayed topics
      const displayed = TOPICS_DB.filter(t => t.level === selectedLevel);
      const newStates: Record<string, 'idle' | 'loading' | 'ready'> = { ...downloadStates };
      
      displayed.forEach(t => {
          if (isPlanCached(t.id, selectedLevel)) {
              newStates[t.id] = 'ready';
          } else if (!newStates[t.id]) {
              newStates[t.id] = 'idle';
          }
      });
      setDownloadStates(newStates);
  }, [selectedLevel, selectedCategory]);

  // Load Enterprise Courses
  useEffect(() => {
      if (mode === 'ENTERPRISE') {
          const courses = storageService.getEnterpriseCourses(selectedDepartment);
          setEnterpriseTopics(courses);
          // Reset selection when department changes
          setSelectedTopicId('');
      }
  }, [mode, selectedDepartment]);

  const toggleBatchSelection = (id: string) => {
      const next = new Set(selectedBatchIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setSelectedBatchIds(next);
  };

  const handleSelectAll = (topics: Topic[]) => {
      if (selectedBatchIds.size === topics.length) {
          setSelectedBatchIds(new Set()); // Deselect all
      } else {
          setSelectedBatchIds(new Set(topics.map(t => t.id))); // Select all
      }
  };

  const executeBatchDownload = async () => {
      if (selectedBatchIds.size === 0) return;
      
      const targets = TOPICS_DB.filter(t => selectedBatchIds.has(t.id));
      // Filter out ones that are already ready to save time
      const pendingItems = targets.filter(t => !isPlanCached(t.id, selectedLevel));

      if (pendingItems.length === 0) {
          alert("All selected topics are already downloaded! / 选中话题已全部下载完毕！");
          // Update UI states just in case
          const synced = { ...downloadStates };
          targets.forEach(t => synced[t.id] = 'ready');
          setDownloadStates(synced);
          setIsBatchMode(false);
          return;
      }

      setIsBatchDownloading(true);
      setBatchProgress({ current: 0, total: pendingItems.length });
      const avatar = AVATARS.find(a => a.id === selectedAvatarId) || AVATARS[0];

      try {
          for (let i = 0; i < pendingItems.length; i++) {
              const topic = pendingItems[i];
              setDownloadStates(prev => ({ ...prev, [topic.id]: 'loading' }));
              
              try {
                  const config: LearningConfig = {
                      mode: 'TOPIC',
                      level: selectedLevel,
                      duration: selectedDuration,
                      voiceType: 'HQ', // Force HQ for download/preload
                      allowBilingual: allowBilingual,
                      topic: topic
                  };
                  // Generate Plan
                  const plan = await generateLessonPlan(config);
                  
                  // Preload Assets - Add robust error handling to prevent hanging
                  try {
                      await preloadLessonAssets(plan, avatar, () => {});
                  } catch (preloadError) {
                      console.warn(`Asset preload failed for ${topic.id}`, preloadError);
                      // Continue even if audio preload fails, text is still usable
                  }
                  
                  setDownloadStates(prev => ({ ...prev, [topic.id]: 'ready' }));
              } catch (e) {
                  console.error(`Batch item failed: ${topic.id}`, e);
                  setDownloadStates(prev => ({ ...prev, [topic.id]: 'idle' }));
              }
              setBatchProgress(prev => ({ ...prev, current: i + 1 }));
              
              // Small delay to prevent rate limits
              await new Promise(r => setTimeout(r, 100));
          }
          alert("Download Complete! / 下载完成！");
          setIsBatchMode(false); // Exit batch mode on success
          setSelectedBatchIds(new Set());
      } catch (error) {
          console.error("Batch download error", error);
      } finally {
          setIsBatchDownloading(false);
      }
  };

  const handleSingleDownload = async (e: React.MouseEvent, topic: Topic) => {
      e.preventDefault();
      e.stopPropagation(); 
      if (downloadStates[topic.id] === 'loading' || downloadStates[topic.id] === 'ready') return;

      const avatar = AVATARS.find(a => a.id === selectedAvatarId) || AVATARS[0];
      
      setDownloadStates(prev => ({ ...prev, [topic.id]: 'loading' }));
      
      try {
          const config: LearningConfig = {
              mode: 'TOPIC',
              level: selectedLevel,
              duration: selectedDuration,
              voiceType: 'HQ', // Force HQ
              allowBilingual: allowBilingual,
              topic: topic
          };
          const plan = await generateLessonPlan(config);
          await preloadLessonAssets(plan, avatar, () => {});
          setDownloadStates(prev => ({ ...prev, [topic.id]: 'ready' }));
      } catch (err) {
          console.error("Download failed", err);
          setDownloadStates(prev => ({ ...prev, [topic.id]: 'idle' }));
          alert(`Failed to download: ${topic.titleEn}`);
      }
  };

  // Duration Descriptions Map
  const DURATION_DESCRIPTIONS = {
      'LIGHT': {
          title: 'Basic Training & Feedback (基础训练+反馈)',
          detail: '老师会针对话题进行标准口语训练，并提供针对性反馈，帮助您快速热身并提高英语水平。'
      },
      'STANDARD': {
          title: 'Deep Dive & Expansion (追问拓展)',
          detail: '在基础问答之上，老师会根据您的回答进行“追问”和“衍生讨论”，引导您多角度思考，重点提升流利度与逻辑性。'
      },
      'DEEP': {
          title: 'Closed-Loop Learning (教学闭环)',
          detail: '采用“知识输入 -> 强迫输出 -> 纠正反馈”的深度闭环模式。老师不仅陪练，还会教授新知识并要求即学即用，确保深度掌握。'
      }
  };

  // Calculate Total Topics for badges
  const totalLifeTopics = useMemo(() => TOPICS_DB.filter(t => t.category === 'LIFE').length, []);
  const totalBusinessTopics = useMemo(() => TOPICS_DB.filter(t => t.category === 'BUSINESS').length, []);

  // Determine available categories for the selected level
  const hasLifeTopics = useMemo(() => {
      return TOPICS_DB.some(t => t.level === selectedLevel && t.category === 'LIFE');
  }, [selectedLevel]);

  const hasBusinessTopics = useMemo(() => {
      return TOPICS_DB.some(t => t.level === selectedLevel && t.category === 'BUSINESS');
  }, [selectedLevel]);

  // Automatically switch category if the selected one is not available
  useEffect(() => {
      if (selectedCategory === 'BUSINESS' && !hasBusinessTopics && hasLifeTopics) {
          setSelectedCategory('LIFE');
      } else if (selectedCategory === 'LIFE' && !hasLifeTopics && hasBusinessTopics) {
          setSelectedCategory('BUSINESS');
      }
  }, [selectedLevel, hasBusinessTopics, hasLifeTopics, selectedCategory]);

  // UPDATED: Concept Cluster Search Logic (Comprehensive)
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    
    const q = searchQuery.toLowerCase().trim();
    const direct: Topic[] = [];
    const related: Topic[] = [];

    // Concept Clusters: Mapping core concepts to their extended ecosystem
    const semanticMap: Record<string, string[]> = {
        'intro': ['greet', 'hello', 'meet', 'name', 'myself', 'introduce', 'welcome', 'hi'],
        'share': ['tell', 'story', 'experience', 'memory', 'happen', 'describe'],
        'family': ['parent', 'child', 'kid', 'dad', 'mom', 'brother', 'sister', 'relative', 'home', 'marriage', 'wedding'],
        'food': ['eat', 'drink', 'meal', 'cook', 'restaurant', 'diet', 'snack', 'lunch', 'dinner', 'breakfast', 'cuisine', 'dish', 'fridge'],
        'clothing': ['wear', 'fashion', 'outfit', 'dress', 'shoe', 'shirt', 'shopping', 'style', 'bag'],
        'travel': ['trip', 'holiday', 'vacation', 'flight', 'hotel', 'tour', 'visit', 'abroad', 'journey', 'airport', 'ticket', 'sightseeing'],
        'social': ['friend', 'party', 'chat', 'network', 'communicate', 'relationship', 'date', 'dating'],
        'shopping': ['buy', 'purchase', 'mall', 'store', 'brand', 'gift', 'price', 'cost'],
        'sport': ['exercise', 'gym', 'run', 'swim', 'fitness', 'game', 'match', 'play', 'ball'],
        'tech': ['digital', 'computer', 'phone', 'app', 'software', 'ai', 'internet', 'online', 'smart', 'privacy', 'security'],
        'pet': ['dog', 'cat', 'animal', 'bird'],
        'psychology': ['mind', 'stress', 'feel', 'emotion', 'mental', 'think', 'brain', 'anxiety', 'happiness', 'personality'],
        'meeting': ['discuss', 'agenda', 'conference', 'room', 'host', 'participant', 'arrange'],
        'negotiation': ['deal', 'agree', 'contract', 'offer', 'price', 'bargain', 'conflict'],
        'presentation': ['speech', 'talk', 'slide', 'present', 'public speaking', 'report'],
        'email': ['write', 'message', 'reply', 'send'],
        'culture': ['custom', 'tradition', 'manner', 'polite', 'country', 'international', 'etiquette'],
        'leadership': ['manager', 'boss', 'lead', 'team', 'manage', 'executive', 'ceo'],
        'global': ['international', 'world', 'abroad', 'foreign', 'cross-border', 'trade'],
        'finance': ['money', 'budget', 'cost', 'profit', 'investment', 'economy', 'tax', 'bank'],
        'sales': ['sell', 'customer', 'client', 'product', 'promote', 'service'],
        'hr': ['recruit', 'interview', 'job', 'hire', 'resume', 'candidate', 'work', 'career', 'employee', 'colleague'],
        'marketing': ['brand', 'advertise', 'promote', 'market', 'campaign'],
        'management': ['strategy', 'plan', 'organize', 'project', 'decision', 'problem', 'risk', 'crisis']
    };

    // 1. Direct Search
    TOPICS_DB.forEach(t => {
        const titleEn = t.titleEn.toLowerCase();
        const titleCn = t.titleCn; 
        if (titleEn.includes(q) || titleCn.includes(q)) {
            direct.push(t);
        }
    });

    // 2. Associative Search (Fuzzy Concept Matching)
    const relatedKeywords: string[] = [];
    Object.entries(semanticMap).forEach(([key, synonyms]) => {
        if (key.includes(q) || synonyms.some(s => s.includes(q))) {
            relatedKeywords.push(...synonyms);
            relatedKeywords.push(key);
        }
    });

    if (relatedKeywords.length > 0) {
        TOPICS_DB.forEach(t => {
            if (direct.includes(t)) return;
            const content = (t.titleEn + ' ' + t.titleCn).toLowerCase();
            const isRelated = relatedKeywords.some(k => content.includes(k));
            if (isRelated) {
                related.push(t);
            }
        });
    }

    return { direct, related };
  }, [searchQuery]);

  const displayedTopics = !searchQuery.trim() 
    ? TOPICS_DB.filter(t => t.level === selectedLevel && t.category === selectedCategory)
    : []; 

  const effectiveLevel = mode === 'TOPIC' ? selectedLevel : customLevel;
  const isBeginner = ['PreA1', 'A1'].includes(effectiveLevel);
  // Show toggle if user is beginner OR if in Custom Mode (user choice)
  const showBilingualToggle = isBeginner || mode === 'CUSTOM';

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
          setCustomFiles(prev => [...prev, newFile]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const switchToCustomWithQuery = () => {
      setMode('CUSTOM');
      setContextText(`I want to practice talking about: ${searchQuery}`);
      if (selectedLevel) setCustomLevel(selectedLevel);
      if (selectedCategory === 'BUSINESS') setFocusSelect('Business');
      else setFocusSelect('Daily Life');
      setSearchQuery('');
  };

  const proceedWithStart = (overrideBilingual?: boolean) => {
    const avatar = AVATARS.find(a => a.id === selectedAvatarId);
    if (!avatar) return;

    const finalBilingual = overrideBilingual !== undefined ? overrideBilingual : allowBilingual;

    if (mode === 'TOPIC' || mode === 'ENTERPRISE') {
        const topic = mode === 'TOPIC' 
            ? TOPICS_DB.find(t => t.id === selectedTopicId)
            : enterpriseTopics.find(t => t.id === selectedTopicId);
            
        voiceService.ensureAudioContext();
        onComplete({
            mode: mode,
            level: topic?.level || selectedLevel,
            duration: selectedDuration,
            voiceType: 'HQ', // Enforce HQ
            allowBilingual: finalBilingual,
            topic: topic
        }, avatar);
    } else {
        const finalFocus = focusSelect === 'OTHER' ? customFocusInput : focusSelect;
        const finalUserRole = userRoleSelect === 'OTHER' ? userRoleInput : userRoleSelect;
        const finalAiRole = aiRoleSelect === 'OTHER' ? aiRoleInput : aiRoleSelect;

        voiceService.ensureAudioContext();
        onComplete({
            mode: 'CUSTOM',
            level: customLevel,
            duration: selectedDuration,
            voiceType: 'HQ', // Enforce HQ
            allowBilingual: finalBilingual,
            customContext: {
                files: customFiles,
                contextText,
                focusArea: finalFocus || 'General',
                userRole: finalUserRole || 'Student',
                aiRole: finalAiRole || 'Teacher',
                additionalRequirements: additionalReq
            }
        }, avatar);
    }
  };

  const handleStartClick = () => {
      // Validation first
      if ((mode === 'TOPIC' || mode === 'ENTERPRISE') && !selectedTopicId) {
          alert("Please select a topic/course. / 请选择一个话题或课程。");
          return;
      }
      if (mode === 'CUSTOM') {
          if (!customLevel) {
              alert("Please select a CEFR level. / 请选择CEFR等级。");
              return;
          }
          const finalFocus = focusSelect === 'OTHER' ? customFocusInput : focusSelect;
          if (!finalFocus) {
               alert("Please specify a Focus Area. / 请指定练习方向。");
               return;
          }
          if (customFiles.length === 0 && contextText.trim().length === 0) {
              alert("Please provide some content (upload file or text). / 请上传文件或输入文本。");
              return;
          }
      }

      const avatar = AVATARS.find(a => a.id === selectedAvatarId);
      if (!avatar) return;

      // Check for Bilingual Prompt condition
      // Condition: Level is PreA1 or A1, AND Bilingual isn't already enabled
      if (isBeginner && !allowBilingual) {
          setShowBilingualPrompt(true);
      } else {
          proceedWithStart();
      }
  };

  const handleBilingualPromptResponse = (enable: boolean) => {
      setShowBilingualPrompt(false);
      proceedWithStart(enable);
  };

  const getTutorDescription = (tagline: string) => {
      return tagline.replace(/^LEVEL: [^.]+\.\s*/, '');
  };

  // Helper to get selected avatar details safely
  const currentAvatar = AVATARS.find(a => a.id === selectedAvatarId);
  const tutorDesc = currentAvatar ? getTutorDescription(currentAvatar.selectionTagline) : '';
  const [descEn, descCn] = tutorDesc.split(' / ');

  return (
    <div className="min-h-screen bg-emerald-50/50 p-4 lg:p-8 flex items-center justify-center relative">
        
        {/* Floating Batch Download Bar */}
        {isBatchMode && selectedBatchIds.size > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-gray-900/90 backdrop-blur text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-4 border border-gray-700 animate-slideUp">
                <div className="text-sm font-bold text-gray-300">
                    {selectedBatchIds.size} Selected
                </div>
                <div className="h-4 w-px bg-gray-600"></div>
                <button 
                    onClick={executeBatchDownload}
                    disabled={isBatchDownloading}
                    className="flex items-center gap-2 font-bold text-white hover:text-emerald-400 transition-colors"
                >
                    {isBatchDownloading ? (
                        <><Loader2 size={18} className="animate-spin" /> {batchProgress.current}/{batchProgress.total} Downloading...</>
                    ) : (
                        <><CloudDownload size={18} /> Download {selectedBatchIds.size} Items</>
                    )}
                </button>
            </div>
        )}

        {/* Bilingual Support Prompt Modal */}
        {showBilingualPrompt && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-emerald-900/40 backdrop-blur-sm animate-fadeIn">
                <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-white transform scale-100 animate-slideUp">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 mx-auto bg-emerald-100 text-emerald-600">
                        <MessageCircleQuestion size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 text-center mb-2">Enable Bilingual Support?</h3>
                    <p className="text-gray-600 text-center text-sm leading-relaxed mb-6">
                        For Beginner levels (PreA1-A1), the tutor can use Chinese to help explain concepts.
                        <br/>
                        <span className="text-xs font-bold text-emerald-600 block mt-2">是否开启双语辅助？导师将使用中文协助教学。</span>
                    </p>
                    <div className="flex flex-col gap-3">
                        <button 
                            onClick={() => handleBilingualPromptResponse(true)} 
                            className="w-full px-6 py-3.5 rounded-xl text-white font-bold bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2"
                        >
                            <Check size={18} /> Yes, Enable (开启)
                        </button>
                        <button 
                            onClick={() => handleBilingualPromptResponse(false)} 
                            className="w-full px-6 py-3.5 rounded-xl border-2 border-gray-100 text-gray-500 font-bold hover:bg-gray-50 transition-all"
                        >
                            No, English Only (暂不需要)
                        </button>
                    </div>
                </div>
            </div>
        )}

        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col min-h-[700px] border border-gray-100">
            
            {/* Header - Optimized for Mobile (Column Layout) */}
            <div className="bg-emerald-600 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-white shadow-md z-20">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <button onClick={onBack} className="p-2 hover:bg-white/20 rounded-full transition-colors"><ArrowLeft/></button>
                    <div>
                        <h1 className="text-2xl font-bold">Learning Setup</h1>
                        <p className="text-emerald-100 text-sm">Configure your practice session / 配置您的练习</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-3 w-full md:w-auto">
                     <button 
                        onClick={clearLessonPlanCache}
                        className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-emerald-100 text-xs font-bold flex items-center gap-1 transition-colors border border-emerald-600"
                        title="Clear stored lesson plans"
                     >
                        <Trash2 size={12}/> Clear Cache
                     </button>
                     <div className="flex bg-emerald-800/50 p-1 rounded-lg flex-1 md:flex-none">
                        <button 
                            onClick={() => setMode('TOPIC')}
                            className={`flex-1 md:flex-none px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center justify-center gap-2 ${mode === 'TOPIC' ? 'bg-white text-emerald-700 shadow-sm' : 'text-emerald-100 hover:bg-white/10'}`}
                        >
                            <BookOpen size={16}/> Topic Course / 核心话题
                        </button>
                        <button 
                            onClick={() => setMode('CUSTOM')}
                            className={`flex-1 md:flex-none px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center justify-center gap-2 ${mode === 'CUSTOM' ? 'bg-white text-emerald-700 shadow-sm' : 'text-emerald-100 hover:bg-white/10'}`}
                        >
                            <PenTool size={16}/> Custom / 定制
                        </button>
                        <button 
                            onClick={() => setMode('ENTERPRISE')}
                            className={`flex-1 md:flex-none px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center justify-center gap-2 ${mode === 'ENTERPRISE' ? 'bg-white text-emerald-700 shadow-sm' : 'text-emerald-100 hover:bg-white/10'}`}
                        >
                            <Building2 size={16}/> Enterprise / 部门
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
                {/* Left: Main Configuration */}
                <div className="flex-1 p-8 overflow-y-auto bg-gray-50/50">
                    
                    {/* Mode Specific Content */}
                    {mode === 'ENTERPRISE' ? (
                        <div className="space-y-6 animate-fadeIn">
                             {/* Department Selector */}
                             <div className="bg-white p-5 rounded-2xl border border-indigo-100 shadow-sm">
                                <label className="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <Building2 size={14}/> Select Department / 选择部门
                                </label>
                                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                    {['Sales', 'R&D', 'HR', 'Management'].map(dept => (
                                        <button
                                            key={dept}
                                            onClick={() => setSelectedDepartment(dept)}
                                            className={`px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all border shadow-sm
                                                ${selectedDepartment === dept 
                                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-200' 
                                                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'}
                                            `}
                                        >
                                            {dept}
                                        </button>
                                    ))}
                                </div>
                             </div>

                             {/* Search Bar */}
                             <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input 
                                    type="text" 
                                    value={enterpriseSearchQuery}
                                    onChange={(e) => setEnterpriseSearchQuery(e.target.value)}
                                    placeholder="Search courses / 搜索课程"
                                    className="w-full pl-11 pr-10 py-3 bg-white border border-gray-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all shadow-sm"
                                />
                                {enterpriseSearchQuery && (
                                    <button 
                                        onClick={() => setEnterpriseSearchQuery('')}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 bg-gray-200 hover:bg-gray-300 rounded-full text-gray-600 transition-colors"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                             </div>

                             {/* Level Selector */}
                             <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700">Select Level / 选择等级</label>
                                <div className="flex flex-wrap gap-2">
                                    {CEFR_LEVELS.map(lvl => (
                                        <button 
                                            key={lvl}
                                            onClick={() => { setEnterpriseLevel(lvl); setSelectedTopicId(''); }}
                                            className={`px-4 py-2 rounded-lg text-sm font-bold border transition-all ${enterpriseLevel === lvl ? 'bg-indigo-100 border-indigo-500 text-indigo-800' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                        >
                                            {lvl}
                                        </button>
                                    ))}
                                </div>
                             </div>

                             {/* Course Grid */}
                             <div className="space-y-8">
                                {/* General Courses */}
                                {filteredEnterpriseTopics.general.length > 0 && (
                                    <div>
                                        <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                                            <BriefcaseBusiness size={16}/> General Courses / 通用课程 ({filteredEnterpriseTopics.general.length})
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {filteredEnterpriseTopics.general.map(t => (
                                                <TopicCard 
                                                    key={t.id} 
                                                    topic={t} 
                                                    isSelected={selectedTopicId === t.id} 
                                                    searchQuery={enterpriseSearchQuery} 
                                                    onSelect={setSelectedTopicId} 
                                                    downloadStatus={downloadStates[t.id] || 'idle'}
                                                    onDownload={(e) => handleSingleDownload(e, t)}
                                                    isBatchMode={false}
                                                    isChecked={false}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Role Specific Courses */}
                                {filteredEnterpriseTopics.specific.length > 0 && (
                                    <div>
                                        <h3 className="text-sm font-bold text-indigo-700 mb-4 flex items-center gap-2">
                                            <Target size={16}/> Role Specific / 岗位定制 ({filteredEnterpriseTopics.specific.length})
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {filteredEnterpriseTopics.specific.map(t => (
                                                <TopicCard 
                                                    key={t.id} 
                                                    topic={t} 
                                                    isSelected={selectedTopicId === t.id} 
                                                    searchQuery={enterpriseSearchQuery} 
                                                    onSelect={setSelectedTopicId} 
                                                    downloadStatus={downloadStates[t.id] || 'idle'}
                                                    onDownload={(e) => handleSingleDownload(e, t)}
                                                    isBatchMode={false}
                                                    isChecked={false}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {filteredEnterpriseTopics.all.length === 0 && (
                                    <div className="col-span-2 py-16 text-center bg-white rounded-2xl border border-dashed border-gray-300 flex flex-col items-center justify-center">
                                        <div className="bg-gray-50 p-4 rounded-full mb-3">
                                            <Building2 size={32} className="text-gray-300"/>
                                        </div>
                                        <p className="text-gray-500 font-medium">No courses found matching criteria.</p>
                                        <p className="text-xs text-gray-400 mt-1">未找到匹配的课程</p>
                                    </div>
                                )}
                             </div>
                        </div>
                    ) : mode === 'TOPIC' ? (
                        <div className="space-y-6 animate-fadeIn">
                             {/* Search Bar */}
                             <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input 
                                    type="text" 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search specific topics / 搜索特定话题 (e.g. Swimming, Eating)"
                                    className="w-full pl-11 pr-10 py-3 bg-white border border-gray-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all shadow-sm"
                                />
                                {searchQuery && (
                                    <button 
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 bg-gray-200 hover:bg-gray-300 rounded-full text-gray-600 transition-colors"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                             </div>

                             {/* Popular Tags (Quick Filters) */}
                             {!searchQuery && (
                                <div className="space-y-3">
                                    <div className="flex items-start gap-2">
                                        <div className="bg-orange-100 text-orange-700 p-1.5 rounded-lg shrink-0 mt-0.5"><Tag size={12}/></div>
                                        <div className="flex flex-wrap gap-2">
                                            {HOT_TAGS.filter(t => t.type === 'LIFE').map((tag, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => { setSearchQuery(tag.query); setSelectedCategory('LIFE'); }}
                                                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-orange-50 text-orange-700 border border-orange-100 hover:bg-orange-100 hover:border-orange-200 transition-all"
                                                >
                                                    {tag.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <div className="bg-blue-100 text-blue-700 p-1.5 rounded-lg shrink-0 mt-0.5"><Briefcase size={12}/></div>
                                        <div className="flex flex-wrap gap-2">
                                            {HOT_TAGS.filter(t => t.type === 'BUSINESS').map((tag, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => { setSearchQuery(tag.query); setSelectedCategory('BUSINESS'); }}
                                                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100 hover:border-blue-200 transition-all"
                                                >
                                                    {tag.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                             )}

                             {/* Filters (Hidden when searching to reduce clutter) */}
                             <div className={`space-y-6 transition-all ${searchQuery ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                                 <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700">1. Select Level / 选择等级</label>
                                    <div className="flex flex-wrap gap-2">
                                        {CEFR_LEVELS.map(lvl => (
                                            <button 
                                                key={lvl}
                                                onClick={() => { setSelectedLevel(lvl); setSelectedTopicId(''); }}
                                                className={`px-4 py-2 rounded-lg text-sm font-bold border transition-all ${selectedLevel === lvl ? 'bg-emerald-100 border-emerald-500 text-emerald-800' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                            >
                                                {lvl}
                                            </button>
                                        ))}
                                    </div>
                                 </div>

                                 <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700">2. Select Domain / 选择领域</label>
                                    <div className="flex gap-4">
                                        {hasLifeTopics && (
                                            <button onClick={() => setSelectedCategory('LIFE')} className={`flex-1 p-4 rounded-xl border-2 flex items-center justify-center gap-2 font-bold transition-all ${selectedCategory === 'LIFE' ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-gray-100 bg-white hover:bg-gray-50'}`}>
                                                <User size={20}/> Life / 生活
                                                <span className="text-xs bg-orange-200 text-orange-800 px-1.5 py-0.5 rounded-md ml-1">{totalLifeTopics}</span>
                                            </button>
                                        )}
                                        {hasBusinessTopics && (
                                            <button onClick={() => setSelectedCategory('BUSINESS')} className={`flex-1 p-4 rounded-xl border-2 flex items-center justify-center gap-2 font-bold transition-all ${selectedCategory === 'BUSINESS' ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-gray-100 bg-white hover:bg-gray-50'}`}>
                                                <Briefcase size={20}/> Business / 商务
                                                <span className="text-xs bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded-md ml-1">{totalBusinessTopics}</span>
                                            </button>
                                        )}
                                    </div>
                                 </div>
                             </div>

                             <div className="space-y-2">
                                {/* Header for Topic Selection / Search Results */}
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                        {searchQuery ? `Search Results (${searchResults?.direct.length + searchResults?.related.length})` : `3. Select Topic (${displayedTopics.length})`}
                                    </label>
                                    
                                    {/* BATCH DOWNLOAD BUTTON */}
                                    {!searchQuery && displayedTopics.length > 0 && (
                                        <div className="flex items-center gap-2">
                                            {isBatchMode && (
                                                <button 
                                                    onClick={() => handleSelectAll(displayedTopics)}
                                                    className="text-[10px] font-bold text-blue-600 hover:text-blue-800 px-2 py-1 bg-blue-50 rounded-md transition-colors"
                                                >
                                                    {selectedBatchIds.size === displayedTopics.length ? "Deselect All" : "Select All"}
                                                </button>
                                            )}
                                            <button 
                                                onClick={() => { setIsBatchMode(!isBatchMode); setSelectedBatchIds(new Set()); }}
                                                className={`flex items-center gap-1 text-[10px] px-3 py-1.5 rounded-full font-bold transition-all border
                                                    ${isBatchMode 
                                                        ? 'bg-blue-100 text-blue-800 border-blue-200' 
                                                        : 'bg-white hover:bg-gray-50 text-gray-600 border-gray-200'}
                                                `}
                                            >
                                                <ListChecks size={14} /> {isBatchMode ? "Exit Batch Mode / 退出批量" : "Batch Select / 批量选择"}
                                            </button>
                                        </div>
                                    )}

                                    {/* Back to Tags Button (Visible only when searching) */}
                                    {searchQuery && (
                                        <button 
                                            onClick={() => setSearchQuery('')}
                                            className="text-xs font-bold text-emerald-600 hover:text-emerald-800 flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-md transition-colors"
                                        >
                                            <ArrowLeft size={12}/> Back to All Tags
                                        </button>
                                    )}
                                </div>

                                <div className="max-h-[350px] overflow-y-auto pr-2 space-y-6">
                                    {searchQuery && searchResults ? (
                                        <>
                                            {searchResults.direct.length > 0 && (
                                                <div>
                                                    <h3 className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-2 flex items-center gap-1"><Check size={12}/> Direct Matches / 直接匹配</h3>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                        {searchResults.direct.map(t => (
                                                            <TopicCard 
                                                                key={t.id} 
                                                                topic={t} 
                                                                isSelected={selectedTopicId === t.id} 
                                                                searchQuery={searchQuery} 
                                                                onSelect={setSelectedTopicId} 
                                                                downloadStatus={downloadStates[t.id] || 'idle'}
                                                                onDownload={(e) => handleSingleDownload(e, t)}
                                                                isBatchMode={false}
                                                                isChecked={false}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {searchResults.related.length > 0 && (
                                                <div>
                                                    <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-2 flex items-center gap-1"><Sparkles size={12}/> Related Topics / 相关话题</h3>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                        {searchResults.related.map(t => (
                                                            <TopicCard 
                                                                key={t.id} 
                                                                topic={t} 
                                                                isSelected={selectedTopicId === t.id} 
                                                                searchQuery={searchQuery} 
                                                                onSelect={setSelectedTopicId} 
                                                                downloadStatus={downloadStates[t.id] || 'idle'}
                                                                onDownload={(e) => handleSingleDownload(e, t)}
                                                                isBatchMode={false}
                                                                isChecked={false}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {searchResults.direct.length === 0 && searchResults.related.length === 0 && (
                                                <div className="text-center py-8 bg-white rounded-2xl border border-dashed border-gray-300">
                                                     <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-500"><Search size={24}/></div>
                                                     <p className="text-gray-900 font-bold mb-1">No topics found for "{searchQuery}"</p>
                                                     <button onClick={switchToCustomWithQuery} className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors flex items-center gap-2 mx-auto shadow-md mt-4"><PenTool size={16}/> Practice "{searchQuery}" in Custom Mode</button>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {displayedTopics.map(t => (
                                                <TopicCard 
                                                    key={t.id} 
                                                    topic={t} 
                                                    isSelected={selectedTopicId === t.id} 
                                                    searchQuery={searchQuery} 
                                                    onSelect={isBatchMode ? toggleBatchSelection : setSelectedTopicId}
                                                    downloadStatus={downloadStates[t.id] || 'idle'}
                                                    onDownload={(e) => handleSingleDownload(e, t)}
                                                    isBatchMode={isBatchMode}
                                                    isChecked={selectedBatchIds.has(t.id)}
                                                />
                                            ))}
                                            {displayedTopics.length === 0 && (
                                                <div className="col-span-2 text-center py-12 text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">No topics found for this selection.</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                             </div>
                        </div>
                    ) : (
                        <div className="space-y-8 animate-fadeIn">
                            {/* Block 1: Goal & Direction */}
                            <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-3 opacity-10">
                                    <Target size={100} className="text-blue-500" />
                                </div>
                                <h3 className="text-sm font-bold text-blue-800 uppercase tracking-wide mb-4 flex items-center gap-2">
                                    <LayoutTemplate size={16}/> 1. Goal & Direction / 目标设定
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                                    <div>
                                        <label className="block text-xs font-bold text-blue-700 mb-2">Target Level / 目标等级</label>
                                        <select value={customLevel} onChange={e => setCustomLevel(e.target.value)} className="w-full p-3 bg-white border border-blue-200 rounded-xl focus:border-blue-500 outline-none text-gray-700 font-medium shadow-sm transition-all hover:border-blue-300">
                                            <option value="">Select CEFR Level... / 选择等级...</option>
                                            {CEFR_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-blue-700 mb-2">Focus Area / 练习方向</label>
                                        <div className="flex flex-col gap-2">
                                            <select value={focusSelect} onChange={e => setFocusSelect(e.target.value)} className="w-full p-3 bg-white border border-blue-200 rounded-xl focus:border-blue-500 outline-none text-gray-700 font-medium shadow-sm transition-all hover:border-blue-300">
                                                {FOCUS_OPTIONS.map(opt => (
                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                ))}
                                                <option value="OTHER">Other / 自定义...</option>
                                            </select>
                                            {focusSelect === 'OTHER' && (
                                                <input 
                                                    type="text" 
                                                    value={customFocusInput} 
                                                    onChange={e => setCustomFocusInput(e.target.value)}
                                                    className="w-full p-3 bg-blue-50 border border-blue-200 rounded-xl outline-none focus:border-blue-500 text-blue-800 placeholder-blue-400" 
                                                    placeholder="Enter custom focus... / 输入自定义方向..."
                                                />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Block 2: Roles */}
                            <div className="bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-3 opacity-10">
                                    <BriefcaseBusiness size={100} className="text-indigo-500" />
                                </div>
                                <h3 className="text-sm font-bold text-indigo-800 uppercase tracking-wide mb-4 flex items-center gap-2">
                                    <User size={16}/> 2. Role Play / 角色设定
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                                    <div>
                                        <label className="block text-xs font-bold text-indigo-700 mb-2">Your Role / 你的角色</label>
                                        <div className="flex flex-col gap-2">
                                            <select value={userRoleSelect} onChange={e => setUserRoleSelect(e.target.value)} className="w-full p-3 bg-white border border-indigo-200 rounded-xl focus:border-indigo-500 outline-none text-gray-700 font-medium shadow-sm transition-all hover:border-indigo-300">
                                                {ROLE_OPTIONS.map(opt => (
                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                ))}
                                                <option value="OTHER">Custom Role / 自定义角色...</option>
                                            </select>
                                            {userRoleSelect === 'OTHER' && (
                                                <input 
                                                    type="text" 
                                                    value={userRoleInput} 
                                                    onChange={e => setUserRoleInput(e.target.value)} 
                                                    className="w-full p-3 bg-indigo-50 border border-indigo-200 rounded-xl outline-none focus:border-indigo-500 text-indigo-800 placeholder-indigo-400" 
                                                    placeholder="e.g. Project Manager / 例如：项目经理" 
                                                />
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-indigo-700 mb-2">AI Role / AI角色</label>
                                        <div className="flex flex-col gap-2">
                                            <select value={aiRoleSelect} onChange={e => setAiRoleSelect(e.target.value)} className="w-full p-3 bg-white border border-indigo-200 rounded-xl focus:border-indigo-500 outline-none text-gray-700 font-medium shadow-sm transition-all hover:border-indigo-300">
                                                {ROLE_OPTIONS.map(opt => (
                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                ))}
                                                <option value="OTHER">Custom Role / 自定义角色...</option>
                                            </select>
                                            {aiRoleSelect === 'OTHER' && (
                                                <input 
                                                    type="text" 
                                                    value={aiRoleInput} 
                                                    onChange={e => setAiRoleInput(e.target.value)} 
                                                    className="w-full p-3 bg-indigo-50 border border-indigo-200 rounded-xl outline-none focus:border-indigo-500 text-indigo-800 placeholder-indigo-400" 
                                                    placeholder="e.g. Dissatisfied Client / 例如：不满意的客户" 
                                                />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Block 3: Content & Context */}
                            <div className="bg-emerald-50/50 p-6 rounded-2xl border border-emerald-100 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-3 opacity-10">
                                    <LibraryBig size={100} className="text-emerald-500" />
                                </div>
                                <h3 className="text-sm font-bold text-emerald-800 uppercase tracking-wide mb-4 flex items-center gap-2">
                                    <FileText size={16}/> 3. Content & Context / 内容输入
                                </h3>
                                <div className="relative z-10 space-y-6">
                                    <div>
                                        <label className="block text-xs font-bold text-emerald-700 mb-2">Upload Materials (Optional) / 上传资料</label>
                                        <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-emerald-200 bg-white rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-emerald-50 hover:border-emerald-300 transition-all group">
                                            <div className="bg-emerald-50 p-3 rounded-full mb-2 group-hover:bg-white transition-colors">
                                                <Upload className="text-emerald-500"/>
                                            </div>
                                            <span className="text-sm text-emerald-700 font-medium">Click to upload PDF, Image, Excel, Word / 点击上传文件</span>
                                            <span className="text-[10px] text-emerald-400 mt-1">Supports multi-file upload / 支持多文件</span>
                                            <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileUpload} accept=".pdf,.doc,.docx,.xlsx,.jpg,.png" />
                                        </div>
                                        {customFiles.length > 0 && (
                                            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                                                {customFiles.map((f, i) => (
                                                    <div key={i} className="flex items-center justify-between bg-white border border-emerald-100 p-2.5 rounded-lg text-sm text-emerald-800 shadow-sm">
                                                        <div className="flex items-center gap-2 overflow-hidden">
                                                            <FileText size={14} className="text-emerald-500 shrink-0"/>
                                                            <span className="truncate">{f.name}</span>
                                                        </div>
                                                        <button onClick={() => setCustomFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-emerald-400 hover:text-red-500 transition-colors"><X size={14}/></button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-xs font-bold text-emerald-700 mb-2">Context Text / 文本背景</label>
                                            <textarea value={contextText} onChange={e => setContextText(e.target.value)} className="w-full p-3 bg-white border border-emerald-200 rounded-xl outline-none focus:border-emerald-500 h-28 resize-none shadow-sm text-sm" placeholder="Paste job description, article text, or specific scenario details here... / 在此粘贴职位描述、文章文本或具体场景细节..." />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-emerald-700 mb-2">Extra Requirements / 补充要求</label>
                                            <textarea value={additionalReq} onChange={e => setAdditionalReq(e.target.value)} className="w-full p-3 bg-white border border-emerald-200 rounded-xl outline-none focus:border-emerald-500 h-28 resize-none shadow-sm text-sm" placeholder="e.g. Focus on correcting grammar... / 例如：专注于纠正语法，或增加对话压力..." />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right: Common Settings (Sidebar) */}
                <div className="w-full lg:w-80 bg-white border-l border-gray-100 p-6 flex flex-col overflow-y-auto shadow-[-4px_0_20px_rgba(0,0,0,0.02)] z-10">
                    <div className="mb-6">
                        <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-4"><Clock size={16}/> Session Duration / 练习时长</label>
                        <div className="flex flex-col gap-3">
                            <DurationCard 
                                val="LIGHT" 
                                label="8 Mins" 
                                desc="Light / 轻量"
                                turns="~12 Turns" 
                                isSelected={selectedDuration === 'LIGHT'} 
                                onSelect={setSelectedDuration} 
                            />
                            <DurationCard 
                                val="STANDARD" 
                                label="15 Mins" 
                                desc="Standard / 标准"
                                turns="~20 Turns" 
                                isSelected={selectedDuration === 'STANDARD'} 
                                onSelect={setSelectedDuration} 
                            />
                            <DurationCard 
                                val="DEEP" 
                                label="25 Mins" 
                                desc="Deep / 深度"
                                turns="~30 Turns" 
                                isSelected={selectedDuration === 'DEEP'} 
                                onSelect={setSelectedDuration} 
                            />
                        </div>
                        {/* Core Explanation Box */}
                        <div className="mt-3 bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 text-xs text-gray-600 animate-fadeIn transition-all">
                            <div className="flex items-center gap-2 mb-1 text-emerald-800 font-bold uppercase tracking-wider">
                                <Zap size={12}/>
                                <span>{DURATION_DESCRIPTIONS[selectedDuration].title}</span>
                            </div>
                            <p className="leading-relaxed opacity-90 text-[11px]">
                                {DURATION_DESCRIPTIONS[selectedDuration].detail}
                            </p>
                        </div>
                    </div>

                    {/* Avatar Selection */}
                    <div className="mb-4 flex-1">
                        <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-4"><User size={16}/> Choose Tutor / 选择导师</label>
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            {AVATARS.map(avatar => {
                                const [engPersona, cnPersona] = avatar.personality.split(' / ');
                                return (
                                    <button 
                                        key={avatar.id}
                                        onClick={() => setSelectedAvatarId(avatar.id)}
                                        className={`relative p-2 rounded-xl border-2 text-center transition-all group overflow-hidden ${selectedAvatarId === avatar.id ? 'border-emerald-500 bg-white shadow-md scale-105' : 'border-transparent hover:bg-gray-50'}`}
                                    >
                                        <img src={avatar.avatarUrl} className="w-12 h-12 rounded-full mx-auto mb-2 object-cover"/>
                                        <div className="text-xs font-bold truncate">{avatar.name}</div>
                                        <div className="flex flex-col gap-0.5 mt-1">
                                            <div className="text-[9px] text-gray-600 truncate px-1">{engPersona}</div>
                                            <div className="text-[8px] text-gray-400 truncate px-1">{cnPersona || ''}</div>
                                        </div>
                                        {selectedAvatarId === avatar.id && <div className="absolute top-1 right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white z-10"></div>}
                                    </button>
                                );
                            })}
                        </div>
                        {/* Tutor Description Box */}
                        <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-100 shadow-sm text-xs leading-relaxed animate-fadeIn">
                            <div className="mb-2">
                                <span className="block font-bold text-emerald-700">Tutor Style / 风格与建议:</span>
                            </div>
                            {currentAvatar ? (
                                <div>
                                    <p className="text-gray-800 font-medium mb-1">{descEn}</p>
                                    <p className="text-gray-500">{descCn}</p>
                                </div>
                            ) : (
                                <span className="text-gray-400">Select a tutor to see details. / 请选择导师查看详情。</span>
                            )}
                        </div>
                    </div>

                    {/* Bilingual Toggle */}
                    {(isBeginner || mode === 'CUSTOM') && (
                        <div className="mb-8 p-3 bg-emerald-50 rounded-xl border border-emerald-200 animate-fadeIn">
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-xs font-bold text-emerald-800 flex items-center gap-1"><Globe size={14}/> Bilingual Support</label>
                                <button onClick={() => setAllowBilingual(!allowBilingual)} className="text-emerald-600 hover:text-emerald-800 transition-colors">
                                    {allowBilingual ? <ToggleRight size={28} fill="currentColor" /> : <ToggleLeft size={28} className="text-gray-400"/>}
                                </button>
                            </div>
                            <p className="text-[10px] text-emerald-600 leading-tight">
                                {mode === 'CUSTOM' 
                                    ? "Tutor can explain concepts in Chinese. / 导师可使用中文辅助。" 
                                    : "Tutor will use 50-70% Chinese. / 导师将使用中文辅助教学。"
                                }
                            </p>
                        </div>
                    )}

                    <button onClick={handleStartClick} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-lg flex flex-col items-center justify-center gap-1 transition-transform transform hover:-translate-y-1 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                            <span className="text-lg">Start Learning</span>
                            <PlayCircle size={22} />
                        </div>
                        <span className="text-xs font-normal opacity-90">生成课程并开始</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
};
