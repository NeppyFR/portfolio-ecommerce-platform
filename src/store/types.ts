/**
 * Shared shapes for the in-memory store. Field lists follow what the screens render.
 * Money is integer Rappen unless a field says Minor (minor units of `currency`).
 */

export type Rappen = number;
export type Minor = number;
/** `2027-01-08` */
export type IsoDay = string;
/** `2027-01` */
export type IsoMonth = string;
/** Full ISO timestamp. */
export type IsoTime = string;

export type Lang = "en" | "de";
export type Profile = "owner" | "finance" | "warehouse" | "studio" | "superUser";
/** A person on the team. superUser is a system profile, never an assignee. */
export type Person = Exclude<Profile, "superUser">;
export type Tier = "partner" | "full" | "super";
export type Tone = "ok" | "warn" | "bad" | "unknown" | "off";

export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; code: string; message: string };

export type SwitchableFeature =
  | "drops" | "products" | "inventory" | "orders" | "customers" | "discounts"
  | "analytics" | "marketing" | "inbox"
  | "files" | "calendar" | "tasks" | "finances" | "production";
export type FeatureKey = SwitchableFeature | "settings" | "it" | "superadmin" | "shell";
export type FeatureSwitch = { profile: Person; feature: SwitchableFeature; on: boolean; until: IsoDay | null };
export type AccessChange = { id: string; at: IsoTime; actor: string; profile: Person; feature: SwitchableFeature | null; on: boolean | null; until: IsoDay | null; kind: "set" | "reset" };

export type NodeId = "customers" | "staff" | "mail" | "dns" | "code" | "payments" | "app" | "files" | "database" | "inbox" | "mailbox";

export type ProductArtType = "mug" | "bottle" | "lamp" | "notebook" | "candle" | "planter" | "speaker" | "pouch";
export type ArtTone = "ice" | "sky" | "azure" | "dusk" | "lilac";
export type ArtView = "full" | "crop-detail" | "crop-top" | "mini";

/* Catalogue */
export type SizeCode = "S" | "M" | "L" | "XL" | "ONE_SIZE";
export type ProductStatus = "active" | "draft" | "archived";
export type ProductCategory = "drinkware" | "lighting" | "audio" | "plants" | "desk" | "travel" | "other";
export type Variant = { id: string; productId: string; size: SizeCode; color: string; sku: string; priceOverrideRappen: Rappen | null; threshold: number | null; isActive: boolean; stock: number; reserved: number; ordered: number; updatedAt: IsoTime };
export type Product = { id: string; slug: string; nameEn: string; nameDe: string; descriptionEn: string; descriptionDe: string; status: ProductStatus; category: ProductCategory; priceRappen: Rappen; costRappen: Rappen | null; art: ProductArtType; tone: ArtTone; printedName: boolean; collectionIds: string[]; tagIds: string[]; variants: Variant[]; createdAt: IsoTime; updatedAt: IsoTime; publishedAt: IsoTime | null };
export type Collection = { id: string; slug: string; nameEn: string; nameDe: string; descriptionEn: string; descriptionDe: string; isActive: boolean; updatedAt: IsoTime };
export type ProductTag = { id: string; label: string };

/* Customers and orders */
export type Address = { id?: string; fullName: string; line1: string; line2?: string; postalCode: string; city: string; countryCode: string; phone?: string; isDefault?: boolean };
export type Note = { id: string; body: string; author: string; createdAt: IsoTime };
export type Customer = { id: string; fullName: string; email: string; phone: string; locale: Lang; createdAt: IsoTime; erased: boolean; erasedAt: IsoTime | null; addresses: Address[]; notes: Note[]; waitlist: { dropName: string; size: string | null; notified: boolean }[] };

export type OrderStatus = "pending" | "paid" | "packed" | "shipped" | "delivered" | "cancelled" | "refunded";
export type OrderStop = OrderStatus | "attention";
export type AttentionReason = "stock_conflict" | "amount_mismatch" | "code_over_limit";
export type OrderItem = { id: string; productId: string; variantId: string; name: string; nameDe: string; color: string; size: SizeCode; sku: string; art: ProductArtType; tone: ArtTone; quantity: number; unitPriceRappen: Rappen; lineTotalRappen: Rappen; discountRappen: Rappen; restocked: number; shortfall: number };
export type OrderEventType =
  | "placed" | "paid" | "packed" | "unpacked" | "shipped" | "tracking_updated" | "delivered" | "cancelled"
  | "refund_recorded" | "restocked" | "stock_conflict" | "needs_attention" | "attention_resolved" | "note_added" | "email_queued"
  | "return_opened" | "return_received" | "return_refunded" | "return_closed";
