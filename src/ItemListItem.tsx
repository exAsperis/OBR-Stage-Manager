import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import OBR, { Item } from "@owlbear-rodeo/sdk";
import { ItemIcon } from "./ItemIcon";
import { ItemText } from "./ItemText";
import HiddenIcon from "@mui/icons-material/VisibilityOffRounded";
import VisibleIcon from "@mui/icons-material/VisibilityRounded";
import LockedIcon from "@mui/icons-material/LockRounded";
import UnlockIcon from "@mui/icons-material/LockOpenRounded";
import ClickableIcon from "@mui/icons-material/TouchAppRounded";
import ClickThroughIcon from "@mui/icons-material/DoNotTouchRounded";
import FogCutOnIcon from "./icons/other/FogCutOn";
import FogCutOffIcon from "./icons/other/FogCutOff";
import { useInView } from "react-intersection-observer";
import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import { useOwlbearStore } from "./useOwlbearStore";
import { memo, useState } from "react";
import useTheme from "@mui/material/styles/useTheme";
import ListItem from "@mui/material/ListItem";
import Stack from "@mui/material/Stack";
import { IconButton } from "@mui/material";
import { useItemHsaPermission } from "./useHasPermission";
import LocateIcon from "@mui/icons-material/CenterFocusStrongRounded";
import type { StackOperation } from "./stacking";
import { getItemActionReservedSlots, getItemActionVisibility } from "./itemActionVisibility";
import { SendMenuButton } from "./SendMenuButton";
import { getItemParentRule, getItemRule, hasInstructions, itemInheritanceLabel, inheritanceVisualState, itemState, type StatefulProperty } from "./stateInheritance";
import { setItemTransparency, setItemVisibility, toggleItemInheritance } from "./virtualLayerService";
import { InheritanceStateIcon } from "./InheritanceStateIcon";
import { OffStageIcon, OnStageIcon } from "./icons/other/TransparencyIcons";
import { useLayerDisplaySettings } from "./layerSettings";

const ACTION_SLOT_SIZE = 30;

function EmptyActionSlot() {
  return (
    <Box
      aria-hidden="true"
      sx={{
        width: `${ACTION_SLOT_SIZE}px`,
        height: `${ACTION_SLOT_SIZE}px`,
        flex: `0 0 ${ACTION_SLOT_SIZE}px`,
        pointerEvents: "none",
      }}
    />
  );
}

