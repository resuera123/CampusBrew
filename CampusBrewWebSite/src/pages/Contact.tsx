import { useState } from "react";
import type { FormEvent } from "react";
import PageLayout from "../components/PageLayout";

/* ============ EDIT THESE ============ */
const info = [
  { label: "Email", value: "campusbrew@gmail.com" },
  { label: "Location", value: "Cebu Institute of Technology – University" },
  { label: "Hours", value: "Mon – Sat, 8:00 AM – 6:00 PM" },
];
/* ==================================== */

export default function Contact() {
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());

    // TODO: send `data` to your backend or an email service.
    console.log("Contact form:", data);

    form.reset();
    setSent(true);
  };

  return (
    <PageLayout>
      <section className="page-hero">
        <h1>Contact Us</h1>
        <p>Questions, feedback or partnership ideas? Send us a message.</p>
      </section>

      <section className="page-section contact-grid">
        <div>
          <h2>Get in touch</h2>
          <ul className="info-list">
            {info.map((i) => (
              <li key={i.label}>
                <span className="info-label">{i.label}</span>
                <span>{i.value}</span>
              </li>
            ))}
          </ul>
        </div>

        <form className="contact-form" onSubmit={handleSubmit}>
          <label>
            Name
            <input name="name" type="text" required />
          </label>
          <label>
            Email
            <input name="email" type="email" required />
          </label>
          <label>
            Message
            <textarea name="message" rows={5} required />
          </label>
          <button type="submit" className="btn-solid">Send message</button>
          {sent && <p className="form-note" role="status">Thanks! We'll get back to you soon.</p>}
        </form>
      </section>
    </PageLayout>
  );
}
