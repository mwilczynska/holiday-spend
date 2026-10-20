/**
 * Returns `next`, but with each item replaced by the previous object of the same id when its content is unchanged,
 * and `previous` itself when nothing changed at all. Re-reading the itinerary after a save otherwise hands every
 * memoized leg card a new object, and all of them rerender for an edit to one leg.
 */
export function reuseUnchangedById<T extends { id: number | string }>(previous: T[], next: T[]): T[] {
  const byId = new Map(previous.map((item) => [item.id, item]));
  let changed = previous.length !== next.length;
  const merged = next.map((item, index) => {
    const prior = byId.get(item.id);
    if (prior && JSON.stringify(prior) === JSON.stringify(item)) {
      if (previous[index] !== prior) changed = true;
      return prior;
    }
    changed = true;
    return item;
  });
  return changed ? merged : previous;
}
