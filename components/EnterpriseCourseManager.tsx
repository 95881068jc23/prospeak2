import React, { useState, useEffect } from 'react';
import { storageService } from '../services/storageService';
import { Topic } from '../types';
import { ArrowLeft, Trash2, Plus, Save, Building2, BookOpen, FileText, X } from 'lucide-react';

interface Props {
    onBack: () => void;
}

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const DEPARTMENTS = ['Sales', 'R&D', 'HR', 'Management', 'Marketing', 'Finance'];

export const EnterpriseCourseManager: React.FC<Props> = ({ onBack }) => {
    const [courses, setCourses] = useState<Topic[]>([]);
    const [showAddForm, setShowAddForm] = useState(false);

    // Form State
    const [dept, setDept] = useState('Sales');
    const [level, setLevel] = useState('B1');
    const [titleEn, setTitleEn] = useState('');
    const [titleCn, setTitleCn] = useState('');
    const [pptContext, setPptContext] = useState('');

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

    const handleSave = () => {
        if (!titleEn || !titleCn || !pptContext) {
            alert('Please fill in all fields. / 请填写所有字段。');
            return;
        }

        const newTopic: Topic = {
            id: `ent-${Date.now()}`,
            titleEn,
            titleCn,
            category: 'BUSINESS',
            level,
            isEnterprise: true,
            department: dept,
            enterpriseId: 'marvel-corp',
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
        setDept('Sales');
        setLevel('B1');
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
                                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Plus size={20}/> Upload Course (PPT Context)</h3>
                                <button onClick={() => setShowAddForm(false)} className="p-2 hover:bg-gray-200 rounded-full text-gray-500"><X size={20}/></button>
                            </div>
                            
                            <div className="p-8 space-y-6">
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Department / 部门</label>
                                        <select value={dept} onChange={e => setDept(e.target.value)} className="w-full p-3 border rounded-xl bg-white font-medium">
                                            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Level / 难度</label>
                                        <select value={level} onChange={e => setLevel(e.target.value)} className="w-full p-3 border rounded-xl bg-white font-medium">
                                            {CEFR_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                                        </select>
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
                                    <span className="inline-block px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 text-[10px] font-bold uppercase mb-1">{course.department}</span>
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
