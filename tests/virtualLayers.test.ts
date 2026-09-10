import assert from "node:assert/strict";
import test from "node:test";
import { LEGACY_V1_VIRTUAL_LAYERS_METADATA_KEY, LEGACY_VIRTUAL_LAYERS_METADATA_KEY, VIRTUAL_LAYERS_METADATA_KEY, VIRTUAL_LAYER_METADATA_KEY } from "../src/constants.ts";
import {
  UNASSIGNED_ID,
  calculateNormalizationUpdates,
  calculateAssignmentUpdates,
  calculateVirtualStackingUpdates,
  createVirtualLayer,
  deleteVirtualLayer,
  desiredOrder,
  hasBoundaryViolation,
  isLinkedVirtualLayer,
  linkedVirtualLayers,
  mutuallyExclusiveVirtualLayers,
  parseStatefulVirtualLayerName,
  getStateSelection,
  statefulVirtualLayerGroups,
  reorderStatefulVirtualLayerState,
  parseVirtualLayerState,
  orderedGroupIds,
  renameVirtualLayer,
  renameLinkedVirtualLayers,
  dependentVirtualLayers,
  reorderVirtualLayer,
  reorderStackingGroup,
  sceneModelCompatibility,
  stackGroup,
  resolveGroupId,
  withStateSelection,
  type VirtualLayerItem,
  type VirtualLayerState,
} from "../src/virtualLayers.ts";

const state: VirtualLayerState = { version: 3, layers: [
  { id: "roofs", name: "Roofs", obrLayer: "PROP", order: 0 },
  { id: "walls", name: "Walls", obrLayer: "PROP", order: 1 },
  { id: "pcs", name: "PCs", obrLayer: "CHARACTER", order: 0 },
] };
function item(id: string, layer: VirtualLayerItem["layer"], zIndex: number, virtualLayerId?: string): VirtualLayerItem {
  return { id, layer, zIndex, metadata: virtualLayerId ? { [VIRTUAL_LAYER_METADATA_KEY]: { virtualLayerId } } : {} };
}
function apply(items: VirtualLayerItem[], targets: string[], operation: "front" | "forward" | "backward" | "back") {
  const updates = calculateVirtualStackingUpdates(items, state, targets, operation);
  return items.map((entry) => ({ ...entry, zIndex: updates.get(entry.id) ?? entry.zIndex }));
}
function groupIds(items: VirtualLayerItem[], group: string) {
  return items.filter((entry) => resolveGroupId(entry, state) === group).sort((a, b) => a.zIndex - b.zIndex || a.id.localeCompare(b.id)).map((entry) => entry.id);
}

test("creates, renames, deletes, and reorders layer definitions", () => {
  const created = createVirtualLayer(state, "DRAWING", " Notes ", "notes");
  assert.equal(created.layers.at(-1)?.name, "Notes");
  assert.equal(renameVirtualLayer(created, "notes", " GM :Notes / Private ").layers.at(-1)?.name, "GM: Notes/Private");
  assert.deepEqual(reorderVirtualLayer(state, "walls", 0).layers.filter((entry) => entry.obrLayer === "PROP").sort((a, b) => a.order - b.order).map((entry) => entry.id), ["walls", "roofs"]);
  assert.deepEqual(deleteVirtualLayer(state, "roofs").layers.filter((entry) => entry.obrLayer === "PROP").map((entry) => [entry.id, entry.order]), [["walls", 0]]);
});

test("allows duplicate trimmed case-insensitive names and derives links scene-wide", () => {
  const duplicate = createVirtualLayer(state, "DRAWING", " roofs ", "duplicate");
  assert.equal(duplicate.layers.at(-1)?.name, "roofs");
  assert.deepEqual(linkedVirtualLayers(duplicate, "roofs").map((layer) => layer.id), ["roofs", "duplicate"]);
  assert.equal(isLinkedVirtualLayer(duplicate, "duplicate"), true);
  const renamed = renameVirtualLayer(duplicate, "pcs", "ROOFS");
  assert.deepEqual(linkedVirtualLayers(renamed, "roofs").map((layer) => layer.id), ["roofs", "pcs", "duplicate"]);
  assert.equal(isLinkedVirtualLayer(renameVirtualLayer(renamed, "pcs", "Heroes"), "pcs"), false);
  assert.throws(() => createVirtualLayer(state, "PROP", " ", "empty"), /empty/);
});

