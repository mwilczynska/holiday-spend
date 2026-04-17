import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { getServerSession, type NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { db } from '@/db';
import { accounts, sessions, users, verificationTokens } from '@/db/schema';
import {
  NATIVE_AUTH_ERROR_CODES,
  verifyEmailPasswordCredentials,
} from '@/lib/native-auth';
import { ensureUserRow, claimLegacyDataForUser } from '@/lib/user-data';

const isProduction = process.env.NODE_ENV === 'production';
const devPin = !isProduction
  ? process.env.AUTH_DEV_PIN || process.env.APP_SECRET || undefined
  : undefined;
const emailPasswordEnabled = process.env.ENABLE_EMAIL_PASSWORD === 'true';

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
      async authorize(credentials) {
        const result = await verifyEmailPasswordCredentials(
          credentials?.email,
          credentials?.password
        );

        if (result.kind === 'unverified') {
          throw new Error(NATIVE_AUTH_ERROR_CODES.EMAIL_NOT_VERIFIED);
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
    async signIn({ user }) {
      if (!user.id) {
        return false;
      }

      const userId = String(user.id);
      await ensureUserRow({
        id: userId,
        email: user.email,
        name: user.name,
        image: user.image,
      });
      await claimLegacyDataForUser(userId);
      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = String(user.id);
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
