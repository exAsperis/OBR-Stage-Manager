import ArrowDownwardIcon from "@mui/icons-material/ArrowDownwardRounded";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpwardRounded";
import SendToBackIcon from "@mui/icons-material/FlipToBackRounded";
import SendToFrontIcon from "@mui/icons-material/FlipToFrontRounded";
import SendIcon from "@mui/icons-material/SendRounded";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import SvgIcon from "@mui/material/SvgIcon";
import Tooltip from "@mui/material/Tooltip";
import { useState } from "react";
import type { StackOperation } from "./stacking";
import { formatLayerName, getOutlinerLayers } from "./layers";
import { LayerIcon } from "./LayerIcon";
import { useOwlbearStore } from "./useOwlbearStore";
import { orderedGroupIds, UNASSIGNED_ID } from "./virtualLayers";
import { assignItems } from "./virtualLayerService";
import { useLayerDisplaySettings } from "./layerSettings";

function LayerMoveIcon() {
  return <SvgIcon fontSize="small"><path d="m8 2 7 3.5L8 9 1 5.5 8 2ZM2.7 9.4 8 12l5.3-2.6L15 11l-7 3.5L1 11l1.7-1.6Zm0 5L8 17l5.3-2.6L15 16l-7 3.5L1 16l1.7-1.6ZM17 7l5 5-5 5v-3h-3v-4h3V7Z" /></SvgIcon>;
}

export function SendMenuButton({
  itemIds,
  onStack,
  confirmLayerMove,
  onOpenChange,
  allowStackWhenEmpty = false,
  externalAnchor,
  hideButton = false,
}: {
  itemIds: string[];
  onStack: (operation: StackOperation) => void;
  confirmLayerMove?: string;
  onOpenChange?: (open: boolean) => void;
  allowStackWhenEmpty?: boolean;
  externalAnchor?: HTMLElement | null;
  hideButton?: boolean;
}) {
  const role = useOwlbearStore((state) => state.role);
  const virtualLayers = useOwlbearStore((state) => state.virtualLayers);
  const layerSettings = useLayerDisplaySettings();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [layerMenuAnchor, setLayerMenuAnchor] = useState<HTMLElement | null>(null);
  const [moving, setMoving] = useState(false);

  function stopEvent(event: React.SyntheticEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  function closeMenus() {
    setLayerMenuAnchor(null);
    setMenuAnchor(null);
    onOpenChange?.(false);
  }

  function stack(event: React.MouseEvent, operation: StackOperation) {
    stopEvent(event);
    onStack(operation);
    closeMenus();
  }

  async function move(layer: Parameters<typeof assignItems>[2], virtualLayerId?: string, destinationName?: string) {
    if (confirmLayerMove && !window.confirm(
      `Move all ${itemIds.length} item${itemIds.length === 1 ? "" : "s"} from “${confirmLayerMove}” to “${destinationName ?? formatLayerName(layer!)}”?\n\nUndoing this change may be difficult.`,
    )) return;
    setMoving(true);
    try {
      await assignItems(itemIds, virtualLayerId, layer);
      closeMenus();
    } catch {
      window.alert("Unable to move the items.");
    } finally {
      setMoving(false);
    }
  }

  const iconSx = { color: "text.secondary", minWidth: "32px", "& svg": { fontSize: "1.25rem" } };
  return <>
    {!hideButton && <Tooltip title="Send" disableInteractive>
      <IconButton
        aria-label="Send"
        size="small"
        disabled={!itemIds.length && !allowStackWhenEmpty}
        onPointerDown={stopEvent}
        onClick={(event) => { stopEvent(event); setMenuAnchor(event.currentTarget); onOpenChange?.(true); }}
      >
        <SendIcon fontSize="small" />
      </IconButton>
    </Tooltip>}
    <Menu
      anchorEl={externalAnchor ?? menuAnchor}
      open={Boolean(externalAnchor ?? menuAnchor)}
      onClose={closeMenus}
      MenuListProps={{ dense: true, "aria-label": "Send" }}
    >
      <MenuItem onClick={(event) => stack(event, "front")}><ListItemIcon sx={iconSx}><SendToFrontIcon /></ListItemIcon><ListItemText primary="to Front" /></MenuItem>
      <MenuItem onClick={(event) => stack(event, "forward")}><ListItemIcon sx={iconSx}><ArrowUpwardIcon /></ListItemIcon><ListItemText primary="Forward" /></MenuItem>
      <MenuItem onClick={(event) => stack(event, "backward")}><ListItemIcon sx={iconSx}><ArrowDownwardIcon /></ListItemIcon><ListItemText primary="Backward" /></MenuItem>
      <MenuItem onClick={(event) => stack(event, "back")}><ListItemIcon sx={iconSx}><SendToBackIcon /></ListItemIcon><ListItemText primary="to Back" /></MenuItem>
      <MenuItem disabled={!itemIds.length} onClick={(event) => { stopEvent(event); setLayerMenuAnchor(event.currentTarget); }}><ListItemIcon sx={iconSx}><LayerMoveIcon /></ListItemIcon><ListItemText primary="to Layer" /></MenuItem>
    </Menu>
    <Menu
      anchorEl={layerMenuAnchor}
      open={Boolean(layerMenuAnchor)}
      onClose={() => setLayerMenuAnchor(null)}
      MenuListProps={{ dense: true, "aria-label": "Destination layer" }}
      slotProps={{ paper: { sx: { width: "max-content", maxWidth: "calc(100vw - 16px)" } } }}
    >
      {getOutlinerLayers(role, layerSettings.enabledLayers).flatMap((layer) => {
        const definitions = virtualLayers.layers.filter((entry) => entry.obrLayer === layer);
        return [
          <MenuItem key={layer} disabled={moving} onClick={() => void move(layer, undefined, formatLayerName(layer))}>
            <ListItemIcon sx={iconSx}><LayerIcon layer={layer} /></ListItemIcon>
            <ListItemText primary={formatLayerName(layer)} />
          </MenuItem>,
          ...(definitions.length ? orderedGroupIds(virtualLayers, layer).map((groupId) => {
            const definition = definitions.find((entry) => entry.id === groupId);
            const name = definition?.name ?? "Unassigned";
            return <MenuItem key={`${layer}:${groupId}`} disabled={moving} sx={{ pl: 6 }} onClick={() => void move(layer, definition?.id, name)}><ListItemText primary={name} sx={{ fontStyle: groupId === UNASSIGNED_ID ? "italic" : undefined }} /></MenuItem>;
          }) : []),
        ];
      })}
    </Menu>
  </>;
}
