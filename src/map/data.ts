import type { NodeId } from "@/store/types";

export type NodeKind = "person" | "hub" | "service";
/** `hero` is the wide drawing on the landing, where the order panel takes the top right. */
export type MapMode = "wide" | "hero" | "phone";
export type Point = [number, number];
export type EdgeId =
  | "cDns" | "pDns" | "dnsV" | "vSb" | "vR2" | "pR2" | "vSt" | "cSt" | "stV"
  | "vRs" | "rsC" | "ghV" | "ghSb" | "ghR2" | "clMb" | "clSb";

export type MapNode = {
  id: NodeId;
  en: string;
  de: string;
  /** Second line of the box: provider and role. */
  second: string;
  secondDe: string;
  provider: string | null;
  roleEn: string;
  roleDe: string;
  kind: NodeKind;
  /** The real dashboard reads this one live; the rest read `off`, as in the source. */
  live: boolean;
  /** Where its screen link goes. Null means no screen. */
  screen: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
  px: number;
  py: number;
};

export type MapEdge = {
  id: EdgeId;
  from: NodeId;
  to: NodeId;
  en: string;
  de: string;
  /** Label broken into lines for the wide map. */
  linesEn: string[];
  linesDe: string[];
  pts: Point[];
  at: Point;
  slow?: boolean;
  dashed?: boolean;
  /** Drawn dotted, with no packet: built and switched off in the real system. */
  state?: "off";
};

export const NODES: MapNode[] = [
  { id: "customers", en: "Customers", de: "Kundschaft", second: "Enter the shop", secondDe: "In den Shop", provider: null, roleEn: "Browse the shop pages and pay on the payment provider's page.", roleDe: "Besucht die Shop-Seiten und zahlt auf der Seite des Zahlungsdienstes.", kind: "person", live: false, screen: "/shop/", x: 134, y: 476, w: 156, h: 60, px: 100, py: 40 },
  { id: "staff", en: "Staff", de: "Team", second: "Choose a profile", secondDe: "Profil wählen", provider: null, roleEn: "Use the admin. The real system asks for a shared hashed password; this demo asks for a profile.", roleDe: "Nutzt den Admin. Das echte System verlangt ein gemeinsames, gehashtes Passwort, diese Demo ein Profil.", kind: "person", live: false, screen: "/desk/enter/", x: 134, y: 668, w: 156, h: 60, px: 290, py: 40 },
  { id: "mail", en: "Mail sender", de: "Mailversand", second: "Resend", secondDe: "Resend", provider: "Resend", roleEn: "Wired for customer emails (EU), not switched on yet.", roleDe: "Für E-Mails an die Kundschaft verdrahtet (EU), noch nicht eingeschaltet.", kind: "service", live: true, screen: "/desk/system/email/", x: 384, y: 392, w: 160, h: 52, px: 66, py: 150 },
  { id: "dns", en: "DNS", de: "DNS", second: "Cloudflare", secondDe: "Cloudflare", provider: "Cloudflare", roleEn: "The domain's address book: shop, dashboard and email records. Planned: the real app still answers on the host's own address.", roleDe: "Das Adressbuch der Domain: Shop-, Dashboard- und E-Mail-Einträge. Geplant: Die echte App antwortet noch unter der Adresse des Hosts.", kind: "service", live: false, screen: null, x: 384, y: 572, w: 160, h: 52, px: 195, py: 150 },
  { id: "code", en: "Code + CI", de: "Code + CI", second: "GitHub", secondDe: "GitHub", provider: "GitHub", roleEn: "Code and CI. The hourly watchdog and nightly backup jobs are written and switched off.", roleDe: "Code und CI. Die Jobs für den stündlichen Watchdog und das nächtliche Backup sind geschrieben und ausgeschaltet.", kind: "service", live: false, screen: "/desk/system/ci/", x: 384, y: 770, w: 160, h: 52, px: 324, py: 150 },
  { id: "payments", en: "Payments", de: "Zahlungen", second: "Stripe, hosted checkout", secondDe: "Stripe, gehosteter Checkout", provider: "Stripe", roleEn: "Hosted checkout, cards and TWINT. Test mode only: live keys are refused at boot.", roleDe: "Gehosteter Checkout, Karten und TWINT. Nur Testmodus: Live-Schlüssel werden beim Start abgelehnt.", kind: "service", live: true, screen: "/desk/system/payments/", x: 830, y: 392, w: 212, h: 52, px: 66, py: 290 },
  { id: "app", en: "App host", de: "App-Host", second: "Vercel, shop, admin, API", secondDe: "Vercel, Shop, Admin, API", provider: "Vercel", roleEn: "Runs the Next.js app: shop, dashboard, API and the admin gate.", roleDe: "Betreibt die Next.js-App: Shop, Dashboard, API und das Admin-Tor.", kind: "hub", live: false, screen: "/desk/system/deploys/", x: 700, y: 572, w: 200, h: 52, px: 195, py: 290 },
  { id: "files", en: "File storage", de: "Dateispeicher", second: "Cloudflare R2", secondDe: "Cloudflare R2", provider: "Cloudflare R2", roleEn: "Team files. Nightly dumps land here once the backup is switched on.", roleDe: "Team-Dateien. Nächtliche Dumps landen hier, sobald das Backup eingeschaltet ist.", kind: "service", live: false, screen: "/desk/files/", x: 700, y: 770, w: 160, h: 52, px: 324, py: 290 },
  { id: "database", en: "Database", de: "Datenbank", second: "Supabase, 64 tables", secondDe: "Supabase, 64 Tabellen", provider: "Supabase", roleEn: "Postgres and the product images (EU). The rules live here.", roleDe: "Postgres und die Produktbilder (EU). Die Regeln leben hier.", kind: "hub", live: true, screen: "/desk/system/health/", x: 1000, y: 572, w: 180, h: 52, px: 195, py: 430 },
  { id: "inbox", en: "Inbox task", de: "Inbox-Aufgabe", second: "Claude, sorts support mail", secondDe: "Claude, sortiert Support-Mail", provider: "Claude", roleEn: "A scheduled task that sorts the support inbox.", roleDe: "Eine geplante Aufgabe, die den Support-Posteingang sortiert.", kind: "service", live: true, screen: "/desk/inbox/", x: 1290, y: 392, w: 224, h: 52, px: 66, py: 430 },
  { id: "mailbox", en: "Mailbox", de: "Postfach", second: "support address", secondDe: "Support-Adresse", provider: null, roleEn: "The support address customers write to.", roleDe: "Die Support-Adresse, an die die Kundschaft schreibt.", kind: "service", live: false, screen: "/desk/system/email/", x: 1290, y: 770, w: 160, h: 52, px: 324, py: 430 },
];

