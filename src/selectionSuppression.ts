import type { Item } from "@owlbear-rodeo/sdk";
import { getTransparentState } from "./transparentState.ts";

export function selectedSuppressedItemIds(items: Item[], selected: ReadonlySet<string>) {
  if (selected.size === 0) return [];
  return items
    .filter((item) => selected.has(item.id) && getTransparentState(item)?.source === "inherited")
    .map((item) => item.id);
}

export function retainExistingSelection(items: Item[], selected: ReadonlySet<string>) {
  const existing = new Set(items.map((item) => item.id));
  return new Set([...selected].filter((id) => existing.has(id)));
}

export function isAuthoritativeRole(role: "GM" | "PLAYER") {
  return role === "GM";
}
