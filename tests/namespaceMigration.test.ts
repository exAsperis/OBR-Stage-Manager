import assert from "node:assert/strict";
import test from "node:test";
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
} from "../src/constants.ts";
import { convertOutlinerV0Document, copyOutlinerItemMetadata, copyOutlinerV1ItemMetadata, isMigratableOutlinerV0Document, migratableItemIds, outlinerV1SceneMetadataUpdate, runOutlinerV1NamespaceConversion } from "../src/namespaceMigration.ts";

const document = { version: 3, layers: [{ id: "roof", name: "Roof", obrLayer: "PROP", order: 0 }] };

test("copies the compatible scene document and optional minimized layout without changing sources", () => {
  const layout = { version: 1, dimensions: {} };
  const metadata = { [LEGACY_V1_VIRTUAL_LAYERS_METADATA_KEY]: document, [LEGACY_MINIMIZED_LAYOUT_METADATA_KEY]: layout };
  assert.deepEqual(outlinerV1SceneMetadataUpdate(metadata), {
    source: "v1",
    update: { [VIRTUAL_LAYERS_METADATA_KEY]: document, [MINIMIZED_LAYOUT_METADATA_KEY]: layout },
  });
  assert.equal(metadata[LEGACY_V1_VIRTUAL_LAYERS_METADATA_KEY], document);
  assert.deepEqual(outlinerV1SceneMetadataUpdate({ [LEGACY_V1_VIRTUAL_LAYERS_METADATA_KEY]: document }), {
    source: "v1",
    update: { [VIRTUAL_LAYERS_METADATA_KEY]: document },
  });
});

test("rejects missing and incompatible Outliner+ v1 scene documents", () => {
  assert.throws(() => outlinerV1SceneMetadataUpdate({}), /missing or incompatible/);
  assert.throws(() => outlinerV1SceneMetadataUpdate({ [LEGACY_V1_VIRTUAL_LAYERS_METADATA_KEY]: { version: 2, layers: [] } }), /missing or incompatible/);
});

test("promotes only beta schema version 2 and leaves non-beta schema version 1 unsupported", () => {
  const beta = { version: 2, layers: document.layers, stateSelections: { house: "night" } };
  assert.equal(isMigratableOutlinerV0Document(beta), true);
  assert.equal(isMigratableOutlinerV0Document({ ...beta, version: 1 }), false);
  assert.deepEqual(convertOutlinerV0Document(beta), { ...beta, version: 3 });
  assert.deepEqual(outlinerV1SceneMetadataUpdate({ [LEGACY_VIRTUAL_LAYERS_METADATA_KEY]: beta }), {
    source: "v0",
    update: { [VIRTUAL_LAYERS_METADATA_KEY]: { ...beta, version: 3 } },
  });
  assert.throws(() => convertOutlinerV0Document({ ...beta, version: 1 }), /missing or incompatible/);
});

test("copies beta-era unversioned item metadata while retaining old keys", () => {
  const sources = {
    [LEGACY_VIRTUAL_LAYER_METADATA_KEY]: { virtualLayerId: "roof" },
    [LEGACY_ITEM_INHERITANCE_METADATA_KEY]: { independent: true },
    [LEGACY_ITEM_TRANSPARENCY_METADATA_KEY]: { scale: { x: 1, y: 1 }, source: "direct" },
    [LEGACY_ITEM_LOCAL_STATE_METADATA_KEY]: { version: 1, values: { visible: true } },
  };
  const item = { id: "beta", metadata: { ...sources } };
  copyOutlinerItemMetadata(item, "v0");
  assert.deepEqual(item.metadata[VIRTUAL_LAYER_METADATA_KEY], sources[LEGACY_VIRTUAL_LAYER_METADATA_KEY]);
  assert.deepEqual(item.metadata[ITEM_INHERITANCE_METADATA_KEY], sources[LEGACY_ITEM_INHERITANCE_METADATA_KEY]);
  assert.deepEqual(item.metadata[ITEM_TRANSPARENCY_METADATA_KEY], sources[LEGACY_ITEM_TRANSPARENCY_METADATA_KEY]);
  assert.deepEqual(item.metadata[ITEM_LOCAL_STATE_METADATA_KEY], sources[LEGACY_ITEM_LOCAL_STATE_METADATA_KEY]);
  for (const [key, value] of Object.entries(sources)) assert.equal(item.metadata[key], value);
});

