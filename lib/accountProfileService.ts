import {
  createPublicProfile,
  deletePublicProfile,
  updatePublicProfile,
  toPublicProfileView,
  validateHandle,
  type CreateProfileInput,
  type PublicProfile,
  type UpdateProfileInput,
  type PublicProfileView
} from "./accountProfile";
import { AccountProfileConflictError, type AccountProfileRepository } from "./accountProfileRepository";

export type CreateAccountProfileCommand = Omit<CreateProfileInput, "accountId">;

/** Application boundary; accountId always comes from a verified server session. */
export class AccountProfileService {
  constructor(private readonly repository: AccountProfileRepository) {}

  async create(accountId: string, command: CreateAccountProfileCommand): Promise<PublicProfile> {
    this.assertAccountId(accountId);
    return this.repository.create(createPublicProfile({ ...command, accountId }));
  }

  async get(accountId: string): Promise<PublicProfile> {
    this.assertAccountId(accountId);
    const profile = await this.repository.findByAccountId(accountId);
    if (!profile) throw new AccountProfileConflictError("profile_missing", "Account profile does not exist.");
    return profile;
  }

  async getPublic(handle: string): Promise<PublicProfileView | null> {
    const { normalizedHandle } = validateHandle(handle);
    const profile = await this.repository.findByNormalizedHandle(normalizedHandle);
    return profile ? toPublicProfileView(profile) : null;
  }

  async update(accountId: string, command: UpdateProfileInput): Promise<PublicProfile> {
    this.assertAccountId(accountId);
    return this.repository.updateAtomically(accountId, (current) => updatePublicProfile(current, command));
  }

  async delete(accountId: string, now: number): Promise<PublicProfile> {
    this.assertAccountId(accountId);
    return this.repository.updateAtomically(accountId, (current) => deletePublicProfile(current, now));
  }

  private assertAccountId(accountId: string): void {
    if (!accountId.trim() || accountId.length > 256) {
      throw new AccountProfileConflictError("profile_missing", "Account profile does not exist.");
    }
  }
}
