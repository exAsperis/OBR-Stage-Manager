import CheckIcon from "@mui/icons-material/CheckRounded";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineRounded";
import ElevatorIcon from "@mui/icons-material/ElevatorRounded";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import OBR, { isShape, type Item } from "@owlbear-rodeo/sdk";
import { useEffect, useMemo, useState } from "react";
import { ELEVATOR_METADATA_KEY } from "./constants";
import { elevatorDestinationsEqual, getElevatorConfiguration, resolveElevatorDestination, type ElevatorDestination } from "./elevator";
import { formatLayerName, getOutlinerLayers } from "./layers";
import { LayerIcon } from "./LayerIcon";
import { useLayerDisplaySettings } from "./layerSettings";
import { readVirtualLayerState, setElevatorConfiguration } from "./virtualLayerService";
import { EMPTY_VIRTUAL_LAYER_STATE, orderedGroupIds, UNASSIGNED_ID, type VirtualLayerState } from "./virtualLayers";

export function ElevatorMenuApp() {
  const [item, setItem] = useState<Item>();
  const [state, setState] = useState<VirtualLayerState>(EMPTY_VIRTUAL_LAYER_STATE);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const layerSettings = useLayerDisplaySettings();
  const layers = useMemo(() => getOutlinerLayers("GM", layerSettings.enabledLayers), [layerSettings.enabledLayers]);
  const configuration = item ? getElevatorConfiguration(item) : undefined;
  const valid = configuration ? Boolean(resolveElevatorDestination(configuration, state)) : true;

  useEffect(() => {
    let active = true;
    void Promise.all([OBR.player.getSelection(), readVirtualLayerState()]).then(async ([selection, nextState]) => {
      const selectedId = selection?.length === 1 ? selection[0] : undefined;
      const selected = selectedId ? (await OBR.scene.items.getItems((entry) => entry.id === selectedId))[0] : undefined;
      if (!active) return;
      if (!selected || !isShape(selected)) setError("Select one shape to configure an Elevator.");
      else setItem(selected);
      setState(nextState);
    }, () => active && setError("Unable to load Elevator settings."));
    return () => { active = false; };
  }, []);

  async function save(destination?: ElevatorDestination) {
    if (!item) return;
    setBusy(true); setError("");
    try {
      await setElevatorConfiguration(item.id, destination ? { version: 1, destination } : undefined);
      setItem({ ...item, metadata: destination ? { ...item.metadata, [ELEVATOR_METADATA_KEY]: { version: 1, destination } } : Object.fromEntries(Object.entries(item.metadata).filter(([key]) => key !== ELEVATOR_METADATA_KEY)) });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update the Elevator.");
    } finally { setBusy(false); }
  }

  function isConfigured(destination: ElevatorDestination) {
    return configuration ? elevatorDestinationsEqual(configuration.destination, destination) : false;
  }

  return <div id="menu-viewport"><div id="send-menu" role="menu" aria-label="Elevator destination">
    {item && <Typography variant="caption" sx={{ display: "block", px: 1.5, py: .5 }}>
      {configuration ? `Elevator: ${valid ? "configured" : "destination missing"}` : "Configure as Elevator"}
    </Typography>}
    {layers.map((layer) => {
      const nativeDestination = { kind: "native", layer } as const;
      const nativeConfigured = isConfigured(nativeDestination);
      return <div className="layer-group" key={layer}>
      <ListItemButton dense role="menuitem" aria-current={nativeConfigured ? "true" : undefined} selected={nativeConfigured} disabled={busy} onClick={() => void save(nativeDestination)}>
        <ListItemIcon sx={{ minWidth: 32 }}><LayerIcon layer={layer} /></ListItemIcon><ListItemText primary={formatLayerName(layer)} />
        {nativeConfigured && <CheckIcon color="primary" fontSize="small" />}
      </ListItemButton>
      {orderedGroupIds(state, layer).filter((id) => id !== UNASSIGNED_ID).map((id) => {
        const definition = state.layers.find((entry) => entry.id === id);
        const destination = { kind: "virtual", virtualLayerId: id } as const;
        const configured = isConfigured(destination);
        return definition && <ListItemButton dense role="menuitem" aria-current={configured ? "true" : undefined} selected={configured} className="virtual-layer" disabled={busy} key={id} onClick={() => void save(destination)}>
          <ListItemIcon sx={{ minWidth: 32 }}><ElevatorIcon fontSize="small" /></ListItemIcon><ListItemText primary={definition.name} />
          {configured && <CheckIcon color="primary" fontSize="small" />}
        </ListItemButton>;
      })}
    </div>})}
    {configuration && <ListItemButton dense role="menuitem" disabled={busy} onClick={() => void save()}>
      <ListItemIcon sx={{ minWidth: 32 }}><DeleteOutlineIcon fontSize="small" /></ListItemIcon><ListItemText primary="Disable Elevator" />
    </ListItemButton>}
    {error && <Typography id="status" role="status" color="error" variant="caption">{error}</Typography>}
  </div></div>;
}
