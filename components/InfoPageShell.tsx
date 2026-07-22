import type { ReactNode } from "react";
import { AdContainer } from "@/components/AdContainer";
import { ImportantPages } from "@/components/SeoContent";
import { LegalBackLink } from "@/components/LegalBackLink";

type InfoPageShellProps = {
  eyebrow: string;
  title: string;
  intro?: string;
  children: ReactNode;
  showImportantPages?: boolean;
  contentClassName?: string;
  fillDesktop?: boolean;
};

export function InfoPageShell({
  eyebrow,
  title,
  intro,
  children,
  showImportantPages = true,
  contentClassName = "",
  fillDesktop = false
}: InfoPageShellProps) {
  return (
    <main className={`min-h-dvh bg-slate-950 p-2 text-slate-100 md:p-4 ${fillDesktop ? "xl:h-dvh xl:overflow-hidden" : ""}`}>
      <div className={`mx-auto grid w-full max-w-[132rem] grid-cols-1 items-start gap-2 md:gap-4 xl:grid-cols-[140px_minmax(0,1fr)_140px] 2xl:grid-cols-[180px_minmax(0,1fr)_180px] min-[1900px]:grid-cols-[220px_minmax(0,1fr)_220px] min-[2200px]:max-w-[calc(100vw-1rem)] min-[2300px]:grid-cols-[260px_minmax(0,1fr)_260px] ${fillDesktop ? "xl:h-full" : ""}`}>
        <AdContainer
          placement="home-left-rail"
          variant="rail"
          adFormat="auto"
          label="Anzeige"
          className="sticky top-4 hidden h-[calc(100dvh-2rem)] min-h-0 xl:block"
          fullWidthResponsive
        />

        <div className={`grid min-w-0 gap-2 md:gap-4 ${fillDesktop ? "xl:h-full xl:min-h-0 xl:grid-rows-[auto_minmax(0,1fr)]" : ""}`}>
          <header className="arcade-panel punktlandung-info-header flex min-w-0 items-start justify-between gap-4 rounded-md border-slate-700/80 p-4 md:p-5">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">{eyebrow}</p>
              <h1 className="mt-1 break-words text-3xl font-black leading-tight text-white md:text-4xl">{title}</h1>
              {intro && <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">{intro}</p>}
            </div>
            <div className="shrink-0">
              <LegalBackLink />
            </div>
          </header>

          <div className={`grid min-w-0 gap-2 md:gap-4 ${fillDesktop ? "xl:h-full xl:min-h-0 xl:items-stretch" : "items-start"} ${showImportantPages ? "lg:grid-cols-[minmax(0,1fr)_18rem] 2xl:grid-cols-[minmax(0,1fr)_20rem]" : ""}`}>
            <article className={`arcade-panel punktlandung-info-content min-w-0 rounded-md border-slate-700/80 p-4 md:p-6 ${fillDesktop ? "xl:h-full xl:overflow-auto" : ""} ${contentClassName}`}>
              {children}
            </article>

            {showImportantPages && (
              <ImportantPages className={fillDesktop ? "xl:h-full xl:overflow-auto" : "lg:sticky lg:top-4"} />
            )}
          </div>
        </div>

        <AdContainer
          placement="home-right-rail"
          variant="rail"
          adFormat="auto"
          label="Anzeige"
          className="sticky top-4 hidden h-[calc(100dvh-2rem)] min-h-0 xl:block"
          fullWidthResponsive
        />
      </div>
    </main>
  );
}
