import assert from "node:assert/strict";
import test from "node:test";
import type { Item } from "@owlbear-rodeo/sdk";
import { ITEM_INHERITANCE_METADATA_KEY, ITEM_LOCAL_STATE_METADATA_KEY, VIRTUAL_LAYER_METADATA_KEY } from "../src/constants.ts";
import { activateTransparency } from "../src/transparentState.ts";
import { calculateInheritanceUpdates, definitionItemIds, directGroupTransparency, directNativeItemIds, getEffectiveItemRule, getGroupEffectiveInstructions, getGroupInheritance, getItemParentRule, getNativeRule, logicalLayerItemIds, parseItemInheritance } from "../src/stateInheritance.ts";
import { resolveParticipationModel, withLogicalParticipation, withStateGroupSelection } from "../src/participation.ts";
import { createVirtualLayer, parseVirtualLayerState, renameVirtualLayer, type EffectiveItemState, type VirtualLayerState } from "../src/virtualLayers.ts";

const full: EffectiveItemState = { disableHit: true, locked: true, visible: false, transparent: false };
const state: VirtualLayerState = {
  version: 3,
  layers: [{ id: "roofs", name: "Roofs", obrLayer: "PROP", order: 0 }],
  inheritance: {
    native: { PROP: { locked: true, visible: false } },
    virtual: { roofs: { mode: "independent", enforce: { disableHit: true } } },
    unassigned: { PROP: { mode: "pass-through" } },
  },
};

function item(id: string, assignment?: string, independent: unknown = false, layer: Item["layer"] = "PROP"): Item {
  return { id, layer, zIndex: 0, disableHit: false, locked: false, visible: true, scale: { x: 1, y: 1 }, metadata: {
    ...(assignment ? { [VIRTUAL_LAYER_METADATA_KEY]: { virtualLayerId: assignment } } : {}),
    ...(independent ? { [ITEM_INHERITANCE_METADATA_KEY]: independent === true ? { independent: true } : independent } : {}),
  } } as Item;
}

test("parses inheritance while dropping obsolete transparent rules", () => {
  const parsed = parseVirtualLayerState({ version: 3, layers: state.layers, inheritance: {
    native: { PROP: { transparent: true, locked: true } },
    virtual: { roofs: { mode: "independent", enforce: { transparent: false, visible: false } } },
  } });
  assert.deepEqual(parsed.inheritance, {
    native: { PROP: { locked: true } },
    virtual: { roofs: { mode: "independent", enforce: { visible: false } } },
  });
  assert.deepEqual(parseItemInheritance(full), { independent: true, legacy: true });
});

test("resolves pass-through, independent, and item-independent property precedence", () => {
  assert.deepEqual(getNativeRule(state, "PROP"), { locked: true, visible: false });
  assert.deepEqual(getGroupInheritance(state, "PROP", "roofs"), { mode: "independent", enforce: { disableHit: true } });
  assert.deepEqual(getGroupEffectiveInstructions(state, "PROP", "roofs"), { disableHit: true });
  assert.deepEqual(getItemParentRule(item("roof", "roofs"), state), { disableHit: true });
  assert.deepEqual(getItemParentRule(item("unassigned"), state), { locked: true, visible: false });
  assert.deepEqual(getEffectiveItemRule(item("independent", undefined, true), state), {});
});

test("linked definitions inherit independently from their own native layers", () => {
  const linked: VirtualLayerState = { version: 3, layers: [
    { id: "map-floor", name: "House: Floor 1", obrLayer: "MAP", order: 0 },
    { id: "prop-floor", name: "House: Floor 1", obrLayer: "PROP", order: 0 },
  ], inheritance: { native: { MAP: { locked: true }, PROP: { visible: false } } } };
  assert.deepEqual(getItemParentRule(item("map", "map-floor", false, "MAP"), linked), { locked: true });
  assert.deepEqual(getItemParentRule(item("prop", "prop-floor"), linked), { visible: false });
});

test("dependent definitions inherit from their native layer, not their guardian", () => {
  const dependent: VirtualLayerState = { version: 3, layers: [
    { id: "guardian", name: "House: Floor 1", obrLayer: "MAP", order: 0 },
    { id: "lights", name: "House: Floor 1/Lights: On", obrLayer: "PROP", order: 0 },
  ], inheritance: {
    native: { MAP: { locked: true }, PROP: { disableHit: true } },
    virtual: { guardian: { mode: "independent", enforce: { visible: false } } },
  } };
  assert.deepEqual(getItemParentRule(item("guardian", "guardian", false, "MAP"), dependent), { visible: false });
  assert.deepEqual(getItemParentRule(item("lights", "lights"), dependent), { disableHit: true });
});

test("ordinary definition targets stay local while participation targets span links", () => {
  const linked: VirtualLayerState = { version: 3, layers: [
    { id: "map", name: "Floor 1", obrLayer: "MAP", order: 0 },
    { id: "prop", name: "Floor 1", obrLayer: "PROP", order: 0 },
  ] };
  const items = [item("map-item", "map", false, "MAP"), item("map-independent", "map", true, "MAP"), item("prop-item", "prop")];
  assert.deepEqual(definitionItemIds(items, linked, "MAP", "map"), ["map-item", "map-independent"]);
  assert.deepEqual(definitionItemIds(items, linked, "PROP", "prop"), ["prop-item"]);
  assert.deepEqual(logicalLayerItemIds(items, linked, "map"), ["map-item", "map-independent", "prop-item"]);
  assert.deepEqual(logicalLayerItemIds(items, linked, "prop"), ["map-item", "map-independent", "prop-item"]);
  const offstage = withLogicalParticipation(linked, "map", false);
  assert.equal(resolveParticipationModel(offstage).byDefinitionId.get("map")?.participating, false);
  assert.equal(resolveParticipationModel(offstage).byDefinitionId.get("prop")?.participating, false);
});

