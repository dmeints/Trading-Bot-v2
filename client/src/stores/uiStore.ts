import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserLevel = 'beginner' | 'intermediate' | 'expert';

interface UIState {
  userLevel: UserLevel;
  setUserLevel: (level: UserLevel) => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  feedbackOpen: boolean;
  setFeedbackOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      userLevel: 'intermediate',
      setUserLevel: (level) => set({ userLevel: level }),
      isDarkMode: true,
      toggleDarkMode: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
      sidebarCollapsed: false,
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      feedbackOpen: false,
      setFeedbackOpen: (open) => set({ feedbackOpen: open }),
    }),
    {
      name: 'skippy-ui-preferences',
    }
  )
);