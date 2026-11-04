import { extensionOf, kindOfExtension, parseTags, pickProblem, type PickedFile } from "@/desk/work/rules/files";
import { personOf } from "@/desk/work/rules/tasks";
import { now } from "../clock";
import { getState, registerReset, update } from "../core";
import { logActivity } from "../flows";
import type { ActionResult, FileCategory, FileRecord, Person } from "../types";

let seq = 0;
registerReset(() => {
  seq = 0;
});
const nextSeq = () => {
  seq += 1;
  return seq;
};

/** superUser is not a person; a file it touches is filed under the studio lead. */
const actingPerson = (): Person => personOf(getState().profile) ?? "owner";

const refused = (code: string) => ({ ok: false as const, code, message: code });

const change = (id: string, fn: (f: FileRecord) => FileRecord) => {
  update((s) => ({ ...s, files: s.files.map((f) => (f.id === id ? fn(f) : f)) }));
};

const findLive = (id: string) => getState().files.find((f) => f.id === id && f.trashedAt === null);

/** Records name, size and type only. The bytes are never read. */
export function addFile(picked: PickedFile, placing: { title: string; dropId: string | null; category: FileCategory }): ActionResult<FileRecord> {
  const problem = pickProblem(picked);
  if (problem) return refused(problem);
  const title = placing.title.trim();
  if (!title) return refused("title");
  const ext = extensionOf(picked.name);
  const at = now();
  const n = nextSeq();
  const file: FileRecord = { id: `file_new_${n}`, title, ext, mime: picked.type, kind: kindOfExtension(ext) ?? "image", category: placing.category, dropId: placing.dropId, tags: [], notes: "", width: null, height: null, versions: [{ id: `fv_new_${n}_1`, version: 1, by: actingPerson(), at, bytes: picked.size }], updatedAt: at, trashedAt: null, trashedBy: null };
  update((s) => ({ ...s, files: [file, ...s.files] }));
  logActivity({ area: "files", action: "added", detail: title });
  return { ok: true, data: file };
}

export function addVersion(id: string, picked: PickedFile): ActionResult<{ version: number; title: string }> {
  const file = findLive(id);
  if (!file) return refused("not_found");
  const problem = pickProblem(picked);
  if (problem) return refused(problem);
  const version = file.versions[file.versions.length - 1].version + 1;
  const at = now();
  const n = nextSeq();
  const by = actingPerson();
  change(id, (f) => ({ ...f, updatedAt: at, versions: [...f.versions, { id: `fv_new_${n}_${version}`, version, by, at, bytes: picked.size }] }));
  logActivity({ area: "files", action: "new version", detail: file.title });
  return { ok: true, data: { version, title: file.title } };
}

/** Title, tags from a comma-separated line, and notes. */
export function editFileDetails(id: string, details: { title: string; tags: string; notes: string }): ActionResult<FileRecord> {
  const file = findLive(id);
  if (!file) return refused("not_found");
  const title = details.title.trim();
  if (!title) return refused("title");
  const after = { ...file, title, tags: parseTags(details.tags), notes: details.notes.trim() };
  change(id, () => after);
  logActivity({ area: "files", action: "edited", detail: title });
  return { ok: true, data: after };
}

export function moveFile(id: string, dropId: string | null): ActionResult<FileRecord> {
  const file = findLive(id);
  if (!file) return refused("not_found");
  const after = { ...file, dropId };
  change(id, () => after);
  logActivity({ area: "files", action: "moved", detail: file.title });
  return { ok: true, data: after };
}

export function setFileCategory(id: string, category: FileCategory): ActionResult<FileRecord> {
  const file = findLive(id);
  if (!file) return refused("not_found");
  const after = { ...file, category };
  change(id, () => after);
  logActivity({ area: "files", action: "category", detail: file.title });
  return { ok: true, data: after };
}

export function trashFile(id: string): ActionResult<FileRecord> {
  const file = findLive(id);
  if (!file) return refused("not_found");
  const after = { ...file, trashedAt: now(), trashedBy: actingPerson() };
  change(id, () => after);
  logActivity({ area: "files", action: "trashed", detail: file.title });
  return { ok: true, data: after };
}

export function restoreFile(id: string): ActionResult<FileRecord> {
  const file = getState().files.find((f) => f.id === id && f.trashedAt !== null);
  if (!file) return refused("not_found");
  const after = { ...file, trashedAt: null, trashedBy: null };
  change(id, () => after);
  logActivity({ area: "files", action: "restored", detail: file.title });
  return { ok: true, data: after };
}

/** Only from the trash: a live file cannot be purged. */
export function purgeFile(id: string): ActionResult<FileRecord> {
  const file = getState().files.find((f) => f.id === id && f.trashedAt !== null);
  if (!file) return refused("not_in_trash");
  update((s) => ({ ...s, files: s.files.filter((f) => f.id !== id) }));
  logActivity({ area: "files", action: "deleted for good", detail: file.title });
  return { ok: true, data: file };
}
