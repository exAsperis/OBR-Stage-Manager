import assert from "node:assert/strict";
import test from "node:test";
import type { Item } from "@owlbear-rodeo/sdk";
import { isAuthoritativeRole, retainExistingSelection, selectedSuppressedItemIds } from "../src/selectionSuppression.ts";

const TRANSPARENCY_KEY = "com.ex-asperis.obr-stage-manager/v1/transparentState";

function item(id: string, source?: "direct" | "inherited"): Item {
  return {
    id, type: "IMAGE", name: id, visible: source ? false : true, locked: false,
    createdUserId: "", zIndex: 0, lastModified: "", lastModifiedUserId: "",
    position: { x: 0, y: 0 }, rotation: 0, scale: source ? { x: 0, y: 0 } : { x: 1, y: 1 },
    metadata: source ? { [TRANSPARENCY_KEY]: { scale: { x: 1, y: 1 }, source } } : {},
    layer: "CHARACTER",
  };
}

test("returns a selected item suppressed by inherited transparency", () => {
  assert.deepEqual(selectedSuppressedItemIds([item("token", "inherited")], new Set(["token"])), ["token"]);
});

test("does not return visible or directly transparent selected items", () => {
  assert.deepEqual(selectedSuppressedItemIds([item("visible"), item("direct", "direct")], new Set(["visible", "direct"])), []);
});

test("does not return an unselected inherited-transparent item", () => {
  assert.deepEqual(selectedSuppressedItemIds([item("token", "inherited")], new Set()), []);
});

test("returns only the suppressed subset of multiple selected items", () => {
  const items = [item("first", "inherited"), item("second"), item("third", "direct"), item("fourth", "inherited")];
  assert.deepEqual(selectedSuppressedItemIds(items, new Set(items.map(({ id }) => id))), ["first", "fourth"]);
});

test("deleted items are removed from the cached selection", () => {
  assert.deepEqual([...retainExistingSelection([item("present")], new Set(["present", "deleted"]))], ["present"]);
});

test("local cache removal prevents duplicate deselection on repeated item events", () => {
  const items = [item("token", "inherited")];
  const selected = new Set(["token"]);
  const first = selectedSuppressedItemIds(items, selected);
  first.forEach((id) => selected.delete(id));
  assert.deepEqual(first, ["token"]);
  assert.deepEqual(selectedSuppressedItemIds(items, selected), []);
});

test("local suppression detection applies identically to PLAYER and GM clients", () => {
  const items = [item("token", "inherited")];
  for (const role of ["PLAYER", "GM"] as const) {
    assert.deepEqual(selectedSuppressedItemIds(items, new Set(["token"])), ["token"], role);
  }
});

test("only GM clients may perform reconciliation and Elevator work", () => {
  assert.equal(isAuthoritativeRole("PLAYER"), false);
  assert.equal(isAuthoritativeRole("GM"), true);
});

test("generic inherited suppression handles an Elevator destination without Elevator coupling", () => {
  const movedToken = item("moved-token", "inherited");
  movedToken.metadata["com.ex-asperis.obr-stage-manager/v1/virtualLayer"] = { virtualLayerId: "inactive-floor" };
  assert.deepEqual(selectedSuppressedItemIds([movedToken], new Set([movedToken.id])), [movedToken.id]);
});
