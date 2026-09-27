# Project rules

- Keep OCR real and client-side; never replace it with mocked production behavior.
- Preserve original OCR text. Store corrections as separate values with timeline entries.
- Treat uncertainty, unreadable text, missing values, and not-applicable fields as review, not error.
- Government warning content is exact-match; typography remains a required visual confirmation.
- Run `npm test`, `npm run build`, and `npm run test:e2e` before delivery.
- Do not commit secrets, uploaded labels, local session data, or build output.
