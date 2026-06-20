import {
  DistrictStanding,
  PreMatchMediaAsset,
  PreMatchRobotMetadata,
  PreMatchTeamProfile,
  QualificationSource,
  QualificationStatus,
  TeamAwardSummary,
  TeamSeasonEventSummary
} from '../types';

interface TBATeamSimple {
  key: string;
  team_number: number;
  nickname?: string;
  city?: string;
  state_prov?: string;
  country?: string;
}

interface TBAMedia {
  type: string;
  foreign_key?: string;
  preferred?: boolean;
  direct_url?: string;
  view_url?: string;
}

interface TBARobot {
  key?: string;
  year?: number;
  robot_name?: string;
  name?: string;
}

interface TBAAward {
  event_key: string;
  name: string;
  award_type?: number;
}

interface TBAEventSimple {
  key: string;
  name: string;
  event_type_string?: string;
  start_date?: string;
  city?: string;
  state_prov?: string;
  country?: string;
  district?: {
    key?: string;
    abbreviation?: string;
    display_name?: string;
  };
}

interface TBAEventStatus {
  overall_status_str?: string;
  qual?: {
    ranking?: {
      rank?: number;
    };
  };
  alliance?: {
    status_str?: string;
    name?: string;
  };
  playoff?: {
    status_str?: string;
  };
}

interface TBADistrictRef {
  key: string;
  abbreviation?: string;
  display_name?: string;
  year?: number;
}

interface TBADistrictRanking {
  team_key: string;
  rank?: number;
  point_total?: number;
  event_points?: Record<string, unknown>;
}

interface QualificationAssessment {
  status: QualificationStatus;
  reason: string;
  source: QualificationSource;
}

const getSeasonYearFromEventKey = (eventKey: string) => {
  const match = eventKey.match(/^(\d{4})/);
  return match ? parseInt(match[1] ?? `${new Date().getFullYear()}`, 10) : new Date().getFullYear();
};

const getLocationLabel = (city?: string, state?: string, country?: string) =>
  [city, state, country].filter(Boolean).join(', ') || 'Location unavailable';

const getString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value : null;

const getDisplayString = (value: unknown): string | null => {
  const text = getString(value);
  if (!text) return null;
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const getNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const buildMediaAsset = (media: TBAMedia, index: number): PreMatchMediaAsset | null => {
  const sourceType = media.type || 'unknown';
  const preferred = Boolean(media.preferred);
  const foreignKey = getString(media.foreign_key);
  const explicitViewUrl = getString(media.view_url);
  const explicitDirectUrl = getString(media.direct_url);

  let kind: PreMatchMediaAsset['kind'] = 'link';
  let viewUrl = explicitViewUrl;
  let directUrl = explicitDirectUrl ?? undefined;

  switch (sourceType) {
    case 'youtube':
      kind = 'video';
      viewUrl = viewUrl ?? (foreignKey ? `https://www.youtube.com/watch?v=${foreignKey}` : null);
      break;
    case 'imgur':
      kind = 'image';
      viewUrl = viewUrl ?? (foreignKey ? `https://imgur.com/${foreignKey}` : null);
      directUrl = directUrl ?? (foreignKey ? `https://i.imgur.com/${foreignKey}.jpg` : undefined);
      break;
    case 'cdphotothread':
      kind = 'image';
      viewUrl = viewUrl ?? (foreignKey ? `https://www.chiefdelphi.com/media/photos/${foreignKey}` : null);
      break;
    case 'instagram-image':
      kind = 'image';
      viewUrl = viewUrl ?? (foreignKey ? `https://www.instagram.com/p/${foreignKey}/` : null);
      break;
    case 'instagram-video':
      kind = 'video';
      viewUrl = viewUrl ?? (foreignKey ? `https://www.instagram.com/p/${foreignKey}/` : null);
      break;
    default:
      if (sourceType.includes('video')) {
        kind = 'video';
      } else if (sourceType.includes('image') || sourceType === 'avatar') {
        kind = 'image';
      }
      break;
  }

  if (!viewUrl) {
    return null;
  }

  return {
    id: `${sourceType}-${foreignKey || index}`,
    label: sourceType.replace(/-/g, ' '),
    kind,
    sourceType,
    preferred,
    viewUrl,
    directUrl
  };
};

const isChampionshipEvent = (event: TBAEventSimple) => {
  const eventType = (event.event_type_string || '').toLowerCase();
  return eventType.includes('championship') && !eventType.includes('district championship');
};

const isDistrictChampionshipEvent = (event: TBAEventSimple) =>
  (event.event_type_string || '').toLowerCase().includes('district championship');

const isQualifyingAward = (awardName: string) => {
  const normalized = awardName.toLowerCase();
  return (
    normalized.includes('first impact') ||
    normalized.includes("chairman's") ||
    normalized.includes('engineering inspiration') ||
    normalized.includes('rookie all-star')
  );
};

const getNumericPoints = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return (
      getNumber(record.total) ??
      getNumber(record.point_total) ??
      getNumber(record.total_points) ??
      getNumber(record.district_cmp) ??
      getNumber(record.qual_points) ??
      null
    );
  }
  return null;
};

