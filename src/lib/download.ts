import { LABEL } from "./brand";
import { DEMO_TODAY } from "@/store/clock";

/** `aerlo-orders-2027-01-08.csv` */
export const exportName = (dataset: string, ext: "csv" | "json", day: string = DEMO_TODAY): string => `${LABEL.name.toLowerCase()}-${dataset}-${day}.${ext}`;

/** Hands the viewer a file through a Blob and a temporary `a[download]`. Nothing leaves the browser. */
export function downloadText(name: string, content: string, mime: string): void {
  if (typeof document === "undefined") return;
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.style.display = "none";
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const downloadCsv = (dataset: string, csv: string): void => downloadText(exportName(dataset, "csv"), csv, "text/csv;charset=utf-8");

export const downloadJson = (dataset: string, value: unknown): void => downloadText(exportName(dataset, "json"), `${JSON.stringify(value, null, 2)}\n`, "application/json");
