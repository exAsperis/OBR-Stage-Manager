import type { Item } from "@owlbear-rodeo/sdk";
import type { StackOperation } from "./stacking";
import { canonicalizeVirtualLayerName, canonicalVirtualLayerIdentity, parseVirtualLayerPath } from "./virtualLayerName.ts";
import { withoutBoundaryInheritance } from "./inheritanceBoundary.ts";
import { LEGACY_V1_VIRTUAL_LAYERS_METADATA_KEY, LEGACY_VIRTUAL_LAYERS_METADATA_KEY, VIRTUAL_LAYERS_METADATA_KEY, VIRTUAL_LAYER_METADATA_KEY } from "./constants.ts";
import { isMigratableOutlinerV0Document, isMigratableOutlinerV1Document } from "./namespaceMigration.ts";

export interface VirtualLayerDefinition {
  id: string;
  name: string;
  obrLayer: Item["layer"];
  order: number;
}

export interface InheritedItemState {
  disableHit: boolean;
  locked: boolean;
  visible: boolean;
  transparent: boolean;
}

export type StatefulProperty = keyof InheritedItemState;
export type EnforcedItemState = Partial<InheritedItemState>;
export type VirtualInheritance = { mode: "pass-through" } | { mode: "independent"; enforce: EnforcedItemState };

export interface StateInheritanceRules {
  native?: Partial<Record<Item["layer"], EnforcedItemState>>;
  virtual?: Record<string, VirtualInheritance>;
  unassigned?: Partial<Record<Item["layer"], VirtualInheritance>>;
}

export interface VirtualLayerState {
  version: 3;
  layers: VirtualLayerDefinition[];
  unassignedOrders?: Partial<Record<Item["layer"], number>>;
  stateOrders?: Record<string, string[]>;
  /** Normalized state name, or null when every state in the group is suppressed. */
  stateSelections?: Record<string, string | null>;
  inheritance?: StateInheritanceRules;
}

export type VirtualLayerItem = Pick<Item, "id" | "layer" | "zIndex" | "metadata">;
export const UNASSIGNED_ID = "__unassigned__";
export const EMPTY_VIRTUAL_LAYER_STATE: VirtualLayerState = { version: 3, layers: [] };
export const STATEFUL_PROPERTIES: StatefulProperty[] = ["transparent", "disableHit", "locked", "visible"];

const isLayer = (value: unknown): value is Item["layer"] => typeof value === "string" && [
  "MAP", "GRID", "DRAWING", "PROP", "MOUNT", "CHARACTER", "ATTACHMENT",
  "NOTE", "TEXT", "RULER", "FOG", "POINTER", "POST_PROCESS", "CONTROL", "POPOVER",
].includes(value);

function parseEnforcedState(value: unknown): EnforcedItemState | undefined {
  if (!value || typeof value !== "object") return undefined;
  const parsed: EnforcedItemState = {};
  for (const property of STATEFUL_PROPERTIES) {
    const candidate = (value as Partial<InheritedItemState>)[property];
    if (typeof candidate === "boolean") parsed[property] = candidate;
  }
  return parsed;
}

function parseVirtualInheritance(value: unknown): VirtualInheritance | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as { mode?: unknown; enforce?: unknown };
  if (candidate.mode === "pass-through") return { mode: "pass-through" };
  if (candidate.mode === "independent") return { mode: "independent", enforce: parseEnforcedState(candidate.enforce) ?? {} };
  return undefined;
}

