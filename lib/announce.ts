import { create } from "zustand";

export const useAnnouncement = create<{ message: string; count: number }>(() => ({
  message: "",
  count: 0,
}));

/** Says `message` to screen readers. */
export function announce(message: string) {
  useAnnouncement.setState((state) => ({ message, count: state.count + 1 }));
}
