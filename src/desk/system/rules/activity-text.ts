import type { Lang } from "@/store/types";

/**
 * Log rows are stored in English, as the action wrote them. In German the known sentences are
 * translated on the way to the screen; a sentence not listed here stays as it was written.
 */
const GERMAN: [RegExp, string][] = [
  [/^Packed (.+)$/, "$1 gepackt"],
  [/^Shipped (.+)$/, "$1 versandt"],
  [/^Booked a ledger entry$/, "Buchung erfasst"],
  [/^Signed in$/, "Angemeldet"],
  [/^Picked the Warehouse profile$/, "Profil Lager gewählt"],
  [/^Edited Aurora: launch time$/, "Aurora bearbeitet: Startzeit"],
  [/^Edited Tall Lamp: description$/, "Hohe Lampe bearbeitet: Beschreibung"],
  [/^Count correction on a Lagoon Speaker variant$/, "Zählkorrektur bei einer Variante des Lagoon-Lautsprechers"],
  [/^Booked a running cost$/, "Laufende Kosten gebucht"],
  [/^Payment received for (.+)$/, "Zahlung für $1 erhalten"],
  [/^Switched (.+) off$/, "$1 ausgeschaltet"],
  [/^(.+): role$/, "$1: Rolle"],
  [/^Rendered a confirmation for (.+)$/, "Bestätigung für $1 gerendert"],
  [/^Parcel received for a return$/, "Paket einer Retoure erhalten"],
  [/^Studio: Inbox on$/, "Studio: Posteingang an"],
  [/^Cleared the login lockout \((\d+) attempts?\)$/, "Login-Sperre aufgehoben ($1 Versuche)"],
  [/^Ran the server checks: (\d+) passed, (\d+) warned, (\d+) failed$/, "Serverchecks ausgeführt: $1 bestanden, $2 mit Warnung, $3 fehlgeschlagen"],
  [/^Rendered (.+) again$/, "$1 erneut gerendert"],
  [/^Inbox retention set to (\d+) days$/, "Aufbewahrung des Posteingangs auf $1 Tage gesetzt"],
  [/^Demo: 5 wrong tries from one address$/, "Demo: 5 falsche Versuche von einer Adresse"],
  [/^Logged everyone out \((\d+) sessions\)$/, "Alle abgemeldet ($1 Sitzungen)"],
  [/^(.+): last change recorded as (.+)$/, "$1: letzte Änderung als $2 erfasst"],
];

export function activityText(detail: string, lang: Lang): string {
  if (lang !== "de") return detail;
  for (const [pattern, german] of GERMAN) {
    if (pattern.test(detail)) return detail.replace(pattern, german);
  }
  return detail;
}
