import Box from "@mui/material/Box";
import FormControlLabel from "@mui/material/FormControlLabel";
import Menu from "@mui/material/Menu";
import Switch from "@mui/material/Switch";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/CloseRounded";
import type { EffectiveItemState, EnforcedItemState, InheritableProperty, VirtualInheritance } from "./virtualLayers";
import { setGroupInheritanceMode, setScopeEnforcement, type RuleScope } from "./virtualLayerService";
import type { FeatureSettings } from "./layerSettings";

const PROPERTIES: Array<{ property: InheritableProperty; feature: keyof FeatureSettings; label: string }> = [
  { property: "disableHit", feature: "interaction", label: "Click-through" },
  { property: "locked", feature: "locked", label: "Locked" },
  { property: "visible", feature: "visible", label: "Visible" },
];

export function InheritanceMenu({ anchorEl, scope, config, enforce, displayed, features, onClose }: {
  anchorEl: HTMLElement | null;
  scope: RuleScope;
  config?: VirtualInheritance;
  enforce: EnforcedItemState;
  displayed: EffectiveItemState;
  features: FeatureSettings;
  onClose: () => void;
}) {
  const independent = config?.mode === "independent";
  return <Menu
    anchorEl={anchorEl}
    open={Boolean(anchorEl)}
    onClose={onClose}
    onClick={(event) => event.stopPropagation()}
    onPointerDown={(event) => event.stopPropagation()}
    MenuListProps={{
      dense: true,
      "aria-label": "Inheritance settings",
      sx: { p: 1, width: 190 },
    }}
  >
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pl: 0.5, mb: 0.5 }}>
      <Typography variant="subtitle2">Inheritance</Typography>
      <IconButton size="small" aria-label="Close inheritance settings" onClick={onClose}>
        <CloseIcon fontSize="small" />
      </IconButton>
    </Box>
    {scope.kind === "group" && <>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", px: 0.5, pb: 0.5 }}>Mode</Typography>
      <ToggleButtonGroup
        exclusive
        fullWidth
        size="small"
        value={independent ? "independent" : "pass-through"}
        onChange={(_, value: VirtualInheritance["mode"] | null) => { if (value) void setGroupInheritanceMode(scope, value); }}
        aria-label="Inheritance mode"
        sx={{ mb: independent ? 1 : 0 }}
      >
        <ToggleButton value="pass-through">Pass thru</ToggleButton>
        <ToggleButton value="independent">Independent</ToggleButton>
      </ToggleButtonGroup>
    </>}
    {(scope.kind === "native" || independent) && <Box component="fieldset" sx={{ border: 0, p: 0, m: 0, width: "100%" }}>
      <Typography component="legend" variant="caption" color="text.secondary" sx={{ px: 0.5 }}>Enforce</Typography>
      {PROPERTIES.filter(({ feature }) => features[feature]).map(({ property, label }) => <FormControlLabel
        key={property}
        label={label}
        labelPlacement="start"
        control={<Switch
          size="small"
          checked={Object.prototype.hasOwnProperty.call(enforce, property)}
          onChange={(_, enabled) => void setScopeEnforcement(scope, property, enabled, displayed[property])}
          inputProps={{ "aria-label": `Enforce ${label}` }}
        />}
        sx={{ display: "flex", justifyContent: "space-between", ml: 0, mr: 0, minHeight: 30, "& .MuiFormControlLabel-label": { fontSize: "0.8125rem" } }}
      />)}
    </Box>}
  </Menu>;
}
