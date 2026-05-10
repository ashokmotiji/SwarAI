import { create } from "zustand";

type DashState = {
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
};

export const useDashboardStore = create<DashState>((set) => ({
  sidebarOpen: true,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
}));
