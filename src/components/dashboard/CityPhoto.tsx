'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { CityImageView } from '@/lib/city-image-view';
import { DestinationScene } from './DestinationScene';

export function photoCredit(image: CityImageView) {
  return `Photo: ${image.artist}, ${image.license}, via Wikimedia Commons`;
}

/**
 * A city's stored Commons photo over its drawn scene. The scene shows while the photo loads, when
 * there is none, and if it fails to load. Photos are decorative (the city is named beside them).
 *
 * `credit` places the licence credit the photo requires; thumbnails use a tooltip and the leg
 * card repeats the credit in its expanded detail.
 */
export function CityPhoto({
  name,
  image,
  size = 'large',
  credit = 'bottom-left',
  className,
}: {
  name: string;
  image?: CityImageView | null;
  size?: 'large' | 'small';
  credit?: 'bottom-left' | 'top-right' | 'tooltip';
  className?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const src = image ? (size === 'small' ? image.smallSrc : image.src) : null;
  const showPhoto = Boolean(image && src && failedSrc !== src);

  return (
    <div className={cn('relative h-full w-full overflow-hidden', className)} title={showPhoto && credit === 'tooltip' && image ? photoCredit(image) : undefined}>
      <DestinationScene name={name} className="absolute inset-0" />
      {showPhoto && image && src ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- local, pre-sized files served by /city-images */}
          <img
            src={src}
            alt=""
            loading={size === 'small' ? 'lazy' : 'eager'}
            decoding="async"
            onError={() => setFailedSrc(src)}
            className="absolute inset-0 h-full w-full object-cover"
            data-testid="city-photo"
          />
          {credit !== 'tooltip' ? (
            <a
              href={image.descriptionUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={photoCredit(image)}
              className={cn(
                'absolute max-w-[70%] truncate rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-medium leading-tight text-white/90 hover:bg-black/75 hover:text-white',
                credit === 'top-right' ? 'right-2 top-2' : 'bottom-2 left-2',
              )}
            >
              {image.artist} · {image.license}
            </a>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
