import { DROP_CHECKLIST } from "@/lib/drop-checklist";
import type { Lang } from "@/store/types";

/**
 * German wording of the invented tasks, events and ledger rows. The store keeps plain strings, because viewers can edit them.
 * A title someone has typed misses this map and stays as typed.
 */
const GERMAN: Record<string, string> = {
  // Task lists
  "Parcels and stock": "Pakete und Lager",
  Books: "Buchhaltung",
  "Aurora drop day": "Drop-Tag Aurora",
  "Cirrus ideas": "Ideen für Cirrus",
  // Tasks
  "Approve the Aurora lamp shade": "Lampenschirm für Aurora freigeben",
  "Second sample came back too dark.": "Das zweite Muster kam zu dunkel zurück.",
  "Reply to the printer about notebook ink": "Der Druckerei wegen der Notizbuch-Farbe antworten",
  "Write the Aurora product texts": "Produkttexte für Aurora schreiben",
  "Book the shoot location": "Location für das Shooting buchen",
  "Pick the Aurora product tag colour": "Farbe des Aurora-Anhängers wählen",
  "Send test notes to the sample studio": "Testnotizen ans Musterstudio schicken",
  "Collect finish samples for Cirrus": "Oberflächenmuster für Cirrus sammeln",
  "Update the dimensions overview": "Massübersicht aktualisieren",
  "Archive the old catalogue drafts": "Alte Katalog-Entwürfe archivieren",
  "Pack the morning orders": "Bestellungen vom Morgen packen",
  "Count the Lagoon speakers again": "Lagoon-Lautsprecher nochmals zählen",
  "System says none left in M, the shelf says one.": "Das System meldet in M keinen mehr, im Regal steht einer.",
  "Order more mailing boxes": "Mehr Versandkartons bestellen",
  "Receive the second Lagoon speaker run": "Zweite Serie der Lagoon-Lautsprecher entgegennehmen",
  "Check the returned parcels": "Retourpakete prüfen",
  "Label the new shelf row": "Neue Regalreihe beschriften",
  "Clear the sample shelf": "Musterregal räumen",
  "Set low-stock thresholds for lamps": "Mindestbestände für Lampen festlegen",
  "Book the December payout": "Auszahlung vom Dezember verbuchen",
  "Book this month's running costs": "Laufende Kosten dieses Monats verbuchen",
  "Finish the 2026 stock count": "Inventur 2026 abschliessen",
  "Close the quarterly report": "Quartalsbericht abschliessen",
  "Link the mug restock to its invoice": "Tassen-Nachschub mit der Rechnung verknüpfen",
  "Check the planning rates": "Planungskurse prüfen",
  "File the November receipts": "Belege vom November ablegen",
  "Sketch a travel candle tin and a fold-flat bottle": "Reisekerzen-Dose und faltbare Flasche skizzieren",
  "Ask two factories for summer prices": "Zwei Fabriken nach Sommerpreisen fragen",
  "Decide on a launch window": "Zeitfenster für den Start festlegen",
  "Note what sold out first in Lagoon": "Notieren, was bei Lagoon zuerst ausverkauft war",
  // Calendar
  "Aurora sample review": "Muster-Review Aurora",
  "Second shade sample due": "Zweites Schirmmuster fällig",
  "The sample studio promised it by this day.": "Das Musterstudio hat es bis zu diesem Tag versprochen.",
  "Lagoon restock sample check": "Musterprüfung Lagoon-Nachschub",
  "Cirrus first finish samples": "Erste Oberflächenmuster für Cirrus",
  "Aurora catalogue shoot": "Katalog-Shooting Aurora",
  "Plain cloud backdrop, two setups.": "Schlichter heller Hintergrund, zwei Aufbauten.",
  "Product stills, Aurora": "Produktfotos, Aurora",
  "Lagoon restock stills": "Produktfotos Lagoon-Nachschub",
  "Monday stand-up": "Stand-up am Montag",
  "Quarter review with the numbers": "Quartalsrückblick mit den Zahlen",
  "Packing routine walk-through": "Packablauf durchgehen",
  "Supplier call, Ceramica Lago": "Lieferantengespräch, Ceramica Lago",
  "Quarterly filing deadline": "Frist für die Quartalsabrechnung",
  "Everything for the tax authority ready by then.": "Bis dann alles für die Steuerbehörde bereit haben.",
  "Insurance renewal": "Versicherung erneuern",
  "Data request answered by": "Datenauskunft beantworten bis",
  "Aurora teaser posts start": "Aurora-Teaser-Posts starten",
  "Aurora launch mail goes out": "Start-Mail für Aurora geht raus",
  "Lagoon restock banner": "Banner für den Lagoon-Nachschub",
  "Last chance campaign recap": "Rückblick auf die Letzte-Chance-Aktion",
  "Parcel pick-up moved to morning": "Paketabholung auf den Morgen verschoben",
  "Stock count on the shelf": "Inventur am Regal",
  "Bring the scanner and the printout.": "Scanner und Ausdruck mitbringen.",
  "Studio closed": "Studio geschlossen",
  "Lagoon second run back in the shop": "Zweite Lagoon-Serie wieder im Shop",
  // Ledger
  "Studio lead's starting deposit": "Starteinlage der Studioleitung",
  "Sample run, first wax tests": "Musterlauf, erste Wachstests",
  "Label and product tag design": "Design von Etikett und Anhänger",
  "Terms of sale, legal check": "AGB, rechtliche Prüfung",
  "Shelving and a label printer": "Regale und ein Etikettendrucker",
  "Frost production deposit": "Anzahlung Produktion Frost",
  "Frost production final": "Schlusszahlung Produktion Frost",
  "Mailing boxes, first batch": "Versandkartons, erste Lieferung",
  "Launch shoot, Frost": "Start-Shooting, Frost",
  "Parcel tape": "Paketband",
  "Paid in cash, category still open.": "Bar bezahlt, Kategorie noch offen.",
  "Second deposit for Lagoon": "Zweite Einlage für Lagoon",
  "Lagoon production deposit": "Anzahlung Produktion Lagoon",
  "Lagoon production final": "Schlusszahlung Produktion Lagoon",
  "Mailing boxes, second batch": "Versandkartons, zweite Lieferung",
  "Lagoon catalogue shoot": "Katalog-Shooting Lagoon",
  "Customs on the Lagoon delivery": "Zoll auf der Lagoon-Lieferung",
  "Trade register fee": "Gebühr Handelsregister",
  "Sold leftover packaging": "Restverpackung verkauft",
  "Partner withdrawal, October": "Bezug Partner, Oktober",
  "Scanner and label rolls": "Scanner und Etikettenrollen",
  "Test samples, Aurora": "Testmuster, Aurora",
  "Tissue paper and stickers": "Seidenpapier und Sticker",
  "Last chance campaign ads": "Werbung für die Letzte-Chance-Aktion",
  "Test samples, second round": "Testmuster, zweite Runde",
  "Insurance, half year": "Versicherung, Halbjahr",
  "Aurora production deposit": "Anzahlung Produktion Aurora",
  "Parcel surcharge, peak season": "Paketzuschlag, Hochsaison",
  "Coffee for the stock count": "Kaffee für die Inventur",
  "Mailing boxes, top-up": "Versandkartons, Nachbestellung",
  "Net of fees and refunds.": "Nach Gebühren und Rückerstattungen.",
  // Accounts and the running costs inside booked titles
  Cash: "Bargeld",
  "Old savings": "Altes Sparkonto",
  "App host": "App-Host",
  Database: "Datenbank",
  "File storage": "Dateispeicher",
  "Mail sender": "Mailversand",
  "Inbox assistant": "Inbox-Assistent",
  ...Object.fromEntries(DROP_CHECKLIST.map((row) => [row.en, row.de])),
};

