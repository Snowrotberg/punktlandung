import type { Metadata } from "next";
import Link from "next/link";
export const metadata: Metadata = {
  title: "Zugang | Punktlandung",
  robots: {
    index: false,
    follow: false
  }
};

export default function AccessPage() {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-slate-950 px-4 py-6 text-slate-50 sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(52,211,153,0.16),transparent_28rem),radial-gradient(circle_at_82%_32%,rgba(99,102,241,0.18),transparent_30rem)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(148,163,184,0.055)_1px,transparent_1px),linear-gradient(0deg,rgba(148,163,184,0.055)_1px,transparent_1px)] bg-[size:56px_56px]" />

      <section className="relative mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-2xl items-center justify-center">
        <div className="arcade-panel w-full rounded-md p-5 sm:p-8">
          <div className="mb-7">
            <p className="text-sm font-black uppercase tracking-[0.32em] text-emerald-300">
              Testbetrieb
            </p>
            <h1 className="mt-2 text-4xl font-black leading-none text-white sm:text-5xl">
              Punktlandung
            </h1>
            <p className="mt-3 text-base text-slate-300">
              Gib das Passwort ein, um das Spiel zu öffnen.
            </p>
          </div>

          <form action="/api/access" method="post" className="space-y-4">
            <input type="hidden" name="next" value="/" />
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-black uppercase tracking-[0.32em] text-slate-400"
              >
                Passwort
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                autoFocus
                required
                className="mt-2 w-full rounded-md border border-slate-500/60 bg-slate-950/70 px-4 py-4 text-lg text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/25"
              />
            </div>

            <button
              type="submit"
              className="group relative inline-flex min-h-12 w-full items-center justify-center overflow-hidden rounded-md border-2 border-emerald-400/80 bg-slate-950/65 px-5 py-3 text-base font-black text-white shadow-[0_0_24px_rgba(52,211,153,0.18)] transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-400/12"
            >
              <span className="absolute left-0 top-1/2 h-8 w-1.5 -translate-y-1/2 rounded-r-full bg-emerald-300 shadow-[0_0_18px_rgba(52,211,153,0.85)] transition group-hover:h-10" />
              <span className="relative">Freischalten</span>
            </button>
          </form>

          <div className="mt-6 flex flex-wrap gap-4 text-sm font-bold text-slate-400">
            <Link href="/impressum" className="transition hover:text-emerald-200">
              Impressum
            </Link>
            <Link href="/datenschutz" className="transition hover:text-emerald-200">
              Datenschutz
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
