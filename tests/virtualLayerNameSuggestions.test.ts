import assert from "node:assert/strict";
import test from "node:test";
import { virtualLayerNameSuggestions } from "../src/virtualLayerNameSuggestions.ts";
import type { VirtualLayerDefinition } from "../src/virtualLayers.ts";

function layer(id: string, name: string, obrLayer: VirtualLayerDefinition["obrLayer"], order: number): VirtualLayerDefinition {
  return { id, name, obrLayer, order };
}

test("suggests full names from other layers and state prefixes from the current layer", () => {
  const definitions = [
    layer("plain-current", "Current plain", "PROP", 0),
    layer("state-0", "abcd: 0", "PROP", 1),
    layer("state-1", "abcd: 1", "PROP", 2),
    layer("dependent", "Building/Floor: Ground", "PROP", 3),
    layer("other-state", "xyz: 0", "MAP", 0),
    layer("other-plain", "Roof", "DRAWING", 0),
  ];

  assert.deepEqual(virtualLayerNameSuggestions(definitions, "PROP"), [
    "abcd: ",
    "Building/Floor: ",
    "Roof",
    "xyz: 0",
  ]);
  assert.deepEqual(definitions.map((definition) => definition.name), [
    "Current plain",
    "abcd: 0",
    "abcd: 1",
    "Building/Floor: Ground",
    "xyz: 0",
    "Roof",
  ]);
});

test("deduplicates suggestions canonically while retaining first display casing", () => {
  const definitions = [
    layer("current-a", "Castle: Day", "MAP", 0),
    layer("current-b", "castle: Night", "MAP", 1),
    layer("other-a", "Roof", "PROP", 0),
    layer("other-b", "roof", "DRAWING", 0),
  ];

  assert.deepEqual(virtualLayerNameSuggestions(definitions, "MAP"), ["Castle: ", "Roof"]);
});

test("returns no suggestions for a current layer containing only plain names", () => {
  assert.deepEqual(virtualLayerNameSuggestions([
    layer("plain", "Notes", "TEXT", 0),
  ], "TEXT"), []);
});
