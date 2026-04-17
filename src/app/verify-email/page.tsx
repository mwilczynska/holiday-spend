import { Suspense } from 'react';
import { VerifyEmailScreen } from '@/components/auth/VerifyEmailScreen';

export const dynamic = 'force-dynamic';

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailScreen />
    </Suspense>
  );
}
