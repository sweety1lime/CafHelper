import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AppState {
  serverId: string | null;
  hotkey: string;
  // скрывать оверлей, когда фокус ушёл в игру (как у Laws MEMO; для второго монитора — выключить)
  autoHide: boolean;
  // избранные статьи (id) — закрепляются на вкладке «Поиск»
  favorites: string[];
  // калькулятор наказаний: подобранные статьи (id)
  calc: string[];
  // одноразовый тур при первом запуске пройден/пропущен
  onboardingDone: boolean;
  // кнопка «+» уже нажималась — сворачиваем подсказку «＋ срок» до компактной
  calcHintSeen: boolean;
  setServer: (id: string | null) => void;
  setHotkey: (hotkey: string) => void;
  setAutoHide: (v: boolean) => void;
  toggleFavorite: (id: string) => void;
  toggleCalc: (id: string) => void;
  clearCalc: () => void;
  setOnboardingDone: () => void;
}

const toggle = (list: string[], id: string) =>
  list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      serverId: null,
      hotkey: "F9",
      autoHide: false,
      favorites: [],
      calc: [],
      onboardingDone: false,
      calcHintSeen: false,
      setServer: (serverId) => set({ serverId }),
      setHotkey: (hotkey) => set({ hotkey }),
      setAutoHide: (autoHide) => set({ autoHide }),
      toggleFavorite: (id) => set((s) => ({ favorites: toggle(s.favorites, id) })),
      toggleCalc: (id) => set((s) => ({ calc: toggle(s.calc, id), calcHintSeen: true })),
      clearCalc: () => set({ calc: [] }),
      setOnboardingDone: () => set({ onboardingDone: true }),
    }),
    { name: "cafhelper-settings" },
  ),
);
