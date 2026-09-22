import assert from "node:assert/strict";
import test from "node:test";
import type { BoundingBox, Image, Item, Path, PathCommand, Shape } from "@owlbear-rodeo/sdk";
import { ELEVATOR_METADATA_KEY } from "../src/constants.ts";
import {
  enteredElevator,
  elevatorDestinationsEqual,
  getElevatorConfiguration,
  isElevatorActive,
  isSupportedElevatorTrigger,
  parseElevatorConfiguration,
  pointInShape,
  pointInBounds,
  pointInElevatorTrigger,
  polygonVertices,
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

function path(commands: number[][], overrides: Partial<Path> = {}): Path {
  return {
    id: "polygon", type: "PATH", name: "Polygon", visible: true, locked: false,
    createdUserId: "gm", zIndex: 1, lastModified: "", lastModifiedUserId: "gm",
    position: { x: 0, y: 0 }, rotation: 0, scale: { x: 1, y: 1 }, metadata: {},
    layer: "DRAWING", commands: commands as PathCommand[], fillRule: "nonzero",
    style: { fillColor: "#000", fillOpacity: 1, strokeColor: "#000", strokeOpacity: 1, strokeWidth: 1, strokeDash: [] },
    ...overrides,
  };
}

function image(overrides: Partial<Image> = {}): Image {
  return {
    id: "image-elevator", type: "IMAGE", name: "Image Elevator", visible: true, locked: false,
    createdUserId: "gm", zIndex: 1, lastModified: "", lastModifiedUserId: "gm",
    position: { x: 0, y: 0 }, rotation: 0, scale: { x: 1, y: 1 }, metadata: {},
    layer: "PROP", image: { url: "image.png", width: 100, height: 100, mime: "image/png" },
    grid: { dpi: 100, offset: { x: 0, y: 0 } },
    ...overrides,
  };
}

const BOUNDS: BoundingBox = { min: { x: 10, y: 20 }, max: { x: 110, y: 70 }, width: 100, height: 50, center: { x: 60, y: 45 } };

const CONCAVE_POLYGON = [[0, 0, 0], [1, 100, 0], [1, 100, 100], [1, 50, 50], [1, 0, 100], [5]];

const state: VirtualLayerState = {
  version: 1,
  layers: [{ id: "upper", name: "Upper", obrLayer: "CHARACTER" }],
};

test("only an outside to inside position change enters", () => {
  const elevator = shape();
  assert.equal(enteredElevator(elevator, { x: -1, y: 50 }, { x: 0, y: 50 }), true);
  assert.equal(enteredElevator(elevator, { x: 20, y: 20 }, { x: 30, y: 30 }), false);
  assert.equal(enteredElevator(elevator, { x: 20, y: 20 }, { x: -51, y: 20 }), false);
  assert.equal(enteredElevator(elevator, { x: 20, y: 20 }, { x: 20, y: 20 }), false);
});

test("non-position updates and startup snapshots cannot enter", () => {
  assert.equal(positionChanged(undefined, { x: 10, y: 10 }), false);
  assert.equal(positionChanged({ x: 10, y: 10 }, { x: 10, y: 10 }), false);
  assert.equal(enteredElevator(shape(), undefined, { x: 10, y: 10 }), false);
});

test("leaving rearms a token for a later re-entry", () => {
  const elevator = shape();
  assert.equal(enteredElevator(elevator, { x: 10, y: 10 }, { x: -60, y: 10 }), false);
  assert.equal(enteredElevator(elevator, { x: -60, y: 10 }, { x: 10, y: 10 }), true);
});

test("zero effective scale and degenerate shapes are inactive", () => {
  assert.equal(isElevatorActive(shape({ scale: { x: 0, y: 1 } })), false);
  assert.equal(isElevatorActive(shape({ scale: { x: 1, y: 0 } })), false);
  assert.equal(isElevatorActive(shape({ width: 0 })), false);
  assert.equal(isElevatorActive(shape({ height: 0 })), false);
});

test("rectangles use their OBR top-left origin and honor rotation, scale, and boundaries", () => {
  const elevator = shape({ width: 20, height: 10, position: { x: 50, y: 50 }, scale: { x: 2, y: .5 }, rotation: 90 });
  assert.equal(pointInShape(elevator, { x: 47.5, y: 70 }), true);
  assert.equal(pointInShape(elevator, { x: 50, y: 50 }), true);
  assert.equal(pointInShape(elevator, { x: 52.5, y: 70 }), false);
  assert.equal(pointInShape(shape(), { x: -1, y: 50 }), false);
  assert.equal(pointInShape(shape(), { x: 100, y: 100 }), true);
});

test("circle, triangle, and hexagon reject points inside only their AABB", () => {
  assert.equal(pointInShape(shape({ shapeType: "CIRCLE" }), { x: 49, y: 49 }), false);
  assert.equal(pointInShape(shape({ shapeType: "TRIANGLE" }), { x: -49, y: -49 }), false);
  assert.equal(pointInShape(shape({ shapeType: "HEXAGON" }), { x: 49, y: 49 }), false);
  assert.equal(pointInShape(shape({ shapeType: "CIRCLE" }), { x: 50, y: 0 }), true);
  assert.equal(pointInShape(shape({ shapeType: "TRIANGLE" }), { x: 0, y: 0 }), true);
  assert.equal(pointInShape(shape({ shapeType: "HEXAGON" }), { x: 0, y: 0 }), true);
});

test("closed convex and concave PATH polygons use their actual geometry", () => {
  const convex = path([[0, -50, -50], [1, 50, -50], [1, 50, 50], [1, -50, 50], [5]]);
  assert.equal(pointInElevatorTrigger(convex, { x: 0, y: 0 }), true);
  assert.equal(enteredElevator(convex, { x: -51, y: 0 }, { x: -50, y: 0 }), true);
  const concave = path(CONCAVE_POLYGON);
  assert.equal(pointInElevatorTrigger(concave, { x: 20, y: 80 }), true);
  assert.equal(pointInElevatorTrigger(concave, { x: 50, y: 80 }), false);
});

test("PATH polygons honor translation, rotation, nonuniform and negative scale, and edges", () => {
  const polygon = path(
    [[0, -10, -10], [1, 10, -10], [1, 10, 10], [1, -10, 10], [5]],
    { position: { x: 100, y: 100 }, rotation: 90, scale: { x: -2, y: .5 } },
  );
  assert.equal(pointInElevatorTrigger(polygon, { x: 100, y: 100 }), true);
  assert.equal(pointInElevatorTrigger(polygon, { x: 95, y: 80 }), true);
  assert.equal(pointInElevatorTrigger(polygon, { x: 94, y: 80 }), false);
});

test("rejects open, curved, malformed, multi-contour, and zero-area PATH items", () => {
  const rejected = [
    path([[0, 0, 0], [1, 10, 0], [1, 0, 10]]),
    path([[0, 0, 0], [1, 10, 0], [2, 10, 10, 0, 10], [5]]),
    path([[1, 0, 0], [1, 10, 0], [1, 0, 10], [5]]),
    path([[0, 0, 0], [1, 10, 0], [0, 20, 20], [1, 30, 20], [5]]),
    path([[0, 0, 0], [1, 10, 0], [1, 20, 0], [5]]),
    path([[0, 0, 0], [1, Number.POSITIVE_INFINITY, 0], [1, 0, 10], [5]]),
  ];
  for (const candidate of rejected) {
    assert.equal(polygonVertices(candidate), undefined);
    assert.equal(isSupportedElevatorTrigger(candidate), false);
    assert.equal(isElevatorActive(candidate), false);
    assert.equal(isElevatorActive(candidate, BOUNDS), true);
    assert.equal(pointInElevatorTrigger(candidate, { x: 10, y: 20 }, BOUNDS), true);
  }
});

test("arbitrary items use an inclusive rectangular scene bounding box", () => {
  const elevator = image();
  assert.equal(pointInBounds(BOUNDS, { x: 10, y: 20 }), true);
  assert.equal(pointInElevatorTrigger(elevator, { x: 110, y: 70 }, BOUNDS), true);
  assert.equal(pointInElevatorTrigger(elevator, { x: 9, y: 45 }, BOUNDS), false);
  assert.equal(enteredElevator(elevator, { x: 9, y: 45 }, { x: 10, y: 45 }, BOUNDS), true);
});

test("fallback elevators require nonzero effective scale and nondegenerate bounds", () => {
  assert.equal(isElevatorActive(image({ scale: { x: 0, y: 1 } }), BOUNDS), false);
  assert.equal(isElevatorActive(image({ scale: { x: 1, y: 0 } }), BOUNDS), false);
  assert.equal(isElevatorActive(image(), { ...BOUNDS, width: 0 }), false);
  assert.equal(isElevatorActive(image(), { ...BOUNDS, height: 0 }), false);
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

test("compares configured Elevator destinations by kind and stable identity", () => {
  assert.equal(elevatorDestinationsEqual({ kind: "native", layer: "CHARACTER" }, { kind: "native", layer: "CHARACTER" }), true);
  assert.equal(elevatorDestinationsEqual({ kind: "native", layer: "CHARACTER" }, { kind: "native", layer: "PROP" }), false);
  assert.equal(elevatorDestinationsEqual({ kind: "virtual", virtualLayerId: "upper" }, { kind: "virtual", virtualLayerId: "upper" }), true);
  assert.equal(elevatorDestinationsEqual({ kind: "virtual", virtualLayerId: "upper" }, { kind: "virtual", virtualLayerId: "lower" }), false);
  assert.equal(elevatorDestinationsEqual({ kind: "native", layer: "CHARACTER" }, { kind: "virtual", virtualLayerId: "upper" }), false);
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
    [{ x: -1, y: 10 }, { x: 0, y: 10 }],
    [{ x: 10, y: -1 }, { x: 10, y: 0 }],
  ] as const;
  assert.deepEqual(movements.map(([before, after]) => enteredElevator(elevator, before, after)), [true, true]);
});

test("assignment-only updates cannot cascade without another X/Y move", () => {
  const elevator = shape();
  const stationary = { x: 10, y: 10 };
  assert.equal(enteredElevator(elevator, stationary, stationary), false);
});
