"use client";

import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState, type ReactNode } from "react";

/*
 * Moving banner for the Commerce Platform card, on a 12 s loop. It shows the two products side by side, an online
 * shop and the staff dashboard behind it, and one order walking from the first to the second: added to the bag, paid,
 * stored, the mail step failing once and passing on the second try, then a new row on the dashboard that staff pack.
 *
 * Only transform and opacity are written, on <g> elements. One rAF driven by a ref, no React state per frame.
 * frame(t, variant) below is pure, so any moment can be rendered or tested on its own.
 */

/* FRAME-START */
export const LOOP_S = 12;
/** From this rendered width the 1200-unit art keeps its 16-unit text at 12 px or more. Narrower gets the compact art. */
export const WIDE_FROM = 900;
/** Reduced motion: new row in, Paid chip, tooltip on, three packing dots filled. */
export const STILL_T = 9.45;
export const FAULT_T = 4.4;
/** Reduced motion: what the button renders. */
export const FAULT_STILL_T = 5;
export const DOT_AT = [9, 9.15, 9.3, 9.45, 9.6];
/** Decoration that always moves. It never counts as something happening. */
export const AMBIENT = ["w.au0", "w.au1", "w.au2", "w.bob", "w.pulse", "c.au0", "c.au1", "c.bob", "c.pulse"];

export type Variant = "wide" | "compact";
export type Part = { o: number; x: number; y: number; s: number; r: number };
export type Frame = Record<string, Part>;
type Pt = [number, number];
type Route = { pts: Pt[]; cum: number[]; len: number };
type Curve = [Pt, Pt, Pt, Pt];

const TAU = Math.PI * 2;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (a: number, b: number, t: number) => {
  const k = clamp01((t - a) / (b - a));
  return k * k * (3 - 2 * k);
};
const ease = (k: number) => {
  const c = clamp01(k);
  return c < 0.5 ? 2 * c * c : 1 - (-2 * c + 2) ** 2 / 2;
};
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const env = (t: number, a: number, b: number, f: number) => smooth(a, a + f, t) * (1 - smooth(b - f, b, t));
const part = (o = 1, x = 0, y = 0, s = 1, r = 0): Part => ({ o, x, y, s, r });
/** Scale from 0 past 1.25 and back to 1. */
const pop = (t: number, a: number, b: number) => {
  const k = clamp01((t - a) / (b - a));
  return k < 0.6 ? 1.25 * (k / 0.6) : 1.25 - 0.25 * ((k - 0.6) / 0.4);
};
const wash = (t: number, s: number) => smooth(s - 0.05, s + 0.05, t) * (1 - smooth(s + 0.2, s + 0.7, t));
const ring = (t: number, s: number, ms: number, grow: number, peak: number) => {
  if (t < s || t >= s + ms) return { o: 0, s: 1 };
  const p = (t - s) / ms;
  return { o: (1 - p) * peak, s: 1 + grow * p };
};
/** Things that leave at the reset: fully gone by 11.1. */
const leaves = (t: number) => 1 - smooth(10.6, 11.1, t);
/** Things that swap at the reset: out by 11.05, back in at their first place from 11.15. */
const dip = (t: number) => 1 - smooth(10.6, 11.05, t);
const back = (t: number) => smooth(11.15, 11.6, t);

/** Corner points to a dense polyline, with the same rounded corners the wire draws. */
function sample(corners: Pt[], r = 7): Route {
  const pts: Pt[] = [corners[0]];
  for (let i = 1; i < corners.length - 1; i++) {
    const p = corners[i - 1];
    const q = corners[i];
    const n = corners[i + 1];
    const l1 = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const l2 = Math.hypot(n[0] - q[0], n[1] - q[1]);
    const rr = Math.min(r, l1 / 2, l2 / 2);
    const a: Pt = [q[0] - ((q[0] - p[0]) / l1) * rr, q[1] - ((q[1] - p[1]) / l1) * rr];
    const b: Pt = [q[0] + ((n[0] - q[0]) / l2) * rr, q[1] + ((n[1] - q[1]) / l2) * rr];
    for (let s = 0; s <= 6; s++) {
      const u = s / 6;
      pts.push([(1 - u) ** 2 * a[0] + 2 * u * (1 - u) * q[0] + u ** 2 * b[0], (1 - u) ** 2 * a[1] + 2 * u * (1 - u) * q[1] + u ** 2 * b[1]]);
    }
  }
  pts.push(corners[corners.length - 1]);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, cum, len: cum[cum.length - 1] };
}

function at(route: Route, share: number): Pt {
  const d = clamp01(share) * route.len;
  let i = 1;
  while (i < route.cum.length - 1 && route.cum[i] < d) i++;
  const span = route.cum[i] - route.cum[i - 1] || 1;
  const k = (d - route.cum[i - 1]) / span;
  const a = route.pts[i - 1];
  const b = route.pts[i];
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
}

/** The height of a left-to-right cubic at x. */
function curveY(c: Curve, x: number): number {
  let lo = 0;
  let hi = 1;
  const pt = (u: number, i: 0 | 1) => (1 - u) ** 3 * c[0][i] + 3 * u * (1 - u) ** 2 * c[1][i] + 3 * u * u * (1 - u) * c[2][i] + u ** 3 * c[3][i];
  for (let n = 0; n < 18; n++) {
    const m = (lo + hi) / 2;
    if (pt(m, 0) < x) lo = m;
    else hi = m;
  }
  return pt((lo + hi) / 2, 1);
}

/** Width of a word pill. A formula, so a language change needs no measuring. */
export const pillW = (text: string, size: number): number => Math.round(text.length * size * 0.54 + size * 1.06);

export const WORD_BEATS: [string, number, number][] = [
  ["paid", 2.75, 3.4],
  ["stored", 3.65, 4.3],
  ["retry", 4.5, 5.7],
  ["sent", 6, 6.7],
];

function words(out: Frame, prefix: string, x: number, y: number, t: number) {
  for (const [id, a, b] of WORD_BEATS) {
    out[`${prefix}w.${id}`] = part(env(t, a, b, 0.12), x, y, 0.9 + 0.1 * smooth(a, a + 0.14, t));
  }
}

/** One strip per digit. On reset the old digit fades in over the strip, which snaps back underneath at 11.6. */
function rolls(out: Frame, prefix: string, items: [string, number][], lineH: number, t: number) {
  const k = smooth(10.6, 11.6, t);
  const swapping = t >= 10.6 && t < 11.6;
  for (const [id, start] of items) {
    out[`${prefix}${id}`] = part(swapping ? 1 - k : 1, 0, t >= 11.6 ? 0 : -lineH * ease((t - start) / 0.5));
    out[`${prefix}${id}b`] = part(swapping ? k : 0);
  }
}

/** The white cover over the chart's tail, its end dot and that dot's pulse. */
function chart(out: Frame, prefix: string, c: Curve, x0: number, x1: number, t: number) {
  const k = ease((t - 7.4) / 0.7);
  out[`${prefix}cover`] = t < 10.6 ? part(1, (x1 - x0) * k) : part(smooth(10.6, 11.6, t));
  const atStart = t >= 11.1;
  const x = t >= 10.6 ? (atStart ? x0 : x1) : lerp(x0, x1, k);
  const y = curveY(c, x);
  const on = t < 10.6 ? 1 : atStart ? smooth(11.2, 11.6, t) : 1 - smooth(10.6, 11, t);
  out[`${prefix}dot`] = part(on, x, y);
  const p = (t % 2) / 2;
  out[`${prefix}pulse`] = part(on * 0.55 * Math.sin(Math.PI * p), x, y, 1 + 1.7 * p);
}

