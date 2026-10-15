import { Routes, Route } from "react-router-dom";
import Hero from "./components/Hero";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Download from "./pages/Download";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Hero />} />
      <Route path="/about" element={<About />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/download" element={<Download />} />
    </Routes>
  );
}
