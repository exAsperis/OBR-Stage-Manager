import assert from "node:assert/strict";
import test from "node:test";
import type { Item, Shape } from "@owlbear-rodeo/sdk";
import { ELEVATOR_METADATA_KEY } from "../src/constants.ts";
import {
  enteredElevator,
  getElevatorConfiguration,
  isElevatorActive,
  parseElevatorConfiguration,
  pointInShape,
  positionChanged,
  resolveElevatorDestination,
  selectWinningElevator,
} from "../src/elevator.ts";
import type { VirtualLayerState } from "../src/virtualLayers.ts";

function shape(overrides: Partial<Shape> = {}): Shape {
  return {
    id: "elevator", type: "SHAPE", name: "Elevator", visible: true, locked: false,
    createdUserId: "gm", zIndex: 1, lastModified: "", lastModifiedUserId: "gm",
    position: { x: 0, y: 0 }, rotation: 0, scale: { x: 1, y: 1 }, metadata: {},
    layer: "DRAWING", width: 100, height: 100, shapeType: "RECTANGLE",
    style: { fillColor: "#000", fillOpacity: 1, strokeColor: "#000", strokeOpacity: 1, strokeWidth: 1, strokeDash: [] },
    ...overrides,
  };
}

const state: VirtualLayerState = {
  version: 1,
  layers: [{ id: "upper", name: "Upper", obrLayer: "CHARACTER" }],
};

test("only an outside to inside position change enters", () => {
  const elevator = shape();
  assert.equal(enteredElevator(elevator, { x: -1, y: 50 }, { x: 0, y: 50 }), true);
  assert.equal(enteredElevator(elevator, { x: 20, y: 20 }, { x: 30, y: 30 }), false);
  assert.equal(enteredElevator(elevator, { x: 20, y: 20 }, { x: -1, y: 20 }), false);
  assert.equal(enteredElevator(elevator, { x: 20, y: 20 }, { x: 20, y: 20 }), false);
});

test("non-position updates and startup snapshots cannot enter", () => {
  assert.equal(positionChanged(undefined, { x: 10, y: 10 }), false);
  assert.equal(positionChanged({ x: 10, y: 10 }, { x: 10, y: 10 }), false);
  assert.equal(enteredElevator(shape(), undefined, { x: 10, y: 10 }), false);
});

test("leaving rearms a token for a later re-entry", () => {
  const elevator = shape();
  assert.equal(enteredElevator(elevator, { x: 10, y: 10 }, { x: -10, y: 10 }), false);
  assert.equal(enteredElevator(elevator, { x: -10, y: 10 }, { x: 10, y: 10 }), true);
});

test("zero effective scale and degenerate shapes are inactive", () => {
  assert.equal(isElevatorActive(shape({ scale: { x: 0, y: 1 } })), false);
  assert.equal(isElevatorActive(shape({ scale: { x: 1, y: 0 } })), false);
  assert.equal(isElevatorActive(shape({ width: 0 })), false);
  assert.equal(isElevatorActive(shape({ height: 0 })), false);
});

test("rotated and scaled rectangle hit testing includes its boundary", () => {
  const elevator = shape({ width: 20, height: 10, position: { x: 50, y: 50 }, scale: { x: 2, y: .5 }, rotation: 90 });
  assert.equal(pointInShape(elevator, { x: 47.5, y: 70 }), true);
  assert.equal(pointInShape(elevator, { x: 44, y: 70 }), false);
});

test("circle, triangle, and hexagon reject points inside only their AABB", () => {
  assert.equal(pointInShape(shape({ shapeType: "CIRCLE" }), { x: 1, y: 1 }), false);
  assert.equal(pointInShape(shape({ shapeType: "TRIANGLE" }), { x: 1, y: 1 }), false);
  assert.equal(pointInShape(shape({ shapeType: "HEXAGON" }), { x: 1, y: 1 }), false);
  assert.equal(pointInShape(shape({ shapeType: "CIRCLE" }), { x: 50, y: 0 }), true);
});

test("overlapping elevators choose z-index then stable ID and only one winner", () => {
  assert.equal(selectWinningElevator([{ id: "low", zIndex: 1 }, { id: "high", zIndex: 3 }])?.id, "high");
  assert.equal(selectWinningElevator([{ id: "zeta", zIndex: 3 }, { id: "alpha", zIndex: 3 }])?.id, "alpha");
  assert.equal([selectWinningElevator([{ id: "a", zIndex: 1 }, { id: "b", zIndex: 2 }])].length, 1);
});

test("native and virtual destinations resolve without considering source layer", () => {
  assert.deepEqual(resolveElevatorDestination({ version: 1, destination: { kind: "native", layer: "PROP" } }, state), { layer: "PROP" });
  assert.deepEqual(resolveElevatorDestination({ version: 1, destination: { kind: "virtual", virtualLayerId: "upper" } }, state), { layer: "CHARACTER", virtualLayerId: "upper" });
  assert.equal(resolveElevatorDestination({ version: 1, destination: { kind: "virtual", virtualLayerId: "deleted" } }, state), undefined);
});

test("metadata parsing is defensive and preserves versioned destinations", () => {
  const configuration = { version: 1, destination: { kind: "virtual", virtualLayerId: "upper" } } as const;
  assert.deepEqual(parseElevatorConfiguration(configuration), configuration);
  assert.equal(parseElevatorConfiguration({ version: 0, destination: configuration.destination }), undefined);
  assert.equal(parseElevatorConfiguration({ version: 1, destination: { kind: "native", layer: "INVALID" } }), undefined);
  assert.equal(parseElevatorConfiguration({ version: 1, destination: { kind: "virtual", virtualLayerId: "" } }), undefined);
  assert.equal(parseElevatorConfiguration("bad"), undefined);
  const item = { metadata: { [ELEVATOR_METADATA_KEY]: configuration } } as Pick<Item, "metadata">;
  assert.deepEqual(getElevatorConfiguration(item), configuration);
});

test("independent tokens can enter during the same scene update", () => {
  const elevator = shape();
  const movements = [
    [{ x: -1, y: 10 }, { x: 10, y: 10 }],
    [{ x: 50, y: -1 }, { x: 50, y: 10 }],
  ] as const;
  assert.deepEqual(movements.map(([before, after]) => enteredElevator(elevator, before, after)), [true, true]);
});

test("assignment-only updates cannot cascade without another X/Y move", () => {
  const elevator = shape();
  const stationary = { x: 10, y: 10 };
  assert.equal(enteredElevator(elevator, stationary, stationary), false);
});
