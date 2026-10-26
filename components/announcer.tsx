"use client";

import { useAnnouncement } from "@/lib/announce";

export function Announcer() {
  const { message, count } = useAnnouncement();
  // A changing trailing space makes a repeated message count as new.
  return (
    <div role="status" aria-live="polite" className="sr-only">
      {message}
      {count % 2 ? " " : ""}
    </div>
  );
}
