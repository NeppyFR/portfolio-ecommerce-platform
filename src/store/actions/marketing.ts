import { campaignInputProblem, type CampaignInputProblem } from "@/desk/commerce/products/rules";
import { now } from "@/store/clock";
import { getState, registerReset, update } from "@/store/core";
import { logActivity } from "@/store/flows";
import type { ActionResult, Campaign, CampaignChannel, CampaignStatus, Person } from "@/store/types";

let seq = 1;
registerReset(() => {
  seq = 1;
});
const fail = (code: string): { ok: false; code: string; message: string } => ({ ok: false, code, message: code });

export type CampaignInput = { name: string; channel: CampaignChannel; status: CampaignStatus; startsOn: string | null; endsOn: string | null; owner: Person | null; discountId: string | null; productIds: string[]; notes: string };

export const campaignProblem = (input: CampaignInput): CampaignInputProblem | null => campaignInputProblem(input);

/** Planning only: nothing here publishes or sends anything. */
export function createCampaign(input: CampaignInput): ActionResult<{ id: string }> {
  const problem = campaignProblem(input);
  if (problem) return fail(problem);
  const row: Campaign = { id: `cam_b4_${seq++}`, name: input.name.trim(), channel: input.channel, status: input.status, startsOn: input.startsOn, endsOn: input.endsOn, owner: input.owner, discountId: input.discountId, productIds: input.productIds, notes: input.notes.trim(), updatedAt: now() };
  update((state) => ({ ...state, campaigns: [row, ...state.campaigns] }));
  logActivity({ area: "marketing", action: "campaign_created", detail: row.name });
  return { ok: true, data: { id: row.id } };
}

export function saveCampaign(id: string, input: CampaignInput): ActionResult {
  if (!getState().campaigns.some((c) => c.id === id)) return fail("not_found");
  const problem = campaignProblem(input);
  if (problem) return fail(problem);
  const at = now();
  update((state) => ({ ...state, campaigns: state.campaigns.map((c) => (c.id === id ? { ...c, name: input.name.trim(), channel: input.channel, status: input.status, startsOn: input.startsOn, endsOn: input.endsOn, owner: input.owner, discountId: input.discountId, productIds: input.productIds, notes: input.notes.trim(), updatedAt: at } : c)) }));
  logActivity({ area: "marketing", action: "campaign_saved", detail: input.name.trim() });
  return { ok: true, data: undefined };
}

/** Only the plan goes. A linked code and the products stay as they are. */
export function deleteCampaign(id: string): ActionResult {
  const row = getState().campaigns.find((c) => c.id === id);
  if (!row) return fail("not_found");
  update((state) => ({ ...state, campaigns: state.campaigns.filter((c) => c.id !== id) }));
  logActivity({ area: "marketing", action: "campaign_deleted", detail: row.name });
  return { ok: true, data: undefined };
}
