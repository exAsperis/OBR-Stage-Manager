import assert from "node:assert/strict";
import test from "node:test";
import { ELEVATOR_DISABLED_REQUEST_CHANNEL, ELEVATOR_DISABLED_RESULT_CHANNEL, handleElevatorDisabledRequest, parseElevatorDisabledRequest } from "../src/elevatorApi.ts";
import { ElevatorControlError } from "../src/elevatorControl.ts";

test("publishes stable versioned Elevator API channels", () => {
  assert.equal(ELEVATOR_DISABLED_REQUEST_CHANNEL, "com.ex-asperis.obr-stage-manager/api/v1/elevator/disabled");
  assert.equal(ELEVATOR_DISABLED_RESULT_CHANNEL, `${ELEVATOR_DISABLED_REQUEST_CHANNEL}/result`);
});

test("validates Elevator API requests", () => {
  const request = { requestId: "request-1", itemId: "elevator-1", disabled: true };
  assert.deepEqual(parseElevatorDisabledRequest(request), request);
  for (const invalid of [null, {}, { ...request, requestId: "" }, { ...request, itemId: "" }, { ...request, disabled: "true" }]) {
    assert.equal(parseElevatorDisabledRequest(invalid), undefined);
  }
});

test("handles successful correlated API updates", async () => {
  const updates: unknown[] = [];
  const result = await handleElevatorDisabledRequest(
    { requestId: "request-1", itemId: "elevator-1", disabled: true }, "GM",
    async (itemId, disabled) => { updates.push([itemId, disabled]); },
  );
  assert.deepEqual(updates, [["elevator-1", true]]);
  assert.deepEqual(result, { requestId: "request-1", itemId: "elevator-1", disabled: true, ok: true });
});

test("rejects unauthorized and invalid API requests without updating", async () => {
  let called = false;
  const update = async () => { called = true; };
  assert.equal((await handleElevatorDisabledRequest({ requestId: "r", itemId: "i", disabled: false }, "PLAYER", update)).ok, false);
  const invalid = await handleElevatorDisabledRequest({ requestId: "correlation", itemId: "i", disabled: "false" }, "GM", update);
  assert.deepEqual(invalid, { requestId: "correlation", ok: false, error: {
    code: "INVALID_REQUEST", message: "Expected a non-empty requestId and itemId plus a boolean disabled value.",
  } });
  assert.equal(called, false);
});

test("maps known update failures to stable API errors", async () => {
  for (const code of ["ITEM_NOT_FOUND", "NOT_ELEVATOR"] as const) {
    const result = await handleElevatorDisabledRequest(
      { requestId: "r", itemId: "i", disabled: false }, "GM",
      async () => { throw new ElevatorControlError(code, "failure"); },
    );
    assert.deepEqual(result, { requestId: "r", itemId: "i", ok: false, error: { code, message: "failure" } });
  }
  const unknown = await handleElevatorDisabledRequest(
    { requestId: "r", itemId: "i", disabled: false }, "GM",
    async () => { throw new Error("network failure"); },
  );
  assert.deepEqual(unknown, { requestId: "r", itemId: "i", ok: false, error: { code: "UPDATE_FAILED", message: "network failure" } });
});
