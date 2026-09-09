import OBR, { type Item } from "@owlbear-rodeo/sdk";
import {
  ITEM_INHERITANCE_METADATA_KEY,
  VIRTUAL_LAYER_METADATA_KEY,
  VIRTUAL_LAYERS_METADATA_KEY,
} from "./constants";
import type { StackOperation } from "./stacking";
import { calculateStackingUpdates } from "./stacking";
import {
  calculateNormalizationUpdates,
  calculateAssignmentUpdates,
  calculateVirtualStackingUpdates,
  createVirtualLayer,
  deleteVirtualLayer,
  getAssignmentId,
  parseVirtualLayerState,
  renameLinkedVirtualLayers,
  renameVirtualLayer,
  reorderVirtualLayer,
  reorderStackingGroup,
  stackGroup,
  stateFromMetadata,
  type EnforcedItemState,
  type StatefulProperty,
  type VirtualInheritance,
  type VirtualLayerState,
} from "./virtualLayers";
import {
  calculateInheritanceUpdates,
  directGroupItemIds,
  directGroupTransparency,
  directNativeItemIds,
  getEffectiveItemRule,
  getGroupEffectiveInstructions,
  getGroupInheritance,
  getItemRule,
  getNativeRule,
  linkedDirectPropertyItemIds,
  withLinkedGroupProperty,
} from "./stateInheritance";
import { activateTransparency, getTransparentState, needsTransparencyEnforcement, restoreTransparency, setTransparentItemVisible } from "./transparentState";
import { storeLocalItemProperty, updateShadowedLocalItemProperty } from "./localItemState";
import { applyEffectiveItemState } from "./effectiveItemState";
import { getInheritanceBoundary } from "./inheritanceBoundary";
import { reorderResolvedStateGroup, resolveParticipationModel, withStateGroupSelection } from "./participation";
import { runOutlinerV1NamespaceConversion } from "./namespaceMigration";

let queue: Promise<void> = Promise.resolve();
let writing = false;
const DYNAMIC_FOG_LIGHT_METADATA_KEY = "rodeo.owlbear.dynamic-fog/light";
export const isVirtualLayerWriteInFlight = () => writing;

function serialized(work: () => Promise<void>) {
  queue = queue.then(async () => {
    writing = true;
    try { await work(); } finally { writing = false; }
  }, async () => {
    writing = true;
    try { await work(); } finally { writing = false; }
  });
  return queue;
}

async function getState() {
  return stateFromMetadata(await OBR.scene.getMetadata());
}

async function setState(state: VirtualLayerState) {
  await OBR.scene.setMetadata({ [VIRTUAL_LAYERS_METADATA_KEY]: state });
}

async function finishRestoredItems(restores: ReadonlyMap<string, boolean>) {
  const ids = [...restores.keys()];
  if (!ids.length) return;
  const lightConfigs = new Map<string, Item["metadata"][string]>();
  for (const item of await OBR.scene.items.getItems((item) => restores.has(item.id))) {
    if (Object.prototype.hasOwnProperty.call(item.metadata, DYNAMIC_FOG_LIGHT_METADATA_KEY)) {
      lightConfigs.set(item.id, item.metadata[DYNAMIC_FOG_LIGHT_METADATA_KEY]);
    }
  }
  if (lightConfigs.size) {
    await OBR.scene.items.updateItems([...lightConfigs.keys()], (draft) => {
      for (const item of draft) delete item.metadata[DYNAMIC_FOG_LIGHT_METADATA_KEY];
    }, true);
  }
  // Scene update promises can resolve before Dynamic Fog consumes the item
  // change. Yield so it removes the old local light before the metadata is
  // restored and a new light is created from the valid parent transform.
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  await OBR.scene.items.updateItems(ids, (draft) => {
    for (const item of draft) {
      if (lightConfigs.has(item.id)) {
        item.metadata[DYNAMIC_FOG_LIGHT_METADATA_KEY] = lightConfigs.get(item.id)!;
      }
      if (restores.get(item.id)) item.visible = true;
    }
  }, true);
}

