export const PLANNER_UI_LOGIC = {
  accommodation: 'Sets the nightly stay budget. City base rates are stored for 2 travellers and scaled to the traveller count selected in plan mode.',
  food: 'Sets the daily food budget. City base rates are stored for 2 travellers and scaled to the traveller count selected in plan mode.',
  drinks: 'Sets the daily drinks budget. City base rates are stored for 2 travellers and scaled to the traveller count selected in plan mode.',
  activities: 'Sets the daily activities budget. City base rates are stored for 2 travellers and scaled to the traveller count selected in plan mode.',
  intercityTransport: 'One-off travel between cities. This is added once to the leg total, not once per day.',
  splitPct: 'Controls what share of the leg total belongs to you. It does not change the traveller count. For example, 50 means you pay half and 100 means you pay all of it.',
  overrides: 'Manual overrides replace the automatic city estimate for that category when you want a custom budget.',
  tripSummary: 'Trip total equals all leg totals plus fixed costs. The totals are scaled for the traveller count selected in plan mode. Monthly burn converts the trip total into a 30-day pace.',
} as const;
