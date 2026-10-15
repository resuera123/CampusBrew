import PageLayout from "../components/PageLayout";

/* ============ EDIT THESE ============ */
const intro =
  "CampusBrew is a mobile ordering platform that lets CIT-U students order beverages from campus shops and have them delivered by fellow students.";

const credit = "A capstone project by Team 2627-sem2-it411-35 · Cebu Institute of Technology – University";

const story = [
  "Beverage shops around CIT-U serve a constant stream of students, but buying a drink means walking to the shop, waiting in line, and heading back, all within a 10–15 minute class break. At peak hours the queue can outlast the break itself, so students either skip their drink or arrive late to class.",
  "Existing delivery apps aren't built for this. They target city-wide delivery with motorized couriers, which doesn't fit short, low-value, on-foot trips inside a single campus. Meanwhile, campus shops have no digital order system, and students with free time between classes have no flexible way to earn.",
  "CampusBrew brings these together: students order from their phones, fellow students deliver on foot between classes, and shops get a simple digital queue.",
];

const steps = [
  {
    title: "Order",
    text: "Browse partner shop menus, customize your drink (size, sugar level, temperature, add-ons), set your delivery spot and confirm.",
  },
  {
    title: "Match",
    text: "Your order goes to the nearest active student delivery partner. If they don't respond in time, it's reassigned automatically.",
  },
  {
    title: "Pay & prepare",
    text: "Pay in the app with GCash. The shop sees your order in its digital queue and prepares your drinks.",
  },
  {
    title: "Deliver",
    text: "Your drink is brought to you on foot, and both sides confirm the delivery in the app.",
  },
];

const roles = [
  {
    title: "Student customers",
    text: "Browse menus from partner shops, order in a few taps, follow your order at every stage, and reorder favorites with one tap.",
  },
  {
    title: "Student delivery partners",
    text: "Earn on the side by delivering on foot. Set yourself active or inactive around your class schedule, with no penalty for declining.",
  },
  {
    title: "Partner shops",
    text: "Manage menus and item availability, accept or reject orders from a digital queue, and see daily and weekly sales summaries.",
  },
];

const targets = [
  { value: "≥50%", label: "less time ordering than physically queuing" },
  { value: "≤15 min", label: "average order-to-delivery time on campus" },
  { value: "≥99%", label: "accuracy in logging GCash transactions" },
  { value: "≥40%", label: "faster order processing for partner shops" },
];

const scope = [
  { title: "Beverages only", text: "Full meal orders are outside the current scope." },
  { title: "On foot, on campus", text: "Deliveries stay within the CIT-U campus; no motorized vehicles." },
  { title: "GCash payments", text: "Payment and transaction logging happen inside the app." },
  { title: "Built for CIT-U", text: "Designed for the campus and the shops in its immediate vicinity." },
];

// Add each member's role, e.g. "Project Manager", "Lead Developer"
const team = [
  { name: "Jefferus J. Resuera Jr.", role: "Team Member" },
  { name: "Rhyz Nhicco C. Libetario", role: "Team Member" },
  { name: "John Emilio G. Noel", role: "Team Member" },
  { name: "Craig Zachary L. Salgado", role: "Team Member" },
];
/* ==================================== */

function initials(name: string): string {
  const parts = name.replace(/\b(Jr|Sr)\.?/i, "").split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

export default function About() {
  return (
    <PageLayout>
      <section className="page-hero">
        <h1>About Us</h1>
        <p>{intro}</p>
        <p className="credit">{credit}</p>
      </section>

      <section className="page-section">
        <h2>Why CampusBrew</h2>
        {story.map((p, i) => (
          <p key={i} className="story-p">{p}</p>
        ))}
      </section>

      <section className="page-section">
        <h2>How it works</h2>
        <div className="card-grid">
          {steps.map((s, i) => (
            <div key={s.title} className="card">
              <span className="step-num">{i + 1}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="page-section">
        <h2>Built for three kinds of users</h2>
        <div className="card-grid">
          {roles.map((r) => (
            <div key={r.title} className="card">
              <h3>{r.title}</h3>
              <p>{r.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="page-section">
        <h2>What we're aiming for</h2>
        <div className="stat-grid">
          {targets.map((t) => (
            <div key={t.value} className="stat">
              <strong>{t.value}</strong>
              <span>{t.label}</span>
            </div>
          ))}
        </div>
        <p className="fine-print">These are our project targets, measured during testing.</p>
      </section>

      <section className="page-section">
        <h2>Scope</h2>
        <div className="card-grid">
          {scope.map((s) => (
            <div key={s.title} className="card">
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="page-section">
        <h2>Meet the team</h2>
        <div className="card-grid">
          {team.map((m) => (
            <div key={m.name} className="card team-card">
              <div className="avatar" aria-hidden="true">{initials(m.name)}</div>
              <h3>{m.name}</h3>
              <p>{m.role}</p>
            </div>
          ))}
        </div>
      </section>
    </PageLayout>
  );
}