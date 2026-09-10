import type { Item } from "@owlbear-rodeo/sdk";

export function itemDeleteTargets(items: readonly Item[], selection: readonly string[] | null | undefined, clickedId: string, canDelete: (item: Item) => boolean) {
  const selected = selection?.includes(clickedId) ? new Set(selection) : undefined;
  return items.filter((item) => (selected ? selected.has(item.id) : item.id === clickedId) && canDelete(item)).map((item) => item.id);
}
