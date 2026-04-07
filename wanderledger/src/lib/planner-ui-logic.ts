export const PLANNER_UI_LOGIC = {
  accommodation: 'Sets the nightly stay budget for two people. Each tier maps to one room or two dorm beds per night and feeds the daily cost and each leg total.',
  food: 'Sets the daily food budget for two people. These are overall daily allowances rather than exact meal counts, with each tier reflecting a different eating style across the day.',
  drinks: 'Sets the daily drinks budget for two people. The city stores a daily drinks total, but the estimate is based on specific drink baskets shown in the option descriptions.',
  activities: 'Sets the daily activities budget for two people, from mostly free days to premium experiences.',
  intercityTransport: 'One-off travel between cities. This is added once to the leg total, not once per day.',
  splitPct: 'Controls what share of the trip cost belongs to you. For example, 50 means you pay half.',
  overrides: 'Manual overrides replace the automatic city estimate for that category when you want a custom budget.',
  tripSummary: 'Trip total equals all leg totals plus fixed costs. Monthly burn converts the trip total into a 30-day pace.',
} as const;
