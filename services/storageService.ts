
import { FavoriteItem, MistakeItem } from '../types';

const FAVORITES_KEY = 'marvel_prospeak_favorites';
const MISTAKES_KEY = 'marvel_prospeak_mistakes';

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
    }
};
