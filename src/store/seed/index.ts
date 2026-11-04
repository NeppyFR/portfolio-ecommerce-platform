import { LABEL, PHONE, STREETS, SUPPORT_EMAIL, SHOP_DOMAIN } from "@/lib/brand";
import type { Settings, State } from "../types";
import { createCollections, createProducts, createTags } from "./catalog";
import { createCampaigns, createDiscounts, createDrops, createPurchaseOrders, createSuppliers } from "./commerce";
import { buildLedger, createAccounts, createCategories, createCosts, createFxRates, createPricePlans, createStockCounts } from "./finance";
import { buildOrders } from "./orders";
import { createCustomers, createTeam } from "./people";
import { createRng, zurich } from "./rng";
import { createAccessHistory, createActivity, createBuckets, createCiRuns, createConfigVars, createDbFacts, createDbTables, createDeploys, createHealthRuns, createMigrations, createNotifications, createOutbox, createPullRequests, createSessions, createSignIns, createStripeEvents } from "./system";
import { createCalendarEvents, createFiles, createInbox, createInboxIngest, createTaskLists, createTasks } from "./work";

function createSettings(): Settings {
  return {
    shopName: LABEL.name,
    legalName: `${LABEL.name} Studio`,
    address: `${STREETS[0]}\n9999 Musterstadt`,
    email: SUPPORT_EMAIL,
    phone: PHONE,
    lowStockDefault: 3,
    shippingRappen: 700,
    freeShippingThresholdRappen: 15000,
    holdMinutes: 30,
    trackingLink: `https://${SHOP_DOMAIN}/track/{tracking}`,
    vatEnabled: false,
    notifyNewOrder: true,
    notifyLowStock: true,
    notifyInboxHigh: true,
    notifyWatchdogFail: true,
    inboxRetentionDays: 90,
    updatedAt: zurich("2026-12-15", 11, 20),
    updatedBy: "Mara Keller",
  };
}

/** The whole demo, rebuilt from one seed in one fixed order, with no wall clock and no other random source. */
export function createSeed(): State {
  const rng = createRng();
  const settings = createSettings();
  const tags = createTags();
  const collections = createCollections();
  const products = createProducts();
  const customers = createCustomers(rng);
  const discounts = createDiscounts();
  const drops = createDrops(rng);
  const suppliers = createSuppliers();
  const purchaseOrders = createPurchaseOrders(products);
  const campaigns = createCampaigns(discounts);
  const { orders, returns, movements, holds, releases } = buildOrders(rng, products, customers, discounts, settings);

  const lagoon = drops.find((d) => d.id === "drop_lagoon");
  if (lagoon) {
    [customers[5], customers[9]].forEach((customer, i) => {
      const entry = lagoon.waitlist[i];
      entry.email = customer.email;
      entry.name = customer.fullName;
      customer.waitlist.push({ dropName: lagoon.name, size: entry.size, notified: entry.notifiedAt !== null });
    });
  }

  const { entries, bookings } = buildLedger(rng, orders);
  const stockCounts = createStockCounts(products, movements, orders);
  const deploys = createDeploys(rng);

  return {
    profile: "owner",
    featureSwitches: [{ profile: "warehouse", feature: "customers", on: true, until: "2027-01-09" }],
    accessHistory: createAccessHistory(),
    settings,
    team: createTeam(),
    products,
    collections,
    tags,
    customers,
    orders,
    returns,
    movements,
    discounts,
    drops,
    suppliers,
    purchaseOrders,
    campaigns,
    taskLists: createTaskLists(),
    tasks: createTasks(),
    calendarEvents: createCalendarEvents(),
    files: createFiles(rng),
    inbox: createInbox(),
    inboxIngest: createInboxIngest(),
    accounts: createAccounts(),
    categories: createCategories(),
    ledger: entries,
    costs: createCosts(),
    costBookings: bookings,
    pricePlans: createPricePlans(),
    fxRates: createFxRates(),
    stockCounts,
    stripeEvents: createStripeEvents(orders),
    holds,
    releases,
    outbox: createOutbox(orders),
    activity: createActivity(rng, orders),
    healthRuns: createHealthRuns(rng),
    dbTables: createDbTables(rng),
    dbFacts: createDbFacts(),
    buckets: createBuckets(),
    migrations: createMigrations(),
    configVars: createConfigVars(),
    deploys,
    ciRuns: createCiRuns(rng, deploys),
    pullRequests: createPullRequests(rng),
    signIns: createSignIns(rng),
    sessions: createSessions(),
    notifications: createNotifications(),
    bag: { lines: [], code: null },
  };
}
