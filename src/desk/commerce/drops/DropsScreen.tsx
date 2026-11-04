"use client";

import { Plus, Rocket } from "lucide-react";
import { useMemo, useState } from "react";
import { compareDrops, launchMs, nextLaunch } from "@/desk/commerce/products/rules";
import { GarmentThumb, useOpenParam } from "@/desk/commerce/products/shared";
import { PageHead } from "@/desk/shell/PageHead";
import { fmt, plural, useT } from "@/i18n";
import { drops as dict } from "@/i18n/dict/drops";
import { useStore } from "@/store/core";
import type { Drop } from "@/store/types";
import { Button, Empty, RuleLine } from "@/ui";
import { DropFormDialog, DropSheet } from "./DropSheet";
import { countdownLine, DropStatusPill, launchLine, timeText, useDemoClock } from "./parts";

/** Unequal card widths, repeating: narrow and wide, then wide and narrow. Rows always add up to twelve. */
const SPANS = ["cat-drop-3", "cat-drop-4", "cat-drop-1", "cat-drop-2"];

function DropCard({ drop, index, featured, ms, onOpen }: { drop: Drop; index: number; featured: boolean; ms: number; onOpen: () => void }) {
  const t = useT(dict);
  const products = useStore((s) => s.products);
  const taskLists = useStore((s) => s.taskLists);
  const tasks = useStore((s) => s.tasks);
  const files = useStore((s) => s.files);
  const garments = useMemo(() => drop.productIds.map((id) => products.find((p) => p.id === id)).filter((p) => p !== undefined), [drop.productIds, products]);
  const counts = useMemo(() => {
    const listIds = new Set(taskLists.filter((l) => l.dropId === drop.id).map((l) => l.id));
    const mine = tasks.filter((x) => listIds.has(x.listId) || x.dropId === drop.id);
    return {
      done: mine.filter((x) => x.doneAt).length,
      total: mine.length,
      files: files.filter((f) => f.dropId === drop.id && !f.trashedAt).length,
      waiting: drop.waitlist.filter((w) => !w.notifiedAt).length,
    };
  }, [drop, taskLists, tasks, files]);
  const line = countdownLine(drop, ms, t);
  const at = launchMs(drop);
  return (
    <button
      type="button"
      className={`cat-drop ${SPANS[index % SPANS.length]}`}
      data-live={drop.status === "live" || undefined}
      data-archived={drop.status === "archived" || undefined}
      data-featured={featured || undefined}
      aria-label={fmt(t.card.open, { name: drop.name })}
      onClick={onOpen}
    >
      <span className="cat-drop-top">
        <span className="cat-prod-text">
          <span className="cat-drop-name">{drop.name}</span>
          {drop.season ? <span className="type-mono-s cat-season">{drop.season}</span> : null}
        </span>
        <DropStatusPill status={drop.status} t={t} />
      </span>
      {garments.length ? (
        <span className="cat-drop-garments" aria-hidden="true">
          {garments.slice(0, 5).map((p) => (
            <GarmentThumb key={p.id} type={p.garment} tone={p.tone} printed={p.printedName || undefined} />
          ))}
        </span>
      ) : null}
      <span className="cat-drop-count">
        {featured && at !== null ? <span className="cat-drop-clock">{timeText(ms, at, t)}</span> : null}
        <span className="type-small">{launchLine(drop, ms, t)}</span>
        {line && !featured ? <span className="type-mono-s cat-sub">{line}</span> : null}
      </span>
      {counts.total > 0 ? (
        <span className="cat-drop-progress">
          <span className="cat-progress" aria-hidden="true">
            <span style={{ width: `${Math.round((counts.done / counts.total) * 100)}%` }} />
          </span>
          <span className="type-small">{fmt(t.card.tasks, { done: counts.done, total: counts.total })}</span>
        </span>
      ) : null}
      <span className="cat-drop-foot type-small">
        <span>{fmt(plural(drop.productIds.length, t.card.productsOne, t.card.products), { n: drop.productIds.length })}</span>
        <span>{fmt(plural(counts.files, t.card.filesOne, t.card.files), { n: counts.files })}</span>
        {counts.waiting > 0 ? <span>{fmt(t.card.waiting, { n: counts.waiting })}</span> : null}
      </span>
    </button>
  );
}

export function DropsScreen() {
  const t = useT(dict);
  const all = useStore((s) => s.drops);
  const [openId, setOpen] = useOpenParam();
  const [creating, setCreating] = useState(false);
  const ms = useDemoClock();
  const rows = useMemo(() => all.slice().sort(compareDrops), [all]);
  const next = useMemo(() => nextLaunch(all, ms), [all, ms]);
  const title = next ? fmt(t.title, { name: next.name, t: timeText(ms, launchMs(next) as number, t) }).replace(/\.\.$/, ".") : t.titleNone;
  return (
    <div className="cat-stack">
      <PageHead
        id="drops"
        title={title}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus size={16} aria-hidden="true" />
            {t.new}
          </Button>
        }
        rule={<RuleLine>{t.rule}</RuleLine>}
      />
      {rows.length === 0 ? (
        <Empty icon={Rocket}>{t.empty}</Empty>
      ) : (
        <div className="cat-drops">
          {rows.map((drop, i) => (
            <DropCard key={drop.id} drop={drop} index={i} featured={next?.id === drop.id} ms={ms} onOpen={() => setOpen(drop.id)} />
          ))}
        </div>
      )}
      {rows.length ? <p className="type-small cat-sub cat-intro">{t.intro}</p> : null}
      <DropSheet openId={openId} ms={ms} onClose={() => setOpen(null)} />
      <DropFormDialog open={creating} drop={null} onClose={() => setCreating(false)} onCreated={(id) => setOpen(id)} />
    </div>
  );
}
