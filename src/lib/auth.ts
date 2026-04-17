import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { and, eq } from 'drizzle-orm';
import { getServerSession, type NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { db } from '@/db';
import { accounts, sessions, userPasswords, users, verificationTokens } from '@/db/schema';
import {
  NATIVE_AUTH_ERROR_CODES,
  verifyEmailPasswordCredentials,
} from '@/lib/native-auth';
import { normalizeEmail } from '@/lib/email';
import { isMailConfigured } from '@/lib/mailer';
import { checkRateLimit } from '@/lib/rate-limit';
import { getRequestIp } from '@/lib/request-ip';
import { ensureUserRow, claimLegacyDataForUser } from '@/lib/user-data';

const isProduction = process.env.NODE_ENV === 'production';
const devPin = !isProduction
  ? process.env.AUTH_DEV_PIN || process.env.APP_SECRET || undefined
  : undefined;
const emailPasswordEnabled =
  process.env.ENABLE_EMAIL_PASSWORD === 'true' || isMailConfigured();

async function getUserTokenVersion(userId: string) {
  const user = await db
    .select({ tokenVersion: users.tokenVersion })
    .from(users)
    .where(eq(users.id, userId))
    .get();

  return user?.tokenVersion ?? null;
}

async function getUserByNormalizedEmail(rawEmail: string | null | undefined) {
  if (!rawEmail?.trim()) {
    return null;
  }

  return db
    .select({
      id: users.id,
      email: users.email,
    })
    .from(users)
    .where(eq(users.email, normalizeEmail(rawEmail)))
    .get();
}

async function hasUserPassword(userId: string) {
  const row = await db
    .select({ userId: userPasswords.userId })
    .from(userPasswords)
    .where(eq(userPasswords.userId, userId))
    .get();

  return Boolean(row);
}

async function hasLinkedProviderAccount(userId: string, provider: string, providerAccountId?: string | null) {
  if (providerAccountId) {
    const exact = await db
      .select({ userId: accounts.userId })
      .from(accounts)
      .where(
        and(eq(accounts.provider, provider), eq(accounts.providerAccountId, providerAccountId))
      )
      .get();

    if (exact) {
      return true;
    }

    return false;
  }

  const linked = await db
    .select({ userId: accounts.userId })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.provider, provider)))
    .get();

  return Boolean(linked);
}

const providers = [];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

if (emailPasswordEnabled) {
  providers.push(
    CredentialsProvider({
      id: 'email-password',
      name: 'Email and password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        const normalizedEmail =
          typeof credentials?.email === 'string' ? credentials.email.trim().toLowerCase() : '';
        const clientIp = getRequestIp(req) ?? 'unknown';

        const [emailLimit, ipLimit] = await Promise.all([
          checkRateLimit(`login:email:${normalizedEmail || 'unknown'}`, {
            max: 10,
            windowSeconds: 15 * 60,
          }),
          checkRateLimit(`login:ip:${clientIp}`, {
            max: 10,
            windowSeconds: 15 * 60,
          }),
        ]);

        if (!emailLimit.allowed || !ipLimit.allowed) {
          throw new Error(NATIVE_AUTH_ERROR_CODES.RATE_LIMITED);
        }

        const result = await verifyEmailPasswordCredentials(
          credentials?.email,
          credentials?.password
        );

        if (result.kind === 'unverified') {
          throw new Error(NATIVE_AUTH_ERROR_CODES.EMAIL_NOT_VERIFIED);
        }

        if (result.kind === 'link-required-password') {
          throw new Error(NATIVE_AUTH_ERROR_CODES.LINK_REQUIRED_PASSWORD);
        }

        if (result.kind === 'invalid') {
          return null;
        }

        return result.user;
      },
    })
  );
}

if (devPin) {
  providers.push(
    CredentialsProvider({
      id: 'dev-pin',
      name: 'Development PIN',
      credentials: {
        pin: { label: 'PIN', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.pin || credentials.pin !== devPin) {
          return null;
        }

        return {
          id: 'dev-local-user',
          name: 'Local Dev',
          email: 'dev@wanderledger.local',
        };
      },
    })
  );
}

export const authOptions: NextAuthOptions = {
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET || process.env.APP_SECRET,
  pages: {
    signIn: '/login',
  },
  providers,
  callbacks: {
    async signIn({ user, account }) {
      if (!account) {
        return false;
      }

      if (account.provider === 'google') {
        const existingUser = await getUserByNormalizedEmail(user.email);
        if (!existingUser) {
          return true;
        }

        const linkedGoogleAccount = await hasLinkedProviderAccount(
          existingUser.id,
          'google',
          account.providerAccountId
        );
        if (linkedGoogleAccount) {
          return true;
        }

        if (await hasUserPassword(existingUser.id)) {
          return '/login?linkRequired=google';
        }
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) {
        const userId = String(user.id);
        await ensureUserRow({
          id: userId,
          email: user.email,
          name: user.name,
          image: user.image,
        });
        await claimLegacyDataForUser(userId);
        token.sub = userId;
        token.tokenVersion = (await getUserTokenVersion(userId)) ?? 0;
        return token;
      }

      if (!token.sub) {
        return token;
      }

      const currentTokenVersion = await getUserTokenVersion(String(token.sub));
      if (currentTokenVersion == null) {
        return {};
      }

      if (currentTokenVersion !== (token.tokenVersion ?? 0)) {
        return {};
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
};

export async function getAuthSession() {
  return getServerSession(authOptions);
}

export class AuthRequiredError extends Error {
  status = 401;

  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'AuthRequiredError';
  }
}

export async function requireCurrentUser() {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    throw new AuthRequiredError();
  }

  return session.user;
}

export async function requireCurrentUserId() {
  const user = await requireCurrentUser();
  return user.id;
}

export function getConfiguredAuthProviders() {
  return {
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    emailPassword: emailPasswordEnabled,
    devPin: Boolean(devPin),
  };
}
