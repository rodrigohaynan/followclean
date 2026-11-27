import type { MetadataRoute } from "next";

const siteUrl = "https://followclean.netlify.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Rotas técnicas e retornos de login não devem aparecer em buscadores.
      disallow: ["/api/", "/conectar/autorizar", "/conectar/android-retorno", "/app/"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