export type OrderEvent = { id: string; type: OrderEventType; label: string; createdAt: IsoTime; actor: string; detail?: string; count?: number; service?: NodeId };
export type OrderRefund = { id: string; reason: string; actor: string; createdAt: IsoTime; amountRappen: Rappen; returnNo: string | null };
export type Order = {
  id: string; orderNumber: string; placedAt: IsoTime; customerId: string; customerName: string; email: string; status: OrderStatus; locale: Lang;
  subtotalRappen: Rappen; discountRappen: Rappen; discountCode: string | null; shippingRappen: Rappen; totalRappen: Rappen; refundedRappen: Rappen;
  needsAttention: boolean; attentionReasons: AttentionReason[]; attentionResolvedAt: IsoTime | null; stockConflict: boolean; customerErased: boolean;
  shippingAddress: Address; paidAt: IsoTime | null; paymentMethod: "card" | "twint" | null; packedAt: IsoTime | null; shippedAt: IsoTime | null; deliveredAt: IsoTime | null; cancelledAt: IsoTime | null; cancelReason: string | null;
  trackingNumber: string | null; trackingCarrier: string | null; checkoutSessionId: string | null;
  items: OrderItem[]; events: OrderEvent[]; notes: Note[]; refunds: OrderRefund[];
};
export type ReturnStatus = "requested" | "received" | "refunded" | "closed";
export type ReturnReason = "size" | "quality" | "damaged" | "wrong_item" | "changed_mind" | "other";
export type ReturnRecord = { id: string; returnNo: string; orderNumber: string; customerName: string; label: string; status: ReturnStatus; reason: ReturnReason; note: string; closeNote: string; openedBy: string; createdAt: IsoTime; closedAt: IsoTime | null; refundRappen: Rappen; items: { orderItemId: string; quantity: number; restockQuantity: number }[] };
export type StockMoveReason = "initial" | "sold" | "back_from_cancellation" | "back_from_refund" | "delivery" | "sample_back" | "damaged" | "sample_out" | "count_correction" | "manual";
export type StockMove = { id: string; createdAt: IsoTime; variantId: string; delta: number; before: number; after: number; reason: StockMoveReason; note: string; actor: string; productName: string; size: SizeCode; orderNumber: string | null };

/* Commerce extras */
export type DiscountType = "percent" | "fixed" | "free_shipping";
export type DiscountScope = "all" | "products" | "collections";
export type DiscountState = "active" | "scheduled" | "expired" | "used_up" | "disabled";
export type DiscountRejection = "not_found" | "disabled" | "scheduled" | "expired" | "used_up" | "min_order" | "not_applicable";
export type Discount = { id: string; code: string; type: DiscountType; value: number; scope: DiscountScope; productIds: string[]; collectionIds: string[]; minOrderRappen: Rappen; usageLimit: number | null; startDay: IsoDay | null; endDay: IsoDay | null; isEnabled: boolean; description: string; reason: string; timesUsed: number; redeemedRappen: Rappen; lastUsedAt: IsoTime | null; updatedAt: IsoTime };
export type DropStatus = "planned" | "live" | "archived";
export type WaitlistEntry = { id: string; email: string; name: string; productId: string | null; size: SizeCode | null; notifiedAt: IsoTime | null };
export type Drop = { id: string; name: string; season: string; status: DropStatus; launchOn: IsoDay | null; launchAt: IsoTime | null; description: string; productIds: string[]; waitlist: WaitlistEntry[]; updatedAt: IsoTime };
export type Supplier = { id: string; name: string; contactName: string; email: string; phone: string; country: string; notes: string; isActive: boolean };
export type PurchaseOrderStatus = "draft" | "ordered" | "in_production" | "shipped" | "received" | "cancelled";
export type PurchaseOrderLine = { id: string; variantId: string; productName: string; size: SizeCode; sku: string; quantity: number; unitCostMinor: Minor; receivedQuantity: number };
export type PurchaseOrder = { id: string; number: string; kind: "production" | "sample"; status: PurchaseOrderStatus; currency: string; supplierId: string; dropId: string | null; orderedOn: IsoDay | null; expectedOn: IsoDay | null; receivedAt: IsoTime | null; notes: string; financeEntryId: string | null; shippingMinor: Minor; lines: PurchaseOrderLine[] };
export type CampaignStatus = "draft" | "scheduled" | "completed";
export type CampaignChannel = "instagram" | "tiktok" | "newsletter" | "website" | "in_person" | "other";
export type Campaign = { id: string; name: string; channel: CampaignChannel; status: CampaignStatus; startsOn: IsoDay | null; endsOn: IsoDay | null; productIds: string[]; discountId: string | null; owner: Person | null; notes: string; updatedAt: IsoTime };