export const EDGES: MapEdge[] = [
  { id: "cDns", from: "customers", to: "dns", en: "shop pages", de: "Shop-Seiten", linesEn: ["shop pages"], linesDe: ["Shop-Seiten"], pts: [[212, 488], [230, 488], [304, 562]], at: [268, 526] },
  { id: "pDns", from: "staff", to: "dns", en: "admin, password", de: "Admin, Passwort", linesEn: ["admin, password"], linesDe: ["Admin, Passwort"], pts: [[212, 658], [230, 658], [304, 584]], at: [266, 621] },
  { id: "dnsV", from: "dns", to: "app", en: "points the domain at the app", de: "leitet die Domain zur App", linesEn: ["points the domain", "at the app"], linesDe: ["leitet die Domain", "zur App"], pts: [[464, 572], [600, 572]], at: [532, 572] },
  { id: "vSb", from: "app", to: "database", en: "secret key, server only", de: "Secret Key, nur auf dem Server", linesEn: ["secret key,", "server only"], linesDe: ["Secret Key,", "nur Server"], pts: [[800, 572], [910, 572]], at: [855, 572] },
  { id: "vR2", from: "app", to: "files", en: "presigned links", de: "vorsignierte Links", linesEn: ["presigned links"], linesDe: ["vorsignierte Links"], pts: [[724, 598], [724, 744]], at: [724, 676] },
  { id: "pR2", from: "staff", to: "files", en: "upload / download with a presigned link", de: "Upload / Download mit vorsigniertem Link", linesEn: ["upload / download", "with a presigned link"], linesDe: ["Upload / Download", "mit vorsigniertem Link"], pts: [[212, 686], [234, 686], [258, 710], [574, 710], [620, 756]], at: [352, 710], dashed: true },
  { id: "vSt", from: "app", to: "payments", en: "creates the checkout session", de: "erstellt die Checkout Session", linesEn: ["creates the", "checkout session"], linesDe: ["erstellt die", "Checkout Session"], pts: [[738, 546], [738, 418]], at: [680, 482] },
  { id: "cSt", from: "customers", to: "payments", en: "pays on the hosted page", de: "zahlt auf der gehosteten Seite", linesEn: ["pays on the hosted page"], linesDe: ["zahlt auf der gehosteten Seite"], pts: [[212, 464], [236, 464], [260, 440], [690, 440], [724, 406]], at: [404, 440] },
  { id: "stV", from: "payments", to: "app", en: "signed webhook", de: "signierter Webhook", linesEn: ["signed", "webhook"], linesDe: ["signierter", "Webhook"], pts: [[786, 418], [786, 546]], at: [790, 482] },
  { id: "vRs", from: "app", to: "mail", en: "send API", de: "Send-API", linesEn: ["send API"], linesDe: ["Send-API"], pts: [[600, 556], [590, 556], [590, 488], [494, 392], [464, 392]], at: [590, 516] },
  { id: "rsC", from: "mail", to: "customers", en: "order and shipping emails", de: "Bestell- und Versand-E-Mails", linesEn: ["order and", "shipping emails"], linesDe: ["Bestell- und", "Versand-E-Mails"], pts: [[304, 392], [172, 392], [142, 422], [142, 446]], at: [234, 392] },
  { id: "ghV", from: "code", to: "app", en: "deploys on push to main", de: "deployt bei jedem Push auf main", linesEn: ["deploys on push to main"], linesDe: ["deployt bei jedem Push auf main"], pts: [[440, 744], [440, 716], [530, 626], [664, 626], [664, 598]], at: [572, 626] },
  { id: "ghSb", from: "code", to: "database", en: "hourly checks (switched off): health + read-only SQL", de: "stündliche Checks (aus): Health + Read-only-SQL", linesEn: ["hourly checks (off):", "health + read-only SQL"], linesDe: ["stündliche Checks (aus):", "Health + Read-only-SQL"], pts: [[464, 790], [486, 812], [800, 812], [970, 642], [970, 598]], at: [878, 734], slow: true, state: "off" },
  { id: "ghR2", from: "code", to: "files", en: "nightly database dump (switched off)", de: "nächtlicher Datenbank-Dump (aus)", linesEn: ["nightly dump (off)"], linesDe: ["nächtlicher", "Dump (aus)"], pts: [[464, 776], [620, 776]], at: [540, 776], slow: true, state: "off" },
  { id: "clMb", from: "inbox", to: "mailbox", en: "reads new mail", de: "liest neue Mails", linesEn: ["reads new mail"], linesDe: ["liest neue Mails"], pts: [[1290, 418], [1290, 744]], at: [1290, 572], slow: true },
  { id: "clSb", from: "inbox", to: "database", en: "sorts into the inbox (RPC)", de: "sortiert in den Posteingang (RPC)", linesEn: ["sorts into the", "inbox (RPC)"], linesDe: ["sortiert in den", "Posteingang (RPC)"], pts: [[1178, 392], [1150, 392], [1060, 482], [1060, 546]], at: [1105, 437], slow: true },
];