/* The packet rests on each node's icon, so it never covers the name. */
const W_L1 = sample([[342, 73], [427, 73], [427, 112]]);
const W_L2 = sample([[427, 112], [427, 192]]);
const W_L3 = sample([[427, 192], [427, 245]]);
const W_L4 = sample([[427, 245], [427, 340], [484, 340], [700, 330]]);
const W_CURVE: Curve = [[832, 238], [864, 224], [892, 226], [960, 216]];
const C_CURVE: Curve = [[346, 168], [376, 154], [410, 156], [454, 146]];

function widePacket(t: number): Pt {
  if (t < 3) return at(W_L1, ease((t - 2.1) / 0.65));
  if (t < 3.9) return at(W_L2, ease((t - 3) / 0.65));
  if (t < 6.2) return at(W_L3, ease((t - 3.9) / 0.5));
  return at(W_L4, ease((t - 6.2) / 0.7));
}

function wideFrame(t: number): Frame {
  const out: Frame = {};
  const w = (TAU * t) / LOOP_S;
  out["w.au0"] = part(1, 1040 + 36 * Math.cos(w), 430 + 26 * Math.sin(w));
  out["w.au1"] = part(1, 520 + 30 * Math.sin(w), 470 + 20 * Math.cos(w));
  out["w.au2"] = part(1, 170 + 24 * Math.cos(w + 1), 10 + 18 * Math.sin(w + 1));
  out["w.bob"] = part(1, 205, 192 + 3 * Math.sin(2 * w), 2.65);

  // The shopper
  const curK = ease((t - 0.2) / 0.8);
  const click = smooth(0.96, 1, t) * (1 - smooth(1, 1.25, t));
  out["w.cur"] = part(smooth(0.15, 0.35, t) * (1 - smooth(1.35, 1.75, t)), lerp(300, 268, curK), lerp(420, 368, curK), 1 - 0.1 * click);
  out["w.cta"] = part(1, 205, 368, 1 - 0.03 * click);
  const rip = ring(t, 1, 0.55, 1, 0.55);
  out["w.rip"] = part(rip.o, 268, 368, rip.s);
  const mk = ease((t - 1.1) / 0.8);
  out["w.mini"] = part(
    smooth(1.1, 1.2, t) * (1 - smooth(1.82, 1.92, t)),
    (1 - mk) ** 2 * 205 + 2 * mk * (1 - mk) * 300 + mk * mk * 342,
    (1 - mk) ** 2 * 192 + 2 * mk * (1 - mk) * 90 + mk * mk * 73,
    lerp(0.9, 0.3, mk),
  );
  out["w.bag"] = part(1, 342, 73, 1 + 0.18 * env(t, 1.85, 2.2, 0.12));
  out["w.badge"] = part(smooth(1.84, 1.86, t) * leaves(t), 354, 62, pop(t, 1.85, 2.1));

  // The wire
  const unlit = 1 - smooth(10.6, 11.6, t);
  out["w.l0"] = part(smooth(2.1, 2.75, t) * unlit);
  out["w.l1"] = part(smooth(3, 3.65, t) * unlit);
  out["w.l2"] = part(smooth(3.9, 4.4, t) * unlit);
  out["w.l3"] = part(smooth(6.2, 6.65, t) * unlit);
  const pk = widePacket(t);
  out["w.pkt"] = part(smooth(2.05, 2.15, t) * (1 - smooth(6.82, 6.95, t)), pk[0], pk[1]);

  const hits: [string, Pt, number][] = [
    ["pay", [427, 125], 2.75],
    ["db", [427, 205], 3.65],
    ["mail", [427, 285], 5.95],
  ];
  for (const [id, pos, s] of hits) {
    const r = ring(t, s, 0.6, 0.2, 0.9);
    out[`w.r.${id}`] = part(r.o, pos[0], pos[1], r.s);
    out[`w.h.${id}`] = part(wash(t, s));
  }

  // The fault
  out["w.mail"] = part(1 - 0.45 * env(t, 4.4, 5.95, 0.2));
  const shake = t >= 4.55 && t < 4.85 ? 2.5 * Math.sin((TAU * (t - 4.55)) / 0.1) * (1 - (t - 4.55) / 0.3) : 0;
  out["w.tri"] = part(smooth(4.4, 4.58, t) * (1 - smooth(5.7, 5.95, t)), 478 + shake, 262, lerp(0.4, 1, ease((t - 4.4) / 0.2)));
  const hp = t >= 4.5 && t < 5.9 ? ((t - 4.5) % 0.7) / 0.7 : 0;
  out["w.halo"] = part(t >= 4.5 && t < 5.9 ? (1 - hp) * 0.8 : 0, 427, 245, 1 + 1.1 * hp);
  words(out, "w.", 427, 78, t);

  // The dashboard: the new row
  const shift = ease((t - 6.9) / 0.4);
  const rowsBack = t >= 11.1;
  out["w.o0"] = part(dip(t) + back(t), 0, 330 + (rowsBack ? 0 : 30 * shift));
  out["w.o1"] = part(1 - smooth(6.9, 7.2, t) + back(t), 0, 360 + (rowsBack ? 0 : 30 * shift));
  out["w.new"] = part(smooth(6.9, 7.2, t) * dip(t), 18 * (1 - shift), 330);
  out["w.tint"] = part(t >= 11.1 ? 1 : 1 - 0.75 * clamp01((t - 9.7) / 0.95));
  const chipP = t >= 11.1 ? 0 : smooth(9.8, 10.1, t);
  const chipS = t >= 11.1 ? 0 : smooth(10.2, 10.5, t);
  out["w.c.paid"] = part(1 - chipP, 1080, 0);
  out["w.c.packed"] = part(chipP * (1 - chipS), 1080, 0, 1 + 0.08 * env(t, 9.8, 10.15, 0.12));
  out["w.c.shipped"] = part(chipS, 1080, 0, 1 + 0.08 * env(t, 10.2, 10.55, 0.12));

  // The numbers
  rolls(out, "w.", [["k0.0", 7.2], ["k0.1", 7.3], ["k0.2", 7.4], ["k1.0", 7.3], ["k1.1", 7.4], ["k2.0", 7.4]], 29, t);
  chart(out, "w.", W_CURVE, 900, 960, t);
  const tipIn = smooth(7.7, 7.95, t);
  out["w.tip"] = part(tipIn * (1 - smooth(10.6, 11, t)), 904, 217 + 6 * (1 - tipIn));
  out["w.donut"] = part(1, 1066, 227, 1, 24 * ease((t - 7.4) / 0.7) * (1 - ease((t - 10.6) / 1)));
  out["w.bell"] = part(smooth(7.99, 8.01, t) * leaves(t), 1098, 70, pop(t, 8, 8.2));
  const mailIn = smooth(8, 8.2, t) * (1 - smooth(10.6, 11.6, t));
  out["w.ib"] = part(1, 630, 301, 1 + 0.2 * env(t, 8, 8.35, 0.1));
  out["w.i3"] = part(1 - mailIn);
  out["w.i4"] = part(mailIn);

  // Staff packs it
  const vk = ease((t - 8.2) / 0.7);
  const vClick = smooth(8.86, 8.9, t) * (1 - smooth(8.9, 9.1, t));
  out["w.vcur"] = part(smooth(8.15, 8.35, t) * leaves(t), lerp(1130, 1116, vk), lerp(400, 333, vk), 1 - 0.1 * vClick);
  const vr = ring(t, 8.9, 0.5, 1.2, 0.8);
  out["w.vrip"] = part(vr.o, 1116, 333, vr.s);
  out["w.dt"] = part(smooth(8.9, 9, t) * dip(t));
  DOT_AT.forEach((a, i) => {
    const k = smooth(a, a + 0.14, t);
    out[`w.d${i}`] = part(k * dip(t), 910 + 20 * i, 330, 0.55 + 0.45 * k);
  });
  return out;
}

