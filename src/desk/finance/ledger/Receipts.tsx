"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, FileImage, FileText, Paperclip } from "lucide-react";
import { fmt, useT } from "@/i18n";
import { finance } from "@/i18n/dict/finance";
import { formatBytes } from "@/lib/format";
import { addReceipts, removeReceipt } from "@/store/actions/finance";
import type { LedgerEntry, Receipt } from "@/store/types";
import { Button, Dialog, IconButton, toast } from "@/ui";
import { MAX_RECEIPTS, MAX_RECEIPT_BYTES, RECEIPT_TYPES } from "../rules/ledger";

const SHOWN = 3;

const Glyph = ({ receipt, size }: { receipt: Receipt; size: number }) => (/\.pdf$/i.test(receipt.name) ? <FileText size={size} aria-hidden="true" /> : <FileImage size={size} aria-hidden="true" />);

/** Up to three tiles, `+n` for the rest, a paperclip while there is room. The picker records name and size, never the bytes. */
export function Receipts({ entry }: { entry: LedgerEntry }) {
  const { ledger: t } = useT(finance);
  const input = useRef<HTMLInputElement>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const count = entry.receipts.length;
  const index = viewing === null ? 0 : Math.min(viewing, count - 1);
  const current = viewing === null ? null : entry.receipts[index] ?? null;

  const pick = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const list = [...files];
    if (list.some((f) => !RECEIPT_TYPES.test(f.name))) return toast(t.receiptType);
    if (list.some((f) => f.size > MAX_RECEIPT_BYTES)) return toast(t.receiptSize);
    const result = addReceipts(entry.id, list.map((f) => ({ name: f.name, sizeBytes: f.size })));
    if (!result.ok) return toast(fmt(t.receiptTooMany, { n: MAX_RECEIPTS }));
    toast(result.data === 1 ? t.receiptAdded : fmt(t.receiptsAdded, { n: result.data }));
  };

  const close = () => {
    setViewing(null);
    setConfirming(false);
  };
  const step = (by: number) => {
    setConfirming(false);
    setViewing((v) => ((v ?? 0) + by + count) % count);
  };

  return (
    <span className="fin-rcpts">
      {entry.receipts.slice(0, SHOWN).map((receipt, i) => (
        <button key={receipt.id} type="button" className="fin-rc" aria-label={fmt(t.receiptOpen, { name: receipt.name })} title={receipt.name} onClick={() => setViewing(i)}>
          <Glyph receipt={receipt} size={14} />
        </button>
      ))}
      {count > SHOWN ? (
        <button type="button" className="fin-rc" aria-label={fmt(t.receiptsMore, { n: count })} onClick={() => setViewing(SHOWN)}>
          +{count - SHOWN}
        </button>
      ) : null}
      {count < MAX_RECEIPTS ? (
        <button type="button" className="fin-rc fin-rc-add" aria-label={t.receiptsAdd} title={t.receiptsAdd} onClick={() => input.current?.click()}>
          <Paperclip size={14} aria-hidden="true" />
        </button>
      ) : null}
      <input
        ref={input}
        type="file"
        hidden
        multiple
        accept=".png,.jpg,.jpeg,.webp,.avif,.pdf"
        onChange={(e) => {
          pick(e.target.files);
          e.target.value = "";
        }}
      />
      <Dialog className="fin-rc-dialog" open={current !== null} onClose={close} title={current ? fmt(t.receiptTitle, { n: index + 1, count, title: entry.title }) : ""}>
        {current ? (
          <div className="fin-stack">
            <div className="fin-viewer">
              <span className="fin-viewer-tile">
                <Glyph receipt={current} size={28} />
              </span>
              <b className="type-mono" style={{ overflowWrap: "anywhere" }}>
                {current.name}
              </b>
              <span className="fin-note">{formatBytes(current.sizeBytes)}</span>
              <span className="fin-note">{t.receiptDemo}</span>
            </div>
            {confirming ? (
              <div className="fin-stack" style={{ gap: 8 }}>
                <b className="type-label">{t.receiptRemoveTitle}</b>
                <p className="fin-note">{fmt(t.receiptRemoveBody, { title: entry.title })}</p>
                <div className="fin-rc-foot">
                  <Button
                    variant="danger"
                    onClick={() => {
                      removeReceipt(entry.id, current.id);
                      toast(t.receiptRemoved);
                      setConfirming(false);
                      if (count <= 1) close();
                    }}
                  >
                    {t.receiptRemoveConfirm}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="fin-rc-foot">
                <Button variant="ghost" onClick={() => setConfirming(true)}>
                  {t.receiptRemove}
                </Button>
                {count > 1 ? (
                  <>
                    <IconButton aria-label={t.receiptPrev} onClick={() => step(-1)}>
                      <ChevronLeft size={16} aria-hidden="true" />
                    </IconButton>
                    <IconButton aria-label={t.receiptNext} onClick={() => step(1)}>
                      <ChevronRight size={16} aria-hidden="true" />
                    </IconButton>
                  </>
                ) : null}
              </div>
            )}
          </div>
        ) : null}
      </Dialog>
    </span>
  );
}