test("canonical whitespace variants link by their full semantic path", () => {
  let linked = createVirtualLayer(state, "DRAWING", " House :floor 1 / Lights : on ", "drawing-lights");
  linked = createVirtualLayer(linked, "MAP", "house: floor 1/lights:on", "map-lights");
  assert.equal(linked.layers.find((layer) => layer.id === "drawing-lights")?.name, "House: floor 1/Lights: on");
  assert.deepEqual(linkedVirtualLayers(linked, "drawing-lights").map((layer) => layer.id), ["drawing-lights", "map-lights"]);
});

test("parses stateful virtual-layer names and groups their mutually exclusive states", () => {
  assert.deepEqual(parseStatefulVirtualLayerName(" Castle : Ground "), { group: "Castle", state: "Ground" });
  assert.deepEqual(parseStatefulVirtualLayerName("Castle:Night:Storm"), { group: "Castle", state: "Night:Storm" });
  assert.equal(parseStatefulVirtualLayerName("Castle"), undefined);
  assert.equal(parseStatefulVirtualLayerName(": Ground"), undefined);
  assert.equal(parseStatefulVirtualLayerName("Castle: "), undefined);

  const stateful: VirtualLayerState = { version: 3, layers: [
    { id: "ground", name: "Castle: Ground", obrLayer: "MAP", order: 0 },
    { id: "first", name: "Castle: First Floor", obrLayer: "PROP", order: 0 },
    { id: "first-linked", name: "Castle: First Floor", obrLayer: "DRAWING", order: 0 },
    { id: "basement", name: " castle : basement ", obrLayer: "MAP", order: 1 },
    { id: "other", name: "Village: Ground", obrLayer: "MAP", order: 2 },
    { id: "plain", name: "Castle", obrLayer: "MAP", order: 3 },
  ] };
  assert.deepEqual(mutuallyExclusiveVirtualLayers(stateful, "first").map((layer) => layer.id), ["ground", "basement"]);
  assert.deepEqual(mutuallyExclusiveVirtualLayers(stateful, "first-linked").map((layer) => layer.id), ["ground", "basement"]);
  assert.deepEqual(mutuallyExclusiveVirtualLayers(stateful, "plain"), []);
  assert.deepEqual(statefulVirtualLayerGroups(stateful).map((group) => ({
    name: group.name,
    states: group.states.map((entry) => ({ name: entry.name, ids: entry.layers.map((layer) => layer.id) })),
  })), [
    { name: "Castle", states: [
      { name: "Ground", ids: ["ground"] },
      { name: "First Floor", ids: ["first", "first-linked"] },
      { name: "basement", ids: ["basement"] },
    ] },
    { name: "Village", states: [{ name: "Ground", ids: ["other"] }] },
  ]);
  const reordered = reorderStatefulVirtualLayerState(stateful, " CASTLE ", "basement", "Ground");
  assert.deepEqual(statefulVirtualLayerGroups(reordered)[0].states.map((entry) => entry.name), ["basement", "Ground", "First Floor"]);
  assert.deepEqual(parseVirtualLayerState(reordered).stateOrders, { castle: ["basement", "ground", "first floor"] });
  const selected = withStateSelection(stateful, " CASTLE ", " First Floor ");
  assert.equal(getStateSelection(selected, "castle"), "first floor");
  assert.deepEqual(parseVirtualLayerState(selected).stateSelections, { castle: "first floor" });
  assert.equal(getStateSelection(withStateSelection(selected, "Castle", null), "castle"), null);
});

test("parses schema-3 definitions and rejects incompatible schemas", () => {
  const parsed = parseVirtualLayerState({ version: 3, layers: [state.layers[0], { id: 3 }], stateGroupOrder: [" Castle ", "castle", "Village", 3] });
  assert.deepEqual(parsed.layers, [state.layers[0]]);
  assert.deepEqual(parsed.stateGroupOrder, ["castle", "village"]);
  assert.deepEqual(parseVirtualLayerState({ version: 2, layers: state.layers }).layers, []);
  assert.deepEqual(parseVirtualLayerState({ version: 1, layers: state.layers }).layers, []);
});

