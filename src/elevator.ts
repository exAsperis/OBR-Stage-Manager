import type { Item, Shape } from "@owlbear-rodeo/sdk";
import { ELEVATOR_METADATA_KEY } from "./constants.ts";
import type { VirtualLayerState } from "./virtualLayers.ts";

export type ElevatorDestination =
  | { kind: "native"; layer: Item["layer"] }
  | { kind: "virtual"; virtualLayerId: string };

export type ElevatorConfiguration = { version: 1; destination: ElevatorDestination };
export type Position = Readonly<{ x: number; y: number }>;

export function elevatorDestinationsEqual(left: ElevatorDestination, right: ElevatorDestination) {
  return left.kind === right.kind && (left.kind === "native"
    ? left.layer === (right as Extract<ElevatorDestination, { kind: "native" }>).layer
    : left.virtualLayerId === (right as Extract<ElevatorDestination, { kind: "virtual" }>).virtualLayerId);
}

const NATIVE_LAYERS = new Set<Item["layer"]>([
  "MAP", "GRID", "DRAWING", "PROP", "MOUNT", "CHARACTER", "ATTACHMENT",
  "NOTE", "TEXT", "RULER", "FOG", "POINTER", "CONTROL", "POPOVER",
  "POST_PROCESS" as Item["layer"],
]);

export function parseElevatorConfiguration(value: unknown): ElevatorConfiguration | undefined {
  if (!value || typeof value !== "object" || (value as { version?: unknown }).version !== 1) return undefined;
  const destination = (value as { destination?: unknown }).destination;
  if (!destination || typeof destination !== "object") return undefined;
  const candidate = destination as { kind?: unknown; layer?: unknown; virtualLayerId?: unknown };
  if (candidate.kind === "native" && typeof candidate.layer === "string" && NATIVE_LAYERS.has(candidate.layer as Item["layer"])) {
    return { version: 1, destination: { kind: "native", layer: candidate.layer as Item["layer"] } };
  }
  if (candidate.kind === "virtual" && typeof candidate.virtualLayerId === "string" && candidate.virtualLayerId.length > 0) {
    return { version: 1, destination: { kind: "virtual", virtualLayerId: candidate.virtualLayerId } };
  }
  return undefined;
}

export function getElevatorConfiguration(item: Pick<Item, "metadata">) {
  return parseElevatorConfiguration(item.metadata[ELEVATOR_METADATA_KEY]);
}

export function isElevatorActive(shape: Pick<Shape, "width" | "height" | "scale">) {
  return shape.scale.x !== 0 && shape.scale.y !== 0 && shape.width !== 0 && shape.height !== 0;
}

export function positionChanged(previous: Position | undefined, current: Position) {
  return previous !== undefined && (previous.x !== current.x || previous.y !== current.y);
}

function pointInPolygon(point: Position, vertices: Position[]) {
  const epsilon = 1e-9;
  let inside = false;
  for (let index = 0, previous = vertices.length - 1; index < vertices.length; previous = index++) {
    const a = vertices[previous];
    const b = vertices[index];
    const cross = (point.x - a.x) * (b.y - a.y) - (point.y - a.y) * (b.x - a.x);
    const onSegment = Math.abs(cross) <= epsilon && point.x >= Math.min(a.x, b.x) - epsilon &&
      point.x <= Math.max(a.x, b.x) + epsilon && point.y >= Math.min(a.y, b.y) - epsilon && point.y <= Math.max(a.y, b.y) + epsilon;
    if (onSegment) return true;
    if ((a.y > point.y) !== (b.y > point.y) && point.x <= (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Convert a world point to the shape's unscaled, unrotated top-left local coordinates. */
function shapeLocalPoint(shape: Pick<Shape, "position" | "rotation" | "scale">, point: Position): Position {
  const radians = -shape.rotation * Math.PI / 180;
  const dx = point.x - shape.position.x;
  const dy = point.y - shape.position.y;
  return {
    x: (dx * Math.cos(radians) - dy * Math.sin(radians)) / shape.scale.x,
    y: (dx * Math.sin(radians) + dy * Math.cos(radians)) / shape.scale.y,
  };
}

export function pointInShape(shape: Pick<Shape, "position" | "rotation" | "scale" | "width" | "height" | "shapeType">, point: Position) {
  if (!isElevatorActive(shape)) return false;
  const local = shapeLocalPoint(shape, point);
  const { width, height } = shape;
  if (shape.shapeType === "CIRCLE") {
    const x = (local.x - width / 2) / (width / 2);
    const y = (local.y - height / 2) / (height / 2);
    return x * x + y * y <= 1 + 1e-9;
  }
  if (shape.shapeType === "TRIANGLE") {
    return pointInPolygon(local, [{ x: width / 2, y: 0 }, { x: width, y: height }, { x: 0, y: height }]);
  }
  if (shape.shapeType === "HEXAGON") {
    return pointInPolygon(local, [
      { x: width * .25, y: 0 }, { x: width * .75, y: 0 }, { x: width, y: height / 2 },
      { x: width * .75, y: height }, { x: width * .25, y: height }, { x: 0, y: height / 2 },
    ]);
  }
  return local.x >= 0 && local.x <= width && local.y >= 0 && local.y <= height;
}

export function resolveElevatorDestination(configuration: ElevatorConfiguration, state: VirtualLayerState) {
  if (configuration.destination.kind === "native") return { layer: configuration.destination.layer };
  const virtualLayerId = configuration.destination.virtualLayerId;
  const definition = state.layers.find((entry) => entry.id === virtualLayerId);
  return definition ? { layer: definition.obrLayer, virtualLayerId: definition.id } : undefined;
}

export function selectWinningElevator<T extends Pick<Item, "id" | "zIndex">>(elevators: T[]) {
  return [...elevators].sort((a, b) => b.zIndex - a.zIndex || a.id.localeCompare(b.id))[0];
}

export function enteredElevator(shape: Pick<Shape, "position" | "rotation" | "scale" | "width" | "height" | "shapeType">, previous: Position | undefined, current: Position) {
  return positionChanged(previous, current) && !pointInShape(shape, previous!) && pointInShape(shape, current);
}

export function isElevatorSubject(item: Pick<Item, "type">) {
  return item.type === "IMAGE";
}
