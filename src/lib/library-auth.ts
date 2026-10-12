import { requireCurrentUser } from './auth';
import { isLibraryAdmin } from './auth-policy';

export class LibraryPermissionError extends Error {
  status = 403;
  constructor() {
    super('Only the library administrator can change the shared city library.');
    this.name = 'LibraryPermissionError';
  }
}

export async function requireLibraryAdmin() {
  const user = await requireCurrentUser();
  if (!isLibraryAdmin(user.email)) throw new LibraryPermissionError();
  return user.id;
}
