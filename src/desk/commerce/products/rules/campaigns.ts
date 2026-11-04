import type { Campaign, CampaignChannel, CampaignStatus } from "@/store/types";

export const CAMPAIGN_STATUSES: CampaignStatus[] = ["draft", "scheduled", "completed"];
export const CAMPAIGN_CHANNELS: CampaignChannel[] = ["instagram", "tiktok", "newsletter", "website", "in_person", "other"];

export type CampaignTiming = "undated" | "upcoming" | "running" | "past";

/** Where the dates sit relative to today, inclusive at both ends. */
export function campaignTiming(startsOn: string | null, endsOn: string | null, today: string): CampaignTiming {
  if (!startsOn && !endsOn) return "undated";
  if (endsOn && endsOn < today) return "past";
  if (startsOn && startsOn > today) return "upcoming";
  return "running";
}

/** Upcoming means every campaign not completed yet. */
export const upcomingCount = (campaigns: Pick<Campaign, "status">[]): number => campaigns.filter((c) => c.status !== "completed").length;

export type CampaignInputProblem = "name" | "dates" | "notes";

export function campaignInputProblem(input: { name: string; startsOn: string | null; endsOn: string | null; notes: string }): CampaignInputProblem | null {
  if (!input.name.trim() || input.name.trim().length > 120) return "name";
  if (input.startsOn && input.endsOn && input.endsOn < input.startsOn) return "dates";
  if (input.notes.length > 2000) return "notes";
  return null;
}
