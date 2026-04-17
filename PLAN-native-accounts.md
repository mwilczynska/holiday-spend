# Native Email/Password Accounts â€” Implementation Plan

> **Branch**: `feat/native-accounts` off `main`
> **PR target**: `main`
> **Status**: IN PROGRESS â€” through Phase 4
> **Related**: CLAUDE.md "Priority 2B: Native Account Expansion"

---

## Context

Wanderledger currently uses NextAuth v4 with Google OAuth as the only real provider, plus a dev-only PIN `CredentialsProvider` used for local development (`src/lib/auth.ts`). There is no native email/password sign-up path, so anyone without a Google account cannot use the app, and there is no self-service password reset.

Priority 2B adds native accounts **alongside** Google (not as a replacement), with email as the primary identifier, proper password hashing (`argon2id`), email verification, password reset, abuse protection, and a documented account-linking policy that avoids silent cross-provider merging.

### Design anchors

- **Email is the primary identifier.** Display name is optional. No username field.
- **Native-auth data lives in dedicated tables.** The base `user` row stays OAuth-shaped. Password hashes and one-time tokens get their own tables.
- **Schema migrations use the existing bootstrap pattern** in `src/db/index.ts` (CREATE TABLE IF NOT EXISTS + backfill), matching how `saved_plans`, `user_preferences`, and `itinerary_leg_transports` were introduced.
- **Keep NextAuth v4 + JWT session strategy.** Email/password arrives as a second `CredentialsProvider`; the existing dev-PIN provider stays but is already production-gated.
- **Leave NextAuth's `verificationToken` table alone.** It's reserved for the Email magic-link provider; we use our own `auth_tokens` table so native-auth concerns are self-contained.

### Decisions baked in (raise before Phase 5 / Phase 7 if you want to change)

1. **Email provider: Resend.** Small SDK, good deliverability, free tier covers this app's volume. Fallback path to nodemailer + SMTP is possible later but not built.
2. **Unverified users cannot sign in.** Simpler security model than "sign in but restrict features". Unverified login returns a specific error the UI uses to offer "resend verification".
3. **No auto-linking across providers.** If a native account and a Google sign-in collide on email, the user is sent to a "this email already has an account" screen and must link explicitly from signed-in settings (settings-side linking is Phase H / out-of-scope follow-up).
4. **Rate limiting covers all five public auth endpoints**: login, signup, forgot-password, reset-password, verify-email resend.
5. **argon2id via `argon2` (node-argon2).** Time cost 3, memory 64 MiB, parallelism 1 â€” tuned later if latency-sensitive.

---

## Checkpoints

- [x] **Phase 0** â€” Plan doc + branch (commit f1bd116)
- [x] **Phase 1** â€” Schema + password/token helpers (commit 2111056)
- [x] **Phase 2** â€” EmailPassword `CredentialsProvider` wired into NextAuth (commit 412f073)
- [x] **Phase 3** â€” Signup + email verification flow (API + pages) (commit bdbccf4)
- [x] **Phase 4** â€” Forgot password + reset flow (API + pages) (commit a216021)
- [ ] **Phase 5** â€” Email delivery (Resend) + deployment docs
- [ ] **Phase 6** â€” Rate limiting + abuse protection
- [ ] **Phase 7** â€” Account-linking policy in `signIn` callback + collision screen
- [ ] **Phase 8** â€” Signed-in account management (`/settings/account` change-password)
- [ ] **Phase 9** â€” Tests (unit + Playwright) + CLAUDE.md update
- [ ] **Phase 10** â€” PR review, merge readiness

Each phase ends with a verification step and its own commit on `feat/native-accounts`.

---

## Phase 1: Schema + Password/Token Foundation

### 1a. Drizzle schema additions

**File to modify**: `src/db/schema.ts`