/* Work */
export type TaskPriority = "high" | "normal" | "low";
export type TaskList = { id: string; name: string; dropId: string | null; position: number; isDropDay: boolean };
export type Task = { id: string; listId: string; title: string; notes: string; assignees: Person[]; priority: TaskPriority; dropId: string | null; dueOn: IsoDay | null; doneAt: IsoTime | null; doneBy: Person | null; position: number; createdAt: IsoTime };
export type CalendarEventType = "drop" | "sample" | "shoot" | "meeting" | "legal" | "campaign" | "other";
export type CalendarEvent = { id: string; title: string; type: CalendarEventType; startsAt: IsoTime; endsAt: IsoTime | null; allDay: boolean; attendees: Person[]; notes: string };
export type FileCategory = "logo" | "draft" | "prototype" | "final" | "other";
export type FileKind = "image" | "pdf" | "design" | "archive" | "video";
export type FileVersion = { id: string; version: number; by: Person; at: IsoTime; bytes: number };
export type FileRecord = { id: string; title: string; ext: string; mime: string; kind: FileKind; category: FileCategory; dropId: string | null; tags: string[]; notes: string; width: number | null; height: number | null; versions: FileVersion[]; updatedAt: IsoTime; trashedAt: IsoTime | null; trashedBy: Person | null };
export type InboxCategory = "manufacturer" | "customer_support" | "important_other" | "low_priority";
export type InboxPriority = "P1" | "P2" | "P3";
export type InboxNextAction = "reply" | "check_order" | "pay_or_check_invoice" | "confirm_sample" | "forward" | "file" | "nothing";
export type InboxAuthResult = "pass" | "fail" | null;
export type InboxMail = {
  id: string; key: string; fromEmail: string; fromName: string; to: string; subject: string; body: string; receivedAt: IsoTime;
  status: "unsorted" | "sorted" | "done"; category: InboxCategory | null; priority: InboxPriority | null; nextAction: InboxNextAction | null; nextActionNote: string; summary: string; language: "de" | "en" | "fr" | "it" | "other";
  confidence: number | null; needsReview: boolean; suspectedInjection: boolean; spf: InboxAuthResult; dkim: InboxAuthResult; dmarc: InboxAuthResult;
  classifiedBy: string; classifiedAt: IsoTime | null; locked: boolean; attempts: number; lastError: string | null; assignee: Person | null; doneAt: IsoTime | null; doneBy: Person | null; attachments: { name: string; sizeBytes: number }[];
};
export type InboxIngest = { lastRunAt: IsoTime; source: string; inserted: number; duplicates: number; classified: number; rejected: number; mailboxes: number };