async function normalizeLayers(layers: Iterable<Item["layer"]>, state?: VirtualLayerState) {
  const currentState = state ?? await getState();
  const items = await OBR.scene.items.getItems();
  const updates = new Map<string, number>();
  for (const layer of new Set(layers)) {
    if (!currentState.layers.some((entry) => entry.obrLayer === layer)) continue;
    for (const [id, zIndex] of calculateNormalizationUpdates(items, currentState, layer)) updates.set(id, zIndex);
  }
  if (updates.size) await OBR.scene.items.updateItems([...updates.keys()], (draft) => {
    for (const item of draft) item.zIndex = updates.get(item.id) ?? item.zIndex;
  });
}

export function addVirtualLayer(obrLayer: Item["layer"], name: string) {
  return serialized(async () => {
    const state = await getState();
    const id = `vl_${crypto.randomUUID()}`;
    const next = createVirtualLayer(state, obrLayer, name, id);
    await setState(next);
    await enforceStateInheritance(next);
    await normalizeLayers([obrLayer], next);
  });
}

export function updateVirtualLayerName(id: string, name: string, renameLinked = false) {
  return serialized(async () => {
    const state = await getState();
    const next = renameLinked ? renameLinkedVirtualLayers(state, id, name) : renameVirtualLayer(state, id, name);
    await setState(next);
    await enforceStateInheritance(next);
  });
}

export function moveVirtualLayer(id: string, targetIndex: number) {
  return serialized(async () => {
    const state = await getState();
    const target = state.layers.find((entry) => entry.id === id);
    if (!target) return;
    const next = reorderVirtualLayer(state, id, targetIndex);
    await setState(next);
    await normalizeLayers([target.obrLayer], next);
  });
}

export function moveStackingGroup(obrLayer: Item["layer"], id: string, targetIndex: number) {
  return serialized(async () => {
    const state = await getState();
    const next = reorderStackingGroup(state, obrLayer, id, targetIndex);
    await setState(next);
    await normalizeLayers([obrLayer], next);
  });
}

export async function enforceStateInheritance(state?: VirtualLayerState) {
  const currentState = state ?? await getState();
  const items = await OBR.scene.items.getItems();
  const updates = calculateInheritanceUpdates(items, currentState);
  const directUpdates = items.filter((item) => getTransparentState(item)?.source === "direct" && needsTransparencyEnforcement(item));
  const updateIds = new Set([...updates.keys(), ...directUpdates.map((item) => item.id)]);
  const restores = new Map<string, boolean>();
  if (updateIds.size) await OBR.scene.items.updateItems([...updateIds], (draft) => {
    for (const item of draft) {
      if (!updates.has(item.id)) {
        activateTransparency(item, "direct");
        continue;
      }
      const update = updates.get(item.id);
      if (!update) continue;
      const instructions = update.instructions ?? {};
      if (getItemRule(item)?.legacy) item.metadata[ITEM_INHERITANCE_METADATA_KEY] = { independent: true };
      if (update.preserveTransparency && getTransparentState(item)) {
        activateTransparency(item, "direct");
      }
      const result = applyEffectiveItemState(item, instructions);
      if (result.restored) restores.set(item.id, result.reactivate);
    }
  }, true);
  await finishRestoredItems(restores);
}

export type RuleScope = { kind: "native"; layer: Item["layer"] } | { kind: "group"; layer: Item["layer"]; groupId: string };

function withNativeInstructions(state: VirtualLayerState, layer: Item["layer"], enforce: EnforcedItemState): VirtualLayerState {
  const inheritance = { ...state.inheritance };
  const native = { ...inheritance.native };
  if (Object.keys(enforce).length) native[layer] = enforce; else delete native[layer];
  if (Object.keys(native).length) inheritance.native = native; else delete inheritance.native;
  return { ...state, inheritance: inheritance.native || inheritance.virtual || inheritance.unassigned ? inheritance : undefined };
}

