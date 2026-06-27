import React from 'react';
import { Copy, RefreshCw, Upload } from 'lucide-react';
import { TBA_API_KEY } from '../../config';
import { FirstEventsCredentials } from '../../utils/adminV4LocalStore';
import { AdminV4Settings } from '../../utils/adminV4Settings';
import { getAdminV4MatchLabel } from '../../utils/adminV4TestMode';
import { TBAMatch } from '../../utils/mathEngine';
import {
  checkScoutingRelayHealth,
  SCOUTING_RELAY_PROVIDERS,
  ScoutingRelayHealthResult
} from '../../utils/scoutingRelayReadiness';
import { AdminButton, AdminInput, AdminModal, AdminSurface, DangerZone } from './AdminV4Primitives';
import { MetricField } from './AdminV4UiAtoms';

const QUICK_EVENTS: Array<[string, string]> = [
  ['2026MNUM', '2026MNUM (MN North Star)'],
  ['2026cnsh', '2026cnsh (Shanghai)'],
  ['TEST', 'TEST EVENT']
];

const normalizeTeamKey = (teamKey: string) => teamKey.replace(/^frc/i, '');

export interface AdminV4SettingsEventSearchResult {
  key: string;
  name: string;
  short_name: string;
}

export interface AdminV4SettingsModalProps {
  apiKeyError: string;
  apiKeyStatus: string;
  eventKey: string;
  firstCredentialError: string;
  firstCredentialStatus: string;
  firstCredentials: FirstEventsCredentials | null;
  hasLocalTbaApiKey: boolean;
  isSearchingEvents: boolean;
  normalEventKey: string;
  open: boolean;
  ownTeamNumber: string;
  searchResults: AdminV4SettingsEventSearchResult[];
  searchYear: string;
  settings: AdminV4Settings;
  scoutIdentityPassphrase: string;
  scoutIdentityHash: string;
  scoutIdentityStatus: string;
  sourceRowCount: number;
  testModeMatchOptions: TBAMatch[];
  testModeScope: {
    sourceMatchCount: number;
    scopedPlayedMatchCount: number;
    futureMatchCount: number;
    scopedRecordCount: number;
    sourceRecordCount: number;
  };
  onClose: () => void;
  onCredentialUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRefreshFirstEventCache: () => void | Promise<void>;
  onRequestClearFirstCredentials: () => void | Promise<void>;
  onRequestClearTbaApiKey: () => void | Promise<void>;
  onRequestExitTestMode: () => void | Promise<void>;
  onSearchEvents: () => void | Promise<void>;
  onSetSearchYear: (value: string) => void;
  onSetScoutIdentityPassphrase: (value: string) => void;
  onSaveScoutIdentityPassphrase: () => void | Promise<void>;
  onCopyScoutIdentityPassphrase: () => void | Promise<void>;
  onUpdateSettings: (patch: Partial<AdminV4Settings>) => void;
  sanitizeTeamNumber: (value: string) => string;
}