test("copies every present item key, preserves sources, and overwrites retry destinations", () => {
  const sources = {
    [LEGACY_V1_VIRTUAL_LAYER_METADATA_KEY]: { virtualLayerId: "roof" },
    [LEGACY_V1_ITEM_INHERITANCE_METADATA_KEY]: { independent: true },
    [LEGACY_V1_ITEM_TRANSPARENCY_METADATA_KEY]: { source: "direct" },
    [LEGACY_V1_ITEM_LOCAL_STATE_METADATA_KEY]: { version: 1, values: { locked: false } },
  };
  const item = { id: "a", metadata: { ...sources, [VIRTUAL_LAYER_METADATA_KEY]: { virtualLayerId: "stale" } } };
  copyOutlinerV1ItemMetadata(item);
  assert.deepEqual(item.metadata[VIRTUAL_LAYER_METADATA_KEY], sources[LEGACY_V1_VIRTUAL_LAYER_METADATA_KEY]);
  assert.deepEqual(item.metadata[ITEM_INHERITANCE_METADATA_KEY], sources[LEGACY_V1_ITEM_INHERITANCE_METADATA_KEY]);
  assert.deepEqual(item.metadata[ITEM_TRANSPARENCY_METADATA_KEY], sources[LEGACY_V1_ITEM_TRANSPARENCY_METADATA_KEY]);
  assert.deepEqual(item.metadata[ITEM_LOCAL_STATE_METADATA_KEY], sources[LEGACY_V1_ITEM_LOCAL_STATE_METADATA_KEY]);
  for (const [key, value] of Object.entries(sources)) assert.equal(item.metadata[key], value);
});

test("selects only items that contain migratable metadata and leaves partial items partial", () => {
  const items = [
    { id: "empty", metadata: {} },
    { id: "assigned", metadata: { [LEGACY_V1_VIRTUAL_LAYER_METADATA_KEY]: { virtualLayerId: "roof" } } },
    { id: "rule", metadata: { [LEGACY_V1_ITEM_INHERITANCE_METADATA_KEY]: { independent: true } } },
  ];
  assert.deepEqual(migratableItemIds(items), ["assigned", "rule"]);
  copyOutlinerV1ItemMetadata(items[2]);
  assert.deepEqual(items[2].metadata[ITEM_INHERITANCE_METADATA_KEY], { independent: true });
  assert.equal(items[2].metadata[VIRTUAL_LAYER_METADATA_KEY], undefined);
});

test("writes item copies before activating the new scene document", async () => {
  const events: string[] = [];
  const item = { id: "assigned", metadata: { [LEGACY_V1_VIRTUAL_LAYER_METADATA_KEY]: { virtualLayerId: "roof" } } };
  await runOutlinerV1NamespaceConversion({
    getSceneMetadata: async () => ({ [LEGACY_V1_VIRTUAL_LAYERS_METADATA_KEY]: document }),
    getItems: async () => [item],
    updateItems: async (ids, update) => { events.push(`items:${ids.join(",")}`); update([item]); },
    setSceneMetadata: async (update) => { events.push(`scene:${String(VIRTUAL_LAYERS_METADATA_KEY in update)}`); },
  });
  assert.deepEqual(events, ["items:assigned", "scene:true"]);
  assert.deepEqual(item.metadata[VIRTUAL_LAYER_METADATA_KEY], { virtualLayerId: "roof" });
});

test("does not activate the scene document when an item write fails", async () => {
  const events: string[] = [];
  await assert.rejects(runOutlinerV1NamespaceConversion({
    getSceneMetadata: async () => ({ [LEGACY_V1_VIRTUAL_LAYERS_METADATA_KEY]: document }),
    getItems: async () => [{ id: "assigned", metadata: { [LEGACY_V1_VIRTUAL_LAYER_METADATA_KEY]: { virtualLayerId: "roof" } } }],
    updateItems: async () => { events.push("items"); throw new Error("offline"); },
    setSceneMetadata: async () => { events.push("scene"); },
  }), /offline/);
  assert.deepEqual(events, ["items"]);
});
