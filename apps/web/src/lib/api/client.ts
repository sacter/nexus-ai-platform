const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export async function api<T = unknown>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = (await res.json()) as T;
  if (!res.ok) {
    const message =
      typeof data === 'object' && data !== null && 'message' in data
        ? (data as Record<string, unknown>).message
        : res.statusText;
    throw new Error(String(message));
  }
  return data;
}
