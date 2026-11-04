"use client";

import { ChevronRight } from "lucide-react";
import { useT } from "@/i18n";
import { finance } from "@/i18n/dict/finance";
import { Table, type Column } from "@/ui";

type Row = { step: string; what: string; where: string };

/** A collapsed reading aid at the foot of the ledger: where each kind of money shows up. */
export function MoneyMap() {
  const { ledger: t } = useT(finance);
  const rows: Row[] = t.mapRows.map(([step, what, where]) => ({ step, what, where }));
  const columns: Column<Row>[] = [
    { key: "step", header: t.mapStep, cell: (r) => <b style={{ fontWeight: 600 }}>{r.step}</b>, width: "22%" },
    { key: "what", header: t.mapWhat, cell: (r) => r.what },
    { key: "where", header: t.mapWhere, cell: (r) => r.where },
  ];
  return (
    <details className="fin-card fin-sec">
      <summary>
        <ChevronRight className="fin-chev" size={16} aria-hidden="true" />
        <span className="fin-h">{t.mapTitle}</span>
      </summary>
      <div className="fin-card-body">
        <p className="fin-note">{t.mapIntro}</p>
        <div className="fin-map-table">
          <Table
            caption={t.mapTitle}
            columns={columns}
            rows={rows}
            rowKey={(r) => r.step}
            phoneRow={(r) => (
              <div className="fin-pcard">
                <b className="type-label">{r.step}</b>
                <span className="type-small">{r.what}</span>
                <span className="fin-pcard-sub">{r.where}</span>
              </div>
            )}
          />
        </div>
        <div>
          <h3 className="fin-h">{t.mapWords}</h3>
          <ul className="fin-words mt-1">
            {t.words.map((word) => (
              <li key={word}>{word}</li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  );
}
