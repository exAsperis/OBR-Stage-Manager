import CenterFocusStrongRounded from "@mui/icons-material/CenterFocusStrongRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import DoNotTouchRounded from "@mui/icons-material/DoNotTouchRounded";
import EditRounded from "@mui/icons-material/EditRounded";
import LockOpenRounded from "@mui/icons-material/LockOpenRounded";
import LockRounded from "@mui/icons-material/LockRounded";
import SendRounded from "@mui/icons-material/SendRounded";
import TouchAppRounded from "@mui/icons-material/TouchAppRounded";
import VisibilityOffRounded from "@mui/icons-material/VisibilityOffRounded";
import VisibilityRounded from "@mui/icons-material/VisibilityRounded";
import Box from "@mui/material/Box";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import useTheme from "@mui/material/styles/useTheme";
import OBR, { type Item } from "@owlbear-rodeo/sdk";
import { memo, useState } from "react";
import { useInView } from "react-intersection-observer";
import { HierarchyActionRow, type HierarchyAction } from "./HierarchyActions";
import { useHierarchyActionLayout } from "./hierarchyActionContext";
import { InheritanceStateIcon } from "./InheritanceStateIcon";
import { ItemIcon } from "./ItemIcon";
import { ItemText } from "./ItemText";
import { SendMenuButton } from "./SendMenuButton";
import FogCutOffIcon from "./icons/other/FogCutOff";
import FogCutOnIcon from "./icons/other/FogCutOn";
import { OffStageIcon, OnStageIcon } from "./icons/other/TransparencyIcons";
import { useLayerDisplaySettings } from "./layerSettings";
import type { StackOperation } from "./stacking";
import { getItemParentRule, getItemRule, hasInstructions, inheritanceVisualState, itemInheritanceLabel, itemState, type StatefulProperty } from "./stateInheritance";
import { useItemHsaPermission } from "./useHasPermission";
import { useOwlbearStore } from "./useOwlbearStore";
import { setItemTransparency, setItemVisibility, toggleItemInheritance } from "./virtualLayerService";

