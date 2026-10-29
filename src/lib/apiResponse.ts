/** Parse an app API response without leaking raw HTML/parser errors into the UI. */
export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function statusMessage(status: number, fallback: string, html: boolean) {
  if (status === 404)
    return 'The app API endpoint was not found (HTTP 404). This usually means the frontend is hosted without the Yaari Node server. Run the full app locally or deploy the server, then try again.';
  if (status === 405)
    return 'The app API endpoint did not accept this request (HTTP 405). Check that the Yaari server is deployed, not just the static frontend.';
  if (status === 502 || status === 503 || status === 504)
    return `The app server or preview proxy could not complete the request (HTTP ${status}). Check that the Yaari server is running and reachable, then try again.`;
  if (html)
    return 'The app server returned a web page instead of JSON. Open the app from the running Yaari server; a static-only deployment cannot connect Gemini.';
  return fallback;
}

export async function readApiJson<T extends object>(
  response: Response,
  fallback = 'The app server returned an unexpected response. Please try again.',
): Promise<T> {
  const text = await response.text();
  const contentType = response.headers.get('content-type') || '';
  const html = /<html|<!doctype/i.test(text) || contentType.includes('text/html');
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    throw new ApiError(statusMessage(response.status, fallback, html), response.status);
  }
  const record =
    data && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : undefined;
  if (!response.ok) {
    const message =
      typeof record?.error === 'string' && record.error.trim()
        ? record.error
        : statusMessage(response.status, fallback, html);
    throw new ApiError(message, response.status);
  }
  if (!record) throw new ApiError(statusMessage(response.status, fallback, html), response.status);
  return record as T;
}
