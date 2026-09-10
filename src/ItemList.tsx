import AddIcon from "@mui/icons-material/AddRounded";
import SendIcon from "@mui/icons-material/SendRounded";
import DeleteIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditIcon from "@mui/icons-material/EditRounded";
import HiddenIcon from "@mui/icons-material/VisibilityOffRounded";
import VisibleIcon from "@mui/icons-material/VisibilityRounded";
import LockedIcon from "@mui/icons-material/LockRounded";
import UnlockIcon from "@mui/icons-material/LockOpenRounded";
import ClickableIcon from "@mui/icons-material/TouchAppRounded";
import ClickThroughIcon from "@mui/icons-material/DoNotTouchRounded";
import LinkIcon from "@mui/icons-material/LinkRounded";
import FogCutOnIcon from "./icons/other/FogCutOn";
import FogCutOffIcon from "./icons/other/FogCutOff";
import VirtualLayerIcon from "./icons/other/VirtualLayer";
import Collapse from "@mui/material/Collapse";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Tooltip from "@mui/material/Tooltip";
import type { Item } from "@owlbear-rodeo/sdk";
import { Fragment, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ItemListItem } from "./ItemListItem";
import { LayerIcon } from "./LayerIcon";
import { SortableItem } from "./SortableItem";
import { capitalize } from "./helpers";
import type { StackOperation } from "./stacking";
import { useOwlbearStore } from "./useOwlbearStore";
import { isLinkedVirtualLayer, resolveGroupId, UNASSIGNED_ID, type VirtualLayerDefinition } from "./virtualLayers";
import { parseVirtualLayerPath } from "./virtualLayerName";
import type { DropPosition } from "./dragPosition";
import { SendMenuButton } from "./SendMenuButton";
import { getLayerPropertyState } from "./layerPropertyState";
import { captureAggregateState, getGroupInheritance, getItemRule, getNativeRule, hasInstructions, inheritanceVisualState, itemState, type StatefulProperty } from "./stateInheritance";
import { setScopeProperty, type RuleScope } from "./virtualLayerService";
import { OverflowTooltipText } from "./OverflowTooltipText";
import { InheritanceStateIcon } from "./InheritanceStateIcon";
import { OffStageIcon, OnStageIcon } from "./icons/other/TransparencyIcons";
import { InheritanceMenu } from "./InheritanceMenu";
import { getInheritanceBoundary, inheritanceBoundaryDescription } from "./inheritanceBoundary";
import { useLayerDisplaySettings } from "./layerSettings";
import { participationDescription, resolveParticipationModel } from "./participation";
import { HierarchyActionRow, type HierarchyAction } from "./HierarchyActions";

const NATIVE_LAYER_HEADER_HEIGHT = 40;

function VirtualLayerName({ segments }: { segments: NonNullable<ReturnType<typeof parseVirtualLayerPath>>["segments"] }) {
  return <>{segments.map((segment, index) => <Fragment key={`${index}-${segment.kind}`}>
    {index > 0 && "/"}
    {segment.kind === "state" ? <>{segment.group}:{" "}<Box component="span" sx={{ color: "info.main" }}>{segment.state}</Box></> : segment.name}
  </Fragment>)}</>;
}