test("detects old and invalid scene metadata without interpreting it", () => {
  assert.equal(sceneModelCompatibility({}), "empty");
  assert.equal(sceneModelCompatibility({ [LEGACY_VIRTUAL_LAYERS_METADATA_KEY]: { version: 2, layers: state.layers } }), "migratable");
  assert.equal(sceneModelCompatibility({ [LEGACY_VIRTUAL_LAYERS_METADATA_KEY]: { version: 1, layers: state.layers } }), "legacy");
  assert.equal(sceneModelCompatibility({ [LEGACY_V1_VIRTUAL_LAYERS_METADATA_KEY]: state }), "migratable");
  assert.equal(sceneModelCompatibility({ [LEGACY_V1_VIRTUAL_LAYERS_METADATA_KEY]: { version: 2, layers: state.layers } }), "empty");
  assert.equal(sceneModelCompatibility({ [VIRTUAL_LAYERS_METADATA_KEY]: { version: 2, layers: state.layers } }), "invalid");
  assert.equal(sceneModelCompatibility({ [VIRTUAL_LAYERS_METADATA_KEY]: state }), "current");
  assert.equal(sceneModelCompatibility({ [VIRTUAL_LAYERS_METADATA_KEY]: state, [LEGACY_V1_VIRTUAL_LAYERS_METADATA_KEY]: state }), "current");
});

test("renames every currently linked virtual layer as one operation", () => {
  const state: VirtualLayerState = { version: 3, layers: [
    { id: "map", name: "Roof", obrLayer: "MAP", order: 0 },
    { id: "prop", name: "roof", obrLayer: "PROP", order: 0 },
    { id: "other", name: "Walls", obrLayer: "DRAWING", order: 0 },
    { id: "child", name: "Roof/Lights: on", obrLayer: "PROP", order: 1 },
    { id: "grandchild", name: "roof/Lights: on/Torches", obrLayer: "FOG", order: 0 },
  ] };
  assert.deepEqual(dependentVirtualLayers(state, "map").map((layer) => layer.id), ["child", "grandchild"]);
  const renamed = renameLinkedVirtualLayers(state, "map", "House/Roof");
  assert.deepEqual(renamed.layers.map((layer) => [layer.id, layer.name]), [
    ["map", "House/Roof"], ["prop", "House/Roof"], ["other", "Walls"],
    ["child", "House/Roof/Lights: on"], ["grandchild", "House/Roof/Lights: on/Torches"],
  ]);
});

test("resolves missing, stale, and native-layer-mismatched assignments as Unassigned", () => {
  assert.equal(resolveGroupId(item("a", "PROP", 0), state), UNASSIGNED_ID);
  assert.equal(resolveGroupId({ ...item("legacy", "PROP", 0), metadata: { "com.ex-asperis.outliner/virtualLayer": { virtualLayerId: "roofs" } } }, state), UNASSIGNED_ID);
  assert.equal(resolveGroupId(item("b", "PROP", 0, "missing"), state), UNASSIGNED_ID);
  assert.equal(resolveGroupId(item("c", "CHARACTER", 0, "roofs"), state), UNASSIGNED_ID);
  assert.equal(resolveGroupId(item("d", "PROP", 0, "roofs"), state), "roofs");
});

test("plans assign, reassign, unassign, and cross-native Send to Layer updates", () => {
  const items = [item("a", "PROP", 0), item("b", "PROP", 1, "walls")];
  assert.deepEqual(calculateAssignmentUpdates(items, state, ["a"], "PROP", "roofs").get("a"), { layer: "PROP", virtualLayerId: "roofs" });
  assert.deepEqual(calculateAssignmentUpdates(items, state, ["b"], "PROP", "roofs").get("b"), { layer: "PROP", virtualLayerId: "roofs" });
  assert.deepEqual(calculateAssignmentUpdates(items, state, ["b"], "PROP").get("b"), { layer: "PROP", virtualLayerId: undefined });
  const moved = calculateAssignmentUpdates(items, state, ["a", "b"], "CHARACTER", "pcs");
  assert.deepEqual([...moved.values()], [{ layer: "CHARACTER", virtualLayerId: "pcs" }, { layer: "CHARACTER", virtualLayerId: "pcs" }]);
  assert.throws(() => calculateAssignmentUpdates(items, state, ["a"], "CHARACTER", "roofs"), /different native/);
});

test("normalizes strict group order while preserving relative order", () => {
  const items = [item("r2", "PROP", -2, "roofs"), item("u", "PROP", 50), item("w", "PROP", 0.5, "walls"), item("r1", "PROP", -3, "roofs")];
  assert.deepEqual(desiredOrder(items, state, "PROP").map((entry) => entry.id), ["u", "w", "r1", "r2"]);
  const updates = calculateNormalizationUpdates(items, state, "PROP");
  assert.deepEqual([...updates], [["u", 0], ["w", 1], ["r1", 2], ["r2", 3]]);
  assert.equal(hasBoundaryViolation(items, state, "PROP"), true);
});

