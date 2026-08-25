export const INITIAL_VISIBLE_LEGS = 12;
export const VISIBLE_LEGS_INCREMENT = 12;
export const DATASET_PAGE_SIZE = 25;
export const HISTORY_PAGE_SIZE = 20;
export const EXPENSE_PAGE_SIZE = 50;

export function getPageCount(itemCount: number, pageSize: number) {
  if (!Number.isInteger(itemCount) || itemCount < 0) {
    throw new Error('itemCount must be a non-negative integer.');
  }
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new Error('pageSize must be a positive integer.');
  }

  return Math.max(1, Math.ceil(itemCount / pageSize));
}

export function getPageItems<T>(items: readonly T[], page: number, pageSize: number) {
  if (!Number.isInteger(page) || page < 0) {
    throw new Error('page must be a non-negative integer.');
  }
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new Error('pageSize must be a positive integer.');
  }

  return items.slice(page * pageSize, (page + 1) * pageSize);
}

export function getVisibleItems<T>(items: readonly T[], visibleCount: number) {
  if (!Number.isInteger(visibleCount) || visibleCount < 0) {
    throw new Error('visibleCount must be a non-negative integer.');
  }

  return items.slice(0, visibleCount);
}