function VirtualLayerHeading({ name, itemCount, suppressed }: { name: string; itemCount: number; suppressed: boolean }) {
  const path = parseVirtualLayerPath(name);
  const slashCount = Math.max(0, (path?.segments.length ?? 1) - 1);
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
  }, [availableWidth, breakCount, itemCount, name, slashCount, suppressed]);

  useLayoutEffect(() => {
    setBreakCount(slashCount ? 1 : 0);
  }, [name, slashCount]);

  if (!path || !slashCount) return <>{name} [{itemCount}]{suppressed && <Box component="span" sx={{ color: "warning.main" }}> — suppressed</Box>}</>;
  const firstLineEnd = path.segments.length - breakCount;
  const lines = [path.segments.slice(0, firstLineEnd), ...path.segments.slice(firstLineEnd).map((segment) => [segment])];
  const tooltipText = `${name} [${itemCount}]${suppressed ? " — suppressed" : ""}`;
  lineRefs.current = [];
  return <Tooltip title={truncated ? tooltipText : ""} disableInteractive>
    <Box ref={containerRef} component="span" sx={{ display: "block", minWidth: 0, overflow: "hidden", lineHeight: 1.05 }}>
      {lines.map((segments, index) => <Box
        key={index}
        ref={(element: HTMLSpanElement | null) => { lineRefs.current[index] = element; }}
        component="span"
        sx={{ display: "block", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
      >
        {index > 1 && "　".repeat(index - 1)}{index > 0 && "↳"}<VirtualLayerName segments={segments} />{index < lines.length - 1 && "/"}
        {index === lines.length - 1 && <> [{itemCount}]{suppressed && <Box component="span" sx={{ color: "warning.main" }}> — suppressed</Box>}</>}
      </Box>)}
    </Box>
  </Tooltip>;
}

interface Props {
  layer: Item["layer"];
  items: Item[];
  nativeItems: Item[];
  definitions: VirtualLayerDefinition[];
  groupOrder: string[];
  groupDropPosition?: DropPosition;
  role: "GM" | "PLAYER";
  searching: boolean;
  onCreate: () => void;
  onRename: (definition: VirtualLayerDefinition) => void;
  onDelete: (definition: VirtualLayerDefinition) => void;
  onItemRename: (item: Item) => void;
  onItemDelete: (item: Item) => void;
  resolveGroup: (item: Item) => string;
  onItemSelect: (item: Item, event: React.MouseEvent<HTMLDivElement>) => void;
  onItemFocus: (item: Item) => void;
  onItemLocate: (item: Item) => void;
  onItemStack: (ids: string[], operation: StackOperation) => void;
  onGroupStack: (layer: Item["layer"], id: string, operation: StackOperation) => void;
}

export function ItemList(props: Props) {
  const [open, setOpen] = useState(false);
  const { layer, definitions, items, nativeItems, groupOrder } = props;
  const selected = useOwlbearStore((state) => items.some((item) => state.selection?.includes(item.id)));
  const layerName = `${capitalize(layer)}${layer !== "FOG" && layer !== "TEXT" ? "s" : ""}`;
  const layerHeading = `${layerName} [${items.length}]`;
  const renderItems = (groupItems: Item[]) => groupItems.map((item) => (
    <SortableItem key={item.id} itemId={item.id} disabled={props.searching} data={{ kind: "item", nativeLayer: item.layer, groupId: props.resolveGroup(item) }}>
      <ItemListItem item={item} onClick={(event) => props.onItemSelect(item, event)}
        onDoubleClick={() => props.onItemFocus(item)} onLocate={() => props.onItemLocate(item)}
        onRename={() => props.onItemRename(item)} onDelete={() => props.onItemDelete(item)}
        onStack={props.onItemStack} />
    </SortableItem>
  ));
  return <Box component="section" sx={{ position: "relative" }}>
    <ListItemButton dense onClick={() => setOpen(!open)} divider aria-expanded={open} sx={{ position: "sticky", top: 0, zIndex: 3, minHeight: `${NATIVE_LAYER_HEADER_HEIGHT}px`, bgcolor: "background.paper", color: selected ? "primary.main" : undefined, borderLeft: "3px solid", borderLeftColor: selected ? "primary.main" : "transparent" }}>
      <ListItemIcon sx={{ color: selected ? "primary.main" : "text.secondary", minWidth: "28px", "& svg": { fontSize: "1.25rem" } }}><LayerIcon layer={layer} /></ListItemIcon>
      <ListItemText primary={<Box sx={{ display: "flex", alignItems: "center", minWidth: 0 }}><Box sx={{ minWidth: 0, flex: 1 }}><OverflowTooltipText text={layerHeading} /></Box>{props.role === "GM" && !props.searching && <Tooltip title="Create virtual layer" placement="left"><IconButton size="small" aria-label={`Create virtual layer in ${layerName}`} onClick={(event) => { event.stopPropagation(); props.onCreate(); }}><AddIcon fontSize="small" /></IconButton></Tooltip>}</Box>} sx={{ minWidth: 0, flex: "1 1 228px" }} />
      {props.role === "GM" ? <LayerPropertyControls items={nativeItems} scope={{ kind: "native", layer }} fog={layer === "FOG"} /> : <HierarchyActionRow actions={[]} />}
    </ListItemButton>
    <Collapse in={open} unmountOnExit><List component="div" dense disablePadding>
      {definitions.length === 0 ? <><SortableItem itemId={`START:${layer}:${UNASSIGNED_ID}`} disabled={props.searching} data={{ kind: "start", nativeLayer: layer, groupId: UNASSIGNED_ID }} />{renderItems(items)}</> : <>
        {groupOrder.map((groupId) => {
          const definition = groupId === UNASSIGNED_ID
            ? { id: UNASSIGNED_ID, name: "Unassigned", obrLayer: layer, order: groupOrder.indexOf(groupId) }
            : definitions.find((entry) => entry.id === groupId);
          return definition ? <Group key={groupId} {...props} definition={definition} items={items.filter((item) => props.resolveGroup(item) === groupId)} renderItems={renderItems} /> : null;
        })}
      </>}
    </List></Collapse>
  </Box>;
}

function Group({ definition, items, role, searching, groupDropPosition, onRename, onDelete, onGroupStack, renderItems }: Props & { definition: VirtualLayerDefinition; renderItems: (items: Item[]) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [sendAnchor, setSendAnchor] = useState<HTMLElement | null>(null);
  const selected = useOwlbearStore((state) => items.some((item) => state.selection?.includes(item.id)));
  const virtualLayers = useOwlbearStore((state) => state.virtualLayers);
  const model = useMemo(() => resolveParticipationModel(virtualLayers), [virtualLayers]);
  const linked = isLinkedVirtualLayer(virtualLayers, definition.id);
  const participation = model.byDefinitionId.get(definition.id);
  const unassigned = definition.id === UNASSIGNED_ID;
  const groupHeading = `${definition.name} [${items.length}]`;
  const leadingActions: HierarchyAction[] = [
    ...(!unassigned ? [{ id: "rename", label: "Rename", icon: <EditIcon fontSize="small" />, onSelect: () => onRename(definition) }, { id: "delete", label: "Delete", icon: <DeleteIcon fontSize="small" />, onSelect: () => onDelete(definition) }] : []),
    { id: "send", label: "Send", icon: <SendIcon fontSize="small" />, onSelect: (anchor) => setSendAnchor(anchor) },
  ];
  const row = <ListItemButton dense onClick={() => setOpen(!open)} aria-expanded={open} sx={{ minHeight: `${NATIVE_LAYER_HEADER_HEIGHT}px`, bgcolor: "background.default", color: selected ? "primary.main" : undefined, borderLeft: "3px solid", borderLeftColor: selected ? "primary.main" : "transparent" }}>
    <ListItemIcon sx={{ color: participation && !participation.participating ? "warning.main" : selected ? "primary.main" : "text.secondary", minWidth: "28px", "& svg": { fontSize: 16 } }}><Tooltip title={participation ? participationDescription(participation) : linked ? "Linked virtual layer" : "Virtual layer"}>{linked ? <LinkIcon aria-label="Linked virtual layer" /> : <VirtualLayerIcon aria-label="Virtual layer" />}</Tooltip></ListItemIcon>
    <ListItemText primary={unassigned
      ? <OverflowTooltipText text={groupHeading} />
      : <VirtualLayerHeading name={definition.name} itemCount={items.length} suppressed={participation?.participating === false} />
    } sx={{ minWidth: 0, flex: "1 1 228px", my: 0.5 }} primaryTypographyProps={{ component: "div", fontStyle: "italic" }} />
    {role === "GM" ? <><LayerPropertyControls leadingActions={leadingActions} items={items} scope={{ kind: "group", layer: definition.obrLayer, groupId: definition.id }} fog={definition.obrLayer === "FOG"} /><SendMenuButton hideButton externalAnchor={sendAnchor} itemIds={items.map((item) => item.id)} allowStackWhenEmpty onStack={(operation) => onGroupStack(definition.obrLayer, definition.id, operation)} confirmLayerMove={definition.name} onOpenChange={(open) => { if (!open) setSendAnchor(null); }} /></> : <HierarchyActionRow actions={[]} />}
  </ListItemButton>;
  return <>
    <SortableItem itemId={unassigned ? `UG:${definition.obrLayer}` : `VL:${definition.id}`} disabled={searching} data={{ kind: "group", nativeLayer: definition.obrLayer, groupId: definition.id }} stickyTop={NATIVE_LAYER_HEADER_HEIGHT} indicatorPosition={groupDropPosition}>{row}</SortableItem>
    <Collapse in={open}><List component="div" dense><SortableItem itemId={`START:${definition.obrLayer}:${definition.id}`} disabled={searching} data={{ kind: "start", nativeLayer: definition.obrLayer, groupId: definition.id }} />{renderItems(items)}</List></Collapse>
  </>;
}

function LayerPropertyControls({ items, scope, fog = false, leadingActions = [] }: { items: Item[]; scope: RuleScope; fog?: boolean; leadingActions?: HierarchyAction[] }) {
  const state = useOwlbearStore((store) => store.virtualLayers);
  const features = useLayerDisplaySettings().features;
  const [inheritanceAnchor, setInheritanceAnchor] = useState<HTMLElement | null>(null);
  const parentRule = scope.kind === "group" ? getNativeRule(state, scope.layer) : {};
  const config = scope.kind === "group" ? getGroupInheritance(state, scope.layer, scope.groupId) : undefined;
  const boundary = scope.kind === "group" ? getInheritanceBoundary(state, scope.groupId) : undefined;
  const localRule = scope.kind === "native" ? getNativeRule(state, scope.layer) : config?.mode === "independent" ? config.enforce : {};
  const effectiveRule = scope.kind === "group" && config?.mode === "pass-through" ? parentRule : localRule;
  const eligible = items.filter((item) => {
    if (getItemRule(item)) return false;
    return scope.kind === "group" || (!getInheritanceBoundary(state, resolveGroupId(item, state)) && getGroupInheritance(state, item.layer, resolveGroupId(item, state)).mode === "pass-through");
  });
  const localStates = eligible.map(itemState);
  const aggregate = getLayerPropertyState(localStates);
  const { mixedDisableHit, mixedLocked, mixedVisible } = aggregate;
  const allTransparent = localStates.length > 0 && localStates.every((item) => item.transparent);
  const mixedTransparent = localStates.some((item) => item.transparent) && !allTransparent;
  const aggregateState = captureAggregateState(eligible);
  const displayed = { ...aggregateState, ...effectiveRule };
  const visibilityAction = fog
    ? displayed.visible ? "Cut all" : "Uncut all"
    : displayed.visible ? "Hide all" : "Show all";
  const independent = config?.mode === "independent";
  const inheritanceState = boundary ? "blocked-virtual-layer" : inheritanceVisualState(scope.kind === "native" ? "native" : "virtual", hasInstructions(effectiveRule), independent);
  const inheritanceColor = inheritanceState === "enabled" ? "warning" : inheritanceState === "disabled" ? "default" : "error";
  const isReceived = (property: StatefulProperty) => scope.kind === "group" && config?.mode === "pass-through" && Object.prototype.hasOwnProperty.call(parentRule, property);
  const isEnforced = (property: StatefulProperty) => Object.prototype.hasOwnProperty.call(effectiveRule, property);
  const stateColor = (property: StatefulProperty, mixed: boolean) => isEnforced(property) ? "warning" : mixed ? "info" : "default";
  const transparencyColor = stateColor("transparent", mixedTransparent);
  const disabled = (property: StatefulProperty) => isReceived(property) || (!isEnforced(property) && eligible.length === 0);
  const disabledSx = (property: StatefulProperty) => isReceived(property) ? { "&.Mui-disabled": { color: "warning.main" } } : undefined;
  const setProperty = (property: StatefulProperty, value: boolean) => setScopeProperty(scope, property, value);
  const actions: HierarchyAction[] = [
    ...leadingActions,
    ...(features.manageInheritance ? [{ id: "inheritance", label: boundary ? inheritanceBoundaryDescription(boundary) : "Configure inheritance", icon: <InheritanceStateIcon state={inheritanceState} fontSize="small" />, color: inheritanceColor, onSelect: (anchor: HTMLElement) => setInheritanceAnchor(anchor) } as HierarchyAction] : []),
    ...(features.transparency ? [{ id: "stage", label: displayed.transparent ? "Bring on-stage" : "Send off-stage", icon: displayed.transparent ? <OffStageIcon fontSize="small" /> : <OnStageIcon fontSize="small" />, color: transparencyColor, disabled: disabled("transparent"), disabledSx: disabledSx("transparent"), onSelect: () => { void setProperty("transparent", !displayed.transparent); } } as HierarchyAction] : []),
    ...(features.interaction ? [{ id: "clicks", label: displayed.disableHit ? "Enable clicks for all" : "Disable clicks for all", icon: displayed.disableHit ? <ClickThroughIcon fontSize="small" /> : <ClickableIcon fontSize="small" />, color: stateColor("disableHit", mixedDisableHit), disabled: disabled("disableHit"), disabledSx: disabledSx("disableHit"), onSelect: () => { void setProperty("disableHit", !displayed.disableHit); } } as HierarchyAction] : []),
    ...(features.locked ? [{ id: "lock", label: displayed.locked ? "Unlock all" : "Lock all", icon: displayed.locked ? <LockedIcon fontSize="small" /> : <UnlockIcon fontSize="small" />, color: stateColor("locked", mixedLocked), disabled: disabled("locked"), disabledSx: disabledSx("locked"), onSelect: () => { void setProperty("locked", !displayed.locked); } } as HierarchyAction] : []),
    ...(features.visible ? [{ id: "visibility", label: visibilityAction, icon: fog ? displayed.visible ? <FogCutOffIcon fontSize="small" /> : <FogCutOnIcon fontSize="small" /> : displayed.visible ? <VisibleIcon fontSize="small" /> : <HiddenIcon fontSize="small" />, color: stateColor("visible", mixedVisible), disabled: disabled("visible"), disabledSx: disabledSx("visible"), onSelect: () => { void setProperty("visible", !displayed.visible); } } as HierarchyAction] : []),
  ];
  return <><HierarchyActionRow actions={actions} />{features.manageInheritance && <InheritanceMenu anchorEl={inheritanceAnchor} scope={scope} config={config} enforce={localRule} displayed={displayed} features={features} boundary={boundary} onClose={() => setInheritanceAnchor(null)} />}</>;
}
