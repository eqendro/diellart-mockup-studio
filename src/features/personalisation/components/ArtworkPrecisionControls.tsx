"use client";

import { useEffect, useRef } from "react";
import type { PlacementDirection } from "@/features/mockup-engine/placement";

type RepeatButtonProps = {
  label: string;
  children: React.ReactNode;
  className?: string;
  onActivate: () => void;
};

function RepeatButton({ label, children, className = "", onActivate }: RepeatButtonProps) {
  const delayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clear = () => {
    if (delayRef.current) clearTimeout(delayRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    delayRef.current = null;
    intervalRef.current = null;
  };
  useEffect(() => clear, []);
  return (
    <button
      type="button"
      className={`precision-button ${className}`}
      aria-label={label}
      onClick={onActivate}
      onPointerDown={() => {
        clear();
        delayRef.current = setTimeout(() => {
          intervalRef.current = setInterval(onActivate, 80);
        }, 350);
      }}
      onPointerUp={clear}
      onPointerCancel={clear}
      onPointerLeave={clear}
    >
      {children}
    </button>
  );
}

type Props = {
  onMove: (direction: PlacementDirection) => void;
  onResize: (direction: "increase" | "decrease") => void;
  onRotate: (direction: "clockwise" | "anticlockwise") => void;
  onCentre: () => void;
  onReset: () => void;
};

export function ArtworkPrecisionControls({ onMove, onResize, onRotate, onCentre, onReset }: Props) {
  return (
    <div className="placement-controls">
      <fieldset className="precision-group position-control">
        <legend>Position</legend>
        <RepeatButton label="Move logo up" className="position-up" onActivate={() => onMove("up")}>↑</RepeatButton>
        <RepeatButton label="Move logo left" className="position-left" onActivate={() => onMove("left")}>←</RepeatButton>
        <button type="button" className="position-centre" aria-label="Centre logo" onClick={onCentre}>Centre</button>
        <RepeatButton label="Move logo right" className="position-right" onActivate={() => onMove("right")}>→</RepeatButton>
        <RepeatButton label="Move logo down" className="position-down" onActivate={() => onMove("down")}>↓</RepeatButton>
      </fieldset>
      <fieldset className="precision-group size-control">
        <legend>Size</legend>
        <RepeatButton label="Make artwork smaller" onActivate={() => onResize("decrease")}>−</RepeatButton>
        <RepeatButton label="Make artwork larger" onActivate={() => onResize("increase")}>+</RepeatButton>
      </fieldset>
      <fieldset className="precision-group rotation-control">
        <legend>Rotation</legend>
        <RepeatButton label="Rotate artwork anticlockwise" onActivate={() => onRotate("anticlockwise")}>↶</RepeatButton>
        <RepeatButton label="Rotate artwork clockwise" onActivate={() => onRotate("clockwise")}>↷</RepeatButton>
      </fieldset>
      <button type="button" className="button button-ghost button-medium desktop-reset-placement" onClick={onReset}>Reset placement</button>
    </div>
  );
}