function parseInheritanceRules(value: unknown, layers: VirtualLayerDefinition[]): StateInheritanceRules | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as { native?: unknown; virtual?: unknown; unassigned?: unknown };
  const native: NonNullable<StateInheritanceRules["native"]> = {};
  const virtual: NonNullable<StateInheritanceRules["virtual"]> = {};
  const unassigned: NonNullable<StateInheritanceRules["unassigned"]> = {};
  if (raw.native && typeof raw.native === "object") for (const [layer, rule] of Object.entries(raw.native)) {
    const parsed = parseEnforcedState(rule);
    if (isLayer(layer) && parsed && Object.keys(parsed).length) native[layer] = parsed;
  }
  if (raw.virtual && typeof raw.virtual === "object") for (const [id, rule] of Object.entries(raw.virtual)) {
    const parsed = parseVirtualInheritance(rule);
    if (layers.some((layer) => layer.id === id) && parsed) virtual[id] = parsed;
  }
  if (raw.unassigned && typeof raw.unassigned === "object") for (const [layer, rule] of Object.entries(raw.unassigned)) {
    const parsed = parseVirtualInheritance(rule);
    if (isLayer(layer) && parsed) unassigned[layer] = parsed;
  }
  return Object.keys(native).length || Object.keys(virtual).length || Object.keys(unassigned).length
    ? { ...(Object.keys(native).length ? { native } : {}), ...(Object.keys(virtual).length ? { virtual } : {}), ...(Object.keys(unassigned).length ? { unassigned } : {}) }
    : undefined;
}

export function parseVirtualLayerState(value: unknown): VirtualLayerState {
  if (!value || typeof value !== "object" || (value as { version?: number }).version !== 3 ||
      !Array.isArray((value as { layers?: unknown }).layers)) return EMPTY_VIRTUAL_LAYER_STATE;
  const layers = (value as { layers: unknown[] }).layers.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const candidate = entry as Partial<VirtualLayerDefinition>;
    if (typeof candidate.id !== "string" || !candidate.id || typeof candidate.name !== "string" || !candidate.name.trim() ||
        !isLayer(candidate.obrLayer) || typeof candidate.order !== "number" || !Number.isFinite(candidate.order)) return [];
    let name: string;
    try { name = canonicalizeVirtualLayerName(candidate.name); } catch { return []; }
    return [{ id: candidate.id, name, obrLayer: candidate.obrLayer, order: candidate.order }];
  });
  const rawOrders = (value as { unassignedOrders?: unknown }).unassignedOrders;
  const unassignedOrders: Partial<Record<Item["layer"], number>> = {};
  if (rawOrders && typeof rawOrders === "object") for (const [layer, order] of Object.entries(rawOrders)) {
    if (isLayer(layer) && typeof order === "number" && Number.isFinite(order)) unassignedOrders[layer] = order;
  }
  const inheritance = parseInheritanceRules((value as { inheritance?: unknown }).inheritance, layers);
  const rawStateOrders = (value as { stateOrders?: unknown }).stateOrders;
  const stateOrders: Record<string, string[]> = {};
  if (rawStateOrders && typeof rawStateOrders === "object") for (const [group, order] of Object.entries(rawStateOrders)) {
    if (group && Array.isArray(order)) {
      const states = [...new Set(order.filter((entry): entry is string => typeof entry === "string" && Boolean(entry)))];
      if (states.length) stateOrders[group] = states;
    }
  }
  const rawStateSelections = (value as { stateSelections?: unknown }).stateSelections;
  const stateSelections: Record<string, string | null> = {};
  if (rawStateSelections && typeof rawStateSelections === "object") for (const [group, selection] of Object.entries(rawStateSelections)) {
    const groupKey = group.trim().toLocaleLowerCase();
    if (groupKey && (selection === null || (typeof selection === "string" && selection.trim()))) {
      stateSelections[groupKey] = typeof selection === "string" ? selection.trim().toLocaleLowerCase() : null;
    }
  }
  return withoutBoundaryInheritance({ version: 3, layers, ...(Object.keys(unassignedOrders).length ? { unassignedOrders } : {}),
    ...(Object.keys(stateOrders).length ? { stateOrders } : {}),
    ...(Object.keys(stateSelections).length ? { stateSelections } : {}), ...(inheritance ? { inheritance } : {}) });
}

export function stateFromMetadata(metadata: Record<string, unknown>) {
  return parseVirtualLayerState(metadata[VIRTUAL_LAYERS_METADATA_KEY]);
}

export type SceneModelCompatibility = "current" | "empty" | "legacy" | "migratable" | "invalid";

