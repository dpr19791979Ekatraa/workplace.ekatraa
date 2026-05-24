import { logger } from "./logger";

const INTERAKT_MSG_URL = "https://api.interakt.ai/v1/public/message/";
const INTERAKT_TRACK_URL = "https://api.interakt.ai/v1/public/track/users/";
const DEFAULT_COUNTRY = process.env.OWNER_WHATSAPP_COUNTRY_CODE || "+91";

interface UserLike {
  id: number;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
}

function parsePhone(raw: string | null | undefined): { countryCode: string; phoneNumber: string } | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d+]/g, "");
  if (!cleaned) return null;
  if (cleaned.startsWith("+")) {
    // Best-effort split: assume 1-3 digit country code; default to +91 for IN-style 12-digit numbers.
    if (cleaned.startsWith("+91") && cleaned.length === 13) return { countryCode: "+91", phoneNumber: cleaned.slice(3) };
    if (cleaned.startsWith("+1") && cleaned.length === 12) return { countryCode: "+1", phoneNumber: cleaned.slice(2) };
    // Fallback: split first 1-3 digits as country code, prefer 2-digit
    const cc = cleaned.slice(0, 3);
    return { countryCode: cc, phoneNumber: cleaned.slice(3) };
  }
  // No leading +: assume national number, use default country
  return { countryCode: DEFAULT_COUNTRY, phoneNumber: cleaned };
}

async function interaktRequest(url: string, body: unknown): Promise<{ ok: boolean; status: number; text: string }> {
  const apiKey = process.env.INTERAKT_API_KEY;
  if (!apiKey) return { ok: false, status: 0, text: "missing INTERAKT_API_KEY" };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const text = await res.text().catch(() => "");
    return { ok: res.ok, status: res.status, text };
  } catch (err) {
    logger.warn({ err, url }, "Interakt request threw");
    return { ok: false, status: 0, text: String(err) };
  }
}

async function trackUser(user: UserLike, phone: { countryCode: string; phoneNumber: string }): Promise<void> {
  const name = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email || `user-${user.id}`;
  await interaktRequest(INTERAKT_TRACK_URL, {
    userId: `ekatraa-${user.id}`,
    countryCode: phone.countryCode,
    phoneNumber: phone.phoneNumber,
    traits: {
      name,
      email: user.email ?? undefined,
    },
  });
}

function buildMessageBody(phone: { countryCode: string; phoneNumber: string }, message: string) {
  const templateName = process.env.INTERAKT_TEMPLATE_NAME;
  const templateLang = process.env.INTERAKT_TEMPLATE_LANG || "en";
  const text = message.slice(0, 1000);
  if (templateName) {
    return {
      countryCode: phone.countryCode,
      phoneNumber: phone.phoneNumber,
      type: "Template",
      template: {
        name: templateName,
        languageCode: templateLang,
        bodyValues: [text],
      },
    };
  }
  return {
    countryCode: phone.countryCode,
    phoneNumber: phone.phoneNumber,
    type: "Text",
    data: { message: text },
  };
}

export async function sendUserWhatsApp(user: UserLike, message: string): Promise<void> {
  if (!process.env.INTERAKT_API_KEY) return;
  const phone = parsePhone(user.phone);
  if (!phone) return;
  // Try to send; if customer not registered, register and retry once.
  let res = await interaktRequest(INTERAKT_MSG_URL, buildMessageBody(phone, message));
  if (!res.ok && res.text.includes("Customer is not available")) {
    await trackUser(user, phone);
    res = await interaktRequest(INTERAKT_MSG_URL, buildMessageBody(phone, message));
  }
  if (!res.ok) {
    logger.warn({ status: res.status, body: res.text.slice(0, 300), userId: user.id }, "Interakt user send failed");
  }
}

export async function sendOwnerWhatsApp(message: string): Promise<void> {
  const countryCode = process.env.OWNER_WHATSAPP_COUNTRY_CODE;
  const phoneNumber = process.env.OWNER_WHATSAPP_NUMBER;
  if (!process.env.INTERAKT_API_KEY || !countryCode || !phoneNumber) return;
  const phone = { countryCode, phoneNumber };
  const res = await interaktRequest(INTERAKT_MSG_URL, buildMessageBody(phone, message));
  if (!res.ok) {
    logger.warn({ status: res.status, body: res.text.slice(0, 300) }, "Interakt owner send failed");
  }
}