test("supports empty layers, equal z-indices, and reordered definitions deterministically", () => {
  const equal = [item("b", "PROP", 1, "roofs"), item("a", "PROP", 1, "roofs")];
  assert.deepEqual(desiredOrder(equal, state, "PROP").map((entry) => entry.id), ["a", "b"]);
  const reordered = reorderVirtualLayer(state, "walls", 0);
  const mixed = [item("r", "PROP", 2, "roofs"), item("w", "PROP", -5, "walls")];
  assert.deepEqual(desiredOrder(mixed, reordered, "PROP").map((entry) => entry.id), ["r", "w"]);
});

test("persists and enforces a freely reorderable Unassigned group", () => {
  const moved = reorderStackingGroup(state, "PROP", UNASSIGNED_ID, 0);
  assert.deepEqual(orderedGroupIds(moved, "PROP"), [UNASSIGNED_ID, "roofs", "walls"]);
  assert.equal(moved.unassignedOrders?.PROP, 0);
  const items = [item("road", "PROP", 10, "roofs"), item("other", "PROP", -5)];
  assert.deepEqual(desiredOrder(items, moved, "PROP").map((entry) => entry.id), ["road", "other"]);
  const normalized = calculateNormalizationUpdates(items, moved, "PROP");
  assert.equal(normalized.get("road"), 0);
  assert.equal(normalized.get("other"), 1);
  const roundTrip = parseVirtualLayerState(moved);
  assert.deepEqual(orderedGroupIds(roundTrip, "PROP"), [UNASSIGNED_ID, "roofs", "walls"]);
});

test("new virtual layers are inserted immediately above the current Unassigned position", () => {
  const moved = reorderStackingGroup(state, "PROP", UNASSIGNED_ID, 1);
  const created = createVirtualLayer(moved, "PROP", "Roads", "roads");
  assert.deepEqual(orderedGroupIds(created, "PROP"), ["roofs", "roads", UNASSIGNED_ID, "walls"]);
});

test("Send stacking actions move a virtual layer as a whole", () => {
  assert.deepEqual(orderedGroupIds(stackGroup(state, "PROP", "walls", "front"), "PROP"), ["walls", "roofs", UNASSIGNED_ID]);
  assert.deepEqual(orderedGroupIds(stackGroup(state, "PROP", "walls", "forward"), "PROP"), ["walls", "roofs", UNASSIGNED_ID]);
  assert.deepEqual(orderedGroupIds(stackGroup(state, "PROP", "roofs", "backward"), "PROP"), ["walls", "roofs", UNASSIGNED_ID]);
  assert.deepEqual(orderedGroupIds(stackGroup(state, "PROP", "roofs", "back"), "PROP"), ["walls", UNASSIGNED_ID, "roofs"]);
});

test("Send stacking actions support Unassigned and stop at group boundaries", () => {
  assert.deepEqual(orderedGroupIds(stackGroup(state, "PROP", UNASSIGNED_ID, "front"), "PROP"), [UNASSIGNED_ID, "roofs", "walls"]);
  assert.equal(stackGroup(state, "PROP", "roofs", "forward"), state);
  assert.equal(stackGroup(state, "PROP", UNASSIGNED_ID, "backward"), state);
});

for (const [operation, expected] of Object.entries({ front: ["b", "c", "a"], forward: ["b", "a", "c"], backward: ["a", "b", "c"], back: ["a", "b", "c"] }) as Array<["front" | "forward" | "backward" | "back", string[]]>) {
  test(`stacking ${operation} stays inside a virtual layer`, () => {
    const items = [item("a", "PROP", 2, "roofs"), item("b", "PROP", 3, "roofs"), item("c", "PROP", 4, "roofs"), item("wall", "PROP", 1, "walls")];
    assert.deepEqual(groupIds(apply(items, ["a"], operation), "roofs"), expected);
    assert.deepEqual(groupIds(apply(items, ["a"], operation), "walls"), ["wall"]);
  });
}

test("multi-selection operates independently across virtual, native, and unassigned groups", () => {
  const items = [item("r1", "PROP", 3, "roofs"), item("r2", "PROP", 4, "roofs"), item("u1", "PROP", 0), item("u2", "PROP", 1), item("p1", "CHARACTER", 2, "pcs"), item("p2", "CHARACTER", 3, "pcs")];
  const result = apply(items, ["r1", "u1", "p1"], "front");
  assert.deepEqual(groupIds(result, "roofs"), ["r2", "r1"]);
  assert.deepEqual(groupIds(result, UNASSIGNED_ID).filter((id) => id.startsWith("u")), ["u2", "u1"]);
  assert.deepEqual(groupIds(result, "pcs"), ["p2", "p1"]);
});
