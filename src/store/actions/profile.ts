import { useSyncExternalStore } from "react";
import { DEFAULT_PROFILE, STORAGE_KEYS, SUPER_USER, TEAM } from "@/lib/brand";
import { getState, registerReset, subscribe, update, useStore } from "@/store/core";
import type { ActionResult, Profile, StaffMember, Tier } from "@/store/types";

export const PROFILES: Profile[] = [...TEAM.map((m) => m.profile), SUPER_USER.profile];

export function isProfile(value: unknown): value is Profile {
  return typeof value === "string" && (PROFILES as string[]).includes(value);
}

function readStored(): Profile | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEYS.profile);
    return isProfile(raw) ? raw : null;
  } catch {
    return null;
  }
}

function writeStored(profile: Profile | null): void {
  try {
    if (profile) window.sessionStorage.setItem(STORAGE_KEYS.profile, profile);
    else window.sessionStorage.removeItem(STORAGE_KEYS.profile);
  } catch {
    /* storage can be blocked; the choice still holds in this page's memory */
  }
}

function applyStored(): void {
  const target = readStored() ?? DEFAULT_PROFILE;
  if (getState().profile !== target) update((s) => ({ ...s, profile: target }));
}

/** No stored profile means Owner on every deep link; only /desk/enter/ asks. */
export function setProfile(profile: Profile): ActionResult<Profile> {
  if (!isProfile(profile)) return { ok: false, code: "unknown_profile", message: "That profile does not exist." };
  if (!identityOf(profile).isActive) return { ok: false, code: "inactive", message: "That profile is switched off. Please pick again." };
  writeStored(profile);
  update((s) => ({ ...s, profile }));
  return { ok: true, data: profile };
}

/** "Log everyone out": forgets the choice. The caller then goes to /desk/enter/. */
export function clearProfile(): void {
  writeStored(null);
  update((s) => ({ ...s, profile: DEFAULT_PROFILE }));
}

/** The profile chosen in this session, or null when nobody has chosen one yet. */
export function useStoredProfile(): Profile | null {
  return useSyncExternalStore(subscribe, readStored, () => null);
}

export type Identity = { profile: Profile; name: string; initials: string | null; role: { en: string; de: string }; label: string; tier: Tier; isActive: boolean };

const SUPER_IDENTITY: Identity = {
  profile: SUPER_USER.profile,
  name: SUPER_USER.name,
  initials: null,
  role: { en: "Admin settings", de: "Admin-Einstellungen" },
  label: SUPER_USER.name,
  tier: SUPER_USER.tier,
  isActive: true,
};

/** Who a profile is right now: the Team screen can rename a person or switch them off. */
export function identityOf(profile: Profile, team: StaffMember[] = getState().team): Identity {
  const member = TEAM.find((m) => m.profile === profile);
  if (!member) return SUPER_IDENTITY;
  const edited = team?.find((m) => m.profile === profile);
  return {
    profile,
    name: edited?.name ?? member.name,
    initials: edited?.initials ?? member.initials,
    role: edited ? { en: edited.roleEn, de: edited.roleDe } : member.role,
    label: member.profileLabel,
    tier: member.tier,
    isActive: edited?.isActive ?? true,
  };
}

export function useIdentity(profile: Profile): Identity {
  return identityOf(profile, useStore((s) => s.team));
}

if (typeof window !== "undefined") applyStored();
registerReset(applyStored);