export const ItemListItem = memo(function ItemListItem({ item, onClick, onDoubleClick, onLocate, onRename, onDelete, onStack, dragging }: {
  item: Item;
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
  onDoubleClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
  onLocate?: () => void;
  onRename?: () => void;
  onDelete?: () => void;
  onStack?: (itemIds: string[], operation: StackOperation) => void;
  dragging?: boolean;
}) {
  const selected = useOwlbearStore((state) => state.selection?.includes(item.id) ?? false);
  const selection = useOwlbearStore((state) => state.selection);
  const role = useOwlbearStore((state) => state.role);
  const virtualLayers = useOwlbearStore((state) => state.virtualLayers);
  const features = useLayerDisplaySettings().features;
  const [ref, inView] = useInView();
  const [sendAnchor, setSendAnchor] = useState<HTMLElement | null>(null);
  const { columns: actionColumns, slotSize, labelWidth } = useHierarchyActionLayout();
  const theme = useTheme();
  const hasUpdatePermission = useItemHsaPermission(item, "UPDATE");
  const hasDeletePermission = useItemHsaPermission(item, "DELETE");
  const localRule = getItemRule(item);
  const parentRule = getItemParentRule(item, virtualLayers);
  const independent = Boolean(localRule);
  const displayed = { ...itemState(item), ...(independent ? {} : parentRule) };
  const inherited = (property: StatefulProperty) => !independent && Object.prototype.hasOwnProperty.call(parentRule, property);
  const disabledSx = (property: StatefulProperty) => inherited(property) ? { "&.Mui-disabled": { color: "warning.main" } } : undefined;
  const propertyAction = (property: StatefulProperty) => {
    const value = !displayed[property];
    if (property === "transparent") void setItemTransparency(item, value);
    else if (property === "visible") void setItemVisibility(item, value);
    else void OBR.scene.items.updateItems([item], (items) => { items[0][property] = value; });
  };
  const inheritanceState = inheritanceVisualState("item", hasInstructions(parentRule), independent);
  const inheritanceColor = inheritanceState === "enabled" ? "warning" : inheritanceState === "disabled" ? "default" : "error";
  const ids = selected && selection?.length ? selection : [item.id];
  const visibilityLabel = displayed.visible ? item.layer === "FOG" ? "Cut" : "Hide" : item.layer === "FOG" ? "Uncut" : "Show";
  const actions: HierarchyAction[] = [
    { id: "locate", label: "Locate", icon: <CenterFocusStrongRounded fontSize="small" />, onSelect: () => onLocate?.() },
    ...(hasUpdatePermission ? [{ id: "rename", label: "Rename", icon: <EditRounded fontSize="small" />, onSelect: () => onRename?.() }] : []),
    ...(hasDeletePermission ? [{ id: "delete", label: "Delete", icon: <DeleteOutlineRounded fontSize="small" />, onSelect: () => onDelete?.() }] : []),
    ...(hasUpdatePermission ? [{ id: "send", label: "Send", icon: <SendRounded fontSize="small" />, onSelect: (anchor: HTMLElement) => setSendAnchor(anchor) }] : []),
    ...(features.manageInheritance && hasUpdatePermission ? [{ id: "inheritance", label: itemInheritanceLabel(independent), icon: <InheritanceStateIcon state={inheritanceState} fontSize="small" />, color: inheritanceColor, onSelect: () => { void toggleItemInheritance(item); } } as HierarchyAction] : []),
    ...(features.transparency && role === "GM" && hasUpdatePermission ? [{ id: "stage", label: displayed.transparent ? "Bring on-stage" : "Send off-stage", icon: displayed.transparent ? <OffStageIcon fontSize="small" /> : <OnStageIcon fontSize="small" />, color: inherited("transparent") ? "warning" : "default", disabled: inherited("transparent"), disabledSx: disabledSx("transparent"), onSelect: () => propertyAction("transparent") } as HierarchyAction] : []),
    ...(features.interaction && hasUpdatePermission ? [{ id: "clicks", label: displayed.disableHit ? "Enable clicks" : "Disable clicks", icon: displayed.disableHit ? <DoNotTouchRounded fontSize="small" /> : <TouchAppRounded fontSize="small" />, color: inherited("disableHit") ? "warning" : "default", disabled: inherited("disableHit"), disabledSx: disabledSx("disableHit"), onSelect: () => propertyAction("disableHit") } as HierarchyAction] : []),
    ...(features.locked && hasUpdatePermission ? [{ id: "lock", label: displayed.locked ? "Unlock" : "Lock", icon: displayed.locked ? <LockRounded fontSize="small" /> : <LockOpenRounded fontSize="small" />, color: inherited("locked") ? "warning" : "default", disabled: inherited("locked"), disabledSx: disabledSx("locked"), onSelect: () => propertyAction("locked") } as HierarchyAction] : []),
    ...(features.visible && role === "GM" ? [{ id: "visibility", label: visibilityLabel, icon: displayed.visible ? item.layer === "FOG" ? <FogCutOffIcon fontSize="small" /> : <VisibilityRounded fontSize="small" /> : item.layer === "FOG" ? <FogCutOnIcon fontSize="small" /> : <VisibilityOffRounded fontSize="small" />, color: inherited("visible") ? "warning" : "default", disabled: inherited("visible"), disabledSx: disabledSx("visible"), onSelect: () => propertyAction("visible") } as HierarchyAction] : []),
  ];
  return <ListItem disablePadding secondaryAction={inView ? <><HierarchyActionRow actions={actions} />{hasUpdatePermission && <SendMenuButton hideButton externalAnchor={sendAnchor} itemIds={ids} onStack={(operation) => onStack?.(ids, operation)} onOpenChange={(open) => { if (!open) setSendAnchor(null); }} />}</> : undefined} sx={{ ".MuiListItemButton-root": { pr: inView ? `${actionColumns * slotSize + 22}px` : undefined } }}>
    <ListItemButton ref={ref} selected={selected} dense onClick={onClick} onDoubleClick={onDoubleClick} sx={{ minHeight: slotSize, margin: "4px 8px", borderRadius: "12px", backgroundColor: dragging ? `${theme.palette.primary.main} !important` : "background.default", boxShadow: dragging ? theme.shadows[5] : undefined, color: dragging ? `${theme.palette.primary.contrastText} !important` : selected ? "primary.main" : undefined, borderLeft: "3px solid", borderLeftColor: selected ? "primary.main" : "transparent", cursor: dragging ? "grabbing" : undefined }}>
      {inView ? <><ListItemIcon sx={{ opacity: 0.75, minWidth: 28, "& svg": { fontSize: "1.25rem" }, color: "inherit" }}><ItemIcon item={item} /></ListItemIcon><Box sx={{ minWidth: 0, flex: `1 1 ${labelWidth}px` }}><ItemText item={item} /></Box></> : <Box height="28px" />}
    </ListItemButton>
  </ListItem>;
});
