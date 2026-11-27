import type { MetadataRoute } from "next";

const siteUrl = "https://followclean.netlify.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/importar", "/conectar", "/extensao", "/instalar", "/privacidade", "/exclusao-dados"].map(
    (path) => ({
      url: `${siteUrl}${path}`,
      changeFrequency: "monthly",
      priority: path === "" ? 1 : 0.6,
    }),
  );
}