export function sceneModelCompatibility(metadata: Record<string, unknown>): SceneModelCompatibility {
  if (Object.prototype.hasOwnProperty.call(metadata, VIRTUAL_LAYERS_METADATA_KEY)) {
    const value = metadata[VIRTUAL_LAYERS_METADATA_KEY];
    return value && typeof value === "object" && (value as { version?: unknown }).version === 3 &&
      Array.isArray((value as { layers?: unknown }).layers) ? "current" : "invalid";
  }
  if (isMigratableOutlinerV1Document(metadata[LEGACY_V1_VIRTUAL_LAYERS_METADATA_KEY])) return "migratable";
  if (isMigratableOutlinerV0Document(metadata[LEGACY_VIRTUAL_LAYERS_METADATA_KEY])) return "migratable";
  return Object.prototype.hasOwnProperty.call(metadata, LEGACY_VIRTUAL_LAYERS_METADATA_KEY) ? "legacy" : "empty";
}

export const normalizedVirtualLayerName = (name: string) => canonicalVirtualLayerIdentity(name) ?? name.trim().toLocaleLowerCase();

export function linkedVirtualLayers(state: VirtualLayerState, id: string) {
  const target = state.layers.find((layer) => layer.id === id);
  if (!target) return [];
  const normalized = normalizedVirtualLayerName(target.name);
  return state.layers.filter((layer) => normalizedVirtualLayerName(layer.name) === normalized);
}

export function isLinkedVirtualLayer(state: VirtualLayerState, id: string) {
  return linkedVirtualLayers(state, id).length > 1;
}

export function dependentVirtualLayers(state: VirtualLayerState, id: string) {
  const target = state.layers.find((layer) => layer.id === id);
  if (!target) return [];
  const guardian = normalizedVirtualLayerName(target.name);
  return state.layers.filter((layer) => normalizedVirtualLayerName(layer.name).startsWith(`${guardian}/`));
}

export interface StatefulVirtualLayerName {
  group: string;
  state: string;
}

export interface StatefulVirtualLayerGroup {
  name: string;
  states: Array<{ name: string; layers: VirtualLayerDefinition[] }>;
}

export function parseStatefulVirtualLayerName(name: string): StatefulVirtualLayerName | undefined {
  const path = parseVirtualLayerPath(name);
  if (!path || path.segments.length !== 1 || path.segments[0].kind !== "state") return undefined;
  return { group: path.segments[0].group, state: path.segments[0].state };
}

export function statefulVirtualLayerGroups(state: VirtualLayerState): StatefulVirtualLayerGroup[] {
  const groups = new Map<string, StatefulVirtualLayerGroup>();
  const states = new Map<string, Map<string, StatefulVirtualLayerGroup["states"][number]>>();
  for (const layer of state.layers) {
    const parsed = parseStatefulVirtualLayerName(layer.name);
    if (!parsed) continue;
    const groupKey = parsed.group.toLocaleLowerCase();
    const stateKey = parsed.state.toLocaleLowerCase();
    let group = groups.get(groupKey);
    if (!group) {
      group = { name: parsed.group, states: [] };
      groups.set(groupKey, group);
      states.set(groupKey, new Map());
    }
    let groupState = states.get(groupKey)?.get(stateKey);
    if (!groupState) {
      groupState = { name: parsed.state, layers: [] };
      states.get(groupKey)?.set(stateKey, groupState);
      group.states.push(groupState);
    }
    groupState.layers.push(layer);
  }
  return [...groups.entries()].map(([groupKey, group]) => {
    const order = state.stateOrders?.[groupKey] ?? [];
    const positions = new Map(order.map((stateKey, index) => [stateKey, index]));
    return { ...group, states: group.states.map((entry, index) => ({ entry, index }))
      .sort((a, b) => (positions.get(a.entry.name.toLocaleLowerCase()) ?? order.length + a.index) -
        (positions.get(b.entry.name.toLocaleLowerCase()) ?? order.length + b.index))
      .map(({ entry }) => entry) };
  });
}

export function reorderStatefulVirtualLayerState(state: VirtualLayerState, groupName: string, activeState: string, overState: string): VirtualLayerState {
  const groupKey = groupName.trim().toLocaleLowerCase();
  const group = statefulVirtualLayerGroups(state).find((entry) => entry.name.toLocaleLowerCase() === groupKey);
  if (!group) return state;
  const activeKey = activeState.trim().toLocaleLowerCase();
  const overKey = overState.trim().toLocaleLowerCase();
  const order = group.states.map((entry) => entry.name.toLocaleLowerCase());
  const from = order.indexOf(activeKey);
  const to = order.indexOf(overKey);
  if (from < 0 || to < 0 || from === to) return state;
  order.splice(to, 0, order.splice(from, 1)[0]);
  return { ...state, stateOrders: { ...state.stateOrders, [groupKey]: order } };
}

