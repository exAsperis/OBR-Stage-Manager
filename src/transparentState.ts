import type { Item, Vector2 } from "@owlbear-rodeo/sdk";

// Kept literal so this pure module can run in Node's stripped-TypeScript test mode.
const ITEM_TRANSPARENCY_METADATA_KEY = "com.ex-asperis.obr-stage-manager/v1/transparentState";

export type TransparencySource = "direct" | "inherited";

export interface TransparencyRestoreResult {
  restored: boolean;
  reactivate: boolean;
}

export interface StoredTransparentState {
  scale: Vector2;
  source: TransparencySource;
  visible?: boolean;
  /** @deprecated Read only to restore metadata written by older releases. */
  disableHit?: boolean;
  label?: {
    fillOpacity: number;
    strokeOpacity: number;
  };
}

export function parseTransparentState(value: unknown): StoredTransparentState | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Partial<StoredTransparentState>;
  const scale = candidate.scale;
  if (!scale || typeof scale !== "object" || !Number.isFinite(scale.x) || !Number.isFinite(scale.y) ||
      (candidate.source !== "direct" && candidate.source !== "inherited")) return undefined;
  const rawLabel = candidate.label;
  const label = rawLabel && typeof rawLabel === "object" && Number.isFinite(rawLabel.fillOpacity) &&
    Number.isFinite(rawLabel.strokeOpacity) ? {
      fillOpacity: rawLabel.fillOpacity,
      strokeOpacity: rawLabel.strokeOpacity,
    } : undefined;
  return {
    scale: { x: scale.x, y: scale.y },
    source: candidate.source,
    ...(typeof candidate.visible === "boolean" ? { visible: candidate.visible } : {}),
    ...(typeof candidate.disableHit === "boolean" ? { disableHit: candidate.disableHit } : {}),
    ...(label ? { label } : {}),
  };
}

function getImageTextStyle(item: Item, labelsOnly: boolean) {
  if (item.type !== "IMAGE") return undefined;
  const image = item as Item & {
    textItemType?: unknown;
    text?: { style?: { fillOpacity?: unknown; strokeOpacity?: unknown } };
  };
  if (labelsOnly && image.textItemType !== "LABEL") return undefined;
  const style = image.text?.style;
  return style && typeof style.fillOpacity === "number" && typeof style.strokeOpacity === "number"
    ? style as { fillOpacity: number; strokeOpacity: number }
    : undefined;
}

export function getTransparentState(item: Pick<Item, "metadata">) {
  return parseTransparentState(item.metadata[ITEM_TRANSPARENCY_METADATA_KEY]);
}

export function isItemTransparent(item: Pick<Item, "metadata">) {
  return Boolean(getTransparentState(item));
}

export function getItemVisible(item: Pick<Item, "visible" | "metadata">) {
  return getTransparentState(item)?.visible ?? item.visible;
}

export function setTransparentItemVisible(item: Item, visible: boolean) {
  const stored = getTransparentState(item);
  if (!stored) return false;
  item.metadata[ITEM_TRANSPARENCY_METADATA_KEY] = {
    ...stored,
    visible,
  };
  item.visible = false;
  return true;
}

export function activateTransparency(item: Item, source: TransparencySource) {
  const stored = getTransparentState(item);
  const labelStyle = getImageTextStyle(item, true);
  const next: StoredTransparentState = stored
    ? {
        scale: { ...stored.scale },
        source,
        visible: stored.visible ?? item.visible,
        ...(typeof stored.disableHit === "boolean" ? { disableHit: stored.disableHit } : {}),
        ...(stored.label ? { label: { ...stored.label } } : {}),
      }
    : {
        scale: { ...item.scale },
        source,
        visible: item.visible,
      };
  if (labelStyle && !next.label) next.label = {
    fillOpacity: labelStyle.fillOpacity,
    strokeOpacity: labelStyle.strokeOpacity,
  };
  item.metadata[ITEM_TRANSPARENCY_METADATA_KEY] = next;
  item.scale = { x: 0, y: 0 };
  item.visible = false;
  if (labelStyle) {
    labelStyle.fillOpacity = 0;
    labelStyle.strokeOpacity = 0;
  }
}

export function restoreTransparency(item: Item, finalVisible?: boolean): TransparencyRestoreResult {
  const stored = getTransparentState(item);
  if (!stored) return { restored: false, reactivate: false };
  item.scale = { ...stored.scale };
  if (typeof stored.visible === "boolean") item.visible = stored.visible;
  if (typeof stored.disableHit === "boolean") item.disableHit = stored.disableHit;
  const textStyle = stored.label ? getImageTextStyle(item, false) : undefined;
  if (stored.label && textStyle) {
    textStyle.fillOpacity = stored.label.fillOpacity;
    textStyle.strokeOpacity = stored.label.strokeOpacity;
  }
  delete item.metadata[ITEM_TRANSPARENCY_METADATA_KEY];
  const reactivate = finalVisible ?? item.visible;
  item.visible = false;
  return { restored: true, reactivate };
}

export function needsTransparencyEnforcement(item: Item) {
  const stored = getTransparentState(item);
  if (!stored) return false;
  const labelStyle = getImageTextStyle(item, true);
  return item.scale.x !== 0 || item.scale.y !== 0 || item.visible ||
    typeof stored.visible !== "boolean" ||
    Boolean(labelStyle && (!stored.label || labelStyle.fillOpacity !== 0 || labelStyle.strokeOpacity !== 0));
}
