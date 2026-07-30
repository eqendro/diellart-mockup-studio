"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  analyseArtwork,
  createCandidateOutcome,
  createCroppedArtwork,
  type ArtworkIntakeResult,
  type CropSelection,
  type CroppedArtwork,
  type PreparationOutcome,
  selectIntakeRoute,
  mapCustomerArtworkState,
  isUsableArtworkCandidate,
} from "@/features/artwork-intake";
import { prepareArtwork } from "@/features/logo-engine/preparation/prepare-artwork";
import {
  createProcessingAsset,
  revokeOwnedObjectUrl,
  selectPrintableArtwork,
} from "@/features/logo-engine/preparation/artwork-state";
import type { ArtworkAsset, PrintableArtwork } from "@/features/logo-engine/types/artwork";
import type { AcceptedLogo } from "@/features/upload/types/logo-upload";

export type ArtworkIntakeStatus = "idle" | "analysing" | "complete" | "error";
export type ArtworkProcessingState =
  | "idle"
  | "analysing"
  | "selecting"
  | "cropping"
  | "preparing"
  | "ready"
  | "needs-review"
  | "failed";

export function usePreparedArtwork(logo: AcceptedLogo | null) {
  const [asset, setAsset] = useState<ArtworkAsset | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [intakeStatus, setIntakeStatus] = useState<ArtworkIntakeStatus>("idle");
  const [intakeResult, setIntakeResult] = useState<ArtworkIntakeResult | null>(null);
  const [outcome, setOutcome] = useState<PreparationOutcome | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [processingCrop, setProcessingCrop] = useState(false);
  const [processingState, setProcessingState] =
    useState<ArtworkProcessingState>("idle");
  const [croppedArtwork, setCroppedArtwork] = useState<CroppedArtwork | null>(null);
  const preparedUrlRef = useRef<string | null>(null);
  const croppedUrlRef = useRef<string | null>(null);
  const generationRef = useRef(0);

  const applyPreparation = useCallback(
    async (
      source: AcceptedLogo,
      base: ArtworkAsset,
      confidence: "high" | "medium",
    ) => {
      const generation = generationRef.current;
      const result = await prepareArtwork(source);
      if (generation !== generationRef.current) return null;
      if (!result) {
        const unchanged = {
          ...base,
          preparation: { ...base.preparation, status: "ready" as const },
        };
        setAsset(unchanged);
        setOutcome({
          status: "ready",
          confidence,
          preparedArtwork: unchanged,
        });
        setProcessingState("ready");
        return unchanged;
      }
      const preparedUrl = URL.createObjectURL(result.blob);
      revokeOwnedObjectUrl(preparedUrlRef);
      preparedUrlRef.current = preparedUrl;
      const preparedAsset: ArtworkAsset = {
        ...base,
        preparedUrl,
        printableUrl: preparedUrl,
        preparedWidth: result.width,
        preparedHeight: result.height,
        veryLight: result.veryLight,
        foregroundBounds: result.foregroundBounds,
        preparation: {
          backgroundRemoved: result.backgroundRemoved,
          marginsCropped: result.marginsCropped,
          backgroundClassification: result.backgroundClassification,
          status: "ready",
        },
      };
      setAsset(preparedAsset);
      setShowOriginal(false);
      setOutcome(createCandidateOutcome(preparedAsset, confidence));
      setProcessingState(confidence === "high" ? "ready" : "needs-review");
      return preparedAsset;
    },
    [],
  );

  useEffect(() => {
    const generation = ++generationRef.current;
    revokeOwnedObjectUrl(preparedUrlRef);
    revokeOwnedObjectUrl(croppedUrlRef);
    // A new source invalidates every derived candidate and selection.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowOriginal(false);
    setCropOpen(false);
    setOutcome(null);
    setProcessingCrop(false);
    setCroppedArtwork(null);
    if (!logo) {
      setAsset(null);
      setIntakeStatus("idle");
      setIntakeResult(null);
      setProcessingState("idle");
      return;
    }
    const base = createProcessingAsset(logo);
    setAsset(base);
    setIntakeStatus("analysing");
    setProcessingState("analysing");
    setIntakeResult(null);
    void analyseArtwork(logo)
      .then(async (result) => {
        if (generation !== generationRef.current) return;
        setIntakeResult(result);
        setIntakeStatus("complete");
        if (result.classification === "TransparentLogo") {
          const transparentAsset: ArtworkAsset = {
            ...base,
            preparation: {
              ...base.preparation,
              backgroundClassification: "transparent",
              status: "ready",
            },
          };
          setAsset(transparentAsset);
          setOutcome({
            status: "ready",
            confidence: result.confidence === "High" ? "high" : "medium",
            preparedArtwork: transparentAsset,
          });
          setProcessingState("ready");
          return;
        }
        const route = selectIntakeRoute(result);
        if (route === "open-crop") {
          setAsset({
            ...base,
            preparation: {
              ...base.preparation,
              status: "ready",
              message:
                "This image contains more than just a logo. Select the logo area.",
            },
          });
          setOutcome({
            status: "review-required",
            confidence: "medium",
            recommendedAction: "crop",
          });
          setCropOpen(false);
          setProcessingState("selecting");
          return;
        }
        if (route === "manual-review") {
          setAsset({
            ...base,
            preparation: {
              ...base.preparation,
              status: "ready",
              message: "We need a little help identifying your logo.",
            },
          });
          setOutcome({
            status: "review-required",
            confidence: "low",
            recommendedAction: "crop",
          });
          setProcessingState("selecting");
          return;
        }
        setProcessingState("preparing");
        try {
          await applyPreparation(
            logo,
            base,
            result.confidence === "High" ? "high" : "medium",
          );
        } catch {
          if (result.classification === "LogoOnPlainBackground") {
            setAsset({
              ...base,
              preparation: {
                ...base.preparation,
                status: "ready",
                message: "Select the area that contains your logo.",
              },
            });
            setOutcome({
              status: "review-required",
              confidence: "low",
              recommendedAction: "crop",
            });
            setProcessingState("selecting");
            return;
          }
          throw new Error("Automatic artwork preparation failed.");
        }
      })
      .catch(() => {
        if (generation !== generationRef.current) return;
        setIntakeStatus("error");
        setAsset({
          ...base,
          preparation: {
            ...base.preparation,
            status: "error",
            message: "We need a little help identifying your logo.",
          },
        });
        setOutcome({ status: "failed", recommendedAction: "crop" });
        setProcessingState("failed");
      });
    return () => {
      generationRef.current = generation + 1;
      revokeOwnedObjectUrl(preparedUrlRef);
      revokeOwnedObjectUrl(croppedUrlRef);
    };
  }, [applyPreparation, logo]);

  const confirmCrop = useCallback(
    async (selection: CropSelection) => {
      if (!logo) return;
      const generation = generationRef.current;
      setProcessingCrop(true);
      setProcessingState("cropping");
      setCropOpen(false);
      let cropped: CroppedArtwork | null = null;
      let croppedCandidate: ArtworkAsset | null = null;
      try {
        cropped = await createCroppedArtwork(logo, selection);
        if (generation !== generationRef.current) {
          URL.revokeObjectURL(cropped.objectUrl);
          return;
        }
        revokeOwnedObjectUrl(croppedUrlRef);
        croppedUrlRef.current = cropped.objectUrl;
        setCroppedArtwork(cropped);
        const base = createProcessingAsset(logo);
        croppedCandidate = {
          ...base,
          preparedUrl: cropped.objectUrl,
          printableUrl: cropped.objectUrl,
          preparedWidth: cropped.logo.width ?? 1,
          preparedHeight: cropped.logo.height ?? 1,
          foregroundBounds: {
            x: 0,
            y: 0,
            width: cropped.logo.width ?? 1,
            height: cropped.logo.height ?? 1,
          },
          preparation: {
            ...base.preparation,
            status: "processing",
            message: "Preparing your logo",
          },
        };
        setAsset(croppedCandidate);
        setShowOriginal(false);
        setProcessingState("preparing");
        await applyPreparation(cropped.logo, base, "medium");
      } catch {
        if (croppedCandidate) {
          const reviewCandidate = {
            ...croppedCandidate,
            preparation: {
              ...croppedCandidate.preparation,
              status: "error" as const,
              message: "Preparation failed. You can use the cropped area or adjust it.",
            },
          };
          setAsset(reviewCandidate);
          setOutcome({
            status: "review-required",
            confidence: "low",
            preparedCandidate: reviewCandidate,
            recommendedAction: "crop",
          });
          setProcessingState("failed");
        } else {
          setOutcome({ status: "failed", recommendedAction: "crop" });
          setProcessingState("failed");
        }
      } finally {
        if (generation === generationRef.current) setProcessingCrop(false);
      }
    },
    [applyPreparation, logo],
  );

  const printableArtwork = useMemo<PrintableArtwork | null>(() => {
    if (!asset) return null;
    const usable = isUsableArtworkCandidate(
      asset,
      intakeResult?.classification,
    );
    if (!usable && intakeResult?.classification !== "TransparentLogo") return null;
    return selectPrintableArtwork(asset, showOriginal);
  }, [asset, intakeResult, showOriginal]);
  const hasPreparedCandidate = isUsableArtworkCandidate(
    asset,
    intakeResult?.classification,
  );
  const customerState = mapCustomerArtworkState({
    hasUpload: Boolean(logo),
    processingState,
    cropOpen,
    hasPreparedCandidate,
  });

  useEffect(() => {
    if (process.env.NODE_ENV === "production" || !logo) return;
    console.debug("[artwork-orchestration]", logo.filename, {
      classification: intakeResult?.classification ?? null,
      confidence: intakeResult?.confidence ?? null,
      recommendedWorkflow: intakeResult?.recommendedWorkflow ?? null,
      preparationAttempted:
        processingState === "preparing" ||
        processingState === "ready" ||
        processingState === "needs-review" ||
        processingState === "failed",
      candidateProduced: Boolean(asset),
      candidateUsable: hasPreparedCandidate,
      internalPhase: processingState,
      originalUrl: asset?.originalUrl ?? logo.previewUrl,
      croppedUrl: croppedArtwork?.objectUrl ?? null,
      preparedUrl: asset?.preparedUrl ?? null,
      selectedArtworkUrl: printableArtwork?.url ?? null,
      selectedAssetType: showOriginal
        ? "original"
        : croppedArtwork && asset?.preparedUrl === croppedArtwork.objectUrl
          ? "cropped"
          : "prepared",
      customerState: customerState.status,
      errorReason:
        customerState.status === "error-recoverable"
          ? asset?.preparation.message ?? "Processing failed."
          : null,
    });
  }, [
    asset,
    croppedArtwork,
    customerState.status,
    hasPreparedCandidate,
    intakeResult,
    logo,
    processingState,
    printableArtwork,
    showOriginal,
  ]);

  return {
    asset,
    printableArtwork,
    showOriginal,
    setShowOriginal,
    intakeStatus,
    intakeResult,
    outcome,
    cropOpen,
    processingCrop,
    processingState,
    croppedArtwork,
    selectedArtworkUrl: printableArtwork?.url ?? null,
    customerState,
    requestCrop: () => {
      setCropOpen(true);
      setProcessingState("selecting");
    },
    cancelCrop: () => {
      setCropOpen(false);
      setProcessingState(outcome?.status === "review-required" ? "needs-review" : "ready");
    },
    confirmCrop,
  };
}