const getDistrictStanding = (
  districtRef: TBADistrictRef | null,
  districtRankings: TBADistrictRanking[],
  seasonEvents: TBAEventSimple[],
  teamKey: string
): DistrictStanding | null => {
  if (!districtRef) return null;

  const ranking = districtRankings.find(entry => entry.team_key === teamKey);
  if (!ranking) {
    return {
      districtKey: districtRef.key,
      districtName: districtRef.display_name || districtRef.abbreviation || districtRef.key,
      rank: null,
      totalPoints: null,
      eventPoints: []
    };
  }

  const eventNameByKey = new Map(seasonEvents.map(event => [event.key, event.name]));
  const rawEventPoints = ranking.event_points && typeof ranking.event_points === 'object'
    ? Object.entries(ranking.event_points)
    : [];

  return {
    districtKey: districtRef.key,
    districtName: districtRef.display_name || districtRef.abbreviation || districtRef.key,
    rank: getNumber(ranking.rank),
    totalPoints: getNumber(ranking.point_total),
    eventPoints: rawEventPoints.map(([eventKey, value]) => ({
      eventKey,
      eventName: eventNameByKey.get(eventKey) || eventKey,
      points: getNumericPoints(value)
    }))
  };
};

const buildQualificationAssessment = (
  seasonEvents: TBAEventSimple[],
  seasonAwards: TeamAwardSummary[],
  seasonEventSummaries: TeamSeasonEventSummary[],
  districtStanding: DistrictStanding | null
): QualificationAssessment => {
  const championshipEvent = seasonEvents.find(isChampionshipEvent);
  if (championshipEvent) {
    return {
      status: 'likely_qualified',
      reason: `Already listed for ${championshipEvent.name}.`,
      source: 'direct_tba'
    };
  }

  const qualifyingAward = seasonAwards.find(award => isQualifyingAward(award.name));
  if (qualifyingAward) {
    return {
      status: 'likely_qualified',
      reason: `Won ${qualifyingAward.name} at ${qualifyingAward.eventName}.`,
      source: 'derived'
    };
  }

  const districtChampionshipWin = seasonEventSummaries.find(summary => {
    const eventType = summary.eventType.toLowerCase();
    if (!eventType.includes('district championship')) return false;
    const normalizedStatus = `${summary.overallStatus} ${summary.playoffStatus || ''} ${summary.allianceStatus || ''}`.toLowerCase();
    return normalizedStatus.includes('winner') || normalizedStatus.includes('won');
  });

  if (districtChampionshipWin) {
    return {
      status: 'likely_qualified',
      reason: `District Championship advancement signal found at ${districtChampionshipWin.name}.`,
      source: 'derived'
    };
  }

  if (districtStanding?.rank != null || districtStanding?.totalPoints != null) {
    const rankText = districtStanding.rank != null ? `rank ${districtStanding.rank}` : 'an unknown rank';
    const pointsText = districtStanding.totalPoints != null ? `${districtStanding.totalPoints} district points` : 'an unknown point total';
    return {
      status: 'unknown',
      reason: `District standing is ${rankText} with ${pointsText}. TBA alone is not enough to confirm Championship advancement.`,
      source: 'derived'
    };
  }

  const districtChampionshipEvent = seasonEvents.find(isDistrictChampionshipEvent);
  if (districtChampionshipEvent) {
    return {
      status: 'unknown',
      reason: `District Championship participation is visible, but advancement cannot be safely confirmed from TBA alone.`,
      source: 'derived'
    };
  }

  return {
    status: 'unknown',
    reason: 'No direct Championship registration or qualifying signal was found in TBA. Regional pool points and rolldowns are not reliably exposed.',
    source: 'unavailable'
  };
};

