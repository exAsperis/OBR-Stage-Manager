import type { Item } from "@owlbear-rodeo/sdk";
import { ELEVATOR_METADATA_KEY } from "./constants.ts";
import { getElevatorConfiguration } from "./elevator.ts";

export type ElevatorControlErrorCode = "ITEM_NOT_FOUND" | "NOT_ELEVATOR";

export class ElevatorControlError extends Error {
  readonly code: ElevatorControlErrorCode;

  constructor(code: ElevatorControlErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "ElevatorControlError";
  }
}

export function elevatorDisabledMetadataUpdate(item: Pick<Item, "metadata"> | undefined, disabled: boolean) {
  if (!item) throw new ElevatorControlError("ITEM_NOT_FOUND", "The requested item was not found.");
  const configuration = getElevatorConfiguration(item);
  if (!configuration) throw new ElevatorControlError("NOT_ELEVATOR", "The requested item is not configured as an Elevator.");
  return { ...configuration, disabled: disabled ? "true" as const : "false" as const };
}

export function applyElevatorDisabled(item: Pick<Item, "metadata"> | undefined, disabled: boolean) {
  const configuration = elevatorDisabledMetadataUpdate(item, disabled);
  item!.metadata[ELEVATOR_METADATA_KEY] = configuration;
  return configuration;
}
