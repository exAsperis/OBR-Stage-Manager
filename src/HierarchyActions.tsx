import MoreVertIcon from "@mui/icons-material/MoreVertRounded";
import Box from "@mui/material/Box";
import IconButton, { type IconButtonProps } from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { HIERARCHY_ACTION_SLOT_SIZE, hierarchyActionColumns, splitHierarchyActions } from "./hierarchyActionLayout";
import { HierarchyActionColumnsContext, useHierarchyActionColumns } from "./hierarchyActionContext";

export interface HierarchyAction {
  id: string;
  label: string;
  icon: ReactNode;
  disabled?: boolean;
  color?: IconButtonProps["color"];
  disabledSx?: IconButtonProps["sx"];
  onSelect: (anchor: HTMLElement) => void;
}

export function HierarchyActionLayout({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(1);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setColumns(hierarchyActionColumns(element.clientWidth));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <HierarchyActionColumnsContext.Provider value={columns}><Box ref={ref} sx={{ width: "100%" }}>{children}</Box></HierarchyActionColumnsContext.Provider>;
}

export function HierarchyActionRow({ actions }: { actions: readonly HierarchyAction[] }) {
  const columns = useHierarchyActionColumns();
  const [overflowAnchor, setOverflowAnchor] = useState<HTMLElement | null>(null);
  const { overflow, visible } = splitHierarchyActions(actions, columns);
  const emptySlots = columns - visible.length - (overflow.length ? 1 : 0);
  const stop = (event: React.SyntheticEvent) => { event.preventDefault(); event.stopPropagation(); };
  const run = (action: HierarchyAction, anchor: HTMLElement) => {
    if (action.disabled) return;
    setOverflowAnchor(null);
    action.onSelect(anchor);
  };
  return <Box sx={{ display: "grid", gridTemplateColumns: `repeat(${columns}, ${HIERARCHY_ACTION_SLOT_SIZE}px)`, flex: `0 0 ${columns * HIERARCHY_ACTION_SLOT_SIZE}px`, alignItems: "center" }}>
    {Array.from({ length: emptySlots }, (_, index) => <Box key={`empty-${index}`} aria-hidden="true" />)}
    {overflow.length > 0 && <>
      <Tooltip title="More actions"><IconButton size="small" aria-label="More actions" onPointerDown={stop} onClick={(event) => { stop(event); setOverflowAnchor(event.currentTarget); }}><MoreVertIcon fontSize="small" /></IconButton></Tooltip>
      <Menu anchorEl={overflowAnchor} open={Boolean(overflowAnchor)} onClose={() => setOverflowAnchor(null)} onClick={(event) => event.stopPropagation()} MenuListProps={{ dense: true, "aria-label": "More actions" }} slotProps={{ paper: { sx: { width: "max-content", maxWidth: "calc(100vw - 16px)" } } }}>
        {overflow.map((action) => <MenuItem key={action.id} disabled={action.disabled} onClick={(event) => { stop(event); run(action, overflowAnchor ?? event.currentTarget); }}>
          <ListItemIcon sx={{ color: action.color === "warning" ? "warning.main" : action.color === "error" ? "error.main" : "text.secondary", minWidth: 32 }}>{action.icon}</ListItemIcon>
          <ListItemText primary={action.label} primaryTypographyProps={{ sx: { whiteSpace: "normal" } }} />
        </MenuItem>)}
      </Menu>
    </>}
    {visible.map((action) => <Tooltip key={action.id} title={action.label}><Box component="span" sx={{ display: "inline-flex" }}><IconButton size="small" aria-label={action.label} color={action.color} disabled={action.disabled} sx={action.disabledSx} onPointerDown={stop} onClick={(event) => { stop(event); run(action, event.currentTarget); }}>{action.icon}</IconButton></Box></Tooltip>)}
  </Box>;
}
