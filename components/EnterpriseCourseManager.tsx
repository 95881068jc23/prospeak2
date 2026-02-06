import React, { useState, useEffect, useRef, useMemo } from 'react';
import { storageService } from '../services/storageService';
import { Topic, UploadedFile } from '../types';
import { parseCourseMaterials } from '../services/geminiService';
import { ENTERPRISE_STRUCTURE } from '../constants';
import { ArrowLeft, Trash2, Plus, Save, Building2, BookOpen, FileText, X, Upload, File, Loader2, CheckSquare, Square, ChevronDown } from 'lucide-react';

interface Props {
    onBack: () => void;
}

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export const EnterpriseCourseManager: React.FC<Props> = ({ onBack }) => {
    const [courses, setCourses] = useState<Topic[]>([]);
    const [showAddForm, setShowAddForm] = useState(false);

    // Form State
    const [enterpriseId, setEnterpriseId] = useState('Marvel Corp');
    const [selectedDepts, setSelectedDepts] = useState<string[]>(['Sales']);
    const [selectedSubDepts, setSelectedSubDepts] = useState<string[]>([]);
    
    const [level, setLevel] = useState('B1');
    const [titleEn, setTitleEn] = useState('');
    const [titleCn, setTitleCn] = useState('');
    const [pptContext, setPptContext] = useState('');
    
    // Upload State
    const [uploadMode, setUploadMode] = useState<'TEXT' | 'FILE'>('FILE');
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
    const [isParsing, setIsParsing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Derived Options
    const enterprises = Object.keys(ENTERPRISE_STRUCTURE);
    
    const availableDepts = useMemo(() => {
        return Object.keys(ENTERPRISE_STRUCTURE[enterpriseId] || {});
    }, [enterpriseId]);

    const availableSubDepts = useMemo(() => {
        const subs = new Set<string>();
        selectedDepts.forEach(dept => {
            const deptSubs = ENTERPRISE_STRUCTURE[enterpriseId]?.[dept] || [];
            deptSubs.forEach(s => subs.add(s));
        });
        return Array.from(subs);
    }, [enterpriseId, selectedDepts]);

    useEffect(() => {
        loadCourses();
    }, []);

    const loadCourses = () => {
        setCourses(storageService.getEnterpriseCourses());
    };

    const handleDelete = (id: string) => {
        if (window.confirm('Delete this course? / 确定删除该课程？')) {
            storageService.deleteEnterpriseCourse(id);
            loadCourses();
        }
    };

    const toggleDept = (dept: string) => {
        setSelectedDepts(prev => {
            if (prev.includes(dept)) {
                // If unchecking, remove associated sub-depts logic could be here, but simpler to keep
                return prev.filter(d => d !== dept);
            } else {
                return [...prev, dept];
            }
        });
    };

    const toggleSubDept = (sub: string) => {
        setSelectedSubDepts(prev => {
            if (prev.includes(sub)) return prev.filter(s => s !== sub);
            return [...prev, sub];
        });
    };

    const handleSave = () => {
        if (!titleEn || !titleCn || !pptContext) {
            alert('Please fill in all text fields. / 请填写所有文本字段。');
            return;
        }
        if (selectedDepts.length === 0) {
             alert('Please select at least one department. / 请至少选择一个部门。');
             return;
        }

        const newTopic: Topic = {
            id: `ent-${Date.now()}`,
            titleEn,
            titleCn,
            category: 'BUSINESS',
            level,
            isEnterprise: true,
            department: selectedDepts,
            subDepartment: selectedSubDepts,
            enterpriseId: 'marvel-corp', // Keeping ID constant for demo, but logically follows selection
            pptContext
        };

        storageService.saveEnterpriseCourse(newTopic);
        loadCourses();
        setShowAddForm(false);
        resetForm();
    };

    const resetForm = () => {
        setTitleEn('');
        setTitleCn('');
        setPptContext('');
        setSelectedDepts(['Sales']);
        setSelectedSubDepts([]);
        setLevel('B1');
        setUploadedFiles([]);
        setUploadMode('FILE');
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
                    setUploadedFiles(prev => [...prev, newFile]);
                };
                reader.readAsDataURL(file);
            });
        }
    };

    const triggerParsing = async () => {
        if (uploadedFiles.length === 0) return;
        setIsParsing(true);
        try {
            const result = await parseCourseMaterials(uploadedFiles);
            setPptContext(result);
            // Switch to text mode to review result
            setUploadMode('TEXT');
        } catch (e) {
            alert("Parsing failed. Please try again.");
        } finally {
            setIsParsing(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8 font-sans">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <button onClick={onBack} className="p-2 hover:bg-white rounded-full transition-colors">
                            <ArrowLeft size={24} className="text-gray-600"/>
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Enterprise Course Manager</h1>
                            <p className="text-gray-500 text-sm">Upload & Manage Department Courses / 企业课程管理后台</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => setShowAddForm(true)}
                        className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-lg"
                    >
                        <Plus size={20}/> Upload New Course
                    </button>
                </div>

                {/* Add Form Modal */}
                {showAddForm && (
                    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                            <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl">
                                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Plus size={20}/> Upload Course (AI Content)</h3>
                                <button onClick={() => setShowAddForm(false)} className="p-2 hover:bg-gray-200 rounded-full text-gray-500"><X size={20}/></button>
                            </div>
                            
                            <div className="p-8 space-y-6">
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="col-span-2">
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Enterprise / 企业</label>
                                        <select value={enterpriseId} onChange={e => { setEnterpriseId(e.target.value); setSelectedDepts([]); setSelectedSubDepts([]); }} className="w-full p-3 border rounded-xl bg-white font-medium shadow-sm">
                                            {enterprises.map(e => <option key={e} value={e}>{e}</option>)}
                                        </select>
                                    </div>

                                    <div className="col-span-2">
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                                            Department(s) / 部门 (Multi-select)
                                        </label>
                                        <div className="flex flex-wrap gap-2 p-3 border rounded-xl bg-gray-50 min-h-[50px]">
                                            {availableDepts.map(d => {
                                                const isSelected = selectedDepts.includes(d);
                                                return (
                                                    <button
                                                        key={d}
                                                        onClick={() => toggleDept(d)}
                                                        className={`px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all border
                                                            ${isSelected ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'}
                                                        `}
                                                    >
                                                        {isSelected ? <CheckSquare size={14}/> : <Square size={14}/>}
                                                        {d}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {selectedDepts.length > 0 && availableSubDepts.length > 0 && (
                                        <div className="col-span-2 animate-fadeIn">
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                                                Sub-Department(s) / 子部门 (Optional)
                                            </label>
                                            <div className="flex flex-wrap gap-2 p-3 border rounded-xl bg-gray-50 min-h-[50px]">
                                                {availableSubDepts.map(s => {
                                                    const isSelected = selectedSubDepts.includes(s);
                                                    return (
                                                        <button
                                                            key={s}
                                                            onClick={() => toggleSubDept(s)}
                                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all border
                                                                ${isSelected ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'}
                                                            `}
                                                        >
                                                            {isSelected ? <CheckSquare size={12}/> : <Square size={12}/>}
                                                            {s}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Level / 难度</label>
                                        <select value={level} onChange={e => setLevel(e.target.value)} className="w-full p-3 border rounded-xl bg-white font-medium">
                                            {CEFR_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        {/* Spacer to align grid if needed, or remove grid-cols-2 above */}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Title (English)</label>
                                        <input 
                                            type="text" 
                                            value={titleEn}
                                            onChange={e => setTitleEn(e.target.value)}
                                            className="w-full p-3 border rounded-xl"
                                            placeholder="e.g. Q4 Sales Strategy"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Title (Chinese)</label>
                                        <input 
                                            type="text" 
                                            value={titleCn}
                                            onChange={e => setTitleCn(e.target.value)}
                                            className="w-full p-3 border rounded-xl"
                                            placeholder="e.g. Q4 销售策略"
                                        />
                                    </div>
                                </div>

                                {/* Content Upload Section */}
                                <div className="space-y-4 pt-4 border-t border-gray-50">
                                    <div className="flex items-center gap-4 border-b border-gray-100 pb-2">
                                        <button 
                                            onClick={() => setUploadMode('FILE')}
                                            className={`text-sm font-bold pb-2 transition-all ${uploadMode === 'FILE' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
                                        >
                                            Upload File (PPT/PDF/Image)
                                        </button>
                                        <button 
                                            onClick={() => setUploadMode('TEXT')}
                                            className={`text-sm font-bold pb-2 transition-all ${uploadMode === 'TEXT' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
                                        >
                                            Paste Text / Manual Input
                                        </button>
                                    </div>

                                    {uploadMode === 'FILE' ? (
                                        <div className="space-y-4">
                                            <div 
                                                onClick={() => fileInputRef.current?.click()} 
                                                className="border-2 border-dashed border-indigo-200 bg-indigo-50/50 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-indigo-50 hover:border-indigo-400 transition-all group"
                                            >
                                                <div className="bg-white p-4 rounded-full mb-3 shadow-sm group-hover:scale-110 transition-transform">
                                                    <Upload className="text-indigo-500" size={24}/>
                                                </div>
                                                <span className="text-sm text-indigo-700 font-bold">Click to upload Course Materials</span>
                                                <span className="text-xs text-indigo-400 mt-1">Supports PDF, Images (PPT screenshots)</span>
                                                <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileUpload} accept=".pdf,.jpg,.jpeg,.png" />
                                            </div>

                                            {uploadedFiles.length > 0 && (
                                                <div className="bg-white border border-gray-100 rounded-xl p-4">
                                                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2"><File size={12}/> {uploadedFiles.length} Files Selected</h4>
                                                    <div className="flex flex-wrap gap-2 mb-4">
                                                        {uploadedFiles.map((f, i) => (
                                                            <div key={i} className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2">
                                                                <span className="truncate max-w-[150px]">{f.name}</span>
                                                                <button onClick={() => setUploadedFiles(prev => prev.filter((_, idx) => idx !== i))} className="hover:text-red-500"><X size={12}/></button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    
                                                    <button 
                                                        onClick={triggerParsing}
                                                        disabled={isParsing}
                                                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        {isParsing ? <Loader2 size={18} className="animate-spin"/> : <FileText size={18}/>}
                                                        {isParsing ? "Analyzing Content..." : "Analyze & Extract Text"}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2 flex items-center justify-between">
                                                <span>PPT Context / PPT 内容</span>
                                                <span className="text-indigo-600 normal-case font-normal text-[10px] bg-indigo-50 px-2 py-0.5 rounded-full">AI will generate lesson based on this</span>
                                            </label>
                                            <textarea 
                                                value={pptContext}
                                                onChange={e => setPptContext(e.target.value)}
                                                className="w-full p-4 border rounded-xl h-48 font-mono text-sm leading-relaxed focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                                                placeholder="Paste the text content from your PPT here. Include key points, dialogue scenarios, vocabulary lists, and objections..."
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="p-6 border-t bg-gray-50 rounded-b-2xl flex justify-end gap-3">
                                <button onClick={() => setShowAddForm(false)} className="px-6 py-3 font-bold text-gray-500 hover:bg-gray-200 rounded-xl transition-colors">Cancel</button>
                                <button onClick={handleSave} className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg transition-colors flex items-center gap-2">
                                    <Save size={18}/> Save Course
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Course List */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {courses.map(course => (
                        <div key={course.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow group relative">
                            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleDelete(course.id)} className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors" title="Delete Course">
                                    <Trash2 size={16}/>
                                </button>
                            </div>
                            
                            <div className="flex items-start gap-4 mb-4">
                                <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                                    <Building2 size={24}/>
                                </div>
                                <div>
                                    <div className="flex flex-wrap gap-1 mb-1">
                                        {Array.isArray(course.department) 
                                            ? course.department.map(d => <span key={d} className="inline-block px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase">{d}</span>)
                                            : <span className="inline-block px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase">{course.department}</span>
                                        }
                                        {course.subDepartment?.map(s => (
                                            <span key={s} className="inline-block px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 text-[10px] font-bold uppercase border border-purple-100">{s}</span>
                                        ))}
                                    </div>
                                    <h3 className="font-bold text-gray-900 leading-tight">{course.titleEn}</h3>
                                    <p className="text-sm text-gray-500">{course.titleCn}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 text-xs text-gray-400 mb-4 font-mono bg-gray-50 p-2 rounded-lg">
                                <BookOpen size={12}/> Level: <span className="font-bold text-gray-600">{course.level}</span>
                            </div>

                            <div className="border-t pt-4">
                                <p className="text-xs text-gray-400 line-clamp-3 leading-relaxed">
                                    <FileText size={10} className="inline mr-1"/>
                                    {course.pptContext?.substring(0, 100)}...
                                </p>
                            </div>
                        </div>
                    ))}
                    
                    {courses.length === 0 && (
                        <div className="col-span-full py-20 text-center text-gray-400 bg-white rounded-3xl border-2 border-dashed border-gray-200">
                            <p>No enterprise courses found. Upload one to get started.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
