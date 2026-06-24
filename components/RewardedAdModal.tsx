"use client";

import { useEffect, useState } from "react";
import type { Cosmetic } from "@/types/game";
import { Button } from "./Button";

type RewardedAdModalProps = {
  open: boolean;
  onClose: () => void;
  onReward: (cosmetic: Cosmetic) => void;
};

export function RewardedAdModal({ open, onClose, onReward }: RewardedAdModalProps) {
  const [countdown, setCountdown] = useState(7);

  useEffect(() => {
    if (!open) return;
    setCountdown(7);
    const timer = window.setInterval(() => setCountdown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [open]);

  if (!open) return null;

  const claim = () => {
    onReward("neon-frame");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/85 p-4 backdrop-blur">
      <div className="arcade-panel w-full max-w-lg rounded-md border-indigo-400 p-5">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-300">Rewarded Ad</p>
        <h2 className="mt-3 text-2xl font-black">Kosmetik freischalten</h2>
        <div className="mt-5 grid min-h-[220px] place-items-center rounded-md border-3 border-slate-700 bg-slate-950 text-center">
          <div>
            <p className="text-5xl font-black text-indigo-300">{countdown}</p>
            <p className="mt-2 text-sm text-slate-300">Simulierter Videospot</p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button disabled={countdown > 0} onClick={claim}>
            Neon-Rahmen holen
          </Button>
          <Button tone="ghost" onClick={onClose}>
            Abbrechen
          </Button>
        </div>
      </div>
    </div>
  );
}
