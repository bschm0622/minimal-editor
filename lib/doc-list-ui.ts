import { create } from "zustand";

/** Whether the doc list on the left is open. It opens and closes only on purpose. */
export const useDocListUI = create<{ open: boolean; toggle: () => void; close: () => void }>(
  (set) => ({
    open: false,
    toggle: () => set((state) => ({ open: !state.open })),
    close: () => set({ open: false }),
  })
);