function compactPacket(t: number): Pt {
  if (t < 3) {
    const k = ease((t - 2.4) / 0.6);
    return k < 0.75 ? [lerp(88, 152, k / 0.75), 243] : [lerp(152, 174, (k - 0.75) / 0.25), lerp(243, 240, (k - 0.75) / 0.25)];
  }
  if (t < 6.2) return [174, 240];
  const k = ease((t - 6.2) / 0.7);
  return [lerp(174, 229, k), lerp(240, 238, k)];
}

function compactFrame(t: number): Frame {
  const out: Frame = {};
  const w = (TAU * t) / LOOP_S;
  out["c.au0"] = part(1, 420 + 22 * Math.cos(w), 310 + 16 * Math.sin(w));
  out["c.au1"] = part(1, 160 + 18 * Math.sin(w), 330 + 12 * Math.cos(w));
  out["c.bob"] = part(1, 88, 116 + 2.5 * Math.sin(2 * w), 1.45);

  const tp = t >= 0.2 && t < 1.25 ? ((t - 0.2) % 0.525) / 0.525 : 0;
  out["c.tap"] = part(t >= 0.2 && t < 1.25 ? (1 - tp) * 0.8 : 0, 88, 243, 0.6 + 1.1 * tp);
  const press = smooth(0.95, 1.05, t) * (1 - smooth(1.05, 1.3, t));
  out["c.cta"] = part(1, 88, 243, 1 - 0.05 * press);
  const mk = ease((t - 1.25) / 1.15);
  out["c.mini"] = part(smooth(1.25, 1.35, t) * (1 - smooth(2.3, 2.4, t)), 88, lerp(116, 243, mk), lerp(0.8, 0.35, mk));

  out["c.lit"] = part(smooth(2.4, 3, t) * (1 - smooth(10.6, 11.6, t)));
  const pk = compactPacket(t);
  out["c.pkt"] = part(smooth(2.35, 2.45, t) * (1 - smooth(6.82, 6.95, t)), pk[0], pk[1]);
  const b1 = ring(t, 2.75, 0.9, 1, 0.8);
  const b2 = ring(t, 3.65, 0.8, 1, 0.8);
  const b3 = ring(t, 5.9, 0.4, 1, 0.8);
  out["c.beat"] = part(Math.max(b1.o, b2.o, b3.o), 174, 240, t < 3.65 ? b1.s : t < 5 ? b2.s : b3.s);

  const shake = t >= 4.55 && t < 4.85 ? 2.5 * Math.sin((TAU * (t - 4.55)) / 0.1) * (1 - (t - 4.55) / 0.3) : 0;
  out["c.tri"] = part(smooth(4.4, 4.58, t) * (1 - smooth(5.7, 5.95, t)), 174 + shake, 205, lerp(0.4, 1, ease((t - 4.4) / 0.2)));
  const hp = t >= 4.5 && t < 5.9 ? ((t - 4.5) % 0.7) / 0.7 : 0;
  out["c.halo"] = part(t >= 4.5 && t < 5.9 ? (1 - hp) * 0.8 : 0, 174, 240, 1 + 1.1 * hp);
  words(out, "c.", 174, 176, t);

  const fresh = smooth(6.9, 7.3, t) * (1 - smooth(10.6, 11.6, t));
  out["c.n0"] = part(1 - fresh);
  out["c.n1"] = part(fresh);
  out["c.tint"] = part(fresh * (1 - 0.6 * clamp01((t - 9.7) / 0.95)));
  const rr = ring(t, 6.9, 0.6, 0.06, 0.9);
  out["c.r.row"] = part(rr.o, 326, 238, rr.s);
  rolls(out, "c.", [["k0.0", 7], ["k0.1", 7.1], ["k0.2", 7.2], ["k1.0", 7.1], ["k1.1", 7.2]], 31, t);
  chart(out, "c.", C_CURVE, 400, 454, t);

  const vp = t >= 8 && t < 9.75 ? ((t - 8) % 0.7) / 0.7 : 0;
  out["c.vtap"] = part(t >= 8 && t < 9.75 ? (1 - vp) * 0.75 : 0, 266, 253, 0.6 + 1.1 * vp);
  const packed = smooth(9.8, 10.1, t) * (1 - smooth(10.6, 11.6, t));
  out["c.s.paid"] = part(1 - packed);
  out["c.s.packed"] = part(packed);
  return out;
}

/** Every moving part at time `t`. Pure, and t = 12 is exactly t = 0. */
export function frame(t: number, variant: Variant): Frame {
  const inLoop = ((t % LOOP_S) + LOOP_S) % LOOP_S;
  return variant === "compact" ? compactFrame(inLoop) : wideFrame(inLoop);
}

export const partTransform = (p: Part): string => `translate(${p.x.toFixed(2)}px,${p.y.toFixed(2)}px) rotate(${p.r.toFixed(2)}deg) scale(${p.s.toFixed(3)})`;
/* FRAME-END */

export type CommercePreviewHandle = { seek: (t: number) => void; play: () => void; pause: () => void; readonly t: number };

export type CommercePreviewLabels = {
  illustration: string;
  fail: string;
  alt: string;
  onlineShop: string;
  shop: string;
  staffSystem: string;
  addToBag: string;
  payments: string;
  database: string;
  mail: string;
  navDashboard: string;
  navProducts: string;
  navOrders: string;
  navCustomers: string;
  navFinances: string;
  navInbox: string;
  navSettings: string;
  totalRevenue: string;
  orders: string;
  customers: string;
  revenue: string;
  recentOrders: string;
  statusPaid: string;
  statusPending: string;
  statusPacked: string;
  statusShipped: string;
  paid: string;
  stored: string;
  retry: string;
  sent: string;
};

export const COMMERCE_PREVIEW_LABELS: Record<"en" | "de", CommercePreviewLabels> = {
  en: {
    illustration: "Simplified illustration",
    fail: "Fail a step",
    alt: "An online shop beside its staff dashboard. Someone adds a hoodie to the bag, the order is paid and stored, the mail step fails once and passes on the second try, and the order lands on the dashboard as a new row, where staff pack and ship it.",
    onlineShop: "Online shop",
    shop: "Shop",
    staffSystem: "Staff system",
    addToBag: "Add to bag",
    payments: "Payments",
    database: "Database",
    mail: "Mail",
    navDashboard: "Dashboard",
    navProducts: "Products",
    navOrders: "Orders",
    navCustomers: "Customers",
    navFinances: "Finances",
    navInbox: "Inbox",
    navSettings: "Settings",
    totalRevenue: "Total Revenue",
    orders: "Orders",
    customers: "Customers",
    revenue: "Revenue",
    recentOrders: "Recent Orders",
    statusPaid: "Paid",
    statusPending: "Pending",
    statusPacked: "Packed",
    statusShipped: "Shipped",
    paid: "paid",
    stored: "stored",
    retry: "retry",
    sent: "rendered",
  },
  de: {
    illustration: "Vereinfachte Darstellung",
    fail: "Fehler auslösen",
    alt: "Ein Onlineshop neben dem Dashboard des Teams. Jemand legt einen Hoodie in den Warenkorb, die Bestellung wird bezahlt und gespeichert, der Mailschritt scheitert einmal und klappt beim zweiten Versuch, und die Bestellung landet als neue Zeile auf dem Dashboard, wo das Team sie packt und versendet.",
    onlineShop: "Onlineshop",
    shop: "Shop",
    staffSystem: "Team-System",
    addToBag: "In den Warenkorb",
    payments: "Zahlung",
    database: "Datenbank",
    mail: "Mail",
    navDashboard: "Dashboard",
    navProducts: "Produkte",
    navOrders: "Bestellungen",
    navCustomers: "Kundschaft",
    navFinances: "Finanzen",
    navInbox: "Posteingang",
    navSettings: "Einstellungen",
    totalRevenue: "Gesamtumsatz",
    orders: "Bestellungen",
    customers: "Kundschaft",
    revenue: "Umsatz",
    recentOrders: "Neueste Bestellungen",
    statusPaid: "Bezahlt",
    statusPending: "Offen",
    statusPacked: "Gepackt",
    statusShipped: "Versendet",
    paid: "bezahlt",
    stored: "gespeichert",
    retry: "nochmals",
    sent: "gerendert",
  },
};

