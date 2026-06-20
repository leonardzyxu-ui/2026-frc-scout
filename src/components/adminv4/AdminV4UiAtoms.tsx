import React from 'react';

export function SummaryCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="admin-g2-sm border border-slate-800 bg-slate-900/60 px-5 py-4">
      <div className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-black text-white">{value}</div>
    </div>
  );
}

export function MetricField({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-g2-sm border border-slate-800 bg-slate-950/70 px-3 py-2">
      <div className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

export function EmbeddedPanelLoading({ label }: { label: string }) {
  return (
    <div className="admin-g2-sm border border-slate-800 bg-slate-950 px-4 py-6 text-center text-sm font-black text-cyan-100">
      {label}
    </div>
  );
}

export function AdminEmptyState({
  title,
  why,
  action,
  className = ''
}: {
  title: string;
  why: string;
  action: string;
  className?: string;
}) {
  return (
    <div className={`admin-g2-sm flex flex-col justify-center border border-slate-800 bg-slate-950 px-4 py-5 text-left ${className}`}>
      <div className="text-sm font-black text-slate-100">{title}</div>
      <div className="mt-2 text-xs font-semibold leading-relaxed text-slate-400">Why: {why}</div>
      <div className="mt-1 text-xs font-black leading-relaxed text-cyan-100">Next: {action}</div>
    </div>
  );
}

export function FocusHeader({
  eyebrow,
  title,
  description,
  action
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3 border-b border-slate-800 pb-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0 lg:min-w-64 lg:flex-1">
        {eyebrow && <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">{eyebrow}</div>}
        <h2 className="mt-1 break-words text-2xl font-black text-white">{title}</h2>
        {description && <p className="mt-2 max-w-3xl break-words text-sm font-semibold text-slate-400">{description}</p>}
      </div>
      {action && <div className="w-full min-w-0 lg:w-auto lg:max-w-[60%]">{action}</div>}
    </div>
  );
}

export const getTeamBadgeClass = (teamNumber: string, ownTeamNumber: string, searchedTeamNumber: string) => {
  const isOwnTeam = ownTeamNumber !== '' && ownTeamNumber === teamNumber;
  const isSearchedTeam = searchedTeamNumber !== '' && searchedTeamNumber === teamNumber;

  if (isOwnTeam && isSearchedTeam) {
    return 'bg-orange-500 text-slate-950 ring-2 ring-sky-400 ring-offset-2 ring-offset-slate-950';
  }

  if (isOwnTeam) {
    return 'bg-orange-500 text-slate-950';
  }

  if (isSearchedTeam) {
    return 'bg-sky-500 text-slate-950';
  }

  return 'border border-slate-700 bg-slate-950 text-slate-200';
};

export function TeamBadge({
  teamNumber,
  ownTeamNumber,
  searchedTeamNumber,
  teamName
}: {
  teamNumber: string;
  ownTeamNumber: string;
  searchedTeamNumber: string;
  teamName?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`admin-g2-sm inline-flex items-center px-3 py-1 text-sm font-black ${getTeamBadgeClass(
          teamNumber,
          ownTeamNumber,
          searchedTeamNumber
        )}`}
      >
        {teamNumber}
      </span>
      {teamName && <span className="text-xs text-slate-500">{teamName}</span>}
    </div>
  );
}

export function TeamList({
  teams,
  ownTeamNumber,
  searchedTeamNumber,
  teamNameLookup
}: {
  teams: string[];
  ownTeamNumber: string;
  searchedTeamNumber: string;
  teamNameLookup: Record<string, string>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {teams.length === 0 ? (
        <span className="text-slate-500">TBD</span>
      ) : (
        teams.map(team => (
          <span
            key={team}
            title={teamNameLookup[team] || ''}
            className={`admin-g2-sm inline-flex items-center px-3 py-1 text-xs font-black ${getTeamBadgeClass(
              team,
              ownTeamNumber,
              searchedTeamNumber
            )}`}
          >
            {team}
          </span>
        ))
      )}
    </div>
  );
}
