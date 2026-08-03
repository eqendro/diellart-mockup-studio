"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";

type FileDetails = {
  name: string;
  type: string;
  size: number;
  lastModified: number;
};

type RuntimeDetails = {
  userAgent: string;
  browserName: string;
  browserVersion: string;
  androidVersion: string;
  createImageBitmap: boolean;
  fileReader: boolean;
  createObjectUrl: boolean;
  offscreenCanvas: boolean;
  imageDecoder: boolean;
};

type ByteDetails = {
  fileSize: number;
  byteLength: number;
  sizesMatch: boolean;
  firstBytes: string;
  lastBytes: string;
  startsWithJpeg: boolean;
  endsWithJpeg: boolean;
  containsJfif: boolean;
  containsExif: boolean;
};

const errorText = (error: unknown) =>
  error instanceof Error ? `${error.name}: ${error.message}` : String(error);

const yesNo = (value: boolean) => (value ? "Yes" : "No");

const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0").toUpperCase()).join(" ");

const containsAscii = (bytes: Uint8Array, text: string) => {
  const target = Array.from(text, (character) => character.charCodeAt(0));
  return bytes.some((_, start) =>
    start + target.length <= bytes.length
    && target.every((value, offset) => bytes[start + offset] === value));
};

const runtimeDetails = (): RuntimeDetails => {
  const userAgent = navigator.userAgent;
  const browserMatch = userAgent.match(/SamsungBrowser\/([\d.]+)/)
    ?? userAgent.match(/EdgA?\/([\d.]+)/)
    ?? userAgent.match(/CriOS\/([\d.]+)/)
    ?? userAgent.match(/Chrome\/([\d.]+)/)
    ?? userAgent.match(/Firefox\/([\d.]+)/)
    ?? userAgent.match(/Version\/([\d.]+).*Safari/);
  const browserName = userAgent.includes("SamsungBrowser")
    ? "Samsung Internet"
    : userAgent.includes("Edg")
      ? "Microsoft Edge"
      : userAgent.includes("CriOS") || userAgent.includes("Chrome")
        ? "Chrome"
        : userAgent.includes("Firefox")
          ? "Firefox"
          : userAgent.includes("Safari")
            ? "Safari"
            : "Unknown";

  return {
    userAgent,
    browserName,
    browserVersion: browserMatch?.[1] ?? "Unknown",
    androidVersion: userAgent.match(/Android\s+([\d.]+)/)?.[1] ?? "Not available",
    createImageBitmap: "createImageBitmap" in window,
    fileReader: "FileReader" in window,
    createObjectUrl: typeof URL.createObjectURL === "function",
    offscreenCanvas: "OffscreenCanvas" in window,
    imageDecoder: "ImageDecoder" in window,
  };
};

