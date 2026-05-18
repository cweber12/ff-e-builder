# Style Audit Prompt for Coding Agent

Before making UI changes, do an automated style usage audit so you do not need to manually scan the full codebase.

Create a temporary `.style-audit/` folder and generate reports for:

1. All CSS files and selectors.
2. All `className`, `class`, `styles.*`, `clsx`, `cn`, `cva`, and template-literal class usage.
3. Shared primitives/components that appear most often.
4. Page-specific CSS files or components with one-off styling.
5. Duplicate color, spacing, border, shadow, radius, and typography values.
6. Unused or likely-unused selectors.
7. Dynamic className hotspots that static tools may not understand.

## Suggested commands

Run these from the project root:

```bash
mkdir -p .style-audit

rg -n "className=|class=|styles\.|clsx\(|cn\(|cva\(" src > .style-audit/class-usages.txt

rg -n "\.[a-zA-Z0-9_-]+|--[a-zA-Z0-9_-]+|#[0-9a-fA-F]{3,8}|rgb\(|hsl\(" src --glob "*.{css,scss,tsx,ts,jsx,js}" > .style-audit/style-tokens-and-selectors.txt

npx purgecss \
  --css "src/**/*.css" \
  --content "index.html" "src/**/*.{ts,tsx,js,jsx,html}" \
  --rejected \
  --rejected-css \
  > .style-audit/purgecss-report.txt

npx knip --reporter markdown > .style-audit/knip-report.md

npx stylelint "src/**/*.{css,scss}" --formatter verbose > .style-audit/stylelint-report.txt
```

If any command fails because the package is not installed or the project does not use that tool, record the failure in `.style-audit/notes.md` and continue with the available scans.

## Important warning

Do not automatically delete styles only because they appear unused in a static scan.

React apps often use dynamic classes through:

- `clsx`
- `cn`
- `cva`
- template literals
- conditional class strings
- CSS modules
- component props
- library-generated class names

Treat these as manual-review areas. Mark them as `dynamic / needs review`, not as safe-to-delete.

## Audit summary to produce before editing

After the audit, summarize:

1. Which shared primitives control the most UI.
2. Which pages have the most one-off styling.
3. Which CSS selectors appear unused or duplicated.
4. Which styles should become design tokens.
5. Which styling patterns are inconsistent across pages.
6. Which changes should be global vs page-specific.
7. Which files should be changed first for maximum impact.
8. Which files should not be touched during this pass.

## Required output before implementation

Before editing, provide a short implementation plan with:

- Global token changes
- Shared primitive changes
- Page-specific polish changes
- Risks / dynamic styling areas
- Verification commands to run afterward

Only begin the UI update after the audit and plan are complete.
