import type { Item } from "@owlbear-rodeo/sdk";
import type { InheritedItemState, StatefulProperty } from "./virtualLayers.ts";
import { getItemVisible, getTransparentState } from "./transparentState.ts";

// Kept literal so this pure module can run in Node's stripped-TypeScript test mode.
const ITEM_LOCAL_STATE_METADATA_KEY = "com.ex-asperis.obr-stage-manager/v1/localState";

export interface StoredLocalItemState {
  version: 1;
  values: Partial<InheritedItemState>;
}

type LocalStateItem = Pick<Item, "disableHit" | "locked" | "visible" | "metadata">;

export function parseLocalItemState(value: unknown): StoredLocalItemState | undefined {
  if (!value || typeof value !== "object" || (value as { version?: unknown }).version !== 1) return undefined;
  const raw = (value as { values?: unknown }).values;
  if (!raw || typeof raw !== "object") return undefined;
  const values: Partial<InheritedItemState> = {};
  for (const property of ["transparent", "disableHit", "locked", "visible"] as StatefulProperty[]) {
    const candidate = (raw as Partial<InheritedItemState>)[property];
    if (typeof candidate === "boolean") values[property] = candidate;
  }
  return Object.keys(values).length ? { version: 1, values } : undefined;
}

export function getStoredLocalItemState(item: Pick<Item, "metadata">) {
  return parseLocalItemState(item.metadata[ITEM_LOCAL_STATE_METADATA_KEY]);
}

export function readUnshadowedLocalProperty(item: LocalStateItem, property: StatefulProperty) {
  if (property === "transparent") return getTransparentState(item)?.source === "direct";
  if (property === "visible") return getItemVisible(item);
  if (property === "disableHit") return item.disableHit === true;
  return item.locked;
}

export function getLocalItemProperty(item: LocalStateItem, property: StatefulProperty) {
  return getStoredLocalItemState(item)?.values[property] ?? readUnshadowedLocalProperty(item, property);
}

export function storeLocalItemProperty(item: Item, property: StatefulProperty, value: boolean) {
  const stored = getStoredLocalItemState(item);
  item.metadata[ITEM_LOCAL_STATE_METADATA_KEY] = {
    version: 1,
    values: { ...stored?.values, [property]: value },
  } satisfies StoredLocalItemState;
}

export function updateShadowedLocalItemProperty(item: Item, property: StatefulProperty, value: boolean) {
  if (getStoredLocalItemState(item)?.values[property] === undefined) return false;
  storeLocalItemProperty(item, property, value);
  return true;
}

export function captureLocalItemProperty(item: Item, property: StatefulProperty) {
  if (getStoredLocalItemState(item)?.values[property] !== undefined) return;
  storeLocalItemProperty(item, property, readUnshadowedLocalProperty(item, property));
}

export function releaseLocalItemProperty(item: Item, property: StatefulProperty) {
  const stored = getStoredLocalItemState(item);
  if (!stored || stored.values[property] === undefined) return undefined;
  const value = stored.values[property];
  const values = { ...stored.values };
  delete values[property];
  if (Object.keys(values).length) item.metadata[ITEM_LOCAL_STATE_METADATA_KEY] = { version: 1, values };
  else delete item.metadata[ITEM_LOCAL_STATE_METADATA_KEY];
  return value;
}
