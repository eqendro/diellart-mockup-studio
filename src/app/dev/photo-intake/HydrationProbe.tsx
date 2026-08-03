"use client";

import { useEffect, useState, type ChangeEvent } from "react";

type ProbeEvent = { type: string; detail: string };

export function HydrationProbe() {
  const [hydration, setHydration] = useState("React not hydrated");
  const [count, setCount] = useState(0);
  const [events, setEvents] = useState<ProbeEvent[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  const addEvent = (type: string, detail: string) =>
    setEvents((current) => [...current, { type, detail }]);

  useEffect(() => {
    queueMicrotask(() => setHydration("React hydrated"));
    const readErrors = () => {
      const recorded = (window as typeof window & { __diellartClientErrors?: string[] })
        .__diellartClientErrors ?? [];
      setErrors([...recorded]);
    };
    queueMicrotask(readErrors);
    window.addEventListener("diellart-client-error", readErrors);
    return () => window.removeEventListener("diellart-client-error", readErrors);
  }, []);

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    addEvent(
      "React file change",
      file
        ? `${file.name || "(no name)"}; ${file.type || "(no MIME)"}; ${file.size} bytes; ${file.lastModified}`
        : "no file",
    );
    event.currentTarget.value = "";
  };

  return (
    <section aria-labelledby="hydration-probe-heading" className="hydration-probe">
      <h2 id="hydration-probe-heading">React hydration probe</h2>
      <p data-testid="hydration-status">{hydration}</p>
      <button type="button" onClick={() => {
        setCount((value) => value + 1);
        addEvent("React click", "increment received");
      }}>
        Increment test
      </button>
      <output data-testid="hydration-count">{count}</output>
      <label htmlFor="react-text-probe">React text event</label>
      <input
        id="react-text-probe"
        type="text"
        onChange={(event) => addEvent("React text change", event.currentTarget.value)}
      />
      <label htmlFor="react-file-probe">React file event</label>
      <input id="react-file-probe" type="file" accept="image/*" onChange={handleFile} />
      <h3>Received React events</h3>
      <ol data-testid="react-events">
        {events.map((event, index) => <li key={`${event.type}-${index}`}>{event.type}: {event.detail}</li>)}
      </ol>
      <h3>Client runtime errors</h3>
      <pre id="early-client-errors" data-testid="client-errors">
        {errors.length ? errors.join("\n") : "No client runtime error recorded."}
      </pre>
    </section>
  );
}
