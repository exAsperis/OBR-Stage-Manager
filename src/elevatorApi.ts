import { EXTENSION_ID } from "./constants.ts";
import { ElevatorControlError } from "./elevatorControl.ts";
import { getElevatorConfiguration } from "./elevator.ts";
import type { Item } from "@owlbear-rodeo/sdk";

export const ELEVATOR_DISABLED_REQUEST_CHANNEL = `${EXTENSION_ID}/api/v1/elevator/disabled`;
export const ELEVATOR_DISABLED_RESULT_CHANNEL = `${ELEVATOR_DISABLED_REQUEST_CHANNEL}/result`;
export const ELEVATOR_LIST_REQUEST_CHANNEL = `${EXTENSION_ID}/api/v1/elevator/list`;
export const ELEVATOR_LIST_RESULT_CHANNEL = `${ELEVATOR_LIST_REQUEST_CHANNEL}/result`;

export type ElevatorDisabledRequest = { requestId: string; itemId: string; disabled: boolean };
export type ElevatorDisabledApiErrorCode = "INVALID_REQUEST" | "UNAUTHORIZED" | "ITEM_NOT_FOUND" | "NOT_ELEVATOR" | "UPDATE_FAILED";
export type ElevatorDisabledResult =
  | { requestId: string; itemId: string; ok: true; disabled: boolean }
  | { requestId: string; itemId?: string; ok: false; error: { code: ElevatorDisabledApiErrorCode; message: string } };
export type ElevatorSummary = { itemId: string; name: string; disabled: boolean };
export type ElevatorListResult =
  | { requestId: string; ok: true; elevators: ElevatorSummary[] }
  | { requestId: string; ok: false; error: { code: "INVALID_REQUEST" | "UNAUTHORIZED" | "LIST_FAILED"; message: string } };

function requestIdFrom(data: unknown) {
  return data && typeof data === "object" && typeof (data as { requestId?: unknown }).requestId === "string"
    ? (data as { requestId: string }).requestId : "";
}

export function parseElevatorDisabledRequest(data: unknown): ElevatorDisabledRequest | undefined {
  if (!data || typeof data !== "object") return undefined;
  const request = data as Partial<ElevatorDisabledRequest>;
  if (typeof request.requestId !== "string" || request.requestId.length === 0 ||
      typeof request.itemId !== "string" || request.itemId.length === 0 ||
      typeof request.disabled !== "boolean") return undefined;
  return { requestId: request.requestId, itemId: request.itemId, disabled: request.disabled };
}

export async function handleElevatorDisabledRequest(
  data: unknown,
  role: "GM" | "PLAYER",
  update: (itemId: string, disabled: boolean) => Promise<void>,
): Promise<ElevatorDisabledResult> {
  const request = parseElevatorDisabledRequest(data);
  if (!request) {
    const requestId = requestIdFrom(data);
    return { requestId, ok: false, error: { code: "INVALID_REQUEST", message: "Expected a non-empty requestId and itemId plus a boolean disabled value." } };
  }
  if (role !== "GM") {
    return { requestId: request.requestId, itemId: request.itemId, ok: false, error: { code: "UNAUTHORIZED", message: "Only a GM may change Elevator status." } };
  }
  try {
    await update(request.itemId, request.disabled);
    return { ...request, ok: true };
  } catch (error) {
    if (error instanceof ElevatorControlError) {
      return { requestId: request.requestId, itemId: request.itemId, ok: false, error: { code: error.code, message: error.message } };
    }
    return { requestId: request.requestId, itemId: request.itemId, ok: false, error: {
      code: "UPDATE_FAILED", message: error instanceof Error ? error.message : "Unable to update the Elevator.",
    } };
  }
}

export function listElevators(items: ReadonlyArray<Pick<Item, "id" | "name" | "metadata">>): ElevatorSummary[] {
  return items.flatMap((item) => {
    const configuration = getElevatorConfiguration(item);
    return configuration ? [{ itemId: item.id, name: item.name, disabled: configuration.disabled === "true" }] : [];
  }).sort((left, right) => left.itemId.localeCompare(right.itemId));
}

export async function handleElevatorListRequest(
  data: unknown,
  role: "GM" | "PLAYER",
  getItems: () => Promise<Array<Pick<Item, "id" | "name" | "metadata">>>,
): Promise<ElevatorListResult> {
  const requestId = requestIdFrom(data);
  if (!requestId) {
    return { requestId, ok: false, error: { code: "INVALID_REQUEST", message: "Expected a non-empty requestId." } };
  }
  if (role !== "GM") {
    return { requestId, ok: false, error: { code: "UNAUTHORIZED", message: "Only a GM may list Elevators." } };
  }
  try {
    return { requestId, ok: true, elevators: listElevators(await getItems()) };
  } catch (error) {
    return { requestId, ok: false, error: {
      code: "LIST_FAILED", message: error instanceof Error ? error.message : "Unable to list Elevators.",
    } };
  }
}
