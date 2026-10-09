import { DestinationScene } from '@/components/dashboard/DestinationScene';

interface BannerLeg {
  cityName: string;
  countryName: string;
  status: string;
  nights: number;
}

/**
 * Planner hero: a drawn scene for the leg in progress (or the next upcoming one) with a short
 * trip summary. Uses leg statuses only, so it never guesses today's date.
 */
export function TripBanner({ legs }: { legs: BannerLeg[] }) {
  const active = legs.find((leg) => leg.status === 'active');
  const upcoming = legs.find((leg) => leg.status === 'planned');
  const focus = active ?? upcoming ?? legs[0];
  const cityCount = new Set(legs.map((leg) => leg.cityName)).size;
  const countryCount = new Set(legs.map((leg) => leg.countryName)).size;
  const nights = legs.reduce((sum, leg) => sum + leg.nights, 0);
  const remainingNights = legs.filter((leg) => leg.status === 'planned').reduce((sum, leg) => sum + leg.nights, 0);

  const eyebrow = active
    ? `Now in ${active.cityName}`
    : upcoming
      ? `Next stop: ${upcoming.cityName}`
      : legs.length > 0
        ? 'All legs completed'
        : 'No legs yet';

  return (
    <section aria-label="Trip at a glance" className="relative min-h-[210px] overflow-hidden rounded-2xl bg-[#BFDCEB]">
      {focus ? <DestinationScene name={focus.cityName} className="absolute inset-0" /> : null}
      <div className="absolute inset-x-4 bottom-4 max-w-sm rounded-[14px] bg-[rgba(15,27,51,0.78)] px-4 py-3.5 text-white sm:inset-x-5 sm:bottom-5">
        <p className="text-xs font-semibold text-slate-300">
          {eyebrow}
          {remainingNights > 0 && active ? ` · ${remainingNights} nights planned after this` : ''}
        </p>
        <p className="mt-1 text-2xl font-extrabold leading-tight tracking-tight">
          {legs.length > 0
            ? `${cityCount} ${cityCount === 1 ? 'city' : 'cities'}, ${countryCount} ${countryCount === 1 ? 'country' : 'countries'}, ${nights} nights`
            : 'Add a destination to start'}
        </p>
      </div>
    </section>
  );
}