export type CommercePreviewProps = { lang: "en" | "de"; labels?: Partial<CommercePreviewLabels>; className?: string };

type L = CommercePreviewLabels;

const INK = "#0a1f63";
const MUTE = "#51629c";
const HAIR = "#dbe5fb";
const WIRE = "#143bb0";
const SOLID = "#2860ee";
const BLUE = "#2f6bff";
const SKY = "#6fd3ff";
const VIOLET = "#8c7bff";
const ACTIVE = "#e8f0ff";
const AMBER = "#ffb020";
const AMBER_INK = "#7f4600";

/** The art is two drawings. Only this rule picks one, so server HTML is right before any script runs. */
export const CP_CSS =
  ".cp-root{container:cp/inline-size}" +
  ".cp-stage{overflow:hidden;border-radius:16px;background:linear-gradient(135deg,#fff 0%,#b9f3ff 42%,#6fd3ff 100%)}" +
  ".cp-w,.cp-c{width:100%;height:auto;overflow:visible}" +
  ".cp-w{display:block;aspect-ratio:1200/420}" +
  ".cp-c{display:none;aspect-ratio:480/300}" +
  "@container cp (max-width:899.98px){.cp-w{display:none}.cp-c{display:block;max-width:520px;margin:auto}}";

const WIDE_0 = frame(0, "wide");
const COMPACT_0 = frame(0, "compact");
const FIRST: Frame = { ...WIDE_0, ...COMPACT_0 };

/** A moving part: its position and opacity at t = 0 go in the markup, the engine writes the rest. */
function Move({ k, children }: { k: string; children: ReactNode }) {
  const p = FIRST[k];
  return (
    <g data-k={k} style={{ opacity: p.o, transform: partTransform(p) }}>
      {children}
    </g>
  );
}

function Txt({ x, y, size, w = 500, c = INK, a, l, children }: { x?: number; y?: number; size: number; w?: number; c?: string; a?: "middle" | "end"; l?: keyof L; children: ReactNode }) {
  return (
    <text x={x} y={y} fontSize={size} fontWeight={w} fill={c} textAnchor={a} data-l={l}>
      {children}
    </text>
  );
}

const HOODIE_BODY = "M-13-19 L13-19 C20-17 24-14 26-8 L33 17 L24 20 L19 4 L19 27 L-19 27 L-19 4 L-24 20 L-33 17 L-26-8 C-24-14-20-17-13-19Z";
const HOODIE_HOOD = "M-15-16 C-17-33 17-33 15-16 C9-10-9-10-15-16Z";
const HOODIE_OPEN = "M-8-19 C-8-27 8-27 8-19 C4-15-4-15-8-19Z";
const HOODIE_POCKET = "M-11 12 L11 12 L14 24 L-14 24Z";

function Hoodie({ scale, fill, tint = INK, cord = "#fff" }: { scale?: number; fill: string; tint?: string; cord?: string }) {
  return (
    <g transform={scale === undefined ? undefined : `scale(${scale})`}>
      <path d={HOODIE_BODY} fill={fill} />
      <path d={HOODIE_HOOD} fill={fill} />
      <path d={HOODIE_OPEN} fill={tint} opacity={0.42} />
      <path d={HOODIE_POCKET} fill={tint} opacity={0.14} />
      <path d="M-3-14 L-3-5 M3-14 L3-5" stroke={cord} strokeWidth={1.4} strokeLinecap="round" opacity={0.8} fill="none" />
    </g>
  );
}

/** A lucide icon: x and y are its top-left corner, size its rendered width. */
function Icon({ x, y, size, color, children }: { x: number; y: number; size: number; color: string; children: ReactNode }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${size / 24})`} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </g>
  );
}

const I_HOUSE = (
  <>
    <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
    <path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </>
);
const I_PACKAGE = (
  <>
    <path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z" />
    <path d="M12 22V12" />
    <polyline points="3.29 7 12 12 20.71 7" />
    <path d="m7.5 4.27 9 5.15" />
  </>
);
const I_RECEIPT = (
  <>
    <path d="M13 16H8" />
    <path d="M14 8H8" />
    <path d="M16 12H8" />
    <path d="M4 3a1 1 0 0 1 1-1 1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1 1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2 1 1 0 0 1-1-1z" />
  </>
);
const I_USERS = (
  <>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <path d="M16 3.128a4 4 0 0 1 0 7.744" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <circle cx="9" cy="7" r="4" />
  </>
);
const I_WALLET = (
  <>
    <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
    <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
  </>
);
const I_INBOX = (
  <>
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </>
);
const I_SETTINGS = (
  <>
    <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
    <circle cx="12" cy="12" r="3" />
  </>
);
const I_BAG = (
  <>
    <path d="M16 10a4 4 0 0 1-8 0" />
    <path d="M3.103 6.034h17.794" />
    <path d="M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z" />
  </>
);
const I_BELL = (
  <>
    <path d="M10.268 21a2 2 0 0 0 3.464 0" />
    <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
  </>
);
const I_SEARCH = (
  <>
    <path d="m21 21-4.34-4.34" />
    <circle cx="11" cy="11" r="8" />
  </>
);
const I_CARD = (
  <>
    <rect width="20" height="14" x="2" y="5" rx="2" />
    <line x1="2" x2="22" y1="10" y2="10" />
    <path d="M6 14h2" />
  </>
);
const I_DB = (
  <>
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M3 5V19A9 3 0 0 0 21 19V5" />
    <path d="M3 12A9 3 0 0 0 21 12" />
  </>
);
const I_MAIL = (
  <>
    <path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" />
    <rect x="2" y="4" width="20" height="16" rx="2" />
  </>
);

function Triangle({ size }: { size: number }) {
  const h = size * 0.88;
  return (
    <>
      <path d={`M0 ${-h / 2} L${size / 2} ${h / 2} L${-size / 2} ${h / 2}Z`} fill={AMBER} stroke={AMBER_INK} strokeWidth={2} strokeLinejoin="round" />
      <path d={`M0 ${-h * 0.14} L0 ${h * 0.16}`} stroke={AMBER_INK} strokeWidth={3} strokeLinecap="round" />
      <circle cy={h * 0.32} r={1.7} fill={AMBER_INK} />
    </>
  );
}

const CURSOR = "M0 0 L0 22 L6 17 L10 26 L14 24 L10 15 L18 15Z";

function Pills({ prefix, l, size }: { prefix: string; l: L; size: number }) {
  const h = Math.round(size * 1.9);
  return (
    <>
      {(["paid", "stored", "retry", "sent"] as const).map((id) => {
        const w = pillW(l[id], size);
        return (
          <Move key={id} k={`${prefix}w.${id}`}>
            <rect data-pill={id} data-size={size} x={-w / 2} y={-h / 2} width={w} height={h} rx={h / 2} fill={INK} />
            <Txt y={size * 0.35} size={size} w={650} c="#fff" a="middle" l={id}>
              {l[id]}
            </Txt>
          </Move>
        );
      })}
    </>
  );
}

const TONES = {
  paid: ["#e4f6ea", "#15803d"],
  pending: ["#fdf1dc", "#7f4600"],
  packed: ["#ece9ff", "#5b48d6"],
  shipped: ["#e8f0ff", "#2f6bff"],
} as const;

/** A status chip around its own centre. 112 wide because German `Versendet` needs it. */
function Chip({ tone, l, text }: { tone: keyof typeof TONES; l: keyof L; text: string }) {
  return (
    <>
      <rect x={-56} y={-11} width={112} height={22} rx={11} fill={TONES[tone][0]} />
      <circle cx={-44} r={4} fill={TONES[tone][1]} />
      <Txt x={-34} y={6} size={16} w={600} l={l}>
        {text}
      </Txt>
    </>
  );
}

function Row({ u, no, total }: { u: string; no: string; total: string }) {
  return (
    <>
      <rect x={666} y={-12} width={24} height={24} rx={6} fill="#eef3ff" />
      <g transform="translate(678 0)">
        <Hoodie scale={0.28} fill={`url(#${u}gar)`} />
      </g>
      <Txt x={700} y={6} size={16} w={650}>
        {no}
      </Txt>
      <Txt x={800} y={6} size={16}>
        {total}
      </Txt>
    </>
  );
}

