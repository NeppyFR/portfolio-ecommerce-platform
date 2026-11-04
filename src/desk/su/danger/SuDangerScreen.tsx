"use client";

import { Ban, LogOut, RotateCcw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PageHead } from "@/desk/shell/PageHead";
import { fmt, useT } from "@/i18n";
import { superuser as dict } from "@/i18n/dict/superuser";
import { previewDanger, resetDemo } from "@/store/actions/team";
import { useStore } from "@/store/core";
import { Button } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";
import { Input } from "@/ui/Field";
import { toast } from "@/ui/Toast";
import "@/desk/settings/people.css";
import { PhraseLine, SuCard } from "../parts";
import "../su.css";
import { DANGER_CARDS, DANGER_PHRASES, dangerCounts, phraseMatches, sessionOrders, shownRows, totalOf, type Counts, type DangerCard } from "./danger-rules";

type T = typeof dict.en;

const rowsFor = (card: DangerCard, t: T) => (card === "local" ? t.danger.localRows : card === "demo" ? t.danger.demoRows : t.danger.testRows);

function Numbers({ card, counts, t }: { card: DangerCard; counts: Counts; t: T }) {
  const labels = rowsFor(card, t);
  return (
    <dl className="pp-counts">
      {shownRows(counts).map(([key, n]) => (
        <div key={key} style={{ display: "contents" }}>
          <dt>{labels[key] ?? key}</dt>
          <dd>{n}</dd>
        </div>
      ))}
    </dl>
  );
}

function touchesOf(card: DangerCard, counts: Counts, t: T): string[] {
  const labels = rowsFor(card, t);
  const rows = shownRows(counts).map(([key]) => labels[key] ?? key);
  if (card === "local") return [...rows, t.danger.local.stock, t.danger.local.codes];
  if (card === "test") return [...rows, t.danger.test.side];
  return [...rows, t.danger.demo.kept];
}

const neverOf = (card: DangerCard, t: T): string => (card === "local" ? t.danger.local.never : card === "demo" ? t.danger.demo.never : t.danger.test.never);
const titleOf = (card: DangerCard, t: T): string => t.danger[card].title;

