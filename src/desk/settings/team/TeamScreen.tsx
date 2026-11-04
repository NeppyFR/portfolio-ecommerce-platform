"use client";

import { Lock, Pencil } from "lucide-react";
import { useMemo, useState } from "react";
import { Avatar } from "@/desk/shell/Avatar";
import { PageHead } from "@/desk/shell/PageHead";
import { fmt, useLang, useT } from "@/i18n";
import { settings as dict } from "@/i18n/dict/settings";
import { canAccess, SWITCHABLE_FEATURES } from "@/lib/features";
import { formatDateTime } from "@/lib/format";
import { SUPER_USER } from "@/lib/brand";
import { saveMember, switchLock } from "@/store/actions/team";
import { useStore } from "@/store/core";
import type { Person, Profile, StaffMember, Tier } from "@/store/types";
import { Button } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";
import { Input } from "@/ui/Field";
import { RuleLine } from "@/ui/RuleLine";
import { Status } from "@/ui/Status";
import { Switch } from "@/ui/Switch";
import { toast } from "@/ui/Toast";
import "../people.css";
import "../settings.css";
import { checkMember, type MemberDraft } from "../rules";

type T = typeof dict.en;

const TIER_WORD = { full: "tierFull", partner: "tierPartner", super: "tierSuper" } as const satisfies Record<Tier, keyof T["team"]>;

function draftFrom(member: StaffMember, lang: "en" | "de"): MemberDraft {
  return { name: member.name, initials: member.initials, role: lang === "de" ? member.roleDe : member.roleEn, isActive: member.isActive };
}

function EditDialog({ member, viewer, team, onClose, t }: { member: StaffMember | null; viewer: Profile; team: StaffMember[]; onClose: () => void; t: T }) {
  const lang = useLang();
  const [draft, setDraft] = useState<MemberDraft | null>(null);
  const [lastProfile, setLastProfile] = useState<Person | null>(null);
  const profile = member?.profile ?? null;
  if (profile !== lastProfile) {
    setLastProfile(profile);
    setDraft(member ? draftFrom(member, lang) : null);
  }
  const current = draft ?? (member ? draftFrom(member, lang) : null);
  const errors = useMemo(() => (current ? checkMember(current) : {}), [current]);
  const lock = member ? switchLock(member.profile, viewer, team) : null;
  const lockWord = lock === "self" ? t.team.lockSelf : lock === "last" ? t.team.lockLast : lock === "fixed" ? t.team.lockFixed : lock === "full_switch" ? fmt(t.team.lockFull, { name: member?.name ?? "" }) : null;
  const invalid = Object.keys(errors).length > 0;
  const errorOf = (key: "name" | "initials" | "role") => {
    const code = errors[key];
    return code ? t.team.errors[code] : null;
  };

  return (
    <Dialog
      open={member !== null}
      onClose={onClose}
      title={member ? fmt(t.team.editName, { name: member.name }) : ""}
      cancelLabel={t.team.back}
      confirmLabel={t.team.save}
      confirmDisabled={invalid}
      onConfirm={() => {
        if (!member || !current) return;
        const result = saveMember(member.profile, current);
        if (result.ok) {
          toast(fmt(t.team.saved, { name: result.data.name }));
          onClose();
        } else toast(result.message);
      }}
    >
      {member && current ? (
        <div className="tm-form">
          <p className="type-small pp-muted">{fmt(t.team.signInName, { slug: member.profile })}</p>
          <div className="tm-form-two">
            <Input label={t.team.name} maxLength={60} value={current.name} error={errorOf("name")} onChange={(e) => setDraft({ ...current, name: e.target.value })} />
            <Input label={t.team.initials} maxLength={2} value={current.initials} error={errorOf("initials")} onChange={(e) => setDraft({ ...current, initials: e.target.value.toUpperCase() })} />
          </div>
          <Input label={t.team.role} maxLength={80} value={current.role} error={errorOf("role")} onChange={(e) => setDraft({ ...current, role: e.target.value })} />
          <Switch label={current.isActive ? t.team.canSignIn : t.team.cannotSignIn} checked={current.isActive} disabled={lock !== null} onChange={(e) => setDraft({ ...current, isActive: e.target.checked })} />
          {lockWord ? (
            <p className="tm-lock">
              <Lock size={14} aria-hidden="true" />
              {lockWord}
            </p>
          ) : null}
          {member.isActive && !current.isActive ? (
            <p className="pp-box" data-tone="warn">
              {t.team.offWarning}
            </p>
          ) : null}
        </div>
      ) : null}
    </Dialog>
  );
}

