"use client";

import { Camera, CalendarDays, CalendarClock, Check, CircleDashed, Clapperboard, Globe, Hourglass, Info, Mail, Megaphone, Pencil, Plus, Shapes, Store, Tag, UserRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CAMPAIGN_CHANNELS, CAMPAIGN_STATUSES, campaignTiming, upcomingCount, type CampaignTiming } from "@/desk/commerce/products/rules";
import { CheckList, emptyToNull, Pill, useOpenParam } from "@/desk/commerce/products/shared";
import { PageHead } from "@/desk/shell/PageHead";
import { fmt, plural, useLang, useT } from "@/i18n";
import { marketing as dict } from "@/i18n/dict/marketing";
import { discountState } from "@/lib/discount-rules";
import { formatDate } from "@/lib/format";
import { createCampaign, deleteCampaign, saveCampaign, type CampaignInput } from "@/store/actions/marketing";
import { DEMO_TODAY } from "@/store/clock";
import { useStore } from "@/store/core";
import type { Campaign, CampaignChannel, CampaignStatus, Discount, Person, Tone } from "@/store/types";
import { Button, DateInput, Dialog, Empty, IconButton, Input, Select, Sheet, Textarea, toast } from "@/ui";

type T = (typeof dict)["en"];

const CHANNEL_ICON: Record<CampaignChannel, LucideIcon> = { instagram: Camera, tiktok: Clapperboard, newsletter: Mail, website: Globe, in_person: Store, other: Shapes };

const TIMING_LOOK: Record<CampaignTiming, { tone: Tone | "plan"; icon: LucideIcon }> = {
  undated: { tone: "off", icon: CircleDashed },
  upcoming: { tone: "plan", icon: CalendarClock },
  running: { tone: "ok", icon: Check },
  past: { tone: "off", icon: Hourglass },
};

function datesText(c: Pick<Campaign, "startsOn" | "endsOn">, t: T): string {
  if (c.startsOn && c.endsOn) return c.startsOn === c.endsOn ? formatDate(c.startsOn) : `${formatDate(c.startsOn)} – ${formatDate(c.endsOn)}`;
  if (c.startsOn) return fmt(t.dates.from, { date: formatDate(c.startsOn) });
  if (c.endsOn) return fmt(t.dates.until, { date: formatDate(c.endsOn) });
  return t.dates.none;
}

function CampaignCard({ campaign, onOpen, t }: { campaign: Campaign; onOpen: () => void; t: T }) {
  const lang = useLang();
  const team = useStore((s) => s.team);
  const products = useStore((s) => s.products);
  const discounts = useStore((s) => s.discounts);
  const owner = team.find((m) => m.profile === campaign.owner);
  const discount = discounts.find((d) => d.id === campaign.discountId);
  const timing = campaignTiming(campaign.startsOn, campaign.endsOn, DEMO_TODAY);
  const look = TIMING_LOOK[timing];
  const ChannelIcon = CHANNEL_ICON[campaign.channel];
  const names = campaign.productIds.map((id) => products.find((p) => p.id === id)).filter((p) => p !== undefined).map((p) => (lang === "de" ? p.nameDe : p.nameEn));
  return (
    <article className="cat-camp" onClick={onOpen}>
      <div className="cat-camp-top">
        <span className="cat-prod-text">
          <span className="cat-name">{campaign.name}</span>
          <span className="type-small cat-channel">
            <ChannelIcon size={13} aria-hidden="true" />
            {t.channel[campaign.channel]}
          </span>
        </span>
        <IconButton
          aria-label={fmt(t.card.open, { name: campaign.name })}
          title={fmt(t.card.open, { name: campaign.name })}
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
        >
          <Pencil size={16} aria-hidden="true" />
        </IconButton>
      </div>
      <div className="cat-camp-row type-small">
        <CalendarDays size={14} aria-label={t.card.datesLabel} />
        <span className="cat-camp-dates">
          <span>{datesText(campaign, t)}</span>
          {timing === "undated" ? null : (
            <Pill tone={look.tone} icon={look.icon}>
              {t.timing[timing]}
            </Pill>
          )}
        </span>
      </div>
      <div className="cat-camp-row type-small">
        <UserRound size={14} aria-label={t.card.ownerLabel} />
        <span>{owner ? owner.name : t.card.noOwner}</span>
      </div>
      <div className="cat-camp-row type-small">
        <Tag size={14} aria-label={t.card.codeLabel} />
        {discount ? (
          <span>
            <Link className="cat-link cat-mono" href={`/desk/discounts/?q=${encodeURIComponent(discount.code)}`} onClick={(e) => e.stopPropagation()}>
              {discount.code}
            </Link>
            <span className="cat-sub"> · {t.codeState[discountState(discount, DEMO_TODAY)]}</span>
          </span>
        ) : (
          <span>{t.card.noCode}</span>
        )}
      </div>
      {names.length ? <p className="type-small cat-sub">{fmt(t.card.products, { names: names.join(", ") })}</p> : null}
      {campaign.notes ? <p className="type-small">{campaign.notes}</p> : null}
    </article>
  );
}

