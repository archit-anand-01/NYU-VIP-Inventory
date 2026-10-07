"use client";

import { useRef, useState } from "react";
import Modal from "./Modal";
import { fileToDataUrl } from "@/lib/images";
import { photoUrl } from "./ItemPhoto";
import { useStore } from "@/lib/store";
import { generateItemId } from "@/lib/id";
import type { Item } from "@/lib/types";

const ADD_NEW = "__add_new_vip__";

export default function ItemFormModal({
  item,
  onClose,
}: {
  /** undefined = create a new item */
  item?: Item;
  onClose: () => void;
}) {
  const { addItem, updateItem, setItemImage, issuedOut, items, vipOptions, addVipOption } =
    useStore();
  const existingPhoto = item?.hasImage ? photoUrl(item.id, item.updatedAt) : null;

  const [name, setName] = useState(item?.name ?? "");
  const [totalQuantity, setTotalQuantity] = useState(String(item?.totalQuantity ?? 1));
  const [vip, setVip] = useState(item?.vip ?? "");
  // "+ Add new VIP" swaps the dropdown for a text box.
  const [addingVip, setAddingVip] = useState(false);
  const [newVip, setNewVip] = useState("");
  const [location, setLocation] = useState(item?.location ?? "");
  const [notes, setNotes] = useState(item?.notes ?? "");
  // Until the user picks or clears a photo, show whatever is already stored.
  const [pickedPhoto, setPickedPhoto] = useState<string | null>(null);
  const [photoTouched, setPhotoTouched] = useState(false);
  const photo = photoTouched ? pickedPhoto : existingPhoto;
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const out = item ? issuedOut[item.id] ?? 0 : 0;
  const effectiveVip = addingVip ? newVip.trim() : vip;
  // Show the caller what ID this item is about to get.
  const previewId = item ? item.id : generateItemId(effectiveVip, items.map((i) => i.id));

  async function onPickFile(file: File | undefined) {
    if (!file) return;
    setError("");
    try {
      setBusy(true);
      setPickedPhoto(await fileToDataUrl(file));
      setPhotoTouched(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that image.");
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Item name is required.");
      return;
    }
    const qty = Math.floor(Number(totalQuantity));
    if (!Number.isFinite(qty) || qty < 0) {
      setError("Total quantity must be 0 or more.");
      return;
    }
    if (item && qty < out) {
      setError(`${out} unit${out === 1 ? "" : "s"} are still issued out — total can't go below that.`);
      return;
    }

    setBusy(true);
    try {
      const chosenVip = addingVip ? await addVipOption(newVip) : vip;
      const draft = { name: trimmed, totalQuantity: qty, vip: chosenVip, location, notes };
      let targetId: string;
      if (item) {
        await updateItem(item.id, draft);
        targetId = item.id;
      } else {
        targetId = (await addItem(draft)).id;
      }
      // A newly picked photo is a data URL; an untouched one is just its URL.
      if (photoTouched) await setItemImage(targetId, photo);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this item.");
      setBusy(false);
    }
  }

  return (
    <Modal
      title={item ? "Edit item" : "Add item"}
      subtitle={item ? `ID ${item.id} — assigned automatically, never changes.` : "An alphanumeric ID is assigned automatically."}
      onClose={onClose}
      wide
    >
      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-[1fr_190px]">
        <div className="grid gap-4">
          <div>
            <label className="label" htmlFor="item-name">Item name *</label>
            <input
              id="item-name"
              className="field"
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Arduino Uno R3"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="item-qty">Total quantity *</label>
              <input
                id="item-qty"
                className="field"
                type="number"
                min={0}
                value={totalQuantity}
                onChange={(e) => setTotalQuantity(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted">
                In-stock is calculated: total minus whatever is currently issued out.
              </p>
            </div>
            <div>
              <label className="label" htmlFor="item-vip">VIP</label>
              {addingVip ? (
                <div className="flex gap-2">
                  <input
                    id="item-vip"
                    className="field"
                    autoFocus
                    value={newVip}
                    onChange={(e) => setNewVip(e.target.value)}
                    placeholder="New VIP name"
                  />
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setAddingVip(false);
                      setNewVip("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <select
                  id="item-vip"
                  className="field"
                  value={vip}
                  onChange={(e) => {
                    if (e.target.value === ADD_NEW) {
                      setAddingVip(true);
                      setNewVip("");
                    } else {
                      setVip(e.target.value);
                    }
                  }}
                >
                  <option value="">No VIP</option>
                  {vipOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                  <option value={ADD_NEW}>+ Add new VIP…</option>
                </select>
              )}
              <p className="mt-1 text-xs text-muted">
                {item ? `ID stays ${item.id}` : `New ID: ${previewId}`}
              </p>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="item-loc">Storage location</label>
            <input
              id="item-loc"
              className="field"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Cabinet B, Shelf 2"
            />
          </div>

          <div>
            <label className="label" htmlFor="item-notes">Notes</label>
            <textarea
              id="item-notes"
              className="field min-h-[72px] resize-y"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything worth remembering about this item"
            />
          </div>
        </div>

        <div>
          <span className="label">Photo</span>
          <div className="flex h-[150px] items-center justify-center overflow-hidden rounded-lg border border-dashed border-line bg-background">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="Item preview" className="h-full w-full object-cover" />
            ) : (
              <span className="px-3 text-center text-xs text-muted">No photo attached</span>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              void onPickFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="btn btn-ghost btn-sm flex-1"
              onClick={() => fileRef.current?.click()}
            >
              {photo ? "Replace" : "Attach photo"}
            </button>
            {photo ? (
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => {
                  setPickedPhoto(null);
                  setPhotoTouched(true);
                }}
              >
                Remove
              </button>
            ) : null}
          </div>
          <p className="mt-2 text-xs text-muted">
            Images are resized to about 1000px before they are stored.
          </p>
        </div>

        {error ? (
          <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger sm:col-span-2">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-dark" disabled={busy}>
            {item ? "Save changes" : "Add item"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
