import assert from "node:assert/strict";
import test from "node:test";
import type { Item } from "@owlbear-rodeo/sdk";
import { applyEffectiveItemState } from "../src/effectiveItemState.ts";
import { getStoredLocalItemState, updateShadowedLocalItemProperty } from "../src/localItemState.ts";
import { getItemVisible, isItemTransparent } from "../src/transparentState.ts";
import { VIRTUAL_LAYER_METADATA_KEY } from "../src/constants.ts";
import { getEffectiveItemRule } from "../src/stateInheritance.ts";
import { withStateGroupSelection } from "../src/participation.ts";
import type { VirtualLayerState } from "../src/virtualLayers.ts";

function item(): Item {
  return {
    id: "item", layer: "PROP", zIndex: 0, scale: { x: 2, y: 3 },
    visible: false, locked: false, disableHit: false, metadata: {},
  } as Item;
}

function finishRestore(target: Item, result: ReturnType<typeof applyEffectiveItemState>) {
  if (result.restored && result.reactivate) target.visible = true;
}

test("shadows only overridden values and restores them when each override ends", () => {
  const target = item();
  applyEffectiveItemState(target, { visible: true, locked: true, disableHit: true, transparent: true });
  assert.equal(target.visible, false);
  assert.equal(target.locked, true);
  assert.equal(target.disableHit, true);
  assert.equal(isItemTransparent(target), true);
  assert.deepEqual(getStoredLocalItemState(target)?.values, {
    transparent: false, disableHit: false, locked: false, visible: false,
  });

  applyEffectiveItemState(target, { locked: true, transparent: true });
  assert.equal(getItemVisible(target), false);
  assert.deepEqual(getStoredLocalItemState(target)?.values, { transparent: false, locked: false });

  const restored = applyEffectiveItemState(target, {});
  finishRestore(target, restored);
  assert.equal(isItemTransparent(target), false);
  assert.deepEqual(target.scale, { x: 2, y: 3 });
  assert.equal(target.visible, false);
  assert.equal(target.locked, false);
  assert.equal(target.disableHit, false);
  assert.equal(getStoredLocalItemState(target), undefined);
});

test("competing suppression keeps the original local state until every override ends", () => {
  const target = item();
  target.visible = true;
  applyEffectiveItemState(target, { transparent: true });
  applyEffectiveItemState(target, { transparent: true });
  assert.equal(isItemTransparent(target), true);
  assert.deepEqual(getStoredLocalItemState(target)?.values, { transparent: false });
  const restored = applyEffectiveItemState(target, {});
  finishRestore(target, restored);
  assert.equal(isItemTransparent(target), false);
  assert.equal(target.visible, true);
});

test("local edits made through Stage Manager update the shadow while an override is active", () => {
  const target = item();
  applyEffectiveItemState(target, { visible: true });
  assert.equal(updateShadowedLocalItemProperty(target, "visible", true), true);
  target.visible = false;
  applyEffectiveItemState(target, { visible: true });
  assert.equal(target.visible, true);
  applyEffectiveItemState(target, {});
  assert.equal(target.visible, true);
  assert.equal(getStoredLocalItemState(target), undefined);
});

test("ordinary external values remain untouched when no override or shadow exists", () => {
  const target = item();
  target.metadata["com.ex-asperis.outliner/localState"] = { version: 1, values: { locked: false } };
  target.locked = true;
  target.disableHit = true;
  target.visible = true;
  applyEffectiveItemState(target, {});
  assert.equal(target.locked, true);
  assert.equal(target.disableHit, true);
  assert.equal(target.visible, true);
  assert.equal(getStoredLocalItemState(target), undefined);
});

test("local visibility survives stacked unselected and guardian suppression", () => {
  const target = item();
  target.metadata[VIRTUAL_LAYER_METADATA_KEY] = { virtualLayerId: "lights-off" };
  let state: VirtualLayerState = {
    version: 3,
    layers: [
      { id: "floor", name: "House: floor 1", obrLayer: "PROP", order: 0 },
      { id: "basement", name: "House: basement", obrLayer: "PROP", order: 1 },
      { id: "lights-on", name: "House: floor 1/Lights: on", obrLayer: "PROP", order: 2 },
      { id: "lights-off", name: "House: floor 1/Lights: off", obrLayer: "PROP", order: 3 },
    ],
    stateSelections: { house: "basement", "house: floor 1/lights": "on" },
  };

  applyEffectiveItemState(target, getEffectiveItemRule(target, state));
  assert.equal(isItemTransparent(target), true);
  assert.equal(getItemVisible(target), false);

  state = withStateGroupSelection(state, "house", "floor 1");
  applyEffectiveItemState(target, getEffectiveItemRule(target, state));
  assert.equal(isItemTransparent(target), true);

  state = withStateGroupSelection(state, "house: floor 1/lights", "off");
  finishRestore(target, applyEffectiveItemState(target, getEffectiveItemRule(target, state)));
  assert.equal(isItemTransparent(target), false);
  assert.equal(target.visible, false);
  assert.equal(getStoredLocalItemState(target), undefined);
});
