# LabelCheck

LabelCheck is a local-first take-home prototype for comparing structured alcohol-label application data with one label image or a small batch. It performs real OCR in the browser with Tesseract.js, preserves original OCR output, applies field-specific comparison rules, and keeps a human-readable audit timeline.

- **Live application:** https://funny-croissant-812230.netlify.app/
- **Source repository:** https://github.com/thecraftman0369/treasury-label-verifier

## Run locally

Requirements: Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open the local URL shown by Vite. The first OCR run downloads English language data; later runs normally reuse the browser cache.

## Tests and production build

```bash
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

## Approach

The app runs OCR on-device, avoiding a backend and keeping uploaded images local. Users enter the approved application values once, add up to 12 label images, and process the batch sequentially so one failure does not stop other labels. Each label stores the label record, reference snapshot, extracted OCR text, optional corrected text, per-field verification state, resolution state, attempts, and timeline.

Comparison uses conservative rules. Case, accents, punctuation, repeated whitespace, and ampersands are normalized for ordinary fields. Net contents are converted to milliliters when possible. Government warning content is compared as exact text after line-break and repeated-whitespace normalization. Because OCR cannot prove font weight, the required styling rule—only `GOVERNMENT WARNING` is uppercase and bold—stays in review until a person checks the label image.

Statuses are:

- **Pass:** every applicable value matched and warning styling was confirmed.
- **Review:** any value is uncertain, unreadable, missing, deferred, or not applicable.
- **Error:** a readable value definitely differs, or warning text is readable and not exact.

## UX and recovery

The interface supports drag-and-drop or file selection, batch partial failure, manual text entry, deferral and resume, image replacement, session restoration with localStorage plus IndexedDB image storage, CSV export including unresolved records, English/Spanish navigation labels, keyboard focus states, text-plus-symbol status cues, contextual help, and frequent-issue reporting after five occurrences. After ten attempts, it strongly recommends manual entry or replacement.

## Performance

OCR speed depends on device, image size, and the one-time language download. Typical clear phone images on a modern laptop are expected to take roughly 2–8 seconds each after warm-up. The five-second target is plausible for moderate images but is not guaranteed. Batches process sequentially to control memory use.

## Assumptions and trade-offs

- This is a standalone prototype with device-local persistence rather than shared case management.
- Suggested pairing is the upload order against the active application reference; barcode presence is not interpreted or used as evidence.
- Browser OCR is private and easy to deploy, but less accurate than managed OCR services on curved, reflective, or ornate labels.
- Semantic normalization is intentionally narrow to avoid false passes.
- Spanish changes primary navigation and action labels; compliance field names and legal warning text remain English to avoid changing the reviewed legal content.

## Prototype limitations

- OCR cannot verify bold weight, font size, color contrast, physical dimensions, or which exact words are uppercase. A person must inspect styling.
- No authentication, shared database, cross-device resume, case assignment, or immutable server audit log.
- No image preprocessing beyond Tesseract defaults; severe glare, curvature, low resolution, and handwriting may be unreadable.
- Manual corrected text is compared as a whole-label transcription; per-field correction UI is not implemented.
- Barcode detection is not implemented because it is optional and not evidence of compliance.
- Device storage quotas and private-browsing policies can prevent or evict saved image data; text results and session records are retained separately when browser storage permits.

## Netlify deployment

The included `netlify.toml` uses `npm run build` and publishes `dist`. In Netlify, import the GitHub repository or run:

```bash
npx netlify login
npx netlify deploy --build --prod
```

No environment variables or secrets are required. Production uses the same real Tesseract.js OCR flow as local development.

## Important files

- `src/main.jsx` — workflow, batch processing, dashboard, audit timeline, session persistence
- `src/verification.js` — normalization and comparison rules
- `src/ocr.js` — real Tesseract worker
- `tests/verification.test.js` — core rule coverage including Old Tom Distillery
- `tests/e2e/workflow.spec.js` — browser workflow and no-state-loss check
- `netlify.toml` — production build and routing

## Tools

React, Vite, Tesseract.js, Vitest, Testing Library, Playwright, and Netlify configuration.
