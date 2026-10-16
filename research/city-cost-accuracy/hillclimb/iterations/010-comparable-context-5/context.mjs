import { comparableContext } from '../../../../../scripts/city-cost-accuracy/hillclimb/context-comparables.mjs';
// Five dev comparables (same country, then same region), excluding the target city; test cities never appear.
export default city => comparableContext(city, { count: 5 });
