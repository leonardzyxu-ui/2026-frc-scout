import React from 'react';
import {
  BookOpen,
  ChevronLeft,
  Command,
  Home,
  MoreHorizontal,
  RefreshCw,
  Search,
  Settings,
  Swords,
  SearchCheck
} from 'lucide-react';
import {
  AdminButton,
  AdminIconButton,
  AdminInput,
  AdminWorkflowItem
} from './AdminV4Primitives';
import type { AdminV4SmartSearchResult } from '../../utils/adminV4SmartSearch';

export type AdminV4CommandBriefTone = 'rose' | 'amber' | 'emerald' | 'fuchsia' | 'cyan';

export interface AdminV4CommandBrief {
  label: string;
  detail: string;
  actionLabel: string;
  tone: AdminV4CommandBriefTone;
  onAction: () => void;
}

const briefToneClass = (tone: AdminV4CommandBriefTone) => {
  if (tone === 'rose') return 'border-rose-400/30 bg-rose-500/10 text-rose-50 hover:bg-rose-500/15';
  if (tone === 'amber') return 'border-amber-400/30 bg-amber-500/10 text-amber-50 hover:bg-amber-500/15';
  if (tone === 'emerald') return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-50 hover:bg-emerald-500/15';
  if (tone === 'fuchsia') return 'border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-50 hover:bg-fuchsia-500/15';
  return 'border-cyan-400/30 bg-cyan-500/10 text-cyan-50 hover:bg-cyan-500/15';
};

