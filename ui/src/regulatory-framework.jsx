import { useEffect, useState } from "react";

function RegulatoryLine({ line, index }) {
  const trimmed = line.trim();
  if (!trimmed) return <div className="regulatory-spacer" aria-hidden="true" />;
  if (trimmed === "---") return <hr className="regulatory-rule" />;
  if (trimmed.startsWith("· ")) return <div className="regulatory-bullet"><span aria-hidden="true">•</span><span>{trimmed.slice(2)}</span></div>;
  if (/^\d+\.\s+[A-Z]/.test(trimmed)) return <h2>{trimmed}</h2>;
  if (/^\d+\.\d+\s+/.test(trimmed)) return <h3>{trimmed}</h3>;
  if (/^(P-\d{3}|Gate \d+|Layer \d+|CV-[A-Z]+-\d{3}|C-\d{3}|A\.\d+|\d+\s+—)/.test(trimmed)) return <h4>{trimmed}</h4>;
  if (/^\d+\.\s+/.test(trimmed)) return <div className="regulatory-numbered">{trimmed}</div>;
  if (/^(IMPORTANT BOUNDARY|Claim-Free \/ Evidence-Based Working Document|END OF DOCUMENT)$/.test(trimmed)) return <div className="regulatory-callout-title">{trimmed}</div>;
  return <p key={index}>{line}</p>;
}

export default function RegulatoryFramework() {
  const [documentText, setDocumentText] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/cv11-iso42001-working-document.txt", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("The working document could not be loaded.");
        return response.text();
      })
      .then((text) => { if (active) setDocumentText(text); })
      .catch((failure) => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, []);

  return <article className="regulatory-document" aria-label="CV 1.1 ISO IEC 42001 working implementation framework">
    <header className="regulatory-document-header">
      <div className="eyebrow">Regulatory Framework · Working document</div>
      <h2>CV 1.1 — ISO/IEC 42001 AIMS Implementation, Audit Map, and Contract Register</h2>
      <p>Claim-Free / Evidence-Based Working Document</p>
    </header>
    {error && <div className="notice error-notice">{error}</div>}
    {!documentText && !error && <div className="regulatory-loading">Loading working document…</div>}
    <div className="regulatory-document-body">{documentText.split(/\r?\n/).map((line, index) => <RegulatoryLine line={line} index={index} key={index} />)}</div>
  </article>;
}
