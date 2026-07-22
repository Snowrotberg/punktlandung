import { AdContainer } from "@/components/AdContainer";
import { ButtonLink } from "@/components/Button";
import { InfoPageShell } from "@/components/InfoPageShell";

type SeoLandingPageProps = {
  eyebrow: string;
  title: string;
  intro: string;
  sections: Array<{
    title: string;
    body: string;
  }>;
};

export function SeoLandingPage({ eyebrow, title, intro, sections }: SeoLandingPageProps) {
  return (
    <InfoPageShell eyebrow={eyebrow} title={title} intro={intro} fillDesktop>
      <ButtonLink
        href="/"
        tone="primary"
        className="w-fit normal-case"
      >
        Jetzt kostenlos starten
      </ButtonLink>

      <section className="mt-6 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {sections.map((section) => (
          <div key={section.title} className="rounded-md bg-slate-950/72 p-5 ring-1 ring-slate-700">
            <h2 className="text-[22px] font-black leading-tight text-white">{section.title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">{section.body}</p>
          </div>
        ))}
      </section>

      <AdContainer
        placement="info-content-banner"
        variant="banner"
        adFormat="horizontal"
        label="Anzeige"
        className="mt-4 min-h-[96px] xl:h-[clamp(96px,14vh,150px)]"
        fullWidthResponsive
      />
    </InfoPageShell>
  );
}
