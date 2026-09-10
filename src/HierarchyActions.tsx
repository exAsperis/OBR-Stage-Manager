import MoreVertIcon from "@mui/icons-material/MoreVertRounded";
import Box from "@mui/material/Box";
import IconButton, { type IconButtonProps } from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import ListSubheader from "@mui/material/ListSubheader";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
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

export interface HierarchyActionContext { label: string; icon: ReactNode }

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

export function HierarchyActionRow({ actions, context, onOverflowOpenChange }: { actions: readonly HierarchyAction[]; context?: HierarchyActionContext; onOverflowOpenChange?: (open: boolean) => void }) {
  const { columns, slotSize } = useHierarchyActionLayout();
  const [overflowAnchor, setOverflowAnchor] = useState<HTMLElement | null>(null);
  const openChangeRef = useRef(onOverflowOpenChange);
  useLayoutEffect(() => { openChangeRef.current = onOverflowOpenChange; }, [onOverflowOpenChange]);
  useEffect(() => () => openChangeRef.current?.(false), []);
  const notifyOpenChange = (open: boolean) => openChangeRef.current?.(open);
  const { overflow, visible } = splitHierarchyActions(actions, columns);
  const emptySlots = columns - visible.length - (overflow.length ? 1 : 0);
  const stop = (event: React.SyntheticEvent) => { event.preventDefault(); event.stopPropagation(); };
  const run = (action: HierarchyAction, anchor: HTMLElement) => {
    if (action.disabled) return;
    setOverflowAnchor(null);
    notifyOpenChange(false);
    action.onSelect(anchor);
  };
  const closeOverflow = () => { setOverflowAnchor(null); notifyOpenChange(false); };
  const buttonSx = { width: slotSize, height: slotSize, p: 0 };
  return <Box sx={{ display: "grid", gridTemplateColumns: `repeat(${columns}, ${slotSize}px)`, flex: `0 0 ${columns * slotSize}px`, alignItems: "center" }}>
    {Array.from({ length: emptySlots }, (_, index) => <Box key={`empty-${index}`} aria-hidden="true" />)}
    {overflow.length > 0 && <>
      <Tooltip title="More actions"><IconButton size="small" sx={buttonSx} aria-label={context ? `More actions for ${context.label}` : "More actions"} onPointerDown={stop} onClick={(event) => { stop(event); setOverflowAnchor(event.currentTarget); notifyOpenChange(true); }}><MoreVertIcon fontSize="small" /></IconButton></Tooltip>
      <Menu anchorEl={overflowAnchor} open={Boolean(overflowAnchor)} onClose={closeOverflow} onClick={(event) => event.stopPropagation()} MenuListProps={{ dense: true, "aria-label": context ? `More actions for ${context.label}` : "More actions" }} slotProps={{ paper: { sx: { width: "max-content", maxWidth: "calc(100vw - 16px)" } } }}>
        {context && <ListSubheader component="div" disableSticky sx={{ display: "flex", alignItems: "center", gap: 1, lineHeight: 1.2, py: 1, borderBottom: 1, borderColor: "divider", color: "text.primary", maxWidth: 280 }}>
          <Box sx={{ display: "inline-flex", color: "text.secondary", flexShrink: 0, "& svg": { fontSize: "1.25rem" } }}>{context.icon}</Box>
          <Box sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 700 }}>{context.label}</Box>
        </ListSubheader>}
        {overflow.map((action) => <MenuItem key={action.id} disabled={action.disabled} onClick={(event) => { stop(event); run(action, overflowAnchor ?? event.currentTarget); }}>
          <ListItemIcon sx={{ color: action.color === "warning" ? "warning.main" : action.color === "error" ? "error.main" : "text.secondary", minWidth: 32 }}>{action.icon}</ListItemIcon>
          <ListItemText primary={action.label} primaryTypographyProps={{ sx: { whiteSpace: "normal" } }} />
        </MenuItem>)}
      </Menu>
    </>}
    {visible.map((action) => <Tooltip key={action.id} title={action.label}><Box component="span" sx={{ display: "inline-flex" }}><IconButton size="small" aria-label={action.label} color={action.color} disabled={action.disabled} sx={{ ...buttonSx, ...(action.disabledSx as object) }} onPointerDown={stop} onClick={(event) => { stop(event); run(action, event.currentTarget); }}>{action.icon}</IconButton></Box></Tooltip>)}
  </Box>;
}
