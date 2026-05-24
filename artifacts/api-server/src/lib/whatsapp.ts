import { logger } from "./logger";

const INTERAKT_URL = "https://api.interakt.ai/v1/public/message/";

export async function sendOwnerWhatsApp(message: string): Promise<void> {
  const apiKey = process.env.INTERAKT_API_KEY;
  const countryCode = process.env.OWNER_WHATSAPP_COUNTRY_CODE;
  const phoneNumber = process.env.OWNER_WHATSAPP_NUMBER;
  if (!apiKey || !countryCode || !phoneNumber) return;

  const templateName = process.env.INTERAKT_TEMPLATE_NAME;
  const templateLang = process.env.INTERAKT_TEMPLATE_LANG || "en";
  const text = message.slice(0, 1000);

  const body = templateName
    ? {
        countryCode,
        phoneNumber,
        type: "Template",
        template: {
          name: templateName,
          languageCode: templateLang,
          bodyValues: [text],
        },
      }
    : {
        countryCode,
        phoneNumber,
        type: "Text",
        data: { message: text },
      };

  try {
    const res = await fetch(INTERAKT_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const respText = await res.text().catch(() => "");
      logger.warn({ status: res.status, body: respText.slice(0, 300) }, "Interakt send failed");
    }
  } catch (err) {
    logger.warn({ err }, "Interakt send threw");
  }
}