/** Offsets that keep the two parallel wires apart on the phone map. */
export const PHONE_SHIFT: Partial<Record<EdgeId, Point>> = { vSt: [0, -9], stV: [0, 9], cSt: [-10, 0], rsC: [10, 0], ghSb: [0, 0] };

export const VIEWBOX: Record<MapMode, string> = { wide: "0 340 1440 500", hero: "0 0 1440 830", phone: "0 0 390 490" };

/** On the landing the inbox task sits under the order panel, so it and its two wires are drawn lower. */
const HERO_NODE_Y: Partial<Record<NodeId, number>> = { inbox: 640 };
const HERO_EDGES: Partial<Record<EdgeId, { pts: Point[]; at: Point }>> = {
  clMb: { pts: [[1290, 666], [1290, 744]], at: [1290, 705] },
  clSb: { pts: [[1178, 640], [1136, 640], [1092, 600]], at: [1104, 652] },
};

/** The landing lays the map over a 1440×900 design space, so its coordinates match the page. */
export const WIDE_FRAME = "0 0 1440 900";

const BY_ID = new Map<NodeId, MapNode>(NODES.map((n) => [n.id, n]));
export function nodeById(id: NodeId): MapNode {
  const node = BY_ID.get(id);
  if (!node) throw new Error(`Unknown node ${id}`);
  return node;
}

export type NodeBox = { x: number; y: number; w: number; h: number };

export function nodeBox(node: MapNode, mode: MapMode): NodeBox {
  if (mode === "wide") return { x: node.x, y: node.y, w: node.w, h: node.h };
  if (mode === "hero") return { x: node.x, y: HERO_NODE_Y[node.id] ?? node.y, w: node.w, h: node.h };
  const person = node.kind === "person";
  return { x: node.px, y: node.py, w: person ? 178 : 118, h: person ? 56 : 46 };
}

