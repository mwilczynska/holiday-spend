import { Suspense } from 'react';
import { VerifyEmailScreen } from '@/components/auth/VerifyEmailScreen';
import { authPageMetadata } from '@/lib/auth-responses';

export const dynamic = 'force-dynamic';
export const metadata = authPageMetadata;

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailScreen />
    </Suspense>
  );
}
