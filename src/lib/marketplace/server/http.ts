import 'server-only';
export class RequestError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function assertSameOrigin(request: Request) {
  const allowed = (process.env.APP_ORIGIN || 'http://127.0.0.1:3000')
    .split(',')
    .map((x) => new URL(x.trim()).origin);
  const origin = request.headers.get('origin');
  if (
    request.headers.get('sec-fetch-site') === 'cross-site' ||
    (origin && !allowed.includes(origin))
  )
    throw new RequestError('Cross-origin requests are not allowed.', 403);
}
export async function readJSON(request: Request, limit = 32768) {
  const bytes = await readBody(request, limit);
  try {
    return JSON.parse(bytes.toString('utf8')) as Record<string, unknown>;
  } catch {
    throw new RequestError('Invalid JSON.');
  }
}
export async function readBody(request: Request, limit: number) {
  if (Number(request.headers.get('content-length') || 0) > limit)
    throw new RequestError('Request is too large.', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new RequestError('Request body is missing.');
  const parts: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > limit) {
      await reader.cancel();
      throw new RequestError('Request is too large.', 413);
    }
    parts.push(value);
  }
  return Buffer.concat(parts);
}
export function failure(error: unknown): Response {
  if (error instanceof RequestError)
    return Response.json(
      { error: error.message },
      {
        status: error.status,
        ...(error.status === 429 ? { headers: { 'retry-after': '10' } } : {}),
      },
    );
  // Provider errors can contain request headers or URLs. Return a fixed message
  // instead, but keep the real error in the server log for diagnosis.
  console.error('[marketplace] request failed:', error);
  return Response.json(
    { error: 'The request could not be completed. Check the service configuration and try again.' },
    { status: 503, headers: { 'retry-after': '3' } },
  );
}
