"use client";

import { BellRing, Percent, Store, Truck } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { PageHead } from "@/desk/shell/PageHead";
import { fmt, useT } from "@/i18n";
import { settings as dict } from "@/i18n/dict/settings";
import { formatDateTime } from "@/lib/format";
import { saveSettings } from "@/store/actions/team";
import { useStore } from "@/store/core";
import { Button } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";
import { Input, Textarea } from "@/ui/Field";
import { RuleLine } from "@/ui/RuleLine";
import { Status } from "@/ui/Status";
import { Switch } from "@/ui/Switch";
import { toast } from "@/ui/Toast";
import "./people.css";
import "./settings.css";
import { checkSettings, draftOf, previewQuote, type SettingsDraft, type SettingsErrorKey } from "./rules";

const NOTIFY = ["notifyNewOrder", "notifyLowStock", "notifyInboxHigh", "notifyWatchdogFail"] as const;
type TextKey = Exclude<keyof SettingsDraft, "vatEnabled" | (typeof NOTIFY)[number]>;

export function SettingsScreen() {
  const t = useT(dict);
  const saved = useStore((s) => s.settings);
  const [base, setBase] = useState(saved);
  const [draft, setDraft] = useState<SettingsDraft>(() => draftOf(saved));
  const [tried, setTried] = useState(false);
  const [askVat, setAskVat] = useState(false);

  /* A save or Reset this demo brings the form back to what the store holds. */
  if (base !== saved) {
    setBase(saved);
    setDraft(draftOf(saved));
    setTried(false);
  }

  const { errors } = useMemo(() => checkSettings(draft), [draft]);
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(draftOf(saved)), [draft, saved]);
  const quote = useMemo(() => previewQuote(draft), [draft]);
  const set = <K extends keyof SettingsDraft>(key: K, value: SettingsDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const text = (key: TextKey) => {
    const code: SettingsErrorKey | undefined = tried ? errors[key] : undefined;
    return {
      value: draft[key],
      error: code ? t.errors[code] : null,
      onChange: (e: { target: { value: string } }) => set(key, e.target.value),
    };
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    const result = saveSettings(draft);
    toast(result.ok ? t.saved : t.fixFirst);
  };

  return (
    <div className="pp-page">
      <PageHead id="settings" title={t.title} rule={<RuleLine>{t.ruleLine}</RuleLine>} />
      <form onSubmit={onSubmit} noValidate>
        <div className="st-grid">
          <div className="st-col">
            <section className="pp-panel st-card" aria-labelledby="st-shop">
              <div className="pp-panel-head">
                <Store size={16} aria-hidden="true" />
                <h2 id="st-shop">{t.shopHead}</h2>
              </div>
              <div className="st-fields">
                <Input label={t.shopName} maxLength={80} {...text("shopName")} />
                <Input label={t.legalName} hint={t.legalHint} maxLength={120} {...text("legalName")} />
                <Textarea className="st-wide" label={t.address} rows={3} maxLength={300} {...text("address")} />
                <Input label={t.email} type="email" maxLength={120} {...text("email")} />
                <Input label={t.phone} maxLength={40} {...text("phone")} />
              </div>
            </section>

            <section className="pp-panel st-card" aria-labelledby="st-ship">
              <div className="pp-panel-head">
                <Truck size={16} aria-hidden="true" />
                <h2 id="st-ship">{t.shippingHead}</h2>
              </div>
              <div className="st-fields">
                <Input label={t.shipping} hint={t.shippingHint} inputMode="decimal" {...text("shipping")} />
                <Input label={t.freeFrom} hint={t.freeFromHint} inputMode="decimal" {...text("freeFrom")} />
                <Input label={t.lowStock} hint={t.lowStockHint} inputMode="numeric" {...text("lowStock")} />
                <Input label={t.hold} hint={t.holdHint} inputMode="numeric" {...text("hold")} />
                <Input className="st-wide" label={t.trackingLink} hint={t.trackingHint} maxLength={300} {...text("trackingLink")} />
              </div>
              {quote ? (
                <div className="st-quote pp-corner">
                  <h3>{t.quotesHead}</h3>
                  {quote.kind === "threshold" ? (
                    <>
                      <p>{fmt(t.quotePays, { below: quote.below, shipping: quote.shipping })}</p>
                      <p>{fmt(t.quoteFree, { from: quote.from })}</p>
                    </>
                  ) : (
                    <p>{quote.kind === "no_shipping" ? t.quoteNoShipping : t.quoteAllFree}</p>
                  )}
                  {quote.trackingExample ? <p className="st-track">{fmt(t.quoteTracking, { number: quote.trackingNumber, link: quote.trackingExample })}</p> : null}
                </div>
              ) : null}
            </section>
          </div>

          <div className="st-col">
            <section className="pp-panel st-card" aria-labelledby="st-vat">
              <div className="pp-panel-head">
                <Percent size={16} aria-hidden="true" />
                <h2 id="st-vat">{t.vatHead}</h2>
              </div>
              <div className="st-vat-row">
                <Status tone={draft.vatEnabled ? "ok" : "off"}>{draft.vatEnabled ? t.vatOn : t.vatOff}</Status>
                <Switch
                  aria-label={t.vatHead}
                  checked={draft.vatEnabled}
                  onChange={(e) => {
                    if (e.target.checked) setAskVat(true);
                    else set("vatEnabled", false);
                  }}
                />
              </div>
              <p className="type-small pp-muted pp-prose">{t.vatBody}</p>
              {draft.vatEnabled !== saved.vatEnabled ? (
                <p className="pp-box mt-3" data-tone="warn">
                  {t.vatPending}
                </p>
              ) : null}
            </section>

            <section className="pp-panel st-card" aria-labelledby="st-notify">
              <div className="pp-panel-head">
                <BellRing size={16} aria-hidden="true" />
                <h2 id="st-notify">{t.notifyHead}</h2>
              </div>
              <p className="type-small pp-muted">{t.notifyHint}</p>
              <ul className="st-notify">
                {NOTIFY.map((key) => (
                  <li key={key}>
                    <Switch label={t[key]} checked={draft[key]} onChange={(e) => set(key, e.target.checked)} />
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>

        <div className="st-foot" data-dirty={dirty || undefined}>
          <p className="type-small pp-muted">{fmt(t.lastChanged, { when: formatDateTime(saved.updatedAt), name: saved.updatedBy })}</p>
          <div className="st-foot-actions">
            {dirty ? <span className="st-unsaved">{t.unsaved}</span> : null}
            {dirty ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setDraft(draftOf(saved));
                  setTried(false);
                }}
              >
                {t.discard}
              </Button>
            ) : null}
            <Button type="submit" disabled={!dirty}>
              {t.save}
            </Button>
          </div>
        </div>
      </form>

      <Dialog
        open={askVat}
        onClose={() => setAskVat(false)}
        title={t.vatConfirmTitle}
        confirmLabel={t.vatConfirm}
        onConfirm={() => {
          set("vatEnabled", true);
          setAskVat(false);
        }}
      >
        <p className="type-body">{t.vatConfirmBody}</p>
      </Dialog>
    </div>
  );
}
