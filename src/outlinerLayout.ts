import { EXTENSION_ID } from "./constants.ts";

export type OutlinerMode = "full" | "minimized";
export type MinimizedOrientation = "horizontal" | "vertical";
export type ControlDensity = "compact" | "roomy";

export interface OutlinerDimensions {
  width: number;
  height: number;
}

export interface OutlinerLayoutSettings {
  version: 4;
  mode: OutlinerMode;
  minimizedOrientation: MinimizedOrientation;
  full: OutlinerDimensions;
  labelWidth: number;
  editingDensity: ControlDensity;
  controlDensity: ControlDensity;
  editingElevatorCollapsed: boolean;
}

export const OUTLINER_LAYOUT_SETTINGS_KEY = `${EXTENSION_ID}/layoutSettings`;
export const MIN_OUTLINER_WIDTH = 300;
export const MAX_OUTLINER_WIDTH = 800;
export const MIN_FULL_HEIGHT = 129;
export const MAX_OUTLINER_HEIGHT = 800;
export const MIN_HIERARCHY_LABEL_WIDTH = 120;
export const MAX_HIERARCHY_LABEL_WIDTH = 320;
export const DEFAULT_HIERARCHY_LABEL_WIDTH = 228;

export const DEFAULT_OUTLINER_LAYOUT_SETTINGS: OutlinerLayoutSettings = {
  version: 4,
  mode: "full",
  minimizedOrientation: "horizontal",
  full: { width: 375, height: 129 },
  labelWidth: DEFAULT_HIERARCHY_LABEL_WIDTH,
  editingDensity: "compact",
  controlDensity: "roomy",
  editingElevatorCollapsed: false,
};

const upgraded = (mode: OutlinerMode, minimizedOrientation: MinimizedOrientation, full: OutlinerDimensions): OutlinerLayoutSettings => ({
  ...DEFAULT_OUTLINER_LAYOUT_SETTINGS, mode, minimizedOrientation, full,
});

export function clampDimension(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

export type ResizeAxis = "width" | "height" | "both";

export function resizedDimensions(start: OutlinerDimensions, axis: ResizeAxis, deltaX: number, deltaY: number) {
  return {
    width: axis === "height" ? start.width : clampDimension(start.width + deltaX, MIN_OUTLINER_WIDTH, MAX_OUTLINER_WIDTH),
    height: axis === "width" ? start.height : clampDimension(start.height + deltaY, MIN_FULL_HEIGHT, MAX_OUTLINER_HEIGHT),
  };
}

function dimensions(value: unknown, minimumHeight: number): OutlinerDimensions | undefined {
  if (!value || typeof value !== "object") return;
  const width = (value as { width?: unknown }).width;
  const height = (value as { height?: unknown }).height;
  if (typeof width !== "number" || !Number.isFinite(width) || typeof height !== "number" || !Number.isFinite(height)) return;
  return {
    width: clampDimension(width, MIN_OUTLINER_WIDTH, MAX_OUTLINER_WIDTH),
    height: clampDimension(height, minimumHeight, MAX_OUTLINER_HEIGHT),
  };
}

export function parseOutlinerLayoutSettings(value: unknown): OutlinerLayoutSettings | undefined {
  if (!value || typeof value !== "object") return;
  const version = (value as { version?: unknown }).version;
  const mode = (value as { mode?: unknown }).mode;
  const full = dimensions((value as { full?: unknown }).full, MIN_FULL_HEIGHT);
  if ((mode !== "full" && mode !== "minimized") || !full) return;
  if (version === 1) {
    if (!dimensions((value as { minimized?: unknown }).minimized, 1)) return;
    return upgraded(mode, "horizontal", full);
  }
  if (version === 2) {
    const orientation = (value as { minimizedOrientation?: unknown }).minimizedOrientation;
    if (orientation !== "horizontal" && orientation !== "vertical") return;
    return upgraded(mode, orientation, full);
  }
  if (version === 3) {
    const orientation = (value as { minimizedOrientation?: unknown }).minimizedOrientation;
    if (orientation !== "horizontal" && orientation !== "vertical") return;
    return upgraded(mode, orientation, full);
  }
  if (version !== 4) return;
  const orientation = (value as { minimizedOrientation?: unknown }).minimizedOrientation;
  if (orientation !== "horizontal" && orientation !== "vertical") return;
  const labelWidth = (value as { labelWidth?: unknown }).labelWidth;
  const editingDensity = (value as { editingDensity?: unknown }).editingDensity;
  const controlDensity = (value as { controlDensity?: unknown }).controlDensity;
  const editingElevatorCollapsed = (value as { editingElevatorCollapsed?: unknown }).editingElevatorCollapsed;
  return {
    version: 4, mode, minimizedOrientation: orientation, full,
    labelWidth: clampDimension(typeof labelWidth === "number" && Number.isFinite(labelWidth) ? labelWidth : DEFAULT_HIERARCHY_LABEL_WIDTH, MIN_HIERARCHY_LABEL_WIDTH, MAX_HIERARCHY_LABEL_WIDTH),
    editingDensity: editingDensity === "roomy" ? "roomy" : "compact",
    controlDensity: controlDensity === "compact" ? "compact" : "roomy",
    editingElevatorCollapsed: editingElevatorCollapsed === true,
  };
}

export function readOutlinerLayoutSettings(storage: Pick<Storage, "getItem"> = window.localStorage) {
  try {
    const raw = storage.getItem(OUTLINER_LAYOUT_SETTINGS_KEY);
    return raw === null ? undefined : parseOutlinerLayoutSettings(JSON.parse(raw));
  } catch {
    return undefined;
  }
}

export function writeOutlinerLayoutSettings(settings: OutlinerLayoutSettings, storage: Pick<Storage, "setItem"> = window.localStorage) {
  try { storage.setItem(OUTLINER_LAYOUT_SETTINGS_KEY, JSON.stringify(settings)); } catch { /* Keep live dimensions when storage is unavailable. */ }
}