function withGroupInheritance(state: VirtualLayerState, scope: Extract<RuleScope, { kind: "group" }>, config: VirtualInheritance): VirtualLayerState {
  const inheritance = { ...state.inheritance };
  if (scope.groupId === "__unassigned__") {
    const unassigned = { ...inheritance.unassigned };
    unassigned[scope.layer] = config;
    inheritance.unassigned = unassigned;
  } else {
    const virtual = { ...inheritance.virtual };
    virtual[scope.groupId] = config;
    inheritance.virtual = virtual;
  }
  return { ...state, inheritance };
}

export function setGroupInheritanceMode(scope: Extract<RuleScope, { kind: "group" }>, mode: VirtualInheritance["mode"]) {
  return serialized(async () => {
    const state = await getState();
    if (getInheritanceBoundary(state, scope.groupId)) return;
    const next = withGroupInheritance(state, scope, mode === "pass-through" ? { mode } : { mode, enforce: {} });
    await setState(next);
    await enforceStateInheritance(next);
  });
}

export function setScopeEnforcement(scope: RuleScope, property: StatefulProperty, enabled: boolean, capturedValue: boolean) {
  return serialized(async () => {
    const state = await getState();
    let next: VirtualLayerState;
    if (scope.kind === "native") {
      const enforce = { ...getNativeRule(state, scope.layer) };
      if (enabled) enforce[property] = capturedValue; else delete enforce[property];
      next = withNativeInstructions(state, scope.layer, enforce);
    } else {
      if (getInheritanceBoundary(state, scope.groupId)) return;
      const config = getGroupInheritance(state, scope.layer, scope.groupId);
      if (config.mode !== "independent") return;
      const enforce = { ...config.enforce };
      if (enabled) enforce[property] = capturedValue; else delete enforce[property];
      next = withGroupInheritance(state, scope, { mode: "independent", enforce });
    }
    await setState(next);
    await enforceStateInheritance(next);
  });
}

export function setScopeProperty(scope: RuleScope, property: StatefulProperty, value: boolean) {
  return serialized(async () => {
    const state = await getState();
    const items = await OBR.scene.items.getItems();
    let next = state;
    const directValues = new Map<string, boolean>();
    if (scope.kind === "native") {
      const enforce = getNativeRule(state, scope.layer);
      if (Object.prototype.hasOwnProperty.call(enforce, property)) next = withNativeInstructions(state, scope.layer, { ...enforce, [property]: value });
      else directNativeItemIds(items, state, scope.layer).forEach((id) => directValues.set(id, value));
    } else {
      const config = getGroupInheritance(state, scope.layer, scope.groupId);
      if (config.mode === "independent" && Object.prototype.hasOwnProperty.call(config.enforce, property)) {
        next = withGroupInheritance(next, scope, { ...config, enforce: { ...config.enforce, [property]: value } });
      } else if (Object.prototype.hasOwnProperty.call(getGroupEffectiveInstructions(state, scope.layer, scope.groupId), property)) {
        return;
      }
      if (scope.groupId !== "__unassigned__") {
        next = withLinkedGroupProperty(next, scope.groupId, property, value);
        linkedDirectPropertyItemIds(items, state, scope.groupId, property).forEach((id) => directValues.set(id, value));
      } else if (!Object.prototype.hasOwnProperty.call(getGroupEffectiveInstructions(state, scope.layer, scope.groupId), property)) {
        directGroupItemIds(items, state, scope.layer, scope.groupId).forEach((id) => directValues.set(id, value));
      }
    }
    if (next !== state) await setState(next);
    const restores = new Map<string, boolean>();
    if (directValues.size) await OBR.scene.items.updateItems([...directValues.keys()], (draft) => {
      for (const item of draft) {
        const directValue = directValues.get(item.id) ?? value;
        if (updateShadowedLocalItemProperty(item, property, directValue)) continue;
        if (property === "transparent") {
          if (directValue) activateTransparency(item, "direct");
          else {
            const result = restoreTransparency(item, getEffectiveItemRule(item, next).visible);
            if (result.restored) restores.set(item.id, result.reactivate);
          }
        } else if (property === "visible" && setTransparentItemVisible(item, directValue)) {
          // Transparent parents stay hidden while their logical visibility changes.
        } else item[property] = directValue;
      }
    }, true);
    await finishRestoredItems(restores);
    await enforceStateInheritance(next);
  });
}