/* Finance */
export type Account = { id: string; name: string; kind: "bank" | "stripe" | "cash"; openingRappen: Rappen; openingOn: IsoDay; isActive: boolean; updatedAt: IsoTime };
export type CategoryKind = "income" | "expense" | "transfer";
export type ReportGroup = "production" | "shipping" | "administration" | "equipment" | "other";
export type LedgerCategory = { id: string; slug: string; nameEn: string; nameDe: string; kind: CategoryKind; group: ReportGroup | null; isActive: boolean };
export type EntrySource = "manual" | "recurring" | "production" | "payout";
export type Receipt = { id: string; name: string; sizeBytes: number };
export type LedgerEntry = { id: string; amountRappen: Rappen; title: string; occurredOn: IsoDay; description: string; counterparty: string; categoryId: string | null; accountId: string | null; dropId: string | null; originalAmountMinor: Minor | null; originalCurrency: string | null; vatRateBp: number | null; vatRappen: Rappen | null; source: EntrySource; externalRef: string | null; receipts: Receipt[]; createdBy: Person; createdAt: IsoTime; updatedAt: IsoTime };
export type CostService = "supabase" | "vercel" | "r2" | "resend" | "cloudflare" | "github" | "domain" | "claude" | "mailbox" | "other";
export type CostState = "active" | "planned" | "off";
export type Cost = { id: string; label: string; vendor: string; service: CostService; billing: "monthly" | "yearly"; expectedMinor: Minor; currency: string; startsOn: IsoDay | null; endsOn: IsoDay | null; categoryId: string | null; accountId: string | null; note: string; state: CostState; isEstimate: boolean; planId: string | null; usage: Record<string, number>; updatedAt: IsoTime };
export type CostBooking = { id: string; costId: string; month: IsoMonth; amountRappen: Rappen; originalMinor: Minor | null; currency: string; occurredOn: IsoDay; entryId: string | null };
export type PlanMeter = { key: string; labelEn: string; labelDe: string; unit: string; included: number; per: number; priceMicro: number | null; hardLimit: boolean; main: boolean; stops: number[]; defaultValue: number };
export type PricePlan = { id: string; key: string; service: CostService; label: string; sort: number; currency: string; baseMinor: Minor; seatMinor: Minor | null; creditMinor: Minor; meters: PlanMeter[]; note: string; source: string; asOf: IsoDay; isActive: boolean };
export type FxRate = { currency: string; chfPpm: number; asOf: IsoDay | null; source: string; note: string };
export type StockCountLine = { id: string; variantId: string | null; productName: string; size: SizeCode; color: string; sku: string; systemQty: number; counted: number | null; toShip: number; stockAtCount: number | null; productCostRappen: Rappen | null; typedCostRappen: Rappen | null; sizeDeleted: boolean };
export type StockCount = { id: string; year: number; status: "draft" | "confirmed"; startedOn: IsoDay; startedBy: Person; confirmedAt: IsoTime | null; confirmedBy: Person | null; lines: StockCountLine[] };

/* System */
export type StripeEventStatus = "processed" | "duplicate" | "failed" | "pending";
export type StripeEvent = { id: string; type: string; status: StripeEventStatus; createdAt: IsoTime; orderNumber: string | null; sessionId: string | null; mode: "test"; env: "production"; detail: string };
export type Hold = { id: string; ref: string; sessionId: string; status: "open" | "processing"; createdAt: IsoTime; expiresAt: IsoTime; overdue: boolean; units: number; totalRappen: Rappen; lines: { variantId: string; quantity: number }[] };
export type HoldRelease = { id: string; ref: string; releasedAt: IsoTime; expiredAt: IsoTime; reason: "expired" | "cancelled" | "failed"; units: number; totalRappen: Rappen };
export type EmailStatus = "queued" | "rendered" | "failed" | "skipped";
export type EmailTemplate = "order_confirmation" | "shipping_notification";
export type OutboxEmail = { id: string; template: EmailTemplate; to: string; subject: string; status: EmailStatus; orderNumber: string | null; locale: Lang; createdAt: IsoTime; renderedAt: IsoTime | null; error: string | null; provider: "dev"; attempts: number };
export type ActivityRow = { id: string; at: IsoTime; actor: string; area: string; action: string; detail: string };
export type CheckStatus = "pass" | "warn" | "fail" | "skip";
export type HealthCheck = { id: string; status: CheckStatus; code: string; reason: string; ms: number };
export type HealthRun = { id: string; startedAt: IsoTime; finishedAt: IsoTime | null; source: "watchdog" | "admin" | "ci"; target: string | null; overall: Exclude<CheckStatus, "skip">; checks: HealthCheck[] };
export type DbTable = { name: string; rows: number; sizeBytes: number };
export type Migration = { id: string; name: string; appliedOn: IsoDay; state: "applied" | "pending" | "extra" };
export type DbFacts = { sizeBytes: number; connectionsUsed: number; connectionsMax: number; demoLoaded: boolean };
export type StorageBucket = { name: string; isPublic: boolean; objects: number; sizeBytes: number };
export type ConfigKind = "secret" | "public" | "setting";
export type ConfigNeed = "required" | "optional" | "recommended" | "later";
export type ConfigStatus = "present" | "missing";
export type ConfigVar = { name: string; kind: ConfigKind; need: ConfigNeed; phase: string; status: ConfigStatus; rotatedOn: IsoDay | null };
export type DeployState = "ready" | "building" | "queued" | "error" | "blocked" | "canceled";
export type Deploy = { id: string; commit: string; branch: string; title: string; at: IsoTime; state: DeployState; target: "production" | "preview"; durationSec: number };
export type CiConclusion = "success" | "failure" | "running" | "cancelled" | "skipped";
export type CiRun = { id: string; commit: string; branch: string; workflow: string; at: IsoTime; conclusion: CiConclusion; durationSec: number };
export type PullRequestRow = { id: string; title: string; branch: string; state: "open" | "merged"; checks: "passing" | "failing" | "pending"; at: IsoTime };
export type SignInOutcome = "success" | "failure" | "pending";
export type SignInAttempt = { id: string; at: IsoTime; profile: Profile | null; outcome: SignInOutcome; addressHash: string };
export type StaffSession = { id: string; profile: Profile | null; startedAt: IsoTime; lastSeenAt: IsoTime; expiresAt: IsoTime; device: string; isThisBrowser: boolean };
export type NotificationKind = "attention" | "tasks" | "orders" | "return_opened" | "refund_paid" | "inbox" | "low_stock" | "watchdog" | "lockout" | "profile_password" | "demo";
export type Notification = { id: string; at: IsoTime; kind: NotificationKind; title: string; href: string; readAt: IsoTime | null };
export type StaffMember = { profile: Person; name: string; initials: string; roleEn: string; roleDe: string; isActive: boolean; lastSignInAt: IsoTime | null };

