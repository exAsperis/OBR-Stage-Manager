import { closestCenter, DndContext, KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { rectSortingStrategy, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import SvgIcon from "@mui/material/SvgIcon";
import HideAllStatesIcon from "@mui/icons-material/BlockRounded";
import PreviousIcon from "@mui/icons-material/ChevronLeftRounded";
import NextIcon from "@mui/icons-material/ChevronRightRounded";
import PreviousVerticalIcon from "@mui/icons-material/KeyboardArrowUpRounded";
import NextVerticalIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import RestoreIcon from "@mui/icons-material/OpenInFullRounded";
import MinimizeIcon from "@mui/icons-material/CloseFullscreenRounded";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useOwlbearStore } from "./useOwlbearStore";
import { moveStatefulVirtualLayerState, setStatefulVirtualLayerSelection } from "./virtualLayerService";
import { resolveParticipationModel, type ResolvedStateGroup } from "./participation";
import type { MinimizedOrientation } from "./outlinerLayout";

type StatefulLayer = ResolvedStateGroup["states"][number];

function StateButton({ group, state, active, suppressed, disabled, vertical, onActivate }: { group: string; state: StatefulLayer; active: boolean; suppressed: boolean; disabled: boolean; vertical: boolean; onActivate: () => void }) {
  const id = `${group.toLocaleLowerCase()}\u0000${state.name.toLocaleLowerCase()}`;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, data: { group, state: state.name } });
  return <Box ref={setNodeRef} sx={{ minWidth: 40, width: vertical ? "100%" : undefined, height: 40, display: "flex", alignItems: "center", justifyContent: "center", transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 1 : undefined }}>
    <Button {...attributes} {...listeners} size="small" color={active ? "primary" : "inherit"} variant={active && !suppressed ? "contained" : "outlined"} disabled={disabled} aria-pressed={active} title={active && suppressed ? "Selected locally; guardian is not participating" : undefined} onClick={onActivate} sx={{ minWidth: 0, maxWidth: "100%", height: 24, minHeight: 24, py: 0, px: 1, whiteSpace: "normal", textTransform: "none", cursor: isDragging ? "grabbing" : "grab" }}>
      {state.name}
    </Button>
  </Box>;
}

const iconButtonSx = { width: 40, height: 40, p: 0, "& .MuiSvgIcon-root": { width: 24, height: 24 } } as const;

