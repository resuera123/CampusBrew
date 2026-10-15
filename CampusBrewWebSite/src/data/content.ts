export interface NavLink {
  label: string;
  to: string; // route path, e.g. "/about"
}

export const siteConfig = {
  brand: { name: "CampusBrew", subtitle: "ᜃᜋ᜔ᜉᜓᜐ᜔ ᜃᜉᜒ" },
  navLeft: [{ label: "About Us", to: "/about" }] as NavLink[],
  navRight: [{ label: "Contact", to: "/contact" }] as NavLink[],
  headline: "Sip. Study. Repeat.",
  tagline: "Great drinks, delivered right to where you are on campus.",
  cta: { label: "Download here", to: "/download" } as NavLink,
};
