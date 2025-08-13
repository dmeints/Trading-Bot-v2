type ErrorEnvelope = {
  ok: false;
  code: string;
  message: string;
  requestId?: string;
  details?: unknown;
};

export async function apiFetch<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...(init || {}),
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  const text = await res.text();
  const maybeJson = (() => { try { return JSON.parse(text); } catch { return null; } })();

  if (!res.ok) {
    const err: ErrorEnvelope | null = maybeJson && typeof maybeJson === 'object' ? (maybeJson as any) : null;
    const msg = err?.message || `HTTP ${res.status}`;
    const e = new Error(msg);
    (e as any).server = err;
    throw e;
  }

  return (maybeJson as T) ?? (text as unknown as T);
}
