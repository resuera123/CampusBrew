import { Link } from "react-router-dom";
import Fade from "./Fade";
import type { NavLink } from "../data/content";

interface NavbarProps {
  brand: { name: string; subtitle: string };
  left: NavLink[];
  right: NavLink[];
  /** "overlay" floats on top of the hero; "solid" is the coral bar used on inner pages */
  variant?: "overlay" | "solid";
}

export default function Navbar({ brand, left, right, variant = "overlay" }: NavbarProps) {
  return (
    <nav className={variant === "solid" ? "nav--solid" : undefined}>
      <Fade delay={1.0} className="from-top">
        <div className="nav-left">
          {left.map((l) => (
            <Link key={l.label} to={l.to} className="nav-link">{l.label}</Link>
          ))}
        </div>
      </Fade>

      <Fade delay={1.1} className="from-top">
        <Link to="/" className="logo">
          <span className="name">{brand.name}</span>
          <span className="sub">{brand.subtitle}</span>
        </Link>
      </Fade>

      <Fade delay={1.2} className="from-top">
        <div className="nav-right">
          {right.map((l) => (
            <Link key={l.label} to={l.to} className="nav-link">{l.label}</Link>
          ))}
        </div>
      </Fade>
    </nav>
  );
}