export function TeamScreen() {
  const t = useT(dict);
  const lang = useLang();
  const team = useStore((s) => s.team);
  const viewer = useStore((s) => s.profile);
  const switches = useStore((s) => s.featureSwitches);
  const signIns = useStore((s) => s.signIns);
  const [editing, setEditing] = useState<Person | null>(null);

  const active = team.filter((m) => m.isActive).length;
  const superSignIn = useMemo(() => signIns.find((a) => a.profile === SUPER_USER.profile && a.outcome === "success")?.at ?? null, [signIns]);
  const member = team.find((m) => m.profile === editing) ?? null;
  const featureWord = (profile: Person) => {
    const n = SWITCHABLE_FEATURES.filter((f) => canAccess(profile, f, switches)).length;
    return n === SWITCHABLE_FEATURES.length ? t.team.canOpenAll : fmt(t.team.canOpen, { n, total: SWITCHABLE_FEATURES.length });
  };
  const tier = (profile: Person): Tier => (profile === "owner" ? "full" : "partner");

  return (
    <div className="pp-page">
      <PageHead id="team" title={fmt(active === team.length ? t.team.titleAll : t.team.title, { n: active, total: team.length })} rule={<RuleLine>{t.team.ruleLine}</RuleLine>} />
      <p className="tm-intro type-body pp-prose">{t.team.intro}</p>

      <ul className="tm-list" aria-label={t.team.listLabel}>
        {team.map((m) => {
          const role = lang === "de" ? m.roleDe : m.roleEn;
          const me = m.profile === viewer;
          return (
            <li key={m.profile} className="tm-row">
              <span className="pp-avatar" data-me={me || undefined} data-off={m.isActive ? undefined : true}>
                <Avatar profile={m.profile} size="lg" />
              </span>
              <div>
                <p className="tm-name">
                  {m.name}
                  {me ? <span className="pp-chip">{t.team.you}</span> : null}
                </p>
                <p className="tm-role">{role || t.team.noRole}</p>
              </div>
              <p className="tm-meta">
                <span>{m.lastSignInAt ? fmt(t.team.lastSignIn, { when: formatDateTime(m.lastSignInAt) }) : t.team.neverSignedIn}</span>
                <span>
                  {t.team[TIER_WORD[tier(m.profile)]]} · {featureWord(m.profile)}
                </span>
              </p>
              <span className="tm-status">
                <Status tone={m.isActive ? "ok" : "off"}>{m.isActive ? t.team.active : t.team.inactive}</Status>
              </span>
              <span className="tm-action">
                <Button variant="ghost" aria-label={fmt(t.team.editName, { name: m.name })} onClick={() => setEditing(m.profile)}>
                  <Pencil size={14} aria-hidden="true" /> {t.team.edit}
                </Button>
              </span>
            </li>
          );
        })}
        <li className="tm-row" data-super="">
          <span className="pp-avatar" data-me={viewer === SUPER_USER.profile || undefined}>
            <Avatar profile={SUPER_USER.profile} size="lg" />
          </span>
          <div>
            <p className="tm-name">
              {SUPER_USER.name}
              {viewer === SUPER_USER.profile ? <span className="pp-chip">{t.team.you}</span> : null}
            </p>
            <p className="tm-role">{t.team.superRole}</p>
          </div>
          <p className="tm-meta">
            <span>{superSignIn ? fmt(t.team.lastSignIn, { when: formatDateTime(superSignIn) }) : t.team.neverSignedIn}</span>
            <span>
              {t.team.tierSuper} · {t.team.canOpenAll}
            </span>
          </p>
          <span className="tm-status">
            <Status tone="ok">{t.team.active}</Status>
          </span>
          <span className="tm-action tm-fixed">
            <Lock size={14} aria-hidden="true" /> {t.team.lockFixedRow}
          </span>
        </li>
      </ul>

      <EditDialog member={member} viewer={viewer} team={team} t={t} onClose={() => setEditing(null)} />
    </div>
  );
}
