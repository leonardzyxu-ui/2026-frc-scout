export interface AdminV4TeamSearchSuggestion {
  teamNumber: string;
  teamName: string;
  matchLabel: string;
  score: number;
}

interface AdminV4TeamSearchCandidate {
  teamNumber: string;
  teamName: string;
  normalizedTeamName: string;
  normalizedDisplay: string;
  normalizedDisplayReversed: string;
}

export const sanitizeAdminV4TeamNumber = (value: string) => value.replace(/[^\d]/g, '');

export const normalizeAdminV4TeamSearchText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const buildAdminV4TeamSearchCandidates = (
  teamNumbers: string[],
  teamNameLookup: Record<string, string>
): AdminV4TeamSearchCandidate[] =>
  teamNumbers.map(teamNumber => {
    const teamName = teamNameLookup[teamNumber] || '';
    return {
      teamNumber,
      teamName,
      normalizedTeamName: normalizeAdminV4TeamSearchText(teamName),
      normalizedDisplay: normalizeAdminV4TeamSearchText(`${teamNumber} ${teamName}`),
      normalizedDisplayReversed: normalizeAdminV4TeamSearchText(`${teamName} ${teamNumber}`)
    };
  });

const scoreAdminV4TeamSearchCandidate = (
  candidate: AdminV4TeamSearchCandidate,
  rawInput: string
): Pick<AdminV4TeamSearchSuggestion, 'matchLabel' | 'score'> => {
  const numericInput = sanitizeAdminV4TeamNumber(rawInput);
  const normalizedInput = normalizeAdminV4TeamSearchText(rawInput);
  const searchTokens = normalizedInput.split(' ').filter(Boolean);

  if (numericInput && candidate.teamNumber === numericInput) {
    return { score: 100, matchLabel: 'Exact number' };
  }
  if (candidate.normalizedTeamName && candidate.normalizedTeamName === normalizedInput) {
    return { score: 95, matchLabel: 'Exact name' };
  }
  if (candidate.normalizedDisplay === normalizedInput || candidate.normalizedDisplayReversed === normalizedInput) {
    return { score: 90, matchLabel: 'Exact team' };
  }
  if (numericInput && candidate.teamNumber.startsWith(numericInput)) {
    return { score: 80 - Math.abs(candidate.teamNumber.length - numericInput.length), matchLabel: 'Number starts with' };
  }
  if (candidate.normalizedTeamName && candidate.normalizedTeamName.startsWith(normalizedInput)) {
    return { score: 75, matchLabel: 'Name starts with' };
  }
  if (
    searchTokens.length > 0 &&
    searchTokens.every(token =>
      candidate.normalizedTeamName.includes(token) ||
      candidate.normalizedDisplay.includes(token) ||
      candidate.normalizedDisplayReversed.includes(token)
    )
  ) {
    return { score: 65 - Math.max(0, searchTokens.length - 1), matchLabel: 'Name contains' };
  }
  if (
    normalizedInput &&
    (candidate.normalizedTeamName.includes(normalizedInput) || candidate.normalizedDisplay.includes(normalizedInput))
  ) {
    return { score: 55, matchLabel: 'Contains' };
  }
  return { score: 0, matchLabel: candidate.teamName ? 'Team name' : 'Team number' };
};

export const getAdminV4TeamSearchSuggestions = ({
  rawInput,
  teamNumbers,
  teamNameLookup,
  limit = 6
}: {
  rawInput: string;
  teamNumbers: string[];
  teamNameLookup: Record<string, string>;
  limit?: number;
}): AdminV4TeamSearchSuggestion[] => {
  const submittedInput = rawInput.trim();
  if (!submittedInput) return [];

  return buildAdminV4TeamSearchCandidates(teamNumbers, teamNameLookup)
    .map(candidate => {
      const scored = scoreAdminV4TeamSearchCandidate(candidate, submittedInput);
      return {
        teamNumber: candidate.teamNumber,
        teamName: candidate.teamName,
        matchLabel: scored.matchLabel,
        score: scored.score
      };
    })
    .filter(suggestion => suggestion.score > 0)
    .sort((left, right) => right.score - left.score || Number(left.teamNumber) - Number(right.teamNumber))
    .slice(0, limit);
};

export const resolveAdminV4TeamSearchInput = ({
  rawInput,
  teamNumbers,
  teamNameLookup
}: {
  rawInput: string;
  teamNumbers: string[];
  teamNameLookup: Record<string, string>;
}) => getAdminV4TeamSearchSuggestions({ rawInput, teamNumbers, teamNameLookup, limit: 1 })[0]?.teamNumber || '';
