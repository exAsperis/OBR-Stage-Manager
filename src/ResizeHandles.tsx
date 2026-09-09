import Box from "@mui/material/Box";
import { useEffect, useRef, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { resizedDimensions, type OutlinerDimensions, type ResizeAxis } from "./outlinerLayout";

export function ResizeHandles({ dimensions, widthEnabled, heightEnabled, onResize, onCommit }: {
  dimensions: OutlinerDimensions;
  widthEnabled: boolean;
  heightEnabled: boolean;
  onResize: (dimensions: OutlinerDimensions) => void;
  onCommit: (dimensions: OutlinerDimensions) => void;
}) {
  const frame = useRef<number>();
  const latest = useRef(dimensions);
  useEffect(() => { latest.current = dimensions; }, [dimensions]);
  useEffect(() => () => { if (frame.current !== undefined) cancelAnimationFrame(frame.current); }, []);

  const schedule = (next: OutlinerDimensions) => {
    latest.current = next;
    if (frame.current !== undefined) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = undefined;
      onResize(latest.current);
    });
  };

  const pointerDown = (axis: ResizeAxis) => (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    const startPoint = { x: event.clientX, y: event.clientY };
    const start = dimensions;
    const move = (moveEvent: PointerEvent) => schedule(resizedDimensions(start, axis, moveEvent.clientX - startPoint.x, moveEvent.clientY - startPoint.y));
    const finish = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", finish);
      target.removeEventListener("pointercancel", finish);
      if (frame.current !== undefined) {
        cancelAnimationFrame(frame.current);
        frame.current = undefined;
        onResize(latest.current);
      }
      onCommit(latest.current);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", finish);
    target.addEventListener("pointercancel", finish);
  };

  const keyDown = (axis: ResizeAxis) => (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 1 : 10;
    const deltaX = event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0;
    const deltaY = event.key === "ArrowDown" ? step : event.key === "ArrowUp" ? -step : 0;
    if ((!deltaX && !deltaY) || (axis === "width" && !deltaX) || (axis === "height" && !deltaY)) return;
    event.preventDefault();
    const next = resizedDimensions(dimensions, axis, deltaX, deltaY);
    onResize(next);
    onCommit(next);
  };

  const handle = (axis: ResizeAxis, label: string, sx: object) => <Box
    role="separator"
    tabIndex={0}
    aria-label={label}
    aria-orientation={axis === "width" ? "vertical" : axis === "height" ? "horizontal" : undefined}
    onPointerDown={pointerDown(axis)}
    onKeyDown={keyDown(axis)}
    sx={{ position: "fixed", zIndex: 1500, touchAction: "none", outlineOffset: -2, ...sx }}
  />;

  return <>
    {widthEnabled && handle("width", "Resize Stage Manager width", { top: 0, right: 0, bottom: 0, width: 6, cursor: "ew-resize" })}
    {heightEnabled && handle("height", "Resize Stage Manager height", { left: 0, right: 0, bottom: 0, height: 6, cursor: "ns-resize" })}
    {widthEnabled && heightEnabled && handle("both", "Resize Stage Manager width and height", { right: 0, bottom: 0, width: 14, height: 14, cursor: "nwse-resize" })}
  </>;
}
