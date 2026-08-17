import { InfoPageShell } from "@/components/InfoPageShell";
import { RedesignButtonLink } from "@/components/redesign";

type SeoLandingPageProps = {
  eyebrow: string;
  title: string;
  intro: string;
  ctaPlacement?: "top" | "bottom";
  hideContentAd?: boolean;
  plainContent?: boolean;
  sectionCardClassName?: string;
  sections: Array<{
    title: string;
    body: string;
  }>;
};

export function SeoLandingPage({ eyebrow, title, intro, sections, ctaPlacement = "top", hideContentAd = false, plainContent = false, sectionCardClassName = "" }: SeoLandingPageProps) {
  return (
    <InfoPageShell eyebrow={eyebrow} title={title} intro={intro} fillDesktop plainContent={plainContent}>
      {ctaPlacement === "top" && <RedesignButtonLink
        href="/"
        tone="primary"
        className="w-fit"
      >
        Jetzt kostenlos starten
      </RedesignButtonLink>}

      <section className={`${ctaPlacement === "top" ? "mt-6" : ""} grid gap-4 md:grid-cols-2 2xl:grid-cols-3`}>
        {sections.map((section) => (
          <div key={section.title} className={`rounded-xl border border-slate-700/80 bg-slate-900/76 p-5 ${sectionCardClassName}`}>
            <h2 className="text-[22px] font-black leading-tight text-white">{section.title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">{section.body}</p>
          </div>
        ))}
      </section>

      {ctaPlacement === "bottom" && <div className="mt-4 flex justify-end">
        <RedesignButtonLink href="/" tone="primary" className="w-fit">Jetzt kostenlos starten</RedesignButtonLink>
      </div>}

    </InfoPageShell>
  );
}
