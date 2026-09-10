import List from "@mui/material/List";
import Stack from "@mui/material/Stack";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import HelpIcon from "@mui/icons-material/HelpOutlineRounded";
import SettingsIcon from "@mui/icons-material/SettingsRounded";
import OBR from "@owlbear-rodeo/sdk";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SimpleBar from "simplebar-react";
import "simplebar-react/dist/simplebar.min.css";
import { Header } from "./Header";
import { Items } from "./Items";
import { SearchField } from "./SearchField";
import { useOwlbearStore } from "./useOwlbearStore";
import { itemHasPermission } from "./hasPermission";
import { SettingsPanel } from "./SettingsPanel";
import { StateSwitcher } from "./StateSwitcher";
import { resolveParticipationModel } from "./participation";
import { ResizeHandles } from "./ResizeHandles";
import { clampDimension, DEFAULT_OUTLINER_LAYOUT_SETTINGS, MAX_OUTLINER_HEIGHT, MAX_OUTLINER_WIDTH, readOutlinerLayoutSettings, type ControlDensity, type MinimizedOrientation, type OutlinerDimensions, type OutlinerLayoutSettings, writeOutlinerLayoutSettings } from "./outlinerLayout";
import { MINIMIZED_LAYOUT_METADATA_KEY } from "./constants";
import { convertOutlinerV1Namespace } from "./virtualLayerService";

