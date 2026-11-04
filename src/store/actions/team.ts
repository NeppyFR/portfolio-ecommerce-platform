import { checkMember, checkSettings, type MemberDraft, type SettingsDraft } from "@/desk/settings/rules";
import { changesOf, endDayOk, finalSwitches, type Ends, type Staged } from "@/desk/su/access/access-model";
import { DANGER_PHRASES, dangerCounts, phraseMatches, totalOf, type Counts, type DangerCard } from "@/desk/su/danger/danger-rules";
import { teamLock } from "@/lib/security-rules";
import { DEMO_TODAY, now } from "@/store/clock";
import { getState, registerReset, resetStore, update } from "@/store/core";
import { actorName, logActivity } from "@/store/flows";
import type { AccessChange, ActionResult, FeatureSwitch, Person, Profile, StaffMember, SwitchableFeature } from "@/store/types";

const SUPER_ONLY = { ok: false as const, code: "forbidden", message: "Only superUser can do this." };

const capital = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);
/** The log's wording, in the same shape as the seeded rows: "Studio: Inbox on". */
export const accessDetail = (profile: Person, feature: SwitchableFeature, on: boolean, until?: string | null): string =>
  `${capital(profile)}: ${feature === "tasks" ? "Checklist" : capital(feature)} ${on ? "on" : "off"}${until ? ` until ${until}` : ""}`;

let changeId = 1;
registerReset(() => {
  changeId = 1;
});
const changeRow = (row: Omit<AccessChange, "id" | "at" | "actor">): AccessChange => ({ id: `acc_new_${changeId++}`, at: now(), actor: actorName(), ...row });

/* Settings */

export function saveSettings(draft: SettingsDraft): ActionResult {
  const { patch } = checkSettings(draft);
  if (!patch) return { ok: false, code: "invalid", message: "Some settings need another look." };
  update((s) => ({ ...s, settings: { ...s.settings, ...patch, updatedAt: now(), updatedBy: actorName(s) } }));
  logActivity({ area: "settings", action: "settings.update", detail: "Saved the settings" });
  return { ok: true, data: undefined };
}

/* Team */

export function activeCount(team: StaffMember[]): number {
  return team.filter((m) => m.isActive).length;
}

/** Why the on/off switch of this profile is locked for the profile in use, or null. */
export function switchLock(target: Profile, viewer: Profile, team: StaffMember[]) {
  const member = team.find((m) => m.profile === target);
  return teamLock({ target, viewer, activeCount: activeCount(team), targetActive: member?.isActive ?? true });
}

/** Switching someone off ends their sessions at once. The sign-in name never changes, because it is the profile key. */
export function saveMember(profile: Person, draft: MemberDraft): ActionResult<{ name: string }> {
  const s = getState();
  const member = s.team.find((m) => m.profile === profile);
  if (!member) return { ok: false, code: "fixed", message: "superUser is a fixed profile." };
  if (Object.keys(checkMember(draft)).length > 0) return { ok: false, code: "invalid", message: "Check the name, initials and role." };
  if (draft.isActive !== member.isActive) {
    const lock = switchLock(profile, s.profile, s.team);
    if (lock) return { ok: false, code: lock, message: "This switch is locked." };
  }
  const name = draft.name.trim();
  const role = draft.role.trim();
  const roleChanged = role !== member.roleEn && role !== member.roleDe;
  update((state) => ({
    ...state,
    team: state.team.map((m) =>
      m.profile === profile
        ? { ...m, name, initials: draft.initials.trim().toUpperCase(), isActive: draft.isActive, roleEn: roleChanged ? role : m.roleEn, roleDe: roleChanged ? role : m.roleDe }
        : m,
    ),
    sessions: draft.isActive ? state.sessions : state.sessions.filter((x) => x.isThisBrowser || x.profile !== profile),
  }));
  logActivity({ area: "team", action: "team.update", detail: draft.isActive === member.isActive ? `${name}: profile edited` : `${name}: switched ${draft.isActive ? "on" : "off"}` });
  return { ok: true, data: { name } };
}

