"use client";

import Image from "next/image";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { SHOW_MOCKUP_DEBUG_OVERLAY } from "@/config/products/pocket-paper";
import type { PrintableArtwork } from "@/features/logo-engine/types/artwork";
import type { ArtworkPlacement } from "@/features/mockup-engine/placement";
import {
  applyGestureDelta,
  calculatePinchPlacement,
  pointerAngle,
  pointerDistance,
  pointerMidpoint,
  resizePlacement,
  rotatePlacement,
  type Point,
} from "@/features/mockup-engine/placement";
import { calculateLogoFit } from "@/features/mockup-engine/utils/calculate-logo-fit";
import { resolveArtworkGeometry } from "@/features/mockup-engine/utils/resolve-artwork-geometry";
import type { ProductMockup } from "@/types/product-template";

type MockupRendererProps = {
  mockup: ProductMockup;
  artwork?: PrintableArtwork | null;
  placement: ArtworkPlacement;
  onPlacementCommit?: (placement: ArtworkPlacement) => void;
  onInteractionComplete?: (pointerType: string) => void;
};

type GestureStart =
  | {
      type: "drag";
      point: Point;
      placement: ArtworkPlacement;
      moved: boolean;
      pointerType: string;
    }
  | {
      type: "pinch";
      distance: number;
      angle: number;
      midpoint: Point;
      placement: ArtworkPlacement;
      moved: boolean;
      pointerType: string;
    };

