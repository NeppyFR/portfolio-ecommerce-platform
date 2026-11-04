"use client";

import { Eye, History, Lock, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { Avatar } from "@/desk/shell/Avatar";
import { PageHead } from "@/desk/shell/PageHead";
import { fmt, plural, useLang, useT } from "@/i18n";
import { superuser as dict } from "@/i18n/dict/superuser";
import { addDays } from "@/lib/dates";
import { formatDate, formatStamp } from "@/lib/format";
import { TEAM } from "@/lib/brand";
import { resetAccess, saveAccess } from "@/store/actions/team";
import { DEMO_TODAY } from "@/store/clock";
import { useStore } from "@/store/core";
import type { Screen } from "@/desk/registry";
import type { AccessChange, FeatureSwitch, Person, SwitchableFeature } from "@/store/types";
import { Button } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";
import { DateInput } from "@/ui/Field";
import { Radio } from "@/ui/Radio";
import { RuleLine } from "@/ui/RuleLine";
import { Segmented } from "@/ui/Segmented";
import { Switch } from "@/ui/Switch";
import { toast } from "@/ui/Toast";
import "@/desk/settings/people.css";
import { FEATURE_ICONS, SuCard, useOwnerName } from "../parts";
import "../su.css";
import {
  cellKey, cellStatus, cellValue, changesOf, defaultOn, endDayBounds, endDayOk, FEATURE_GROUPS, hasSwitches, leavesNoPages, MONEY_FEATURES, PERSONAL_FEATURES,
  previewDiff, previewRail, resetEffects, stage, SWITCH_PROFILES, type CellStatus, type Change, type Ends, type Staged,
} from "./access-model";

type T = typeof dict.en;

const labelOf = (profile: Person) => TEAM.find((m) => m.profile === profile)?.profileLabel ?? profile;

function statusWord(status: CellStatus, t: T): string {
  if (status.kind === "staged") return t.cell.staged;
  if (status.kind === "until") return fmt(t.cell.until, { day: formatDate(status.day as string) });
  if (status.kind === "ended") return fmt(t.cell.ended, { day: formatDate(status.day as string) });
  return status.kind === "changed" ? t.cell.changed : t.cell.default;
}

function FeatureCell({ feature, t, owner }: { feature: SwitchableFeature; t: T; owner: string }) {
  const Icon = FEATURE_ICONS[feature];
  return (
    <div className="su-feature">
      <Icon size={16} aria-hidden="true" />
      <div className="su-feature-name">
        <span>{t.features[feature].name}</span>
        {MONEY_FEATURES.includes(feature) ? <span className="su-tag">{t.tagMoney}</span> : null}
        {PERSONAL_FEATURES.includes(feature) ? <span className="su-tag">{t.tagPersonal}</span> : null}
      </div>
      <p className="su-feature-what">{fmt(t.features[feature].what, { owner })}</p>
    </div>
  );
}

type CellProps = { profile: Person; feature: SwitchableFeature; name: string; staged: Staged; switches: FeatureSwitch[]; onToggle: (profile: Person, feature: SwitchableFeature, value: boolean) => void; t: T };

function Toggle({ profile, feature, name, staged, switches, onToggle, t }: CellProps) {
  const status = cellStatus(staged, profile, feature, switches, DEMO_TODAY);
  const word = statusWord(status, t);
  const fallback = fmt(t.matrix.defaultIs, { value: defaultOn(profile, feature) ? t.matrix.on : t.matrix.off });
  return (
    <>
      <Switch aria-label={fmt(t.matrix.toggle, { feature: t.features[feature].name, name })} title={fallback} checked={cellValue(staged, profile, feature, switches, DEMO_TODAY)} onChange={(e) => onToggle(profile, feature, e.target.checked)} />
      <span className="su-cell-status" data-kind={status.kind}>
        {word}
      </span>
    </>
  );
}

/** The sidebar, drawn inert with the staged cells. It replaces any view-as mode, which is deliberately not offered. */
function Rail({ profile, staged, switches, t }: { profile: Person; staged: Staged; switches: FeatureSwitch[]; t: T }) {
  const lang = useLang();
  const groups = useMemo(() => previewRail(profile, staged, switches, DEMO_TODAY), [profile, staged, switches]);
  const diff = useMemo(() => previewDiff(profile, staged, switches, DEMO_TODAY), [profile, staged, switches]);
  const all = groups.flatMap((g) => g.screens).filter(({ screen }) => screen.id !== "dashboard");
  const open = all.filter((s) => s.open).length;
  const label = (screen: Screen) => (screen.id === "dashboard" ? t.preview.dashboard : screen.id === "ledger" ? t.features.finances.name : screen.id === "system" ? t.preview.it : screen[lang]);
  return (
    <div className="su-preview">
      <div className="su-mini" role="group" aria-label={t.preview.railLabel}>
        {groups.map((group) => (
          <div key={group.id} className="su-mini-group">
            {group.id === "shop" ? null : <p className="su-mini-head">{t.preview.groups[group.id]}</p>}
            <ul>
              {group.screens.map(({ screen, open: isOpen }) => {
                const Icon = screen.icon;
                return (
                  <li key={screen.id} className="su-mini-item" data-open={isOpen} data-home={screen.id === "dashboard" || undefined}>
                    <Icon size={15} aria-hidden="true" />
                    <span>{label(screen)}</span>
                    {isOpen ? null : <Lock size={12} role="img" aria-label={t.preview.lockedWord} />}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <div className="su-preview-side">
        <p className="type-small su-faint">{t.preview.lead}</p>
        <p className="su-preview-count" aria-live="polite">
          {open === 0 ? t.preview.noPages : fmt(t.preview.count, { open, total: all.length })}
        </p>
        {diff.gains.length === 0 && diff.loses.length === 0 ? (
          <p className="type-small su-faint">{t.preview.sameAsDefault}</p>
        ) : (
          <div className="su-preview-diff">
            <p className="type-small su-faint">{t.preview.fromDefault}</p>
            <div className="pp-chips">
              {diff.gains.map((f) => (
                <span key={f} className="pp-chip">
                  {fmt(t.access.on, { feature: t.features[f].name })}
                </span>
              ))}
              {diff.loses.map((f) => (
                <span key={f} className="pp-chip">
                  {fmt(t.access.off, { feature: t.features[f].name })}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function historyLine(row: AccessChange, name: string, t: T): string {
  if (row.kind === "reset" || row.feature === null) return fmt(t.history.reset, { name });
  const word = fmt(row.on ? t.history.on : t.history.off, { feature: t.features[row.feature].name });
  return row.until ? `${word} ${fmt(t.history.until, { day: formatDate(row.until) })}` : word;
}

function ReviewDialog({ open, changes, staged, switches, nameOf, onClose, onSaved, t }: { open: boolean; changes: Change[]; staged: Staged; switches: FeatureSwitch[]; nameOf: (p: Person) => string; onClose: () => void; onSaved: () => void; t: T }) {
  const [ends, setEnds] = useState<Ends>({});
  const bounds = endDayBounds(DEMO_TODAY);
  const badDay = changes.some((c) => {
    const end = ends[c.key];
    return c.canEnd && end !== undefined && end !== null && !endDayOk(end, DEMO_TODAY);
  });
  const profiles = [...new Set(changes.map((c) => c.profile))];
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t.review.title}
      cancelLabel={t.review.cancel}
      confirmLabel={fmt(plural(changes.length, t.review.saveOne, t.review.saveOther), { count: changes.length })}
      confirmDisabled={badDay || changes.length === 0}
      onConfirm={() => {
        const result = saveAccess(staged, ends);
        if (result.ok) {
          toast(t.review.saved);
          setEnds({});
          onSaved();
        } else toast(result.message);
      }}
    >
      <p className="type-small su-faint">{fmt(t.review.count, { count: fmt(plural(changes.length, t.bar.one, t.bar.other), { count: changes.length }) })}</p>
      <div className="su-review">
        {changes.map((c) => {
          const feature = t.features[c.feature].name;
          const name = nameOf(c.profile);
          const end = ends[c.key] ?? null;
          return (
            <div key={c.key} className="su-change">
              <p className="su-change-line">
                {fmt(c.on ? t.review.grant : t.review.revoke, { name, feature })}
                {c.toDefault && end === null ? <span> {t.review.isDefault}</span> : null}
              </p>
              {c.canEnd ? (
                <div className="su-until">
                  <Radio name={`end-${c.key}`} label={t.review.untilChange} checked={end === null} onChange={() => setEnds((e) => ({ ...e, [c.key]: null }))} />
                  <Radio name={`end-${c.key}`} label={t.review.untilDay} checked={end !== null} onChange={() => setEnds((e) => ({ ...e, [c.key]: addDays(DEMO_TODAY, 7) }))} />
                  {end !== null ? (
                    <DateInput
                      label={fmt(t.review.day, { feature })}
                      min={bounds.min}
                      max={bounds.max}
                      value={end}
                      error={endDayOk(end, DEMO_TODAY) ? null : t.review.dayError}
                      onChange={(e) => setEnds((all) => ({ ...all, [c.key]: e.target.value }))}
                    />
                  ) : null}
                </div>
              ) : null}
              {c.on && MONEY_FEATURES.includes(c.feature) ? (
                <p className="pp-box" data-tone="warn">
                  {fmt(t.review.money, { name })}
                </p>
              ) : null}
              {c.on && PERSONAL_FEATURES.includes(c.feature) ? (
                <p className="pp-box" data-tone="warn">
                  {fmt(t.review.personal, { name })}
                </p>
              ) : null}
            </div>
          );
        })}
        {profiles
          .filter((p) => leavesNoPages(p, staged, switches, DEMO_TODAY))
          .map((p) => (
            <p key={p} className="pp-box" data-tone="warn">
              {fmt(t.review.noPages, { name: nameOf(p) })}
            </p>
          ))}
      </div>
    </Dialog>
  );
}

function ResetDialog({ profile, switches, nameOf, onClose, onDone, t }: { profile: Person | null; switches: FeatureSwitch[]; nameOf: (p: Person) => string; onClose: () => void; onDone: (p: Person) => void; t: T }) {
  const name = profile ? nameOf(profile) : "";
  const effects = profile ? resetEffects(profile, switches, DEMO_TODAY) : { on: [], off: [] };
  const names = (list: SwitchableFeature[]) => list.map((f) => t.features[f].name).join(", ");
  return (
    <Dialog
      open={profile !== null}
      onClose={onClose}
      title={fmt(t.reset.title, { name })}
      confirmLabel={t.reset.confirm}
      cancelLabel={t.review.cancel}
      onConfirm={() => {
        if (!profile) return;
        const result = resetAccess(profile);
        if (result.ok) {
          toast(fmt(t.reset.done, { name }));
          onDone(profile);
        } else toast(result.message);
      }}
    >
      <p className="type-body">{fmt(profile === "owner" ? t.reset.bodyAllOn : t.reset.body, { name })}</p>
      {effects.on.length ? (
        <p className="pp-box" data-tone="warn">
          {fmt(t.reset.switchesOn, { features: names(effects.on) })}
        </p>
      ) : null}
      {effects.off.length ? <p className="type-small su-faint">{fmt(t.reset.switchesOff, { features: names(effects.off) })}</p> : null}
    </Dialog>
  );
}

export function SuAccessScreen() {
  const t = useT(dict);
  const owner = useOwnerName();
  const team = useStore((s) => s.team);
  const switches = useStore((s) => s.featureSwitches);
  const history = useStore((s) => s.accessHistory);
  const [staged, setStaged] = useState<Staged>({});
  const [selected, setSelected] = useState<Person>("finance");
  const [reviewing, setReviewing] = useState(false);
  const [resetting, setResetting] = useState<Person | null>(null);

  const nameOf = (profile: Person) => team.find((m) => m.profile === profile)?.name ?? profile;
  const changes = useMemo(() => changesOf(staged, switches, DEMO_TODAY), [staged, switches]);
  const onToggle = (profile: Person, feature: SwitchableFeature, value: boolean) => setStaged((current) => stage(current, profile, feature, value, switches, DEMO_TODAY));
  const options = SWITCH_PROFILES.map((p) => ({ value: p, label: labelOf(p) }));

  return (
    <div className="pp-page">
      <PageHead id="su-access" title={t.matrix.title} rule={<RuleLine>{t.matrix.rule}</RuleLine>} />

      <div className="su-matrix-wrap pp-panel">
        <div className="su-matrix-scroll" tabIndex={0} role="region" aria-label={t.matrix.label}>
          <table className="su-matrix">
            <caption className="sr-only">{t.matrix.label}</caption>
            <thead>
              <tr>
                <th scope="col">{t.matrix.feature}</th>
                {SWITCH_PROFILES.map((p) => (
                  <th key={p} scope="col">
                    <span className="su-matrix-person">
                      <Avatar profile={p} />
                      <span>
                        <b>{nameOf(p)}</b>
                        <span className="su-matrix-label">{labelOf(p)}</span>
                      </span>
                    </span>
                  </th>
                ))}
                <th scope="col">
                  <span className="su-matrix-person">
                    <Avatar profile="superUser" />
                    <b>superUser</b>
                  </span>
                </th>
              </tr>
            </thead>
            {FEATURE_GROUPS.map((group) => (
              <tbody key={group.id}>
                <tr>
                  <th scope="colgroup" colSpan={6}>
                    <span className="su-matrix-group">{t.groups[group.id]}</span>
                  </th>
                </tr>
                {group.features.map((feature) => (
                  <tr key={feature}>
                    <th scope="row">
                      <FeatureCell feature={feature} t={t} owner={owner} />
                    </th>
                    {SWITCH_PROFILES.map((p) => (
                      <td key={p} data-staged={cellKey(p, feature) in staged || undefined}>
                        <Toggle profile={p} feature={feature} name={nameOf(p)} staged={staged} switches={switches} onToggle={onToggle} t={t} />
                      </td>
                    ))}
                    <td className="su-always">{t.matrix.always}</td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
        <p className="su-fixed-row">
          <Lock size={14} aria-hidden="true" />
          {fmt(t.matrix.fixedRow, { owner })}
        </p>
      </div>

      <div className="su-phone">
        <div className="su-phone-top">
          <p className="type-small su-faint">{t.matrix.phoneHint}</p>
          <Segmented aria-label={t.matrix.profile} options={options} value={selected} onChange={setSelected} />
        </div>
        {FEATURE_GROUPS.map((group) => (
          <div key={group.id}>
            <p className="su-plist-head">{t.groups[group.id]}</p>
            <ul className="su-plist">
              {group.features.map((feature) => (
                <li key={feature} className="su-plist-row" data-staged={cellKey(selected, feature) in staged || undefined}>
                  <FeatureCell feature={feature} t={t} owner={owner} />
                  <div className="su-plist-switch">
                    <Toggle profile={selected} feature={feature} name={nameOf(selected)} staged={staged} switches={switches} onToggle={onToggle} t={t} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p className="su-fixed-row">
          <Lock size={14} aria-hidden="true" />
          {fmt(t.matrix.fixedRow, { owner })}
        </p>
      </div>

      <div className="su-below">
        <SuCard
          icon={Eye}
          title={fmt(t.preview.title, { name: nameOf(selected) })}
          aside={<Segmented aria-label={t.matrix.profile} options={options} value={selected} onChange={setSelected} />}
        >
          <Rail profile={selected} staged={staged} switches={switches} t={t} />
        </SuCard>
        <div className="su-col">
          <SuCard icon={Lock} title={fmt(t.fullOnly.title, { owner })}>
            <ul className="su-list">
              <li>{t.fullOnly.erase}</li>
              <li>{t.fullOnly.drops}</li>
              <li>{t.fullOnly.costs}</li>
              <li>{t.fullOnly.exports}</li>
            </ul>
            <p className="su-note">{fmt(t.fullOnly.note, { owner })}</p>
          </SuCard>
          <SuCard icon={RotateCcw} title={t.reset.head}>
            <div className="su-resets">
              {SWITCH_PROFILES.map((p) => (
                <Button key={p} variant="outline" disabled={!hasSwitches(p, switches)} onClick={() => setResetting(p)}>
                  {fmt(t.reset.button, { name: nameOf(p) })}
                </Button>
              ))}
            </div>
          </SuCard>
        </div>
      </div>

      <SuCard icon={History} title={t.history.title}>
        {history.length === 0 ? (
          <p className="type-small su-faint">{t.history.none}</p>
        ) : (
          <ul className="su-history">
            {history.slice(0, 20).map((row) => (
              <li key={row.id}>
                <b>{nameOf(row.profile)}:</b> {historyLine(row, nameOf(row.profile), t)}
                <span className="su-history-meta">
                  {formatStamp(row.at)} · {row.actor}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SuCard>

      {changes.length > 0 ? (
        <div className="su-bar" role="region" aria-label={t.bar.label}>
          <p className="su-bar-count" aria-live="polite">
            {fmt(plural(changes.length, t.bar.one, t.bar.other), { count: changes.length })}
          </p>
          <div className="su-bar-actions">
            <Button variant="ghost" onClick={() => setStaged({})}>
              {t.bar.discard}
            </Button>
            <Button onClick={() => setReviewing(true)}>{t.bar.review}</Button>
          </div>
        </div>
      ) : null}

      <ReviewDialog
        open={reviewing}
        changes={changes}
        staged={staged}
        switches={switches}
        nameOf={nameOf}
        t={t}
        onClose={() => setReviewing(false)}
        onSaved={() => {
          setStaged({});
          setReviewing(false);
        }}
      />
      <ResetDialog
        profile={resetting}
        switches={switches}
        nameOf={nameOf}
        t={t}
        onClose={() => setResetting(null)}
        onDone={(p) => {
          setStaged((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(`${p}:`))));
          setResetting(null);
        }}
      />
    </div>
  );
}
