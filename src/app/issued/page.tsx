"use client";

import { useMemo, useState } from "react";
import Modal from "@/components/Modal";
import StatCard from "@/components/StatCard";
import { downloadFile, formatDate, toCsv } from "@/lib/csv";
import { useStore } from "@/lib/store";
import type { Issue } from "@/lib/types";

type Status = "all" | "open" | "returned";
type View = "log" | "people";

function openQty(issue: Issue) {
  return Math.max(0, issue.quantity - issue.returnedQty);
}

export default function IssuedPage() {
  const { ready, issues, items, returnIssue, deleteIssue } = useStore();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [view, setView] = useState<View>("log");
  const [returning, setReturning] = useState<Issue | null>(null);
  const [returnQty, setReturnQty] = useState("1");
  const [confirmDelete, setConfirmDelete] = useState<Issue | null>(null);

  const sorted = useMemo(
    () => [...issues].sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date))),
    [issues],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sorted.filter((issue) => {
      const left = openQty(issue);
      if (status === "open" && left === 0) return false;
      if (status === "returned" && left > 0) return false;
      if (!q) return true;
      return [issue.personName, issue.netId, issue.phone, issue.itemName, issue.itemId, issue.note]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [sorted, query, status]);

  const people = useMemo(() => {
    const map = new Map<string, { name: string; netId: string; phone: string; records: Issue[] }>();
    for (const issue of visible) {
      const key = (issue.netId || issue.personName).toLowerCase();
      const entry = map.get(key) ?? {
        name: issue.personName,
        netId: issue.netId,
        phone: issue.phone,
        records: [],
      };
      entry.phone = entry.phone || issue.phone;
      entry.records.push(issue);
      map.set(key, entry);
    }
    return [...map.values()].sort(
      (a, b) =>
        b.records.reduce((s, r) => s + openQty(r), 0) - a.records.reduce((s, r) => s + openQty(r), 0) ||
        a.name.localeCompare(b.name),
    );
  }, [visible]);

  const stats = useMemo(() => {
    const open = issues.filter((i) => openQty(i) > 0);
    return {
      records: issues.length,
      open: open.length,
      unitsOut: open.reduce((sum, i) => sum + openQty(i), 0),
      holders: new Set(open.map((i) => (i.netId || i.personName).toLowerCase())).size,
    };
  }, [issues]);

  function exportCsv() {
    const csv = toCsv(
      ["Date", "Item", "Item ID", "Name", "NetID", "Phone", "Quantity", "Returned", "Outstanding", "Status", "Note"],
      sorted.map((issue) => [
        issue.date,
        issue.itemName,
        issue.itemId,
        issue.personName,
        issue.netId,
        issue.phone,
        issue.quantity,
        issue.returnedQty,
        openQty(issue),
        openQty(issue) === 0 ? "Returned" : "Out",
        issue.note,
      ]),
    );
    downloadFile(`issued-log-${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv");
  }

  function statusChip(issue: Issue) {
    const left = openQty(issue);
    if (left === 0) return <span className="chip bg-accent-soft text-accent">Returned</span>;
    if (issue.returnedQty > 0)
      return <span className="chip bg-warn-soft text-warn">{left} still out</span>;
    return <span className="chip bg-warn-soft text-warn">Out</span>;
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Issued Log</h1>
          <p className="mt-1 text-sm text-muted">
            {ready ? `${visible.length} of ${issues.length} records` : "Loading…"} — who has what, and
            what is still out.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-lg border border-line bg-surface p-0.5">
            {(["log", "people"] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
                  view === v ? "bg-[#1b1a18] text-[#fbfaf7]" : "text-muted hover:text-foreground"
                }`}
              >
                {v === "log" ? "Log" : "By person"}
              </button>
            ))}
          </div>
          <button className="btn btn-ghost" onClick={exportCsv} disabled={!issues.length}>
            Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total records" value={stats.records} />
        <StatCard label="Still out" value={stats.open} tone="warn" />
        <StatCard label="Units out" value={stats.unitsOut} tone="warn" />
        <StatCard label="People holding items" value={stats.holders} tone="accent" />
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          className="field max-w-xs flex-1"
          placeholder="Search person, NetID, item…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="field field-inline"
          value={status}
          onChange={(e) => setStatus(e.target.value as Status)}
          aria-label="Filter by status"
        >
          <option value="all">All records</option>
          <option value="open">Still out</option>
          <option value="returned">Fully returned</option>
        </select>
      </div>

      {view === "log" ? (
        <>
        <div className="card hidden overflow-hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[0.68rem] font-bold uppercase tracking-[0.07em] text-muted">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Person</th>
                  <th className="px-4 py-3">NetID</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {!ready ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-muted">
                      Loading…
                    </td>
                  </tr>
                ) : visible.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-muted">
                      {issues.length === 0
                        ? "Nothing issued yet. Use the Issue button on the Inventory page."
                        : "No records match this search."}
                    </td>
                  </tr>
                ) : (
                  visible.map((issue) => (
                    <tr key={issue.id} className="border-b border-line/70 last:border-0 hover:bg-background/60">
                      <td className="whitespace-nowrap px-4 py-3">{formatDate(issue.date)}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold">{issue.itemName}</div>
                        <div className="font-mono text-xs text-muted">{issue.itemId}</div>
                        {issue.note ? <div className="text-xs text-muted">{issue.note}</div> : null}
                      </td>
                      <td className="px-4 py-3 font-semibold">{issue.personName}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted">{issue.netId || "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted">{issue.phone || "—"}</td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {issue.quantity}
                        {issue.returnedQty > 0 ? (
                          <span className="text-xs font-normal text-muted"> ({issue.returnedQty} back)</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">{statusChip(issue)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          <button
                            className="btn btn-accent btn-sm"
                            disabled={openQty(issue) === 0}
                            onClick={() => {
                              setReturning(issue);
                              setReturnQty(String(openQty(issue)));
                            }}
                          >
                            Return
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(issue)}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid gap-3 md:hidden">
          {!ready ? (
            <div className="card px-4 py-10 text-center text-muted">Loading…</div>
          ) : visible.length === 0 ? (
            <div className="card px-4 py-10 text-center text-muted">
              {issues.length === 0
                ? "Nothing issued yet. Use the Issue button on the Inventory page."
                : "No records match this search."}
            </div>
          ) : (
            visible.map((issue) => (
              <div key={issue.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold">{issue.itemName}</p>
                    <p className="font-mono text-xs text-muted">{issue.itemId}</p>
                  </div>
                  {statusChip(issue)}
                </div>
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                  <dt className="text-muted">Person</dt>
                  <dd className="font-semibold">{issue.personName}</dd>
                  <dt className="text-muted">NetID</dt>
                  <dd className="font-mono text-xs">{issue.netId || "—"}</dd>
                  <dt className="text-muted">Phone</dt>
                  <dd>{issue.phone || "—"}</dd>
                  <dt className="text-muted">Quantity</dt>
                  <dd>
                    {issue.quantity}
                    {issue.returnedQty > 0 ? (
                      <span className="text-muted"> ({issue.returnedQty} back)</span>
                    ) : null}
                  </dd>
                  <dt className="text-muted">Date</dt>
                  <dd>{formatDate(issue.date)}</dd>
                  {issue.note ? (
                    <>
                      <dt className="text-muted">Note</dt>
                      <dd>{issue.note}</dd>
                    </>
                  ) : null}
                </dl>
                <div className="mt-3 flex gap-2">
                  <button
                    className="btn btn-accent flex-1"
                    disabled={openQty(issue) === 0}
                    onClick={() => {
                      setReturning(issue);
                      setReturnQty(String(openQty(issue)));
                    }}
                  >
                    Return
                  </button>
                  <button className="btn btn-danger" onClick={() => setConfirmDelete(issue)}>
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        </>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {people.length === 0 ? (
            <div className="card px-4 py-12 text-center text-muted md:col-span-2">
              No one matches this search.
            </div>
          ) : (
            people.map((person) => {
              const out = person.records.reduce((sum, r) => sum + openQty(r), 0);
              return (
                <div key={person.netId + person.name} className="card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold">{person.name}</h3>
                      <p className="text-xs text-muted">
                        <span className="font-mono">{person.netId || "no netID"}</span>
                        {person.phone ? ` · ${person.phone}` : ""}
                      </p>
                    </div>
                    <span className={`chip ${out > 0 ? "bg-warn-soft text-warn" : "bg-accent-soft text-accent"}`}>
                      {out > 0 ? `${out} out` : "All returned"}
                    </span>
                  </div>
                  <ul className="mt-3 grid gap-1.5">
                    {person.records.map((record) => (
                      <li
                        key={record.id}
                        className="flex items-center justify-between gap-3 rounded-lg bg-background px-3 py-2 text-sm"
                      >
                        <span className="min-w-0">
                          <span className="font-semibold">{record.itemName}</span>
                          <span className="text-muted"> × {record.quantity}</span>
                          <span className="block text-xs text-muted">
                            {formatDate(record.date)} · {record.itemId}
                          </span>
                        </span>
                        {openQty(record) === 0 ? (
                          <span className="chip bg-accent-soft text-accent">Returned</span>
                        ) : (
                          <button
                            className="btn btn-accent btn-sm"
                            onClick={() => {
                              setReturning(record);
                              setReturnQty(String(openQty(record)));
                            }}
                          >
                            Return
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })
          )}
        </div>
      )}

      {returning ? (
        <Modal
          title="Record a return"
          subtitle={`${returning.itemName} — ${returning.personName}`}
          onClose={() => setReturning(null)}
        >
          <label className="label" htmlFor="return-qty">
            Units returned (max {openQty(returning)})
          </label>
          <input
            id="return-qty"
            className="field"
            type="number"
            min={1}
            max={openQty(returning)}
            value={returnQty}
            autoFocus
            onChange={(e) => setReturnQty(e.target.value)}
          />
          <p className="mt-2 text-xs text-muted">Returned units go straight back into in-stock.</p>
          <div className="mt-5 flex justify-end gap-2">
            <button className="btn btn-ghost" onClick={() => setReturning(null)}>
              Cancel
            </button>
            <button
              className="btn btn-accent"
              onClick={() => {
                returnIssue(returning.id, Number(returnQty));
                setReturning(null);
              }}
            >
              Confirm return
            </button>
          </div>
        </Modal>
      ) : null}

      {confirmDelete ? (
        <Modal
          title="Delete record"
          subtitle={`${confirmDelete.itemName} — ${confirmDelete.personName}`}
          onClose={() => setConfirmDelete(null)}
        >
          <p className="text-sm">
            Deleting this record removes it from the log
            {openQty(confirmDelete) > 0
              ? ` and puts ${openQty(confirmDelete)} unit(s) back in stock`
              : ""}
            . This cannot be undone.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </button>
            <button
              className="btn btn-dark"
              onClick={() => {
                deleteIssue(confirmDelete.id);
                setConfirmDelete(null);
              }}
            >
              Delete permanently
            </button>
          </div>
        </Modal>
      ) : null}

      {items.length === 0 && issues.length === 0 && ready ? (
        <p className="text-center text-sm text-muted">
          Add items on the Inventory page first — the Issue button lives on each row.
        </p>
      ) : null}
    </div>
  );
}
