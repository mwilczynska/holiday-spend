import { z } from 'zod';

/** What a page needs to show a stored city photo and its required credit. Safe for client code. */
export const cityImageViewSchema = z.object({
  cityId: z.string(),
  src: z.string().startsWith('/city-images/'),
  smallSrc: z.string().startsWith('/city-images/'),
  articleTitle: z.string(),
  artist: z.string(),
  license: z.string(),
  licenseUrl: z.string().nullable(),
  descriptionUrl: z.string(),
});

export type CityImageView = z.infer<typeof cityImageViewSchema>;
