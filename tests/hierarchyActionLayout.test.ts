import assert from "node:assert/strict";
import test from "node:test";
import { hierarchyActionColumns, splitHierarchyActions } from "../src/hierarchyActionLayout.ts";

test("uses one fallback column when the preferred name width cannot fit", () => {
  assert.equal(hierarchyActionColumns(300), 1);
});

test("adds columns in 30px increments while preserving the 228px name target", () => {
  assert.equal(hierarchyActionColumns(348), 2);
  assert.equal(hierarchyActionColumns(378), 3);
  assert.equal(hierarchyActionColumns(408), 4);
});

test("uses the configured label width and editing density", () => {
  assert.equal(hierarchyActionColumns(408, 168, 30), 6);
  assert.equal(hierarchyActionColumns(408, 228, 40), 3);
});

test("caps the shared action grid at the longest hierarchy row", () => {
  assert.equal(hierarchyActionColumns(800), 9);
});

test("keeps every action visible when it fits", () => {
  assert.deepEqual(splitHierarchyActions(["a", "b", "c"], 3), { overflow: [], visible: ["a", "b", "c"] });
});

test("overflow consumes actions from the left and preserves their order", () => {
  assert.deepEqual(splitHierarchyActions(["a", "b", "c", "d", "e"], 3), { overflow: ["a", "b", "c"], visible: ["d", "e"] });
  assert.deepEqual(splitHierarchyActions(["a", "b"], 1), { overflow: ["a", "b"], visible: [] });
});