export function MockupRenderer({
  mockup,
  artwork,
  placement,
  onPlacementCommit,
  onInteractionComplete,
}: MockupRendererProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });
  const [interactivePlacement, setInteractivePlacement] = useState(placement);
  const [interactionMode, setInteractionMode] = useState<"idle" | "drag" | "pinch" | "rotate">("idle");
  const placementRef = useRef(placement);
  const pointersRef = useRef(new Map<number, Point & { pointerType: string }>());
  const gestureRef = useRef<GestureStart | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (pointersRef.current.size) return;
    setInteractivePlacement(placement);
    placementRef.current = placement;
  }, [placement]);

  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const updateSize = () => {
      const bounds = stage.getBoundingClientRect();
      setDisplaySize({ width: bounds.width, height: bounds.height });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  const fit = useMemo(
    () =>
      calculateLogoFit({
        mockupWidth: displaySize.width,
        mockupHeight: displaySize.height,
        productBounds: mockup.productBounds,
        surface: mockup.surface,
        safeMargins: mockup.surface.safeMargins,
        logoAspectRatio: artwork?.aspectRatio ?? 1,
        scaleMultiplier:
          interactivePlacement.scale * mockup.defaultLogoPlacement.scale,
        offsetX: interactivePlacement.offsetX,
        offsetY: interactivePlacement.offsetY,
        fitProfile: mockup.fitProfile,
      }),
    [displaySize, artwork?.aspectRatio, interactivePlacement, mockup],
  );

  const safeSize = () => ({
    width:
      displaySize.width *
      mockup.productBounds.width *
      mockup.surface.width *
      (1 - mockup.surface.safeMargins.horizontal * 2),
    height:
      displaySize.height *
      mockup.productBounds.height *
      mockup.surface.height *
      (1 - mockup.surface.safeMargins.vertical * 2),
  });

  const schedulePlacement = (next: ArtworkPlacement) => {
    placementRef.current = next;
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      setInteractivePlacement(placementRef.current);
    });
  };

  const beginDrag = (point: Point, pointerType: string) => {
    gestureRef.current = {
      type: "drag",
      point,
      placement: placementRef.current,
      moved: false,
      pointerType,
    };
    setInteractionMode("drag");
  };

  const beginPinch = () => {
    const points = [...pointersRef.current.values()];
    if (points.length < 2) return;
    gestureRef.current = {
      type: "pinch",
      distance: pointerDistance(points[0], points[1]),
      angle: pointerAngle(points[0], points[1]),
      midpoint: pointerMidpoint(points[0], points[1]),
      placement: placementRef.current,
      moved: false,
      pointerType: points.some((point) => point.pointerType === "touch")
        ? "touch"
        : points[0].pointerType,
    };
    setInteractionMode("pinch");
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLImageElement>) => {
    if (!artwork || !onPlacementCommit) return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic browser tests do not create a native active-pointer record.
    }
    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
      pointerType: event.pointerType,
    });
    if (pointersRef.current.size === 1) {
      beginDrag({ x: event.clientX, y: event.clientY }, event.pointerType);
    } else {
      beginPinch();
    }
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLImageElement>) => {
    if (!pointersRef.current.has(event.pointerId) || !artwork) return;
    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
      pointerType: event.pointerType,
    });
    const gesture = gestureRef.current;
    const size = safeSize();
    if (pointersRef.current.size >= 2) {
      event.preventDefault();
      if (!gesture || gesture.type !== "pinch") {
        beginPinch();
        return;
      }
      const points = [...pointersRef.current.values()];
      const midpoint = pointerMidpoint(points[0], points[1]);
      gesture.moved =
        gesture.moved ||
        Math.abs(pointerDistance(points[0], points[1]) - gesture.distance) >= 1 ||
        Math.hypot(
          midpoint.x - gesture.midpoint.x,
          midpoint.y - gesture.midpoint.y,
        ) >= 1;
      schedulePlacement(
        calculatePinchPlacement({
          placement: gesture.placement,
          initialDistance: gesture.distance,
          currentDistance: pointerDistance(points[0], points[1]),
          initialAngle: gesture.angle,
          currentAngle: pointerAngle(points[0], points[1]),
          midpointDeltaX: midpoint.x - gesture.midpoint.x,
          midpointDeltaY: midpoint.y - gesture.midpoint.y,
          safeWidth: size.width,
          safeHeight: size.height,
          mockup,
          artworkAspectRatio: artwork.aspectRatio,
        }),
      );
      return;
    }
    if (!gesture || gesture.type !== "drag") return;
    const deltaX = event.clientX - gesture.point.x;
    const deltaY = event.clientY - gesture.point.y;
    if (!gesture.moved && Math.hypot(deltaX, deltaY) < 4) return;
    gesture.moved = true;
    event.preventDefault();
    schedulePlacement(
      applyGestureDelta({
        placement: gesture.placement,
        deltaX,
        deltaY,
        safeWidth: size.width,
        safeHeight: size.height,
        mockup,
        artworkAspectRatio: artwork.aspectRatio,
      }),
    );
  };

  const finishPointer = (
    event: ReactPointerEvent<HTMLImageElement>,
    releaseCapture: boolean,
    successful: boolean,
  ) => {
    if (!pointersRef.current.delete(event.pointerId)) return;
    const completedGesture = gestureRef.current;
    if (releaseCapture && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (pointersRef.current.size === 1) {
      if (
        successful &&
        completedGesture?.type === "pinch" &&
        completedGesture.moved
      ) {
        onInteractionComplete?.(completedGesture.pointerType);
      }
      const remaining = [...pointersRef.current.values()][0];
      beginDrag(remaining, remaining.pointerType);
      return;
    }
    gestureRef.current = null;
    setInteractionMode("idle");
    onPlacementCommit?.(placementRef.current);
    if (successful && completedGesture?.moved) {
      onInteractionComplete?.(completedGesture.pointerType);
    }
  };

  const productBoundsStyle = {
    left: `${mockup.productBounds.x * 100}%`,
    top: `${mockup.productBounds.y * 100}%`,
    width: `${mockup.productBounds.width * 100}%`,
    height: `${mockup.productBounds.height * 100}%`,
  };
  const artworkGeometry = artwork
    ? resolveArtworkGeometry(fit, artwork, interactivePlacement)
    : null;
  const surfaceStyle = {
    left: `${mockup.surface.x * 100}%`,
    top: `${mockup.surface.y * 100}%`,
    width: `${mockup.surface.width * 100}%`,
    height: `${mockup.surface.height * 100}%`,
  };
  const safeStyle = {
    left: `${mockup.surface.safeMargins.horizontal * 100}%`,
    top: `${mockup.surface.safeMargins.vertical * 100}%`,
    width: `${(1 - mockup.surface.safeMargins.horizontal * 2) * 100}%`,
    height: `${(1 - mockup.surface.safeMargins.vertical * 2) * 100}%`,
  };

  const placementGeometry = artwork
    ? { mockup, artworkAspectRatio: artwork.aspectRatio }
    : null;

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (!placementGeometry || !onPlacementCommit) return;
    event.preventDefault();
    const direction = event.deltaY < 0 ? "increase" : "decrease";
    const next = resizePlacement(placementRef.current, direction, placementGeometry);
    schedulePlacement(next);
    onPlacementCommit(next);
    onInteractionComplete?.("mouse");
  };

  const rotateFromPoint = (clientX: number, clientY: number) => {
    if (!artworkGeometry || !placementGeometry) return;
    const bounds = stageRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const centreX = bounds.left + artworkGeometry.left + artworkGeometry.width / 2;
    const centreY = bounds.top + artworkGeometry.top + artworkGeometry.height / 2;
    const angle = (Math.atan2(clientY - centreY, clientX - centreX) * 180) / Math.PI + 90;
    schedulePlacement(rotatePlacement(placementRef.current, angle, placementGeometry));
  };

  const handleRotationKey = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (!placementGeometry || !onPlacementCommit) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = rotatePlacement(
      placementRef.current,
      placementRef.current.rotation + (event.key === "ArrowRight" ? 2 : -2),
      placementGeometry,
    );
    schedulePlacement(next);
    onPlacementCommit(next);
  };

  return (
    <div
      className="mockup-stage"
      ref={stageRef}
      role="img"
      aria-label={
        artwork
          ? `${mockup.name} personalised with ${artwork.filename}`
          : `${mockup.name} product preview`
      }
      data-interaction-mode={interactionMode}
      data-placement-scale={interactivePlacement.scale}
      data-placement-offset-x={interactivePlacement.offsetX}
      data-placement-offset-y={interactivePlacement.offsetY}
      data-placement-rotation={interactivePlacement.rotation}
      onWheel={handleWheel}
    >
      <Image
        src={mockup.imagePath}
        alt=""
        fill
        priority={false}
        sizes="(max-width: 767px) 90vw, 33vw"
        className="mockup-product-image"
        onLoad={(event) => {
          if (process.env.NODE_ENV !== "production") {
            console.debug("[mockup-product-decode]", {
              url: mockup.imagePath,
              decoded: event.currentTarget.complete &&
                event.currentTarget.naturalWidth > 0,
            });
          }
        }}
        onError={() => {
          if (process.env.NODE_ENV !== "production") {
            console.error("[mockup-contract]", "Pocket Paper image decode failed", {
              url: mockup.imagePath,
            });
          }
        }}
      />
      {artwork && artworkGeometry && fit.width > 0 ? (
        // Object URLs remain browser-local and cannot use Next.js image optimisation.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={artwork.url}
          alt=""
          className="mockup-logo"
          data-alpha-left={artwork.foregroundBounds.x}
          data-alpha-top={artwork.foregroundBounds.y}
          data-alpha-width={artwork.foregroundBounds.width}
          data-alpha-height={artwork.foregroundBounds.height}
          draggable={false}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={(event) => finishPointer(event, true, true)}
          onPointerCancel={(event) => finishPointer(event, false, false)}
          onLostPointerCapture={(event) => finishPointer(event, false, false)}
          onLoad={(event) => {
            if (process.env.NODE_ENV !== "production") {
              console.debug("[mockup-artwork-decode]", {
                url: artwork.url,
                decoded: event.currentTarget.complete &&
                  event.currentTarget.naturalWidth > 0,
                intrinsicWidth: event.currentTarget.naturalWidth,
                intrinsicHeight: event.currentTarget.naturalHeight,
                resolvedWidth: artworkGeometry.width,
                resolvedHeight: artworkGeometry.height,
                resolvedAspectRatio: artworkGeometry.aspectRatio,
              });
              console.assert(
                event.currentTarget.naturalWidth === artwork.canvasWidth &&
                  event.currentTarget.naturalHeight === artwork.canvasHeight,
                "Rendered monochrome dimensions must match prepared canvas dimensions.",
              );
              const bounds = event.currentTarget.getBoundingClientRect();
              console.assert(
                Math.abs(
                  bounds.width / bounds.height -
                    event.currentTarget.naturalWidth /
                      event.currentTarget.naturalHeight,
                ) < 0.001,
                "Rendered artwork aspect ratio must match its intrinsic aspect ratio.",
              );
            }
          }}
          onError={() => {
            if (process.env.NODE_ENV !== "production") {
              console.error("[mockup-contract]", "Artwork image decode failed", {
                url: artwork.url,
              });
            }
          }}
          style={{
            left: artworkGeometry.left,
            top: artworkGeometry.top,
            width: artworkGeometry.width,
            height: "auto",
            transform: `rotate(${interactivePlacement.rotation}deg)`,
            mixBlendMode: artwork.veryLight
              ? mockup.renderingProfile.lightArtworkBlendMode
              : mockup.renderingProfile.blendMode,
            opacity: (artwork.veryLight
              ? Math.max(
                  mockup.renderingProfile.opacity,
                  mockup.renderingProfile.lightArtworkOpacity,
                )
              : mockup.renderingProfile.opacity) *
              (1 - mockup.renderingProfile.textureInfluence * 0.05),
            filter: `contrast(${
              artwork.veryLight
                ? mockup.renderingProfile.lightArtworkContrast
                : mockup.renderingProfile.contrast
            }) saturate(${mockup.renderingProfile.saturation}) blur(${
              mockup.renderingProfile.blurPx + mockup.renderingProfile.inkSpreadPx
            }px)`,
          }}
        />
      ) : null}
      {artwork && artworkGeometry && onPlacementCommit ? (
        <button
          type="button"
          className="artwork-rotation-handle"
          aria-label="Rotate artwork"
          title="Drag to rotate artwork"
          style={{
            left: artworkGeometry.left + artworkGeometry.width / 2,
            top: artworkGeometry.top,
          }}
          onKeyDown={handleRotationKey}
          onPointerDown={(event) => {
            event.preventDefault();
            try {
              event.currentTarget.setPointerCapture(event.pointerId);
            } catch {
              // Synthetic browser tests do not create a native active-pointer record.
            }
            setInteractionMode("rotate");
            rotateFromPoint(event.clientX, event.clientY);
          }}
          onPointerMove={(event) => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
            rotateFromPoint(event.clientX, event.clientY);
          }}
          onPointerUp={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
            setInteractionMode("idle");
            onPlacementCommit(placementRef.current);
            onInteractionComplete?.(event.pointerType);
          }}
          onPointerCancel={() => setInteractionMode("idle")}
        >
          <span aria-hidden="true" />
        </button>
      ) : null}
      {SHOW_MOCKUP_DEBUG_OVERLAY ? (
        <>
          <div className="mockup-debug-product" style={productBoundsStyle} aria-hidden="true">
            <div className="mockup-debug-surface" style={surfaceStyle}>
              <span className="mockup-debug-safe" style={safeStyle} />
            </div>
          </div>
          <span
            className="mockup-debug-logo"
            style={{
              left: fit.x,
              top: fit.y,
              width: fit.width,
              height: fit.height,
            }}
            aria-hidden="true"
          />
        </>
      ) : null}
    </div>
  );
}