export function mutuallyExclusiveVirtualLayers(state: VirtualLayerState, id: string) {
  const target = state.layers.find((layer) => layer.id === id);
  const parsedTarget = target && parseStatefulVirtualLayerName(target.name);
  if (!parsedTarget) return [];
  const normalizedGroup = parsedTarget.group.toLocaleLowerCase();
  const normalizedState = parsedTarget.state.toLocaleLowerCase();
  return state.layers.filter((layer) => {
    const candidate = parseStatefulVirtualLayerName(layer.name);
    return candidate && candidate.group.toLocaleLowerCase() === normalizedGroup && candidate.state.toLocaleLowerCase() !== normalizedState;
  });
}

export function getStateSelection(state: VirtualLayerState, groupName: string) {
  const key = groupName.trim().toLocaleLowerCase();
  return Object.prototype.hasOwnProperty.call(state.stateSelections ?? {}, key)
    ? state.stateSelections?.[key] : undefined;
}

export function withStateSelection(state: VirtualLayerState, groupName: string, stateName: string | null): VirtualLayerState {
  const groupKey = groupName.trim().toLocaleLowerCase();
  if (!groupKey) return state;
  return { ...state, stateSelections: {
    ...state.stateSelections,
    [groupKey]: stateName === null ? null : stateName.trim().toLocaleLowerCase(),
  } };
}

function validateName(name: string) {
  return canonicalizeVirtualLayerName(name);
}

