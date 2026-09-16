"use client";

import { useMemo, useRef, useState } from "react";
import ItemFormModal from "@/components/ItemFormModal";
import IssueFormModal from "@/components/IssueFormModal";
import ItemPhoto from "@/components/ItemPhoto";
import Modal from "@/components/Modal";
import StatCard from "@/components/StatCard";
import { downloadFile, toCsv } from "@/lib/csv";
import { getAllImages, putImage } from "@/lib/images";
import { useStore } from "@/lib/store";
import type { Backup, Item } from "@/lib/types";

type Filter = "all" | "low" | "out";

export default function InventoryPage() {
  const { ready, items, issues, inStock, issuedOut, deleteItem, replaceAll, vipOptions } =
    useStore();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [vipFilter, setVipFilter] = useState("all");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [issuing, setIssuing] = useState<Item | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Item | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const restoreRef = useRef<HTMLInputElement>(null);

  const stats = useMemo(() => {
    const totalUnits = items.reduce((sum, i) => sum + i.totalQuantity, 0);
    const available = items.reduce((sum, i) => sum + (inStock[i.id] ?? 0), 0);
    return {
      distinct: items.length,
      totalUnits,
      available,
      out: totalUnits - available,
      vip: new Set(items.map((i) => i.vip).filter(Boolean)).size,
      empty: items.filter((i) => (inStock[i.id] ?? 0) === 0).length,
    };
  }, [items, inStock]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      const left = inStock[item.id] ?? 0;
      if (vipFilter === "none" && item.vip) return false;
      if (vipFilter !== "all" && vipFilter !== "none" && item.vip !== vipFilter) return false;
      if (filter === "out" && left > 0) return false;
      if (filter === "low" && !(left > 0 && left <= Math.max(1, Math.ceil(item.totalQuantity * 0.2))))
        return false;
      if (!q) return true;
      return [item.name, item.id, item.vip, item.location, item.notes]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [items, inStock, query, filter, vipFilter]);

  function flash(message: string) {
    setToast(message);
    setTimeout(() => setToast(""), 3200);
  }

  function exportCsv() {
    const csv = toCsv(
      ["ID", "Name", "VIP", "Total quantity", "In stock", "Issued out", "Location", "Notes"],
      items.map((item) => [
        item.id,
        item.name,
        item.vip,
        item.totalQuantity,
        inStock[item.id] ?? 0,
        issuedOut[item.id] ?? 0,
        item.location,
        item.notes,
      ]),
    );
    downloadFile(`inventory-${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv");
  }

  async function exportBackup() {
    const backup: Backup = {
      kind: "inventory-backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      items,
      issues,
      vips: vipOptions,
      images: await getAllImages(items.filter((i) => i.hasImage).map((i) => i.id)),
    };
    downloadFile(
      `inventory-backup-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(backup),
      "application/json",
    );
  }

  async function restoreBackup(file: File | undefined) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as Backup;
      if (parsed?.kind !== "inventory-backup" || !Array.isArray(parsed.items)) {
        throw new Error("not a backup");
      }
      if (
        !window.confirm(
          `Replace the current data with this backup? ${parsed.items.length} items and ${parsed.issues?.length ?? 0} issue records.`,
        )
      ) {
        return;
      }
      for (const [id, data] of Object.entries(parsed.images ?? {})) {
        await putImage(id, data);
      }
      replaceAll({ items: parsed.items, issues: parsed.issues ?? [], vips: parsed.vips });
      flash("Backup restored.");
    } catch {
      flash("That file is not a valid inventory backup.");
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Inventory</h1>
          <p className="mt-1 text-sm text-muted">
            {ready ? `${visible.length} of ${items.length} items` : "Loading…"} — every ID is assigned
            automatically.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-ghost" onClick={exportCsv} disabled={!items.length}>
            Export CSV
          </button>
          <button className="btn btn-ghost" onClick={() => void exportBackup()} disabled={!items.length}>
            Backup
          </button>
          <button className="btn btn-ghost" onClick={() => restoreRef.current?.click()}>
            Restore
          </button>
          <input
            ref={restoreRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              void restoreBackup(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <button className="btn btn-dark" onClick={() => setAdding(true)}>
            + Add item
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Distinct items" value={stats.distinct} />
        <StatCard label="Total units" value={stats.totalUnits} />
        <StatCard label="In stock" value={stats.available} tone="accent" />
        <StatCard label="Issued out" value={stats.out} tone="warn" />
        <StatCard label="VIP groups" value={stats.vip} tone="warn" />
        <StatCard label="Out of stock" value={stats.empty} tone="danger" />
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          className="field max-w-xs flex-1"
          placeholder="Search name, ID, VIP, location…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="field field-inline"
          value={vipFilter}
          onChange={(e) => setVipFilter(e.target.value)}
          aria-label="Filter by VIP"
        >
          <option value="all">All VIPs</option>
          {vipOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
          <option value="none">No VIP set</option>
        </select>
        <select
          className="field field-inline"
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
          aria-label="Filter by stock"
        >
          <option value="all">Any stock level</option>
          <option value="low">Running low</option>
          <option value="out">Out of stock</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="whitespace-nowrap border-b border-line text-left text-[0.68rem] font-bold uppercase tracking-[0.07em] text-muted">
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">VIP</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">In stock</th>
                <th className="px-4 py-3 text-right">Issued</th>
                <th className="px-4 py-3">Location</th>
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
                    {items.length === 0
                      ? "No items yet. Use “+ Add item” to create the first one."
                      : "No items match this search."}
                  </td>
                </tr>
              ) : (
                visible.map((item) => {
                  const left = inStock[item.id] ?? 0;
                  const out = issuedOut[item.id] ?? 0;
                  return (
                    <tr key={item.id} className="border-b border-line/70 last:border-0 hover:bg-background/60">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <ItemPhoto
                            id={item.id}
                            name={item.name}
                            hasImage={item.hasImage}
                            version={item.updatedAt}
                            onOpen={setLightbox}
                          />
                          <div className="min-w-0">
                            <span className="font-semibold">{item.name}</span>
                            {item.notes ? (
                              <p className="truncate text-xs text-muted">{item.notes}</p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted">{item.id}</td>
                      <td className="px-4 py-3">
                        {item.vip ? (
                          <span className="chip bg-warn-soft text-warn">{item.vip}</span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">{item.totalQuantity}</td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`chip ${
                            left === 0
                              ? "bg-danger-soft text-danger"
                              : left <= Math.ceil(item.totalQuantity * 0.2)
                                ? "bg-warn-soft text-warn"
                                : "bg-accent-soft text-accent"
                          }`}
                        >
                          {left}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-muted">{out || "—"}</td>
                      <td className="px-4 py-3 text-muted">{item.location || "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          <button
                            className="btn btn-accent btn-sm"
                            onClick={() => setIssuing(item)}
                            disabled={left < 1}
                            title={left < 1 ? "Nothing in stock to issue" : "Issue this item"}
                          >
                            Issue
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditing(item)}>
                            Edit
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(item)}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {adding ? <ItemFormModal onClose={() => setAdding(false)} /> : null}
      {editing ? <ItemFormModal item={editing} onClose={() => setEditing(null)} /> : null}
      {issuing ? (
        <IssueFormModal
          itemId={issuing.id}
          onClose={() => setIssuing(null)}
          onIssued={(person, itemName) => flash(`Issued ${itemName} to ${person}.`)}
        />
      ) : null}

      {confirmDelete ? (
        <Modal
          title="Delete item"
          subtitle={`${confirmDelete.name} — ${confirmDelete.id}`}
          onClose={() => setConfirmDelete(null)}
        >
          <p className="text-sm">
            This removes the item, its photo, and its {issues.filter((i) => i.itemId === confirmDelete.id).length}{" "}
            issue record(s). This cannot be undone.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </button>
            <button
              className="btn btn-dark"
              onClick={() => {
                deleteItem(confirmDelete.id);
                setConfirmDelete(null);
                flash("Item deleted.");
              }}
            >
              Delete permanently
            </button>
          </div>
        </Modal>
      ) : null}

      {lightbox ? (
        <Modal title="Item photo" onClose={() => setLightbox(null)} wide>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="Item" className="mx-auto max-h-[70vh] rounded-lg" />
        </Modal>
      ) : null}

      {toast ? (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-[#1b1a18] px-4 py-2.5 text-sm font-semibold text-[#fbfaf7] shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
