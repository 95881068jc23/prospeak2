
import React, { useRef, useState, useEffect } from 'react';
import { TestReport, AnalysisItem, Message } from '../types';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { Download, CheckCircle, AlertCircle, Home, Image as ImageIcon, Sparkles, Loader2, ListChecks, Ear, BookA, Brackets, Mic, Wind, Star, BrainCircuit, Quote, Key, Trophy, Medal, FileText, Heart } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { generateDetailedTranscriptAnalysis } from '../services/geminiService';
import { storageService } from '../services/storageService';

interface Props {
  report: TestReport;
  onRestart: () => void;
  history?: Message[]; // Needed for generating detailed analysis
}

const TYPE_LABELS: Record<string, string> = {
  grammar: "Grammar / 语法",
  vocabulary: "Vocabulary / 词汇",
  naturalness: "Naturalness / 地道感",
  pronunciation: "Pronunciation / 发音"
};

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'Listening': return <Ear size={20} />;
    case 'Vocabulary': return <BookA size={20} />;
    case 'Grammar': return <Brackets size={20} />;
    case 'Pronunciation': return <Mic size={20} />;
    case 'Fluency': return <Wind size={20} />;
    case 'Idiomatic': return <Star size={20} />;
    case 'Logic': return <BrainCircuit size={20} />;
    default: return <CheckCircle size={20} />;
  }
};

const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'Listening': return 'Listening / 听力';
      case 'Vocabulary': return 'Vocabulary / 词汇';
      case 'Grammar': return 'Grammar / 语法';
      case 'Pronunciation': return 'Pronunciation / 发音';
      case 'Fluency': return 'Fluency / 流利度';
      case 'Idiomatic': return 'Idiomatic / 地道性';
      case 'Logic': return 'Logic / 逻辑性';
      default: return category;
    }
};

