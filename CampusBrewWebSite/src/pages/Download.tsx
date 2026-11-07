import PageLayout from "../components/PageLayout";

/* ============ EDIT THESE ============ */
const app = {
  name: "CampusBrew",
  version: "1.0.0",
  size: "73 MB",
  // EAS build 35c6ad48 (Android APK), hosted on Google Drive. The uc?export=download
  // form downloads the file straight away instead of opening Drive's preview page.
  androidFile: "https://drive.google.com/uc?export=download&id=1IKojGqQoiZ3R4VmLosn9S13YJOUa5NGd",
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
          <img className="download-icon" src="/logo-badge.png" alt="CampusBrew app icon" />
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