/** Titles the seed and the booking actions build with a month or a number in them. */
const PATTERNS: [RegExp, (...parts: string[]) => string][] = [
  [/^Payout (\S+)$/, (month) => `Auszahlung ${month}`],
  [/^Fee adjustment (\S+)$/, (month) => `Gebührenkorrektur ${month}`],
  [/^Counter postage, small parcels (\d+)$/, (n) => `Schalterporto, kleine Pakete ${n}`],
  [/^(.+) · (\d{4}-\d{2})$/, (label, month) => `${GERMAN[label] ?? label} · ${month}`],
];

/** The German entry when the page is in German, otherwise the text as it is. */
export function seedText(text: string, lang: Lang): string {
  if (lang !== "de") return text;
  const direct = GERMAN[text];
  if (direct) return direct;
  for (const [pattern, word] of PATTERNS) {
    const match = pattern.exec(text);
    if (match) return word(...match.slice(1));
  }
  return text;
}

/** The same rows with the named text fields worded for this language. English hands back the store's own rows. */
export function seedRows<T>(rows: T[], lang: Lang, ...keys: (keyof T)[]): T[] {
  if (lang !== "de") return rows;
  return rows.map((row) => {
    const copy = { ...row };
    for (const key of keys) copy[key] = seedText(String(row[key] ?? ""), lang) as T[keyof T];
    return copy;
  });
}
