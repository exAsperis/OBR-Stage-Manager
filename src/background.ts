import OBR, { isShape, type Item } from "@owlbear-rodeo/sdk";
import { ELEVATOR_METADATA_KEY, EXTENSION_ID } from "./constants";
import { enteredElevator, getElevatorConfiguration, isElevatorActive, isElevatorSubject, resolveElevatorDestination, selectWinningElevator, type Position } from "./elevator";
import { hasBoundaryViolation, stateFromMetadata, type VirtualLayerState } from "./virtualLayers";
import { assignItems, enforceStateInheritance, isVirtualLayerWriteInFlight, normalizeLayers } from "./virtualLayerService";
import { isAuthoritativeRole, retainExistingSelection, selectedSuppressedItemIds } from "./selectionSuppression";

const SEND_CONTEXT_MENU_ID = `${EXTENSION_ID}/send`;
const ELEVATOR_CONTEXT_MENU_ID = `${EXTENSION_ID}/elevator`;

let ready = false;
let unsubscribeItems: (() => void) | undefined;
let unsubscribeMetadata: (() => void) | undefined;
let unsubscribePlayer: (() => void) | undefined;
let reconciling = false;
let reconcilePending = false;
let latestMetadataState: VirtualLayerState | undefined;
let previousTokenPositions = new Map<string, Position>();
let elevatorQueue: Promise<void> = Promise.resolve();
let sceneEpoch = 0;
let selectedItemIds = new Set<string>();

function snapshotTokenPositions(items: Item[]) {
  return new Map(items.filter(isElevatorSubject).map((item) => [item.id, { ...item.position }]));
}

async function processElevators(items: Item[], previous: ReadonlyMap<string, Position>, epoch: number) {
  if (epoch !== sceneEpoch) return;
  if (!(await OBR.scene.isReady()) || !isAuthoritativeRole(await OBR.player.getRole())) return;
  const state = latestMetadataState ?? stateFromMetadata(await OBR.scene.getMetadata());
  const elevators = items.filter(isShape).filter((item) => getElevatorConfiguration(item) && isElevatorActive(item));
  for (const token of items.filter(isElevatorSubject)) {
    if (epoch !== sceneEpoch) return;
    const prior = previous.get(token.id);
    const winner = selectWinningElevator(elevators.filter((elevator) =>
      elevator.id !== token.id && enteredElevator(elevator, prior, token.position)));
    if (!winner) continue;
    const configuration = getElevatorConfiguration(winner);
    if (!configuration) continue;
    const destination = resolveElevatorDestination(configuration, state);
    if (!destination) continue;
    try {
      await assignItems([token.id], destination.virtualLayerId, destination.layer);
    } catch (error) {
      console.error("Stage Manager could not move an item through an Elevator.", error);
    }
  }
}

function deselectSuppressedItems(items: Item[]) {
  selectedItemIds = retainExistingSelection(items, selectedItemIds);
  const suppressed = selectedSuppressedItemIds(items, selectedItemIds);
  if (!suppressed.length) return;
  for (const id of suppressed) selectedItemIds.delete(id);
  void OBR.player.deselect(suppressed).catch((error) => {
    console.error("Stage Manager could not deselect suppressed items.", error);
    void OBR.player.getSelection().then((selection) => {
      selectedItemIds = new Set(selection ?? []);
    }, (selectionError) => {
      console.error("Stage Manager could not refresh the local selection.", selectionError);
    });
  });
}

function handleItemsChanged(items: Item[]) {
  deselectSuppressedItems(items);
  const previous = previousTokenPositions;
  previousTokenPositions = snapshotTokenPositions(items);
  const epoch = sceneEpoch;
  elevatorQueue = elevatorQueue.then(() => processElevators(items, previous, epoch), () => processElevators(items, previous, epoch));
  void elevatorQueue;
  void reconcile();
}

async function reconcile() {
  if (reconciling) {
    reconcilePending = true;
    return;
  }
  reconciling = true;
  try {
    do {
      reconcilePending = false;
      if (isVirtualLayerWriteInFlight() || !(await OBR.scene.isReady()) || !isAuthoritativeRole(await OBR.player.getRole())) continue;
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
  sceneEpoch += 1;
  unsubscribeItems?.(); unsubscribeMetadata?.();
  latestMetadataState = undefined;
  if (!(await OBR.scene.isReady())) {
    previousTokenPositions.clear();
    selectedItemIds.clear();
    return;
  }
  selectedItemIds = new Set(await OBR.player.getSelection() ?? []);
  latestMetadataState = stateFromMetadata(await OBR.scene.getMetadata());
  const items = await OBR.scene.items.getItems();
  previousTokenPositions = snapshotTokenPositions(items);
  deselectSuppressedItems(items);
  unsubscribeItems = OBR.scene.items.onChange(handleItemsChanged);
  unsubscribeMetadata = OBR.scene.onMetadataChange((metadata) => {
    latestMetadataState = stateFromMetadata(metadata);
    void reconcile();
  });
  await reconcile();
}

OBR.onReady(async () => {
  ready = true;
  selectedItemIds = new Set(await OBR.player.getSelection() ?? []);
  unsubscribePlayer = OBR.player.onChange((player) => {
    selectedItemIds = new Set(player.selection ?? []);
  });
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
  await OBR.contextMenu.create({
    id: ELEVATOR_CONTEXT_MENU_ID,
    icons: [
      {
        icon: `/elevator.svg?v=${import.meta.env.VITE_RELEASE_VERSION}`,
        label: "Edit Elevator…",
        filter: { min: 1, max: 1, permissions: ["UPDATE"], roles: ["GM"], every: [
          { key: "type", value: "SHAPE" },
          { key: ["metadata", ELEVATOR_METADATA_KEY], value: undefined, operator: "!=" },
        ] },
      },
      {
        icon: `/elevator.svg?v=${import.meta.env.VITE_RELEASE_VERSION}`,
        label: "Configure Elevator…",
        filter: { min: 1, max: 1, permissions: ["UPDATE"], roles: ["GM"], every: [{ key: "type", value: "SHAPE" }] },
      },
    ],
    embed: {
      url: new URL(`/elevator-menu.html?v=${import.meta.env.VITE_RELEASE_VERSION}`, window.location.origin).href,
      height: 240,
    },
  });
});

window.addEventListener("beforeunload", () => {
  if (!ready) {
    return;
  }
  void OBR.contextMenu.remove(SEND_CONTEXT_MENU_ID);
  void OBR.contextMenu.remove(ELEVATOR_CONTEXT_MENU_ID);
  unsubscribeItems?.();
  unsubscribeMetadata?.();
  unsubscribePlayer?.();
});