test("guardian and state-linked participation remain structural and recursive", () => {
  let scene: VirtualLayerState = { version: 3, layers: [
    { id: "map-day", name: "House: Day", obrLayer: "MAP", order: 0 },
    { id: "prop-day", name: "House: Day", obrLayer: "PROP", order: 0 },
    { id: "night", name: "House: Night", obrLayer: "MAP", order: 1 },
    { id: "lights-on", name: "House: Day/Lights: On", obrLayer: "PROP", order: 1 },
    { id: "lights-off", name: "House: Day/Lights: Off", obrLayer: "PROP", order: 2 },
  ], stateSelections: { house: "day", "house: day/lights": "on" } };
  let participation = resolveParticipationModel(scene);
  assert.equal(participation.byDefinitionId.get("map-day")?.participating, true);
  assert.equal(participation.byDefinitionId.get("prop-day")?.participating, true);
  assert.equal(participation.byDefinitionId.get("lights-on")?.participating, true);
  scene = withStateGroupSelection(scene, "house", "night");
  participation = resolveParticipationModel(scene);
  assert.equal(participation.byDefinitionId.get("map-day")?.participating, false);
  assert.equal(participation.byDefinitionId.get("prop-day")?.participating, false);
  assert.equal(participation.byDefinitionId.get("lights-on")?.participating, false);
  scene = withStateGroupSelection(scene, "house", "day");
  participation = resolveParticipationModel(scene);
  assert.equal(participation.byDefinitionId.get("lights-on")?.participating, true);
  assert.equal(participation.byDefinitionId.get("lights-off")?.participating, false);
});

test("participation overlays current inheritance and also suppresses independent items", () => {
  const target = item("target", "day", true, "MAP");
  let scene: VirtualLayerState = { version: 3, layers: [
    { id: "day", name: "House: Day", obrLayer: "MAP", order: 0 },
    { id: "night", name: "House: Night", obrLayer: "MAP", order: 1 },
  ], stateSelections: { house: "night" }, inheritance: { native: { MAP: { locked: true } } } };
  assert.deepEqual(getEffectiveItemRule(target, scene), { transparent: true });
  delete target.metadata[ITEM_INHERITANCE_METADATA_KEY];
  assert.deepEqual(getEffectiveItemRule(target, scene), { locked: true, transparent: true });
  scene = { ...scene, inheritance: { native: { MAP: { locked: false } } } };
  assert.deepEqual(getEffectiveItemRule(target, scene), { locked: false, transparent: true });
  scene = withStateGroupSelection(scene, "house", "day");
  assert.deepEqual(getEffectiveItemRule(target, scene), { locked: false });
});

test("unassigned can opt out while assigned pass-through groups inherit native rules", () => {
  const scene: VirtualLayerState = { version: 3, layers: [{ id: "assigned", name: "Assigned", obrLayer: "MAP", order: 0 }], inheritance: {
    native: { MAP: { locked: true } }, unassigned: { MAP: { mode: "independent", enforce: {} } },
  } };
  assert.deepEqual(getItemParentRule(item("loose", undefined, false, "MAP"), scene), {});
  assert.deepEqual(getItemParentRule(item("placed", "assigned", false, "MAP"), scene), { locked: true });
});

test("reconciliation reveals the newest inherited state when participation returns", () => {
  const target = item("target", "day", false, "MAP");
  let scene: VirtualLayerState = { version: 3, layers: [
    { id: "day", name: "House: Day", obrLayer: "MAP", order: 0 },
    { id: "night", name: "House: Night", obrLayer: "MAP", order: 1 },
  ], stateSelections: { house: "night" }, inheritance: { native: { MAP: { locked: false } } } };
  activateTransparency(target, "inherited");
  target.metadata[ITEM_LOCAL_STATE_METADATA_KEY] = { version: 1, values: { transparent: false, locked: true } };
  target.locked = true;
  assert.deepEqual(calculateInheritanceUpdates([target], scene).get("target"), { instructions: { locked: false, transparent: true } });
  scene = withStateGroupSelection(scene, "house", "day");
  assert.deepEqual(calculateInheritanceUpdates([target], scene).get("target"), { instructions: { locked: false } });
});

test("direct transparency aggregation remains a logical participation operation", () => {
  const linked: VirtualLayerState = { version: 3, layers: [
    { id: "map", name: "Floor", obrLayer: "MAP", order: 0 },
    { id: "prop", name: "Floor", obrLayer: "PROP", order: 0 },
  ] };
  const map = item("map", "map", false, "MAP");
  const prop = item("prop", "prop");
  activateTransparency(map, "direct");
  activateTransparency(prop, "direct");
  assert.equal(directGroupTransparency([map, prop], linked, "MAP", "map"), true);
});

test("creating or renaming linked layers preserves independent inheritance rules", () => {
  const linked = createVirtualLayer(state, "MAP", "Roofs", "map-roofs");
  assert.deepEqual(linked.inheritance?.virtual?.roofs, state.inheritance?.virtual?.roofs);
  assert.deepEqual(renameVirtualLayer(linked, "map-roofs", "Other").inheritance?.virtual?.roofs, state.inheritance?.virtual?.roofs);
  assert.deepEqual(directNativeItemIds([item("loose"), item("independent", undefined, true)], state, "PROP"), ["loose"]);
});
