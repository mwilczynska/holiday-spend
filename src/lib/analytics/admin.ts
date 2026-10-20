import { requireCurrentUser, AuthRequiredError } from '@/lib/auth';
import { isAnalyticsAdmin } from '@/lib/auth-policy';
export async function requireAnalyticsAdmin() {
  const user = await requireCurrentUser();
  const allowed = isAnalyticsAdmin(user.email);
  if (!allowed) { const err = new AuthRequiredError('Analytics administrator access required.'); err.status = 403; throw err; }
  return user;
}
