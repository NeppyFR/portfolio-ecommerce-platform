"use client";

import { useState } from "react";
import { CircleCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { DEMO_MONTH, DEMO_TODAY } from "@/store/clock";
import { fmt, useLang, useT } from "@/i18n";
import { useCostLabel } from "../shared";
import { finance } from "@/i18n/dict/finance";
import { addMonths } from "@/lib/dates";
import { formatChf, formatMinor, formatMonth, parseChf } from "@/lib/format";
import { isDue } from "@/lib/running-costs";
import { bookCost, unbookCost } from "@/store/actions/finance";
import { useStore } from "@/store/core";
import type { Cost } from "@/store/types";
import { Button, DateInput, IconButton, Input, toast } from "@/ui";

const moneyText = (minor: number) => (minor / 100).toFixed(2);

function BookForm({ cost, month }: { cost: Cost; month: string }) {
  const { costs: t } = useT(finance);
  const lang = useLang();
  const foreign = cost.currency !== "CHF";
  const [charged, setCharged] = useState(foreign ? "" : moneyText(cost.expectedMinor));
  const [bill, setBill] = useState(foreign ? moneyText(cost.expectedMinor) : "");
  const [day, setDay] = useState(month === DEMO_MONTH ? DEMO_TODAY : `${month}-01`);
  const [errors, setErrors] = useState<{ charged?: string; bill?: string }>({});

  const submit = () => {
    const chargedRappen = parseChf(charged);
    const billMinor = bill.trim() === "" ? null : parseChf(bill);
    const next: { charged?: string; bill?: string } = {};
    if (chargedRappen === null || chargedRappen <= 0) next.charged = t.errCharged;
    if (foreign && bill.trim() !== "" && (billMinor === null || billMinor <= 0)) next.bill = t.errBill;
    setErrors(next);
    if (next.charged || next.bill || chargedRappen === null) return;
    const result = bookCost({ costId: cost.id, month, chargedRappen, billMinor, occurredOn: day });
    if (!result.ok) {
      toast(result.code === "already_booked" ? fmt(t.errAlready, { label: cost.label, month }) : result.code === "planned" ? fmt(t.errPlanned, { label: cost.label }) : result.message);
      return;
    }
    toast(fmt(t.bookedToast, { label: cost.label, month: formatMonth(month, lang) }));
  };

  return (
    <form
      className="fin-book"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Input label={t.chargedChf} inputMode="decimal" value={charged} error={errors.charged} onChange={(e) => setCharged(e.target.value)} className={foreign ? "" : "fin-book-wide"} />
      {foreign ? <Input label={fmt(t.billAmount, { currency: cost.currency })} inputMode="decimal" value={bill} error={errors.bill} onChange={(e) => setBill(e.target.value)} /> : null}
      <DateInput label={t.date} value={day} onChange={(e) => setDay(e.target.value)} />
      <Button type="submit" variant="outline">
        {t.book}
      </Button>
    </form>
  );
}

/** Right column of the planner: what is booked, what is due, and one form per unbooked bill. */
export function DueList({ month, onMonth }: { month: string; onMonth: (month: string) => void }) {
  const { costs: t } = useT(finance);
  const lang = useLang();
  const costLabel = useCostLabel();
  const costs = useStore((s) => s.costs);
  const bookings = useStore((s) => s.costBookings);
  const due = costs.filter((c) => isDue(c, month));
  const monthName = formatMonth(month, lang);

  return (
    <section aria-label={fmt(t.dueIn, { month: monthName })}>
      <div className="fin-due-h">
        <h3 className="fin-h">{fmt(t.dueIn, { month: monthName })}</h3>
        <span className="fin-row" style={{ flexWrap: "nowrap", gap: 2 }}>
          <IconButton aria-label={t.prevMonth} onClick={() => onMonth(addMonths(month, -1))}>
            <ChevronLeft size={16} aria-hidden="true" />
          </IconButton>
          <IconButton aria-label={t.nextMonth} onClick={() => onMonth(addMonths(month, 1))}>
            <ChevronRight size={16} aria-hidden="true" />
          </IconButton>
        </span>
      </div>
      {due.length === 0 ? (
        <p className="fin-note mt-2">{fmt(t.nothingDue, { month: monthName })}</p>
      ) : (
        <ul className="fin-due">
          {due.map((cost) => {
            const booking = bookings.find((b) => b.costId === cost.id && b.month === month);
            const expected = cost.expectedMinor === 0 ? t.free : fmt(cost.isEstimate ? t.expectedEstimate : t.expected, { amount: formatMinor(cost.expectedMinor, cost.currency) });
            return (
              <li key={`${cost.id}-${month}`}>
                <div className="fin-between" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
                  <div className="min-w-0">
                    <div className="fin-due-name">{costLabel(cost.label)}</div>
                    <div className="fin-due-sub">{[cost.vendor, expected].filter(Boolean).join(" · ")}</div>
                  </div>
                  {cost.expectedMinor === 0 && !booking ? <span className="fin-chip" data-tone="plain">{t.free}</span> : null}
                </div>
                {booking ? (
                  <div className="fin-between mt-1">
                    <span className="fin-chip fin-wrap">
                      <CircleCheck size={13} aria-hidden="true" />
                      {fmt(t.booked, { amount: formatChf(booking.amountRappen) })}
                    </span>
                    <button
                      type="button"
                      className="fin-link type-small"
                      onClick={() => {
                        const result = unbookCost(cost.id, month);
                        if (result.ok) toast(fmt(t.unbooked, { label: cost.label, month: monthName }));
                      }}
                    >
                      {t.undoBook}
                    </button>
                  </div>
                ) : cost.expectedMinor > 0 ? (
                  <BookForm cost={cost} month={month} />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
