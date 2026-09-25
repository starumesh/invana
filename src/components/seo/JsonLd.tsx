import { useEffect } from "react";
import { SITE_NAME, DEFAULT_META, DEFAULT_KEYWORDS } from "@/seo/pageMeta";
import { CANONICAL_SITE_URL, publicOrigin } from "@/lib/url";

/** JSON-LD so Google understands Invana for invitation + bio data queries. */
export function JsonLd() {
  useEffect(() => {
    const origin = publicOrigin() || CANONICAL_SITE_URL;
    const data = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebSite",
          "@id": `${origin}/#website`,
          name: SITE_NAME,
          url: `${origin}/`,
          description: DEFAULT_META.description,
          publisher: { "@id": `${origin}/#organization` },
          inLanguage: "en",
        },
        {
          "@type": "Organization",
          "@id": `${origin}/#organization`,
          name: SITE_NAME,
          url: `${origin}/`,
          description:
            "Free online maker for digital invitations and marriage bio data cards.",
          logo: `${origin}/og-default.svg`,
        },
        {
          "@type": "SoftwareApplication",
          name: SITE_NAME,
          applicationCategory: "DesignApplication",
          operatingSystem: "Web",
          url: `${origin}/`,
          description: DEFAULT_META.description,
          keywords: DEFAULT_KEYWORDS,
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "INR",
          },
          featureList: [
            "Digital wedding invitations",
            "Online invitation maker",
            "Marriage bio data / biodata cards",
            "RSVP pages",
            "WhatsApp invite sharing",
          ],
          publisher: { "@id": `${origin}/#organization` },
        },
      ],
    };

    const id = "invana-jsonld";
    let script = document.getElementById(id) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = id;
      script.type = "application/ld+json";
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(data);
  }, []);

  return null;
}