export default function AdminV4SettingsModal({
  apiKeyError,
  apiKeyStatus,
  eventKey,
  firstCredentialError,
  firstCredentialStatus,
  firstCredentials,
  hasLocalTbaApiKey,
  isSearchingEvents,
  normalEventKey,
  open,
  ownTeamNumber,
  searchResults,
  searchYear,
  settings,
  scoutIdentityPassphrase,
  scoutIdentityHash,
  scoutIdentityStatus,
  sourceRowCount,
  testModeMatchOptions,
  testModeScope,
  onClose,
  onCredentialUpload,
  onRefreshFirstEventCache,
  onRequestClearFirstCredentials,
  onRequestClearTbaApiKey,
  onRequestExitTestMode,
  onSearchEvents,
  onSetSearchYear,
  onSetScoutIdentityPassphrase,
  onSaveScoutIdentityPassphrase,
  onCopyScoutIdentityPassphrase,
  onUpdateSettings,
  sanitizeTeamNumber
}: AdminV4SettingsModalProps) {
  const credentialState = hasLocalTbaApiKey || TBA_API_KEY || firstCredentials
    ? 'Ready enough'
    : 'Needs API keys';
  const sourceState = sourceRowCount > 0 ? `${sourceRowCount} source rows` : 'No source rows';
  const rehearsalState = settings.testModeEnabled ? 'Test Mode on' : 'Live by default';
  const [relayHealth, setRelayHealth] = React.useState<Partial<Record<string, ScoutingRelayHealthResult>>>({});
  const [relayChecking, setRelayChecking] = React.useState(false);

  const refreshRelayHealth = React.useCallback(async () => {
    setRelayChecking(true);
    const results = await Promise.all(SCOUTING_RELAY_PROVIDERS.map(provider => checkScoutingRelayHealth(provider)));
    setRelayHealth(Object.fromEntries(results.map(result => [result.key, result])));
    setRelayChecking(false);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    void refreshRelayHealth();
  }, [open, refreshRelayHealth]);

  return (
    <AdminModal open={open} title="Settings" onClose={onClose}>
      <div className="grid gap-5 lg:grid-cols-2">
        <AdminSurface className="p-4 lg:col-span-2">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">Competition Setup Check</div>
              <h3 className="mt-1 text-lg font-black text-white">Can this device run the event right now?</h3>
            </div>
            <div className="text-xs font-semibold text-slate-500">No secrets are shown here; this only reports local readiness.</div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <MetricField label="Event" value={eventKey || 'Missing'} />
            <MetricField label="Own Team" value={ownTeamNumber || 'Missing'} />
            <MetricField label="Credentials" value={credentialState} />
            <MetricField label="Sources" value={sourceState} />
            <MetricField label="Rehearsal" value={rehearsalState} />
          </div>
          <p className="mt-3 text-xs font-semibold leading-relaxed text-slate-500">
            If any tile says missing, fix it before match-day decisions. API keys and FIRST credentials remain local to this browser/device.
          </p>
        </AdminSurface>

        <AdminSurface className="p-4 lg:col-span-2">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-fuchsia-300">Relay Readiness</div>
              <h3 className="mt-1 text-lg font-black text-white">Fast Out-Of-Band Contact Paths</h3>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-relaxed text-slate-400">
                Firebase remains the official data sync. These relays are prepared as faster head-scout contact lanes: The Button first, DirectChat second.
              </p>
            </div>
            <AdminButton tone="fuchsia" onClick={() => void refreshRelayHealth()} disabled={relayChecking}>
              <RefreshCw className={`h-4 w-4 ${relayChecking ? 'animate-spin' : ''}`} />
              {relayChecking ? 'Checking' : 'Recheck Relays'}
            </AdminButton>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {SCOUTING_RELAY_PROVIDERS.map(provider => {
              const health = relayHealth[provider.key];
              const stateLabel = !health
                ? 'Not checked'
                : health.ok
                  ? `${health.latencyMs}ms`
                  : health.error || 'Unavailable';
              return (
                <div key={provider.key} className={`admin-g2-sm border p-4 ${
                  health?.ok
                    ? 'border-emerald-400/30 bg-emerald-500/10'
                    : health
                      ? 'border-amber-400/30 bg-amber-500/10'
                      : 'border-slate-800 bg-slate-950'
                }`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{provider.role}</div>
                      <h4 className="mt-1 text-base font-black text-white">{provider.label}</h4>
                    </div>
                    <span className={`admin-g2-sm border px-2 py-1 text-[10px] font-black uppercase ${
                      health?.ok
                        ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100'
                        : 'border-amber-300/30 bg-amber-300/10 text-amber-100'
                    }`}>
                      {health?.ok ? 'Ready' : health ? 'Check' : 'Waiting'}
                    </span>
                  </div>
                  <div className="mt-3 font-mono text-xs font-semibold text-slate-300">{provider.defaultBaseUrl}</div>
                  <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-500">{provider.detail}</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <MetricField label="Health" value={stateLabel} />
                    <MetricField label="Service" value={health?.service || 'Pending'} />
                  </div>
                </div>
              );
            })}
          </div>
        </AdminSurface>

        <AdminSurface className="p-4">
          <h3 className="text-lg font-black text-white">Event</h3>
          <div className="mt-3 grid gap-2">
            {QUICK_EVENTS.map(([key, label]) => (
              <AdminButton
                key={key}
                tone={normalEventKey === key ? 'cyan' : 'slate'}
                onClick={() => onUpdateSettings({ eventKey: key })}
              >
                {label}
              </AdminButton>
            ))}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-[120px_1fr]">
            <AdminInput type="number" value={searchYear} onChange={event => onSetSearchYear(event.target.value)} placeholder="Year" />
            <AdminButton onClick={() => void onSearchEvents()} disabled={isSearchingEvents}>Search TBA Events</AdminButton>
          </div>
          {searchResults.length > 0 && (
            <div className="admin-g2-sm mt-3 max-h-52 overflow-y-auto border border-slate-800 bg-slate-950 p-2">
              {searchResults.slice(0, 20).map(result => (
                <button
                  key={result.key}
                  type="button"
                  onClick={() => onUpdateSettings({ eventKey: result.key })}
                  className="admin-g2-sm block w-full px-3 py-2 text-left text-sm font-semibold text-slate-300 hover:bg-slate-900"
                >
                  {result.short_name || result.name} <span className="font-mono text-slate-500">{result.key}</span>
                </button>
              ))}
            </div>
          )}
        </AdminSurface>

        <AdminSurface className="p-4 lg:col-span-2">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="text-lg font-black text-white">Advanced Rehearsal Mode</h3>
              <p className="mt-1 max-w-3xl text-sm font-semibold text-slate-400">
                Session-only test mode for rehearsing one upcoming match. It does not persist after reload, so real event operations reopen live by default.
              </p>
            </div>
            <label className={`admin-g2-sm inline-flex cursor-pointer items-center gap-3 border px-4 py-3 text-sm font-black ${
              settings.testModeEnabled
                ? 'border-fuchsia-400/40 bg-fuchsia-500/15 text-fuchsia-50'
                : 'border-slate-700 bg-slate-950 text-slate-300'
            }`}>
              <input
                type="checkbox"
                checked={settings.testModeEnabled}
                onChange={event => onUpdateSettings({
                  testModeEnabled: event.target.checked,
                  testModeEventKey: settings.testModeEventKey || normalEventKey
                })}
              />
              Test Mode
            </label>
            {settings.testModeEnabled && (
              <AdminButton tone="rose" onClick={() => void onRequestExitTestMode()}>
                Exit Test Mode
              </AdminButton>
            )}
          </div>
          {settings.testModeEnabled && (
            <div className="admin-g2-sm mt-4 border border-fuchsia-400/30 bg-fuchsia-500/10 px-4 py-3 text-sm font-semibold text-fuchsia-100">
              Test Mode is active only for this session or fixture URL. Reloading without the fixture returns Admin V4 to live/current event data.
            </div>
          )}

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <div>
              <label className="block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Test Event</label>
              <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                <AdminInput
                  value={settings.testModeEventKey}
                  onChange={event => onUpdateSettings({ testModeEventKey: event.target.value.trim(), testModeMatchKey: '' })}
                  placeholder={normalEventKey}
                  className="w-full"
                />
                <AdminButton onClick={() => onUpdateSettings({ testModeEventKey: normalEventKey, testModeMatchKey: '' })}>
                  Use Current
                </AdminButton>
              </div>
              <p className="mt-2 text-xs font-semibold text-slate-500">
                Active event source: <span className="font-mono text-slate-300">{eventKey}</span>
              </p>
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Match To Predict</label>
              <select
                value={settings.testModeMatchKey}
                onChange={event => onUpdateSettings({ testModeMatchKey: event.target.value })}
                className="admin-g2-sm mt-2 w-full border border-slate-700 bg-slate-950 px-3 py-3 text-sm font-semibold text-white outline-none transition-colors focus:border-cyan-400"
              >
                <option value="">Select the next match...</option>
                {testModeMatchOptions.map(match => (
                  <option key={match.key} value={match.key}>
                    {getAdminV4MatchLabel(match)} · {match.alliances.red.team_keys.map(normalizeTeamKey).join('/')} vs {match.alliances.blue.team_keys.map(normalizeTeamKey).join('/')}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs font-semibold text-slate-500">
                {testModeMatchOptions.length > 0
                  ? `${testModeMatchOptions.length} matches loaded for selection.`
                  : 'Load a live schedule or upload a schedule before choosing a test match.'}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <MetricField label="Source Matches" value={String(testModeScope.sourceMatchCount)} />
            <MetricField label="Played Before Cutoff" value={String(testModeScope.scopedPlayedMatchCount)} />
            <MetricField label="Future From Cutoff" value={String(testModeScope.futureMatchCount)} />
            <MetricField label="Scoped Rows" value={`${testModeScope.scopedRecordCount}/${testModeScope.sourceRecordCount}`} />
          </div>
        </AdminSurface>

        <AdminSurface className="p-4">
          <h3 className="text-lg font-black text-white">Team And Local Credentials</h3>
          <label className="mt-3 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Own Team</label>
          <AdminInput value={ownTeamNumber} onChange={event => onUpdateSettings({ ownTeamNumber: sanitizeTeamNumber(event.target.value) })} placeholder="254" className="mt-2 w-full" />
          <label className="admin-g2-sm mt-4 inline-flex cursor-pointer items-center gap-2 border border-cyan-400/40 bg-cyan-500/15 px-4 py-3 text-sm font-black text-cyan-50 hover:bg-cyan-500/25">
            <Upload className="h-4 w-4" />Upload Local API Key JSON
            <input type="file" accept=".json,application/json" className="hidden" onChange={onCredentialUpload} />
          </label>
          <p className="mt-3 text-xs font-semibold leading-relaxed text-slate-500">
            Local API keys and FIRST credentials are stored only in this browser on this device. Do not upload them on a shared device; clear or rotate them if the device leaves team control.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <AdminButton onClick={() => void onRefreshFirstEventCache()}>Refresh FIRST Cache</AdminButton>
          </div>
          <div className="mt-4">
            <DangerZone title="Local Credential Danger Zone" description="These actions remove local credentials from this browser/device. They do not revoke external API keys.">
              <AdminButton tone="rose" onClick={() => void onRequestClearFirstCredentials()}>
                Clear FIRST
              </AdminButton>
              <AdminButton tone="rose" onClick={() => void onRequestClearTbaApiKey()}>
                Clear TBA
              </AdminButton>
            </DangerZone>
          </div>
          <div className="mt-4 space-y-2 text-sm text-slate-400">
            <div>TBA key: <span className="font-black text-slate-100">{hasLocalTbaApiKey ? 'Saved locally' : TBA_API_KEY ? 'Bundled config' : 'Missing'}</span></div>
            <div>FIRST: <span className="font-black text-slate-100">{firstCredentials ? `Saved for ${firstCredentials.username}` : 'Not saved'}</span></div>
            <div>Source rows: <span className="font-black text-slate-100">{sourceRowCount}</span></div>
          </div>
          {(firstCredentialStatus || apiKeyStatus) && (
            <div className="admin-g2-sm mt-3 border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
              {firstCredentialStatus || apiKeyStatus}
            </div>
          )}
          {(firstCredentialError || apiKeyError) && (
            <div className="admin-g2-sm mt-3 border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
              {firstCredentialError || apiKeyError}
            </div>
          )}
        </AdminSurface>

        <AdminSurface className="p-4">
          <h3 className="text-lg font-black text-white">Scout Identity Lock</h3>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-400">
            Once a scout attaches a name, scout-facing screens verify rename requests against a hash only. Admin V4 can keep the plaintext passphrase on this admin browser and in the admin-only backend reminder so you can copy it if you forget.
          </p>
          <label className="mt-4 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Admin Rename Passphrase</label>
          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
            <AdminInput
              type="text"
              value={scoutIdentityPassphrase}
              onChange={event => onSetScoutIdentityPassphrase(event.target.value)}
              placeholder="Enter passphrase to store on this admin device"
            />
            <AdminButton tone="cyan" onClick={() => void onSaveScoutIdentityPassphrase()}>
              Save Hash
            </AdminButton>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <AdminButton onClick={() => void onCopyScoutIdentityPassphrase()} disabled={!scoutIdentityPassphrase.trim()}>
              <Copy className="h-4 w-4" />Copy Passphrase
            </AdminButton>
          </div>
          <div className="mt-3 space-y-2 text-xs font-semibold text-slate-500">
            <div>Scout-facing hash: <span className="font-mono text-slate-300">{scoutIdentityHash.slice(0, 12)}...{scoutIdentityHash.slice(-8)}</span></div>
            <div>Plaintext reminder: <span className="font-black text-slate-100">{scoutIdentityPassphrase ? 'Loaded on this admin browser' : 'Not loaded on this admin browser'}</span></div>
          </div>
          {scoutIdentityStatus && (
            <div className="admin-g2-sm mt-3 border border-cyan-400/30 bg-cyan-500/10 p-3 text-sm font-semibold text-cyan-100">
              {scoutIdentityStatus}
            </div>
          )}
        </AdminSurface>
      </div>
    </AdminModal>
  );
}
