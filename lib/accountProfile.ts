export type AccountStatus = "active" | "restricted" | "deleted";
export type ProfileVisibility = "public" | "private";
export type LoginProvider = "email" | "google" | "apple";

export type AccountIdentity = {
  accountId: string;
  provider: LoginProvider;
  providerSubject: string;
  verifiedAt: number;
  lastUsedAt: number;
};

export type PublicProfile = {
  accountId: string;
  handle: string;
  normalizedHandle: string;
  displayName: string;
  avatarKey: string | null;
  visibility: ProfileVisibility;
  status: AccountStatus;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
};

export type PublicProfileView = Pick<PublicProfile, "handle" | "displayName" | "avatarKey">;

export type ProfileValidationCode = "invalid_handle" | "reserved_handle" | "invalid_display_name" | "inactive_profile";

export class ProfileValidationError extends Error {
  constructor(readonly code: ProfileValidationCode, message: string) {
    super(message);
    this.name = "ProfileValidationError";
  }
}

const reservedHandles = new Set([
  "admin",
  "administrator",
  "moderator",
  "mod",
  "punktlandung",
  "support",
  "system",
  "team"
]);

export function normalizeHandle(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("de-DE");
}

export function validateHandle(value: string): { handle: string; normalizedHandle: string } {
  const handle = value.normalize("NFKC").trim();
  const normalizedHandle = normalizeHandle(handle);
  const length = Array.from(handle).length;
  if (length < 3 || length > 24 || !/^[\p{L}\p{N}._-]+$/u.test(handle)) {
    throw new ProfileValidationError(
      "invalid_handle",
      "Handles must contain 3 to 24 letters, numbers, dots, underscores or hyphens."
    );
  }
  if (reservedHandles.has(normalizedHandle)) {
    throw new ProfileValidationError("reserved_handle", "This handle is reserved.");
  }
  return { handle, normalizedHandle };
}

export function validateDisplayName(value: string): string {
  const displayName = value.normalize("NFKC").replace(/\s+/g, " ").trim();
  const length = Array.from(displayName).length;
  if (length < 1 || length > 40 || /[\u0000-\u001f\u007f]/u.test(displayName)) {
    throw new ProfileValidationError("invalid_display_name", "Display name is invalid.");
  }
  return displayName;
}

export type CreateProfileInput = {
  accountId: string;
  handle: string;
  displayName: string;
  visibility?: ProfileVisibility;
  now: number;
};

export function createPublicProfile(input: CreateProfileInput): PublicProfile {
  if (!input.accountId.trim() || !Number.isFinite(input.now)) {
    throw new ProfileValidationError("invalid_display_name", "Account and timestamp are required.");
  }
  const { handle, normalizedHandle } = validateHandle(input.handle);
  return {
    accountId: input.accountId,
    handle,
    normalizedHandle,
    displayName: validateDisplayName(input.displayName),
    avatarKey: null,
    visibility: input.visibility ?? "public",
    status: "active",
    createdAt: input.now,
    updatedAt: input.now,
    deletedAt: null
  };
}

export type UpdateProfileInput = {
  handle?: string;
  displayName?: string;
  visibility?: ProfileVisibility;
  now: number;
};

export function updatePublicProfile(profile: PublicProfile, input: UpdateProfileInput): PublicProfile {
  if (profile.status !== "active") throw new ProfileValidationError("inactive_profile", "Inactive profiles cannot be changed.");
  if (!Number.isFinite(input.now) || input.now < profile.createdAt) {
    throw new ProfileValidationError("invalid_display_name", "Profile timestamp is invalid.");
  }
  const handle = input.handle === undefined
    ? { handle: profile.handle, normalizedHandle: profile.normalizedHandle }
    : validateHandle(input.handle);
  return {
    ...profile,
    ...handle,
    displayName: input.displayName === undefined ? profile.displayName : validateDisplayName(input.displayName),
    visibility: input.visibility ?? profile.visibility,
    updatedAt: input.now
  };
}

export function deletePublicProfile(profile: PublicProfile, now: number): PublicProfile {
  if (!Number.isFinite(now) || now < profile.createdAt) throw new ProfileValidationError("invalid_display_name", "Deletion timestamp is invalid.");
  if (profile.status === "deleted") return profile;
  const tombstoneHandle = `deleted-${profile.accountId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16)}`;
  return {
    ...profile,
    handle: tombstoneHandle,
    normalizedHandle: tombstoneHandle.toLocaleLowerCase("de-DE"),
    displayName: "Gelöschter Spieler",
    avatarKey: null,
    visibility: "private",
    status: "deleted",
    updatedAt: now,
    deletedAt: now
  };
}

/** Public API projection; internal account and moderation fields never leave the server. */
export function toPublicProfileView(profile: PublicProfile): PublicProfileView | null {
  if (profile.status !== "active" || profile.visibility !== "public") return null;
  return {
    handle: profile.handle,
    displayName: profile.displayName,
    avatarKey: profile.avatarKey
  };
}
