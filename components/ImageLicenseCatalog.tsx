import licenseCatalog from "@/data/generated/image-licenses.generated.json";

type LicenseEntry = {
  fileName: string;
  artist: string;
  license: string;
  licenseUrl: string | null;
  sourceUrl: string;
};

const entries = licenseCatalog.entries as LicenseEntry[];

function groupLabel(fileName: string) {
  const firstCharacter = fileName.trim().charAt(0).toLocaleUpperCase("de");
  return /[A-ZÄÖÜ]/.test(firstCharacter) ? firstCharacter : "0–9";
}

const groupedEntries = entries.reduce<Map<string, LicenseEntry[]>>((groups, entry) => {
  const label = groupLabel(entry.fileName);
  const group = groups.get(label) ?? [];
  group.push(entry);
  groups.set(label, group);
  return groups;
}, new Map());

export function ImageLicenseCatalog() {
  return (
    <section>
      <h2 className="text-[22px] font-black leading-tight text-white">Einzelnachweise der Ratebilder</h2>
      <p className="mt-2">
        Der Katalog enthält {licenseCatalog.imageCount} derzeit im Spiel verwendete Wikimedia-Dateien. Öffne einen
        Buchstaben und anschließend eine Datei, um Urheber, Lizenz und Originalseite aufzurufen.
      </p>

      <div className="mt-4 space-y-2">
        {[...groupedEntries.entries()].map(([label, group]) => (
          <details key={label} className="rounded-md border border-slate-700/80 bg-slate-950/45">
            <summary className="cursor-pointer px-4 py-3 font-black text-white marker:text-emerald-300">
              {label} <span className="ml-1 text-xs text-slate-400">({group.length})</span>
            </summary>
            <div className="space-y-2 border-t border-slate-700/70 p-3">
              {group.map((entry, entryIndex) => (
                <details key={`${entry.fileName}-${entry.sourceUrl}-${entryIndex}`} className="rounded border border-slate-800 bg-slate-950/60 px-3 py-2">
                  <summary className="cursor-pointer break-words font-bold text-slate-200 marker:text-emerald-300">
                    {entry.fileName} <span className="text-xs font-semibold text-emerald-300">· {entry.license}</span>
                  </summary>
                  <div className="mt-2 space-y-2 border-t border-slate-800 pt-2 text-xs leading-5 text-slate-400">
                    <p className="break-words">
                      <span className="font-black text-slate-300">Urheber/Quelle:</span> {entry.artist}
                    </p>
                    <p>
                      <span className="font-black text-slate-300">Lizenz:</span>{" "}
                      {entry.licenseUrl ? (
                        <a
                          href={entry.licenseUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-bold text-emerald-300 hover:text-emerald-200"
                        >
                          {entry.license}
                        </a>
                      ) : (
                        entry.license
                      )}
                    </p>
                    <a
                      href={entry.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block font-bold text-emerald-300 hover:text-emerald-200"
                    >
                      Originaldatei und vollständige Angaben bei Wikimedia Commons
                    </a>
                  </div>
                </details>
              ))}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