/* Feature access */

/** Saves every staged change at once. Only superUser may, and every end day must be in range. */
export function saveAccess(staged: Staged, ends: Ends): ActionResult<{ changes: number }> {
  const s = getState();
  if (s.profile !== "superUser") return SUPER_ONLY;
  const changes = changesOf(staged, s.featureSwitches, DEMO_TODAY);
  for (const change of changes) {
    const end = ends[change.key];
    if (end === undefined || end === null) continue;
    if (!change.canEnd || !endDayOk(end, DEMO_TODAY)) return { ok: false, code: "bad_day", message: "That end day cannot be used." };
  }
  const next: FeatureSwitch[] = finalSwitches(staged, ends, s.featureSwitches, DEMO_TODAY);
  const rows = changes.map((c) => changeRow({ profile: c.profile, feature: c.feature, on: c.on, until: ends[c.key] ?? null, kind: "set" }));
  update((state) => ({ ...state, featureSwitches: next, accessHistory: [...rows, ...state.accessHistory] }));
  for (const change of changes) {
    logActivity({ area: "access", action: "access.set", detail: accessDetail(change.profile, change.feature, change.on, ends[change.key]) });
  }
  return { ok: true, data: { changes: changes.length } };
}

/** Every switch of this profile goes. For a partner that means the grants; for the owner, everything on. */
export function resetAccess(profile: Person): ActionResult {
  const s = getState();
  if (s.profile !== "superUser") return SUPER_ONLY;
  update((state) => ({
    ...state,
    featureSwitches: state.featureSwitches.filter((x) => x.profile !== profile),
    accessHistory: [changeRow({ profile, feature: null, on: null, until: null, kind: "reset" }), ...state.accessHistory],
  }));
  logActivity({ area: "access", action: "access.reset", detail: `${capital(profile)}: back to the defaults` });
  return { ok: true, data: undefined };
}

/* Sessions */

function endSessions(match: (x: { profile: Profile | null; id: string }) => boolean, detail: string): ActionResult<{ count: number }> {
  const s = getState();
  if (s.profile !== "superUser") return SUPER_ONLY;
  const gone = s.sessions.filter((x) => !x.isThisBrowser && match(x));
  if (gone.length === 0) return { ok: false, code: "nothing", message: "Nothing to sign out." };
  const ids = new Set(gone.map((x) => x.id));
  update((state) => ({ ...state, sessions: state.sessions.filter((x) => !ids.has(x.id)) }));
  logActivity({ area: "auth", action: "auth.revoke_sessions", detail: `${detail}: ${gone.length} ended` });
  return { ok: true, data: { count: gone.length } };
}

/** This browser's own row refuses, here and in the two wider forms: it uses Switch profile instead. */
export const signOutSession = (id: string) => endSessions((x) => x.id === id, `Session ${id}`);
export const signOutProfile = (profile: Profile | null) => endSessions((x) => x.profile === profile, `Sessions of ${profile ?? "no profile"}`);
export const signOutEveryoneElse = () => endSessions(() => true, "Everyone else");

/* Danger zone */

/** Counts what the cleanup would have removed and logs the preview. It deletes nothing. */
export function previewDanger(card: DangerCard, typed: string): ActionResult<{ counts: Counts; total: number }> {
  const s = getState();
  if (s.profile !== "superUser") return SUPER_ONLY;
  if (!phraseMatches(typed, DANGER_PHRASES[card])) return { ok: false, code: "phrase", message: "Type the phrase exactly." };
  const counts = dangerCounts(card, s);
  const total = totalOf(counts);
  if (total === 0) return { ok: false, code: "nothing", message: "There is nothing to preview." };
  logActivity({ area: "danger", action: `danger.${card}_preview`, detail: `Preview only: ${total} rows counted, nothing was deleted` });
  return { ok: true, data: { counts, total } };
}

/** The real one: every slice and every registered module map goes back to the seed. */
export function resetDemo(): void {
  resetStore();
}
