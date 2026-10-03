/** Failed or unreadable page reads must never become successful empty data. */
export async function readPageResponse(response: Response, label: string): Promise<unknown> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(typeof payload?.error === 'string' ? payload.error : `Could not load ${label} (HTTP ${response.status}).`);
  }
  if (!payload) throw new Error(`The server returned an unreadable ${label} response.`);
  if (payload.data == null) throw new Error(`The server returned invalid ${label} data.`);
  return payload.data;
}
