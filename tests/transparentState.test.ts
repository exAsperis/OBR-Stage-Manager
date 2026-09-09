import assert from "node:assert/strict";
import test from "node:test";
import type { Item } from "@owlbear-rodeo/sdk";
import { activateTransparency, getItemVisible, getTransparentState, isItemTransparent, needsTransparencyEnforcement, parseTransparentState, restoreTransparency, setTransparentItemVisible } from "../src/transparentState.ts";

function item(): Item {
  return { id: "item", scale: { x: 2.5, y: -3 }, visible: false, disableHit: false, locked: false, metadata: {} } as Item;
}

function labeledImage(): Item {
  return {
    ...item(),
    type: "IMAGE",
    textItemType: "LABEL",
    text: { style: { fillOpacity: 0.65, strokeOpacity: 0.35 } },
  } as Item;
}

test("captures scale and stages a visible restore without changing clickability", () => {
  const target = item();
  target.visible = true;
  target.disableHit = true;
  activateTransparency(target, "direct");
  assert.deepEqual(target.scale, { x: 0, y: 0 });
  assert.equal(target.visible, false);
  assert.equal(target.disableHit, true);
  assert.equal(isItemTransparent(target), true);
  assert.equal(getItemVisible(target), true);
  assert.deepEqual(getTransparentState(target), {
    scale: { x: 2.5, y: -3 }, source: "direct", visible: true,
  });
  assert.deepEqual(restoreTransparency(target), { restored: true, reactivate: true });
  assert.deepEqual(target.scale, { x: 2.5, y: -3 });
  assert.equal(target.visible, false);
  assert.equal(target.disableHit, true);
  assert.equal(isItemTransparent(target), false);
});

test("repeated activation preserves the first captured values while updating provenance", () => {
  const target = item();
  activateTransparency(target, "direct");
  activateTransparency(target, "inherited");
  assert.deepEqual(getTransparentState(target), {
    scale: { x: 2.5, y: -3 }, source: "inherited", visible: false,
  });
});

test("ignores malformed metadata without inventing restoration values", () => {
  assert.equal(parseTransparentState({ scale: { x: 1 }, visible: true, disableHit: false, source: "direct" }), undefined);
  const target = item();
  target.metadata["com.ex-asperis.obr-stage-manager/v1/transparentState"] = { broken: true };
  assert.deepEqual(restoreTransparency(target), { restored: false, reactivate: false });
  assert.deepEqual(target.scale, { x: 2.5, y: -3 });
});

test("does not interpret 0.x transparency metadata in the 1.0 model", () => {
  const target = item();
  target.metadata["com.ex-asperis.outliner/transparentState"] = {
    scale: { x: 9, y: 9 }, source: "inherited",
  };
  assert.equal(getTransparentState(target), undefined);
  assert.equal(isItemTransparent(target), false);
});

test("hides image labels and restores their exact opacity", () => {
  const target = labeledImage() as Item & { text: { style: { fillOpacity: number; strokeOpacity: number } } };
  activateTransparency(target, "direct");
  assert.deepEqual(target.text.style, { fillOpacity: 0, strokeOpacity: 0 });
  assert.deepEqual(getTransparentState(target)?.label, { fillOpacity: 0.65, strokeOpacity: 0.35 });
  assert.equal(needsTransparencyEnforcement(target), false);

  target.text.style.fillOpacity = 0.2;
  assert.equal(needsTransparencyEnforcement(target), true);
  activateTransparency(target, "direct");
  assert.deepEqual(getTransparentState(target)?.label, { fillOpacity: 0.65, strokeOpacity: 0.35 });
  assert.deepEqual(target.text.style, { fillOpacity: 0, strokeOpacity: 0 });

  restoreTransparency(target);
  assert.deepEqual(target.text.style, { fillOpacity: 0.65, strokeOpacity: 0.35 });
});

