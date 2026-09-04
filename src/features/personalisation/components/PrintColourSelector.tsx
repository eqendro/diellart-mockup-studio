"use client";

import {
  PRINT_COLOURS,
  type PrintColourKey,
} from "@/features/logo-engine/monochrome/config";

type PrintColourSelectorProps = {
  detectedColour: string;
  selection: PrintColourKey;
  onChange: (selection: PrintColourKey) => void;
  compact?: boolean;
};

export function PrintColourSelector({
  detectedColour,
  selection,
  onChange,
  compact = false,
}: PrintColourSelectorProps) {
  const options: Array<{ key: PrintColourKey; label: string; colour: string }> = [
    { key: "brand", label: "Detected colour", colour: detectedColour },
    { key: "black", label: "Black", colour: PRINT_COLOURS.black },
    { key: "blue", label: "Blue", colour: PRINT_COLOURS.blue },
    { key: "green", label: "Green", colour: PRINT_COLOURS.green },
  ];

  return (
    <fieldset
      className={`print-colour-selector ${
        compact ? "print-colour-selector-compact" : ""
      }`.trim()}
    >
      <legend className={compact ? "sr-only" : undefined}>Print colour</legend>
      <p className="print-colour-supporting">
        Select how your logo will be printed.
      </p>
      <div className="print-colour-options">
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            className="print-colour-option"
            aria-label={option.label}
            aria-pressed={selection === option.key}
            onClick={() => onChange(option.key)}
          >
            <span
              className="print-colour-swatch"
              style={{ backgroundColor: option.colour }}
              aria-hidden="true"
            />
            <span>{option.label}</span>
            <span className="print-colour-check" aria-hidden="true">
              {selection === option.key ? "✓" : ""}
            </span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
