import { RedesignButtonLink, RedesignRoot } from "@/components/redesign/RedesignPrimitives";

function BrandPin({ className, color }: { className?: string; color: string }) {
  return (
    <svg viewBox="0 0 64 84" aria-hidden="true" className={className}>
      <path
        d="M32 82C32 82 6 48 6 28C6 12.5 17.6 3 32 3C46.4 3 58 12.5 58 28C58 48 32 82 32 82Z"
        fill="white"
      />
      <path
        d="M32 73C32 73 13 45 13 28C13 16.4 21.2 9 32 9C42.8 9 51 16.4 51 28C51 45 32 73 32 73Z"
        fill={color}
      />
      <circle cx="32" cy="27" r="12" fill="white" />
    </svg>
  );
}

export default function NotFound() {
  return (
    <RedesignRoot>
    <main className="relative min-h-screen overflow-x-hidden bg-slate-950 px-3 py-4 text-slate-50 sm:px-6 sm:py-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(244,63,94,0.14),transparent_28rem),radial-gradient(circle_at_82%_32%,rgba(99,102,241,0.18),transparent_30rem)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(148,163,184,0.055)_1px,transparent_1px),linear-gradient(0deg,rgba(148,163,184,0.055)_1px,transparent_1px)] bg-[size:56px_56px]" />

      <section className="relative mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-7xl items-center justify-center sm:min-h-[calc(100vh-3rem)]">
        <div className="arcade-panel relative w-full max-w-[76rem] overflow-hidden rounded-3xl p-5 sm:p-8 lg:p-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_12%,rgba(244,63,94,0.14),transparent_22rem),radial-gradient(circle_at_88%_18%,rgba(99,102,241,0.18),transparent_24rem)]" />

          <div className="relative">
            <div className="flex flex-col items-center justify-center gap-5 sm:gap-6 lg:flex-row lg:gap-8 xl:gap-10">
              <div className="flex min-w-0 max-w-full flex-col items-center gap-2 text-center sm:flex-row sm:gap-3 lg:text-left">
                <h1 className="max-w-full text-[clamp(2.4rem,11vw,4.6rem)] font-black leading-none text-white lg:text-[clamp(3.4rem,4.8vw,5.4rem)]">
                  Bruchlandung
                </h1>
                <BrandPin
                  color="#fb7185"
                  className="h-[clamp(3rem,12vw,4.4rem)] w-auto shrink-0 drop-shadow-[0_0_18px_rgba(251,113,133,0.75)] lg:h-[clamp(3.6rem,5vw,5rem)]"
                />
              </div>

              <div className="flex min-w-0 flex-col items-center text-center lg:items-start lg:text-left">
                <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:gap-4 lg:gap-5">
                  <p className="text-[clamp(4rem,16vw,6rem)] font-black leading-none text-white lg:text-[clamp(4.4rem,6vw,6.3rem)]">
                    404
                  </p>
                  <p className="max-w-[19rem] text-[clamp(0.75rem,2.2vw,0.95rem)] font-black uppercase leading-snug tracking-[0.16em] text-rose-300 sm:max-w-[17rem] lg:max-w-[15rem]">
                    Dieser Ort liegt außerhalb unserer Karte.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-center sm:mt-8">
              <RedesignButtonLink
                href="/"
                tone="primary"
                className="min-h-12 w-full max-w-xs px-5 text-base sm:w-auto"
              >
                Zur Startseite
              </RedesignButtonLink>
            </div>
          </div>
        </div>
      </section>
    </main>
    </RedesignRoot>
  );
}