```ts
export const userPasswords = sqliteTable('user_passwords', {
  userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  hash: text('hash').notNull(),
  algorithm: text('algorithm').notNull().default('argon2id'),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
  lastChangedAt: text('last_changed_at').default(sql`(datetime('now'))`),
});

export const authTokens = sqliteTable('auth_tokens', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  purpose: text('purpose').notNull(),           // 'verify_email' | 'reset_password'
  tokenHash: text('token_hash').notNull(),      // SHA-256 of the raw token
  expiresAt: text('expires_at').notNull(),
  consumedAt: text('consumed_at'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  ip: text('ip'),
  userAgent: text('user_agent'),
});
```

**Design decisions**:
- Store `tokenHash`, never the raw token. Raw value only lives in the email link.
- One row per issuance; "rotate" by consuming the old row and inserting a new one. Don't UPDATE.
- `purpose` is a plain string plus a runtime Zod check rather than a CHECK constraint â€” keeps future purposes (`change_email`, `delete_account`) easy to add.

### 1b. Runtime bootstrap

**File to modify**: `src/db/index.ts`

Add two `CREATE TABLE IF NOT EXISTS` blocks following the existing pattern (see how `saved_plans` and `user_preferences` are done). No backfill needed â€” these are new data.

### 1c. Password helpers

**File to create**: `src/lib/password.ts`

```ts
export async function hashPassword(plaintext: string): Promise<string>
export async function verifyPassword(hash: string, plaintext: string): Promise<boolean>
export function validatePasswordStrength(plaintext: string): { ok: true } | { ok: false; reason: string }
```

- Uses `argon2` (npm `argon2`) with `argon2id`, `timeCost: 3`, `memoryCost: 65536`, `parallelism: 1`.
- `validatePasswordStrength`: min 10 chars, not purely numeric, not in a small denylist of obviously-bad passwords (`password`, `12345678`, etc.). Deliberately minimal â€” not trying to reinvent a strength meter.

### 1d. Token helpers

**File to create**: `src/lib/auth-tokens.ts`

```ts
export type TokenPurpose = 'verify_email' | 'reset_password';

export async function issueToken(
  userId: string,
  purpose: TokenPurpose,
  options?: { ttlMinutes?: number; ip?: string; userAgent?: string }
): Promise<{ rawToken: string; id: string; expiresAt: Date }>

export async function consumeToken(
  rawToken: string,
  purpose: TokenPurpose
): Promise<{ userId: string } | null>

export async function invalidateUserTokens(userId: string, purpose: TokenPurpose): Promise<void>
```

- Raw token is `crypto.randomBytes(32).toString('base64url')` (43 chars).
- `tokenHash` is `sha256(rawToken)` stored as hex.
- Default TTLs: `verify_email` 24 hours, `reset_password` 30 minutes.
- `consumeToken` is atomic: find row where `tokenHash = sha256(raw) AND purpose = X AND consumedAt IS NULL AND expiresAt > now`, stamp `consumedAt`, return `userId`.
- `invalidateUserTokens` is called after successful password reset (burn all reset tokens for that user).

### 1e. Dependency install

```
npm install argon2
```

Note: `argon2` has a native addon. Verify it builds on Windows dev and the production Linux VPS. If Windows install fails, document the `node-gyp` prereqs in `DEPLOYMENT.md`; fallback is `@node-rs/argon2` (prebuilt binaries, no build step) â€” switch only if needed.

### Phase 1 verification

- `npx tsc --noEmit` passes
- `npm run build` passes
- Manual REPL: `hashPassword('hunter2')` returns an `$argon2id$...` string; `verifyPassword` round-trips true/false
- Manual: `issueToken` + `consumeToken` round-trips; re-consuming same token returns `null`; expired token returns `null`
- SQLite: new tables visible in `data/travel.db`

**Commit**: `feat(auth): add password + auth-token storage and helpers`

---

## Phase 2: EmailPassword Credentials Provider

### 2a. New provider

**File to modify**: `src/lib/auth.ts`

Add a second `CredentialsProvider` with `id: 'email-password'`:

