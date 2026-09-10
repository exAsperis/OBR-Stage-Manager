import assert from "node:assert/strict";
import test from "node:test";
import { participationDescription, reorderResolvedStateGroup, reorderResolvedStateGroups, resolveParticipationModel, withStateGroupSelection } from "../src/participation.ts";
import type { VirtualLayerDefinition, VirtualLayerState } from "../src/virtualLayers.ts";

const layer = (id: string, name: string, obrLayer: VirtualLayerDefinition["obrLayer"] = "PROP", order = 0): VirtualLayerDefinition =>
  ({ id, name, obrLayer, order });

function houseState(): VirtualLayerState {
  return {
    version: 3,
    layers: [
      layer("floor", "House: floor 1"),
      layer("basement", "House: basement", "PROP", 1),
      layer("lights-on", "House: floor 1/Lights: on", "PROP", 2),
      layer("lights-on-map", "house: floor 1/lights: on", "MAP"),
      layer("lights-off", "House: floor 1/Lights: off", "PROP", 3),
      layer("below", "House: floor 1/Floor props", "PROP", 4),
      layer("above", "House: floor 1/Floor props", "DRAWING"),
      layer("emergency", "House: floor 1/Lights: on/Emergency: active", "PROP", 5),
      layer("missing", "Missing: state/Dependent", "PROP", 6),
    ],
    stateSelections: {
      house: "floor 1",
      "house: floor 1/lights": "on",
      "house: floor 1/lights: on/emergency": "active",
    },
  };
}

test("resolves linked logical identities and guardian-scoped state groups", () => {
  const model = resolveParticipationModel(houseState());
  const linked = model.logicalLayers.find((entry) => entry.id === "house: floor 1/lights: on");
  assert.deepEqual(linked?.definitions.map((entry) => entry.id), ["lights-on", "lights-on-map"]);
  assert.deepEqual(model.stateGroups.map((group) => [group.id, group.guardianId, group.states.map((state) => state.name)]), [
    ["house", undefined, ["floor 1", "basement"]],
    ["house: floor 1/lights", "house: floor 1", ["on", "off"]],
    ["house: floor 1/lights: on/emergency", "house: floor 1/lights: on", ["active"]],
  ]);
});

test("remembers a selected child while its guardian is suppressed", () => {
  let state = houseState();
  let model = resolveParticipationModel(state);
  assert.equal(model.byDefinitionId.get("floor")?.participating, true);
  assert.equal(model.byDefinitionId.get("lights-on")?.participating, true);
  assert.equal(model.byDefinitionId.get("lights-off")?.participating, false);

  state = withStateGroupSelection(state, "house", "basement");
  model = resolveParticipationModel(state);
  assert.equal(model.byDefinitionId.get("floor")?.participating, false);
  assert.deepEqual(model.byDefinitionId.get("lights-on"), {
    participating: false, locallySelected: true, guardianParticipating: false, reasons: ["guardian-suppressed"],
  });
  assert.deepEqual(model.byDefinitionId.get("lights-off")?.reasons, ["unselected", "guardian-suppressed"]);
  assert.equal(state.stateSelections?.["house: floor 1/lights"], "on");

  state = withStateGroupSelection(state, "house", "floor 1");
  model = resolveParticipationModel(state);
  assert.equal(model.byDefinitionId.get("lights-on")?.participating, true);
});

test("stateless split dependents participate together without changing layer order", () => {
  const state = houseState();
  const original = state.layers.map((entry) => [entry.id, entry.obrLayer, entry.order]);
  let model = resolveParticipationModel(state);
  assert.equal(model.byDefinitionId.get("below")?.participating, true);
  assert.equal(model.byDefinitionId.get("above")?.participating, true);
  model = resolveParticipationModel(withStateGroupSelection(state, "house", "basement"));
  assert.equal(model.byDefinitionId.get("below")?.participating, false);
  assert.equal(model.byDefinitionId.get("above")?.participating, false);
  assert.deepEqual(state.layers.map((entry) => [entry.id, entry.obrLayer, entry.order]), original);
});

test("recursive dependency and linked dependents use the same participation", () => {
  let model = resolveParticipationModel(houseState());
  assert.equal(model.byDefinitionId.get("emergency")?.participating, true);
  assert.equal(model.byDefinitionId.get("lights-on")?.participating, model.byDefinitionId.get("lights-on-map")?.participating);
  const state = withStateGroupSelection(houseState(), "house: floor 1/lights", "off");
  model = resolveParticipationModel(state);
  assert.equal(model.byDefinitionId.get("emergency")?.participating, false);
  assert.deepEqual(model.byDefinitionId.get("emergency")?.reasons, ["guardian-suppressed"]);
});

test("suppresses a dependent whose named guardian does not exist", () => {
  const model = resolveParticipationModel(houseState());
  assert.deepEqual(model.byDefinitionId.get("missing"), {
    participating: false, guardianParticipating: false, reasons: ["guardian-missing"],
  });
});

test("an unselected layer remains suppressed even when its guardian participates", () => {
  const model = resolveParticipationModel(houseState());
  assert.deepEqual(model.byDefinitionId.get("lights-off"), {
    participating: false, locallySelected: false, guardianParticipating: true, reasons: ["unselected"],
  });
  assert.equal(participationDescription(model.byDefinitionId.get("lights-off")!), "Suppressed — state is unselected");
});

test("reorders a guardian-scoped state group without affecting sibling groups", () => {
  const reordered = reorderResolvedStateGroup(houseState(), "house: floor 1/lights", "off", "on");
  assert.deepEqual(reordered.stateOrders, { "house: floor 1/lights": ["off", "on"] });
  assert.deepEqual(resolveParticipationModel(reordered).stateGroups.find((group) => group.id === "house: floor 1/lights")
    ?.states.map((state) => state.name), ["off", "on"]);
});

test("reorders elevator groups and appends groups absent from the saved order", () => {
  const state = houseState();
  const groups = resolveParticipationModel(state).stateGroups;
  const moved = reorderResolvedStateGroups(state, groups[groups.length - 1].id, groups[0].id);
  assert.deepEqual(resolveParticipationModel(moved).stateGroups.map((group) => group.id), [groups[groups.length - 1].id, ...groups.slice(0, -1).map((group) => group.id)]);
  const partial = { ...state, stateGroupOrder: [groups[1].id] };
  assert.deepEqual(resolveParticipationModel(partial).stateGroups.map((group) => group.id), [groups[1].id, ...groups.filter((group) => group.id !== groups[1].id).map((group) => group.id)]);
});