const fetchTbaJson = async <T>(path: string, tbaApiKey: string): Promise<T | null> => {
  const response = await fetch(`https://www.thebluealliance.com/api/v3${path}`, {
    headers: {
      'X-TBA-Auth-Key': tbaApiKey
    }
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`TBA API Error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  return (await response.json()) as T;
};

export interface EventTeamRosterRow {
  teamNumber: string;
  nickname: string;
}

export async function fetchEventTeamNumbers(eventKey: string, tbaApiKey: string): Promise<string[]> {
  if (!tbaApiKey) {
    throw new Error('ERROR: TBA API Key Missing');
  }

  const normalizedEventKey = eventKey.trim().toLowerCase();
  const teams = await fetchTbaJson<TBATeamSimple[]>(`/event/${normalizedEventKey}/teams/simple`, tbaApiKey);
  if (!teams || teams.length === 0) {
    throw new Error('No event teams were found in TBA for this event.');
  }

  return teams
    .map(team => String(team.team_number))
    .sort((a, b) => Number(a) - Number(b));
}

export async function fetchEventTeamsSimple(eventKey: string, tbaApiKey: string): Promise<EventTeamRosterRow[]> {
  if (!tbaApiKey) {
    throw new Error('ERROR: TBA API Key Missing');
  }

  const normalizedEventKey = eventKey.trim().toLowerCase();
  const teams = await fetchTbaJson<TBATeamSimple[]>(`/event/${normalizedEventKey}/teams/simple`, tbaApiKey);
  if (!teams || teams.length === 0) {
    throw new Error('No event teams were found in TBA for this event.');
  }

  return teams
    .map(team => ({
      teamNumber: String(team.team_number),
      nickname: team.nickname || ''
    }))
    .sort((a, b) => Number(a.teamNumber) - Number(b.teamNumber));
}

export async function fetchPreMatchTeamProfile(
  teamNumber: string,
  eventKey: string,
  tbaApiKey: string
): Promise<PreMatchTeamProfile> {
  if (!tbaApiKey) {
    throw new Error('ERROR: TBA API Key Missing');
  }

  const sanitizedTeamNumber = teamNumber.trim();
  const teamKey = `frc${sanitizedTeamNumber}`;
  const year = getSeasonYearFromEventKey(eventKey);

  const [
    teamResponse,
    mediaResponse,
    robotsResponse,
    awardsResponse,
    eventsResponse,
    statusesResponse,
    districtsResponse
  ] = await Promise.allSettled([
    fetchTbaJson<TBATeamSimple>(`/team/${teamKey}/simple`, tbaApiKey),
    fetchTbaJson<TBAMedia[]>(`/team/${teamKey}/media/${year}`, tbaApiKey),
    fetchTbaJson<TBARobot[]>(`/team/${teamKey}/robots`, tbaApiKey),
    fetchTbaJson<TBAAward[]>(`/team/${teamKey}/awards/${year}`, tbaApiKey),
    fetchTbaJson<TBAEventSimple[]>(`/team/${teamKey}/events/${year}/simple`, tbaApiKey),
    fetchTbaJson<Record<string, TBAEventStatus>>(`/team/${teamKey}/events/${year}/statuses`, tbaApiKey),
    fetchTbaJson<TBADistrictRef[]>(`/team/${teamKey}/districts`, tbaApiKey)
  ]);

  const team = teamResponse.status === 'fulfilled' ? teamResponse.value : null;
  const media = mediaResponse.status === 'fulfilled' && mediaResponse.value ? mediaResponse.value : [];
  const robots = robotsResponse.status === 'fulfilled' && robotsResponse.value ? robotsResponse.value : [];
  const awards = awardsResponse.status === 'fulfilled' && awardsResponse.value ? awardsResponse.value : [];
  const seasonEvents = eventsResponse.status === 'fulfilled' && eventsResponse.value ? eventsResponse.value : [];
  const statuses = statusesResponse.status === 'fulfilled' && statusesResponse.value ? statusesResponse.value : {};
  const districts = districtsResponse.status === 'fulfilled' && districtsResponse.value ? districtsResponse.value : [];

  const districtRef =
    districts.find(district => district.year === year) ||
    districts.find(district => district.key.startsWith(String(year))) ||
    null;

  const districtRankings = districtRef
    ? (await fetchTbaJson<TBADistrictRanking[]>(`/district/${districtRef.key}/rankings`, tbaApiKey)) || []
    : [];

  const districtStanding = getDistrictStanding(districtRef, districtRankings, seasonEvents, teamKey);
  const eventNameByKey = new Map(seasonEvents.map(event => [event.key, event.name]));

  const seasonAwards: TeamAwardSummary[] = awards
    .map(award => ({
      eventKey: award.event_key,
      eventName: eventNameByKey.get(award.event_key) || award.event_key,
      name: award.name,
      awardType: award.award_type
    }))
    .sort((a, b) => a.eventName.localeCompare(b.eventName));

  const districtPointsByEvent = new Map<string, number | null>(
    districtStanding?.eventPoints.map(entry => [entry.eventKey, entry.points]) || []
  );

  const seasonEventSummaries: TeamSeasonEventSummary[] = seasonEvents
    .map(event => {
      const status = statuses[event.key];
      return {
        eventKey: event.key,
        name: event.name,
        eventType: event.event_type_string || 'Event',
        startDate: event.start_date,
        location: getLocationLabel(event.city, event.state_prov, event.country),
        overallStatus: getDisplayString(status?.overall_status_str) || 'Status unavailable',
        qualRank: getNumber(status?.qual?.ranking?.rank),
        allianceStatus: getDisplayString(status?.alliance?.status_str) ?? getDisplayString(status?.alliance?.name),
        playoffStatus: getDisplayString(status?.playoff?.status_str),
        districtPoints: districtPointsByEvent.get(event.key) ?? null
      };
    })
    .sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));

  const robotMetadata: PreMatchRobotMetadata[] = robots
    .map((robot, index) => ({
      key: robot.key || `${teamKey}-${robot.year || year}-${index}`,
      year: robot.year || year,
      name: robot.robot_name || robot.name || `Robot ${index + 1}`
    }))
    .sort((a, b) => b.year - a.year);

  const mediaAssets = media
    .map(buildMediaAsset)
    .filter((asset): asset is PreMatchMediaAsset => asset !== null)
    .sort((a, b) => Number(b.preferred) - Number(a.preferred));

  const qualificationAssessment = buildQualificationAssessment(
    seasonEvents,
    seasonAwards,
    seasonEventSummaries,
    districtStanding
  );

  return {
    teamNumber: sanitizedTeamNumber,
    teamKey,
    year,
    nickname: team?.nickname || `Team ${sanitizedTeamNumber}`,
    location: getLocationLabel(team?.city, team?.state_prov, team?.country),
    mediaAssets,
    robotMetadata,
    seasonAwards,
    seasonEvents: seasonEventSummaries,
    districtStanding,
    qualificationStatus: qualificationAssessment.status,
    qualificationReason: qualificationAssessment.reason,
    qualificationSource: qualificationAssessment.source
  };
}
