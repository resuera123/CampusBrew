import { useRef } from "react";
import { Link } from "react-router-dom";
import BrewBackground from "./BrewBackground";
import Navbar from "./Navbar";
import Headline from "./Headline";
import Fade from "./Fade";
import { useImagesLoaded } from "../hooks/useImagesLoaded";
import { useParallax } from "../hooks/useParallax";
import { siteConfig } from "../data/content";

export default function Hero() {
  const c = siteConfig;
  const heroRef = useRef<HTMLElement>(null);
  const loaded = useImagesLoaded([]); // no photos to wait for
  useParallax(heroRef);

  const afterHeadline = 0.9 + c.headline.split(" ").length * 0.14 + 0.3;

  return (
    <header ref={heroRef} className={`hero ${loaded ? "is-loaded" : ""}`}>
      <BrewBackground />

      <Navbar brand={c.brand} left={c.navLeft} right={c.navRight} />

      <div className="content">
        <Headline text={c.headline} />
        <Fade delay={afterHeadline}>
          <p className="tagline">{c.tagline}</p>
        </Fade>
        <Fade delay={afterHeadline + 0.3} className="btn-wrap">
          <Link to={c.cta.to} className="btn">
            <span className="btn-label">{c.cta.label}</span>
          </Link>
        </Fade>
      </div>
    </header>
  );
}
