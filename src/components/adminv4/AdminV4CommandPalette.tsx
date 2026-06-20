import React from 'react';
import { Search, X } from 'lucide-react';
import { AdminButton, AdminIconButton, AdminInput } from './AdminV4Primitives';
import type { AdminV4SmartSearchResult } from '../../utils/adminV4SmartSearch';

const NO_MATCH_FALLBACK_PHRASES = [
  'bad numbers',
  'assign scouts',
  'future matches',
  'manual simulator',
  'why DPR',
  'source freshness',
  'API keys',
  'export for judges'
];

const COMMAND_PALETTE_EXAMPLE_PHRASES = [
  'bad numbers',
  'assign scouts',
  'future matches',
  'why DPR',
  'API keys',
  'export for judges'
];

export default function AdminV4CommandPalette({
  open,
  inputRef,
  searchInput,
  searchError,
  suggestions,
  onClose,
  onOpenSearchInput,
  onOpenSuggestion,
  onSetSearchError,
  onSetSearchInput
}: {
  open: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
  searchInput: string;
  searchError: string;
  suggestions: AdminV4SmartSearchResult[];
  onClose: () => void;
  onOpenSearchInput: (value: string) => void;
  onOpenSuggestion: (suggestion: AdminV4SmartSearchResult) => void;
  onSetSearchError: (value: string) => void;
  onSetSearchInput: (value: string) => void;
}) {
  const commandInputRef = React.useRef<HTMLInputElement | null>(null);
  const setCommandInputRef = React.useCallback(
    (node: HTMLInputElement | null) => {
      commandInputRef.current = node;
      if (typeof inputRef === 'function') {
        inputRef(node);
      } else if (inputRef) {
        inputRef.current = node;
      }
    },
    [inputRef]
  );

  React.useEffect(() => {
    if (!open) return;
    window.requestAnimationFrame(() => {
      commandInputRef.current?.focus();
      commandInputRef.current?.select();
    });
  }, [open]);

  if (!open) return null;

  const hasSearchInput = searchInput.trim().length > 0;
  const bestSuggestion = suggestions[0] || null;
  const openBestButtonLabel = bestSuggestion
    ? `Open ${bestSuggestion.title}. ${bestSuggestion.badge}. ${bestSuggestion.matchLabel}. ${bestSuggestion.description}`
    : 'Open the best matching team, workflow, stat, tool, or help result';
  const openBestButtonText = bestSuggestion ? `Open ${bestSuggestion.title}` : 'Open';
  const openBest = () => {
    if (bestSuggestion) {
      onOpenSuggestion(bestSuggestion);
      return;
    }
    onOpenSearchInput(searchInput);
  };
  const useSearchPhrase = (phrase: string) => {
    onSetSearchInput(phrase);
    onSetSearchError('');
    requestAnimationFrame(() => {
      commandInputRef.current?.focus();
      commandInputRef.current?.select();
    });
  };
  const openNumberedSuggestion = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!(event.altKey || event.ctrlKey) || !/^[1-9]$/.test(event.key)) return false;
    const suggestion = suggestions[Number(event.key) - 1];
    if (!suggestion) return false;
    event.preventDefault();
    onOpenSuggestion(suggestion);
    return true;
  };
  const focusAdjacentPaletteResult = (event: React.KeyboardEvent<HTMLButtonElement>, direction: 1 | -1) => {
    const buttons = Array.from(
      document
        .getElementById('adminv4-command-palette-results')
        ?.querySelectorAll<HTMLButtonElement>('button') || []
    );
    const currentIndex = buttons.indexOf(event.currentTarget);
    if (currentIndex === -1 || buttons.length === 0) return;
    event.preventDefault();
    buttons[(currentIndex + direction + buttons.length) % buttons.length]?.focus();
  };

  const resultTitle = hasSearchInput ? 'Best Matches' : 'Quick Needs';

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-slate-950/75 px-3 py-16 backdrop-blur-md md:py-24"
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Admin V4 command palette"
        className="admin-g2-lg w-full max-w-3xl overflow-hidden border border-cyan-400/30 bg-slate-950 shadow-md shadow-slate-950/40"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Command Palette</div>
            <h2 className="mt-1 text-lg font-black text-white">I need...</h2>
          </div>
          <AdminIconButton onClick={onClose} aria-label="Close command palette" title="Close command palette">
            <X className="h-4 w-4" />
          </AdminIconButton>
        </div>

        <form
          className="border-b border-slate-800 p-4"
          onSubmit={event => {
            event.preventDefault();
            openBest();
          }}
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
            <AdminInput
              ref={setCommandInputRef}
              value={searchInput}
              onChange={event => {
                onSetSearchInput(event.target.value);
                onSetSearchError('');
              }}
              onKeyDown={event => {
                if (openNumberedSuggestion(event)) return;
                if (event.key === 'ArrowDown' && suggestions.length > 0) {
                  event.preventDefault();
                  document
                    .getElementById('adminv4-command-palette-results')
                    ?.querySelector<HTMLButtonElement>('button')
                    ?.focus();
                  return;
                }
                if (event.key === 'Escape') {
                  event.preventDefault();
                  onClose();
                  return;
                }
                if (event.key === 'Enter') {
                  event.preventDefault();
                  openBest();
                }
              }}
              className="w-full py-4 pl-11 pr-24 text-base"
              placeholder="Search teams, stats, workflows, or type what you need"
              aria-label="Search teams, stats, workflows, tools, and help"
            />
            <button
              type="submit"
              aria-label={openBestButtonLabel}
              title={openBestButtonLabel}
              className="admin-g2-sm absolute right-1.5 top-1/2 min-h-11 -translate-y-1/2 bg-cyan-600 px-3 text-xs font-black text-white hover:bg-cyan-500"
            >
              Open
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-500">
            <span>Try scouts, simulator, pick list, DPR, Excel, sync, or a team name.</span>
            <span className="admin-g2-sm border border-slate-800 bg-slate-900 px-2 py-0.5 font-black uppercase tracking-[0.12em] text-slate-300">Esc closes</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">Try</span>
            {COMMAND_PALETTE_EXAMPLE_PHRASES.map(phrase => (
              <button
                key={phrase}
                type="button"
                onClick={() => useSearchPhrase(phrase)}
                className="admin-g2-sm border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-[11px] font-black text-slate-300 transition-colors hover:border-cyan-400/30 hover:bg-cyan-500/10 hover:text-cyan-100"
              >
                {phrase}
              </button>
            ))}
          </div>
          {searchError && (
            <div className="admin-g2-sm mt-3 border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100">
              {searchError}
            </div>
          )}
        </form>

        <div id="adminv4-command-palette-results" className="max-h-[55vh] overflow-y-auto p-2">
          <div className="px-2 py-2">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{resultTitle}</div>
            {!hasSearchInput && (
              <div className="mt-1 text-xs font-semibold leading-relaxed text-slate-400">
                Choose a quick need below, press Alt/Option+1-8, or type normal competition language like "assign scouts", "why DPR", "future matches", "API keys", or "export for judges".
              </div>
            )}
          </div>
          {suggestions.length > 0 && !hasSearchInput ? (
            <div className="grid gap-2 md:grid-cols-2">
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion.id}
                  type="button"
                  aria-label={`Open competition shortcut: ${suggestion.title}. ${suggestion.description}`}
                  title={`Open ${suggestion.title}`}
                  onClick={() => onOpenSuggestion(suggestion)}
                  onKeyDown={event => {
                    if (event.key === 'ArrowDown') focusAdjacentPaletteResult(event, 1);
                    if (event.key === 'ArrowUp') focusAdjacentPaletteResult(event, -1);
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      onClose();
                    }
                  }}
                  className="admin-g2-sm flex min-h-24 w-full flex-col justify-between border border-slate-800 bg-slate-900/60 px-3 py-3 text-left transition-colors hover:border-cyan-400/35 hover:bg-cyan-500/10 focus:border-cyan-400/40 focus:bg-cyan-500/10 focus:outline-none"
                >
                  <span>
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-300">{suggestion.badge}</span>
                      <span className="admin-g2-sm border border-slate-700 bg-slate-950 px-2 py-0.5 text-[10px] font-black text-slate-300">
                        Alt {index + 1}
                      </span>
                    </span>
                    <span className="mt-2 block text-sm font-black text-white">{suggestion.title}</span>
                    <span className="mt-1 block text-xs font-semibold leading-relaxed text-slate-400">{suggestion.description}</span>
                  </span>
                  <span className="mt-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{suggestion.matchLabel}</span>
                </button>
              ))}
            </div>
          ) : suggestions.length > 0 ? (
            <div className="space-y-1">
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion.id}
                  type="button"
                  aria-label={`Open ${suggestion.title}. ${suggestion.badge}. ${suggestion.matchLabel}. ${suggestion.description}`}
                  onClick={() => onOpenSuggestion(suggestion)}
                  onKeyDown={event => {
                    if (event.key === 'ArrowDown') focusAdjacentPaletteResult(event, 1);
                    if (event.key === 'ArrowUp') focusAdjacentPaletteResult(event, -1);
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      onClose();
                    }
                  }}
                  className="admin-g2-sm flex w-full items-start justify-between gap-4 border border-transparent px-3 py-3 text-left hover:border-cyan-400/30 hover:bg-cyan-500/10 focus:border-cyan-400/40 focus:bg-cyan-500/10 focus:outline-none"
                >
                    <span className="flex min-w-0 gap-3">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center admin-g2-sm border border-slate-800 bg-slate-900 text-[10px] font-black text-slate-300">
                      {hasSearchInput && index === 0 ? 'Enter' : `Alt ${index + 1}`}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black text-white">{suggestion.title}</span>
                      <span className="mt-1 block text-xs font-semibold leading-relaxed text-slate-500">{suggestion.description}</span>
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="admin-g2-sm border border-cyan-400/25 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-200">
                      {suggestion.badge}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{suggestion.matchLabel}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="admin-g2-sm border border-slate-800 bg-slate-900/60 px-4 py-5 text-sm font-semibold text-slate-400">
              <div className="font-black text-slate-100">No command matches yet.</div>
              <div className="mt-1">Pick a recovery phrase, try a team name, or clear the field for Quick Needs.</div>
              <div className="mt-4 flex flex-wrap gap-2">
                {NO_MATCH_FALLBACK_PHRASES.map(phrase => (
                  <button
                    key={phrase}
                    type="button"
                    aria-label={`Search for ${phrase}`}
                    title={`Search for ${phrase}`}
                    onClick={() => useSearchPhrase(phrase)}
                    className="admin-g2-sm border border-cyan-400/25 bg-cyan-500/10 px-3 py-2 text-xs font-black text-cyan-100 transition-colors hover:bg-cyan-500/15"
                  >
                    {phrase}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 px-4 py-3">
          <div className="text-[11px] font-semibold text-slate-500">This searches teams, workflows, data rooms, tools, and stat help.</div>
          <AdminButton
            tone="slate"
            onClick={openBest}
            disabled={!bestSuggestion && !searchInput.trim()}
            aria-label={openBestButtonLabel}
            title={openBestButtonLabel}
          >
            {openBestButtonText}
          </AdminButton>
        </div>
      </section>
    </div>
  );
}
