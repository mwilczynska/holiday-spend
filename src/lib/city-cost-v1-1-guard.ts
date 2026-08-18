import path from 'node:path';

/** The production v1 dataset is an invariant of the v1.1 rollout. */
export const LIVE_CITY_COST_CSV_RELATIVE_PATH = path.join('data', 'reference', 'city_costs_app_aud.csv');

export function resolveLiveCityCostCsvPath(cwd = process.cwd()) {
  return path.resolve(cwd, LIVE_CITY_COST_CSV_RELATIVE_PATH);
}

export function isLiveCityCostCsvPath(outputPath: string, cwd = process.cwd()) {
  return path.resolve(cwd, outputPath) === resolveLiveCityCostCsvPath(cwd);
}

/**
 * v1.1 outputs are staged artifacts or database records, never a replacement
 * for the checked-in v1 CSV. Keep this guard at the write boundary of any
 * future v1.1 tooling instead of relying on caller discipline.
 */
export function assertV11OutputPathSafe(outputPath: string, cwd = process.cwd()) {
  if (isLiveCityCostCsvPath(outputPath, cwd)) {
    throw new Error(
      `v1.1 tooling cannot write the live city-cost CSV: ${LIVE_CITY_COST_CSV_RELATIVE_PATH}`
    );
  }
}

