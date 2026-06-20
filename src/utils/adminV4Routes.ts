export type AdminV4WorkflowTab = 'command' | 'sorter' | 'predictor' | 'pickList' | 'visualize' | 'import' | 'export';
export type AdminV4Tab = AdminV4WorkflowTab | 'results' | 'rawEditor' | 'teams' | 'simulator' | 'wiki';
export type AdminV4DataPanel = 'collection' | 'imports' | 'audit' | 'sources' | 'models' | 'scouts' | 'backup' | 'preScout';
export type AdminV4MetricSurfaceKey = 'teams' | 'matches' | 'simulator' | 'reports' | 'default';

export interface AdminV4RouteOptions {
  tab: string;
  panel?: string | null;
  mode?: string | null;
  match?: string | null;
  team?: string | null;
  from?: string | null;
  stat?: string | null;
}

const PRESERVED_CONTEXT_KEYS = ['fixture', 'event', 'eventKey', 'year'] as const;
const ADMIN_V4_CONTROL_KEYS = ['tab', 'panel', 'mode', 'match', 'team', 'from', 'stat'];

export const ADMIN_ROUTE_TAB_BY_WORKFLOW: Record<AdminV4WorkflowTab, string> = {
  command: 'now',
  sorter: 'teams',
  predictor: 'matches',
  pickList: 'pick-list',
  visualize: 'visualize',
  import: 'data',
  export: 'reports'
};

export const workflowFromAdminRouteTab = (rawTab: string | null): AdminV4WorkflowTab | null => {
  const normalized = (rawTab || '').trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'now' || normalized === 'command') return 'command';
  if (normalized === 'teams' || normalized === 'sorter') return 'sorter';
  if (normalized === 'matches' || normalized === 'predictor') return 'predictor';
  if (normalized === 'pick-list' || normalized === 'picklist') return 'pickList';
  if (normalized === 'visualize') return 'visualize';
  if (normalized === 'data' || normalized === 'import') return 'import';
  if (normalized === 'reports' || normalized === 'export') return 'export';
  return null;
};

export const dataPanelFromAdminRouteParam = (rawPanel: string | null): AdminV4DataPanel | null => {
  const normalized = (rawPanel || '').trim();
  const allowedPanels: AdminV4DataPanel[] = ['collection', 'imports', 'audit', 'sources', 'models', 'scouts', 'backup', 'preScout'];
  return allowedPanels.includes(normalized as AdminV4DataPanel) ? normalized as AdminV4DataPanel : null;
};

export const activeWorkspaceKeyFromTab = (tab: AdminV4Tab): AdminV4WorkflowTab => {
  if (tab === 'results' || tab === 'simulator') return 'predictor';
  if (tab === 'rawEditor') return 'import';
  if (tab === 'teams' || tab === 'sorter') return 'sorter';
  if (tab === 'pickList') return 'pickList';
  if (tab === 'wiki') return 'command';
  return tab;
};

export const adminReturnTabFromRouteParam = (rawTab: string | null): AdminV4Tab => {
  const normalized = (rawTab || '').trim().toLowerCase();
  if (normalized === 'teams') return 'teams';
  if (normalized === 'simulator' || normalized === 'manual') return 'simulator';
  if (normalized === 'raweditor' || normalized === 'raw-editor') return 'rawEditor';
  if (normalized === 'results') return 'results';
  return workflowFromAdminRouteTab(normalized) ?? 'command';
};

export const teamReturnTabFromRouteParam = (rawTab: string | null): AdminV4Tab => {
  if (!rawTab) return 'sorter';
  const returnTab = adminReturnTabFromRouteParam(rawTab);
  return returnTab === 'teams' || returnTab === 'wiki' ? 'sorter' : returnTab;
};

export const adminRouteParamFromTab = (tab: AdminV4Tab) => {
  if (tab === 'teams') return 'teams';
  if (tab === 'simulator') return 'simulator';
  if (tab === 'rawEditor') return 'raw-editor';
  if (tab === 'results') return 'results';
  if (tab === 'wiki') return 'wiki';
  return ADMIN_ROUTE_TAB_BY_WORKFLOW[activeWorkspaceKeyFromTab(tab)];
};

export const metricSurfaceFromTab = (tab: AdminV4Tab): AdminV4MetricSurfaceKey => {
  if (tab === 'sorter' || tab === 'teams') return 'teams';
  if (tab === 'command' || tab === 'predictor' || tab === 'results') return 'matches';
  if (tab === 'simulator') return 'simulator';
  if (tab === 'export') return 'reports';
  return 'default';
};

export const getAdminV4PreservedContextParams = (currentSearch: string | URLSearchParams) => {
  const currentParams = typeof currentSearch === 'string' ? new URLSearchParams(currentSearch) : currentSearch;
  const preserved = new URLSearchParams();
  PRESERVED_CONTEXT_KEYS.forEach(key => {
    const value = currentParams.get(key);
    if (value) preserved.set(key, value);
  });
  return preserved;
};

export const buildAdminV4Route = (
  currentSearch: string | URLSearchParams,
  options: AdminV4RouteOptions
) => {
  const params = getAdminV4PreservedContextParams(currentSearch);
  ADMIN_V4_CONTROL_KEYS.forEach(key => params.delete(key));
  params.set('tab', options.tab);
  if (options.panel) params.set('panel', options.panel);
  if (options.mode) params.set('mode', options.mode);
  if (options.match) params.set('match', options.match);
  if (options.team) params.set('team', options.team);
  if (options.from) params.set('from', options.from);
  if (options.stat) params.set('stat', options.stat);
  return `/adminv4?${params.toString()}`;
};
