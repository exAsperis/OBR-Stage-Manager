import type { BoundingBox, Item, Path, Shape } from "@owlbear-rodeo/sdk";
import { ELEVATOR_METADATA_KEY } from "./constants.ts";
import type { VirtualLayerState } from "./virtualLayers.ts";

export type ElevatorDestination =
  | { kind: "native"; layer: Item["layer"] }
  | { kind: "virtual"; virtualLayerId: string };

export type ElevatorConfiguration = { version: 1; destination: ElevatorDestination };
export type Position = Readonly<{ x: number; y: number }>;
export type ElevatorTrigger = Item;

const PATH_MOVE = 0;
const PATH_LINE = 1;
const PATH_CLOSE = 5;

function isPath(item: Item): item is Path {
  return item.type === "PATH";
}

function isShape(item: Item): item is Shape {
  return item.type === "SHAPE";
}

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

export function polygonVertices(path: Pick<Path, "commands">): Position[] | undefined {
  if (path.commands.length < 4 || path.commands[0][0] !== PATH_MOVE || path.commands[path.commands.length - 1][0] !== PATH_CLOSE) return undefined;
  const vertices: Position[] = [{ x: path.commands[0][1], y: path.commands[0][2] }];
  for (const command of path.commands.slice(1, -1)) {
    if (command[0] !== PATH_LINE) return undefined;
    vertices.push({ x: command[1], y: command[2] });
  }
  if (vertices.some(({ x, y }) => !Number.isFinite(x) || !Number.isFinite(y))) return undefined;
  while (vertices.length > 1 && vertices[vertices.length - 1].x === vertices[0].x && vertices[vertices.length - 1].y === vertices[0].y) vertices.pop();
  if (vertices.length < 3 || new Set(vertices.map(({ x, y }) => `${x},${y}`)).size < 3) return undefined;
  const twiceArea = vertices.reduce((area, vertex, index) => {
    const next = vertices[(index + 1) % vertices.length];
    return area + vertex.x * next.y - next.x * vertex.y;
  }, 0);
  return Math.abs(twiceArea) > 1e-9 ? vertices : undefined;
}

export function isElevatorTrigger(item: Item): item is ElevatorTrigger {
  return Boolean(item);
}

export function isSupportedElevatorTrigger(item: ElevatorTrigger) {
  return !isPath(item) || Boolean(polygonVertices(item));
}

export function usesPreciseElevatorGeometry(trigger: ElevatorTrigger) {
  return isShape(trigger) || (isPath(trigger) && Boolean(polygonVertices(trigger)));
}

export function isElevatorActive(trigger: ElevatorTrigger, bounds?: BoundingBox) {
  if (trigger.scale.x === 0 || trigger.scale.y === 0) return false;
  if (isShape(trigger)) return trigger.width !== 0 && trigger.height !== 0;
  if (isPath(trigger) && polygonVertices(trigger)) return true;
  return Boolean(bounds && bounds.width !== 0 && bounds.height !== 0);
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

/** Convert a world point to the shape's unscaled, unrotated coordinates around its OBR item origin. */
function triggerLocalPoint(trigger: Pick<Item, "position" | "rotation" | "scale">, point: Position): Position {
  const radians = -trigger.rotation * Math.PI / 180;
  const dx = point.x - trigger.position.x;
  const dy = point.y - trigger.position.y;
  return {
    x: (dx * Math.cos(radians) - dy * Math.sin(radians)) / trigger.scale.x,
    y: (dx * Math.sin(radians) + dy * Math.cos(radians)) / trigger.scale.y,
  };
}

export function pointInShape(shape: Pick<Shape, "position" | "rotation" | "scale" | "width" | "height" | "shapeType">, point: Position) {
  if (shape.scale.x === 0 || shape.scale.y === 0 || shape.width === 0 || shape.height === 0) return false;
  const local = triggerLocalPoint(shape, point);
  const { width, height } = shape;
  if (shape.shapeType === "RECTANGLE") {
    return local.x >= -1e-9 && local.x <= width + 1e-9 && local.y >= -1e-9 && local.y <= height + 1e-9;
  }
  if (shape.shapeType === "CIRCLE") {
    const x = local.x / (width / 2);
    const y = local.y / (height / 2);
    return x * x + y * y <= 1 + 1e-9;
  }
  if (shape.shapeType === "TRIANGLE") {
    return pointInPolygon(local, [
      { x: 0, y: -height / 2 }, { x: width / 2, y: height / 2 }, { x: -width / 2, y: height / 2 },
    ]);
  }
  if (shape.shapeType === "HEXAGON") {
    return pointInPolygon(local, [
      { x: -width / 4, y: -height / 2 }, { x: width / 4, y: -height / 2 }, { x: width / 2, y: 0 },
      { x: width / 4, y: height / 2 }, { x: -width / 4, y: height / 2 }, { x: -width / 2, y: 0 },
    ]);
  }
  return Math.abs(local.x) <= width / 2 + 1e-9 && Math.abs(local.y) <= height / 2 + 1e-9;
}

export function pointInBounds(bounds: BoundingBox, point: Position) {
  return point.x >= bounds.min.x - 1e-9 && point.x <= bounds.max.x + 1e-9 &&
    point.y >= bounds.min.y - 1e-9 && point.y <= bounds.max.y + 1e-9;
}

export function pointInElevatorTrigger(trigger: ElevatorTrigger, point: Position, bounds?: BoundingBox) {
  if (!isElevatorActive(trigger, bounds)) return false;
  if (isShape(trigger)) return pointInShape(trigger, point);
  if (isPath(trigger)) {
    const vertices = polygonVertices(trigger);
    if (vertices) return pointInPolygon(triggerLocalPoint(trigger, point), vertices);
  }
  return bounds ? pointInBounds(bounds, point) : false;
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

export function enteredElevator(trigger: ElevatorTrigger, previous: Position | undefined, current: Position, bounds?: BoundingBox) {
  return positionChanged(previous, current) && !pointInElevatorTrigger(trigger, previous!, bounds) && pointInElevatorTrigger(trigger, current, bounds);
}

export function isElevatorSubject(item: Pick<Item, "type">) {
  return item.type === "IMAGE";
}
