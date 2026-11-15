"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icon";

type Size = "normal" | "large" | "xlarge";

const SIZES: Array<{ key: Size; label: string; hint: string }> = [
  { key: "normal", label: "A", hint: "Default text" },
  { key: "large", label: "A+", hint: "Larger text" },
  { key: "xlarge", label: "A++", hint: "Largest text" },
];

function persist(size: Size, contrast: boolean) {
  document.documentElement.dataset.textsize = size;
  document.documentElement.dataset.contrast = contrast ? "high" : "normal";
  const year = 60 * 60 * 24 * 365;
  document.cookie = `sahaay_textsize=${size};path=/;max-age=${year};samesite=lax`;
  document.cookie = `sahaay_contrast=${contrast ? "high" : "normal"};path=/;max-age=${year};samesite=lax`;
}

export function AccessibilityMenu() {
  const [size, setSize] = useState<Size>("normal");
  const [contrast, setContrast] = useState(false);

  useEffect(() => {
    const current = document.documentElement.dataset.textsize;
    setSize(current === "large" || current === "xlarge" ? current : "normal");
    setContrast(document.documentElement.dataset.contrast === "high");
  }, []);

  return (
    <details className="a11y">
      <summary>
        <Icon name="sparkle" size={17} />
        <span>Display &amp; reading</span>
      </summary>
      <div className="a11y-panel">
        <p className="tiny muted">Text size</p>
        <div className="seg" role="group" aria-label="Text size">
          {SIZES.map((option) => (
            <button
              key={option.key}
              type="button"
              aria-pressed={size === option.key}
              aria-label={option.hint}
              onClick={() => {
                setSize(option.key);
                persist(option.key, contrast);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="settings-row" style={{ padding: "12px 0 4px" }}>
          <span className="small">High contrast</span>
          <button
            type="button"
            className="switch"
            role="switch"
            aria-checked={contrast}
            aria-label="High contrast mode"
            onClick={() => {
              const next = !contrast;
              setContrast(next);
              persist(size, next);
            }}
          >
            <span />
          </button>
        </div>
      </div>
    </details>
  );
}