export default function RawImageTestClient() {
  const [javaScriptStatus, setJavaScriptStatus] = useState("JavaScript has not started");
  const [counter, setCounter] = useState(0);
  const [globalErrors, setGlobalErrors] = useState<string[]>([]);
  const [runtimeStatus, setRuntimeStatus] = useState("Runtime diagnostics pending");
  const [runtime, setRuntime] = useState<RuntimeDetails | null>(null);
  const [details, setDetails] = useState<FileDetails | null>(null);
  const [dimensions, setDimensions] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [dataStatuses, setDataStatuses] = useState<string[]>([]);
  const [byteDetails, setByteDetails] = useState<ByteDetails | null>(null);
  const [byteStatuses, setByteStatuses] = useState<string[]>([]);
  const activeUrlRef = useRef<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageHostRef = useRef<HTMLDivElement>(null);
  const dataImageHostRef = useRef<HTMLDivElement>(null);
  const dataCanvasHostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reportError = (message: string) =>
      setGlobalErrors((current) => [...current, message]);
    const handleWindowError = (event: ErrorEvent) => {
      reportError(`window.error: ${event.error ? errorText(event.error) : event.message}`);
    };
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      reportError(`unhandledrejection: ${errorText(event.reason)}`);
    };

    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    queueMicrotask(() => {
      setJavaScriptStatus("JavaScript is running");
      try {
        setRuntime(runtimeDetails());
        setRuntimeStatus("Runtime diagnostics ready");
      } catch (error) {
        setRuntimeStatus(`Runtime diagnostics failed: ${errorText(error)}`);
        reportError(`Runtime diagnostics failed: ${errorText(error)}`);
      }
    });

    return () => {
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      if (activeUrlRef.current) URL.revokeObjectURL(activeUrlRef.current);
    };
  }, []);

  const addStatus = (status: string) =>
    setStatuses((current) => [...current, status]);
  const addDataStatus = (status: string) =>
    setDataStatuses((current) => [...current, status]);
  const addByteStatus = (status: string) =>
    setByteStatuses((current) => [...current, status]);

  const runDataUrlTest = async (file: File) => {
    try {
      addDataStatus("FileReader started");
      const dataUrl = await new Promise<string>((resolve, reject) => {
        try {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === "string") resolve(reader.result);
            else reject(new Error("FileReader returned a non-string result."));
          };
          reader.onerror = () => reject(reader.error ?? new Error("FileReader failed."));
          reader.onabort = () => reject(new Error("FileReader was aborted."));
          reader.readAsDataURL(file);
        } catch (error) {
          reject(error);
        }
      });

      addDataStatus("FileReader completed");
      addDataStatus(`Data URL length: ${dataUrl.length}`);
      addDataStatus(`Data URL prefix: ${dataUrl.slice(0, 96)}`);

      const image = new Image();
      image.alt = "Selected file loaded from a Data URL";
      image.style.display = "block";
      image.style.maxWidth = "100%";
      dataImageHostRef.current?.appendChild(image);

      await new Promise<void>((resolve, reject) => {
        image.onload = () => {
          addDataStatus("Data URL image loaded");
          addDataStatus(`naturalWidth: ${image.naturalWidth}`);
          addDataStatus(`naturalHeight: ${image.naturalHeight}`);
          resolve();
        };
        image.onerror = () => {
          addDataStatus("Data URL image failed");
          reject(new Error("The Data URL image fired img.onerror."));
        };
        try {
          image.src = dataUrl;
        } catch (error) {
          reject(error);
        }
      });

      try {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        canvas.style.display = "block";
        canvas.style.maxWidth = "100%";
        canvas.style.marginTop = "16px";
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas 2D context is unavailable.");
        context.drawImage(image, 0, 0);
        dataCanvasHostRef.current?.appendChild(canvas);
        addDataStatus("Canvas draw succeeded");
      } catch (error) {
        addDataStatus(`Canvas draw failed: ${errorText(error)}`);
      }
    } catch (error) {
      addDataStatus(`Error: ${errorText(error)}`);
    }
  };

  const runByteIntegrityTest = async (file: File) => {
    try {
      addByteStatus("arrayBuffer started");
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      setByteDetails({
        fileSize: file.size,
        byteLength: buffer.byteLength,
        sizesMatch: file.size === buffer.byteLength,
        firstBytes: hex(bytes.slice(0, 32)),
        lastBytes: hex(bytes.slice(Math.max(0, bytes.length - 32))),
        startsWithJpeg: bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8,
        endsWithJpeg: bytes.length >= 2
          && bytes[bytes.length - 2] === 0xff
          && bytes[bytes.length - 1] === 0xd9,
        containsJfif: containsAscii(bytes, "JFIF"),
        containsExif: containsAscii(bytes, "Exif"),
      });
      addByteStatus("arrayBuffer completed");
    } catch (error) {
      addByteStatus(`arrayBuffer failed: ${errorText(error)}`);
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.currentTarget.files?.[0];
      setStatuses(["React file change received"]);
      if (!file) {
        addStatus("React file change received, but no File was present");
        return;
      }

      if (activeUrlRef.current) {
        URL.revokeObjectURL(activeUrlRef.current);
        activeUrlRef.current = null;
      }

      addStatus("File received");
      setDataStatuses([]);
      setByteStatuses([]);
      setByteDetails(null);
      setDetails({
        name: file.name,
        type: file.type,
        size: file.size,
        lastModified: file.lastModified,
      });
      setDimensions(null);
      imageHostRef.current?.replaceChildren();
      dataImageHostRef.current?.replaceChildren();
      dataCanvasHostRef.current?.replaceChildren();

      try {
        addStatus("Object URL test started");
        const objectUrl = URL.createObjectURL(file);
        activeUrlRef.current = objectUrl;
        addStatus("Object URL created");

      const image = new Image();
      image.alt = "Selected raw file";
      image.style.display = "block";
      image.style.maxWidth = "100%";
      imageHostRef.current?.appendChild(image);
      image.onload = () => {
        try {
          addStatus("img.onload fired");
          addStatus(`naturalWidth: ${image.naturalWidth}`);
          addStatus(`naturalHeight: ${image.naturalHeight}`);
          setDimensions(`${image.naturalWidth} × ${image.naturalHeight}`);

          try {
            const canvas = canvasRef.current;
            if (!canvas) throw new Error("Canvas element is unavailable.");
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;
            const context = canvas.getContext("2d");
            if (!context) throw new Error("Canvas 2D context is unavailable.");
            context.drawImage(image, 0, 0);
            addStatus("Canvas draw succeeded");
          } catch (error) {
            addStatus(`Canvas draw failed: ${errorText(error)}`);
          }
        } catch (error) {
          addStatus(`img.onload handler failed: ${errorText(error)}`);
        } finally {
          URL.revokeObjectURL(objectUrl);
          if (activeUrlRef.current === objectUrl) activeUrlRef.current = null;
        }
      };
      image.onerror = () => {
        try {
          addStatus("img.onerror fired");
        } catch (error) {
          addStatus(`img.onerror handler failed: ${errorText(error)}`);
        } finally {
          URL.revokeObjectURL(objectUrl);
          if (activeUrlRef.current === objectUrl) activeUrlRef.current = null;
        }
      };
      image.src = objectUrl;
      } catch (error) {
        addStatus(`Object URL test failed: ${errorText(error)}`);
      }

      void runDataUrlTest(file);
      void runByteIntegrityTest(file);
    } catch (error) {
      const message = `React file handler failed: ${errorText(error)}`;
      setStatuses((current) => [...current, message]);
      setGlobalErrors((current) => [...current, message]);
    }
  };

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: 24, fontFamily: "sans-serif" }}>
      <h1>Raw Android image test</h1>

      <p aria-live="polite">{javaScriptStatus}</p>
      <button type="button" onClick={() => setCounter((current) => current + 1)}>
        Increment test
      </button>
      <p>Counter: {counter}</p>

      <h2>Global errors</h2>
      {globalErrors.length > 0 ? (
        <ol aria-live="assertive">
          {globalErrors.map((error, index) => <li key={`${index}-${error}`}>{error}</li>)}
        </ol>
      ) : <p>No global errors reported.</p>}

      <h2>Runtime diagnostics</h2>
      <p aria-live="polite">{runtimeStatus}</p>
      {runtime ? (
        <dl>
          <dt>User Agent</dt><dd style={{ overflowWrap: "anywhere" }}>{runtime.userAgent}</dd>
          <dt>Browser name</dt><dd>{runtime.browserName}</dd>
          <dt>Browser version</dt><dd>{runtime.browserVersion}</dd>
          <dt>Android version</dt><dd>{runtime.androidVersion}</dd>
          <dt>createImageBitmap exists</dt><dd>{yesNo(runtime.createImageBitmap)}</dd>
          <dt>FileReader exists</dt><dd>{yesNo(runtime.fileReader)}</dd>
          <dt>URL.createObjectURL exists</dt><dd>{yesNo(runtime.createObjectUrl)}</dd>
          <dt>OffscreenCanvas exists</dt><dd>{yesNo(runtime.offscreenCanvas)}</dd>
          <dt>ImageDecoder exists</dt><dd>{yesNo(runtime.imageDecoder)}</dd>
        </dl>
      ) : null}

      <p>Select one untouched image file to run all three independent tests.</p>
      <input type="file" accept="image/*" onChange={handleFileChange} />

      {details ? (
        <dl>
          <dt>Filename</dt><dd>{details.name}</dd>
          <dt>MIME type</dt><dd>{details.type || "(empty)"}</dd>
          <dt>Size</dt><dd>{details.size} bytes</dd>
          <dt>lastModified</dt><dd>{details.lastModified}</dd>
        </dl>
      ) : null}

      <section>
        <h2>Object URL test</h2>
        <p>Natural dimensions: {dimensions ?? "Waiting for image load"}</p>
        <ol aria-live="polite">
          {statuses.map((status, index) => <li key={`${index}-${status}`}>{status}</li>)}
        </ol>
        <div ref={imageHostRef} />
        <canvas ref={canvasRef} style={{ display: "block", maxWidth: "100%", marginTop: 16 }} />
      </section>

      <section>
        <h2>Data URL test</h2>
        <ol aria-live="polite">
          {dataStatuses.map((status, index) => <li key={`${index}-${status}`}>{status}</li>)}
        </ol>
        <div ref={dataImageHostRef} />
        <div ref={dataCanvasHostRef} />
      </section>

      <section>
        <h2>Raw byte integrity</h2>
        {byteDetails ? (
          <dl>
            <dt>File.size</dt><dd>{byteDetails.fileSize}</dd>
            <dt>arrayBuffer.byteLength</dt><dd>{byteDetails.byteLength}</dd>
            <dt>Sizes match</dt><dd>{yesNo(byteDetails.sizesMatch)}</dd>
            <dt>First 32 bytes (hex)</dt><dd style={{ overflowWrap: "anywhere" }}>{byteDetails.firstBytes}</dd>
            <dt>Last 32 bytes (hex)</dt><dd style={{ overflowWrap: "anywhere" }}>{byteDetails.lastBytes}</dd>
            <dt>Starts with FF D8?</dt><dd>{yesNo(byteDetails.startsWithJpeg)}</dd>
            <dt>Ends with FF D9?</dt><dd>{yesNo(byteDetails.endsWithJpeg)}</dd>
            <dt>Contains JFIF?</dt><dd>{yesNo(byteDetails.containsJfif)}</dd>
            <dt>Contains Exif?</dt><dd>{yesNo(byteDetails.containsExif)}</dd>
          </dl>
        ) : null}
        <ol aria-live="polite">
          {byteStatuses.map((status, index) => <li key={`${index}-${status}`}>{status}</li>)}
        </ol>
      </section>
    </main>
  );
}
