"use client";

import type { EmojiEventPayload } from "@/types/game";

type EmojiLayerProps = {
  events: EmojiEventPayload[];
};

export function EmojiLayer({ events }: EmojiLayerProps) {
  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {events.map((event) => (
        <span
          key={event.id}
          className="absolute bottom-0 text-5xl drop-shadow-[0_0_16px_rgba(255,255,255,0.6)]"
          style={{
            left: `${event.x}%`,
            animation: "float-emoji 2.8s ease-out forwards"
          }}
        >
          {event.emoji}
        </span>
      ))}
    </div>
  );
}
