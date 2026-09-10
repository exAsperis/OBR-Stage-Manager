import MoreVertIcon from "@mui/icons-material/MoreVertRounded";
import Box from "@mui/material/Box";
import IconButton, { type IconButtonProps } from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { hierarchyActionColumns, splitHierarchyActions } from "./hierarchyActionLayout";
import { HierarchyActionColumnsContext, useHierarchyActionLayout } from "./hierarchyActionContext";

export interface HierarchyAction {
  id: string;
  label: string;
  icon: ReactNode;
  disabled?: boolean;
  color?: IconButtonProps["color"];
  disabledSx?: IconButtonProps["sx"];
  onSelect: (anchor: HTMLElement) => void;
}

export function HierarchyActionLayout({ children, labelWidth, slotSize }: { children: ReactNode; labelWidth: number; slotSize: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(1);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setColumns(hierarchyActionColumns(element.clientWidth, labelWidth, slotSize));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [labelWidth, slotSize]);
  return <HierarchyActionColumnsContext.Provider value={{ columns, slotSize, labelWidth }}><Box ref={ref} sx={{ width: "100%" }}>{children}</Box></HierarchyActionColumnsContext.Provider>;
}

export function HierarchyActionRow({ actions }: { actions: readonly HierarchyAction[] }) {
  const { columns, slotSize } = useHierarchyActionLayout();
  const [overflowAnchor, setOverflowAnchor] = useState<HTMLElement | null>(null);
  const { overflow, visible } = splitHierarchyActions(actions, columns);
  const emptySlots = columns - visible.length - (overflow.length ? 1 : 0);
  const stop = (event: React.SyntheticEvent) => { event.preventDefault(); event.stopPropagation(); };
  const run = (action: HierarchyAction, anchor: HTMLElement) => {
    if (action.disabled) return;
    setOverflowAnchor(null);
    action.onSelect(anchor);
  };
  const buttonSx = { width: slotSize, height: slotSize, p: 0 };
  return <Box sx={{ display: "grid", gridTemplateColumns: `repeat(${columns}, ${slotSize}px)`, flex: `0 0 ${columns * slotSize}px`, alignItems: "center" }}>
    {Array.from({ length: emptySlots }, (_, index) => <Box key={`empty-${index}`} aria-hidden="true" />)}
    {overflow.length > 0 && <>
      <Tooltip title="More actions"><IconButton size="small" sx={buttonSx} aria-label="More actions" onPointerDown={stop} onClick={(event) => { stop(event); setOverflowAnchor(event.currentTarget); }}><MoreVertIcon fontSize="small" /></IconButton></Tooltip>
      <Menu anchorEl={overflowAnchor} open={Boolean(overflowAnchor)} onClose={() => setOverflowAnchor(null)} onClick={(event) => event.stopPropagation()} MenuListProps={{ dense: true, "aria-label": "More actions" }} slotProps={{ paper: { sx: { width: "max-content", maxWidth: "calc(100vw - 16px)" } } }}>
        {overflow.map((action) => <MenuItem key={action.id} disabled={action.disabled} onClick={(event) => { stop(event); run(action, overflowAnchor ?? event.currentTarget); }}>
          <ListItemIcon sx={{ color: action.color === "warning" ? "warning.main" : action.color === "error" ? "error.main" : "text.secondary", minWidth: 32 }}>{action.icon}</ListItemIcon>
          <ListItemText primary={action.label} primaryTypographyProps={{ sx: { whiteSpace: "normal" } }} />
        </MenuItem>)}
      </Menu>
    </>}
    {visible.map((action) => <Tooltip key={action.id} title={action.label}><Box component="span" sx={{ display: "inline-flex" }}><IconButton size="small" aria-label={action.label} color={action.color} disabled={action.disabled} sx={{ ...buttonSx, ...(action.disabledSx as object) }} onPointerDown={stop} onClick={(event) => { stop(event); run(action, event.currentTarget); }}>{action.icon}</IconButton></Box></Tooltip>)}
  </Box>;
}
