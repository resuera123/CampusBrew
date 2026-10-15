import type { ReactNode } from "react";
import BrewBackground from "./BrewBackground";
import Navbar from "./Navbar";
import { siteConfig } from "../data/content";

/** Shared frame for the inner pages: animated background, nav, a cream platform for content, footer. */
export default function PageLayout({ children }: { children: ReactNode }) {
  const c = siteConfig;
  return (
    // "is-loaded" makes the nav items visible (they start hidden for the hero intro)
    <div className="page is-loaded">
      <BrewBackground />
      <Navbar brand={c.brand} left={c.navLeft} right={c.navRight} variant="solid" />
      <main>
        <div className="platform">{children}</div>
      </main>
      <footer className="page-footer">
        © {new Date().getFullYear()} {c.brand.name}. All rights reserved.
      </footer>
    </div>
  );
}