import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Recipe Ninja",
    short_name: "Recipe Ninja",
    description: "Your personal recipe library: save, scale and cook.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#fbfaf8",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