export function toggleItemInheritance(item: Item) {
  return serialized(async () => {
    const state = await getState();
    const independent = Boolean(getItemRule(item));
    await OBR.scene.items.updateItems([item.id], (draft) => {
      const target = draft[0];
      if (independent) delete target.metadata[ITEM_INHERITANCE_METADATA_KEY];
      else {
        target.metadata[ITEM_INHERITANCE_METADATA_KEY] = { independent: true };
        if (getTransparentState(target)?.source === "inherited") activateTransparency(target, "direct");
      }
    });
    await enforceStateInheritance(state);
  });
}

export function stackVirtualLayer(obrLayer: Item["layer"], id: string, operation: StackOperation) {
  return serialized(async () => {
    const state = await getState();
    const next = stackGroup(state, obrLayer, id, operation);
    if (next === state) return;
    await setState(next);
    await normalizeLayers([obrLayer], next);
  });
}

export function removeVirtualLayer(id: string) {
  return serialized(async () => {
    const state = await getState();
    const target = state.layers.find((entry) => entry.id === id);
    if (!target) return;
    const next = deleteVirtualLayer(state, id);
    await setState(next);
    const items = await OBR.scene.items.getItems();
    const affected = items.filter((item) => getAssignmentId(item) === id).map((item) => item.id);
    if (affected.length) await OBR.scene.items.updateItems(affected, (draft) => {
      for (const item of draft) delete item.metadata[VIRTUAL_LAYER_METADATA_KEY];
    });
    await normalizeLayers([target.obrLayer], next);
  });
}

export function assignItems(itemIds: string[], virtualLayerId?: string, nativeLayer?: Item["layer"], targetId?: string, position: "before" | "after" = "before") {
  return serialized(async () => {
    const state = await getState();
    const allItems = await OBR.scene.items.getItems();
    const targets = allItems.filter((item) => itemIds.includes(item.id));
    const definition = virtualLayerId ? state.layers.find((entry) => entry.id === virtualLayerId) : undefined;
    if (virtualLayerId && !definition) throw new Error("Virtual layer does not exist.");
    const destination = definition?.obrLayer ?? nativeLayer ?? targets[0]?.layer;
    if (!destination) return;
    const affectedLayers = new Set<Item["layer"]>(targets.map((item) => item.layer));
    affectedLayers.add(destination);
    const assignmentUpdates = calculateAssignmentUpdates(allItems, state, itemIds, destination, definition?.id);
    const destinationTransparency = directGroupTransparency(allItems, state, destination, definition?.id ?? "__unassigned__", new Set(itemIds));
    const restores = new Map<string, boolean>();
    await OBR.scene.items.updateItems(itemIds, (draft) => {
      for (const item of draft) {
        const update = assignmentUpdates.get(item.id);
        if (!update) continue;
        item.layer = update.layer;
        if (update.virtualLayerId) item.metadata[VIRTUAL_LAYER_METADATA_KEY] = { virtualLayerId: update.virtualLayerId };
        else delete item.metadata[VIRTUAL_LAYER_METADATA_KEY];
        if (destinationTransparency === true) activateTransparency(item, "direct");
        else if (destinationTransparency === false) {
          const result = restoreTransparency(item, getEffectiveItemRule(item, state).visible);
          if (result.restored) restores.set(item.id, result.reactivate);
        }
      }
    });
    await finishRestoredItems(restores);
    let refreshed = await OBR.scene.items.getItems();
    if (targetId) {
      const groupItems = refreshed.filter((item) => item.layer === destination &&
        (getAssignmentId(item) ?? "") === (definition?.id ?? ""))
        .sort((a, b) => b.zIndex - a.zIndex || a.id.localeCompare(b.id));
      const moving = groupItems.filter((item) => itemIds.includes(item.id));
      const stationary = groupItems.filter((item) => !itemIds.includes(item.id));
      const targetIndex = stationary.findIndex((item) => item.id === targetId);
      const index = targetIndex < 0 ? stationary.length : targetIndex + (position === "after" ? 1 : 0);
      const arranged = [...stationary.slice(0, index), ...moving, ...stationary.slice(index)];
      const positions = new Map(arranged.map((item, index) => [item.id, arranged.length - index]));
      await OBR.scene.items.updateItems(arranged.map((item) => item.id), (draft) => {
        for (const item of draft) item.zIndex = positions.get(item.id) ?? item.zIndex;
      });
      refreshed = await OBR.scene.items.getItems();
    }
    await normalizeLayers(affectedLayers, state);
    await enforceStateInheritance(state);
  });
}