```ts
CredentialsProvider({
  id: 'email-password',
  name: 'Email and password',
  credentials: {
    email: { label: 'Email', type: 'email' },
    password: { label: 'Password', type: 'password' },
  },
  async authorize(credentials) {
    // 1. Zod-validate shape
    // 2. Look up user by normalized email (lowercased, trimmed)
    // 3. Look up userPasswords row; if missing â†’ return null (account exists but has no native password)
    // 4. verifyPassword; if false â†’ return null
    // 5. If user.emailVerified is null â†’ throw specific error code 'EMAIL_NOT_VERIFIED'
    // 6. Return { id, email, name, image }
  },
})
```

### 2b. Provider discovery

Extend `getConfiguredAuthProviders()` to return `{ google, emailPassword, devPin }`. `emailPassword` is on whenever the app is past Phase 5 (email delivery configured) OR an env flag `ENABLE_EMAIL_PASSWORD=true` is set. Gate this so phases 2â€“4 don't accidentally expose sign-in before email delivery is wired.

### 2c. Error surface

NextAuth's `signIn('email-password', ...)` returns `{ error: string }`. Normalize error strings:
- `'EMAIL_NOT_VERIFIED'` â€” UI links to "resend verification"
- `'CredentialsSignin'` (default NextAuth) â€” generic "wrong email or password"
- Never distinguish "no such user" from "wrong password" in the response (avoid enumeration).

### 2d. Email normalization

**File to create**: `src/lib/email.ts`

```ts
export function normalizeEmail(raw: string): string          // lowercase + trim
export function isValidEmailShape(raw: string): boolean      // Zod or RFC-lite regex
```

Use this everywhere that looks up or stores an email.

### Phase 2 verification

- `npx tsc --noEmit` passes
- With `ENABLE_EMAIL_PASSWORD=true` and a manually-seeded `userPasswords` row, `signIn('email-password', { email, password })` succeeds
- Wrong password returns the generic error; unverified user returns `EMAIL_NOT_VERIFIED`
- Google sign-in unaffected

**Commit**: `feat(auth): add email/password credentials provider`

---

## Phase 3: Signup + Email Verification

### 3a. Signup API

**File to create**: `src/app/api/auth/signup/route.ts`

`POST /api/auth/signup`

Body (Zod): `{ email: string; password: string; name?: string }`

