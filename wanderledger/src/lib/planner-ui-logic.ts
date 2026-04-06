export const PLANNER_UI_LOGIC = {
  accommodation: 'Sets the nightly stay budget for two people. This feeds the daily cost and each leg total.',
  food: 'Sets the daily food budget for two people based on how cheaply or comfortably you plan to eat.',
  drinks: 'Sets the daily drinks budget for two people using a light, moderate, or heavy spend profile.',
  activities: 'Sets the daily activities budget for two people, from mostly free days to premium experiences.',
  intercityTransport: 'One-off travel between cities. This is added once to the leg total, not once per day.',
  splitPct: 'Controls what share of the trip cost belongs to you. For example, 50 means you pay half.',
  overrides: 'Manual overrides replace the automatic city estimate for that category when you want a custom budget.',
  tripSummary: 'Trip total equals all leg totals plus fixed costs. Monthly burn converts the trip total into a 30-day pace.',
} as const;