export type BagLine = { variantId: string; quantity: number };
export type Bag = { lines: BagLine[]; code: string | null };

export type Settings = {
  shopName: string; legalName: string; address: string; email: string; phone: string;
  lowStockDefault: number; shippingRappen: Rappen; freeShippingThresholdRappen: Rappen; holdMinutes: number; trackingLink: string;
  vatEnabled: boolean; notifyNewOrder: boolean; notifyLowStock: boolean; notifyInboxHigh: boolean; notifyWatchdogFail: boolean;
  inboxRetentionDays: number; updatedAt: IsoTime; updatedBy: string;
};

export type State = {
  profile: Profile;
  featureSwitches: FeatureSwitch[];
  accessHistory: AccessChange[];
  settings: Settings;
  team: StaffMember[];
  products: Product[];
  collections: Collection[];
  tags: ProductTag[];
  customers: Customer[];
  orders: Order[];
  returns: ReturnRecord[];
  movements: StockMove[];
  discounts: Discount[];
  drops: Drop[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  campaigns: Campaign[];
  taskLists: TaskList[];
  tasks: Task[];
  calendarEvents: CalendarEvent[];
  files: FileRecord[];
  inbox: InboxMail[];
  inboxIngest: InboxIngest;
  accounts: Account[];
  categories: LedgerCategory[];
  ledger: LedgerEntry[];
  costs: Cost[];
  costBookings: CostBooking[];
  pricePlans: PricePlan[];
  fxRates: FxRate[];
  stockCounts: StockCount[];
  stripeEvents: StripeEvent[];
  holds: Hold[];
  releases: HoldRelease[];
  outbox: OutboxEmail[];
  activity: ActivityRow[];
  healthRuns: HealthRun[];
  dbTables: DbTable[];
  dbFacts: DbFacts;
  buckets: StorageBucket[];
  migrations: Migration[];
  configVars: ConfigVar[];
  deploys: Deploy[];
  ciRuns: CiRun[];
  pullRequests: PullRequestRow[];
  signIns: SignInAttempt[];
  sessions: StaffSession[];
  notifications: Notification[];
  bag: Bag;
};

/* Checkout */
export type CheckoutDetails = { fullName: string; email: string; phone: string; line1: string; line2?: string; postalCode: string; city: string; countryCode: string };
export type CheckoutOutcome = "paid" | "declined" | "walked_away" | "timed_out" | "paid_after_hold";
export type CheckoutResultState = "completed" | "pending" | "cancelled" | "expired" | "failed" | "unknown";