function ServiceNode({ y, l, name, icon, k }: { y: number; l: keyof L; name: string; icon: ReactNode; k: string }) {
  return (
    <>
      <rect x={381} y={y} width={92} height={54} rx={14} fill="#fff" stroke={HAIR} />
      <Move k={k}>
        <rect x={381} y={y} width={92} height={54} rx={14} fill="#b9f3ff" />
      </Move>
      <Icon x={418} y={y + 7} size={18} color={SOLID}>
        {icon}
      </Icon>
      <Txt x={427} y={y + 45} size={16} w={600} a="middle" l={l}>
        {name}
      </Txt>
    </>
  );
}

function Defs({ u }: { u: string }) {
  return (
    <>
      <radialGradient id={`${u}a1`}>
        <stop offset="0" stopColor={VIOLET} stopOpacity=".75" />
        <stop offset="1" stopColor={VIOLET} stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${u}a2`}>
        <stop offset="0" stopColor={BLUE} stopOpacity=".6" />
        <stop offset="1" stopColor={BLUE} stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${u}a3`}>
        <stop offset="0" stopColor="#fff" stopOpacity=".95" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${u}corner`}>
        <stop offset="0" stopColor={VIOLET} stopOpacity=".38" />
        <stop offset=".6" stopColor={SKY} stopOpacity=".2" />
        <stop offset="1" stopColor={SKY} stopOpacity="0" />
      </radialGradient>
      <linearGradient id={`${u}tile`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#e8fbff" />
        <stop offset=".55" stopColor="#b9f3ff" />
        <stop offset="1" stopColor="#c9c1ff" />
      </linearGradient>
      <linearGradient id={`${u}gar`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={SKY} />
        <stop offset=".5" stopColor={BLUE} />
        <stop offset="1" stopColor={VIOLET} />
      </linearGradient>
      <linearGradient id={`${u}cta`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={BLUE} />
        <stop offset="1" stopColor={VIOLET} />
      </linearGradient>
      <linearGradient id={`${u}area`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={BLUE} stopOpacity=".34" />
        <stop offset="1" stopColor={SKY} stopOpacity=".02" />
      </linearGradient>
    </>
  );
}

const W_WIRE = "M370 73 L420 73 Q427 73 427 80 L427 333 Q427 340 434 340 L484 340";
const W_LIT = ["M370 73 L420 73 Q427 73 427 80 L427 125", "M427 125 L427 205", "M427 205 L427 258", "M427 258 L427 333 Q427 340 434 340 L484 340"];
const W_LINE = "M666 256 C700 252 716 240 748 242 S800 252 832 238 S892 226 960 216";
const C_LINE = "M198 186 C226 182 240 172 268 174 S316 182 346 168 S410 156 454 146";
const NAV_Y = (i: number) => 118 + i * 37;
const CIRC = 2 * Math.PI * 36;

/** Digits sit at fixed places, centred, because the host font's digits are not all one width. */
function Digit({ x, y, size, children }: { x: number; y: number; size: number; children: ReactNode }) {
  return (
    <Txt x={x} y={y} size={size} w={700} a="middle">
      {children}
    </Txt>
  );
}

function Roll({ k, x, y, size, h, from, to }: { k: string; x: number; y: number; size: number; h: number; from: string; to: string }) {
  return (
    <>
      <Move k={k}>
        <Digit x={x} y={y} size={size}>
          {from}
        </Digit>
        <Digit x={x} y={y + h} size={size}>
          {to}
        </Digit>
      </Move>
      <Move k={`${k}b`}>
        <Digit x={x} y={y} size={size}>
          {from}
        </Digit>
      </Move>
    </>
  );
}

function WideArt({ u, l }: { u: string; l: L }) {
  const nav: [keyof L, ReactNode][] = [
    ["navDashboard", I_HOUSE],
    ["navProducts", I_PACKAGE],
    ["navOrders", I_RECEIPT],
    ["navCustomers", I_USERS],
    ["navFinances", I_WALLET],
    ["navInbox", I_INBOX],
    ["navSettings", I_SETTINGS],
  ];
  return (
    <svg className="cp-w" viewBox="0 0 1200 420" role="img" aria-label={l.alt}>
      <defs>
        <Defs u={u} />
        <clipPath id={`${u}rows`}>
          <rect x={652} y={316} width={492} height={66} />
        </clipPath>
        <clipPath id={`${u}chart`}>
          <rect x={652} y={174} width={324} height={106} />
        </clipPath>
        <clipPath id={`${u}ctaclip`}>
          <rect x={56} y={350} width={298} height={36} rx={18} />
        </clipPath>
        <clipPath id={`${u}k0`}>
          <rect x={652} y={102} width={156} height={62} rx={14} />
        </clipPath>
        <clipPath id={`${u}v0`}>
          <rect x={744} y={131} width={56} height={29} />
        </clipPath>
        <clipPath id={`${u}v1`}>
          <rect x={832} y={131} width={60} height={29} />
        </clipPath>
        <clipPath id={`${u}v2`}>
          <rect x={1014} y={131} width={40} height={29} />
        </clipPath>
      </defs>

      <Move k="w.au0">
        <circle r={380} fill={`url(#${u}a1)`} />
      </Move>
      <Move k="w.au1">
        <circle r={330} fill={`url(#${u}a2)`} />
      </Move>
      <Move k="w.au2">
        <circle r={300} fill={`url(#${u}a3)`} />
      </Move>

      <Txt x={40} y={40} size={22} w={650} l="onlineShop">
        {l.onlineShop}
      </Txt>
      <Txt x={484} y={40} size={22} w={650} l="staffSystem">
        {l.staffSystem}
      </Txt>

      {/* The shop window */}
      <rect x={44} y={60} width={330} height={342} rx={18} fill={INK} opacity={0.07} />
      <rect x={40} y={54} width={330} height={342} rx={18} fill="#fff" />
      <text x={58} y={81} fontSize={21} fontStyle="italic" fontFamily="Georgia,'Times New Roman',serif" fill={INK}>
        Aerloom
      </text>
      <Move k="w.bag">
        <Icon x={-11.5} y={-11.5} size={23} color={INK}>
          {I_BAG}
        </Icon>
      </Move>
      <rect x={56} y={96} width={298} height={186} rx={12} fill={`url(#${u}tile)`} />
      <Move k="w.bob">
        <Hoodie fill={`url(#${u}gar)`} />
      </Move>
      <Txt x={56} y={308} size={19} w={600}>
        Essential Hoodie
      </Txt>
      <Txt x={354} y={308} size={19} w={600} a="end">
        CHF 89.00
      </Txt>
      {["S", "M", "L", "XL"].map((z, i) => (
        <g key={z}>
          <rect x={56 + i * 40} y={318} width={34} height={24} rx={8} fill={z === "M" ? `url(#${u}cta)` : "#f1f5ff"} />
          <Txt x={73 + i * 40} y={336} size={16} w={600} a="middle" c={z === "M" ? "#fff" : INK}>
            {z}
          </Txt>
        </g>
      ))}
      <Move k="w.cta">
        <rect x={-149} y={-18} width={298} height={36} rx={18} fill={`url(#${u}cta)`} />
        <Txt y={6} size={18} w={650} a="middle" c="#fff" l="addToBag">
          {l.addToBag}
        </Txt>
      </Move>
      <g clipPath={`url(#${u}ctaclip)`}>
        <Move k="w.rip">
          <circle r={34} fill="#fff" />
        </Move>
      </g>
      <Move k="w.badge">
        <circle r={9} fill={BLUE} />
        <Txt y={5.5} size={16} w={700} a="middle" c="#fff">
          1
        </Txt>
      </Move>

      {/* The spine between the two windows */}
      <path d={W_WIRE} fill="none" stroke="#fff" strokeOpacity={0.85} strokeWidth={6} />
      <path d={W_WIRE} fill="none" stroke={WIRE} strokeWidth={1.6} />
      {W_LIT.map((d, i) => (
        <Move key={d} k={`w.l${i}`}>
          <path d={d} fill="none" stroke={BLUE} strokeWidth={3.2} />
        </Move>
      ))}
      <ServiceNode y={98} l="payments" name={l.payments} icon={I_CARD} k="w.h.pay" />
      <ServiceNode y={178} l="database" name={l.database} icon={I_DB} k="w.h.db" />
      <rect x={381} y={258} width={92} height={54} rx={14} fill="#dff6ff" />
      <Move k="w.mail">
        <ServiceNode y={258} l="mail" name={l.mail} icon={I_MAIL} k="w.h.mail" />
      </Move>

      {/* The dashboard window */}
      <rect x={488} y={60} width={676} height={342} rx={18} fill={INK} opacity={0.07} />
      <rect x={484} y={54} width={676} height={342} rx={18} fill="#fff" />
      <path d="M496 86 Q509 66 522 86" fill="none" stroke={BLUE} strokeWidth={2} />
      <circle cx={496} cy={86} r={3.4} fill={SKY} />
      <circle cx={509} cy={76} r={3.4} fill={BLUE} />
      <circle cx={522} cy={86} r={3.4} fill={VIOLET} />
      <text x={530} y={86} fontSize={19} fontStyle="italic" fontFamily="Georgia,'Times New Roman',serif" fill={INK}>
        Aerloom
      </text>
      <path d="M640 54 V396" stroke={HAIR} />
      <rect x={492} y={99} width={140} height={32} rx={10} fill={ACTIVE} />
      {nav.map(([key, icon], i) => (
        <g key={key}>
          <Icon x={500} y={NAV_Y(i) - 12} size={18} color={i === 0 ? BLUE : INK}>
            {icon}
          </Icon>
          <Txt x={522} y={NAV_Y(i) + 3} size={16} w={i === 0 ? 650 : 500} c={i === 0 ? WIRE : INK} l={key}>
            {l[key]}
          </Txt>
        </g>
      ))}
      <Move k="w.ib">
        <circle r={9} fill={VIOLET} />
        <Move k="w.i3">
          <Txt y={5.5} size={16} w={700} a="middle" c={INK}>
            3
          </Txt>
        </Move>
        <Move k="w.i4">
          <Txt y={5.5} size={16} w={700} a="middle" c={INK}>
            4
          </Txt>
        </Move>
      </Move>

      <Txt x={652} y={88} size={25} w={700} l="navDashboard">
        {l.navDashboard}
      </Txt>
      <rect x={940} y={66} width={124} height={28} rx={14} fill="#fff" stroke={HAIR} />
      <Icon x={950} y={72} size={16} color="#8ea3d6">
        {I_SEARCH}
      </Icon>
      <rect x={974} y={76} width={72} height={8} rx={4} fill="#e8eefc" />
      <Icon x={1077} y={69} size={22} color={INK}>
        {I_BELL}
      </Icon>
      <Move k="w.bell">
        <circle r={5} fill={VIOLET} stroke="#fff" strokeWidth={1.5} />
      </Move>
      <circle cx={1126} cy={80} r={15} fill={ACTIVE} />
      <Txt x={1126} y={86} size={16} w={650} a="middle">
        MK
      </Txt>

      {/* KPI cards */}
      <g clipPath={`url(#${u}k0)`}>
        <rect x={652} y={102} width={156} height={62} fill="#fff" />
        <circle cx={792} cy={118} r={46} fill={`url(#${u}corner)`} />
      </g>
      <rect x={652} y={102} width={156} height={62} rx={14} fill="none" stroke={HAIR} />
      <Txt x={666} y={124} size={16} c={MUTE} l="totalRevenue">
        {l.totalRevenue}
      </Txt>
      <Txt x={666} y={153} size={25} w={700}>
        CHF
      </Txt>
      <Digit x={732} y={153} size={25}>
        2
      </Digit>
      <Digit x={743} y={153} size={25}>
        {"'"}
      </Digit>
      <g clipPath={`url(#${u}v0)`}>
        <Roll k="w.k0.0" x={754} y={153} size={25} h={29} from="2" to="3" />
        <Roll k="w.k0.1" x={771} y={153} size={25} h={29} from="3" to="2" />
        <Roll k="w.k0.2" x={788} y={153} size={25} h={29} from="7" to="6" />
      </g>

      <rect x={820} y={102} width={156} height={62} rx={14} fill="#fff" stroke={HAIR} />
      <Txt x={834} y={124} size={16} c={MUTE} l="orders">
        {l.orders}
      </Txt>
      <g clipPath={`url(#${u}v1)`}>
        <Roll k="w.k1.0" x={842} y={153} size={25} h={29} from="1" to="2" />
        <Roll k="w.k1.1" x={859} y={153} size={25} h={29} from="9" to="0" />
      </g>

      <rect x={988} y={102} width={156} height={62} rx={14} fill="#fff" stroke={HAIR} />
      <Txt x={1002} y={124} size={16} c={MUTE} l="customers">
        {l.customers}
      </Txt>
      <Digit x={1008} y={153} size={25}>
        1
      </Digit>
      <g clipPath={`url(#${u}v2)`}>
        <Roll k="w.k2.0" x={1024} y={153} size={25} h={29} from="5" to="6" />
      </g>

      {/* Revenue */}
      <rect x={652} y={174} width={324} height={106} rx={14} fill="#fff" />
      <path d={`${W_LINE} L960 272 L666 272Z`} fill={`url(#${u}area)`} />
      <path d={W_LINE} fill="none" stroke={BLUE} strokeWidth={2.6} />
      <g clipPath={`url(#${u}chart)`}>
        <Move k="w.cover">
          <rect x={900} y={206} width={76} height={74} fill="#fff" />
        </Move>
      </g>
      <rect x={652} y={174} width={324} height={106} rx={14} fill="none" stroke={HAIR} />
      <Txt x={666} y={197} size={16} w={650} l="revenue">
        {l.revenue}
      </Txt>
      {["7D", "30D", "90D", "1Y"].map((p, i) => (
        <g key={p}>
          {i === 0 ? <rect x={816} y={182} width={34} height={22} rx={11} fill={ACTIVE} /> : null}
          <Txt x={833 + i * 38} y={198.5} size={16} w={i === 0 ? 650 : 500} a="middle" c={i === 0 ? WIRE : MUTE}>
            {p}
          </Txt>
        </g>
      ))}
      <Move k="w.pulse">
        <circle r={7} fill="none" stroke={BLUE} strokeWidth={2} />
      </Move>
      <Move k="w.dot">
        <circle r={5.5} fill={BLUE} stroke="#fff" strokeWidth={2} />
      </Move>
      <Move k="w.tip">
        <rect x={-42} y={-13} width={84} height={26} rx={8} fill={INK} />
        <Txt y={5.5} size={16} w={650} a="middle" c="#fff">
          +CHF 89
        </Txt>
      </Move>

      {/* Donut */}
      <rect x={988} y={174} width={156} height={106} rx={14} fill="#fff" stroke={HAIR} />
      <Move k="w.donut">
        <g transform="rotate(-90)" fill="none" strokeWidth={13}>
          <circle r={36} stroke={BLUE} strokeDasharray={`${0.52 * CIRC} ${CIRC}`} />
          <circle r={36} stroke={SKY} strokeDasharray={`${0.28 * CIRC} ${CIRC}`} strokeDashoffset={-0.52 * CIRC} />
          <circle r={36} stroke={VIOLET} strokeDasharray={`${0.2 * CIRC} ${CIRC}`} strokeDashoffset={-0.8 * CIRC} />
        </g>
      </Move>

      {/* Recent orders */}
      <rect x={652} y={290} width={492} height={94} rx={14} fill="#fff" stroke={HAIR} />
      <Txt x={666} y={310} size={16} w={650} l="recentOrders">
        {l.recentOrders}
      </Txt>
      <g clipPath={`url(#${u}rows)`}>
        <Move k="w.o0">
          <Row u={u} no="AL-1150" total="CHF 158.00" />
          <g transform="translate(1080 0)">
            <Chip tone="paid" l="statusPaid" text={l.statusPaid} />
          </g>
        </Move>
        <Move k="w.o1">
          <Row u={u} no="AL-1149" total="CHF 297.00" />
          <g transform="translate(1080 0)">
            <Chip tone="pending" l="statusPending" text={l.statusPending} />
          </g>
        </Move>
        <Move k="w.new">
          <Move k="w.tint">
            <rect x={658} y={-14} width={480} height={28} rx={8} fill="#eef4ff" />
          </Move>
          <Row u={u} no="AL-1151" total="CHF 89.00" />
          <Move k="w.c.paid">
            <Chip tone="paid" l="statusPaid" text={l.statusPaid} />
          </Move>
          <Move k="w.c.packed">
            <Chip tone="packed" l="statusPacked" text={l.statusPacked} />
          </Move>
          <Move k="w.c.shipped">
            <Chip tone="shipped" l="statusShipped" text={l.statusShipped} />
          </Move>
        </Move>
        <Move k="w.dt">
          {[0, 1, 2, 3, 4].map((i) => (
            <circle key={i} cx={910 + 20 * i} cy={330} r={4} fill="#fff" stroke="#b6cbfa" strokeWidth={1.5} />
          ))}
        </Move>
        {[0, 1, 2, 3, 4].map((i) => (
          <Move key={i} k={`w.d${i}`}>
            <circle r={4} fill={SOLID} />
          </Move>
        ))}
      </g>

      {/* Above everything: the amber fault, the packet, the word, the cursors */}
      {(["pay", "db", "mail"] as const).map((id) => (
        <Move key={id} k={`w.r.${id}`}>
          <rect x={-46} y={-27} width={92} height={54} rx={14} fill="none" stroke={BLUE} strokeWidth={2.5} />
        </Move>
      ))}
      <Move k="w.mini">
        <Hoodie fill={`url(#${u}gar)`} />
      </Move>
      <Move k="w.tri">
        <Triangle size={30} />
      </Move>
      <Move k="w.halo">
        <circle r={13} fill="none" stroke={AMBER} strokeWidth={3} />
      </Move>
      <Move k="w.pkt">
        <circle r={11} fill={INK} stroke="#fff" strokeWidth={2} />
        <Hoodie scale={0.2} fill="#fff" tint={INK} cord={INK} />
      </Move>
      <Pills prefix="w." l={l} size={17} />
      <Move k="w.cur">
        <path d={CURSOR} fill={INK} stroke="#fff" strokeWidth={1.5} strokeLinejoin="round" />
      </Move>
      <Move k="w.vrip">
        <circle r={13} fill="none" stroke={VIOLET} strokeWidth={2.5} />
      </Move>
      <Move k="w.vcur">
        <path d={CURSOR} fill={VIOLET} stroke="#fff" strokeWidth={1.5} strokeLinejoin="round" />
      </Move>
    </svg>
  );
}

