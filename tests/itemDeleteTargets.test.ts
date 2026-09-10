import assert from "node:assert/strict";
import test from "node:test";
import type { Item } from "@owlbear-rodeo/sdk";
import { itemDeleteTargets } from "../src/itemDeleteTargets.ts";

const items = [{ id: "a" }, { id: "b" }, { id: "c" }] as Item[];

test("deletes every permitted selected item when the clicked row is selected", () => {
  assert.deepEqual(itemDeleteTargets(items, ["a", "b"], "a", (item) => item.id !== "b"), ["a"]);
  assert.deepEqual(itemDeleteTargets(items, ["a", "b"], "a", () => true), ["a", "b"]);
});

test("deletes only the clicked item when its row is not selected", () => {
  assert.deepEqual(itemDeleteTargets(items, ["a", "b"], "c", () => true), ["c"]);
});