const blank: CampaignInput = { name: "", channel: "instagram", status: "draft", startsOn: null, endsOn: null, owner: null, discountId: null, productIds: [], notes: "" };
const inputOf = (c: Campaign): CampaignInput => ({ name: c.name, channel: c.channel, status: c.status, startsOn: c.startsOn, endsOn: c.endsOn, owner: c.owner, discountId: c.discountId, productIds: c.productIds, notes: c.notes });

function CampaignForm({ row, onDone, t }: { row: Campaign | null; onDone: () => void; t: T }) {
  const lang = useLang();
  const team = useStore((s) => s.team);
  const products = useStore((s) => s.products);
  const discounts = useStore((s) => s.discounts);
  const [value, setValue] = useState<CampaignInput>(row ? inputOf(row) : blank);
  const [problem, setProblem] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const submit = () => {
    const result = row ? saveCampaign(row.id, value) : createCampaign(value);
    if (!result.ok) {
      setProblem(result.code);
      return;
    }
    toast(row ? t.toast.saved : t.toast.planned);
    onDone();
  };
  const remove = () => {
    if (row && deleteCampaign(row.id).ok) toast(t.toast.deleted);
    setConfirming(false);
    onDone();
  };
  const codeOption = (d: Discount) => `${d.code} · ${t.codeState[discountState(d, DEMO_TODAY)]}`;
  return (
    <form
      className="cat-stack"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <p className="type-small cat-note">{t.editor.description}</p>
      <Input label={t.field.name} maxLength={120} value={value.name} error={problem === "name" ? t.error.name : null} onChange={(e) => setValue({ ...value, name: e.target.value })} />
      <div className="cat-fields">
        <Select label={t.field.channel} value={value.channel} onChange={(e) => setValue({ ...value, channel: e.target.value as CampaignChannel })}>
          {CAMPAIGN_CHANNELS.map((c) => (
            <option key={c} value={c}>
              {t.channel[c]}
            </option>
          ))}
        </Select>
        <Select label={t.field.status} value={value.status} onChange={(e) => setValue({ ...value, status: e.target.value as CampaignStatus })}>
          {CAMPAIGN_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t.status[s]}
            </option>
          ))}
        </Select>
        <DateInput label={t.field.starts} hint={t.field.optional} value={value.startsOn ?? ""} onChange={(e) => setValue({ ...value, startsOn: emptyToNull(e.target.value) })} />
        <DateInput label={t.field.ends} hint={t.field.optional} value={value.endsOn ?? ""} error={problem === "dates" ? t.error.dates : null} onChange={(e) => setValue({ ...value, endsOn: emptyToNull(e.target.value) })} />
        <Select label={t.field.owner} value={value.owner ?? ""} onChange={(e) => setValue({ ...value, owner: (e.target.value || null) as Person | null })}>
          <option value="">{t.owner.nobody}</option>
          {team.map((m) => (
            <option key={m.profile} value={m.profile}>
              {m.name}
              {m.isActive ? "" : t.owner.inactive}
            </option>
          ))}
        </Select>
        <Select label={t.field.code} value={value.discountId ?? ""} onChange={(e) => setValue({ ...value, discountId: e.target.value || null })}>
          <option value="">{t.discountNone}</option>
          {discounts.map((d) => (
            <option key={d.id} value={d.id}>
              {codeOption(d)}
            </option>
          ))}
        </Select>
      </div>
      <CheckList
        legend={fmt(t.products.legend, { count: value.productIds.length })}
        empty={t.products.empty}
        selected={value.productIds}
        onChange={(productIds) => setValue({ ...value, productIds })}
        items={products.map((p) => ({ id: p.id, label: `${lang === "de" ? p.nameDe : p.nameEn}${p.status === "draft" ? ` (${t.products.draft})` : p.status === "archived" ? ` (${t.products.archived})` : ""}` }))}
      />
      <Textarea label={t.field.notes} hint={t.field.notesMax} rows={3} maxLength={2000} value={value.notes} error={problem === "notes" ? t.error.notes : null} onChange={(e) => setValue({ ...value, notes: e.target.value })} />
      <div className="cat-actions cat-spread">
        <Button type="submit">{row ? t.save.changes : t.save.plan}</Button>
        {row ? (
          <Button variant="danger" onClick={() => setConfirming(true)}>
            {t.delete.open}
          </Button>
        ) : null}
      </div>
      <Dialog open={confirming} onClose={() => setConfirming(false)} title={row ? fmt(t.delete.title, { name: row.name }) : ""} cancelLabel={t.delete.back} confirmLabel={t.delete.confirm} danger onConfirm={remove}>
        <p className="type-body">{t.delete.description}</p>
      </Dialog>
    </form>
  );
}

