import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Pin } from "../types";

interface AppState {
  serverId: string | null;
  hotkey: string;
  // скрывать оверлей, когда фокус ушёл в игру (как у Laws MEMO; для второго монитора — выключить)
  autoHide: boolean;
  // избранные статьи (id) — закрепляются на вкладке «Поиск»
  favorites: string[];
  // калькулятор наказаний: подобранные статьи (id)
  calc: string[];
  // закреплённый контент в отдельных мини-окнах (фразы, наборы статей)
  pins: Pin[];
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
  addPin: (pin: Pin) => void;
  updatePin: (id: string, patch: Partial<Pin>) => void;
  removePin: (id: string) => void;
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
      pins: [],
      onboardingDone: false,
      calcHintSeen: false,
      setServer: (serverId) => set({ serverId }),
      setHotkey: (hotkey) => set({ hotkey }),
      setAutoHide: (autoHide) => set({ autoHide }),
      toggleFavorite: (id) => set((s) => ({ favorites: toggle(s.favorites, id) })),
      toggleCalc: (id) => set((s) => ({ calc: toggle(s.calc, id), calcHintSeen: true })),
      clearCalc: () => set({ calc: [] }),
      addPin: (pin) => set((s) => ({ pins: [...s.pins, pin] })),
      updatePin: (id, patch) =>
        set((s) => ({
          pins: s.pins.map((p) => (p.id === id ? ({ ...p, ...patch } as Pin) : p)),
        })),
      removePin: (id) => set((s) => ({ pins: s.pins.filter((p) => p.id !== id) })),
      setOnboardingDone: () => set({ onboardingDone: true }),
    }),
    { name: "cafhelper-settings" },
  ),
);
