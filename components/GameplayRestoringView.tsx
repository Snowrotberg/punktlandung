import type { RoundStatus } from "@/types/game";

type GameplayStatus = Exclude<RoundStatus, "lobby">;

const restoringHeadings: Record<GameplayStatus, string> = {
  guessing: "Laufende Runde wird wiederhergestellt",
  results: "Rundenauswertung wird wiederhergestellt",
  finished: "Endergebnis wird wiederhergestellt"
};

export function GameplayRestoringView({ requiredStatus }: { requiredStatus?: GameplayStatus }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-slate-950 p-4 text-slate-50" data-gameplay-restoring={requiredStatus ?? "pending"}>
      <section className="arcade-panel w-full max-w-md rounded-xl border-slate-700/80 p-5" role="status" aria-live="polite">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">Punktlandung</p>
        <h1 className="mt-2 text-3xl font-black leading-tight">
          {requiredStatus ? restoringHeadings[requiredStatus] : "Spielstand wird geladen"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Der gespeicherte Spielstand wird für diese Seite geladen.
        </p>
      </section>
    </main>
  );
}
