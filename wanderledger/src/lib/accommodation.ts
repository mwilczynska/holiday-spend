export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function derivePrivateRoomRate(
  sharedDormRate?: number | null,
  oneStarRate?: number | null
): number | null {
  if (sharedDormRate != null && oneStarRate != null) {
    return roundMoney((sharedDormRate + oneStarRate) / 2);
  }

  if (oneStarRate != null) return roundMoney(oneStarRate);
  if (sharedDormRate != null) return roundMoney(sharedDormRate);
  return null;
}

export function deriveSharedDormRate(
  privateRoomRate?: number | null
): number | null {
  if (privateRoomRate == null) return null;
  return roundMoney(privateRoomRate * 0.6);
}