export function AdminV4CommandBar<TWorkflow extends string>({
  activeTab,
  activePanel,
  activeWorkspaceKey,
  activeWorkspaceLabel,
  allKnownTeams,
  backgroundRefreshing,
  eventKey,
  isTeamSearchOpen,
  loading,
  moreWorkflowMenuOpen,
  primaryWorkspaceItems,
  teamNameLookup,
  teamSearchError,
  teamSearchInput,
  teamSearchSuggestions,
  testModeActive,
  testModeEnabled,
  testModeSelectedMatchLabel,
  workspaceItems,
  adminBackLabel,
  commandBrief,
  searchInputRef,
  onBack,
  onManualSimulator,
  onOpenCommandPalette,
  onOpenSearchedTeam,
  onOpenSettings,
  onOpenSearchSuggestion,
  onOpenStatsWiki,
  onOpenWorkflow,
  onOpenWorkflowItem,
  onRefresh,
  onSetMoreWorkflowMenuOpen,
  onSetTeamSearchError,
  onSetTeamSearchInput,
  onSetTeamSearchOpen
}: {
  activeTab: string;
  activePanel?: string | null;
  activeWorkspaceKey: TWorkflow;
  activeWorkspaceLabel: string;
  allKnownTeams: string[];
  backgroundRefreshing: boolean;
  eventKey: string;
  isTeamSearchOpen: boolean;
  loading: boolean;
  moreWorkflowMenuOpen: boolean;
  primaryWorkspaceItems: AdminWorkflowItem<TWorkflow>[];
  teamNameLookup: Record<string, string>;
  teamSearchError: string;
  teamSearchInput: string;
  teamSearchSuggestions: AdminV4SmartSearchResult[];
  testModeActive: boolean;
  testModeEnabled: boolean;
  testModeSelectedMatchLabel: string;
  workspaceItems: AdminWorkflowItem<TWorkflow>[];
  adminBackLabel: string;
  commandBrief?: AdminV4CommandBrief | null;
  searchInputRef?: React.Ref<HTMLInputElement>;
  onBack: () => void;
  onManualSimulator: () => void;
  onOpenCommandPalette: () => void;
  onOpenSearchedTeam: (value: string) => void;
  onOpenSettings: () => void;
  onOpenSearchSuggestion: (suggestion: AdminV4SmartSearchResult) => void;
  onOpenStatsWiki: () => void;
  onOpenWorkflow: (tab: TWorkflow) => void;
  onOpenWorkflowItem?: (item: AdminWorkflowItem<TWorkflow>) => void;
  onRefresh: () => void;
  onSetMoreWorkflowMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onSetTeamSearchError: (value: string) => void;
  onSetTeamSearchInput: (value: string) => void;
  onSetTeamSearchOpen: (value: boolean) => void;
}) {
  const topSearchInputRef = React.useRef<HTMLInputElement | null>(null);
  const setTopSearchInputRef = React.useCallback(
    (node: HTMLInputElement | null) => {
      topSearchInputRef.current = node;
      if (typeof searchInputRef === 'function') {
        searchInputRef(node);
      } else if (searchInputRef) {
        searchInputRef.current = node;
      }
    },
    [searchInputRef]
  );
  const moreWorkspaceItems = workspaceItems.filter(
    item => !primaryWorkspaceItems.some(primary => (primary.id || primary.key) === (item.id || item.key))
  );
  const title = activeTab === 'wiki' ? 'Stats Wiki' : activeWorkspaceLabel;
  const openWorkflowItem = (item: AdminWorkflowItem<TWorkflow>) => {
    if (onOpenWorkflowItem) {
      onOpenWorkflowItem(item);
      return;
    }
    onOpenWorkflow(item.key);
  };
  const isWorkflowItemActive = (item: AdminWorkflowItem<TWorkflow>) =>
    activeWorkspaceKey === item.key && activeTab !== 'wiki' && (item.panel ? activePanel === item.panel : !activePanel);
  const trimmedSearchInput = teamSearchInput.trim();
  const hasSearchInput = trimmedSearchInput.length > 0;
  const showSearchPanel = isTeamSearchOpen && (teamSearchSuggestions.length > 0 || hasSearchInput);
  const bestSearchSuggestion = teamSearchSuggestions[0] || null;
  const openSearchButtonLabel = !hasSearchInput
    ? 'Show quick needs for teams, workflows, stats, tools, settings, and data panels'
    : bestSearchSuggestion
    ? `Open ${bestSearchSuggestion.title}. ${bestSearchSuggestion.badge}. ${bestSearchSuggestion.matchLabel}. ${bestSearchSuggestion.description}`
    : 'Open the best matching team, workflow, stat, tool, or data panel';
  const openSearchButtonText = hasSearchInput ? 'Open' : 'Needs';
  const submitTeamSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!teamSearchInput.trim()) {
      onOpenCommandPalette();
      return;
    }
    onOpenSearchedTeam(teamSearchInput);
  };
  const commandBriefAccessibleLabel = commandBrief
    ? `Next action: ${commandBrief.label}. ${commandBrief.detail.replace(/[.?!]\s*$/, '')}. Opens ${commandBrief.actionLabel}.`
    : '';
  const focusAdjacentSearchResult = (event: React.KeyboardEvent<HTMLButtonElement>, direction: 1 | -1) => {
    const buttons = Array.from(
      document
        .getElementById('adminv4-team-search-suggestions')
        ?.querySelectorAll<HTMLButtonElement>('button') || []
    );
    const currentIndex = buttons.indexOf(event.currentTarget);
    if (currentIndex === -1 || buttons.length === 0) return;
    event.preventDefault();
    buttons[(currentIndex + direction + buttons.length) % buttons.length]?.focus();
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/95 shadow-sm shadow-slate-950/20 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-3 py-2 md:gap-3 md:px-6 md:py-3">
        <div className="relative flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between xl:gap-3">
          <div className="flex min-w-0 items-center gap-2 pr-48 md:gap-3 md:pr-0">
            <AdminIconButton onClick={onBack} aria-label={adminBackLabel} title={adminBackLabel}>
              {activeTab === 'command' ? <Home className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </AdminIconButton>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-300 md:gap-2 md:text-xs md:tracking-[0.2em]">
                <span>Admin V4</span>
                <span className="font-mono text-slate-500">{eventKey}</span>
                {testModeEnabled && (
                  <span className={`admin-g2-sm px-2 py-0.5 tracking-[0.14em] ${
                    testModeActive
                      ? 'border border-fuchsia-400/40 bg-fuchsia-500/15 text-fuchsia-100'
                      : 'border border-amber-400/40 bg-amber-500/15 text-amber-100'
                  }`}>
                    {testModeActive ? `TEST ${testModeSelectedMatchLabel}` : 'TEST MODE'}
                  </span>
                )}
              </div>
              <div className="truncate text-lg font-black text-white md:mt-1 md:text-xl">{title}</div>
            </div>
          </div>

          <form onSubmit={submitTeamSearch} className="min-w-0 flex-1 xl:max-w-xl">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <AdminInput
                type="text"
                name="teamSearch"
                list="adminv4-top-team-search"
                ref={setTopSearchInputRef}
                value={teamSearchInput}
                onChange={event => {
                  onSetTeamSearchInput(event.target.value);
                  onSetTeamSearchError('');
                  onSetTeamSearchOpen(true);
                }}
                onFocus={() => onSetTeamSearchOpen(true)}
                onClick={() => onSetTeamSearchOpen(true)}
                onMouseDown={() => onSetTeamSearchOpen(true)}
                onBlur={() => window.setTimeout(() => onSetTeamSearchOpen(false), 120)}
                onKeyDown={event => {
                  if (event.key === 'ArrowDown' && showSearchPanel) {
                    event.preventDefault();
                    document
                      .getElementById('adminv4-team-search-suggestions')
                      ?.querySelector<HTMLButtonElement>('button')
                      ?.focus();
                    return;
                  }
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  onOpenSearchedTeam(event.currentTarget.value);
                }}
                className="w-full py-3 pl-10 pr-28 sm:pr-36"
                placeholder="Search or ask: team, stat, scouts, export, API keys"
                aria-label="Search teams, stats, workflows, tools, settings, and data panels"
                aria-keyshortcuts="/"
                title="Search teams, stats, workflows, tools, settings, and data panels. Press / to focus search or Cmd/Ctrl+K for I need..."
                aria-expanded={showSearchPanel}
                aria-controls="adminv4-team-search-suggestions"
              />
              <button
                type="submit"
                aria-label={openSearchButtonLabel}
                title={openSearchButtonLabel}
                className="admin-g2-sm absolute right-1.5 top-1/2 inline-flex min-h-10 -translate-y-1/2 items-center gap-1.5 bg-cyan-600 px-3 py-2 text-xs font-black text-white hover:bg-cyan-500"
              >
                <SearchCheck className="h-3.5 w-3.5" />
                <span>{openSearchButtonText}</span>
              </button>
              <datalist id="adminv4-top-team-search">
                {allKnownTeams.flatMap(teamNumber => {
                  const teamName = teamNameLookup[teamNumber] || '';
                  return [
                    <option key={`${teamNumber}:number`} value={teamNumber}>{teamName || `Team ${teamNumber}`}</option>,
                    teamName ? <option key={`${teamNumber}:name`} value={teamName}>{teamNumber}</option> : null,
                    teamName ? <option key={`${teamNumber}:display`} value={`${teamNumber} ${teamName}`}>{teamName}</option> : null
                  ].filter(Boolean);
                })}
              </datalist>
              {showSearchPanel && (
                <div
                  id="adminv4-team-search-suggestions"
                  role="listbox"
                  className="admin-g2 absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden border border-cyan-400/30 bg-slate-950 shadow-md shadow-slate-950/30"
                >
                  <div className="border-b border-slate-800 px-3 py-2">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                      {hasSearchInput ? 'Best Match First · Enter opens it' : 'Quick Needs · fastest next click'}
                    </div>
                  </div>
                  {teamSearchSuggestions.length > 0 ? (
                    teamSearchSuggestions.map(suggestion => (
                        <button
                        key={suggestion.id}
                        type="button"
                        role="option"
                        aria-label={`Open ${suggestion.title}. ${suggestion.badge}. ${suggestion.matchLabel}. ${suggestion.description}`}
                        onMouseDown={event => {
                          event.preventDefault();
                          onOpenSearchSuggestion(suggestion);
                        }}
                        onClick={() => onOpenSearchSuggestion(suggestion)}
                        onKeyDown={event => {
                          if (event.key === 'ArrowDown') focusAdjacentSearchResult(event, 1);
                          if (event.key === 'ArrowUp') focusAdjacentSearchResult(event, -1);
                          if (event.key === 'Escape') {
                            event.preventDefault();
                            onSetTeamSearchOpen(false);
                            topSearchInputRef.current?.focus();
                          }
                        }}
                        className="flex w-full items-start justify-between gap-3 border-b border-slate-900 px-3 py-2.5 text-left last:border-b-0 hover:bg-cyan-500/10"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-black text-white">{suggestion.title}</span>
                          <span className="mt-0.5 block truncate text-xs font-semibold text-slate-500">{suggestion.description}</span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          <span className="admin-g2-sm border border-cyan-400/25 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-200">
                            {suggestion.badge}
                          </span>
                          <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{suggestion.matchLabel}</span>
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="border-b border-slate-900 px-3 py-3">
                      <div className="text-sm font-black text-white">No matches for "{trimmedSearchInput}"</div>
                      <div className="mt-1 text-xs font-semibold text-slate-500">
                        Open the larger I need... palette for recovery phrases, shortcuts, and more forgiving search.
                      </div>
                      <button
                        type="button"
                        onMouseDown={event => event.preventDefault()}
                        onClick={onOpenCommandPalette}
                        className="admin-g2-sm mt-3 inline-flex min-h-10 items-center gap-2 border border-cyan-400/25 bg-cyan-500/10 px-3 py-2 text-xs font-black text-cyan-100 transition-colors hover:bg-cyan-500/15"
                      >
                        <Command className="h-3.5 w-3.5" />
                        Open I need...
                      </button>
                    </div>
                  )}
                </div>
              )}
              {teamSearchError && (
                <div className="admin-g2-sm mt-2 w-full border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100">
                  {teamSearchError}
                </div>
              )}
            </div>
          </form>

          <div className="absolute right-0 top-0 flex items-center gap-1.5 md:static md:gap-2">
            <AdminIconButton className="md:hidden" tone="fuchsia" onClick={onManualSimulator} aria-label="Manual Simulator" title="Manual Simulator">
              <Swords className="h-4 w-4" />
            </AdminIconButton>
            <AdminButton className="!inline-flex !min-h-10 !px-3 !py-2 text-xs lg:!hidden" tone="cyan" onClick={onOpenCommandPalette} aria-label="I need..." title="Open command palette">
              <Command className="h-4 w-4" />
              <span>I need</span>
            </AdminButton>
            <AdminButton className="!hidden md:!inline-flex" tone="fuchsia" onClick={onManualSimulator}>
              <Swords className="h-4 w-4" />
              <span>Manual Simulator</span>
            </AdminButton>
            <AdminButton className="!hidden lg:!inline-flex" tone="cyan" onClick={onOpenCommandPalette}>
              <Command className="h-4 w-4" />
              <span>I need...</span>
            </AdminButton>
            <AdminIconButton tone="emerald" onClick={onRefresh} disabled={loading || backgroundRefreshing} aria-label="Refresh data" title="Refresh data">
              <RefreshCw className={`h-4 w-4 ${loading || backgroundRefreshing ? 'animate-spin' : ''}`} />
            </AdminIconButton>
            <AdminIconButton className="!hidden md:!inline-flex" onClick={onOpenStatsWiki} aria-label="Open Stats Wiki" title="Open Stats Wiki">
              <BookOpen className="h-4 w-4" />
            </AdminIconButton>
            <AdminIconButton onClick={onOpenSettings} aria-label="Settings" title="Settings">
              <Settings className="h-4 w-4" />
            </AdminIconButton>
            <div className="relative md:hidden">
              <AdminIconButton
                tone="cyan"
                onClick={() => onSetMoreWorkflowMenuOpen(open => !open)}
                aria-label="Admin workflows"
                aria-haspopup="menu"
                aria-expanded={moreWorkflowMenuOpen}
                title="Admin workflows"
              >
                <MoreHorizontal className="h-4 w-4" />
              </AdminIconButton>
              {moreWorkflowMenuOpen && (
                <div role="menu" className="admin-g2 absolute right-0 top-full z-50 mt-2 max-h-[70vh] w-64 overflow-y-auto border border-slate-800 bg-slate-950 shadow-md shadow-slate-950/30">
                  <div className="border-b border-slate-800 px-3 py-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">Open What You Need</div>
                    <div className="mt-1 text-xs font-semibold leading-relaxed text-slate-500">Pick the situation, then the app opens the right workspace.</div>
                  </div>
                  {workspaceItems.map(item => (
                    <button
                      key={item.id || item.key}
                      type="button"
                      role="menuitem"
                      aria-label={`${item.label}: ${item.description}. ${item.mobileNeed || ''}`.trim()}
                      title={`${item.label}: ${item.description}. ${item.mobileNeed || ''}`.trim()}
                      onClick={() => openWorkflowItem(item)}
                      className={`flex w-full items-start gap-3 border-b border-slate-900 px-3 py-3 text-left last:border-b-0 hover:bg-cyan-500/10 ${
                        isWorkflowItemActive(item) ? 'bg-cyan-500/10 text-cyan-100' : 'text-slate-300'
                      }`}
                    >
                      <span className="mt-0.5 shrink-0">{item.icon}</span>
                      <span>
                        <span className="block text-sm font-black">{item.label}</span>
                        <span className="mt-0.5 block text-xs font-semibold text-slate-500">{item.description}</span>
                        {item.mobileNeed && <span className="mt-1 block text-xs font-semibold leading-relaxed text-cyan-100/75">{item.mobileNeed}</span>}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {commandBrief && (
          <button
            type="button"
            onClick={commandBrief.onAction}
            aria-label={commandBriefAccessibleLabel}
            title={commandBriefAccessibleLabel}
            className={`admin-g2-sm flex min-h-11 w-full items-center justify-between gap-3 border px-3 py-2 text-left transition-colors ${briefToneClass(commandBrief.tone)}`}
          >
            <span className="min-w-0">
              <span className="mr-2 text-[10px] font-black uppercase tracking-[0.18em] opacity-75">Next</span>
              <span className="font-black text-white">{commandBrief.label}</span>
              <span className="ml-2 hidden text-xs font-semibold opacity-80 md:inline">{commandBrief.detail}</span>
            </span>
            <span className="admin-g2-sm shrink-0 border border-white/15 bg-white/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white/85">
              {commandBrief.actionLabel}
            </span>
          </button>
        )}

        <nav className="hidden flex-wrap gap-2 pb-1 md:flex" aria-label="Admin workflows">
          {primaryWorkspaceItems.map(item => {
            const isActive = isWorkflowItemActive(item);
            return (
              <button
                key={item.id || item.key}
                type="button"
                onClick={() => openWorkflowItem(item)}
                aria-label={`${item.label}: ${item.description}`}
                title={`${item.label}: ${item.description}`}
                className={`admin-g2-sm inline-flex shrink-0 items-center gap-2 border px-3 py-2 text-sm font-black transition-colors ${isActive ? 'border-cyan-400/40 bg-cyan-500/15 text-cyan-100' : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:bg-slate-800'}`}
              >
                {item.icon}{item.label}
              </button>
            );
          })}
          {moreWorkspaceItems.length > 0 && (
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => onSetMoreWorkflowMenuOpen(open => !open)}
                className={`admin-g2-sm inline-flex items-center gap-2 border px-3 py-2 text-sm font-black transition-colors ${
                  moreWorkspaceItems.some(item => item.key === activeWorkspaceKey) && activeTab !== 'wiki'
                    ? 'border-cyan-400/40 bg-cyan-500/15 text-cyan-100'
                    : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:bg-slate-800'
                }`}
                aria-haspopup="menu"
                aria-expanded={moreWorkflowMenuOpen}
              >
                <MoreHorizontal className="h-4 w-4" />More
              </button>
              {moreWorkflowMenuOpen && (
                <div role="menu" className="admin-g2 absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden border border-slate-800 bg-slate-950 shadow-md shadow-slate-950/30">
                  {moreWorkspaceItems.map(item => (
                    <button
                      key={item.id || item.key}
                      type="button"
                      role="menuitem"
                      aria-label={`${item.label}: ${item.description}`}
                      title={`${item.label}: ${item.description}`}
                      onClick={() => openWorkflowItem(item)}
                      className={`flex w-full items-start gap-3 border-b border-slate-900 px-3 py-3 text-left last:border-b-0 hover:bg-cyan-500/10 ${
                        isWorkflowItemActive(item) ? 'bg-cyan-500/10 text-cyan-100' : 'text-slate-300'
                      }`}
                    >
                      <span className="mt-0.5 shrink-0">{item.icon}</span>
                      <span>
                        <span className="block text-sm font-black">{item.label}</span>
                        <span className="mt-0.5 block text-xs font-semibold text-slate-500">{item.description}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