export function MarketingScreen() {
  const t = useT(dict);
  const all = useStore((s) => s.campaigns);
  const [openId, setOpen] = useOpenParam();
  const editing = openId && openId !== "new" ? (all.find((c) => c.id === openId) ?? null) : null;
  const sheetOpen = openId === "new" || editing !== null;
  const upcoming = upcomingCount(all);
  return (
    <div className="cat-stack">
      <PageHead
        id="marketing"
        title={fmt(plural(upcoming, t.titleOne, t.title), { u: upcoming })}
        actions={
          <Button onClick={() => setOpen("new")}>
            <Plus size={16} aria-hidden="true" />
            {t.editor.new}
          </Button>
        }
      />
      <p className="cat-banner type-small">
        <Info size={16} aria-hidden="true" />
        <span>{t.banner}</span>
      </p>
      {all.length === 0 ? (
        <Empty icon={Megaphone}>{t.empty}</Empty>
      ) : (
        <div className="cat-board">
          {CAMPAIGN_STATUSES.map((status) => {
            const rows = all.filter((c) => c.status === status);
            return (
              <section key={status} className="cat-col" aria-label={t.status[status]}>
                <header className="cat-col-head">
                  <h2 className="type-h4">{t.status[status]}</h2>
                  <span className="type-mono-s cat-sub">{rows.length}</span>
                </header>
                {rows.length === 0 ? <p className="type-small cat-sub cat-col-empty">{t.columnEmpty[status]}</p> : rows.map((c) => <CampaignCard key={c.id} campaign={c} t={t} onOpen={() => setOpen(c.id)} />)}
              </section>
            );
          })}
        </div>
      )}
      <Sheet open={sheetOpen} onClose={() => setOpen(null)} title={editing ? fmt(t.editor.edit, { name: editing.name }) : t.editor.new}>
        {sheetOpen ? <CampaignForm key={editing?.id ?? "new"} row={editing} t={t} onDone={() => setOpen(null)} /> : null}
      </Sheet>
    </div>
  );
}