function StateGroupLabel({ label, suppressed }: { label: string; suppressed: boolean }) {
  const segments = label.split("/");
  const slashCount = segments.length - 1;
  const [breakCount, setBreakCount] = useState(slashCount ? 1 : 0);
  const [availableWidth, setAvailableWidth] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const lineRefs = useRef<Array<HTMLSpanElement | null>>([]);

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const measure = () => {
      setAvailableWidth(element.clientWidth);
      setBreakCount(slashCount ? 1 : 0);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [slashCount]);

  useLayoutEffect(() => {
    if (!availableWidth) return;
    const overflow = lineRefs.current.some((line) => line && line.scrollWidth > line.clientWidth);
    if (overflow && breakCount < slashCount) {
      setBreakCount((count) => count + 1);
      return;
    }
    setTruncated(overflow);
  }, [availableWidth, breakCount, label, slashCount]);

  useLayoutEffect(() => {
    setBreakCount(slashCount ? 1 : 0);
  }, [label, slashCount]);

  const firstLineEnd = segments.length - breakCount;
  const lines = slashCount
    ? [segments.slice(0, firstLineEnd).join("/"), ...segments.slice(firstLineEnd)]
    : segments;
  lineRefs.current = [];
  return <Tooltip title={truncated ? label : ""} disableInteractive>
    <Typography
      ref={containerRef}
      component="span"
      variant="caption"
      color={suppressed ? "warning.main" : undefined}
      fontWeight={700}
      sx={{ display: "block", minWidth: 0, overflow: "hidden", lineHeight: 1.05 }}
    >
      {lines.map((line, index) => <Box
        key={index}
        ref={(element: HTMLSpanElement | null) => { lineRefs.current[index] = element; }}
        component="span"
        sx={{ display: "block", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
      >
        {index > 1 && "　".repeat(index - 1)}{index > 0 && "↳"}{line}{index < lines.length - 1 && "/"}
      </Box>)}
    </Typography>
  </Tooltip>;
}

function StateGroupRow({ group, label, guardianParticipating, switching, activate, hideAll, orientation }: { group: ResolvedStateGroup; label: string; guardianParticipating: boolean; switching: boolean; activate: (state: StatefulLayer) => void; hideAll: () => void; orientation: MinimizedOrientation }) {
  const virtualLayers = useOwlbearStore((state) => state.virtualLayers);
  const dragging = useRef(false);
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 5 } }), useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }), useSensor(KeyboardSensor));
  const ids = group.states.map((state) => `${group.id}\u0000${state.name.toLocaleLowerCase()}`);
  const selection = virtualLayers.stateSelections?.[group.id];
  const activeStates = group.states.map((state) => selection === state.name.toLocaleLowerCase());
  const allStatesSuppressed = selection === null;
  const activeIndex = activeStates.findIndex(Boolean);
  const step = (direction: -1 | 1) => {
    const fallback = direction < 0 ? group.states.length - 1 : 0;
    const index = activeIndex < 0 ? fallback : (activeIndex + direction + group.states.length) % group.states.length;
    activate(group.states[index]);
  };
  const dragEnd = (event: DragEndEvent) => {
    const active = event.active.data.current as { group?: string; state?: string } | undefined;
    const over = event.over?.data.current as { state?: string } | undefined;
    if (active?.group && active.state && over?.state && active.state !== over.state) void moveStatefulVirtualLayerState(active.group, active.state, over.state);
    window.setTimeout(() => { dragging.current = false; }, 0);
  };

  const vertical = orientation === "vertical";
  return <Box sx={{ display: "contents" }}>
    <Box sx={{ width: "100%", minWidth: 0, overflow: "hidden", textAlign: vertical ? "center" : undefined, alignSelf: "center" }}>
      <StateGroupLabel label={label} suppressed={!guardianParticipating} />
    </Box>
    <Tooltip title={`Suppress all ${label} states`}><span><IconButton sx={iconButtonSx} color={allStatesSuppressed ? "primary" : "default"} disabled={switching} aria-label={`Suppress all ${label} states`} aria-pressed={allStatesSuppressed} onClick={hideAll}><HideAllStatesIcon /></IconButton></span></Tooltip>
    <Tooltip title={`Previous ${label} state`}><span><IconButton sx={iconButtonSx} disabled={switching || group.states.length < 2} aria-label={`Previous ${label} state`} onClick={() => step(-1)}>{vertical ? <PreviousVerticalIcon /> : <PreviousIcon />}</IconButton></span></Tooltip>
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={() => { dragging.current = true; }} onDragCancel={() => { dragging.current = false; }} onDragEnd={dragEnd}>
      <SortableContext items={ids} strategy={vertical ? verticalListSortingStrategy : rectSortingStrategy}>
        <Stack direction={vertical ? "column" : "row"} alignItems="center" justifyContent={vertical ? undefined : "space-evenly"} sx={{ minWidth: 0, width: "100%", flexWrap: "nowrap", gap: 0 }}>
          {group.states.map((state, index) => {
            return <StateButton key={state.name.toLocaleLowerCase()} group={group.id} state={state} active={activeStates[index]} suppressed={!guardianParticipating} disabled={switching} vertical={vertical} onActivate={() => { if (!dragging.current) activate(state); }} />;
          })}
        </Stack>
      </SortableContext>
    </DndContext>
    <Tooltip title={`Next ${label} state`}><span><IconButton sx={iconButtonSx} disabled={switching || group.states.length < 2} aria-label={`Next ${label} state`} onClick={() => step(1)}>{vertical ? <NextVerticalIcon /> : <NextIcon />}</IconButton></span></Tooltip>
  </Box>;
}

