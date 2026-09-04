"use client";

import { FormEvent, useState } from "react";

type Fields = "name" | "contact" | "message";
type Errors = Partial<Record<Fields, string>>;

const emailAddress = "info@diellart.com";

function validate(form: HTMLFormElement): Errors {
  const data = new FormData(form);
  const name = String(data.get("name") ?? "").trim();
  const contact = String(data.get("contact") ?? "").trim();
  const message = String(data.get("message") ?? "").trim();
  const errors: Errors = {};

  if (!name) errors.name = "Shkruaj emrin tënd.";
  if (!contact || (!contact.includes("@") && contact.replace(/\D/g, "").length < 7)) {
    errors.contact = "Shkruaj një email ose numër telefoni të vlefshëm.";
  }
  if (message.length < 10) errors.message = "Na jep pak më shumë detaje (të paktën 10 shenja).";
  return errors;
}

export function ContactSection() {
  const [errors, setErrors] = useState<Errors>({});
  const [emailHref, setEmailHref] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validate(event.currentTarget);
    setErrors(nextErrors);
    setEmailHref(null);

    if (Object.keys(nextErrors).length) {
      requestAnimationFrame(() => {
        event.currentTarget.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
      });
      return;
    }

    const data = new FormData(event.currentTarget);
    const body = [
      `Emri: ${data.get("name")}`,
      `Kompania / Biznesi: ${data.get("company") || "—"}`,
      `Kontakti: ${data.get("contact")}`,
      "",
      String(data.get("message")),
    ].join("\n");
    setEmailHref(`mailto:${emailAddress}?subject=${encodeURIComponent("Kërkesë e re nga faqja DiellART")}&body=${encodeURIComponent(body)}`);
  };

  return (
    <section id="contact" className="contact-section" aria-labelledby="contact-heading">
      <div className="container contact-grid">
        <div className="contact-intro">
          <p className="text-eyebrow contact-eyebrow">Le ta bëjmë realitet.</p>
          <h2 id="contact-heading" className="contact-heading">Nga ideja,<br /><span>në tavolinë.</span></h2>
          <p className="contact-copy">Na trego çfarë dëshiron të personalizosh dhe ekipi DiellART do të të kontaktojë.</p>
          <div className="contact-details" aria-label="Mënyra kontakti">
            <a href={`mailto:${emailAddress}`}><span>Email</span><strong>{emailAddress}</strong><span aria-hidden="true">↗</span></a>
            <a href="https://wa.me/355698502466" target="_blank" rel="noopener noreferrer"><span>WhatsApp</span><strong>+355 69 850 2466</strong><span aria-hidden="true">↗</span></a>
          </div>
        </div>

        <form className="contact-form" noValidate onSubmit={handleSubmit}>
          <div className="contact-field">
            <label htmlFor="contact-name">Emri <span aria-hidden="true">*</span></label>
            <input id="contact-name" name="name" autoComplete="name" aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "contact-name-error" : undefined} onChange={() => setErrors((current) => ({ ...current, name: undefined }))} />
            {errors.name ? <p id="contact-name-error" className="contact-error">{errors.name}</p> : null}
          </div>
          <div className="contact-field">
            <label htmlFor="contact-company">Kompania / Biznesi</label>
            <input id="contact-company" name="company" autoComplete="organization" />
          </div>
          <div className="contact-field">
            <label htmlFor="contact-detail">Email ose telefon <span aria-hidden="true">*</span></label>
            <input id="contact-detail" name="contact" autoComplete="email" inputMode="email" aria-invalid={Boolean(errors.contact)} aria-describedby={errors.contact ? "contact-detail-error" : undefined} onChange={() => setErrors((current) => ({ ...current, contact: undefined }))} />
            {errors.contact ? <p id="contact-detail-error" className="contact-error">{errors.contact}</p> : null}
          </div>
          <div className="contact-field contact-message-field">
            <label htmlFor="contact-message">Mesazhi <span aria-hidden="true">*</span></label>
            <textarea id="contact-message" name="message" rows={3} placeholder="Çfarë dëshiron të printosh?" aria-invalid={Boolean(errors.message)} aria-describedby={errors.message ? "contact-message-error" : undefined} onChange={() => setErrors((current) => ({ ...current, message: undefined }))} />
            {errors.message ? <p id="contact-message-error" className="contact-error">{errors.message}</p> : null}
          </div>
          <button className="contact-submit" type="submit"><span>Dërgo kërkesën</span><span aria-hidden="true">→</span></button>
          <p className="contact-form-note">Dërgimi online po përgatitet. Pas kontrollit të formularit, kërkesa hapet gati për t’u dërguar me email.</p>
          {emailHref ? (
            <div className="contact-delivery-note" role="status">
              <p>Formulari u kontrollua, por nuk është dërguar ende.</p>
              <a href={emailHref}>Hap emailin dhe dërgo kërkesën <span aria-hidden="true">→</span></a>
            </div>
          ) : null}
        </form>
      </div>
    </section>
  );
}
