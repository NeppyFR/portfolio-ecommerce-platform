import { CARRIER, LABEL, SHOP_DOMAIN, SUPPORT_EMAIL } from "@/lib/brand";
import { formatChf, formatDate } from "@/lib/format";
import { sizeLabel } from "@/lib/product-rules";
import type { EmailTemplate, Lang, Order } from "./types";

/**
 * The two real templates, as plain HTML with no external font, which is also what a real
 * mail client would show. Shown in `<iframe sandbox srcdoc>`. Nothing is ever sent.
 */
const SERIF = "font-family:Georgia,'Times New Roman',serif";

const COPY: Record<Lang, Record<string, string>> = {
  en: {
    banner: "Test order – nothing was charged",
    confirmSubject: "Your order {number}",
    confirmTitle: "Thank you for your order.",
    confirmBody: "We have your order and will pack it soon. You get a second mail when it leaves the studio.",
    shipSubject: "Your order {number} is on its way",
    shipTitle: "Your order is on its way.",
    shipBody: "Your parcel has left the studio with {carrier}. Tracking number: {tracking}.",
    item: "Item", qty: "Qty", total: "Total", subtotal: "Subtotal", discount: "Discount", shipping: "Shipping", free: "Free", to: "Delivery address", placed: "Placed on", questions: "Questions? Write to {mail}.",
  },
  de: {
    banner: "Testbestellung – es wurde nichts belastet",
    confirmSubject: "Deine Bestellung {number}",
    confirmTitle: "Danke für deine Bestellung.",
    confirmBody: "Wir haben deine Bestellung erhalten und packen sie bald. Du bekommst eine zweite Mail, sobald sie das Studio verlässt.",
    shipSubject: "Deine Bestellung {number} ist unterwegs",
    shipTitle: "Deine Bestellung ist unterwegs.",
    shipBody: "Dein Paket hat das Studio mit {carrier} verlassen. Sendungsnummer: {tracking}.",
    item: "Artikel", qty: "Anz.", total: "Total", subtotal: "Zwischensumme", discount: "Rabatt", shipping: "Versand", free: "Gratis", to: "Lieferadresse", placed: "Bestellt am", questions: "Fragen? Schreib an {mail}.",
  },
};

const escapeHtml = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const fill = (text: string, vars: Record<string, string>) => text.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? "");

export function renderEmailParts(order: Order, template: EmailTemplate): { subject: string; html: string; text: string } {
  const t = COPY[order.locale];
  const isShip = template === "shipping_notification";
  const vars = { number: order.orderNumber, carrier: order.trackingCarrier ?? CARRIER.name, tracking: order.trackingNumber ?? "", mail: SUPPORT_EMAIL };
  const subject = fill(isShip ? t.shipSubject : t.confirmSubject, vars);
  const title = isShip ? t.shipTitle : t.confirmTitle;
  const body = fill(isShip ? t.shipBody : t.confirmBody, vars);
  const lines = order.items.map((item) => {
    const name = order.locale === "de" ? item.nameDe : item.name;
    const size = item.size === "ONE_SIZE" ? "" : ` · ${sizeLabel(item.size, order.locale)}`;
    return { label: `${name}${size}`, quantity: item.quantity, total: formatChf(item.lineTotalRappen) };
  });
  const row = (label: string, value: string, strong = false) => `<tr><td style="padding:4px 0;${strong ? "font-weight:bold;" : ""}">${escapeHtml(label)}</td><td style="padding:4px 0;text-align:right;${strong ? "font-weight:bold;" : ""}">${escapeHtml(value)}</td></tr>`;
  const address = order.shippingAddress;
  const html = `<!doctype html><html lang="${order.locale}"><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head><body style="margin:0;padding:24px;background:#ffffff;color:#0a1f63;${SERIF};font-size:16px;line-height:1.5">
<p style="margin:0 0 24px;padding:8px 12px;background:#e9f1ff;font-size:13px">${escapeHtml(t.banner)}</p>
<p style="margin:0 0 4px;font-style:italic;font-size:20px">${escapeHtml(LABEL.name)}</p>
<h1 style="margin:0 0 12px;font-size:26px;font-weight:normal">${escapeHtml(title)}</h1>
<p style="margin:0 0 20px">${escapeHtml(body)}</p>
<p style="margin:0 0 16px;font-size:14px">${escapeHtml(order.orderNumber)} · ${escapeHtml(t.placed)} ${escapeHtml(formatDate(order.placedAt))}</p>
<table style="width:100%;border-collapse:collapse;font-size:15px"><thead><tr><th style="text-align:left;padding:4px 0">${escapeHtml(t.item)}</th><th style="text-align:right;padding:4px 0">${escapeHtml(t.total)}</th></tr></thead><tbody>
${lines.map((l) => row(`${l.quantity} × ${l.label}`, l.total)).join("\n")}
${row(t.subtotal, formatChf(order.subtotalRappen))}
${order.discountRappen > 0 ? row(`${t.discount}${order.discountCode ? ` (${order.discountCode})` : ""}`, formatChf(-order.discountRappen)) : ""}
${row(t.shipping, order.shippingRappen === 0 ? t.free : formatChf(order.shippingRappen))}
${row(t.total, formatChf(order.totalRappen), true)}
</tbody></table>
<p style="margin:20px 0 4px;font-weight:bold">${escapeHtml(t.to)}</p>
<p style="margin:0 0 20px">${escapeHtml(address.fullName)}<br>${escapeHtml(address.line1)}<br>${escapeHtml(address.postalCode)} ${escapeHtml(address.city)}</p>
<p style="margin:0;font-size:13px">${escapeHtml(fill(t.questions, vars))} ${escapeHtml(SHOP_DOMAIN)}</p>
</body></html>`;
  const text = [t.banner, "", title, body, "", `${order.orderNumber} · ${t.placed} ${formatDate(order.placedAt)}`, ...lines.map((l) => `${l.quantity} x ${l.label}: ${l.total}`), `${t.total}: ${formatChf(order.totalRappen)}`, "", fill(t.questions, vars)].join("\n");
  return { subject, html, text };
}
