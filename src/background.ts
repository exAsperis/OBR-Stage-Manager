import OBR from "@owlbear-rodeo/sdk";
import { EXTENSION_ID } from "./constants";
import { hasBoundaryViolation, stateFromMetadata, type VirtualLayerState } from "./virtualLayers";
import { enforceStateInheritance, isVirtualLayerWriteInFlight, normalizeLayers } from "./virtualLayerService";

const SEND_CONTEXT_MENU_ID = `${EXTENSION_ID}/send`;

let ready = false;
let unsubscribeItems: (() => void) | undefined;
let unsubscribeMetadata: (() => void) | undefined;
let reconciling = false;
let reconcilePending = false;
let latestMetadataState: VirtualLayerState | undefined;

async function reconcile() {
  if (reconciling) {
    reconcilePending = true;
    return;
  }
  reconciling = true;
  try {
    do {
      reconcilePending = false;
      if (isVirtualLayerWriteInFlight() || !(await OBR.scene.isReady()) || (await OBR.player.getRole()) !== "GM") continue;
      // Metadata change events carry the authoritative snapshot. Re-reading
      // immediately after an event can briefly return the previous value in a
      // separate extension iframe, which makes a completed state switch revert.
      const state = latestMetadataState ?? stateFromMetadata(await OBR.scene.getMetadata());
      const items = await OBR.scene.items.getItems();
      const layers = [...new Set(state.layers.map((entry) => entry.obrLayer))]
        .filter((layer) => hasBoundaryViolation(items, state, layer));
      if (layers.length) await normalizeLayers(layers, state);
      await enforceStateInheritance(state);
    } while (reconcilePending);
  } finally { reconciling = false; }
}

async function startReconciliation() {
  unsubscribeItems?.(); unsubscribeMetadata?.();
  latestMetadataState = undefined;
  if (!(await OBR.scene.isReady())) return;
  latestMetadataState = stateFromMetadata(await OBR.scene.getMetadata());
  unsubscribeItems = OBR.scene.items.onChange(() => { void reconcile(); });
  unsubscribeMetadata = OBR.scene.onMetadataChange((metadata) => {
    latestMetadataState = stateFromMetadata(metadata);
    void reconcile();
  });
  await reconcile();
}

OBR.onReady(async () => {
  ready = true;
  await startReconciliation();
  OBR.scene.onReadyChange(() => { void startReconciliation(); });
  await OBR.contextMenu.create({
    id: SEND_CONTEXT_MENU_ID,
    icons: [
      {
        icon: `/send.svg?v=${import.meta.env.VITE_RELEASE_VERSION}`,
        label: "Send…",
        filter: { permissions: ["UPDATE"], roles: ["GM"] },
      },
    ],
    embed: {
      url: new URL(
        `/send-menu.html?v=${import.meta.env.VITE_RELEASE_VERSION}`,
        window.location.origin
      ).href,
      height: 168,
    },
  });
});

window.addEventListener("beforeunload", () => {
  if (!ready) {
    return;
  }
  void OBR.contextMenu.remove(SEND_CONTEXT_MENU_ID);
  unsubscribeItems?.();
  unsubscribeMetadata?.();
});