export const ReportScreen: React.FC<Props> = ({ report, onRestart, history }) => {
  const reportRef = useRef<HTMLDivElement>(null);
  const [detailedAnalysis, setDetailedAnalysis] = useState<AnalysisItem[] | undefined>(report.detailedAnalysis);
  const [isGeneratingDetails, setIsGeneratingDetails] = useState(false);
  const [mistakesAdded, setMistakesAdded] = useState(0);
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Sync initial favorites
    const favs = storageService.getFavorites();
    const map: Record<string, boolean> = {};
    favs.forEach(f => map[f.content.en] = true);
    setFavorites(map);
  }, []);

  const toggleFavorite = (item: AnalysisItem) => {
      const id = item.improved;
      const isFav = favorites[id];
      
      if (isFav) {
          const list = storageService.getFavorites();
          const existing = list.find(f => f.content.en === id);
          if (existing) storageService.removeFavorite(existing.id);
          setFavorites(prev => ({ ...prev, [id]: false }));
      } else {
          storageService.addFavorite({
              id: id,
              type: 'EXPRESSION',
              content: {
                  en: id,
                  cn: item.improvedCn || '', 
                  example: item.explanation
              }
          });
          setFavorites(prev => ({ ...prev, [id]: true }));
      }
  };

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;
    try {
        // Capture the entire report element
        const canvas = await html2canvas(reportRef.current, {
            useCORS: true,
            scale: 2, // Higher scale for clear text
            logging: false,
            backgroundColor: '#ffffff',
            // Ensure we capture the full scroll height
            windowHeight: reportRef.current.scrollHeight + 100 
        });

        const imgData = canvas.toDataURL('image/png');
        
        // Initialize A4 PDF
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        
        // Calculate image height in PDF units based on width ratio
        const pdfImageHeight = (imgHeight * pdfWidth) / imgWidth;

        let heightLeft = pdfImageHeight;
        let position = 0;

        // Add first page
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfImageHeight);
        heightLeft -= pageHeight;

        // Add subsequent pages if content overflows
        while (heightLeft > 0) {
             position -= pageHeight; // Shift image up by one page height
             pdf.addPage();
             pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfImageHeight);
             heightLeft -= pageHeight;
        }

        pdf.save(`Marvel-English-Report-${report.cefrLevel}.pdf`);
    } catch (err) {
        console.error("Failed to generate PDF", err);
        alert("Failed to generate PDF. Please try 'Save Image'.");
    }
  };

  const handleSaveImage = async () => {
    if (!reportRef.current) return;
    try {
        const canvas = await html2canvas(reportRef.current, {
            useCORS: true, 
            scale: 2, 
            backgroundColor: '#ffffff',
            logging: false,
        });
        const link = document.createElement('a');
        link.download = `Marvel-English-Report-${report.cefrLevel}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    } catch (err) {
        console.error("Failed to save image", err);
        alert("Failed to save image.");
    }
  };

  const handleHomeClick = () => {
    onRestart();
  };

  const handleGenerateDetails = async () => {
    if (!history) return;
    setIsGeneratingDetails(true);
    try {
        const analysis = await generateDetailedTranscriptAnalysis(
            history, 
            report.cefrLevel, 
            report.isLearningReport
        );
        setDetailedAnalysis(analysis);
        
        let count = 0;
        analysis.forEach(item => {
            const isPerfect = item.original.toLowerCase().trim() === item.improved.toLowerCase().trim();
            if (!isPerfect) {
                storageService.addMistake({
                    original: item.original,
                    originalCn: item.originalCn,
                    improved: item.improved,
                    improvedCn: item.improvedCn,
                    explanation: item.explanation,
                    type: item.type,
                    context: item.question,
                    contextCn: item.questionCn
                });
                count++;
            }
        });
        if (count > 0) setMistakesAdded(count);

    } catch (e) {
        alert("Failed to generate detailed analysis.");
    } finally {
        setIsGeneratingDetails(false);
    }
  };

  const sortedSuggestions = report.suggestions ? [...report.suggestions].sort((a, b) => {
    return (a.isKeyImprovement === b.isKeyImprovement) ? 0 : a.isKeyImprovement ? -1 : 1;
  }) : [];

  return (
    <div className="min-h-screen bg-gray-50 py-4 md:py-10 px-0 md:px-4 print:bg-white print:p-0 relative">
      <style>{`
        @media print {
          body { 
            -webkit-print-color-adjust: exact; 
            print-color-adjust: exact; 
            background: white;
          }
          .no-print { display: none !important; }
          .print-break-inside-avoid { break-inside: avoid; }
          .print-container { padding: 0 !important; max-width: 100% !important; margin: 0 !important; }
          .print-card { box-shadow: none !important; border: 1px solid #ddd !important; }
          .watermark-print { display: flex !important; }
          .watermark-screen { display: none !important; }
        }
      `}</style>
      
      <div className="watermark-print hidden fixed inset-0 z-[-1] items-center justify-center pointer-events-none opacity-[0.08]">
        <div className="transform -rotate-45 grid grid-cols-1 gap-32 p-10 text-center">
            {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="text-6xl font-black text-gray-900 whitespace-nowrap">
                    Marvel English 麦迩威英语
                </div>
            ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto mb-4 md:mb-6 px-4 flex flex-col md:flex-row justify-between items-center no-print relative z-[100] gap-3">
        <button 
            onClick={handleHomeClick}
            className="w-full md:w-auto flex items-center justify-center space-x-2 bg-gray-200 text-gray-700 px-4 py-2.5 rounded-xl hover:bg-gray-300 transition-colors font-medium text-sm shadow-sm"
        >
            <Home size={18} />
            <span>Back to Home / 返回首页</span>
        </button>
        <div className="flex gap-2 w-full md:w-auto">
            <button 
                onClick={handleSaveImage}
                className="flex-1 md:flex-none flex items-center justify-center space-x-2 bg-brand-50 text-brand-700 border border-brand-200 px-4 py-2.5 rounded-xl hover:bg-brand-100 transition-colors font-medium shadow-sm text-sm"
            >
                <ImageIcon size={18} />
                <span>Image</span>
            </button>
            <button 
                onClick={handleDownloadPDF}
                className="flex-1 md:flex-none flex items-center justify-center space-x-2 bg-brand-600 text-white px-4 py-2.5 rounded-xl hover:bg-brand-700 transition-colors shadow-lg shadow-brand-500/30 font-medium text-sm"
            >
                <Download size={18} />
                <span>PDF</span>
            </button>
        </div>
      </div>

      <div ref={reportRef} className="max-w-4xl mx-auto relative print:max-w-none print-container bg-gray-50 p-4 md:p-12 z-10">
        <div className="watermark-screen absolute inset-0 z-0 pointer-events-none overflow-hidden flex flex-wrap content-start justify-center gap-y-32 gap-x-12 p-10 opacity-[0.05] select-none">
            {Array.from({ length: 40 }).map((_, i) => (
            <div key={i} className="transform -rotate-12 text-3xl font-black text-gray-900 whitespace-nowrap">
                Marvel English 麦迩威英语
            </div>
            ))}
        </div>

        <div className="relative z-10 space-y-4 md:space-y-8 print:space-y-4">
            <div className="bg-white rounded-2xl shadow-sm p-5 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center print:shadow-none print:border-b print:p-4 print:mb-4 gap-4">
              <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1 md:mb-2">
                      {report.isLearningReport ? 'Conversation Report / 对话报告' : 'Assessment Report / 测评报告'}
                  </h1>
                  <p className="text-sm md:text-base text-gray-500 mb-2 md:mb-3">Marvel English ProSpeak / 麦迩威英语AI伴学</p>
                  
                  {report.topicTitle && (
                      <div className="inline-block bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold border border-emerald-100 mt-1">
                          Topic: {report.topicTitle}
                      </div>
                  )}
              </div>
              
              {report.isLearningReport && report.learningScore && (
                  <div className="w-full md:w-auto flex items-center gap-3 bg-yellow-50 px-4 py-3 rounded-2xl border border-yellow-200 shadow-sm md:ml-auto">
                      <div className="bg-yellow-100 p-2 rounded-full text-yellow-600 shrink-0">
                          <Trophy size={24} />
                      </div>
                      <div>
                          <p className="text-[10px] text-yellow-700 font-bold uppercase tracking-wider mb-0.5">Practice Score</p>
                          <div className="flex items-end gap-1">
                              <div className="text-2xl md:text-3xl font-black text-yellow-800 leading-none">
                                  {report.learningScore}
                              </div>
                              <span className="text-sm md:text-lg font-normal text-yellow-600/60 pb-0.5">/ 100</span>
                          </div>
                          <div className="flex mt-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                  <Star 
                                    key={star} 
                                    size={12} 
                                    fill={star <= (report.learningStars || 0) ? "#ca8a04" : "none"} 
                                    className={star <= (report.learningStars || 0) ? "text-yellow-600" : "text-yellow-300"} 
                                  />
                              ))}
                          </div>
                      </div>
                  </div>
              )}
            </div>

            {!report.isLearningReport && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 print:gap-4 print:grid-cols-3">
                    <div className="bg-gradient-to-br from-brand-500 to-brand-700 rounded-2xl p-6 text-white text-center shadow-lg print:bg-white print:text-black print:border print:border-gray-300 print-card">
                        <p className="text-brand-100 font-medium mb-2 print:text-gray-600">CEFR Level / 等级</p>
                        <h2 className="text-5xl font-bold tracking-tight">{report.cefrLevel}</h2>
                    </div>
                    <div className="bg-white rounded-2xl p-6 text-center shadow-sm border border-gray-100 flex flex-col justify-center print:border-gray-300 print-card">
                        <p className="text-gray-500 text-sm font-medium uppercase tracking-wider mb-2">IELTS Equivalent</p>
                        <h2 className="text-4xl font-bold text-gray-900">{report.ieltsScore}</h2>
                    </div>
                    <div className="bg-white rounded-2xl p-6 text-center shadow-sm border border-gray-100 flex flex-col justify-center print:border-gray-300 print-card">
                        <p className="text-gray-500 text-sm font-medium uppercase tracking-wider mb-2 whitespace-nowrap">TOEFL iBT (Speaking)</p>
                        <h2 className="text-4xl font-bold text-gray-900 whitespace-nowrap">{report.toeflScore} <span className="text-sm font-normal text-gray-400">/ 30</span></h2>
                    </div>
                </div>
            )}
            
            {report.isLearningReport && report.learningScore && (
                 <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-5 md:p-6 text-white shadow-lg print:bg-white print:text-black print:border print:border-gray-300 print-card flex items-center justify-between">
                     <div>
                        <h3 className="text-xl md:text-2xl font-bold mb-1">
                            {report.learningScore >= 80 ? 'Excellent Effort!' : 'Keep Practicing!'}
                        </h3>
                        <p className="text-emerald-100 opacity-90 text-sm md:text-base">
                            {report.learningScore >= 80 
                                ? 'Great job completing this session. Keep practicing!' 
                                : 'Consistency is key. Try to complete the full session next time.'}
                        </p>
                     </div>
                     <div className="flex items-center gap-2">
                        <Medal size={40} className={report.learningScore >= 80 ? "text-yellow-300" : "text-emerald-200"} />
                     </div>
                 </div>
            )}

            <div className={`grid gap-4 md:gap-8 print:block print:space-y-4 ${report.isLearningReport ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}>
                {!report.isLearningReport && (
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 print:border-gray-300 print:break-inside-avoid print-card">
                        <h3 className="text-xl font-bold text-gray-900 mb-6">Skill Breakdown / 能力维度</h3>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={report.radarData}>
                                <PolarGrid stroke="#e5e7eb" />
                                <PolarAngleAxis dataKey="subject" tick={{ fill: '#4b5563', fontSize: 11, fontWeight: 600 }} />
                                <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} axisLine={false} />
                                <Radar
                                    name="Skill Level"
                                    dataKey="A"
                                    stroke="#0284c7"
                                    strokeWidth={3}
                                    fill="#0ea5e9"
                                    fillOpacity={0.5}
                                />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                <div className="space-y-4 md:space-y-6 print:space-y-4 print:break-inside-avoid">
                    <div className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-gray-100 print:border-gray-300 print-card">
                        <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-3 md:mb-4">Overall Performance / 综合评价</h3>
                        <p className="text-sm md:text-base text-gray-700 leading-relaxed italic">"{report.overallSummary}"</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-green-50 rounded-xl p-4 md:p-5 border border-green-100 print:bg-white print:border-gray-300 print-card">
                            <div className="flex items-center mb-3">
                                <CheckCircle className="text-green-600 mr-2" size={20} />
                                <h4 className="font-bold text-green-900">Strengths</h4>
                            </div>
                            <ul className="space-y-2">
                                {report.strengths.length > 0 ? report.strengths.map((s, i) => (
                                    <li key={i} className="text-xs md:text-sm text-green-800 flex items-start">
                                        <span className="mr-2">•</span>{s}
                                    </li>
                                )) : (
                                    <li className="text-xs md:text-sm text-green-800 italic">Good effort in communication.</li>
                                )}
                            </ul>
                        </div>

                        <div className="bg-orange-50 rounded-xl p-4 md:p-5 border border-orange-100 print:bg-white print:border-gray-300 print-card">
                            <div className="flex items-center mb-3">
                                <AlertCircle className="text-orange-600 mr-2" size={20} />
                                <h4 className="font-bold text-orange-900">Improvements</h4>
                            </div>
                            <ul className="space-y-2">
                                {report.weaknesses.length > 0 ? report.weaknesses.map((s, i) => (
                                    <li key={i} className="text-xs md:text-sm text-orange-800 flex items-start">
                                        <span className="mr-2">•</span>{s}
                                    </li>
                                )) : (
                                    <li className="text-xs md:text-sm text-orange-800 italic">Continue practicing to improve fluency.</li>
                                )}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
            
            {!report.isLearningReport && (
                <div className="bg-sky-50 rounded-2xl shadow-sm border border-sky-100 p-8 mt-8 print:border-gray-300 print:bg-white print:break-inside-avoid print-card">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-sky-100 rounded-xl text-sky-600 print:bg-gray-100 print:text-gray-600">
                            <ListChecks size={28} />
                        </div>
                        <div>
                             <h3 className="text-xl font-bold text-sky-900 mb-2">Quick Feedback / 简要点评</h3>
                             <p className="text-sky-800 leading-relaxed text-lg">
                                 {report.simpleAnalysis || "Your performance has been recorded."}
                             </p>
                        </div>
                    </div>
                </div>
            )}

            {!report.isLearningReport && report.dimensionAnalysis && (
                <div className="grid grid-cols-1 gap-4 mt-8 print:break-inside-avoid">
                    <h3 className="text-xl font-bold text-gray-900 mb-2 px-1">Detailed Dimension Analysis / 详细维度分析</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Object.entries(report.dimensionAnalysis).map(([key, value]) => {
                            const icons: Record<string, React.ReactNode> = {
                                listening: <Ear size={20}/>,
                                vocabulary: <BookA size={20}/>,
                                grammar: <Brackets size={20}/>,
                                pronunciation: <Mic size={20}/>,
                                fluency: <Wind size={20}/>,
                                native: <Star size={20}/>,
                                logic: <BrainCircuit size={20}/>
                            };
                            const labels: Record<string, string> = {
                                listening: "Listening / 听力",
                                vocabulary: "Vocabulary / 词汇",
                                grammar: "Grammar / 语法",
                                pronunciation: "Pronunciation / 发音",
                                fluency: "Fluency / 流利度",
                                native: "Native / 地道性",
                                logic: "Logic / 逻辑性"
                            };
                            const bgColors: Record<string, string> = {
                                listening: "bg-blue-50 border-blue-100 text-blue-900",
                                vocabulary: "bg-purple-50 border-purple-100 text-purple-900",
                                grammar: "bg-rose-50 border-rose-100 text-rose-900",
                                pronunciation: "bg-amber-50 border-amber-100 text-amber-900",
                                fluency: "bg-teal-50 border-teal-100 text-teal-900",
                                native: "bg-indigo-50 border-indigo-100 text-indigo-900",
                                logic: "bg-slate-50 border-slate-100 text-slate-900"
                            };

                            return (
                                <div key={key} className={`p-5 rounded-xl border ${bgColors[key]} shadow-sm transition-all hover:shadow-md`}>
                                    <div className="flex items-center gap-2 mb-3 font-bold opacity-80">
                                        {icons[key]}
                                        <span className="uppercase tracking-wide text-xs">{labels[key]}</span>
                                    </div>
                                    <p className="text-sm leading-relaxed opacity-90">{value}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            
            <div className="page-break"></div>
            
            {report.isLearningReport && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 print:break-inside-avoid">
                    <div className="bg-emerald-50 rounded-2xl p-5 border border-emerald-100 print:border-gray-300 print:bg-white print-card">
                        <div className="flex items-center gap-2 mb-4 text-emerald-800">
                            <BookA size={20}/>
                            <h3 className="font-bold text-sm md:text-base">Core Vocabulary <br/><span className="text-xs font-normal">核心词汇</span></h3>
                        </div>
                        <ul className="space-y-2">
                            {report.coreVocabulary?.map((item, i) => (
                                <li key={i} className="bg-white px-3 py-2 rounded-lg text-xs md:text-sm text-emerald-900 shadow-sm border border-emerald-50 break-words">{item}</li>
                            ))}
                        </ul>
                    </div>

                    <div className="bg-indigo-50 rounded-2xl p-5 border border-indigo-100 print:border-gray-300 print:bg-white print-card">
                        <div className="flex items-center gap-2 mb-4 text-indigo-800">
                            <Key size={20}/>
                            <h3 className="font-bold text-sm md:text-base">Key Sentences <br/><span className="text-xs font-normal">核心句式</span></h3>
                        </div>
                         <ul className="space-y-2">
                            {report.coreSentences?.map((item, i) => (
                                <li key={i} className="bg-white px-3 py-2 rounded-lg text-xs md:text-sm text-indigo-900 shadow-sm border border-indigo-50 break-words">{item}</li>
                            ))}
                        </ul>
                    </div>

                    <div className="bg-amber-50 rounded-2xl p-5 border border-amber-100 print:border-gray-300 print:bg-white print-card">
                        <div className="flex items-center gap-2 mb-4 text-amber-800">
                            <Quote size={20}/>
                            <h3 className="font-bold text-sm md:text-base">Native Expressions <br/><span className="text-xs font-normal">地道表达</span></h3>
                        </div>
                         <ul className="space-y-2">
                            {report.nativeExpressions?.map((item, i) => (
                                <li key={i} className="bg-white px-3 py-2 rounded-lg text-xs md:text-sm text-amber-900 shadow-sm border border-amber-50 break-words">{item}</li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}

            {!report.isLearningReport && (
                <div className="bg-indigo-50 rounded-2xl p-8 border border-indigo-100 mt-8 print:bg-white print:border-gray-300 print:break-inside-avoid print-card">
                    <h3 className="text-xl font-bold text-indigo-900 mb-6">Study Suggestions / 学习建议</h3>
                    {sortedSuggestions.length > 0 ? (
                        <div className="grid grid-cols-1 gap-4">
                            {sortedSuggestions.map((item, idx) => (
                                <div 
                                    key={idx} 
                                    className={`flex items-start bg-white p-5 rounded-xl shadow-sm border transition-colors
                                        ${item.isKeyImprovement 
                                            ? 'border-red-200 bg-red-50/30' 
                                            : 'border-indigo-100/50'}
                                        print:border-gray-300
                                    `}
                                >
                                    <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center mr-4 
                                        ${item.isKeyImprovement ? 'bg-red-100 text-red-600' : 'bg-indigo-50 text-indigo-600'}
                                    `}>
                                        {getCategoryIcon(item.category)}
                                    </div>
                                    <div className="flex-grow">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className={`font-bold text-sm uppercase tracking-wide
                                                ${item.isKeyImprovement ? 'text-red-700' : 'text-indigo-900'}
                                            `}>
                                                {getCategoryLabel(item.category)}
                                            </h4>
                                            {item.isKeyImprovement && (
                                                <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-red-200">
                                                    Priority / 重点提升
                                                </span>
                                            )}
                                        </div>
                                        <p className={`text-sm leading-relaxed ${item.isKeyImprovement ? 'text-gray-800 font-medium' : 'text-gray-600'}`}>
                                            {item.content}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center text-gray-500 py-4 italic">
                            No specific suggestions generated. Keep practicing to identify areas for improvement.
                        </div>
                    )}
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mt-4 md:mt-8 overflow-hidden print:border-gray-300 print:break-inside-avoid print-card">
                <div className="p-4 md:p-6 border-b border-gray-100 bg-gray-50 print:bg-white print:border-b-2 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="text-center md:text-left">
                        <h3 className="text-lg md:text-xl font-bold text-gray-900">Detailed Analysis / 逐句分析</h3>
                        <p className="text-xs md:text-sm text-gray-500">Specific feedback on grammar, vocabulary, and naturalness.</p>
                        {mistakesAdded > 0 && (
                            <div className="mt-2 inline-flex items-center gap-2 bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-bold animate-fadeIn">
                                <AlertCircle size={14}/> {mistakesAdded} mistakes added to Training Center
                            </div>
                        )}
                    </div>
                    
                    {(!detailedAnalysis || detailedAnalysis.length === 0) && !isGeneratingDetails && (
                        <button 
                            onClick={handleGenerateDetails}
                            className="bg-brand-600 text-white px-5 py-2.5 rounded-xl hover:bg-brand-700 transition-colors shadow-md flex items-center gap-2 font-bold no-print text-sm md:text-base w-full md:w-auto justify-center"
                        >
                            <Sparkles size={18} /> Generate Detailed Report
                        </button>
                    )}
                </div>

                {isGeneratingDetails && (
                    <div className="p-12 flex flex-col items-center justify-center text-gray-500 animate-fadeIn">
                        <Loader2 className="animate-spin mb-3 text-brand-600" size={32} />
                        <p>Analyzing every sentence... please wait.</p>
                        <p className="text-xs opacity-70">正在逐句分析您的回答...</p>
                    </div>
                )}

                {detailedAnalysis && detailedAnalysis.length > 0 && (
                    <div className="divide-y divide-gray-100 animate-slideUp">
                        {detailedAnalysis.map((item, idx) => {
                            const isPerfect = item.original.toLowerCase().trim() === item.improved.toLowerCase().trim();
                            const isFav = favorites[item.improved];

                            return (
                            <div key={idx} className="p-4 md:p-6 hover:bg-gray-50 transition-colors print:hover:bg-white print:break-inside-avoid relative">
                                <div className="absolute top-4 right-4 flex gap-2">
                                    {isPerfect && <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded border border-green-200 uppercase">Perfect / 完美</span>}
                                    {!isPerfect && item.type === 'grammar' && <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-1 rounded border border-red-200 uppercase">Grammar Fix</span>}
                                    {!isPerfect && item.type === 'vocabulary' && <span className="bg-purple-100 text-purple-700 text-[10px] font-bold px-2 py-1 rounded border border-purple-200 uppercase">Better Word</span>}
                                    {!isPerfect && item.type === 'naturalness' && <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-1 rounded border border-blue-200 uppercase">Native Polish</span>}
                                </div>

                                <div className="mb-4 pb-4 border-b border-gray-100/50 pr-20">
                                   <p className="text-gray-400 text-xs font-bold uppercase mb-1 tracking-wider">Context (Question) / 上下文</p>
                                   <p className="text-gray-600 italic text-sm md:text-base">"{item.question}"</p>
                                   {item.questionCn && <p className="text-gray-400 text-xs mt-1">{item.questionCn}</p>}
                                </div>

                                <div className="flex flex-col md:flex-row gap-4 md:gap-6">
                                    <div className="md:w-1/3">
                                        <span className={`inline-block px-2 py-1 rounded text-xs font-bold uppercase tracking-wide mb-2 
                                            ${item.type === 'grammar' ? 'bg-red-100 text-red-700' : 
                                            item.type === 'vocabulary' ? 'bg-blue-100 text-blue-700' :
                                            item.type === 'pronunciation' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'
                                            }`}>
                                            {TYPE_LABELS[item.type] || item.type}
                                        </span>
                                        <p className="text-gray-400 text-xs font-medium uppercase mb-1">You said / 你说:</p>
                                        <p className={`text-gray-800 font-medium p-3 rounded-lg border text-sm md:text-base print:border-gray-300 ${isPerfect ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>"{item.original}"</p>
                                        {item.originalCn && <p className="text-gray-400 text-xs mt-1 px-1">{item.originalCn}</p>}
                                    </div>
                                    <div className="md:w-1/3">
                                        <div className="flex items-center justify-between mt-2 md:mt-6.5 mb-1">
                                            <p className="text-gray-400 text-xs font-medium uppercase">Better way / 建议表达:</p>
                                            <button 
                                                onClick={() => toggleFavorite(item)} 
                                                className={`p-1 rounded-full transition-colors ${isFav ? 'bg-rose-100 text-rose-500' : 'text-gray-300 hover:text-rose-400 hover:bg-rose-50'}`}
                                                title={isFav ? "Remove from Favorites" : "Add to Favorites"}
                                            >
                                                <Heart size={14} fill={isFav ? "currentColor" : "none"}/>
                                            </button>
                                        </div>
                                        <p className="text-gray-800 font-medium bg-green-50 p-3 rounded-lg border border-green-100 print:border-gray-300 text-sm md:text-base">"{item.improved}"</p>
                                        {item.improvedCn && <p className="text-gray-500 text-xs mt-1 italic">{item.improvedCn}</p>}
                                    </div>
                                    <div className="md:w-1/3">
                                        <p className="text-gray-400 text-xs font-medium uppercase mb-1 mt-2 md:mt-6.5">Why / 原因:</p>
                                        <p className="text-gray-600 text-sm italic leading-relaxed">{item.explanation}</p>
                                    </div>
                                </div>
                            </div>
                        )})}
                    </div>
                )}
                {detailedAnalysis && detailedAnalysis.length === 0 && !isGeneratingDetails && (
                    <div className="p-8 text-center text-gray-500 italic">
                         No detailed analysis available. Try regenerating.
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};
