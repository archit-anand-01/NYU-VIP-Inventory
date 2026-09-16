export type Item = {
  /** Auto-generated alphanumeric ID, e.g. "IN7K3MQ2". Never changes. */
  id: string;
  name: string;
  totalQuantity: number;
  /** Free-text VIP group the item belongs to, e.g. "Desire Path" or "Mechanical". */
  vip: string;
  location: string;
  notes: string;
  /** true when a photo for this item exists in IndexedDB under this id. */
  hasImage: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Issue = {
  id: string;
  itemId: string;
  /** Snapshot of the item name at issue time, so the log survives renames. */
  itemName: string;
  personName: string;
  netId: string;
  phone: string;
  quantity: number;
  /** ISO date (yyyy-mm-dd) the item was handed over. */
  date: string;
  returnedQty: number;
  note: string;
  createdAt: string;
};

export type Backup = {
  kind: "inventory-backup";
  version: 1;
  exportedAt: string;
  items: Item[];
  issues: Issue[];
  images: Record<string, string>;
  /** The VIP dropdown list, so a restore brings custom VIPs back too. */
  vips?: string[];
};
