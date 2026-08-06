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
  createExtractedLogo,
  createExtractionCandidates,
  type ExtractionMode,
} from "@/features/artwork-intake";
import { prepareArtwork } from "@/features/logo-engine/preparation/prepare-artwork";
import {
  createProcessingAsset,
  revokeOwnedObjectUrl,
  selectPrintableArtwork,
} from "@/features/logo-engine/preparation/artwork-state";
import type { ArtworkAsset, PrintableArtwork } from "@/features/logo-engine/types/artwork";
import type { AcceptedLogo } from "@/features/upload/types/logo-upload";
import { planCandidateReview } from "@/features/artwork-intake/candidate-review";

export type ArtworkIntakeStatus = "idle" | "analysing" | "complete" | "error";
export type ArtworkProcessingState =
  | "idle"
  | "analysing"
  | "selecting"
  | "cropping"
  | "preparing"
  | "ready"
  | "needs-review"
  | "reviewing-extraction"
  | "failed";

export function usePreparedArtwork(
  logo: AcceptedLogo | null,
  recordTrace?: (stage: string, detail?: string, status?: "ok" | "info" | "error") => void,
) {
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
  const [extractionMode, setExtractionMode] = useState<ExtractionMode>("dark-on-light");
  const [extractionMessage, setExtractionMessage] = useState<string | null>(null);
  const [extractionCandidates, setExtractionCandidates] = useState<Array<{
    id: ExtractionMode; url: string; blob: Blob; bounds: { x: number; y: number; width: number; height: number }; confidence: number;
  }>>([]);
  const preparedUrlRef = useRef<string | null>(null);
  const croppedUrlRef = useRef<string | null>(null);
  const candidateUrlsRef = useRef<string[]>([]);
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
      if (!result.backgroundRemoved) {
        throw new Error("No clean foreground separation was produced.");
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
    candidateUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    candidateUrlsRef.current = [];
    // A new source invalidates every derived candidate and selection.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowOriginal(false);
    setCropOpen(false);
    setOutcome(null);
    setProcessingCrop(false);
    setCroppedArtwork(null);
    setExtractionMessage(null);
    setExtractionCandidates([]);
    if (!logo) {
      setAsset(null);
      setIntakeStatus("idle");
      setIntakeResult(null);
      setProcessingState("idle");
      return;
    }
    const base = createProcessingAsset(logo);
    recordTrace?.("analysis started", logo.filename);
    setAsset(base);
    setIntakeStatus("analysing");
    setProcessingState("analysing");
    setIntakeResult(null);
    void analyseArtwork(logo)
      .then(async (result) => {
        if (generation !== generationRef.current) {
          recordTrace?.("processing skipped", "STALE_ANALYSIS_TOKEN", "error");
          return;
        }
        setIntakeResult(result);
        setIntakeStatus("complete");
        if (result.classification === "TransparentLogo") {
          recordTrace?.("final route", "automatic preparation: transparent artwork");
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
        recordTrace?.(
          "final route",
          route === "prepare-automatically"
            ? "automatic preparation"
            : route === "open-crop"
              ? "crop or assisted extraction"
              : "recoverable manual assistance",
        );
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
          setAsset({ ...base, preparation: { ...base.preparation, status: "ready", message: "Select the area that contains your logo." } });
          setOutcome({ status: "review-required", confidence: "low", recommendedAction: "crop" });
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
      .catch((cause) => {
        if (generation !== generationRef.current) return;
        recordTrace?.("analysis failed", cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause), "error");
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
      candidateUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      candidateUrlsRef.current = [];
    };
  }, [applyPreparation, logo, recordTrace]);

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
        const candidates = await createExtractionCandidates(cropped.logo);
        if (generation !== generationRef.current) return;
        candidateUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
        const visualCandidates = candidates.map((candidate) => ({
          id: candidate.id,
          url: URL.createObjectURL(candidate.blob),
          blob: candidate.blob,
          bounds: candidate.validation.bounds!,
          confidence: candidate.confidence,
        }));
        candidateUrlsRef.current = visualCandidates.map((candidate) => candidate.url);
        const reviewPlan = planCandidateReview(
          visualCandidates,
          new URLSearchParams(window.location.search).get("debugUpload") === "1",
        );
        if (reviewPlan.mode === "auto-select") {
          const selected = reviewPlan.candidates[0];
          setExtractionCandidates([]);
          setExtractionMessage(null);
          setAsset({
            ...createProcessingAsset(logo),
            preparedUrl: selected.url,
            printableUrl: selected.url,
            preparedWidth: cropped.logo.width ?? 1,
            preparedHeight: cropped.logo.height ?? 1,
            foregroundBounds: selected.bounds,
            preparation: { backgroundRemoved: true, marginsCropped: false, backgroundClassification: "transparent", status: "ready" },
          });
          setProcessingState("ready");
        } else {
          setExtractionCandidates(reviewPlan.candidates);
          setExtractionMessage(
            reviewPlan.mode === "tighter-selection"
              ? "We could not separate the logo confidently. Try selecting a tighter area."
              : null,
          );
          setAsset(createProcessingAsset(logo));
          setProcessingState("reviewing-extraction");
        }
      } catch {
        if (croppedCandidate) {
          // A crop is only a region of interest, never proof-ready artwork.
          // Keep the last valid asset and route to assisted separation.
          setAsset({
            ...createProcessingAsset(logo),
            preparation: {
              ...createProcessingAsset(logo).preparation,
              status: "error",
              message: "The logo still needs separating from its background.",
            },
          });
          setOutcome({
            status: "review-required",
            confidence: "low",
            recommendedAction: "crop",
          });
          setProcessingState("needs-review");
        } else {
          setOutcome({ status: "failed", recommendedAction: "crop" });
          setProcessingState("failed");
        }
      } finally {
        if (generation === generationRef.current) setProcessingCrop(false);
      }
    },
    [logo],
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

  const previewExtraction = useCallback(async (
    mode: ExtractionMode,
    selected?: readonly [number, number, number],
  ) => {
    if (!croppedArtwork) return;
    setExtractionMode(mode);
    setExtractionMessage(null);
    setProcessingState("preparing");
    const result = await createExtractedLogo(croppedArtwork.logo, mode, selected);
    if (!result.validation.valid || !result.validation.bounds) {
      setExtractionMessage(result.validation.reason);
      setProcessingState("needs-review");
      return;
    }
    const url = URL.createObjectURL(result.blob);
    revokeOwnedObjectUrl(preparedUrlRef);
    preparedUrlRef.current = url;
    const base = createProcessingAsset(logo!);
    const extractedAsset: ArtworkAsset = {
      ...base,
      preparedUrl: url,
      printableUrl: url,
      preparedWidth: croppedArtwork.logo.width ?? 1,
      preparedHeight: croppedArtwork.logo.height ?? 1,
      foregroundBounds: result.validation.bounds,
      preparation: {
        backgroundRemoved: true,
        marginsCropped: false,
        backgroundClassification: "transparent",
        status: "ready",
      },
    };
    setAsset(extractedAsset);
    setOutcome({
      status: "review-required",
      confidence: "medium",
      preparedCandidate: extractedAsset,
      recommendedAction: "confirm",
    });
    setProcessingState("reviewing-extraction");
  }, [croppedArtwork, logo]);
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
    extractionMode,
    extractionMessage,
    extractionCandidates,
    previewExtraction,
    acceptExtraction: (id?: string) => {
      const selected = extractionCandidates.find((candidate) => candidate.id === id) ?? extractionCandidates[0];
      if (!selected || !logo || !croppedArtwork) return;
      const base = createProcessingAsset(logo);
      setAsset({
        ...base,
        preparedUrl: selected.url,
        printableUrl: selected.url,
        preparedWidth: croppedArtwork.logo.width ?? 1,
        preparedHeight: croppedArtwork.logo.height ?? 1,
        foregroundBounds: selected.bounds,
        preparation: { backgroundRemoved: true, marginsCropped: false, backgroundClassification: "transparent", status: "ready" },
      });
      setProcessingState("ready");
    },
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