export function Outliner() {
  const listRef = useRef<HTMLUListElement>(null);
  const switcherRef = useRef<HTMLDivElement>(null);
  const virtualLayers = useOwlbearStore((state) => state.virtualLayers);
  const virtualLayersReady = useOwlbearStore((state) => state.virtualLayersReady);
  const sceneModelCompatibility = useOwlbearStore((state) => state.sceneModelCompatibility);
  const sceneMinimizedLayout = useOwlbearStore((state) => state.sceneMinimizedLayout);
  const setSceneMinimizedLayout = useOwlbearStore((state) => state.setSceneMinimizedLayout);
  const hasStateGroups = useMemo(() => resolveParticipationModel(virtualLayers).stateGroups.length > 0, [virtualLayers]);
  const savedLayout = useMemo(() => readOutlinerLayoutSettings(), []);
  const [layout, setLayout] = useState<OutlinerLayoutSettings>(savedLayout ?? DEFAULT_OUTLINER_LAYOUT_SETTINGS);
  const layoutRef = useRef(layout);
  const sceneLayoutRef = useRef(sceneMinimizedLayout);
  const sceneWriteTimer = useRef<number>();
  const fullHeightInitialized = useRef(Boolean(savedLayout));
  const isMinimized = layout.mode === "minimized" && hasStateGroups;
  const isVerticalMinimized = isMinimized && layout.minimizedOrientation === "vertical";
  const activeProfile = isMinimized ? layout.minimizedOrientation : "full";
  const activeDimensions = activeProfile === "full" ? layout.full : sceneMinimizedLayout.dimensions[activeProfile];

  useEffect(() => {
    if (!isMinimized) return;
    const backgroundColor = document.body.style.backgroundColor;
    document.body.style.backgroundColor = "transparent";
    return () => { document.body.style.backgroundColor = backgroundColor; };
  }, [isMinimized]);

  const updateFullProfile = useCallback((dimensions: OutlinerDimensions, persist: boolean) => {
    const next = { ...layoutRef.current, full: dimensions };
    layoutRef.current = next;
    setLayout(next);
    if (persist) writeOutlinerLayoutSettings(next);
  }, []);

  const updateMinimizedProfile = useCallback((orientation: MinimizedOrientation, dimensions: OutlinerDimensions, persist: boolean) => {
    const next = { ...sceneLayoutRef.current, dimensions: { ...sceneLayoutRef.current.dimensions, [orientation]: dimensions } };
    sceneLayoutRef.current = next;
    setSceneMinimizedLayout(next);
    if (persist) {
      if (sceneWriteTimer.current !== undefined) window.clearTimeout(sceneWriteTimer.current);
      sceneWriteTimer.current = window.setTimeout(() => {
        sceneWriteTimer.current = undefined;
        void OBR.scene.setMetadata({ [MINIMIZED_LAYOUT_METADATA_KEY]: sceneLayoutRef.current });
      }, 150);
    }
  }, [setSceneMinimizedLayout]);

  useEffect(() => { sceneLayoutRef.current = sceneMinimizedLayout; }, [sceneMinimizedLayout]);

  const updateLocalLayout = useCallback((changes: Partial<OutlinerLayoutSettings>, persist = true) => {
    const next = { ...layoutRef.current, ...changes };
    layoutRef.current = next;
    setLayout(next);
    if (persist) writeOutlinerLayoutSettings(next);
  }, []);

  const setMode = (mode: "full" | "minimized") => {
    const next = { ...layoutRef.current, mode };
    layoutRef.current = next;
    setLayout(next);
    writeOutlinerLayoutSettings(next);
    const dimensions = mode === "full" ? next.full : sceneLayoutRef.current.dimensions[next.minimizedOrientation];
    void OBR.action.setWidth(dimensions.width);
    void OBR.action.setHeight(dimensions.height);
  };

  const setMinimizedOrientation = (minimizedOrientation: MinimizedOrientation) => {
    const next = { ...layoutRef.current, minimizedOrientation };
    layoutRef.current = next;
    setLayout(next);
    writeOutlinerLayoutSettings(next);
    const dimensions = sceneLayoutRef.current.dimensions[minimizedOrientation];
    void OBR.action.setWidth(dimensions.width);
    void OBR.action.setHeight(dimensions.height);
  };

  useEffect(() => {
    if (!ResizeObserver) return;
    const updateHeight = () => {
      const switcherHeight = switcherRef.current?.getBoundingClientRect().height ?? 0;
      if (isMinimized && !isVerticalMinimized) {
        const height = clampDimension(switcherHeight, 1, MAX_OUTLINER_HEIGHT);
        const minimized = sceneLayoutRef.current.dimensions.horizontal;
        if (height !== minimized.height) {
          void OBR.action.setHeight(height);
          updateMinimizedProfile("horizontal", { ...minimized, height }, true);
        }
      } else if (isVerticalMinimized) {
        const vertical = sceneLayoutRef.current.dimensions.vertical;
        const width = clampDimension(switcherRef.current?.scrollWidth ?? vertical.width, 1, MAX_OUTLINER_WIDTH);
        if (width !== vertical.width) {
          void OBR.action.setWidth(width);
          updateMinimizedProfile("vertical", { ...vertical, width }, true);
        }
      } else if (!fullHeightInitialized.current) {
        const listHeight = Math.max(listRef.current?.getBoundingClientRect().height ?? 0, 64);
        const height = clampDimension(listHeight + switcherHeight + 64 + 16, 129, MAX_OUTLINER_HEIGHT);
        fullHeightInitialized.current = true;
        void OBR.action.setHeight(height);
        updateFullProfile({ ...layoutRef.current.full, height }, true);
      }
    };
    const resizeObserver = new ResizeObserver(updateHeight);
    if (listRef.current) resizeObserver.observe(listRef.current);
    if (switcherRef.current) resizeObserver.observe(switcherRef.current);
    updateHeight();
    return () => resizeObserver.disconnect();
  }, [isMinimized, isVerticalMinimized, updateFullProfile, updateMinimizedProfile]);

  useEffect(() => {
    void OBR.action.setWidth(activeDimensions.width);
    if (!isMinimized || isVerticalMinimized) void OBR.action.setHeight(activeDimensions.height);
  }, [activeDimensions.height, activeDimensions.width, isMinimized, isVerticalMinimized]);

  useEffect(() => {
    if (virtualLayersReady && layout.mode === "minimized" && !hasStateGroups) setMode("full");
  }, [hasStateGroups, layout.mode, virtualLayersReady]);

  const [search, setSearch] = useState("");
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [conversionOpen, setConversionOpen] = useState(false);
  const [converting, setConverting] = useState(false);
  const [conversionError, setConversionError] = useState<string>();

  const convertNamespace = async () => {
    setConverting(true);
    setConversionError(undefined);
    try {
      await convertOutlinerV1Namespace();
      setConversionOpen(false);
    } catch (error) {
      setConversionError(error instanceof Error ? error.message : "The conversion failed unexpectedly. Please try again.");
    } finally {
      setConverting(false);
    }
  };

  useEffect(() => {
    // When a common key is pressed ensure the action is performed in OBR
    // This is done because the OBR window might not have focus so the
    // key won't be triggered
    async function handleKeyDown(e: KeyboardEvent) {
      // Ignore when typing into an input field
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      const role = useOwlbearStore.getState().role;
      const selection = useOwlbearStore.getState().selection;
      const permissions = useOwlbearStore.getState().permissions;
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selection) {
          e.preventDefault();
          e.stopPropagation();
          const items = await OBR.scene.items.getItems(selection);
          const canDelete = items.filter((item) =>
            itemHasPermission(item, "DELETE", permissions, role, OBR.player.id)
          );
          if (canDelete.length > 0) {
            await OBR.scene.items.deleteItems(canDelete.map((item) => item.id));
          }
          await OBR.player.deselect();
        }
      }
      if (e.key === "z") {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          e.stopPropagation();
          if (e.shiftKey) {
            await OBR.scene.history.redo();
          } else {
            await OBR.scene.history.undo();
          }
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <Stack
      height="100vh"
      sx={{
        bgcolor: isMinimized ? "transparent" : "background.default",
        ".MuiCardHeader-action": {
          mr: searchExpanded ? 0 : undefined,
          flexShrink: searchExpanded ? 1 : undefined,
        },
        overflow: "hidden",
      }}
    >
      {!isMinimized && <Header
        title={searchExpanded ? "" : "Stage Manager"}
        action={
          <Stack direction="row" alignItems="center">
            <SearchField
              value={search}
              onChange={setSearch}
              expanded={searchExpanded}
              onExpand={setSearchExpanded}
            />
            <Tooltip title="Settings" disableInteractive>
              <IconButton
                aria-label="Settings"
                aria-pressed={settingsOpen}
                aria-expanded={settingsOpen}
                aria-controls={settingsOpen ? "outliner-settings" : undefined}
                onClick={() => setSettingsOpen((open) => !open)}
              >
                <SettingsIcon sx={{ color: settingsOpen ? "primary.main" : undefined }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Help" disableInteractive>
              <IconButton
                component="a"
                href={new URL("/", window.location.origin).href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Help"
              >
                <HelpIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        }
      />}
      <Box ref={switcherRef} flexShrink={0} sx={{ width: isVerticalMinimized ? "max-content" : undefined }}><StateSwitcher minimized={isMinimized} minimizedOrientation={layout.minimizedOrientation} density={isMinimized ? layout.controlDensity : layout.editingDensity} collapsed={!isMinimized && layout.editingElevatorCollapsed} onCollapsedChange={(editingElevatorCollapsed) => updateLocalLayout({ editingElevatorCollapsed })} onModeToggle={() => setMode(isMinimized ? "full" : "minimized")} onOrientationToggle={() => setMinimizedOrientation(layout.minimizedOrientation === "horizontal" ? "vertical" : "horizontal")} /></Box>
      {!isMinimized && <SimpleBar style={{ minHeight: 0, flex: 1 }}>
        <List ref={listRef} disablePadding>
          {sceneModelCompatibility === "legacy" && <Alert severity="warning" sx={{ m: 1 }}>
            This scene contains data owned by the non-beta Outliner+ extension. Stage Manager leaves it untouched so it remains available to Outliner+.
          </Alert>}
          {sceneModelCompatibility === "migratable" && <Alert severity="warning" sx={{ m: 1 }} action={
            <Button color="inherit" size="small" onClick={() => { setConversionError(undefined); setConversionOpen(true); }}>
              Convert to Stage Manager
            </Button>
          }>
            This scene contains compatible Outliner+ beta data. Convert it to use Stage Manager while retaining the original metadata as a fallback.
          </Alert>}
          {sceneModelCompatibility === "invalid" && <Alert severity="error" sx={{ m: 1 }}>
            This scene's Stage Manager data is invalid, so no virtual-layer, inheritance, or participation rules are being applied.
          </Alert>}
          {settingsOpen && <SettingsPanel editingDensity={layout.editingDensity} controlDensity={layout.controlDensity} onDensityChange={(mode: "editing" | "control", density: ControlDensity) => updateLocalLayout(mode === "editing" ? { editingDensity: density } : { controlDensity: density })} />}
          <Items search={search} labelWidth={layout.labelWidth} actionSlotSize={layout.editingDensity === "roomy" ? 40 : 30} onLabelWidthChange={(labelWidth, persist) => updateLocalLayout({ labelWidth }, persist)} />
        </List>
      </SimpleBar>}
      <Dialog open={conversionOpen} onClose={() => { if (!converting) setConversionOpen(false); }}>
        <DialogTitle>Convert this scene to Stage Manager?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Stage Manager will copy the compatible Outliner+ beta scene settings and item assignments to its new namespace. The original Outliner+ metadata will be retained.
          </DialogContentText>
          {conversionError && <Alert severity="error" sx={{ mt: 2 }}>
            Conversion failed: {conversionError} No scene data was removed. Check your connection and try again.
          </Alert>}
        </DialogContent>
        <DialogActions>
          <Button disabled={converting} onClick={() => setConversionOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={converting} onClick={() => void convertNamespace()} startIcon={converting ? <CircularProgress size={16} color="inherit" /> : undefined}>
            {converting ? "Converting…" : "Convert"}
          </Button>
        </DialogActions>
      </Dialog>
      <ResizeHandles
        dimensions={activeDimensions}
        widthEnabled={!isMinimized || !isVerticalMinimized}
        heightEnabled={!isMinimized || isVerticalMinimized}
        onResize={(dimensions) => {
          if (activeProfile === "full") updateFullProfile(dimensions, false);
          else updateMinimizedProfile(activeProfile, dimensions, false);
          if (!isVerticalMinimized) void OBR.action.setWidth(dimensions.width);
          if (!isMinimized || isVerticalMinimized) void OBR.action.setHeight(dimensions.height);
        }}
        onCommit={(dimensions) => {
          if (activeProfile === "full") updateFullProfile(dimensions, true);
          else updateMinimizedProfile(activeProfile, dimensions, true);
        }}
      />
    </Stack>
  );
}
