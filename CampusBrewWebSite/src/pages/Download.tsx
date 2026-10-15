import PageLayout from "../components/PageLayout";

/* ============ EDIT THESE ============ */
const app = {
  name: "CampusBrew",
  version: "1.0.0",
  size: "00 MB",
  androidFile: "/downloads/campusbrew.apk", // put the file in public/downloads/
};

const steps = [
  "Download the file to your phone.",
  "Open it and allow installation if your phone asks.",
  "Sign in with your account.",
  "Pick a campus spot and place your first order.",
];

const requirements = ["Android 8.0 or newer", "Internet connection", "A campus account"];
/* ==================================== */

export default function Download() {
  return (
    <PageLayout>
      <section className="page-hero">
        <h1>Download {app.name}</h1>
        <p>Get the app and start ordering from your favorite campus beverage spots.</p>
      </section>

      <section className="page-section">
        <div className="card download-card">
          <p className="meta">Version {app.version} · {app.size}</p>
          <div className="download-actions">
            <a href={app.androidFile} download className="btn-solid">
              Download for Android
            </a>
            <span className="btn-ghost is-disabled" aria-disabled="true">
              iOS · Coming soon
            </span>
          </div>
        </div>
      </section>

      <section className="page-section two-col">
        <div>
          <h2>How to install</h2>
          <ol className="steps">
            {steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
        <div>
          <h2>Requirements</h2>
          <ul className="steps">
            {requirements.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      </section>
    </PageLayout>
  );
}