function CompactArt({ u, l }: { u: string; l: L }) {
  return (
    <svg className="cp-c" viewBox="0 0 480 300" role="img" aria-label={l.alt}>
      <defs>
        <Defs u={u} />
        <clipPath id={`${u}win`}>
          <rect x={186} y={44} width={280} height={240} rx={18} />
        </clipPath>
        <clipPath id={`${u}k0`}>
          <rect x={198} y={56} width={124} height={66} rx={12} />
        </clipPath>
        <clipPath id={`${u}v0`}>
          <rect x={232} y={88} width={84} height={30} />
        </clipPath>
        <clipPath id={`${u}v1`}>
          <rect x={338} y={88} width={110} height={30} />
        </clipPath>
      </defs>
      <Move k="c.au0">
        <circle r={210} fill={`url(#${u}a1)`} />
      </Move>
      <Move k="c.au1">
        <circle r={170} fill={`url(#${u}a2)`} />
      </Move>
      <Txt x={16} y={32} size={24} w={650} l="shop">
        {l.shop}
      </Txt>
      <Txt x={188} y={32} size={24} w={650} l="staffSystem">
        {l.staffSystem}
      </Txt>

      {/* The shop, as a phone */}
      <rect x={17} y={48} width={148} height={240} rx={18} fill={INK} opacity={0.07} />
      <rect x={14} y={44} width={148} height={240} rx={18} fill="#fff" />
      <rect x={24} y={54} width={128} height={120} rx={12} fill={`url(#${u}tile)`} />
      <Move k="c.bob">
        <Hoodie fill={`url(#${u}gar)`} />
      </Move>
      <Txt x={24} y={203} size={24} w={650}>
        CHF 89
      </Txt>
      <Move k="c.cta">
        <rect x={-64} y={-27} width={128} height={54} rx={16} fill={`url(#${u}cta)`} />
        <Icon x={-18} y={-18} size={36} color="#fff">
          {I_BAG}
        </Icon>
      </Move>

      {/* The staff window */}
      <rect x={189} y={48} width={280} height={240} rx={18} fill={INK} opacity={0.07} />
      <rect x={186} y={44} width={280} height={240} rx={18} fill="#fff" />
      <g clipPath={`url(#${u}k0)`}>
        <circle cx={312} cy={66} r={40} fill={`url(#${u}corner)`} />
      </g>
      <rect x={198} y={56} width={124} height={66} rx={12} fill="none" stroke={HAIR} />
      <Txt x={208} y={79} size={24} c={MUTE} l="revenue">
        {l.revenue}
      </Txt>
      <Digit x={217} y={111} size={26}>
        2
      </Digit>
      <Digit x={228} y={111} size={26}>
        {"'"}
      </Digit>
      <g clipPath={`url(#${u}v0)`}>
        <Roll k="c.k0.0" x={240} y={111} size={26} h={31} from="2" to="3" />
        <Roll k="c.k0.1" x={258} y={111} size={26} h={31} from="3" to="2" />
        <Roll k="c.k0.2" x={276} y={111} size={26} h={31} from="7" to="6" />
      </g>
      <rect x={332} y={56} width={122} height={66} rx={12} fill="none" stroke={HAIR} />
      <Icon x={342} y={62} size={22} color={INK}>
        {I_BAG}
      </Icon>
      <g clipPath={`url(#${u}v1)`}>
        <Roll k="c.k1.0" x={351} y={111} size={26} h={31} from="1" to="2" />
        <Roll k="c.k1.1" x={369} y={111} size={26} h={31} from="9" to="0" />
      </g>

      <path d={`${C_LINE} L454 196 L198 196Z`} fill={`url(#${u}area)`} />
      <path d={C_LINE} fill="none" stroke={BLUE} strokeWidth={3} />
      <g clipPath={`url(#${u}win)`}>
        <Move k="c.cover">
          <rect x={400} y={134} width={66} height={64} fill="#fff" />
        </Move>
      </g>
      <Move k="c.pulse">
        <circle r={8} fill="none" stroke={BLUE} strokeWidth={2.5} />
      </Move>
      <Move k="c.dot">
        <circle r={6} fill={BLUE} stroke="#fff" strokeWidth={2} />
      </Move>

      {/* The order row */}
      <rect x={198} y={204} width={256} height={68} rx={12} fill="#fff" />
      <Move k="c.tint">
        <rect x={198} y={204} width={256} height={68} rx={12} fill="#eef4ff" />
      </Move>
      <rect x={198} y={204} width={256} height={68} rx={12} fill="none" stroke={HAIR} />
      <rect x={208} y={217} width={42} height={42} rx={9} fill="#eef3ff" />
      <g transform="translate(229 238)">
        <Hoodie scale={0.5} fill={`url(#${u}gar)`} />
      </g>
      <Move k="c.n0">
        <Txt x={260} y={236} size={24} w={650}>
          AL-1150
        </Txt>
      </Move>
      <Move k="c.n1">
        <Txt x={260} y={236} size={24} w={650}>
          AL-1151
        </Txt>
      </Move>
      <Move k="c.s.paid">
        <circle cx={266} cy={253} r={5} fill={TONES.paid[1]} />
        <Txt x={276} y={260} size={24} w={600} l="statusPaid">
          {l.statusPaid}
        </Txt>
      </Move>
      <Move k="c.s.packed">
        <circle cx={266} cy={253} r={5} fill={TONES.packed[1]} />
        <Txt x={276} y={260} size={24} w={600} l="statusPacked">
          {l.statusPacked}
        </Txt>
      </Move>

      {/* The wire across the gap, and everything on top */}
      <path d="M152 243 L198 238" stroke="#fff" strokeOpacity={0.85} strokeWidth={6} />
      <path d="M152 243 L198 238" stroke={WIRE} strokeWidth={2} />
      <Move k="c.lit">
        <path d="M152 243 L198 238" stroke={BLUE} strokeWidth={3.2} />
      </Move>
      <Move k="c.tap">
        <circle r={30} fill="none" stroke={INK} strokeWidth={3} />
      </Move>
      <Move k="c.vtap">
        <circle r={24} fill="none" stroke={VIOLET} strokeWidth={3} />
      </Move>
      <Move k="c.r.row">
        <rect x={-128} y={-34} width={256} height={68} rx={12} fill="none" stroke={BLUE} strokeWidth={3} />
      </Move>
      <Move k="c.mini">
        <Hoodie fill={`url(#${u}gar)`} />
      </Move>
      <Move k="c.tri">
        <Triangle size={30} />
      </Move>
      <Move k="c.beat">
        <circle r={13} fill="none" stroke={BLUE} strokeWidth={3} />
      </Move>
      <Move k="c.halo">
        <circle r={13} fill="none" stroke={AMBER} strokeWidth={3} />
      </Move>
      <Move k="c.pkt">
        <circle r={10} fill={INK} stroke="#fff" strokeWidth={2} />
        <Hoodie scale={0.18} fill="#fff" tint={INK} cord={INK} />
      </Move>
      <Pills prefix="c." l={l} size={24} />
    </svg>
  );
}