export const ItemListItem = memo(function ({
  item,
  onClick,
  onDoubleClick,
  onLocate,
  onStack,
  dragging,
}: {
  item: Item;
  onClick?: (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  onDoubleClick?: (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  onLocate?: () => void;
  onStack?: (itemIds: string[], operation: StackOperation) => void;
  dragging?: boolean;
}) {
  const selected = useOwlbearStore(
    (state) => state.selection?.includes(item.id) ?? false
  );
  const selection = useOwlbearStore((state) => state.selection);
  const role = useOwlbearStore((state) => state.role);
  const virtualLayers = useOwlbearStore((state) => state.virtualLayers);
  const localRule = getItemRule(item);
  const parentRule = getItemParentRule(item, virtualLayers);
  const independent = Boolean(localRule);
  const effectiveRule = independent ? {} : parentRule;
  const features = useLayerDisplaySettings().features;

  const [ref, inView] = useInView();

  const theme = useTheme();

  const [hovering, setHovering] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [sendMenuOpen, setSendMenuOpen] = useState(false);

  const hasUpdatePermission = useItemHsaPermission(item, "UPDATE");
  const displayed = { ...itemState(item), ...effectiveRule };
  const actionVisibility = getItemActionVisibility({
    selected,
    hovering,
    focusWithin,
    layerMenuOpen: sendMenuOpen,
    inheritanceActive: independent || hasInstructions(effectiveRule),
    transparent: displayed.transparent,
    disableHit: displayed.disableHit,
    locked: displayed.locked,
    visible: displayed.visible,
    hasUpdatePermission,
    isGm: role === "GM",
    manageInheritance: features.manageInheritance,
    transparencyEnabled: features.transparency,
    interactionEnabled: features.interaction,
    lockedEnabled: features.locked,
    visibleEnabled: features.visible,
  });
  const showActions = inView && actionVisibility.showActionRow;
  const reservedActionSlots = getItemActionReservedSlots(actionVisibility, hasUpdatePermission, features);

  function stopActionEvent(event: React.SyntheticEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  function handleActionClick(
    event: React.MouseEvent<HTMLButtonElement>,
    action: () => void
  ) {
    stopActionEvent(event);
    action();
  }

  function handlePropertyClick(property: StatefulProperty) {
    const current = displayed[property];
    if (property === "transparent") void setItemTransparency(item, !current);
    else if (property === "visible") void setItemVisibility(item, !current);
    else void OBR.scene.items.updateItems([item], (items) => { items[0][property] = !current; });
  }

  const inheritanceState = inheritanceVisualState("item", hasInstructions(parentRule), independent);
  const inheritanceColor = inheritanceState === "enabled" ? "warning" : inheritanceState === "disabled" ? "default" : "error";
  const inheritanceActionLabel = itemInheritanceLabel(independent);
  const isInherited = (property: StatefulProperty) => !independent && Object.prototype.hasOwnProperty.call(parentRule, property);
  const stateColor = (property: StatefulProperty) => isInherited(property) ? "warning" : "default";
  const disabledInheritedSx = (property: StatefulProperty) => isInherited(property) ? { "&.Mui-disabled": { color: "warning.main" } } : undefined;
  return (
    <ListItem
      disablePadding
      secondaryAction={
        showActions ? (
          <Stack
            direction="row"
            sx={{ opacity: actionVisibility.dimmed ? 0.5 : 1 }}
          >
            {actionVisibility.showGeneralActions ? <Tooltip title="Locate" disableInteractive>
              <IconButton
                aria-label="Locate"
                size="small"
                onPointerDown={stopActionEvent}
                onClick={(event) =>
                  handleActionClick(event, () => onLocate?.())
                }
              >
                <LocateIcon fontSize="small" />
              </IconButton>
            </Tooltip> : <EmptyActionSlot />}
            {actionVisibility.showGeneralActions && hasUpdatePermission ? (
              <>
                <SendMenuButton
                  itemIds={selected && selection?.length ? selection : [item.id]}
                  onStack={(operation) => onStack?.(selected && selection?.length ? selection : [item.id], operation)}
                  onOpenChange={setSendMenuOpen}
                />
              </>
            ) : <EmptyActionSlot />}
            {features.manageInheritance && (actionVisibility.showInheritance ? (
              <Tooltip title={inheritanceActionLabel} disableInteractive>
                <IconButton
                  aria-label={inheritanceActionLabel}
                  color={inheritanceColor}
                  size="small"
                  onPointerDown={stopActionEvent}
                  onClick={(event) => handleActionClick(event, () => { void toggleItemInheritance(item); })}
                >
                  <InheritanceStateIcon state={inheritanceState} fontSize="small" />
                </IconButton>
              </Tooltip>
            ) : <EmptyActionSlot />)}
            {features.transparency && (actionVisibility.showTransparent ? (
              <Tooltip title={displayed.transparent ? "Bring on-stage" : "Send off-stage"} disableInteractive>
                <IconButton
                  aria-label={displayed.transparent ? "Bring on-stage" : "Send off-stage"}
                  color={stateColor("transparent")}
                  disabled={isInherited("transparent")}
                  sx={disabledInheritedSx("transparent")}
                  size="small"
                  onPointerDown={stopActionEvent}
                  onClick={(event) => handleActionClick(event, () => handlePropertyClick("transparent"))}
                >
                  {displayed.transparent ? <OffStageIcon fontSize="small" /> : <OnStageIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
            ) : <EmptyActionSlot />)}
            {features.interaction && (actionVisibility.showDisableHit ? (
              <Tooltip
                title={displayed.disableHit ? "Enable clicks" : "Disable clicks"}
                disableInteractive
              >
                <IconButton
                  aria-label={displayed.disableHit ? "Enable clicks" : "Disable clicks"}
                  color={stateColor("disableHit")}
                  disabled={isInherited("disableHit")}
                  sx={disabledInheritedSx("disableHit")}
                  size="small"
                  onPointerDown={stopActionEvent}
                  onClick={(event) => handleActionClick(event, () => handlePropertyClick("disableHit"))}
                >
                  {displayed.disableHit ? (
                    <ClickThroughIcon fontSize="small" />
                  ) : (
                    <ClickableIcon fontSize="small" />
                  )}
                </IconButton>
              </Tooltip>
            ) : <EmptyActionSlot />)}
            {features.locked && (actionVisibility.showLock ? (
              <Tooltip
                title={displayed.locked ? "Unlock" : "Lock"}
                disableInteractive
              >
                <IconButton
                  aria-label={displayed.locked ? "Unlock" : "Lock"}
                  color={stateColor("locked")}
                  disabled={isInherited("locked")}
                  sx={disabledInheritedSx("locked")}
                  size="small"
                  onPointerDown={stopActionEvent}
                  onClick={(event) => handleActionClick(event, () => handlePropertyClick("locked"))}
                >
                  {displayed.locked ? (
                    <LockedIcon fontSize="small" />
                  ) : (
                    <UnlockIcon fontSize="small" />
                  )}
                </IconButton>
              </Tooltip>
            ) : <EmptyActionSlot />)}
            {features.visible && (actionVisibility.showVisibility ? (
              <Tooltip
                title={
                  displayed.visible
                    ? item.layer === "FOG"
                      ? "Cut"
                      : "Hide"
                    : item.layer === "FOG"
                    ? "Uncut"
                    : "Show"
                }
                disableInteractive
              >
                <IconButton
                  size="small"
                  aria-label={displayed.visible ? "Hide" : "Show"}
                  color={stateColor("visible")}
                  disabled={isInherited("visible")}
                  sx={disabledInheritedSx("visible")}
                  onPointerDown={stopActionEvent}
                  onClick={(event) =>
                    handleActionClick(event, () => handlePropertyClick("visible"))
                  }
                >
                  {displayed.visible ? (
                    item.layer === "FOG" ? (
                      <FogCutOffIcon fontSize="small" />
                    ) : (
                      <VisibleIcon fontSize="small" />
                    )
                  ) : item.layer === "FOG" ? (
                    <FogCutOnIcon fontSize="small" />
                  ) : (
                    <HiddenIcon fontSize="small" />
                  )}
                </IconButton>
              </Tooltip>
            ) : <EmptyActionSlot />)}
          </Stack>
        ) : undefined
      }
      onPointerOver={(e) => {
        if (e.pointerType === "mouse") {
          setHovering(true);
        }
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") {
          setHovering(false);
        }
      }}
      onFocus={() => setFocusWithin(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setFocusWithin(false);
        }
      }}
      sx={{
        ".MuiListItemButton-root": {
          pr: showActions ? `${reservedActionSlots * ACTION_SLOT_SIZE + 22}px` : undefined,
        },
      }}
    >
      <ListItemButton
        sx={{
          margin: "4px 8px",
          borderRadius: "12px",
          backgroundColor: dragging
            ? `${theme.palette.primary.main} !important`
            : "background.default",
          boxShadow: dragging ? theme.shadows[5] : undefined,
          color: dragging
            ? `${theme.palette.primary.contrastText} !important`
            : selected
              ? "primary.main"
              : undefined,
          borderLeft: "3px solid",
          borderLeftColor: selected ? "primary.main" : "transparent",
          cursor: dragging ? "grabbing" : undefined,
        }}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        selected={selected}
        dense
        ref={ref}
      >
        {inView ? (
          <>
            <ListItemIcon
              sx={{
                opacity: "0.75",
                minWidth: "28px",
                "& svg": { fontSize: "1.25rem" },
                color: "inherit",
              }}
            >
              <ItemIcon item={item} />
            </ListItemIcon>
            <ItemText item={item} />
          </>
        ) : (
          <Box height="28px" />
        )}
      </ListItemButton>
    </ListItem>
  );
});
