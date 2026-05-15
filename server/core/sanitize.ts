/**
 * Shared error-message sanitizer used by every public-facing handler.
 *
 * Two jobs:
 *   1. Strip any `key=...` fragment in case a network-layer error echoes the
 *      full Gemini URL with the API key embedded in the query string.
 *   2. Reduce a multi-line message to its first line and clamp length so
 *      stack traces and verbose upstream payloads cannot leak to clients.
 */

const MAX_LENGTH = 240

export const sanitizeErrorMessage = (message: string): string => {
  const firstLine = message.split('\n')[0]
  return firstLine.replace(/key=[^&\s]+/gi, 'key=***').slice(0, MAX_LENGTH)
}