export function elbow(a: Point, b: Point): Point[] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  const sx = Math.sign(dx);
  const sy = Math.sign(dy);
  if (ay >= ax) {
    const m = a[1] + (sy * (ay - ax)) / 2;
    return [a, [a[0], m], [b[0], m + sy * ax], b];
  }
  const m = a[0] + (sx * (ax - ay)) / 2;
  return [a, [m, a[1]], [m + sx * ay, b[1]], b];
}

export function rounded(pts: Point[], r = 12): string {
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i - 1];
    const q = pts[i];
    const n = pts[i + 1];
    const l1 = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const l2 = Math.hypot(n[0] - q[0], n[1] - q[1]);
    if (!l1 || !l2) continue;
    const rr = Math.min(r, l1 / 2, l2 / 2);
    const a = [q[0] - ((q[0] - p[0]) / l1) * rr, q[1] - ((q[1] - p[1]) / l1) * rr];
    const b = [q[0] + ((n[0] - q[0]) / l2) * rr, q[1] + ((n[1] - q[1]) / l2) * rr];
    d += ` L${a[0].toFixed(1)} ${a[1].toFixed(1)} Q${q[0]} ${q[1]} ${b[0].toFixed(1)} ${b[1].toFixed(1)}`;
  }
  const e = pts[pts.length - 1];
  return `${d} L${e[0]} ${e[1]}`;
}

/** The wire's path data in either geometry. The packets sample this same path. */
export function edgePath(edge: MapEdge, mode: MapMode): string {
  if (mode === "wide") return rounded(edge.pts);
  if (mode === "hero") return rounded(HERO_EDGES[edge.id]?.pts ?? edge.pts);
  if (edge.id === "pR2") return rounded([[290, 40], [350, 40], [384, 74], [384, 256], [360, 280]], 10);
  /* The inbox and the mailbox sit either side of the database, so this wire runs under it. */
  if (edge.id === "clMb") return rounded([[66, 430], [66, 474], [324, 474], [324, 430]], 10);
  const a = nodeById(edge.from);
  const b = nodeById(edge.to);
  const s = PHONE_SHIFT[edge.id] ?? [0, 0];
  return rounded(elbow([a.px + s[0], a.py + s[1]], [b.px + s[0], b.py + s[1]]), 10);
}

/** Where a wire's label sits on a drawing with labels. */
export function labelAt(edge: MapEdge, mode: MapMode): Point {
  return mode === "hero" ? (HERO_EDGES[edge.id]?.at ?? edge.at) : edge.at;
}

export type StoryHop = { edge: EdgeId; en: string; de: string };

/** The dark packet's route, one log line per hop. */
export const STORY: StoryHop[] = [
  { edge: "cDns", en: "Customer opens the shop", de: "Kundschaft öffnet den Shop" },
  { edge: "dnsV", en: "Domain points at the app", de: "Domain zeigt auf die App" },
  { edge: "vSt", en: "Checkout session created", de: "Checkout Session erstellt" },
  { edge: "cSt", en: "Pays on the hosted page (simulated)", de: "Zahlt auf der gehosteten Seite (simuliert)" },
  { edge: "stV", en: "Signed webhook verified", de: "Signierter Webhook geprüft" },
  { edge: "vSb", en: "Order written, stock reduced", de: "Bestellung geschrieben, Lager reduziert" },
  { edge: "vRs", en: "Confirmation email queued", de: "Bestätigungs-E-Mail eingereiht" },
  { edge: "rsC", en: "Email rendered, not sent", de: "E-Mail gerendert, nicht versendet" },
];

export type Station = { id: "tap" | "payment" | "box" | "parcel" | "books" | "receipt"; en: string; de: string; edges: EdgeId[] };

export const STATIONS: Station[] = [
  { id: "tap", en: "Tap", de: "Tippen", edges: ["cDns", "dnsV"] },
  { id: "payment", en: "Payment", de: "Zahlung", edges: ["vSt", "cSt", "stV"] },
  { id: "box", en: "Box", de: "Paket", edges: ["vSb"] },
  { id: "parcel", en: "Parcel", de: "Versand", edges: ["vRs"] },
  { id: "books", en: "Books", de: "Buch", edges: ["vSb"] },
  { id: "receipt", en: "Receipt", de: "Beleg", edges: ["rsC"] },
];
