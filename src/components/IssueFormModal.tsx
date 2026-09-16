"use client";

import { useState } from "react";
import Modal from "./Modal";
import ItemPhoto from "./ItemPhoto";
import { useStore } from "@/lib/store";
import { today } from "@/lib/csv";

export default function IssueFormModal({
  itemId,
  onClose,
  onIssued,
}: {
  itemId: string;
  onClose: () => void;
  onIssued?: (personName: string, itemName: string) => void;
}) {
  const { items, inStock, issueItem } = useStore();
  const [selectedId, setSelectedId] = useState(itemId);
  const [personName, setPersonName] = useState("");
  const [netId, setNetId] = useState("");
  const [phone, setPhone] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const item = items.find((i) => i.id === selectedId);
  const available = item ? inStock[item.id] ?? 0 : 0;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!item) {
      setError("Pick an item to issue.");
      return;
    }
    if (!personName.trim()) {
      setError("Name is required.");
      return;
    }
    if (!netId.trim()) {
      setError("NetID is required.");
      return;
    }
    if (!date) {
      setError("Pick a date.");
      return;
    }
    try {
      issueItem({
        itemId: item.id,
        personName,
        netId,
        phone,
        quantity: Number(quantity),
        date,
        note,
      });
      onIssued?.(personName.trim(), item.name);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record this issue.");
    }
  }

  return (
    <Modal title="Issue item" subtitle="Records who took it, and drops the in-stock count." onClose={onClose}>
      <form onSubmit={onSubmit} className="grid gap-4">
        <div className="flex items-center gap-3 rounded-lg border border-line bg-background p-3">
          {item ? (
            <ItemPhoto
              id={item.id}
              name={item.name}
              hasImage={item.hasImage}
              version={item.updatedAt}
              className="h-12 w-12"
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <select
              className="field"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              aria-label="Item to issue"
            >
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} — {i.id} ({inStock[i.id] ?? 0} in stock)
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted">
              {available} in stock{item?.vip ? ` — VIP: ${item.vip}` : ""}
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="issue-name">Name *</label>
            <input
              id="issue-name"
              className="field"
              autoFocus
              value={personName}
              onChange={(e) => setPersonName(e.target.value)}
              placeholder="Full name"
            />
          </div>
          <div>
            <label className="label" htmlFor="issue-netid">NetID *</label>
            <input
              id="issue-netid"
              className="field"
              value={netId}
              onChange={(e) => setNetId(e.target.value)}
              placeholder="e.g. aa1234"
            />
          </div>
          <div>
            <label className="label" htmlFor="issue-phone">Phone</label>
            <input
              id="issue-phone"
              className="field"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 123-4567"
            />
          </div>
          <div>
            <label className="label" htmlFor="issue-qty">Quantity *</label>
            <input
              id="issue-qty"
              className="field"
              type="number"
              min={1}
              max={Math.max(1, available)}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="issue-date">Date *</label>
            <input
              id="issue-date"
              className="field"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="issue-note">Note</label>
            <input
              id="issue-note"
              className="field"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional — purpose, expected return, etc."
            />
          </div>
        </div>

        {error ? (
          <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger">{error}</p>
        ) : null}

        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-accent" disabled={available < 1}>
            Issue item
          </button>
        </div>
      </form>
    </Modal>
  );
}
