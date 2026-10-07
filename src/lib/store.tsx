"use client";

import { createContext, useContext, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Issue, Item } from "./types";
import {
  addItemAction,
  addVipAction,
  deleteIssueAction,
  deleteItemAction,
  issueItemAction,
  returnIssueAction,
  setItemPhotoAction,
  updateItemAction,
  type ItemDraft,
  type IssueDraft,
  type Result,
} from "@/server/actions";

export type { ItemDraft, IssueDraft };

/** Server actions report failures as data; the UI already handles exceptions. */
function unwrap<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

type Store = {
  items: Item[];
  issues: Issue[];
  vipOptions: string[];
  issuedOut: Record<string, number>;
  inStock: Record<string, number>;
  addItem: (draft: ItemDraft) => Promise<Item>;
  updateItem: (id: string, patch: Partial<ItemDraft>) => Promise<void>;
  setItemImage: (id: string, dataUrl: string | null) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  addVipOption: (name: string) => Promise<string>;
  issueItem: (draft: IssueDraft) => Promise<Issue>;
  returnIssue: (issueId: string, qty: number) => Promise<void>;
  deleteIssue: (issueId: string) => Promise<void>;
};

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({
  items,
  issues,
  vips,
  children,
}: {
  items: Item[];
  issues: Issue[];
  vips: string[];
  children: React.ReactNode;
}) {
  const router = useRouter();

  const value = useMemo<Store>(() => {
    const issuedOut: Record<string, number> = {};
    for (const issue of issues) {
      const open = Math.max(0, issue.quantity - issue.returnedQty);
      if (open > 0) issuedOut[issue.itemId] = (issuedOut[issue.itemId] ?? 0) + open;
    }
    const inStock: Record<string, number> = {};
    for (const item of items) {
      inStock[item.id] = Math.max(0, item.totalQuantity - (issuedOut[item.id] ?? 0));
    }

    // Each mutation re-renders the server component, which re-sends the data.
    const after = <T,>(result: Result<T>): T => {
      const data = unwrap(result);
      router.refresh();
      return data;
    };

    return {
      items,
      issues,
      vipOptions: [...new Set([...vips, ...items.map((i) => i.vip).filter(Boolean)])],
      issuedOut,
      inStock,
      addItem: async (draft) => after(await addItemAction(draft)),
      updateItem: async (id, patch) => {
        after(await updateItemAction(id, patch));
      },
      setItemImage: async (id, dataUrl) => {
        after(await setItemPhotoAction(id, dataUrl));
      },
      deleteItem: async (id) => {
        after(await deleteItemAction(id));
      },
      addVipOption: async (name) => after(await addVipAction(name)),
      issueItem: async (draft) => after(await issueItemAction(draft)),
      returnIssue: async (issueId, qty) => {
        after(await returnIssueAction(issueId, qty));
      },
      deleteIssue: async (issueId) => {
        after(await deleteIssueAction(issueId));
      },
    };
  }, [items, issues, vips, router]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}
