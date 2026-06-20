import React from 'react';
import { ChevronLeft, Search } from 'lucide-react';
import { AdminButton, AdminInput, AdminSurface } from './AdminV4Primitives';

export interface AdminV4StatWikiDefinition {
  title: string;
  category: 'Firsthand' | 'Secondhand' | 'Derived' | 'Operational';
  definition?: string;
  formula: string;
  source: string;
  interpretation: string;
  limitations: string;
  whereAppears?: string[];
}

export interface AdminV4StatWikiEntry<K extends string = string> {
  key: K;
  info: AdminV4StatWikiDefinition;
}

function WikiField({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-g2-sm border border-slate-800 bg-slate-950/70 p-3">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-2 text-sm font-bold leading-relaxed text-slate-100">{value}</div>
    </div>
  );
}

export default function AdminV4StatWiki<K extends string>({
  activeKey,
  activeInfo,
  entries,
  onSelect,
  onBack
}: {
  activeKey: K;
  activeInfo: AdminV4StatWikiDefinition;
  entries: Array<AdminV4StatWikiEntry<K>>;
  onSelect: (key: K) => void;
  onBack: () => void;
}) {
  const activeEntryRef = React.useRef<HTMLButtonElement | null>(null);
  const [wikiSearch, setWikiSearch] = React.useState('');
  const normalizedWikiSearch = wikiSearch.trim().toLowerCase();
  const visibleEntries = React.useMemo(
    () =>
      normalizedWikiSearch
        ? entries.filter(({ key, info }) =>
          [
            String(key),
            info.title,
            info.category,
            info.definition || '',
            info.formula,
            info.source,
            info.interpretation,
            info.limitations,
            ...(info.whereAppears || [])
          ]
            .join(' ')
            .toLowerCase()
            .includes(normalizedWikiSearch)
        )
        : entries,
    [entries, normalizedWikiSearch]
  );
  const visibleWhereAppears = activeInfo.whereAppears || ['Admin V4'];

  React.useEffect(() => {
    activeEntryRef.current?.scrollIntoView({ block: 'center' });
  }, [activeKey]);

  return (
    <AdminSurface className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-300">Stats Wiki</div>
          <h2 className="mt-2 text-2xl font-black text-white">{activeInfo.title}</h2>
          <p className="mt-3 max-w-4xl text-sm font-semibold leading-relaxed text-slate-400">
            Plain-language definitions, formulas, data sources, interpretation guidance, limitations, and where the stat appears in Admin V4.
          </p>
        </div>
        <AdminButton onClick={onBack}>
          <ChevronLeft className="h-4 w-4" />
          Back
        </AdminButton>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[260px_1fr]">
        <aside className="admin-g2-sm max-h-[70vh] overflow-y-auto border border-slate-800 bg-slate-950 p-2">
          <div className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950 pb-2">
            <label className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500" htmlFor="adminv4-stat-wiki-search">
              Find Stat
            </label>
            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />
              <AdminInput
                id="adminv4-stat-wiki-search"
                value={wikiSearch}
                onChange={event => setWikiSearch(event.target.value)}
                className="w-full py-2 pl-9 text-xs"
                placeholder="PPA, DPR, rank..."
                aria-label="Search Stats Wiki entries"
              />
            </div>
          </div>
          <div className="mt-2">
          {visibleEntries.map(({ key, info }) => (
            <button
              key={key}
              ref={key === activeKey ? activeEntryRef : null}
              type="button"
              onClick={() => onSelect(key)}
              aria-current={key === activeKey ? 'true' : undefined}
              className={`admin-g2-sm mb-1 w-full px-3 py-2 text-left text-sm font-black transition-colors ${
                key === activeKey
                  ? 'bg-cyan-500/15 text-cyan-100 ring-1 ring-cyan-400/40'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-white'
              }`}
            >
              {info.title}
            </button>
          ))}
          {visibleEntries.length === 0 && (
            <div className="admin-g2-sm border border-amber-400/25 bg-amber-500/10 px-3 py-3 text-xs font-semibold leading-relaxed text-amber-100">
              No stat matches "{wikiSearch}". Try PPA, OPR, EPA, DPR, defense, rank, or volatility.
            </div>
          )}
          </div>
        </aside>

        <article className="space-y-4">
          <div className="admin-g2-sm inline-flex border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-cyan-100">
            {activeInfo.category}
          </div>
          <section className="admin-g2-sm border border-cyan-400/25 bg-cyan-500/10 p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">In A Hurry</div>
            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              <WikiField label="Use This When" value={activeInfo.interpretation} />
              <WikiField label="Check First" value={activeInfo.limitations} />
              <WikiField label="Find It In" value={visibleWhereAppears.join(', ')} />
            </div>
          </section>
          <div className="grid gap-3 md:grid-cols-2">
            <WikiField label="Plain-Language Definition" value={activeInfo.definition || activeInfo.formula} />
            <WikiField label="Firsthand / Secondhand / Derived" value={activeInfo.category} />
            <WikiField label="Formula" value={activeInfo.formula} />
            <WikiField label="Source Data" value={activeInfo.source} />
            <WikiField label="How To Interpret It" value={activeInfo.interpretation} />
            <WikiField label="Limitations" value={activeInfo.limitations} />
          </div>
          <AdminSurface className="p-4">
            <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">Where It Appears</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {visibleWhereAppears.map(place => (
                <span key={place} className="admin-g2-sm border border-slate-700 bg-slate-950 px-3 py-1 text-xs font-black text-slate-200">
                  {place}
                </span>
              ))}
            </div>
          </AdminSurface>
        </article>
      </div>
    </AdminSurface>
  );
}
