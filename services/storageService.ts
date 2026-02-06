
import { FavoriteItem, MistakeItem, Topic } from '../types';

const FAVORITES_KEY = 'marvel_prospeak_favorites';
const MISTAKES_KEY = 'marvel_prospeak_mistakes';
const ENTERPRISE_KEY = 'marvel_prospeak_enterprise_courses';

// Pre-load some demo enterprise data if empty
const initEnterpriseDemo = () => {
    try {
        if (!localStorage.getItem(ENTERPRISE_KEY)) {
            const demos: Topic[] = [
                {
                    id: 'ent-sales-01',
                    titleEn: 'Q4 Product Pitch',
                    titleCn: 'Q4季度产品报价话术',
                    category: 'BUSINESS',
                    level: 'B2',
                    isEnterprise: true,
                    department: ['Sales'],
                    subDepartment: ['Inside Sales'],
                    enterpriseId: 'marvel-corp',
                    pptContext: `
                    Key Selling Points: 
                    1. AI-driven efficiency: 30% faster workflow.
                    2. Cost reduction: Save $2000 per seat annually.
                    3. Seamless integration with existing CRM.
                    
                    Objection Handling:
                    - "It's too expensive": Highlight ROI within 3 months.
                    - "We are happy with current provider": Focus on unique AI features they lack.
                    
                    Closing Techniques:
                    - Trial close: "If we can meet your budget, would you sign today?"
                    - Assumptive close: "When would you like to start implementation?"
                    `
                },
                {
                    id: 'ent-rd-01',
                    titleEn: 'Agile Scrum Daily Standup',
                    titleCn: '敏捷开发每日站会',
                    category: 'BUSINESS',
                    level: 'B1',
                    isEnterprise: true,
                    department: ['R&D'],
                    subDepartment: ['Backend', 'QA'],
                    enterpriseId: 'marvel-corp',
                    pptContext: `
                    Structure of Standup:
                    1. What did you do yesterday?
                    2. What will you do today?
                    3. Any blockers?
                    
                    Key Vocabulary:
                    - Sprint, Backlog, Blocker, Deployment, PR (Pull Request), Code Review.
                    
                    Scenario:
                    - Reporting a delay due to API dependency.
                    - Asking for help on a bug.
                    `
                }
            ];
            localStorage.setItem(ENTERPRISE_KEY, JSON.stringify(demos));
        }
    } catch {}
};

initEnterpriseDemo();

export const storageService = {
    // --- FAVORITES ---
    getFavorites: (): FavoriteItem[] => {
        try {
            const data = localStorage.getItem(FAVORITES_KEY);
            return data ? JSON.parse(data) : [];
        } catch { return []; }
    },

    addFavorite: (item: Omit<FavoriteItem, 'timestamp'>) => {
        const list = storageService.getFavorites();
        // Avoid duplicates based on English content
        if (list.some(i => i.content.en === item.content.en)) return;
        
        const newItem: FavoriteItem = { ...item, timestamp: Date.now() };
        list.unshift(newItem); // Add to top
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(list));
    },

    removeFavorite: (id: string) => {
        const list = storageService.getFavorites().filter(i => i.id !== id);
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(list));
    },

    isFavorite: (enText: string): boolean => {
        const list = storageService.getFavorites();
        return list.some(i => i.content.en === enText);
    },

    // --- MISTAKES ---
    getMistakes: (): MistakeItem[] => {
        try {
            const data = localStorage.getItem(MISTAKES_KEY);
            return data ? JSON.parse(data) : [];
        } catch { return []; }
    },

    addMistake: (item: Omit<MistakeItem, 'id' | 'timestamp'>) => {
        const list = storageService.getMistakes();
        // Avoid near-duplicates
        if (list.some(i => i.original === item.original)) return;

        const newItem: MistakeItem = { 
            ...item, 
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            timestamp: Date.now() 
        };
        list.unshift(newItem);
        localStorage.setItem(MISTAKES_KEY, JSON.stringify(list));
    },

    removeMistake: (id: string) => {
        const list = storageService.getMistakes().filter(i => i.id !== id);
        localStorage.setItem(MISTAKES_KEY, JSON.stringify(list));
    },

    // --- ENTERPRISE COURSES ---
    getEnterpriseCourses: (department?: string): Topic[] => {
        try {
            const data = localStorage.getItem(ENTERPRISE_KEY);
            let all: Topic[] = data ? JSON.parse(data) : [];
            
            // Data Migration: Ensure department is array
            all = all.map(t => {
                if (typeof t.department === 'string') {
                    return { ...t, department: [t.department] };
                }
                return t;
            });

            if (department) {
                return all.filter(t => t.department?.includes(department));
            }
            return all;
        } catch { return []; }
    },

    getAllDepartments: (): string[] => {
        const courses = storageService.getEnterpriseCourses();
        const depts = new Set<string>();
        courses.forEach(c => {
            if (Array.isArray(c.department)) {
                c.department.forEach(d => depts.add(d));
            } else if (typeof c.department === 'string') {
                depts.add(c.department);
            }
        });
        return Array.from(depts);
    },

    saveEnterpriseCourse: (topic: Topic) => {
        const list = storageService.getEnterpriseCourses();
        // Update if exists, else add
        const idx = list.findIndex(t => t.id === topic.id);
        if (idx >= 0) {
            list[idx] = topic;
        } else {
            list.unshift(topic);
        }
        localStorage.setItem(ENTERPRISE_KEY, JSON.stringify(list));
    },
    
    deleteEnterpriseCourse: (id: string) => {
        const list = storageService.getEnterpriseCourses().filter(t => t.id !== id);
        localStorage.setItem(ENTERPRISE_KEY, JSON.stringify(list));
    }
};
