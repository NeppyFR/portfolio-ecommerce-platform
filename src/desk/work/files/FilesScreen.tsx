"use client";

import "../checklist/work.css";
import "./files.css";
import { useSearchParams } from "next/navigation";
import { Archive, ArrowUpFromLine, CircleAlert, FileText, Film, FolderOpen, Image as ImageIcon, Info, LayoutGrid, List, PenTool, RotateCcw, Search, SearchX, Trash2, Upload, X, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import { PageHead } from "@/desk/shell/PageHead";
import { CATEGORIES, KINDS, SEARCH_MAX, canPromote, categoryCounts, currentVersion, daysLeft, fileBytes, filterFiles, isFiltered, liveFiles, pickProblem, relativeTime, titleFromName, totalBytes, trashedFiles, whereCount, whereOf, type FileQuery, type FileSort, type PickedFile } from "@/desk/work/rules/files";
import { personOf } from "@/desk/work/rules/tasks";
import { fmt, useLang, useT } from "@/i18n";
import { files as filesDict } from "@/i18n/dict/files";
import { LABEL } from "@/lib/brand";
import { shortDay } from "@/lib/dates";
import { dayKey, formatBytes, formatDateTime } from "@/lib/format";
import { setParam, setParams } from "@/lib/routes";
import { addFile, addVersion, editFileDetails, moveFile, purgeFile, restoreFile, setFileCategory, trashFile } from "@/store/actions/files";
import { identityOf } from "@/store/actions/profile";
import { DEMO_NOW_MS } from "@/store/clock";
import { useStore } from "@/store/core";
import type { Drop, FileCategory, FileKind, FileRecord, Lang, Person, Product } from "@/store/types";
import { Button, Dialog, ProductArt, IconButton, Input, Segmented, Select, Sheet, Table, Tabs, Textarea, toast, type Column } from "@/ui";
import { Mark } from "@/ui/Mark";
import { Avatar, WorkEmpty, usePeople } from "../checklist/parts";

type T = typeof filesDict.en;
type Places = Map<string, { name: string; tile: string; accent: string }>;

/** The palette's gradients stand in for the original drop accents, by launch order. */
const PLACE_TILES = ["t-lil", "t-sky", "t-vio", "t-pale"];
const PLACE_ACCENTS = ["#8c7bff", "#6fd3ff", "#2f6bff", "#b9f3ff"];
const BRAND_PLACE = { tile: "t-ice", accent: "var(--line-3)" };

function usePlaces(drops: Drop[], t: T): Places {
  return useMemo(() => {
    const map: Places = new Map([["brand", { name: t.brand, ...BRAND_PLACE }]]);
    drops.forEach((drop, i) => map.set(drop.id, { name: drop.name, tile: PLACE_TILES[i % PLACE_TILES.length], accent: PLACE_ACCENTS[i % PLACE_ACCENTS.length] }));
    return map;
  }, [drops, t.brand]);
}

const placeOf = (places: Places, file: Pick<FileRecord, "dropId">) => places.get(whereOf(file)) ?? { name: "", ...BRAND_PLACE };

const KIND_ICONS: Record<FileKind, LucideIcon> = { image: ImageIcon, pdf: FileText, design: PenTool, archive: Archive, video: Film };

const SAMPLE: PickedFile = { name: "lamp_front-graphic.pdf", size: 420_000, type: "application/pdf" };

/** Pictures have no bytes here, so a file that shows a product gets that product, drawn. */
type Drawn = { type: Product["art"]; tone: Product["tone"]; view: "full" | "crop-top" | "crop-detail"; tile: string };
function drawnFor(file: FileRecord): Drawn | null {
  if (file.kind !== "image") return null;
  const title = file.title.toLowerCase();
  if (title.includes("speaker")) return { type: "speaker", tone: "azure", view: "full", tile: "t-pale" };
  if (title.includes("shade")) return { type: "lamp", tone: "ice", view: "crop-top", tile: "t-sky" };
  if (title.includes("lamp")) return { type: "lamp", tone: "ice", view: "full", tile: "t-sky" };
  if (title.includes("bottle")) return { type: "bottle", tone: "lilac", view: "full", tile: "t-cob" };
  if (title.includes("candle")) return { type: "candle", tone: "lilac", view: "full", tile: "t-vio" };
  return null;
}

function LogoArt({ file, dropName }: { file: FileRecord; dropName: string | null }) {
  if (/project mark/i.test(file.title)) return <Mark size={44} />;
  return <span className="wf-logo-word">{dropName ?? LABEL.name}</span>;
}

/** Stands in for the file. Logos and product pictures are drawn, everything else is a folded page with its extension. */
function Preview({ file, places, compact }: { file: FileRecord; places: Places; compact?: boolean }) {
  const place = placeOf(places, file);
  const drawn = drawnFor(file);
  if (file.category === "logo" && file.kind === "image" && !compact) {
    const reversed = /white/i.test(file.title);
    const dark = /\bink\b/i.test(file.title);
    const dropName = file.dropId ? place.name : null;
    return (
      <span className={`wf-prev ${reversed ? "wf-prev-ink" : dark ? "wf-prev-bright" : place.tile}`} data-soft={reversed || dark ? undefined : true}>
        <LogoArt file={file} dropName={dropName} />
      </span>
    );
  }
  if (drawn) {
    return (
      <span className={`wf-prev ${drawn.tile}`} data-compact={compact || undefined}>
        <ProductArt type={drawn.type} tone={drawn.tone} view={drawn.view} className="wf-prev-art" />
      </span>
    );
  }
  const Icon = KIND_ICONS[file.kind];
  return (
    <span className={`wf-prev ${place.tile}`} data-compact={compact || undefined} data-soft="true">
      <span className="wf-page">
        <Icon size={compact ? 14 : 20} aria-hidden="true" />
        {compact ? null : <span className="wf-page-ext">{file.ext.toUpperCase()}</span>}
      </span>
    </span>
  );
}

function relText(iso: string, t: T, lang: Lang): string {
  const r = relativeTime(iso, DEMO_NOW_MS);
  switch (r.unit) {
    case "now":
      return t.relNow;
    case "minutes":
      return r.n === 1 ? t.relMinuteOne : fmt(t.relMinutes, { n: r.n });
    case "hours":
      return r.n === 1 ? t.relHourOne : fmt(t.relHours, { n: r.n });
    case "yesterday":
      return t.relYesterday;
    case "days":
      return fmt(t.relDays, { n: r.n });
    case "weeks":
      return r.n === 1 ? t.relWeekOne : fmt(t.relWeeks, { n: r.n });
    default:
      return shortDay(dayKey(iso), lang);
  }
}

function FileCard({ file, places, onOpen, t, lang }: { file: FileRecord; places: Places; onOpen: (id: string) => void; t: T; lang: Lang }) {
  const team = useStore((s) => s.team);
  const place = placeOf(places, file);
  const version = currentVersion(file);
  const older = file.versions.length - 1;
  return (
    <li>
      <button type="button" className="wf-card" style={{ borderTopColor: place.accent }} onClick={() => onOpen(file.id)}>
        <span className="wf-card-prev">
          <Preview file={file} places={places} />
          {older > 0 ? (
            <span className="wf-badge type-mono-s" title={older === 1 ? fmt(t.versionBadgeOne, { v: version.version }) : fmt(t.versionBadge, { v: version.version, older })}>
              v{version.version}
            </span>
          ) : null}
        </span>
        <span className="wf-card-body">
          <span className="wf-card-title">{file.title}</span>
          <span className="wf-chips">
            <span className="wf-chip">{t.categoryOne[file.category]}</span>
            <span className="wf-chip" data-place="true">
              {place.name}
            </span>
          </span>
          <span className="wf-card-foot type-small">
            <Avatar person={version.by} size={18} />
            <span className="wf-card-who">
              {identityOf(version.by, team).name.split(" ")[0]} · {relText(version.at, t, lang)}
            </span>
            <span className="type-mono-s wf-card-size">{formatBytes(fileBytes(file))}</span>
          </span>
        </span>
      </button>
    </li>
  );
}

/** Label kept for screen readers: the first option of each picker already says what it is. */
function Pick({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return (
    <label className="wf-pick">
      <span className="sr-only">{label}</span>
      <select className="ui-input ui-select" value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
    </label>
  );
}

function PlaceOptions({ drops, t }: { drops: Drop[]; t: T }) {
  return (
    <>
      <option value="brand">{t.brand}</option>
      {drops.map((d) => (
        <option key={d.id} value={d.id}>
          {d.name}
        </option>
      ))}
    </>
  );
}

function CategoryOptions({ t }: { t: T }) {
  return (
    <>
      {CATEGORIES.map((c) => (
        <option key={c} value={c}>
          {t.categories[c]}
        </option>
      ))}
    </>
  );
}

/** A file picker that keeps name, size and type. It never opens the file. */
function Dropzone({ picked, error, onPick, t }: { picked: PickedFile | null; error: string | null; onPick: (file: PickedFile) => void; t: T }) {
  const [over, setOver] = useState(false);
  const take = (file: File | null | undefined) => {
    if (file) onPick({ name: file.name, size: file.size, type: file.type });
  };
  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setOver(false);
    take(e.dataTransfer.files[0]);
  };
  return (
    <div className="wf-dropwrap">
      <label className="wf-drop" data-over={over || undefined} data-invalid={error || undefined} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={onDrop}>
        <input type="file" className="sr-only" aria-label={t.pick} onChange={(e: ChangeEvent<HTMLInputElement>) => { take(e.target.files?.[0]); e.target.value = ""; }} />
        <ArrowUpFromLine size={18} aria-hidden="true" />
        <span className="type-label">{over ? t.dropHere : picked ? fmt(t.picked, { name: picked.name, size: formatBytes(picked.size) }) : t.pick}</span>
        <span className="type-small wf-drop-note">{t.accepts}</span>
      </label>
      {error ? (
        <p className="ui-field-error" role="alert">
          <CircleAlert size={14} aria-hidden="true" />
          {error}
        </p>
      ) : null}
      <button type="button" className="wf-linkbtn" onClick={() => onPick(SAMPLE)}>
        {t.sample}
      </button>
    </div>
  );
}

function UploadDialog({ open, onClose, startWhere, startCategory, drops, t }: { open: boolean; onClose: () => void; startWhere: string; startCategory: FileCategory; drops: Drop[]; t: T }) {
  const [picked, setPicked] = useState<PickedFile | null>(null);
  const [where, setWhere] = useState(startWhere);
  const [category, setCategory] = useState<FileCategory>(startCategory);
  const [title, setTitle] = useState("");
  const [pickError, setPickError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);

  const onPick = (file: PickedFile) => {
    const problem = pickProblem(file);
    if (problem) {
      setPicked(null);
      setPickError(problem === "type" ? t.errType : t.errSize);
      return;
    }
    setPickError(null);
    setPicked(file);
    setTitle((prev) => prev || titleFromName(file.name));
  };

  const submit = () => {
    if (!picked) {
      setPickError(t.errPick);
      return;
    }
    if (!title.trim()) {
      setTitleError(t.errTitle);
      return;
    }
    const result = addFile(picked, { title, dropId: where === "brand" ? null : where, category });
    if (!result.ok) {
      toast(t.failed);
      return;
    }
    toast(fmt(t.toastUploaded, { title: result.data.title }));
    setParams({ where, kind: category, q: null, by: null, type: null, sort: null, open: null });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title={t.uploadTitle} confirmLabel={t.uploadNow} cancelLabel={t.cancel} onConfirm={submit}>
      <div className="wk-form">
        <p className="type-small wk-sheet-sub">{t.uploadText}</p>
        <Dropzone picked={picked} error={pickError} onPick={onPick} t={t} />
        {picked ? (
          <>
            <div className="wk-two">
              <Select label={t.fieldWhere} value={where} onChange={(e) => setWhere(e.target.value)}>
                <PlaceOptions drops={drops} t={t} />
              </Select>
              <Select label={t.fieldWhat} value={category} onChange={(e) => setCategory(e.target.value as FileCategory)}>
                <CategoryOptions t={t} />
              </Select>
            </div>
            <Input label={t.fieldTitle} value={title} placeholder={t.titleHint} maxLength={120} error={titleError} onChange={(e) => { setTitle(e.target.value); setTitleError(null); }} />
          </>
        ) : null}
      </div>
    </Dialog>
  );
}

function VersionDialog({ file, open, onClose, t }: { file: FileRecord | null; open: boolean; onClose: () => void; t: T }) {
  const [picked, setPicked] = useState<PickedFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const onPick = (next: PickedFile) => {
    const problem = pickProblem(next);
    if (problem) {
      setPicked(null);
      setError(problem === "type" ? t.errType : t.errSize);
      return;
    }
    setError(null);
    setPicked(next);
  };
  const submit = () => {
    if (!file) return;
    if (!picked) {
      setError(t.errPick);
      return;
    }
    const result = addVersion(file.id, picked);
    if (!result.ok) {
      toast(t.failed);
      return;
    }
    toast(fmt(t.toastVersion, { v: result.data.version, title: result.data.title }));
    onClose();
  };
  return (
    <Dialog open={open} onClose={onClose} title={t.versionTitle} confirmLabel={t.uploadNow} cancelLabel={t.cancel} onConfirm={submit}>
      <div className="wk-form">
        <p className="type-small wk-sheet-sub">{fmt(t.versionText, { title: file?.title ?? "" })}</p>
        <Dropzone picked={picked} error={error} onPick={onPick} t={t} />
      </div>
    </Dialog>
  );
}

function EditDialog({ file, open, onClose, t }: { file: FileRecord | null; open: boolean; onClose: () => void; t: T }) {
  const [title, setTitle] = useState(file?.title ?? "");
  const [tags, setTags] = useState(file?.tags.join(", ") ?? "");
  const [notes, setNotes] = useState(file?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const submit = () => {
    if (!file) return;
    if (!title.trim()) {
      setError(t.errTitle);
      return;
    }
    const result = editFileDetails(file.id, { title, tags, notes });
    if (!result.ok) {
      toast(t.failed);
      return;
    }
    toast(t.toastSaved);
    onClose();
  };
  return (
    <Dialog open={open} onClose={onClose} title={t.editDetails} confirmLabel={t.save} cancelLabel={t.cancel} onConfirm={submit}>
      <div className="wk-form">
        <Input label={t.fieldTitle} value={title} maxLength={120} error={error} onChange={(e) => { setTitle(e.target.value); setError(null); }} />
        <Input label={t.fieldTags} value={tags} hint={t.fieldTagsHint} onChange={(e) => setTags(e.target.value)} />
        <Textarea label={t.fieldNotes} value={notes} rows={3} onChange={(e) => setNotes(e.target.value)} />
      </div>
    </Dialog>
  );
}

function FileSheet({ file, places, drops, t, lang, onVersion, onEdit }: { file: FileRecord; places: Places; drops: Drop[]; t: T; lang: Lang; onVersion: () => void; onEdit: () => void }) {
  const team = useStore((s) => s.team);
  const place = placeOf(places, file);
  const version = currentVersion(file);
  const move = (value: string) => {
    const result = moveFile(file.id, value === "brand" ? null : value);
    if (!result.ok) return toast(t.failed);
    toast(fmt(t.toastMoved, { where: places.get(value)?.name ?? "" }));
  };
  const recategorise = (value: FileCategory) => {
    const result = setFileCategory(file.id, value);
    if (!result.ok) return toast(t.failed);
    toast(fmt(t.toastCategory, { category: t.categories[value] }));
  };
  const rows: [string, ReactNode][] = [
    [t.colKind, t.categoryOne[file.category]],
    [t.colWhere, place.name],
    [t.typeLabel, t.kinds[file.kind]],
    [t.format, <span key="f" className="type-mono-s">{file.ext.toUpperCase()}</span>],
    [t.colSize, <span key="s" className="type-mono-s">{formatBytes(fileBytes(file))}</span>],
    ...(file.width && file.height ? ([[t.dimensions, <span key="d" className="type-mono-s">{file.width} × {file.height}</span>]] as [string, ReactNode][]) : []),
    [t.colBy, identityOf(version.by, team).name],
    [t.colUpdated, formatDateTime(version.at)],
  ];
  return (
    <div className="wf-sheet">
      <div className="wf-sheet-prev">
        <Preview file={file} places={places} />
      </div>
      <p className="type-small wf-note">
        <Info size={14} aria-hidden="true" />
        {t.noPreview}
      </p>
      <div className="wf-actions">
        <Button variant="outline" onClick={onVersion}>
          <Upload size={15} aria-hidden="true" />
          {t.newVersion}
        </Button>
        {canPromote(file) ? (
          <Button variant="outline" onClick={() => recategorise("final")}>
            {t.promote}
          </Button>
        ) : null}
        <Button variant="outline" onClick={onEdit}>
          {t.editDetails}
        </Button>
      </div>
      <div className="wk-two">
        <Select label={t.moveTo} value={whereOf(file)} onChange={(e) => move(e.target.value)}>
          <PlaceOptions drops={drops} t={t} />
        </Select>
        <Select label={t.categoryPick} value={file.category} onChange={(e) => recategorise(e.target.value as FileCategory)}>
          <CategoryOptions t={t} />
        </Select>
      </div>
      <section className="wf-block">
        <h3 className="type-h4">{t.details}</h3>
        <dl className="wf-dl">
          {rows.map(([term, value]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="wf-block">
        <h3 className="type-h4">{t.tags}</h3>
        {file.tags.length ? (
          <span className="wf-chips">
            {file.tags.map((tag) => (
              <span key={tag} className="wf-chip">
                {tag}
              </span>
            ))}
          </span>
        ) : (
          <p className="type-small wf-muted">{t.noTags}</p>
        )}
      </section>
      <section className="wf-block">
        <h3 className="type-h4">{t.notes}</h3>
        <p className="type-body wf-notes">{file.notes || <span className="wf-muted">{t.noNotes}</span>}</p>
      </section>
      <section className="wf-block">
        <h3 className="type-h4">{fmt(t.versions, { n: file.versions.length })}</h3>
        <ol className="wf-versions">
          {[...file.versions].reverse().map((v, i) => (
            <li key={v.id}>
              <span className="type-mono-s wf-v">v{v.version}</span>
              <span className="type-small wf-v-line">{fmt(t.versionLine, { name: identityOf(v.by, team).name, date: formatDateTime(v.at) })}</span>
              <span className="type-mono-s wf-v-size">{formatBytes(v.bytes)}</span>
              {i === 0 ? <span className="wf-chip" data-current="true">{t.current}</span> : null}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function TrashSheet({ open, onClose, trashed, places, t, lang, onPurge }: { open: boolean; onClose: () => void; trashed: FileRecord[]; places: Places; t: T; lang: Lang; onPurge: (file: FileRecord) => void }) {
  const team = useStore((s) => s.team);
  const restore = (id: string) => {
    const result = restoreFile(id);
    toast(result.ok ? t.toastRestored : t.failed);
  };
  return (
    <Sheet open={open} onClose={onClose} title={fmt(t.trashTitle, { n: trashed.length })}>
      <div className="wf-sheet">
        <p className="type-small wk-sheet-sub">{t.trashText}</p>
        {trashed.length === 0 ? (
          <WorkEmpty icon={Trash2} title={t.trash}>
            {t.trashEmpty}
          </WorkEmpty>
        ) : (
          <ul className="wf-trash">
            {trashed.map((file) => {
              const left = daysLeft(file.trashedAt ?? "", DEMO_NOW_MS);
              const place = placeOf(places, file);
              return (
                <li key={file.id}>
                  <span className="wf-trash-thumb">
                    <Preview file={file} places={places} compact />
                  </span>
                  <div className="wf-trash-main">
                    <p className="type-label">{file.title}</p>
                    <p className="type-small wf-muted">{[place.name, t.categoryOne[file.category], file.ext.toUpperCase(), formatBytes(fileBytes(file))].join(" · ")}</p>
                    <p className="type-small wf-muted">{fmt(t.deletedBy, { name: file.trashedBy ? identityOf(file.trashedBy, team).name : "", when: relText(file.trashedAt ?? "", t, lang) })}</p>
                    <span className="wf-chip" data-warn={left <= 7 || undefined}>
                      {left === 1 ? t.daysLeftOne : fmt(t.daysLeft, { n: left })}
                    </span>
                  </div>
                  <div className="wf-trash-do">
                    <Button variant="outline" onClick={() => restore(file.id)}>
                      {t.restore}
                    </Button>
                    <Button variant="ghost" onClick={() => onPurge(file)}>
                      {t.purge}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Sheet>
  );
}

const SORTS: FileSort[] = ["newest", "name", "size"];

function readQuery(params: URLSearchParams | ReturnType<typeof useSearchParams>, placeIds: string[]): FileQuery {
  const where = params.get("where") ?? "all";
  const kind = params.get("kind") as FileCategory | null;
  const sort = params.get("sort") as FileSort | null;
  const by = params.get("by") as Person | null;
  const type = params.get("type") as FileKind | null;
  return {
    where: placeIds.includes(where) ? where : "all",
    category: kind && CATEGORIES.includes(kind) ? kind : "all",
    q: params.get("q") ?? "",
    sort: sort && SORTS.includes(sort) ? sort : "newest",
    by: by && ["owner", "finance", "warehouse", "studio"].includes(by) ? by : "all",
    type: type && KINDS.includes(type) ? type : "all",
  };
}

export function FilesScreen() {
  const t = useT(filesDict);
  const lang = useLang();
  const params = useSearchParams();
  const all = useStore((s) => s.files);
  const drops = useStore((s) => s.drops);
  const team = useStore((s) => s.team);
  const profile = useStore((s) => s.profile);
  const me = personOf(profile);
  const people = usePeople();
  const places = usePlaces(drops, t);

  const query = readQuery(params, ["brand", ...drops.map((d) => d.id)]);
  const view = params.get("view") === "list" ? "list" : "grid";
  const openId = params.get("open");
  const opened = openId ? all.find((f) => f.id === openId && f.trashedAt === null) ?? null : null;
  const last = useRef<FileRecord | null>(null);
  if (opened) last.current = opened;

  const live = useMemo(() => liveFiles(all), [all]);
  const trashed = useMemo(() => trashedFiles(all), [all]);
  const shown = useMemo(() => filterFiles(all, query), [all, query.where, query.category, query.q, query.sort, query.by, query.type]); // eslint-disable-line react-hooks/exhaustive-deps
  const counts = useMemo(() => categoryCounts(all, query), [all, query.where, query.q, query.by, query.type]); // eslint-disable-line react-hooks/exhaustive-deps
  const filtered = isFiltered(query);

  const [upload, setUpload] = useState(false);
  const [uploadKey, setUploadKey] = useState(0);
  const [versionOpen, setVersionOpen] = useState(false);
  const [versionKey, setVersionKey] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [editKey, setEditKey] = useState(0);
  const [trashOpen, setTrashOpen] = useState(false);
  const [purgeRow, setPurgeRow] = useState<FileRecord | null>(null);
  const [purgeOpen, setPurgeOpen] = useState(false);

  useEffect(() => {
    if (!openId) {
      setVersionOpen(false);
      setEditOpen(false);
    }
  }, [openId]);

  const startUpload = () => {
    setUploadKey((k) => k + 1);
    setUpload(true);
  };
  const resetFilters = () => setParams({ q: null, by: null, type: null });
  const open = (id: string) => setParam("open", id);
  const whereName = query.where === "all" ? t.all : places.get(query.where)?.name ?? t.all;
  const title = live.length === 1 ? t.titleOne : fmt(t.title, { n: live.length });

  const whereCells: { id: string; name: string; hint: string; tile: string }[] = [
    { id: "all", name: t.all, hint: t.allHint, tile: "f-receipt" },
    { id: "brand", name: t.brand, hint: t.brandHint, tile: BRAND_PLACE.tile },
    ...drops.map((d) => ({ id: d.id, name: d.name, hint: `${d.season} · ${t.statuses[d.status]}`, tile: places.get(d.id)?.tile ?? "t-pale" })),
  ];

  const columns: Column<FileRecord>[] = [
    {
      key: "name",
      header: t.colName,
      phone: true,
      cell: (file) => (
        <span className="wf-row-name">
          <span className="wf-thumb">
            <Preview file={file} places={places} compact />
          </span>
          <span className="wf-row-title">{file.title}</span>
        </span>
      ),
    },
    { key: "kind", header: t.colKind, cell: (file) => t.categoryOne[file.category] },
    { key: "where", header: t.colWhere, cell: (file) => placeOf(places, file).name },
    {
      key: "by",
      header: t.colBy,
      cell: (file) => {
        const by = currentVersion(file).by;
        return (
          <span className="wf-row-by">
            <Avatar person={by} size={18} />
            {identityOf(by, team).name.split(" ")[0]}
          </span>
        );
      },
    },
    { key: "updated", header: t.colUpdated, cell: (file) => relText(currentVersion(file).at, t, lang) },
    { key: "size", header: t.colSize, align: "right", cell: (file) => <span className="type-mono-s">{formatBytes(fileBytes(file))}</span> },
    { key: "version", header: t.colVersion, align: "right", cell: (file) => <span className="type-mono-s">v{currentVersion(file).version}</span> },
  ];

  return (
    <div className="wk-screen wf-screen">
      <PageHead
        id="files"
        title={title}
        actions={
          <>
            <Button variant="outline" onClick={() => setTrashOpen(true)}>
              <Trash2 size={15} aria-hidden="true" />
              {t.trash}
              {trashed.length ? <span className="wk-count type-mono-s">{trashed.length}</span> : null}
            </Button>
            <Button onClick={startUpload}>
              <Upload size={15} aria-hidden="true" />
              {t.upload}
            </Button>
          </>
        }
      />

      <nav className="wf-where" aria-label={t.whereLabel}>
        {whereCells.map((cell) => (
          <button key={cell.id} type="button" className="wf-where-cell" aria-pressed={cell.id === query.where} onClick={() => setParam("where", cell.id === "all" ? null : cell.id)}>
            <span className={`wf-where-tile ${cell.tile}`} aria-hidden="true" />
            <span className="wf-where-text">
              <span className="wf-where-name">{cell.name}</span>
              <span className="type-small wf-where-hint">{cell.hint}</span>
            </span>
            <span className="type-mono-s wf-where-count">{whereCount(all, cell.id)}</span>
          </button>
        ))}
      </nav>

      <Tabs
        aria-label={t.whatLabel}
        className="wf-tabs"
        active={query.category}
        onChange={(id) => setParam("kind", id === "all" ? null : id)}
        items={[
          { id: "all", label: <>{t.all} <span className="type-mono-s wf-tab-n">{counts.all}</span></> },
          ...CATEGORIES.map((c) => ({ id: c, label: <>{t.categories[c]} <span className="type-mono-s wf-tab-n">{counts[c]}</span></> })),
        ]}
      />

      <div className="wf-tools">
        <label className="wf-search">
          <span className="sr-only">{t.searchLabel}</span>
          <Search size={15} aria-hidden="true" />
          <input className="ui-input" type="search" value={query.q} maxLength={SEARCH_MAX} placeholder={t.searchLabel} onChange={(e) => setParam("q", e.target.value)} />
          {query.q ? (
            <IconButton aria-label={t.searchClear} className="wf-search-clear" onClick={() => setParam("q", null)}>
              <X size={14} aria-hidden="true" />
            </IconButton>
          ) : null}
        </label>
        <Pick label={t.sortLabel} value={query.sort} onChange={(v) => setParam("sort", v === "newest" ? null : v)}>
          {SORTS.map((s) => (
            <option key={s} value={s}>
              {t.sorts[s]}
            </option>
          ))}
        </Pick>
        <Pick label={t.byLabel} value={query.by} onChange={(v) => setParam("by", v === "all" ? null : v)}>
          <option value="all">{t.everyone}</option>
          {people.map((p) => (
            <option key={p} value={p}>
              {p === me ? fmt(t.meSuffix, { name: identityOf(p, team).name }) : identityOf(p, team).name}
            </option>
          ))}
        </Pick>
        <Pick label={t.typeLabel} value={query.type} onChange={(v) => setParam("type", v === "all" ? null : v)}>
          <option value="all">{t.allTypes}</option>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {t.kinds[k]}
            </option>
          ))}
        </Pick>
        <Segmented
          aria-label={t.viewLabel}
          className="wf-view"
          value={view}
          onChange={(v) => setParam("view", v === "grid" ? null : v)}
          options={[
            { value: "grid", label: <span title={t.grid}><LayoutGrid size={15} aria-hidden="true" /><span className="sr-only">{t.grid}</span></span> },
            { value: "list", label: <span title={t.list}><List size={15} aria-hidden="true" /><span className="sr-only">{t.list}</span></span> },
          ]}
        />
      </div>

      <div className="wf-results type-small" aria-live="polite">
        <span>
          {shown.length === 1 ? t.resultsOne : fmt(t.results, { n: shown.length })} {fmt(t.resultsIn, { where: whereName })}
        </span>
        {filtered ? (
          <button type="button" className="wf-linkbtn" onClick={resetFilters}>
            <RotateCcw size={13} aria-hidden="true" />
            {t.reset}
          </button>
        ) : null}
        <span className="wf-storage" title={t.storageNote}>
          {t.storage}: {fmt(t.storageUsed, { used: formatBytes(totalBytes(live)), n: live.length })}
        </span>
      </div>

      {shown.length === 0 ? (
        <div className="wf-empty">
          {filtered ? (
            <WorkEmpty
              icon={SearchX}
              title={t.noMatchTitle}
              action={
                <Button variant="outline" onClick={resetFilters}>
                  {t.reset}
                </Button>
              }
            >
              {t.noMatch}
            </WorkEmpty>
          ) : (
            <WorkEmpty icon={FolderOpen} title={t.emptyTitle} action={<Button onClick={startUpload}>{t.upload}</Button>}>
              {t.empty}
            </WorkEmpty>
          )}
        </div>
      ) : view === "grid" ? (
        <ul className="wf-grid">
          {shown.map((file) => (
            <FileCard key={file.id} file={file} places={places} onOpen={open} t={t} lang={lang} />
          ))}
        </ul>
      ) : (
        <div className="wf-list">
          <Table
            columns={columns}
            rows={shown}
            rowKey={(file) => file.id}
            selectedKey={openId}
            onRowClick={(file) => open(file.id)}
            caption={t.colName}
            phoneRow={(file) => (
              <span className="wf-phone-row">
                <span className="wf-thumb">
                  <Preview file={file} places={places} compact />
                </span>
                <span className="wf-phone-main">
                  <span className="wf-row-title">{file.title}</span>
                  <span className="type-small wf-muted">
                    {placeOf(places, file).name} · {t.categoryOne[file.category]} · {relText(currentVersion(file).at, t, lang)}
                  </span>
                </span>
                <span className="type-mono-s wf-card-size">{formatBytes(fileBytes(file))}</span>
              </span>
            )}
          />
        </div>
      )}

      <p className="type-small wf-demo-note">{t.storageNote}</p>

      <Sheet
        open={!!opened}
        onClose={() => setParam("open", null)}
        title={last.current?.title ?? ""}
        footer={
          <Button
            variant="danger"
            onClick={() => {
              if (!opened) return;
              const result = trashFile(opened.id);
              toast(result.ok ? t.toastTrashed : t.failed);
              if (result.ok) setParam("open", null);
            }}
          >
            <Trash2 size={15} aria-hidden="true" />
            {t.toTrash}
          </Button>
        }
      >
        {last.current ? (
          <FileSheet
            key={last.current.id}
            file={last.current}
            places={places}
            drops={drops}
            t={t}
            lang={lang}
            onVersion={() => {
              setVersionKey((k) => k + 1);
              setVersionOpen(true);
            }}
            onEdit={() => {
              setEditKey((k) => k + 1);
              setEditOpen(true);
            }}
          />
        ) : null}
      </Sheet>

      <UploadDialog key={`u${uploadKey}`} open={upload} onClose={() => setUpload(false)} startWhere={query.where === "all" ? "brand" : query.where} startCategory={query.category === "all" ? "draft" : query.category} drops={drops} t={t} />
      <VersionDialog key={`v${versionKey}`} file={opened} open={versionOpen} onClose={() => setVersionOpen(false)} t={t} />
      <EditDialog key={`e${editKey}`} file={opened} open={editOpen} onClose={() => setEditOpen(false)} t={t} />

      <TrashSheet
        open={trashOpen}
        onClose={() => setTrashOpen(false)}
        trashed={trashed}
        places={places}
        t={t}
        lang={lang}
        onPurge={(file) => {
          setPurgeRow(file);
          setPurgeOpen(true);
        }}
      />
      <Dialog
        open={purgeOpen}
        onClose={() => setPurgeOpen(false)}
        title={t.purge}
        danger
        confirmLabel={t.purgeWord}
        cancelLabel={t.cancel}
        onConfirm={() => {
          if (purgeRow) toast(purgeFile(purgeRow.id).ok ? t.toastPurged : t.failed);
          setPurgeOpen(false);
        }}
      >
        <p className="type-body">{fmt(t.purgeConfirm, { title: purgeRow?.title ?? "" })}</p>
      </Dialog>
    </div>
  );
}

