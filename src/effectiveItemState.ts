import type { Item } from "@owlbear-rodeo/sdk";
import type { EffectiveItemState, StatefulProperty } from "./virtualLayers.ts";
import { STATEFUL_PROPERTIES } from "./virtualLayers.ts";
import { activateTransparency, getTransparentState, restoreTransparency, setTransparentItemVisible, type TransparencyRestoreResult } from "./transparentState.ts";
import { captureLocalItemProperty, releaseLocalItemProperty } from "./localItemState.ts";

const has = (state: Partial<EffectiveItemState>, property: StatefulProperty) =>
  Object.prototype.hasOwnProperty.call(state, property);

/**
 * Applies structural overrides and releases properties that are no longer
 * overridden. Only overridden properties receive a temporary local shadow.
 */
export function applyEffectiveItemState(item: Item, overrides: Partial<EffectiveItemState>): TransparencyRestoreResult {
  const targets: Partial<Record<StatefulProperty, boolean>> = {};
  for (const property of STATEFUL_PROPERTIES) {
    if (has(overrides, property)) {
      captureLocalItemProperty(item, property);
      targets[property] = overrides[property];
    } else {
      const local = releaseLocalItemProperty(item, property);
      if (local !== undefined) targets[property] = local;
    }
  }

  // Legacy inherited transparency did not have the generic local-state shadow.
  if (targets.transparent === undefined && getTransparentState(item)?.source === "inherited") {
    targets.transparent = false;
  }

  let restore: TransparencyRestoreResult = { restored: false, reactivate: false };
  if (targets.transparent === true) {
    activateTransparency(item, has(overrides, "transparent") ? "inherited" : "direct");
  } else if (targets.transparent === false) {
    restore = restoreTransparency(item, targets.visible);
  }

  if (targets.disableHit !== undefined) item.disableHit = targets.disableHit;
  if (targets.visible !== undefined && !restore.restored && !setTransparentItemVisible(item, targets.visible)) {
    item.visible = targets.visible;
  }
  if (targets.locked !== undefined) item.locked = targets.locked;
  return restore;
}
