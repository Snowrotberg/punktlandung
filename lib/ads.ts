export type AdPlacement =
  | "home-left-rail"
  | "home-right-rail"
  | "lobby-left-rail"
  | "lobby-right-rail"
  | "game-bottom-left";

export type AdVariant = "banner" | "game" | "rail";

export const AD_CONSENT_STORAGE_KEY = "punktlandung-ad-consent";
export const AD_CONSENT_EVENT = "punktlandung-ad-consent-change";

export const adConfig = {
  enabled: process.env.NEXT_PUBLIC_ADSENSE_ENABLED === "true",
  clientId: process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID?.trim() ?? "",
  requireConsent: process.env.NEXT_PUBLIC_ADS_REQUIRE_CONSENT !== "false",
  testMode: process.env.NEXT_PUBLIC_ADSENSE_TEST_MODE === "true",
  slots: {
    "home-left-rail": process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME_LEFT_RAIL?.trim() ?? "",
    "home-right-rail": process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME_RIGHT_RAIL?.trim() ?? "",
    "lobby-left-rail": process.env.NEXT_PUBLIC_ADSENSE_SLOT_LOBBY_LEFT_RAIL?.trim() ?? "",
    "lobby-right-rail": process.env.NEXT_PUBLIC_ADSENSE_SLOT_LOBBY_RIGHT_RAIL?.trim() ?? "",
    "game-bottom-left": process.env.NEXT_PUBLIC_ADSENSE_SLOT_GAME_BOTTOM_LEFT?.trim() ?? ""
  } satisfies Record<AdPlacement, string>
};

export function isAdPlacementConfigured(placement: AdPlacement) {
  return Boolean(adConfig.enabled && adConfig.clientId && adConfig.slots[placement]);
}