function orderedForLayer(state: VirtualLayerState, obrLayer: Item["layer"]) {
  return state.layers.filter((entry) => entry.obrLayer === obrLayer)
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

export function orderedGroupIds(state: VirtualLayerState, obrLayer: Item["layer"]) {
  const definitions = orderedForLayer(state, obrLayer);
  const unassignedOrder = state.unassignedOrders?.[obrLayer] ?? definitions.length;
  return [...definitions.map((entry) => ({ id: entry.id, order: entry.order, unassigned: false })),
    { id: UNASSIGNED_ID, order: unassignedOrder, unassigned: true }]
    .sort((a, b) => a.order - b.order || Number(a.unassigned) - Number(b.unassigned) || a.id.localeCompare(b.id))
    .map((entry) => entry.id);
}

function applyGroupOrder(state: VirtualLayerState, obrLayer: Item["layer"], groupIds: string[]): VirtualLayerState {
  const orders = new Map(groupIds.map((id, order) => [id, order]));
  return {
    ...state,
    layers: state.layers.map((entry) => entry.obrLayer === obrLayer ? { ...entry, order: orders.get(entry.id) ?? entry.order } : entry),
    unassignedOrders: { ...state.unassignedOrders, [obrLayer]: orders.get(UNASSIGNED_ID) ?? groupIds.length - 1 },
  };
}

export function createVirtualLayer(state: VirtualLayerState, obrLayer: Item["layer"], name: string, id: string): VirtualLayerState {
  const layer: VirtualLayerDefinition = { id, name: validateName(name), obrLayer, order: orderedForLayer(state, obrLayer).length };
  const next = { ...state, layers: [...state.layers, layer] };
  const groups = orderedGroupIds(next, obrLayer).filter((groupId) => groupId !== id);
  const unassignedIndex = groups.indexOf(UNASSIGNED_ID);
  groups.splice(unassignedIndex < 0 ? groups.length : unassignedIndex, 0, id);
  return withoutBoundaryInheritance(applyGroupOrder(next, obrLayer, groups));
}

export function renameVirtualLayer(state: VirtualLayerState, id: string, name: string): VirtualLayerState {
  if (!state.layers.some((entry) => entry.id === id)) throw new Error("Virtual layer does not exist.");
  const validName = validateName(name);
  return withoutBoundaryInheritance({ ...state, layers: state.layers.map((entry) => entry.id === id ? { ...entry, name: validName } : entry) });
}

export function renameLinkedVirtualLayers(state: VirtualLayerState, id: string, name: string): VirtualLayerState {
  const target = state.layers.find((layer) => layer.id === id);
  const linkedIds = new Set(linkedVirtualLayers(state, id).map((layer) => layer.id));
  if (!linkedIds.size) throw new Error("Virtual layer does not exist.");
  const validName = validateName(name);
  const currentName = validateName(target!.name);
  const dependentIds = new Set(dependentVirtualLayers(state, id).map((layer) => layer.id));
  return withoutBoundaryInheritance({ ...state,
    layers: state.layers.map((entry) => {
      if (linkedIds.has(entry.id)) return { ...entry, name: validName };
      if (dependentIds.has(entry.id)) {
        const dependentName = validateName(entry.name);
        return { ...entry, name: `${validName}${dependentName.slice(currentName.length)}` };
      }
      return entry;
    }),
  });
}

export function deleteVirtualLayer(state: VirtualLayerState, id: string): VirtualLayerState {
  const target = state.layers.find((entry) => entry.id === id);
  if (!target) return state;
  const virtual = { ...state.inheritance?.virtual };
  delete virtual[id];
  const inheritance = state.inheritance ? { ...state.inheritance } : undefined;
  if (inheritance) {
    if (Object.keys(virtual).length) inheritance.virtual = virtual;
    else delete inheritance.virtual;
  }
  const next = { ...state, layers: state.layers.filter((entry) => entry.id !== id), inheritance };
  return applyGroupOrder(next, target.obrLayer, orderedGroupIds(state, target.obrLayer).filter((groupId) => groupId !== id));
}

export function reorderVirtualLayer(state: VirtualLayerState, id: string, targetIndex: number): VirtualLayerState {
  const target = state.layers.find((entry) => entry.id === id);
  if (!target) throw new Error("Virtual layer does not exist.");
  return reorderStackingGroup(state, target.obrLayer, id, targetIndex);
}

export function reorderStackingGroup(state: VirtualLayerState, obrLayer: Item["layer"], id: string, targetIndex: number): VirtualLayerState {
  const groups = orderedGroupIds(state, obrLayer);
  if (!groups.includes(id)) throw new Error("Stacking group does not exist in this native layer.");
  const reordered = groups.filter((groupId) => groupId !== id);
  reordered.splice(Math.max(0, Math.min(targetIndex, reordered.length)), 0, id);
  return applyGroupOrder(state, obrLayer, reordered);
}

export function stackGroup(state: VirtualLayerState, obrLayer: Item["layer"], id: string, operation: StackOperation): VirtualLayerState {
  const groups = orderedGroupIds(state, obrLayer);
  const currentIndex = groups.indexOf(id);
  if (currentIndex < 0) throw new Error("Stacking group does not exist in this native layer.");
  const targetIndex = operation === "front"
    ? 0
    : operation === "back"
      ? groups.length - 1
      : operation === "forward"
        ? Math.max(0, currentIndex - 1)
        : Math.min(groups.length - 1, currentIndex + 1);
  return targetIndex === currentIndex ? state : reorderStackingGroup(state, obrLayer, id, targetIndex);
}

export function getAssignmentId(item: VirtualLayerItem): string | undefined {
  const value = item.metadata[VIRTUAL_LAYER_METADATA_KEY];
  if (!value || typeof value !== "object") return undefined;
  const id = (value as { virtualLayerId?: unknown }).virtualLayerId;
  return typeof id === "string" ? id : undefined;
}

export function resolveGroupId(item: VirtualLayerItem, state: VirtualLayerState): string {
  const id = getAssignmentId(item);
  const definition = id ? state.layers.find((entry) => entry.id === id) : undefined;
  return definition?.obrLayer === item.layer ? definition.id : UNASSIGNED_ID;
}

export interface AssignmentUpdate {
  layer: Item["layer"];
  virtualLayerId?: string;
}

export function calculateAssignmentUpdates(
  items: VirtualLayerItem[],
  state: VirtualLayerState,
  itemIds: Iterable<string>,
  destinationLayer: Item["layer"],
  virtualLayerId?: string
) {
  const selected = new Set(itemIds);
  const definition = virtualLayerId ? state.layers.find((entry) => entry.id === virtualLayerId) : undefined;
  if (virtualLayerId && !definition) throw new Error("Virtual layer does not exist.");
  if (definition && definition.obrLayer !== destinationLayer) throw new Error("Virtual layer belongs to a different native layer.");
  return new Map(items.filter((item) => selected.has(item.id)).map((item) => [item.id, {
    layer: destinationLayer,
    virtualLayerId: definition?.id,
  }]));
}

export function groupsForLayer(items: VirtualLayerItem[], state: VirtualLayerState, obrLayer: Item["layer"]) {
  const groupIds = orderedGroupIds(state, obrLayer);
  return groupIds.map((id) => ({
    id,
    items: items.filter((item) => item.layer === obrLayer && resolveGroupId(item, state) === id)
      .sort((a, b) => a.zIndex - b.zIndex || a.id.localeCompare(b.id)),
  }));
}

export function desiredOrder(items: VirtualLayerItem[], state: VirtualLayerState, obrLayer: Item["layer"]) {
  return groupsForLayer(items, state, obrLayer).reverse().flatMap((group) => group.items);
}

export function calculateNormalizationUpdates(items: VirtualLayerItem[], state: VirtualLayerState, obrLayer: Item["layer"]) {
  const updates = new Map<string, number>();
  desiredOrder(items, state, obrLayer).forEach((item, index) => {
    if (item.zIndex !== index) updates.set(item.id, index);
  });
  return updates;
}

export function hasBoundaryViolation(items: VirtualLayerItem[], state: VirtualLayerState, obrLayer: Item["layer"]) {
  const current = items.filter((item) => item.layer === obrLayer)
    .sort((a, b) => a.zIndex - b.zIndex || a.id.localeCompare(b.id)).map((item) => resolveGroupId(item, state));
  const desired = desiredOrder(items, state, obrLayer).map((item) => resolveGroupId(item, state));
  return current.some((id, index) => id !== desired[index]);
}

function reorder(items: VirtualLayerItem[], selected: Set<string>, operation: StackOperation) {
  const picked = items.filter((item) => selected.has(item.id));
  const rest = items.filter((item) => !selected.has(item.id));
  if (operation === "front") return [...rest, ...picked];
  if (operation === "back") return [...picked, ...rest];
  const result = [...items];
  if (operation === "forward") {
    for (let i = result.length - 2; i >= 0; i--) if (selected.has(result[i].id) && !selected.has(result[i + 1].id)) [result[i], result[i + 1]] = [result[i + 1], result[i]];
  } else {
    for (let i = 1; i < result.length; i++) if (selected.has(result[i].id) && !selected.has(result[i - 1].id)) [result[i], result[i - 1]] = [result[i - 1], result[i]];
  }
  return result;
}

export function calculateVirtualStackingUpdates(items: VirtualLayerItem[], state: VirtualLayerState, targetIds: Iterable<string>, operation: StackOperation) {
  const selected = new Set(targetIds);
  const updates = new Map<string, number>();
  const nativeLayers = new Set(items.filter((item) => selected.has(item.id)).map((item) => item.layer));
  for (const nativeLayer of nativeLayers) {
    const groups = groupsForLayer(items, state, nativeLayer).reverse();
    const order = groups.flatMap((group) => reorder(group.items, selected, operation));
    let index = 0;
    while (index < order.length) {
      if (!selected.has(order[index].id)) { index++; continue; }
      const start = index;
      while (index < order.length && selected.has(order[index].id)) index++;
      const lower = start > 0 ? order[start - 1].zIndex : undefined;
      const upper = index < order.length ? order[index].zIndex : undefined;
      const count = index - start;
      const values = lower === undefined && upper === undefined
        ? Array.from({ length: count }, (_, offset) => offset)
        : lower === undefined
          ? Array.from({ length: count }, (_, offset) => (upper as number) - count + offset)
          : upper === undefined
            ? Array.from({ length: count }, (_, offset) => lower + offset + 1)
            : Array.from({ length: count }, (_, offset) => lower + ((upper - lower) * (offset + 1)) / (count + 1));
      values.forEach((value, offset) => { const item = order[start + offset]; if (item.zIndex !== value) updates.set(item.id, value); });
    }
  }
  return updates;
}
