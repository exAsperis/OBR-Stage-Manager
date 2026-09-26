import assert from "node:assert/strict";
import test from "node:test";
import type { Item } from "@owlbear-rodeo/sdk";
import { ELEVATOR_METADATA_KEY } from "../src/constants.ts";
import { applyElevatorDisabled, ElevatorControlError } from "../src/elevatorControl.ts";

const destination = { kind: "virtual", virtualLayerId: "upper" } as const;

test("disable updates preserve the elevator destination and write explicit strings", () => {
  const item = { metadata: { [ELEVATOR_METADATA_KEY]: { version: 1, destination } } } as Pick<Item, "metadata">;
  assert.deepEqual(applyElevatorDisabled(item, true), { version: 1, destination, disabled: "true" });
  assert.deepEqual(applyElevatorDisabled(item, false), { version: 1, destination, disabled: "false" });
});

test("disable updates reject missing and unconfigured items with stable errors", () => {
  assert.throws(() => applyElevatorDisabled(undefined, true), (error) => error instanceof ElevatorControlError && error.code === "ITEM_NOT_FOUND");
  assert.throws(() => applyElevatorDisabled({ metadata: {} }, true), (error) => error instanceof ElevatorControlError && error.code === "NOT_ELEVATOR");
});
