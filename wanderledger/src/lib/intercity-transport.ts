import type { IntercityTransportItem } from '@/types';

type SegmentLike = {
  id?: number;
  legId?: number;
  mode?: string | null;
  note?: string | null;
  cost?: number | null;
  sortOrder?: number | null;
};

function normalizeText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function normalizeIntercityTransports(
  transports: SegmentLike[] | null | undefined
): IntercityTransportItem[] {
  return (transports || []).map((transport, index) => ({
    id: transport.id,
    legId: transport.legId,
    mode: normalizeText(transport.mode),
    note: normalizeText(transport.note),
    cost: transport.cost ?? 0,
    sortOrder: transport.sortOrder ?? index,
  }));
}

export function getIntercityTransportTotal(
  transports: Array<{ cost?: number | null }> | null | undefined
): number {
  return (transports || []).reduce((sum, transport) => sum + (transport.cost ?? 0), 0);
}

export function groupIntercityTransportsByLegId<T extends { legId: number }>(
  transports: T[]
) {
  return transports.reduce<Map<number, T[]>>((acc, transport) => {
    const existing = acc.get(transport.legId) || [];
    existing.push(transport);
    acc.set(transport.legId, existing);
    return acc;
  }, new Map());
}