function DangerDialog({ card, onClose, t }: { card: DangerCard | null; onClose: () => void; t: T }) {
  const state = useStore((s) => s);
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<{ counts: Counts; total: number } | null>(null);
  const [last, setLast] = useState<DangerCard | null>(card);
  if (card !== last) {
    setLast(card);
    setTyped("");
    setResult(null);
  }
  const shown = card ?? last;
  const counts = useMemo(() => (shown ? dangerCounts(shown, state) : {}), [shown, state]);
  const phrase = shown ? DANGER_PHRASES[shown] : "";
  return (
    <Dialog
      open={card !== null}
      onClose={onClose}
      title={shown ? titleOf(shown, t) : ""}
      danger
      cancelLabel={result ? t.danger.dialog.close : t.danger.dialog.cancel}
      confirmLabel={result ? undefined : t.danger.dialog.confirm}
      confirmDisabled={!phraseMatches(typed, phrase)}
      onConfirm={
        result
          ? undefined
          : () => {
              if (!shown) return;
              const outcome = previewDanger(shown, typed);
              if (outcome.ok) {
                setResult(outcome.data);
                toast(t.danger.dialog.toast);
              } else toast(outcome.message);
            }
      }
    >
      {shown && result ? (
        <div className="su-result pp-corner" role="status">
          <b>{t.danger.dialog.result}</b>
          <p className="type-small">{fmt(t.danger.dialog.wouldZero, { total: result.total })}</p>
          <Numbers card={shown} counts={result.counts} t={t} />
        </div>
      ) : shown ? (
        <>
          <div className="su-dialog-lists">
            <div>
              <h3>{t.danger.dialog.touches}</h3>
              <ul>
                {touchesOf(shown, counts, t).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3>{t.danger.dialog.never}</h3>
              <p>{neverOf(shown, t)}</p>
            </div>
          </div>
          <PhraseLine template={t.danger.dialog.phrase} phrase={phrase} />
          <Input className="su-phrase-input" label={t.danger.dialog.phraseLabel} autoComplete="off" spellCheck={false} value={typed} data-danger-phrase="" onChange={(e) => setTyped(e.target.value)} />
          <p className="type-small su-faint">{t.danger.dialog.noPassword}</p>
        </>
      ) : null}
    </Dialog>
  );
}

export function SuDangerScreen() {
  const t = useT(dict);
  const state = useStore((s) => s);
  const [open, setOpen] = useState<DangerCard | null>(null);
  const [resetting, setResetting] = useState(false);
  const localNumbers = useMemo(() => sessionOrders(state).map((o) => o.orderNumber), [state]);

  return (
    <div className="pp-page">
      <PageHead id="su-danger" title={t.danger.title} />
      <p className="pp-box mb-5" data-tone="warn">
        <TriangleAlert size={15} aria-hidden="true" />
        <span>{fmt(t.danger.banner, { ns: t.namespace })}</span>
      </p>

      <div className="su-danger-grid">
        <div className="su-col">
          {DANGER_CARDS.map((card) => {
            const counts = dangerCounts(card, state);
            const total = totalOf(counts);
            return (
              <SuCard key={card} icon={TriangleAlert} tone="rose" title={titleOf(card, t)}>
                <div className="su-clean">
                  <div className="su-clean-text">
                    <p>{t.danger[card].text}</p>
                    {card === "local" ? <p className="su-amber">{t.danger.local.hint}</p> : null}
                    {card === "demo" ? <p className="su-faint">{t.danger.demo.reload}</p> : null}
                    {card === "test" ? <p className="su-faint">{t.danger.test.never}</p> : null}
                  </div>
                  <div className="su-clean-numbers">
                    <h3 className="type-mono-s su-faint">{t.danger.numbersHead}</h3>
                    {total > 0 ? <Numbers card={card} counts={counts} t={t} /> : <p className="type-small su-faint">{t.danger.local.none}</p>}
                    {card === "local" && localNumbers.length > 0 ? <p className="type-mono-s">{fmt(t.danger.local.numbers, { numbers: localNumbers.slice(0, 50).join(", ") })}</p> : null}
                  </div>
                  <div className="su-clean-foot">
                    <code className="pp-code">{DANGER_PHRASES[card]}</code>
                    <Button variant="danger" disabled={total === 0} data-danger-open={card} onClick={() => setOpen(card)}>
                      {t.danger.previewButton}
                    </Button>
                  </div>
                </div>
              </SuCard>
            );
          })}
        </div>

        <div className="su-col">
          <section className="pp-panel pp-corner su-card su-status-card">
            <header className="su-card-head">
              <span className="su-card-icon">
                <RotateCcw size={16} aria-hidden="true" />
              </span>
              <h2 className="type-h4">{t.danger.reset.title}</h2>
            </header>
            <p className="type-small">{t.danger.reset.text}</p>
            <div>
              <Button onClick={() => setResetting(true)}>{t.danger.reset.button}</Button>
            </div>
          </section>

          <SuCard icon={LogOut} title={t.danger.logout.title}>
            <p className="type-small">
              {t.danger.logout.text}{" "}
              <Link className="pp-link" href="/desk/system/security/?tab=access">
                {t.danger.logout.link}
              </Link>
            </p>
          </SuCard>

          <SuCard icon={Ban} title={t.danger.notOffered.title}>
            <ul className="su-list">
              {t.danger.notOffered.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </SuCard>
        </div>
      </div>

      <DangerDialog card={open} onClose={() => setOpen(null)} t={t} />
      <Dialog
        open={resetting}
        onClose={() => setResetting(false)}
        title={t.danger.reset.title}
        danger
        confirmLabel={t.danger.reset.button}
        onConfirm={() => {
          resetDemo();
          setResetting(false);
          toast(t.danger.reset.done);
        }}
      >
        <p className="type-body">{t.danger.reset.confirmBody}</p>
      </Dialog>
    </div>
  );
}