test("upgrades existing transparency metadata by capturing the live label style", () => {
  const target = labeledImage() as Item & { text: { style: { fillOpacity: number; strokeOpacity: number } } };
  target.metadata["com.ex-asperis.obr-stage-manager/v1/transparentState"] = {
    scale: { x: 1, y: 1 }, visible: true, disableHit: false, source: "direct",
  };
  target.scale = { x: 0, y: 0 };
  target.visible = false;
  target.disableHit = true;
  assert.equal(needsTransparencyEnforcement(target), true);
  activateTransparency(target, "direct");
  assert.equal(target.visible, false);
  assert.equal(target.disableHit, true);
  assert.deepEqual(getTransparentState(target), {
    scale: { x: 1, y: 1 }, source: "direct", visible: true, disableHit: false,
    label: { fillOpacity: 0.65, strokeOpacity: 0.35 },
  });
  assert.deepEqual(getTransparentState(target)?.label, { fillOpacity: 0.65, strokeOpacity: 0.35 });
  assert.deepEqual(target.text.style, { fillOpacity: 0, strokeOpacity: 0 });
});

test("leaves non-image items and image overlay text unchanged", () => {
  const nonImage = item();
  activateTransparency(nonImage, "direct");
  assert.equal(getTransparentState(nonImage)?.label, undefined);

  const overlay = labeledImage() as Item & { textItemType: string; text: { style: { fillOpacity: number; strokeOpacity: number } } };
  overlay.textItemType = "TEXT";
  activateTransparency(overlay, "direct");
  assert.deepEqual(overlay.text.style, { fillOpacity: 0.65, strokeOpacity: 0.35 });
  assert.equal(getTransparentState(overlay)?.label, undefined);
});

test("keeps legacy metadata valid when optional label state is malformed", () => {
  assert.deepEqual(parseTransparentState({
    scale: { x: 1, y: 1 }, visible: true, disableHit: false, source: "direct", label: { fillOpacity: "bad" },
  }), { scale: { x: 1, y: 1 }, visible: true, disableHit: false, source: "direct" });
});

test("accepts current scale-only metadata", () => {
  assert.deepEqual(parseTransparentState({ scale: { x: 1, y: 1 }, source: "direct" }), {
    scale: { x: 1, y: 1 }, source: "direct",
  });
});

test("stages repeated visible restores after restoring the exact scale", () => {
  const target = item();
  target.visible = true;
  const originalScale = { ...target.scale };
  for (let cycle = 0; cycle < 3; cycle++) {
    activateTransparency(target, "inherited");
    assert.deepEqual(target.scale, { x: 0, y: 0 });
    assert.equal(needsTransparencyEnforcement(target), false);
    assert.deepEqual(restoreTransparency(target), { restored: true, reactivate: true });
    assert.deepEqual(target.scale, originalScale);
    assert.equal(target.visible, false);
    target.visible = true;
  }
});

test("migrates nonzero-scale transparency without losing the original scale", () => {
  const target = item();
  activateTransparency(target, "direct");
  target.scale = { x: 0.001, y: 0.001 };
  assert.equal(needsTransparencyEnforcement(target), true);
  activateTransparency(target, "direct");
  assert.equal(needsTransparencyEnforcement(target), false);
  assert.deepEqual(target.scale, { x: 0, y: 0 });
  assert.deepEqual(restoreTransparency(target), { restored: true, reactivate: false });
  assert.deepEqual(target.scale, { x: 2.5, y: -3 });
});

test("does not reactivate a restore whose final inherited visibility is false", () => {
  const target = item();
  target.visible = true;
  activateTransparency(target, "inherited");
  assert.deepEqual(restoreTransparency(target, false), { restored: true, reactivate: false });
  assert.equal(target.visible, false);
});

test("changes logical visibility without exposing a transparent parent", () => {
  const target = item();
  activateTransparency(target, "direct");
  assert.equal(setTransparentItemVisible(target, true), true);
  assert.equal(target.visible, false);
  assert.equal(getItemVisible(target), true);
  assert.equal(needsTransparencyEnforcement(target), false);
  assert.deepEqual(restoreTransparency(target), { restored: true, reactivate: true });
});
