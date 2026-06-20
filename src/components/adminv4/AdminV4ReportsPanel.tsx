import React from 'react';
import { BookOpen, Database, Gauge, Swords, TrendingUp, Trophy } from 'lucide-react';
import AdminV4ReportsWorkflow, {
  type AdminV4ReportPack,
  type AdminV4WorkbookSection
} from './AdminV4ReportsWorkflow';

export default function AdminV4ReportsPanel({
  bestModelName,
  exportStatus,
  futureSimulationCount,
  latestSourceLabel,
  modelAction,
  pickListAvailable,
  pickListSelected,
  ppaTeamCount,
  preScoutEvidenceTeamCount,
  rawEvidenceRows,
  rawMissingSlotCount,
  rawAnomalyRowCount,
  sourceRowCount,
  unsyncedCount,
  nextMatchTitle,
  onExportWorkbook,
  onOpenModelProof,
  onOpenNextMatchPlan,
  onOpenNow,
  onOpenPickList,
  onOpenRawEvidence,
  onOpenStatsWiki
}: {
  bestModelName: string;
  exportStatus: 'idle' | 'loading' | 'success';
  futureSimulationCount: number;
  latestSourceLabel: string;
  modelAction: React.ReactNode;
  pickListAvailable: number;
  pickListSelected: number;
  ppaTeamCount: number;
  preScoutEvidenceTeamCount: number;
  rawEvidenceRows: number;
  rawMissingSlotCount: number;
  rawAnomalyRowCount: number;
  sourceRowCount: number;
  unsyncedCount: number;
  nextMatchTitle: string;
  onExportWorkbook: () => void;
  onOpenModelProof: () => void;
  onOpenNextMatchPlan: () => void;
  onOpenNow: () => void;
  onOpenPickList: () => void;
  onOpenRawEvidence: () => void;
  onOpenStatsWiki: () => void;
}) {
  const hasNextMatch = nextMatchTitle.length > 0;
  const hasModelProof = bestModelName.length > 0;
  const hasRawWarnings = rawMissingSlotCount > 0 || rawAnomalyRowCount > 0;
  const hasEvidenceSyncWarning = unsyncedCount > 0 || rawMissingSlotCount > 0;
  const recommendedPackKey = hasEvidenceSyncWarning
    ? 'evidence'
    : hasNextMatch
      ? 'drive-team'
      : pickListAvailable > 0
        ? 'alliance'
        : 'head-scout';
  const reportPacks: AdminV4ReportPack[] = [
    {
      key: 'head-scout',
      title: 'Head Scout Briefing',
      audience: 'Head scout',
      when: 'Between matches, after refresh, and before strategic calls.',
      contains: 'Operational Now briefing, next match, data trust, missing coverage, and the few actions worth doing next.',
      status: `${ppaTeamCount} range teams / ${futureSimulationCount} future quals`,
      tone: 'cyan',
      icon: <Gauge className="h-5 w-5" />,
      actions: [{
        label: 'Open Now',
        tone: 'cyan',
        icon: <Gauge className="h-4 w-4" />,
        onClick: onOpenNow
      }]
    },
    {
      key: 'drive-team',
      title: 'Drive Team Packet',
      audience: 'Drive coach / strategy huddle',
      when: 'Immediately before our next known match.',
      contains: 'Next match forecast, alliance expected range, opponent risk, role suggestions, RP path, and simulator entry.',
      status: hasNextMatch ? `${nextMatchTitle} ready` : 'No future known match',
      tone: hasNextMatch ? 'fuchsia' : 'amber',
      icon: <Swords className="h-5 w-5" />,
      actions: [{
        label: hasNextMatch ? 'Open Next Plan' : 'Open Matches',
        tone: hasNextMatch ? 'fuchsia' : 'amber',
        icon: <Swords className="h-4 w-4" />,
        onClick: onOpenNextMatchPlan
      }]
    },
    {
      key: 'alliance',
      title: 'Alliance Selection Board',
      audience: 'Pick-list lead',
      when: 'Before lunch, before alliance selection, and after every surprising result.',
      contains: 'Availability lanes, pick scores, expected/floor/ceiling values, role fit, defense value, tail risk, and shortlist status.',
      status: `${pickListAvailable} available / ${pickListSelected} selected`,
      tone: pickListAvailable > 0 ? 'emerald' : 'amber',
      icon: <Trophy className="h-5 w-5" />,
      actions: [{
        label: 'Open Pick List',
        tone: pickListAvailable > 0 ? 'emerald' : 'amber',
        icon: <Trophy className="h-4 w-4" />,
        onClick: onOpenPickList
      }]
    },
    {
      key: 'judges',
      title: 'Judges And Demo Proof',
      audience: 'Judges, mentors, and demo viewers',
      when: 'When someone asks what the model means or whether it is trustworthy.',
      contains: 'Model definition, validation, calibration, limitations, source map, and why expected range is a decision shape instead of one score.',
      status: hasModelProof ? `${bestModelName} leading` : 'Model proof pending data',
      tone: hasModelProof ? 'cyan' : 'amber',
      icon: <BookOpen className="h-5 w-5" />,
      actions: [
        {
          label: 'Math Wiki',
          tone: 'cyan',
          icon: <BookOpen className="h-4 w-4" />,
          onClick: onOpenStatsWiki
        },
        {
          label: 'Model Proof',
          tone: hasModelProof ? 'fuchsia' : 'amber',
          icon: <TrendingUp className="h-4 w-4" />,
          onClick: onOpenModelProof
        }
      ]
    },
    {
      key: 'evidence',
      title: 'Raw Evidence And Backup',
      audience: 'Data lead / device owner',
      when: 'When a number looks wrong, a row is missing, or the machine needs handoff protection.',
      contains: 'Pre Scout returns, raw rows, local archive, source cache, scout coverage gaps, Firebase sync state, and full device backup route.',
      status: unsyncedCount > 0 ? `${unsyncedCount} unsynced` : `${rawEvidenceRows} evidence rows`,
      tone: hasEvidenceSyncWarning ? 'amber' : 'slate',
      icon: <Database className="h-5 w-5" />,
      actions: [{
        label: hasRawWarnings ? 'Audit Rows' : 'Sync / Backup',
        tone: hasEvidenceSyncWarning ? 'amber' : 'slate',
        icon: <Database className="h-4 w-4" />,
        onClick: onOpenRawEvidence
      }]
    }
  ];

  const workbookSections: AdminV4WorkbookSection[] = [
    {
      group: 'Decision Layer',
      sheets: 'Range Insights, Range Ranking, Range Quals, Best Validated Quals',
      use: 'Head scout sees future strength as expected value plus uncertainty, not a naked number.'
    },
    {
      group: 'Match Strategy',
      sheets: 'Strategy Plans, Strategy Role Options, finals projections',
      use: 'Drive team gets alliance shape, role suggestions, RP path, and risk before a match.'
    },
    {
      group: 'Pick List',
      sheets: 'Alliance Picklist, Team Profiles, Team Curves, Defense Summary',
      use: 'Alliance lead can defend why a team belongs in a lane, what could go wrong, and which scout check should verify it.'
    },
    {
      group: 'Model Proof',
      sheets: 'Model Validation, Trust Calibration, Model Inputs, Before-Match Inputs',
      use: 'Judges and mentors can audit validation, trust calibration, input source, and limitations.'
    },
    {
      group: 'Raw Evidence',
      sheets: 'All Raw Data, Pre Scout Evidence, Raw V4 Data, Coverage Audit, Local Archive, Source Freshness, Scout Assignments, Scout Rewards',
      use: 'Data lead can trace every conclusion back to submitted rows and local device state.'
    }
  ];

  return (
    <AdminV4ReportsWorkflow
      summaries={[
        { label: 'Range Teams', value: ppaTeamCount },
        { label: 'Future Simulations', value: futureSimulationCount },
        { label: 'Pre Evidence', value: preScoutEvidenceTeamCount },
        { label: 'Raw Evidence Rows', value: rawEvidenceRows },
        { label: 'Source Rows', value: sourceRowCount },
        { label: 'Latest Source', value: latestSourceLabel }
      ]}
      reportPacks={reportPacks}
      recommendedPackKey={recommendedPackKey}
      workbookSections={workbookSections}
      modelAction={modelAction}
      exportStatus={exportStatus}
      onExportWorkbook={onExportWorkbook}
    />
  );
}
