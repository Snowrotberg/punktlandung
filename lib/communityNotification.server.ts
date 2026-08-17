import "server-only";

import nodemailer from "nodemailer";

function htmlEscape(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character);
}

export async function notifyAboutCommunitySuggestion(input: { title: string; details: string; authorLabel: string }) {
  const gmailUser = process.env.FEEDBACK_GMAIL_USER?.trim();
  const gmailAppPassword = process.env.FEEDBACK_GMAIL_APP_PASSWORD?.replace(/\s+/g, "");
  const recipient = process.env.FEEDBACK_TO_EMAIL?.trim() || "aintartstudio@gmail.com";
  if (!gmailUser || !gmailAppPassword) {
    console.warn("Community notification mail transport is not configured.");
    return;
  }

  const transport = nodemailer.createTransport({ service: "gmail", auth: { user: gmailUser, pass: gmailAppPassword } });
  await transport.sendMail({
    from: `Punktlandung Web <${gmailUser}>`,
    to: recipient,
    subject: `[Punktlandung Community] Neuer Vorschlag: ${input.title}`,
    text: `Von: ${input.authorLabel}\n\n${input.title}\n\n${input.details}\n\nIm Adminbereich prüfen: ${process.env.NEXT_PUBLIC_APP_URL || "https://punktlandung.app"}/admin`,
    html: `<p><strong>Von:</strong> ${htmlEscape(input.authorLabel)}</p><h2>${htmlEscape(input.title)}</h2><p style="white-space:pre-wrap">${htmlEscape(input.details)}</p><p><a href="${htmlEscape(process.env.NEXT_PUBLIC_APP_URL || "https://punktlandung.app")}/admin">Im Adminbereich prüfen</a></p>`
  });
}