export function stackVirtualItems(itemIds: string[], operation: StackOperation) {
  return serialized(async () => {
    const state = await getState();
    const items = await OBR.scene.items.getItems();
    const updates = state.layers.length
      ? calculateVirtualStackingUpdates(items, state, itemIds, operation)
      : calculateStackingUpdates(items, itemIds, operation);
    if (updates.size) await OBR.scene.items.updateItems([...updates.keys()], (draft) => {
      for (const item of draft) item.zIndex = updates.get(item.id) ?? item.zIndex;
    });
  });
}

export async function readVirtualLayerState() {
  return parseVirtualLayerState((await OBR.scene.getMetadata())[VIRTUAL_LAYERS_METADATA_KEY]);
}

export function setItemTransparency(item: Item, value: boolean) {
  return serialized(async () => {
    let restore: { restored: boolean; reactivate: boolean } = { restored: false, reactivate: false };
    await OBR.scene.items.updateItems([item.id], (items) => {
      if (updateShadowedLocalItemProperty(items[0], "transparent", value)) return;
      if (value) activateTransparency(items[0], "direct");
      else restore = restoreTransparency(items[0]);
    }, true);
    if (restore.restored) await finishRestoredItems(new Map([[item.id, restore.reactivate]]));
  });
}

export function moveStatefulVirtualLayerState(groupName: string, activeState: string, overState: string) {
  return serialized(async () => {
    const state = await getState();
    const next = reorderResolvedStateGroup(state, groupName, activeState, overState);
    if (next !== state) await setState(next);
  });
}

export function setItemVisibility(item: Item, value: boolean) {
  return serialized(async () => {
    await OBR.scene.items.updateItems([item.id], (items) => {
      if (updateShadowedLocalItemProperty(items[0], "visible", value)) return;
      if (!setTransparentItemVisible(items[0], value)) items[0].visible = value;
    }, true);
  });
}

export function setStatefulVirtualLayerSelection(groupId: string, stateName: string | null) {
  return serialized(async () => {
    const state = await getState();
    const next = withStateGroupSelection(state, groupId, stateName);
    // State controls are authoritative: selecting a state must show it even if
    // suppression previously captured direct transparency as the local value.
    // Update the shadow before publishing the selection so either reconciler
    // releases the same visible value, regardless of event ordering.
    if (stateName !== null) {
      const normalizedState = stateName.trim().toLocaleLowerCase();
      const group = resolveParticipationModel(next).stateGroups.find((entry) => entry.id === groupId.trim().toLocaleLowerCase());
      const selected = group?.states.find((entry) => entry.name.toLocaleLowerCase() === normalizedState);
      const selectedLayerIds = new Set(selected?.layers.map((layer) => layer.id) ?? []);
      if (selectedLayerIds.size) {
        const items = await OBR.scene.items.getItems((item) => selectedLayerIds.has(getAssignmentId(item) ?? ""));
        const transparentIds = items.filter((item) => Boolean(getTransparentState(item))).map((item) => item.id);
        if (transparentIds.length) await OBR.scene.items.updateItems(transparentIds, (draft) => {
          for (const item of draft) storeLocalItemProperty(item, "transparent", false);
        }, true);
      }
    }
    await setState(next);
    await enforceStateInheritance(next);
  });
}

export function convertOutlinerV1Namespace() {
  return serialized(() => runOutlinerV1NamespaceConversion({
    getSceneMetadata: () => OBR.scene.getMetadata(),
    getItems: () => OBR.scene.items.getItems(),
    updateItems: (ids, update) => OBR.scene.items.updateItems(ids, update),
    setSceneMetadata: (update) => OBR.scene.setMetadata(update),
  }));
}

export { normalizeLayers };
