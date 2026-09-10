import Box from "@mui/material/Box";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormGroup from "@mui/material/FormGroup";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import { formatLayerName, OUTLINER_LAYERS_TOP_TO_BOTTOM } from "./layers";
import { setFeatureEnabled, setLayerEnabled, useLayerDisplaySettings, type FeatureSetting } from "./layerSettings";
import { LayerIcon } from "./LayerIcon";
import { useOwlbearStore } from "./useOwlbearStore";

const FEATURES: Array<{ feature: FeatureSetting; label: string }> = [
  { feature: "manageInheritance", label: "Manage inheritance" },
  { feature: "transparency", label: "On-stage / off-stage" },
  { feature: "interaction", label: "Interaction" },
  { feature: "locked", label: "Locked/Unlocked" },
  { feature: "visible", label: "Visible/Hidden" },
];

export function SettingsPanel() {
  const settings = useLayerDisplaySettings();
  const items = useOwlbearStore((state) => state.items);
  const enabled = new Set(settings.enabledLayers);
  return <Box component="li" sx={{ listStyle: "none" }}>
    <Box id="outliner-settings" component="section" aria-labelledby="features-heading" sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: "divider", bgcolor: "background.paper" }}>
      <Typography id="features-heading" variant="subtitle2" sx={{ mb: 0.5 }}>Features</Typography>
      <FormGroup sx={{ mb: 1 }}>
        <FeatureToggle feature={FEATURES[0].feature} label={FEATURES[0].label} checked={settings.features.manageInheritance} />
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 1 }}>Item States</Typography>
        {FEATURES.slice(1).map(({ feature, label }) => <FeatureToggle key={feature} feature={feature} label={label} checked={settings.features[feature]} nested />)}
      </FormGroup>
      <Divider sx={{ mx: -2, mb: 1.5 }} />
      <Typography id="show-layers-heading" variant="subtitle2" sx={{ mb: 0.5 }}>Show layers</Typography>
      <FormGroup>
        {OUTLINER_LAYERS_TOP_TO_BOTTOM.map((layer) => <FormControlLabel
          key={layer}
          label={<Stack component="span" direction="row" alignItems="center" spacing={1}>
            <Box component="span" sx={{ display: "inline-flex", width: 20, color: "text.secondary", "& svg": { fontSize: "1.25rem" } }}><LayerIcon layer={layer} /></Box>
            <Typography component="span" variant="body2">{formatLayerName(layer)} [{items.filter((item) => item.layer === layer).length}]</Typography>
          </Stack>}
          labelPlacement="start"
          control={<Switch size="small" checked={enabled.has(layer)} onChange={(_, checked) => setLayerEnabled(layer, checked)} inputProps={{ "aria-label": `Show ${formatLayerName(layer)} layer` }} />}
          sx={{ justifyContent: "space-between", ml: 0, mr: 0, minHeight: 34, "& .MuiFormControlLabel-label": { fontSize: "0.875rem" } }}
        />)}
      </FormGroup>
    </Box>
  </Box>;
}

function FeatureToggle({ feature, label, checked, nested = false }: { feature: FeatureSetting; label: string; checked: boolean; nested?: boolean }) {
  return <FormControlLabel
    label={label}
    labelPlacement="start"
    control={<Switch size="small" checked={checked} onChange={(_, enabled) => setFeatureEnabled(feature, enabled)} inputProps={{ "aria-label": label }} />}
    sx={{ justifyContent: "space-between", ml: nested ? 1 : 0, mr: 0, minHeight: 34, "& .MuiFormControlLabel-label": { fontSize: "0.875rem" } }}
  />;
}
