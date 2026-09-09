import type { Item } from "@owlbear-rodeo/sdk";
import {
  ITEM_INHERITANCE_METADATA_KEY,
  ITEM_LOCAL_STATE_METADATA_KEY,
  ITEM_TRANSPARENCY_METADATA_KEY,
  LEGACY_ITEM_INHERITANCE_METADATA_KEY,
  LEGACY_ITEM_LOCAL_STATE_METADATA_KEY,
  LEGACY_ITEM_TRANSPARENCY_METADATA_KEY,
  LEGACY_MINIMIZED_LAYOUT_METADATA_KEY,
  LEGACY_VIRTUAL_LAYER_METADATA_KEY,
  LEGACY_VIRTUAL_LAYERS_METADATA_KEY,
  LEGACY_V1_ITEM_INHERITANCE_METADATA_KEY,
  LEGACY_V1_ITEM_LOCAL_STATE_METADATA_KEY,
  LEGACY_V1_ITEM_TRANSPARENCY_METADATA_KEY,
  LEGACY_V1_VIRTUAL_LAYER_METADATA_KEY,
  LEGACY_V1_VIRTUAL_LAYERS_METADATA_KEY,
  MINIMIZED_LAYOUT_METADATA_KEY,
  VIRTUAL_LAYER_METADATA_KEY,
  VIRTUAL_LAYERS_METADATA_KEY,
} from "./constants.ts";

const v1ItemKeyPairs = [
  [LEGACY_V1_VIRTUAL_LAYER_METADATA_KEY, VIRTUAL_LAYER_METADATA_KEY],
  [LEGACY_V1_ITEM_INHERITANCE_METADATA_KEY, ITEM_INHERITANCE_METADATA_KEY],
  [LEGACY_V1_ITEM_TRANSPARENCY_METADATA_KEY, ITEM_TRANSPARENCY_METADATA_KEY],
  [LEGACY_V1_ITEM_LOCAL_STATE_METADATA_KEY, ITEM_LOCAL_STATE_METADATA_KEY],
] as const;

const v0ItemKeyPairs = [
  [LEGACY_VIRTUAL_LAYER_METADATA_KEY, VIRTUAL_LAYER_METADATA_KEY],
  [LEGACY_ITEM_INHERITANCE_METADATA_KEY, ITEM_INHERITANCE_METADATA_KEY],
  [LEGACY_ITEM_TRANSPARENCY_METADATA_KEY, ITEM_TRANSPARENCY_METADATA_KEY],
  [LEGACY_ITEM_LOCAL_STATE_METADATA_KEY, ITEM_LOCAL_STATE_METADATA_KEY],
] as const;

type MigrationSource = "v0" | "v1";

export function isMigratableOutlinerV0Document(value: unknown) {
  return Boolean(value && typeof value === "object" &&
    (value as { version?: unknown }).version === 2 &&
    Array.isArray((value as { layers?: unknown }).layers));
}

export function isMigratableOutlinerV1Document(value: unknown) {
  return Boolean(value && typeof value === "object" &&
    (value as { version?: unknown }).version === 3 &&
    Array.isArray((value as { layers?: unknown }).layers));
}

function itemKeyPairs(source: MigrationSource) {
  return source === "v1" ? v1ItemKeyPairs : v0ItemKeyPairs;
}

export function migratableItemIds(items: Array<Pick<Item, "id" | "metadata">>, source: MigrationSource = "v1") {
  return items.filter((item) => itemKeyPairs(source).some(([sourceKey]) =>
    Object.prototype.hasOwnProperty.call(item.metadata, sourceKey))).map((item) => item.id);
}

export function copyOutlinerItemMetadata(item: Pick<Item, "metadata">, migrationSource: MigrationSource = "v1") {
  for (const [source, destination] of itemKeyPairs(migrationSource)) {
    if (Object.prototype.hasOwnProperty.call(item.metadata, source)) {
      item.metadata[destination] = item.metadata[source];
    }
  }
}

export const copyOutlinerV1ItemMetadata = copyOutlinerItemMetadata;

export function convertOutlinerV0Document(value: unknown) {
  if (!isMigratableOutlinerV0Document(value)) throw new Error("The Outliner+ beta scene data is missing or incompatible.");
  return { ...(value as Record<string, unknown>), version: 3 };
}

export function outlinerV1SceneMetadataUpdate(metadata: Record<string, unknown>) {
  const v1Document = metadata[LEGACY_V1_VIRTUAL_LAYERS_METADATA_KEY];
  const source: MigrationSource = isMigratableOutlinerV1Document(v1Document) ? "v1" : "v0";
  const document = source === "v1" ? v1Document : convertOutlinerV0Document(metadata[LEGACY_VIRTUAL_LAYERS_METADATA_KEY]);
  return {
    source,
    update: {
    [VIRTUAL_LAYERS_METADATA_KEY]: document,
    ...(Object.prototype.hasOwnProperty.call(metadata, LEGACY_MINIMIZED_LAYOUT_METADATA_KEY)
      ? { [MINIMIZED_LAYOUT_METADATA_KEY]: metadata[LEGACY_MINIMIZED_LAYOUT_METADATA_KEY] }
      : {}),
    },
  };
}

export interface NamespaceMigrationApi {
  getSceneMetadata: () => Promise<Record<string, unknown>>;
  getItems: () => Promise<Array<Pick<Item, "id" | "metadata">>>;
  updateItems: (ids: string[], update: (items: Array<Pick<Item, "metadata">>) => void) => Promise<void>;
  setSceneMetadata: (update: Record<string, unknown>) => Promise<void>;
}

export async function runOutlinerV1NamespaceConversion(api: NamespaceMigrationApi) {
  const metadata = await api.getSceneMetadata();
  const { source, update: sceneUpdate } = outlinerV1SceneMetadataUpdate(metadata);
  const items = await api.getItems();
  const itemIds = migratableItemIds(items, source);
  if (itemIds.length) await api.updateItems(itemIds, (draft) => {
    for (const item of draft) copyOutlinerItemMetadata(item, source);
  });
  await api.setSceneMetadata(sceneUpdate);
}
