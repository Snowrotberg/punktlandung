import type { Metadata, Viewport } from "next";

export const mobileAppleWebApp: NonNullable<Metadata["appleWebApp"]> = {
  capable: true,
  statusBarStyle: "black-translucent",
  title: "Punktlandung"
};

export const mobileViewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#020617"
};