/**
 * The portfolio card's moving part. Text below the drawing is real HTML, so the button can be a button.
 * The card around it must be a `div` with an inner link, because an anchor cannot hold a button.
 * See README.md in this folder for the card contract.
 */
export const CommercePreview = forwardRef<CommercePreviewHandle, CommercePreviewProps>(function CommercePreview({ lang, labels, className }, ref) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [reduced, setReduced] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const engine = useRef<{ seek: (t: number) => void; play: () => void; pause: () => void; t: () => number } | null>(null);
  const l = { ...COMMERCE_PREVIEW_LABELS[lang], ...labels };

  useImperativeHandle(
    ref,
    () => ({
      seek: (t: number) => engine.current?.seek(t),
      play: () => engine.current?.play(),
      pause: () => engine.current?.pause(),
      get t() {
        return engine.current?.t() ?? 0;
      },
    }),
    [],
  );

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const parts = new Map<string, SVGGElement>();
    el.querySelectorAll<SVGGElement>("[data-k]").forEach((node) => {
      const key = node.getAttribute("data-k");
      if (key) parts.set(key, node);
    });
    const written = new Map<string, string>();
    let time = 0;
    let variant: Variant = "wide";
    let raf = 0;
    let last = 0;
    let onScreen = false;
    let playing = true;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");

    const renderFrame = (t: number) => {
      const f = frame(t, variant);
      for (const key in f) {
        const node = parts.get(key);
        if (!node) continue;
        const part = f[key];
        const opacity = part.o.toFixed(3);
        const transform = partTransform(part);
        const sig = `${opacity}|${transform}`;
        if (written.get(key) === sig) continue;
        written.set(key, sig);
        node.style.opacity = opacity;
        node.style.transform = transform;
      }
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const delta = last === 0 ? 0 : Math.min(now - last, 64);
      last = now;
      time = (time + delta / 1000) % LOOP_S;
      renderFrame(time);
    };

    const sync = () => {
      const run = playing && onScreen && !media.matches && document.visibilityState === "visible";
      if (run && raf === 0) {
        last = 0;
        raf = requestAnimationFrame(tick);
      } else if (!run && raf !== 0) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    const seek = (t: number) => {
      time = t;
      el.setAttribute("data-t", String(t));
      renderFrame(t);
    };

    engine.current = {
      seek,
      play: () => {
        playing = true;
        sync();
      },
      pause: () => {
        playing = false;
        sync();
      },
      t: () => time,
    };

    const setVariant = (width: number) => {
      if (width <= 0) return;
      const next: Variant = width < WIDE_FROM ? "compact" : "wide";
      if (next === variant) return;
      variant = next;
      renderFrame(time);
    };

    const onMotion = () => {
      setReduced(media.matches);
      if (media.matches) seek(STILL_T);
      sync();
    };

    const sizes = new ResizeObserver((entries) => {
      for (const entry of entries) setVariant(entry.contentRect.width);
    });
    // The portfolio reveals cards late, so the clock starts once half the banner shows and stops only when none does.
    const seen = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.intersectionRatio >= 0.5) onScreen = true;
          else if (e.intersectionRatio === 0) onScreen = false;
        }
        sync();
      },
      { threshold: [0, 0.5] },
    );
    setVariant(el.getBoundingClientRect().width);
    sizes.observe(el);
    seen.observe(el);
    document.addEventListener("visibilitychange", sync);
    media.addEventListener("change", onMotion);
    onMotion();

    return () => {
      sizes.disconnect();
      seen.disconnect();
      document.removeEventListener("visibilitychange", sync);
      media.removeEventListener("change", onMotion);
      if (raf !== 0) cancelAnimationFrame(raf);
      raf = 0;
      engine.current = null;
    };
  }, []);

  return (
    <div ref={root} className={`cp-root ${className ?? ""}`} data-t="0">
      <style>{CP_CSS}</style>
      <div className="cp-stage">
        <WideArt u={`${uid}w`} l={l} />
        <CompactArt u={`${uid}c`} l={l} />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "6px 12px", marginTop: 10, fontSize: 12, lineHeight: 1.3 }}>
        <span data-l="illustration">{l.illustration}</span>
        <button
          type="button"
          onClick={() => engine.current?.seek(reduced ? FAULT_STILL_T : FAULT_T)}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 32, padding: "0 12px", border: "1.5px solid currentColor", borderRadius: 999, background: "transparent", color: "inherit", font: "inherit", fontWeight: 500, cursor: "pointer" }}
        >
          <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
          </svg>
          <span data-l="fail">{l.fail}</span>
        </button>
      </div>
    </div>
  );
});

export default CommercePreview;