function LayoutOrientationIcon() {
  return <SvgIcon fontSize="small" viewBox="0 0 24 24">
    <path d="M5 4v15m0 0-3-3m3 3 3-3M5 5h14m0 0-3-3m3 3-3 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </SvgIcon>;
}

export function StateSwitcher({ minimized = false, minimizedOrientation = "horizontal", onModeToggle, onOrientationToggle }: { minimized?: boolean; minimizedOrientation?: MinimizedOrientation; onModeToggle: () => void; onOrientationToggle: () => void }) {
  const virtualLayers = useOwlbearStore((state) => state.virtualLayers);
  const [switching, setSwitching] = useState(false);
  const model = useMemo(() => resolveParticipationModel(virtualLayers), [virtualLayers]);
  const groups = model.stateGroups;
  if (!groups.length) return null;

  const activate = async (groupId: string, state: StatefulLayer) => {
    setSwitching(true);
    try {
      await setStatefulVirtualLayerSelection(groupId, state.name);
    } finally {
      setSwitching(false);
    }
  };

  const hideAll = async (group: ResolvedStateGroup) => {
    setSwitching(true);
    try {
      await setStatefulVirtualLayerSelection(group.id, null);
    } finally {
      setSwitching(false);
    }
  };

  const vertical = minimized && minimizedOrientation === "vertical";
  return <Stack component="section" aria-label="Scene states" spacing={0.75} sx={{ px: 1, py: 0.75, flexShrink: 0, borderBottom: 1, borderColor: "divider", bgcolor: minimized ? "transparent" : "background.paper", boxSizing: "border-box", width: vertical ? "max-content" : undefined, height: vertical ? "100vh" : undefined, maxHeight: minimized ? (vertical ? "100vh" : "none") : "35vh", overflowY: minimized ? (vertical ? "auto" : "visible") : "auto", overflowX: vertical ? "visible" : undefined }}>
    <Stack direction={vertical ? "column" : "row"} justifyContent="flex-end" alignItems="center" flexWrap="wrap" sx={{ width: vertical ? 40 : "100%", alignSelf: "flex-end" }}>
      {minimized && <Tooltip title={`Use ${minimizedOrientation === "horizontal" ? "vertical" : "horizontal"} minified layout`}><IconButton sx={iconButtonSx} aria-label={`Use ${minimizedOrientation === "horizontal" ? "vertical" : "horizontal"} minified layout`} onClick={onOrientationToggle}><LayoutOrientationIcon /></IconButton></Tooltip>}
      <Tooltip title={minimized ? "Restore Stage Manager" : "Minimize to scene states"}><IconButton sx={iconButtonSx} aria-label={minimized ? "Restore Stage Manager" : "Minimize to scene states"} onClick={onModeToggle}>{minimized ? <RestoreIcon /> : <MinimizeIcon />}</IconButton></Tooltip>
    </Stack>
    <Box sx={vertical ? {
      display: "grid",
      gridAutoFlow: "column",
      gridTemplateRows: "40px 40px 40px max-content 40px",
      gridAutoColumns: "120px",
      columnGap: 0.75,
      alignItems: "center",
      justifyItems: "center",
    } : {
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr) 40px 40px minmax(max-content, 1fr) 40px",
      rowGap: 0.75,
      alignItems: "center",
      justifyItems: "center",
      width: "100%",
      minWidth: 0,
    }}>
      {groups.map((group) => {
        const guardian = group.guardianId ? model.logicalLayers.find((layer) => layer.id === group.guardianId) : undefined;
        const guardianParticipation = group.guardianId ? model.byLogicalId.get(group.guardianId) : undefined;
        const label = guardian ? `${guardian.name}/${group.name}` : group.name;
        return <StateGroupRow key={group.id} group={group} label={label} guardianParticipating={!group.guardianId || guardianParticipation?.participating === true} switching={switching} activate={(state) => void activate(group.id, state)} hideAll={() => void hideAll(group)} orientation={vertical ? "vertical" : "horizontal"} />;
      })}
    </Box>
  </Stack>;
}
