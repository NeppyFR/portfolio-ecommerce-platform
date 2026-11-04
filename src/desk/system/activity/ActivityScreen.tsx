"use client";

import { useMemo, useState } from "react";
import { History } from "lucide-react";
import { PageHead } from "@/desk/shell/PageHead";
import { EmptyBox, Intro, Mono, Panel } from "@/desk/system/parts/parts";
import { activityText } from "@/desk/system/rules/activity-text";
import type { ActivityEntity } from "@/desk/system/rules/lights";
import { filterActivity, pageOf } from "@/desk/system/rules/logs";
import { fmt, useLang, useT } from "@/i18n";
import { system } from "@/i18n/dict/system";
import { formatStamp } from "@/lib/format";
import { useStore } from "@/store/core";
import { Button } from "@/ui/Button";
import { Select } from "@/ui/Field";
import { Pager, usePageSize } from "@/ui/Pager";

const SYSTEM_ACTOR = "system";
const SUPER_ACTOR = "superUser";

export function ActivityScreen() {
  const t = useT(system);
  const lang = useLang();
  const rows = useStore((s) => s.activity);
  const team = useStore((s) => s.team);
  const [actor, setActor] = useState("");
  const [entity, setEntity] = useState<ActivityEntity | "">("");
  const [page, setPage] = useState(1);
  const size = usePageSize();
  const filtered = useMemo(() => filterActivity(rows, { actor, entity }), [rows, actor, entity]);
  const current = pageOf(filtered, page, size);
  const isFiltered = actor !== "" || entity !== "";
  const entities = Object.keys(t.activity.entity) as ActivityEntity[];
  const actorLabel = (name: string) => (name === SYSTEM_ACTOR ? "System" : name);

  return (
    <div className="sy-page">
      <PageHead id="activity" title={fmt(t.activity.title, { n: rows.length })} rule={<Intro>{t.activity.intro}</Intro>} />
      <Panel>
        <div className="sy-filters sy-filters-2">
          <Select
            label={t.activity.who}
            value={actor}
            onChange={(e) => {
              setActor(e.target.value);
              setPage(1);
            }}
          >
            <option value="">{t.activity.everyone}</option>
            {team.map((member) => (
              <option key={member.profile} value={member.name}>
                {member.name}
              </option>
            ))}
            <option value={SUPER_ACTOR}>{SUPER_ACTOR}</option>
            <option value={SYSTEM_ACTOR}>{t.activity.system}</option>
          </Select>
          <Select
            label={t.activity.about}
            value={entity}
            onChange={(e) => {
              setEntity(e.target.value as ActivityEntity | "");
              setPage(1);
            }}
          >
            <option value="">{t.activity.everything}</option>
            {entities.map((key) => (
              <option key={key} value={key}>
                {t.activity.entity[key]}
              </option>
            ))}
          </Select>
          {isFiltered ? (
            <Button
              variant="ghost"
              onClick={() => {
                setActor("");
                setEntity("");
                setPage(1);
              }}
            >
              {t.activity.clear}
            </Button>
          ) : (
            <span aria-hidden="true" />
          )}
        </div>
        {filtered.length === 0 ? (
          <EmptyBox>
            <History size={18} aria-hidden="true" className="sy-emptyicon" />
            {isFiltered ? t.activity.emptyFiltered : t.activity.empty}
          </EmptyBox>
        ) : (
          <>
            <ul className="sy-log" aria-label={t.activity.intro}>
              {current.rows.map((row) => (
                <li key={row.id}>
                  <span className="sy-log-time type-mono-s">{formatStamp(row.at)}</span>
                  <span className="sy-log-actor type-small">{actorLabel(row.actor)}</span>
                  <span className="sy-log-text type-body">{activityText(row.detail, lang)}</span>
                  <span className="sy-log-code type-mono-s">
                    <Mono small>{row.action}</Mono>
                  </span>
                </li>
              ))}
            </ul>
            <div className="sy-pagerow">
              <span className="type-small sy-muted">{fmt(t.activity.countOf, { total: filtered.length })}</span>
              {current.pages > 1 ? <Pager page={current.page} pages={current.pages} onPage={setPage} /> : null}
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}
