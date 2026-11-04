"use client";

import { ChevronRight, HardDrive } from "lucide-react";
import { DEMO_MONTH } from "@/store/clock";
import { fmt, useLang, useT } from "@/i18n";
import { finance } from "@/i18n/dict/finance";
import { formatBytes, formatDateTime, formatMinor, formatMonth } from "@/lib/format";
import type { Cost, FxRate, PricePlan } from "@/store/types";
import { STORAGE_PROVIDER_READING, evaluatePlan, findPlan, formatQuantity, freeTierLeft, monthElapsed, rowCost, storageQuantities, toRappen, type PlanDraft, type StorageMeasure } from "../rules/planner";
import { meterPriceText } from "./PlanRow";

/** The storage row's working: one fixed provider reading, then the app's own estimate, which the planner counts. */
export function StorageCard({ carrier, plans, fx, measure, draft }: { carrier: Cost; plans: PricePlan[]; fx: FxRate[]; measure: StorageMeasure; draft?: PlanDraft }) {
  const { costs: t } = useT(finance);
  const lang = useLang();
  const row = rowCost(carrier, plans, measure, draft);
  const plan = row.plan ?? findPlan(plans, carrier.planId);
  if (!plan || !row.result) return null;
  const q = storageQuantities(measure, row.usage);
  const extraGb = row.usage.extra_gb ?? row.usage.storage_gb ?? 0;
  const storageMeter = plan.meters.find((m) => m.key === "storage_gb");
  const includedGb = storageMeter?.included ?? 0;
  const free = row.result.meters.every((m) => m.blocks === 0);
  const left = freeTierLeft(includedGb, measure, extraGb);
  const months = measure.soFar ? t.soFarMonth : fmt(t.averageOf, { months: measure.paceMonths.map((m) => formatMonth(m, lang)).join(", ") });

  const reading = STORAGE_PROVIDER_READING;
  const elapsed = monthElapsed("2027-01-08");
  const readGb = reading.bytes / 1e9;
  const a = plan.meters.find((m) => m.key === "class_a");
  const b = plan.meters.find((m) => m.key === "class_b");
  const soFar = evaluatePlan(plan, {}, { storage_gb: readGb * elapsed, class_a: reading.classA, class_b: reading.classB });
  const projected = evaluatePlan(plan, {}, { storage_gb: readGb, class_a: Math.round(reading.classA / elapsed), class_b: Math.round(reading.classB / elapsed) });
  const projectedChf = toRappen(projected.totalMinor, plan.currency, fx);

  let freeLine: string;
  if (left.gbLeft <= 0) freeLine = fmt(t.storageFreeUsed, { included: formatQuantity(includedGb) });
  else if (left.monthsAtPace === null) freeLine = fmt(t.storageFreePlain, { left: formatQuantity(left.gbLeft), included: formatQuantity(includedGb) });
  else if (Math.round(left.monthsAtPace) < 1) freeLine = fmt(t.storageFreeSoon, { left: formatQuantity(left.gbLeft), included: formatQuantity(includedGb) });
  else freeLine = fmt(t.storageFreeMonths, { left: formatQuantity(left.gbLeft), included: formatQuantity(includedGb), months: formatQuantity(Math.round(left.monthsAtPace)) });

  const chf = toRappen(row.minor, row.currency, fx);

  return (
    <details className="fin-card" id="storage-card">
      <summary>
        <ChevronRight className="fin-chev" size={16} aria-hidden="true" />
        <HardDrive size={16} aria-hidden="true" />
        <span>
          {fmt(t.storageSummary, { gb: formatQuantity(q.storage_gb), uploads: fmt(t.storageUploads, { n: formatQuantity(measure.uploadsPerMonth) }), amount: formatMinor(row.minor, row.currency) })}
          {free ? ` ${t.storageSummaryFree}` : ""}
        </span>
      </summary>
      <div className="fin-card-body">
        <div>
          <h4 className="fin-h">{fmt(t.storageProviderTitle, { month: formatMonth(DEMO_MONTH, lang) })}</h4>
          <ul className="fin-dl mt-1">
            <li>{fmt(t.storageStored, { size: formatBytes(reading.bytes), n: reading.buckets, objects: formatQuantity(reading.objects) })}</li>
            <li>{fmt(t.storageSoFarOps, { a: formatQuantity(reading.classA), b: formatQuantity(reading.classB) })}</li>
            <li>
              {fmt(t.storageFreeLeft, {
                gb: formatQuantity(Math.max(0, includedGb - readGb)), includedGb: formatQuantity(includedGb),
                a: formatQuantity(Math.max(0, (a?.included ?? 0) - reading.classA)), includedA: formatQuantity(a?.included ?? 0),
                b: formatQuantity(Math.max(0, (b?.included ?? 0) - reading.classB)), includedB: formatQuantity(b?.included ?? 0),
              })}
            </li>
            <li>
              <b>{fmt(t.storageMoney, { soFar: formatMinor(soFar.totalMinor, plan.currency), projected: formatMinor(projected.totalMinor, plan.currency), chf: projectedChf === null ? "–" : formatMinor(projectedChf, "CHF") })}</b>
            </li>
            <li>{fmt(t.storageOwn, { objects: formatQuantity(reading.ownObjects), size: formatBytes(reading.ownBytes), a: formatQuantity(reading.ownClassA), b: formatQuantity(reading.ownClassB) })}</li>
            <li className="fin-faint">{fmt(t.storageFixture, { at: formatDateTime(reading.readAt) })}</li>
          </ul>
        </div>
        <div>
          <h4 className="fin-h">{t.storageEstimate}</h4>
          <ul className="fin-dl mt-1">
            <li>
              {fmt(t.storageLists, {
                objects: formatQuantity(measure.objects), gb: formatQuantity(measure.storedGb), files: formatQuantity(measure.fileObjects), filesGb: formatQuantity(measure.fileBytes / 1e9),
                trash: formatQuantity(measure.trashObjects), trashGb: formatQuantity(measure.trashBytes / 1e9), receipts: formatQuantity(measure.receiptObjects), receiptsGb: formatQuantity(measure.receiptBytes / 1e9),
              })}
            </li>
            <li>{fmt(t.storageAdded, { gb: formatQuantity(measure.gbAddedPerMonth), months })}</li>
            <li>{freeLine}</li>
            <li>{fmt(t.storageUploadsLine, { n: formatQuantity(measure.uploadsPerMonth), months })}</li>
          </ul>
        </div>
        <ul className="fin-dl">
          {row.result.meters.map((m) => (
            <li key={m.meter.key}>
              {fmt(t.storageMeter, {
                label: lang === "de" ? m.meter.labelDe : m.meter.labelEn, quantity: formatQuantity(m.quantity), included: formatQuantity(m.meter.included), blocks: formatQuantity(m.blocks),
                amount: `${plan.currency} ${(Number(m.chargeMicro) / 1_000_000).toFixed(3)}`,
              })}
              {m.meter.priceMicro !== null ? <span className="fin-faint"> · {meterPriceText(plan, m.meter, t)}</span> : null}
            </li>
          ))}
          <li>
            <b>{fmt(t.storageCost, { amount: formatMinor(row.minor, row.currency), chf: chf === null ? "–" : formatMinor(chf, "CHF") })}</b>
          </li>
        </ul>
        <div>
          <h4 className="fin-h">{t.assumptions}</h4>
          <ul className="fin-dl mt-1">
            {t.assumptionList.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="fin-h">{t.caveats}</h4>
          <ul className="fin-dl mt-1">
            {t.caveatList.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  );
}
