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
  "Approve the Aurora hood lining": "Kapuzenfutter für Aurora freigeben",
  "Second sample came back too stiff.": "Das zweite Muster kam zu steif zurück.",
  "Reply to the printer about tote ink": "Der Druckerei wegen der Tote-Farbe antworten",
  "Write the Aurora product texts": "Produkttexte für Aurora schreiben",
  "Book the shoot location": "Location für das Shooting buchen",
  "Pick the Aurora swing tag colour": "Farbe des Aurora-Hangtags wählen",
  "Send fit notes to the knit studio": "Passform-Notizen ans Strickstudio schicken",
  "Collect fabric swatches for Cirrus": "Stoffmuster für Cirrus sammeln",
  "Update the size chart": "Grössentabelle aktualisieren",
  "Archive the old lookbook drafts": "Alte Lookbook-Entwürfe archivieren",
  "Pack the morning orders": "Bestellungen vom Morgen packen",
  "Count the zip hoodies again": "Zip-Hoodies nochmals zählen",
  "System says none left in M, the shelf says one.": "Das System meldet in M keinen mehr, im Regal liegt einer.",
  "Order more mailing boxes": "Mehr Versandkartons bestellen",
  "Receive the second zip hoodie run": "Zweite Zip-Hoodie-Serie entgegennehmen",
  "Check the returned parcels": "Retourpakete prüfen",
  "Label the new shelf row": "Neue Regalreihe beschriften",
  "Clear the sample rail": "Musterstange räumen",
  "Set low-stock thresholds for hoodies": "Mindestbestände für Hoodies festlegen",
  "Book the December payout": "Auszahlung vom Dezember verbuchen",
  "Book this month's running costs": "Laufende Kosten dieses Monats verbuchen",
  "Finish the 2026 stock count": "Inventur 2026 abschliessen",
  "Close the quarterly report": "Quartalsbericht abschliessen",
  "Link the tee restock to its invoice": "T-Shirt-Nachschub mit der Rechnung verknüpfen",
  "Check the planning rates": "Planungskurse prüfen",
  "File the November receipts": "Belege vom November ablegen",
  "Sketch three lightweight layers": "Drei leichte Layer skizzieren",
  "Ask two mills for summer weights": "Zwei Webereien nach Sommerqualitäten fragen",
  "Decide on a launch window": "Zeitfenster für den Start festlegen",
  "Note what sold out first in Lagoon": "Notieren, was bei Lagoon zuerst ausverkauft war",
  // Calendar
  "Aurora fit review": "Passform-Review Aurora",
  "Second hood sample due": "Zweites Kapuzenmuster fällig",
  "Knit studio promised it by this day.": "Das Strickstudio hat es bis zu diesem Tag versprochen.",
  "Lagoon restock sample check": "Musterprüfung Lagoon-Nachschub",
  "Cirrus first swatches": "Erste Stoffmuster für Cirrus",
  "Aurora lookbook shoot": "Lookbook-Shooting Aurora",
  "Plain cloud backdrop, two models.": "Schlichter heller Hintergrund, zwei Models.",
  "Product stills, Aurora": "Produktfotos, Aurora",
  "Lagoon restock stills": "Produktfotos Lagoon-Nachschub",
  "Monday stand-up": "Stand-up am Montag",
  "Quarter review with the numbers": "Quartalsrückblick mit den Zahlen",
  "Packing routine walk-through": "Packablauf durchgehen",
  "Supplier call, Tessuti Lago": "Lieferantengespräch, Tessuti Lago",
  "Quarterly filing deadline": "Frist für die Quartalsabrechnung",
  "Everything for the tax authority ready by then.": "Bis dann alles für die Steuerbehörde bereit haben.",
  "Insurance renewal": "Versicherung erneuern",
  "Data request answered by": "Datenauskunft beantworten bis",
  "Aurora teaser posts start": "Aurora-Teaser-Posts starten",
  "Aurora launch mail goes out": "Start-Mail für Aurora geht raus",
  "Lagoon restock banner": "Banner für den Lagoon-Nachschub",
  "End of summer sale recap": "Rückblick auf den Sommerschlussverkauf",
  "Parcel pick-up moved to morning": "Paketabholung auf den Morgen verschoben",
  "Stock count on the shelf": "Inventur am Regal",
  "Bring the scanner and the printout.": "Scanner und Ausdruck mitbringen.",
  "Studio closed": "Studio geschlossen",
  "Lagoon second run back in the shop": "Zweite Lagoon-Serie wieder im Shop",
  // Ledger
  "Studio lead's starting deposit": "Starteinlage der Studioleitung",
  "Sample run, first knit tests": "Musterlauf, erste Stricktests",
  "Label and swing tag design": "Design von Etikett und Hangtag",
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
  "Lagoon lookbook shoot": "Lookbook-Shooting Lagoon",
  "Customs on the Lagoon delivery": "Zoll auf der Lagoon-Lieferung",
  "Trade register fee": "Gebühr Handelsregister",
  "Sold leftover fabric": "Reststoff verkauft",
  "Partner withdrawal, October": "Bezug Partner, Oktober",
  "Scanner and label rolls": "Scanner und Etikettenrollen",
  "Fit samples, Aurora": "Passformmuster, Aurora",
  "Tissue paper and stickers": "Seidenpapier und Sticker",
  "End of summer sale ads": "Werbung für den Sommerschlussverkauf",
  "Fit samples, second round": "Passformmuster, zweite Runde",
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