Flow:
1. Normalize email; validate shape + password strength
2. Look up existing user by email
   - If a user exists and has a `userPasswords` row â†’ return generic `{ ok: true }` (don't leak existence); silently do nothing
   - If a user exists but no `userPasswords` row â†’ it's an OAuth-only account. Return generic `{ ok: true }` with a flag that the UI can use to suggest "sign in with Google instead"? **No** â€” keeps enumeration-proof. Just return generic success and send a password-set email? **Decision: return generic success, send no email.** Defer cross-provider linking to Phase 7.
3. If no user exists: insert `user` row (via `ensureUserRow`), insert `userPasswords` row with argon2id hash, issue a `verify_email` token, send verification email (Phase 5 â€” for now, log the link), return `{ ok: true }`
4. Always return 200 with generic `{ ok: true }` regardless of branch (enumeration-proof)

### 3b. Verify-email API

**File to create**: `src/app/api/auth/verify-email/route.ts`

`POST /api/auth/verify-email` â€” body `{ token: string }`

- `consumeToken(token, 'verify_email')` â†’ if null, return 400 generic error
- Set `user.emailVerified = now`
- Return `{ ok: true, email }` so the client can auto-sign-in

### 3c. Resend-verification API

**File to create**: `src/app/api/auth/resend-verification/route.ts`

`POST /api/auth/resend-verification` â€” body `{ email: string }`

- Always return 200 generic
- If user exists + not verified + has a native password â†’ issue new token, invalidate old `verify_email` tokens for that user, send email

### 3d. Signup page

**File to create**: `src/app/(auth)/signup/page.tsx` (or flat `src/app/signup/page.tsx` if no route group in use â€” match existing `/login` convention, which is flat)

Form fields: email, password, optional display name. Client-side password strength hint (uses `validatePasswordStrength` client-safe export). Submit â†’ POST to `/api/auth/signup` â†’ redirect to `/check-email`.

### 3e. Check-email page

**File to create**: `src/app/check-email/page.tsx`

Static "We sent you a verification link. Check your inbox." with a "Resend" button that calls `/api/auth/resend-verification`. Rate-limited client-side by a 30s cooldown; server-side rate limit covers Phase 6.

### 3f. Verify-email page

**File to create**: `src/app/verify-email/page.tsx`

- Reads `?token=...`
- POSTs to `/api/auth/verify-email`
- On success: auto-calls `signIn('email-password', ...)` if possible? **No** â€” user already authenticated with Google would be confused, and we don't have their password. Instead, show "Email verified. Sign in below." with a link to `/login`.

### 3g. Login page updates

**File to modify**: `src/components/auth/LoginScreen.tsx`

- Add email + password fields above the Google button
- Add "Forgot password?" link (Phase 4)
- Add "Sign up" link to `/signup`
- Handle `EMAIL_NOT_VERIFIED` error â†’ show "resend verification" CTA
- Keep dev-PIN section unchanged

### Phase 3 verification

- `npx tsc --noEmit` passes
- Browser: `/signup` â†’ fill form â†’ email logged to server console with verification link
- Click link â†’ `/verify-email?token=...` â†’ "Email verified" â†’ sign in on `/login` succeeds
- Attempt to sign in before verifying â†’ `EMAIL_NOT_VERIFIED` error + resend CTA
- Attempt to sign up with existing email â†’ always returns "check your inbox" (no enumeration)

**Commit**: `feat(auth): signup, email verification, and resend flows`

---

## Phase 4: Forgot Password + Reset

### 4a. Forgot-password API

**File to create**: `src/app/api/auth/forgot-password/route.ts`

`POST /api/auth/forgot-password` â€” body `{ email: string }`

- Always return 200 generic `{ ok: true }`
- If user exists and has `userPasswords` row â†’ issue `reset_password` token (30 min TTL), invalidate prior reset tokens for that user, send email

### 4b. Reset-password API

**File to create**: `src/app/api/auth/reset-password/route.ts`

`POST /api/auth/reset-password` â€” body `{ token: string; newPassword: string }`

- Validate password strength
- `consumeToken(token, 'reset_password')` â†’ if null, 400 generic
- Update `userPasswords.hash`, stamp `lastChangedAt`
- `invalidateUserTokens(userId, 'reset_password')` for safety (catches any races)
- Clear all NextAuth sessions for that user (see 4d)
- Return `{ ok: true }`

### 4c. Forgot-password + reset-password pages

**Files to create**:
- `src/app/forgot-password/page.tsx` â€” email input â†’ POST â†’ "Check your inbox" screen
- `src/app/reset-password/page.tsx` â€” reads `?token=...`, new-password field + confirm, POST â†’ redirect to `/login` with a success flash

### 4d. Session invalidation

**File to modify**: `src/lib/auth.ts`

Because we use JWT sessions (not DB sessions), we can't just DELETE from `session`. Options:
- (a) Add a `tokenVersion` column on `user`; include it in the JWT; bump on password reset; reject JWTs with a stale version in the `session` callback.
- (b) Switch to DB sessions for native users only (complex, not recommended).
- (c) Live with the JWT staying valid until its short exp â€” NextAuth JWT default is 30 days, but we can set `session.maxAge` to something short like 1 hour.

**Decision: (a).** Add `users.tokenVersion` (integer, default 0). JWT carries `user.tokenVersion`. `session` callback rejects mismatch. `deleteSession`-on-reset becomes `UPDATE user SET tokenVersion = tokenVersion + 1`. Simple, correct, survives across devices.

Schema addition: add `tokenVersion: integer('token_version').notNull().default(0)` to `users` in `src/db/schema.ts`; bootstrap adds `ALTER TABLE user ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0` guarded by an "is the column present" check following the existing pragma pattern.

### Phase 4 verification

- `/forgot-password` with unknown email â†’ generic success
- `/forgot-password` with known email â†’ reset email logged (still no real delivery â€” Phase 5)
- Click reset link â†’ `/reset-password?token=...` â†’ set new password â†’ login with new password works
- Old session from before reset is rejected on next request (after JWT refresh)

**Commit**: `feat(auth): forgot password and reset flows with session invalidation`

---

## Phase 5: Email Delivery

### 5a. Mailer module

**File to create**: `src/lib/mailer.ts`

```ts
export async function sendVerificationEmail(to: string, verifyUrl: string): Promise<void>
export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void>
export function isMailConfigured(): boolean
```

- Uses `resend` SDK (`npm i resend`).
- Templates are inline HTML strings for now. Both include plaintext fallback.
- If `RESEND_API_KEY` is missing in non-production â†’ log the email to stdout (dev path). In production, throw so misconfiguration is loud.
- Respects `APP_URL` env var to build absolute links.

### 5b. Wire the mailer

Replace `console.log` stubs in the Phase 3 and Phase 4 API routes with real calls to `sendVerificationEmail` / `sendPasswordResetEmail`.

### 5c. Env + deployment docs

**Files to modify**: `.env.example`, `DEPLOYMENT.md`, `README.md` (if it documents env vars)

New env vars:
- `RESEND_API_KEY` â€” required in production for native auth
- `MAIL_FROM` â€” e.g. `Wanderledger <no-reply@your-domain>`
- `APP_URL` â€” used to build verification/reset links
- `ENABLE_EMAIL_PASSWORD` â€” optional, defaults on when `RESEND_API_KEY` is set

### 5d. Turn on the provider

Update `getConfiguredAuthProviders()` to expose `emailPassword` whenever `isMailConfigured() || ENABLE_EMAIL_PASSWORD`. Remove the Phase-2 stopgap flag.

### Phase 5 verification

- With a dev Resend key pointed at a sandboxed sender, signup + reset deliver real emails
- Without `RESEND_API_KEY` in dev: links still log to stdout so local testing works
- DEPLOYMENT.md lists the new env vars in the secrets table

**Commit**: `feat(auth): email delivery via Resend for verify and reset flows`

---

## Phase 6: Rate Limiting + Abuse Protection

### 6a. Rate-limit store

**File to modify**: `src/db/schema.ts` + `src/db/index.ts`

```ts
export const authRateLimits = sqliteTable('auth_rate_limits', {
  bucket: text('bucket').primaryKey(),           // e.g. 'login:ip:1.2.3.4' or 'signup:email:foo@bar'
  count: integer('count').notNull().default(0),
  windowStart: text('window_start').notNull(),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});
```

### 6b. Rate-limit helper

**File to create**: `src/lib/rate-limit.ts`

```ts
export async function checkRateLimit(
  bucket: string,
  opts: { max: number; windowSeconds: number }
): Promise<{ allowed: true } | { allowed: false; retryAfterSeconds: number }>
```

Atomic via SQLite transaction: if window expired â†’ reset; else increment and compare to `max`.

### 6c. Apply to auth endpoints

Per-endpoint limits (both IP and email buckets â€” limit on whichever fills first):

| Endpoint | Max | Window | Buckets |
|----------|-----|--------|---------|
| `/api/auth/signup` | 5 | 1 hour | IP, email |
| `/api/auth/callback/email-password` (intercepted) | 10 | 15 min | IP, email |
| `/api/auth/forgot-password` | 5 | 1 hour | IP, email |
| `/api/auth/reset-password` | 10 | 15 min | IP |
| `/api/auth/verify-email` | 20 | 1 hour | IP |
| `/api/auth/resend-verification` | 3 | 1 hour | email |

NextAuth callbacks are tricky to intercept cleanly â€” the `authorize()` function itself should call `checkRateLimit` as the first thing it does with `'login:email:' + normalizedEmail` and `'login:ip:' + clientIp`.

### 6d. IP extraction

**File to create**: `src/lib/request-ip.ts`

Reads `x-forwarded-for` (first entry), falls back to `request.ip`. Document the nginx trust boundary in `DEPLOYMENT.md`.

### 6e. Headers + noindex

Add `X-Robots-Tag: noindex` to responses from `/api/auth/*` and pages under `(auth)`. Add `Retry-After` header when rate-limited.

### Phase 6 verification

- `npx tsc --noEmit` passes
- Script: hammer `/api/auth/signup` with the same IP â€” 6th request returns 429 + `Retry-After`
- Script: hammer login with same email, wrong password â€” limited after 10 attempts
- Correct password still works after limit expires

**Commit**: `feat(auth): rate limiting for native-auth endpoints`

---

## Phase 7: Account-Linking Policy

### 7a. signIn callback guardrails

**File to modify**: `src/lib/auth.ts` (`callbacks.signIn`)

On every sign-in:
1. If `account.provider === 'google'` and an existing `user` row owns this email AND that user already has a `userPasswords` row (native account) AND no `account` row links them yet â†’ **reject** with a specific redirect to `/login?linkRequired=google`.
2. Symmetrical check for email-password sign-in when a Google `account` row exists for the same email but no `userPasswords` row yet â€” reject with `/login?linkRequired=password`.
3. When the account row already exists for this provider+email pair â†’ allow (normal flow).
4. Update `ensureUserRow` / `claimLegacyDataForUser` so they don't accidentally create linked state.

### 7b. Link-required screen

**File to modify**: `src/components/auth/LoginScreen.tsx`

Reads `?linkRequired=` and renders an explanatory banner:
> This email already has a Wanderledger account created with {other provider}. Sign in with {other provider} first, then link Google/email-password from your account settings.

No automatic linking â€” user explicitly initiates from signed-in settings (Phase 8 or later).

### 7c. Consistent email casing

Ensure all `account.userId` lookups and `user.email` comparisons use `normalizeEmail()` from `src/lib/email.ts`. Add a one-off bootstrap in `src/db/index.ts` that lowercases existing emails if needed.

### Phase 7 verification

- Create native account for `test@example.com` (verify + set password)
- Try Google sign-in with the same email â†’ redirected to `/login?linkRequired=google`, no session created, no silent linking
- Native sign-in still works, Google sign-in for different emails still works

**Commit**: `feat(auth): account-linking policy with collision screen`

---

## Phase 8: Signed-In Account Management

### 8a. Account settings page

**File to create**: `src/app/settings/account/page.tsx`

Sections:
1. **Profile** â€” email (read-only for now), display name (editable, writes to `user.name`)
2. **Change password** â€” current password + new password + confirm. Server verifies current hash, rotates it, bumps `tokenVersion`. Only rendered if user has a `userPasswords` row.
3. **Sign-in methods** â€” read-only list: "Google (linked)" and/or "Email + password (set)". No link/unlink UI yet; "Add [method]" buttons are disabled with "coming soon".

### 8b. Change-password API

**File to create**: `src/app/api/auth/change-password/route.ts`

`POST /api/auth/change-password` â€” body `{ currentPassword: string; newPassword: string }`

- Requires an authenticated session (`requireCurrentUser`)
- Verify current hash; if wrong, rate-limit this endpoint too (reuse `checkRateLimit` with `change-password:user:` bucket)
- Update hash, stamp `lastChangedAt`, bump `tokenVersion`
- Return `{ ok: true }` â€” client forces a `signOut()` + redirect to `/login`

### 8c. Sidebar entry

**Files to modify**: `src/components/layout/DesktopSidebar.tsx`, `src/components/layout/MobileNav.tsx`

Add "Account" under Settings (or make `/settings/account` the default `/settings` landing page if it currently isn't).

### Phase 8 verification

- Signed-in user â†’ `/settings/account` â†’ change password works; old password fails afterwards
- Mismatched current password shows error; repeated attempts get rate-limited
- Google-only account sees "Sign-in methods: Google" and no change-password form

**Commit**: `feat(auth): signed-in account settings with change-password`

---

## Phase 9: Tests + Documentation

### 9a. Unit tests

**Files to create**:
- `src/lib/password.test.ts` â€” hash/verify round-trip; strength validator edge cases
- `src/lib/auth-tokens.test.ts` â€” issue/consume/expire/invalidate cycles; idempotent double-consume returns null
- `src/lib/rate-limit.test.ts` â€” window rollover, per-bucket isolation, concurrent increment

Using whatever test runner already exists in the repo (check `package.json`; add Vitest if none).

### 9b. Playwright coverage

**File to create**: `tests/playwright/native-auth.spec.ts`

Happy-path flow:
1. Signup with new email â†’ check-email page shown
2. Simulate clicking verification link (hit the verify API directly with a captured token) â†’ verified
3. Sign in with email+password â†’ lands on `/`
4. Sign out â†’ forgot-password flow â†’ reset token â†’ new password
5. Sign in with new password succeeds, old password fails

Error paths:
- Signup with existing email â†’ no enumeration
- Sign in unverified â†’ `EMAIL_NOT_VERIFIED` + resend works
- Rate limit hit after N attempts â†’ 429

Use a test-mode mailer that writes emails to an in-memory buffer the test can read (add a `MAIL_TRANSPORT=memory` env path in `src/lib/mailer.ts`).

### 9c. CLAUDE.md

- Move Priority 2B checklist items from "Current Known Gaps" to "Completed Work" (Phase 6)
- Add a "Native Account Expansion" subsection under "Recent Important Changes"
- Update "Useful Files" list with the new auth modules/pages
- Document env vars introduced (already in DEPLOYMENT.md from Phase 5; note here for discoverability)

### Phase 9 verification

- `npm run build` passes
- `npx tsc --noEmit` passes
- `npm run test` and `npm run test:e2e` pass
- CLAUDE.md accurately reflects new state

**Commit**: `test(auth): unit + playwright coverage, docs update`

---

## Phase 10: PR Review + Merge Readiness

- Push `feat/native-accounts` (push after each phase commit is fine â€” the plan doc push kicks this off)
- Open PR against `main` referencing this file and the Priority 2B CLAUDE.md bullets
- Self-review the full diff; delete any stray temp files (`tmp-auth-dev*.log` if still present)
- Verify `npm run build` and the full test suite green on the branch
- Flag follow-ups for a separate PR: explicit provider link/unlink UI, 2FA/passkeys, session-revocation admin view

---

## Key Existing Code to Reuse

| What | File | Function/Export |
|------|------|-----------------|
| NextAuth config | `src/lib/auth.ts` | `authOptions`, `getAuthSession`, `requireCurrentUser`, `getConfiguredAuthProviders` |
| Drizzle adapter bootstrap | `src/db/index.ts` | runtime CREATE TABLE pattern |
| User-row upsert | `src/lib/user-data.ts` | `ensureUserRow`, `claimLegacyDataForUser` |
| API helpers | `src/lib/api-helpers.ts` | `success()`, `error()`, `handleError()` |
| UI primitives | `src/components/ui/*` | Card, Input, Button, Label, LoadingButtonLabel |
| Existing login screen | `src/components/auth/LoginScreen.tsx` | extend rather than rewrite |

## Architecture Notes

- **Why argon2 and not bcrypt?** argon2id is the current OWASP recommendation for new systems. The CLAUDE.md bullet explicitly names it.
- **Why a JWT `tokenVersion` instead of DB sessions?** Keeps the existing session strategy intact; minimal change surface. DB sessions would require migrating every callback that reads the JWT.
- **Why separate `user_passwords` and `auth_tokens` tables?** Isolates native-auth data so OAuth-only users never have empty columns in the base `user` table, and so token churn doesn't bloat the user row's page on disk.
- **Why not reuse NextAuth `verificationToken`?** That table's primary key is `(identifier, token)` and is built for the magic-link Email provider. Adding a `purpose` column and different TTL logic muddies a table NextAuth owns; we'd rather keep it clean for a future passwordless-email option.
- **Enumeration resistance everywhere.** Signup, forgot-password, and resend-verification always return generic success so response bodies can't be used to enumerate registered emails. Timing side-channels are further dulled by the argon2 verification on login regardless of whether the user exists (dummy-hash if no user found, though this is lower priority â€” flag for future hardening).
- **Local dev ergonomics.** Dev-PIN stays. `MAIL_TRANSPORT=memory` lets local dev skip Resend entirely. `APP_URL` defaults to `http://localhost:3000` so links work out of the box.
