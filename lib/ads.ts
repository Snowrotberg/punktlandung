export type AdPlacement =
  | "home-left-rail"
  | "home-right-rail"
  | "solo-left-rail"
  | "solo-right-rail"
  | "party-left-rail"
  | "party-right-rail"
  | "online-left-rail"
  | "online-right-rail"
  | "lobby-left-rail"
  | "lobby-right-rail"
  | "game-bottom-left";

export type AdVariant = "banner" | "game" | "rail";

export const AD_CONSENT_STORAGE_KEY = "punktlandung-ad-consent";
export const AD_CONSENT_EVENT = "punktlandung-ad-consent-change";

const ADSENSE_CLIENT_ID = "ca-pub-9142115787733581";
const HOME_SIDEBAR_SLOT_ID = "1859262170";
const SOLO_SIDEBAR_SLOT_ID = "6536873787";
const PARTY_SIDEBAR_SLOT_ID = "8719762534";
const ONLINE_SIDEBAR_SLOT_ID = "7406680868";
const GAME_RECTANGLE_SLOT_ID = "2615986240";

const consentRequiredPlacements: Partial<Record<AdPlacement, boolean>> = {
  "online-left-rail": true,
  "online-right-rail": true
};

export const adConfig = {
  enabled: process.env.NEXT_PUBLIC_ADSENSE_ENABLED !== "false",
  clientId: process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID?.trim() || ADSENSE_CLIENT_ID,
  requireConsent: process.env.NEXT_PUBLIC_ADS_REQUIRE_CONSENT === "true",
  testMode: process.env.NEXT_PUBLIC_ADSENSE_TEST_MODE === "true",
  slots: {
    "home-left-rail": process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME_LEFT_RAIL?.trim() || HOME_SIDEBAR_SLOT_ID,
    "home-right-rail": process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME_RIGHT_RAIL?.trim() || HOME_SIDEBAR_SLOT_ID,
    "solo-left-rail": process.env.NEXT_PUBLIC_ADSENSE_SLOT_SOLO_LEFT_RAIL?.trim() || SOLO_SIDEBAR_SLOT_ID,
    "solo-right-rail": process.env.NEXT_PUBLIC_ADSENSE_SLOT_SOLO_RIGHT_RAIL?.trim() || SOLO_SIDEBAR_SLOT_ID,
    "party-left-rail": process.env.NEXT_PUBLIC_ADSENSE_SLOT_PARTY_LEFT_RAIL?.trim() || PARTY_SIDEBAR_SLOT_ID,
    "party-right-rail": process.env.NEXT_PUBLIC_ADSENSE_SLOT_PARTY_RIGHT_RAIL?.trim() || PARTY_SIDEBAR_SLOT_ID,
    "online-left-rail": process.env.NEXT_PUBLIC_ADSENSE_SLOT_ONLINE_LEFT_RAIL?.trim() || ONLINE_SIDEBAR_SLOT_ID,
    "online-right-rail": process.env.NEXT_PUBLIC_ADSENSE_SLOT_ONLINE_RIGHT_RAIL?.trim() || ONLINE_SIDEBAR_SLOT_ID,
    "lobby-left-rail": process.env.NEXT_PUBLIC_ADSENSE_SLOT_LOBBY_LEFT_RAIL?.trim() ?? "",
    "lobby-right-rail": process.env.NEXT_PUBLIC_ADSENSE_SLOT_LOBBY_RIGHT_RAIL?.trim() ?? "",
    "game-bottom-left": process.env.NEXT_PUBLIC_ADSENSE_SLOT_GAME_BOTTOM_LEFT?.trim() || GAME_RECTANGLE_SLOT_ID
  } satisfies Record<AdPlacement, string>,
  consentRequiredPlacements
};

export function isAdPlacementConfigured(placement: AdPlacement) {
  return Boolean(adConfig.enabled && adConfig.clientId && adConfig.slots[placement]);
}

export function isAdPlacementConsentRequired(placement: AdPlacement) {
  return Boolean(adConfig.requireConsent || adConfig.consentRequiredPlacements[placement]);
}
