export const TBA_KEY_MISSING_MESSAGE =
  'TBA API Key is missing. Add a valid TBA key in Admin V4 Settings, or use the TBA key controls on this page, then reload matches.';

export const TBA_KEY_INVALID_MESSAGE =
  'TBA API Key is invalid. This browser has a saved TBA key, but The Blue Alliance rejected it. Open Admin V4 Settings > Team And Local Credentials > Clear TBA, then upload a fresh key JSON from The Blue Alliance account page.';

const TBA_AUTH_ERROR_PATTERNS = [
  /X-TBA-Auth-Key is invalid/i,
  /X-TBA-Auth-Key is a required header/i,
  /TBA API Key Missing/i,
  /TBA API Key is invalid/i,
  /TBA API Key is missing/i
];

export const isTbaAuthErrorMessage = (message: string) =>
  TBA_AUTH_ERROR_PATTERNS.some(pattern => pattern.test(message));

export const isTbaAuthError = (error: unknown) =>
  error instanceof Error && isTbaAuthErrorMessage(error.message);

export const getTbaUserFacingError = (error: unknown) => {
  if (!(error instanceof Error)) return 'TBA request failed with an unknown error.';
  if (/invalid/i.test(error.message)) return TBA_KEY_INVALID_MESSAGE;
  if (/required header|missing/i.test(error.message)) return TBA_KEY_MISSING_MESSAGE;
  return error.message;
};

export const buildTbaHttpError = (resourceLabel: string, status: number, statusText: string, responseText: string) => {
  if (status === 401 && /invalid/i.test(responseText)) {
    return new Error(TBA_KEY_INVALID_MESSAGE);
  }
  if (status === 401 && /required header|missing/i.test(responseText)) {
    return new Error(TBA_KEY_MISSING_MESSAGE);
  }
  return new Error(`Failed to fetch ${resourceLabel}: ${status} ${statusText} - ${responseText}`);
};
