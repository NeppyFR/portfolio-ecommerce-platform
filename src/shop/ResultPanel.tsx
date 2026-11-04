"use client";

import Link from "next/link";
import { ArrowRight, Mail } from "lucide-react";
import { useMemo, useState } from "react";
import { fmt, useDocTitle, useT } from "@/i18n";
import { shop } from "@/i18n/dict/shop";
import { LABEL } from "@/lib/brand";
import { formatTime } from "@/lib/format";
import { orderHref } from "@/lib/routes";
import { emailHtml } from "@/store/flows";
import { useStore } from "@/store/core";
import type { CheckoutResultState, NodeId, Order } from "@/store/types";
import { Button, RuleLine, Sheet, Tl } from "@/ui";

type StepKey = keyof typeof import("@/i18n/dict/shop").en.result.steps;
type Step = { key: StepKey; service: NodeId; tone?: "warn" };

const HOLD: Step = { key: "hold", service: "database" };
const RELEASED: Step = { key: "hold_released", service: "database" };

/** The state and the order decide the story, so a reload tells the same one as the moment itself. */
export function stepsFor(state: CheckoutResultState, order: Pick<Order, "stockConflict"> | null): Step[] {
  switch (state) {
    case "completed": {
      const steps: Step[] = [HOLD, { key: "webhook", service: "payments" }, { key: "order_written", service: "database" }, { key: "stock_moved", service: "database" }, { key: "email_rendered", service: "mail" }, { key: "not_sent", service: "mail" }];
      if (order?.stockConflict) steps.splice(3, 0, { key: "conflict", service: "database", tone: "warn" });
      return steps;
    }
    case "pending":
      return [HOLD, { key: "waiting", service: "payments" }];
    case "cancelled":
    case "failed":
      return [HOLD, RELEASED];
    case "expired":
      return [HOLD, { key: "session_expired", service: "payments" }, RELEASED];
    default:
      return [];
  }
}

const isNothing = (state: CheckoutResultState) => state === "failed" || state === "cancelled" || state === "expired";

function EmailSheet({ open, onClose, orderNumber }: { open: boolean; onClose: () => void; orderNumber: string }) {
  const t = useT(shop);
  const outbox = useStore((s) => s.outbox);
  const html = useMemo(() => {
    const mail = outbox.find((m) => m.orderNumber === orderNumber && m.template === "order_confirmation");
    return mail ? emailHtml(mail.id) : "";
  }, [outbox, orderNumber]);
  return (
    <Sheet open={open} onClose={onClose} title={t.result.emailTitle} wide>
      <RuleLine>{t.result.emailNote}</RuleLine>
      {html ? <iframe className="sp-mail" sandbox="" srcDoc={html} title={t.result.emailFrame} /> : <p className="type-body">{t.result.emailMissing}</p>}
    </Sheet>
  );
}

export function ResultPanel({ state, orderNumber }: { state: CheckoutResultState; orderNumber: string | null }) {
  const t = useT(shop);
  const order = useStore((s) => (orderNumber ? s.orders.find((o) => o.orderNumber === orderNumber) : undefined)) ?? null;
  const [mail, setMail] = useState(false);
  const copy = t.result.states[state];
  useDocTitle(copy.title);
  const steps = stepsFor(state, order);
  const when = order?.paidAt ? formatTime(order.paidAt) : "";
  const units = order ? order.items.reduce((sum, i) => sum + i.quantity - i.shortfall, 0) : 0;
  const body = state === "completed" && !orderNumber ? t.result.completedNoOrder : fmt(copy.body, { order: orderNumber ?? "" });
  const gone = state === "completed" && !order;
  const showBagLink = isNothing(state) || state === "unknown" || state === "pending";

  return (
    <div className="sp-page">
      <header className="sp-page-head">
        <p className="sp-eyebrow">{LABEL.name}</p>
      </header>
      <div className="sp-result-grid">
        <div role="status" aria-live="polite" className="sp-result-main">
          <h1 className="type-shop-h2">{copy.title}</h1>
          <p className="type-body-l sp-result-body">{body}</p>
          {order?.stockConflict ? <p className="type-small sp-warn">{t.result.conflict}</p> : null}
          {gone ? <p className="type-small sp-result-note">{t.result.gone}</p> : null}
          <div className="sp-result-links">
            {state === "completed" ? (
              <Link href="/shop/all/" className="sp-textlink">
                {t.result.continueShopping}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            ) : null}
            {showBagLink ? (
              <Link href="/shop/bag/" className="sp-textlink">
                {t.result.backToBag}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            ) : null}
          </div>
        </div>
        <aside className="sp-happened f-order" aria-label={t.result.happened}>
          <h2 className="type-h4">{t.result.happened}</h2>
          {steps.length ? (
            <ol className="sp-happened-list">
              {steps.map((step) => (
                <Tl key={step.key} label={t.result.steps[step.key]} date={step.key === "waiting" ? t.result.simulated : when || t.result.simulated} service={step.service} tone={step.tone} />
              ))}
            </ol>
          ) : (
            <p className="type-small">{t.result.nothingHappened}</p>
          )}
          {isNothing(state) ? (
            <p className="type-mono sp-diff">{t.result.diffNone}</p>
          ) : state === "completed" && order ? (
            <p className="type-mono sp-diff">{fmt(t.result.diffPaid, { stock: units > 0 ? `−${units}` : "0" })}</p>
          ) : null}
          {order ? (
            <div className="sp-happened-actions">
              <Link href={orderHref(order.orderNumber)} className="ui-btn ui-btn-solid">
                {t.result.seeDesk}
              </Link>
              <Button variant="outline" onClick={() => setMail(true)}>
                <Mail size={16} aria-hidden="true" />
                {t.result.readEmail}
              </Button>
            </div>
          ) : null}
        </aside>
      </div>
      {order ? <EmailSheet open={mail} onClose={() => setMail(false)} orderNumber={order.orderNumber} /> : null}
    </div>
  );
}
