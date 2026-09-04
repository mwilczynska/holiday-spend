/**
 * Sets an email/password login for a local user so the app can be run from a production
 * build, where the development PIN is disabled by design (`src/lib/auth.ts:20`).
 *
 * The password is read from an interactive prompt with echo suppressed. It is never accepted
 * as a command-line argument or environment variable, so it cannot leak into shell history,
 * process listings, or logs. Run this yourself in a real terminal:
 *
 *   npm run auth:set-local-password
 *
 * Hashing and strength rules come from `src/lib/password.ts`, so this stays consistent with
 * the signup and reset flows rather than inventing its own policy.
 */
import { eq } from 'drizzle-orm';
import readline from 'node:readline';
import { db } from '@/db';
import { userPasswords, users } from '@/db/schema';
import { hashPassword, validatePasswordStrength } from '@/lib/password';

const DEFAULT_USER_ID = 'dev-local-user';

const KEY_ENTER = '\r';
const KEY_NEWLINE = '\n';
const KEY_EOT = String.fromCharCode(4); // Ctrl+D
const KEY_ETX = String.fromCharCode(3); // Ctrl+C
const KEY_BACKSPACE = String.fromCharCode(127); // DEL

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to run with NODE_ENV=production. This is a local administration tool.');
  process.exit(1);
}

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

/** Reads a line without echoing it, so the password never appears on screen. */
function promptSecret(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    if (!input.isTTY) {
      reject(
        new Error(
          'No interactive terminal available. Run this directly in PowerShell or a shell, ' +
            'not through a non-interactive tool.',
        ),
      );
      return;
    }

    process.stdout.write(question);
    input.setRawMode(true);
    input.resume();
    input.setEncoding('utf8');

    let value = '';
    const finish = (result: string) => {
      input.setRawMode(false);
      input.pause();
      input.removeListener('data', onData);
      process.stdout.write('\n');
      resolve(result);
    };

    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === KEY_ENTER || ch === KEY_NEWLINE || ch === KEY_EOT) {
          finish(value);
          return;
        }
        if (ch === KEY_ETX) {
          input.setRawMode(false);
          input.pause();
          input.removeListener('data', onData);
          process.stdout.write('\n');
          process.exit(130);
        }
        if (ch === KEY_BACKSPACE || ch === '\b') {
          value = value.slice(0, -1);
          continue;
        }
        value += ch;
      }
    };

    input.on('data', onData);
  });
}

async function main() {
  const userId = process.argv[2] ?? DEFAULT_USER_ID;

  const user = await db
    .select({ id: users.id, email: users.email, emailVerified: users.emailVerified })
    .from(users)
    .where(eq(users.id, userId))
    .get();

  if (!user) {
    console.error(`No user with id "${userId}".`);
    process.exit(1);
  }

  console.log(`User:  ${user.id}`);
  console.log(`Email: ${user.email}`);
  console.log('This email and password will be your production login.\n');

  const password = await promptSecret('New password (min 10 chars, not all digits): ');
  const confirmation = await promptSecret('Confirm password: ');

  if (password !== confirmation) {
    console.error('Passwords did not match. Nothing was changed.');
    process.exit(1);
  }

  const strength = validatePasswordStrength(password);
  if (!strength.ok) {
    console.error(`${strength.reason} Nothing was changed.`);
    process.exit(1);
  }

  const hash = await hashPassword(password);

  await db
    .insert(userPasswords)
    .values({ userId: user.id, hash, algorithm: 'argon2id' })
    .onConflictDoUpdate({
      target: userPasswords.userId,
      set: { hash, algorithm: 'argon2id', updatedAt: new Date().toISOString() },
    });

  // `verifyEmailPasswordCredentials` returns `unverified` when `emailVerified` is null, so a
  // password alone is not enough to sign in. This account is local-only and its address is not
  // a real mailbox, so there is no verification email to complete.
  if (!user.emailVerified) {
    const confirm = await prompt(
      `\n"${user.email}" is not verified, and login refuses unverified accounts.\n` +
        'Mark it verified so this local account can sign in? [y/N] ',
    );
    if (confirm.trim().toLowerCase() === 'y') {
      await db.update(users).set({ emailVerified: new Date() }).where(eq(users.id, user.id));
      console.log('Marked verified.');
    } else {
      console.log('Left unverified. The password is set but sign-in will be refused.');
    }
  }

  console.log(`\nDone. Sign in at /login with ${user.email} and the password you just set.`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
