export const HIERARCHY_LEADING_CHROME_WIDTH = 60;
export const HIERARCHY_MAX_ACTION_COLUMNS = 9;

export function hierarchyActionColumns(width: number, labelWidth = 228, slotSize = 30) {
  const fitting = Math.floor((width - HIERARCHY_LEADING_CHROME_WIDTH - labelWidth) / slotSize);
  return Math.max(1, Math.min(HIERARCHY_MAX_ACTION_COLUMNS, fitting));
}

export function splitHierarchyActions<T>(actions: readonly T[], columns: number) {
  if (actions.length <= columns) return { overflow: [] as T[], visible: [...actions] };
  const visibleCount = Math.max(0, columns - 1);
  return { overflow: actions.slice(0, actions.length - visibleCount), visible: actions.slice(actions.length - visibleCount) };
}
