# Code editors (Monaco)

Every JSONata expression, GraphQL query and JSON schema in the designer sits in a
Monaco editor. Three things about it will corrupt your input or lie about what it
contains, and none of them announce themselves.

`window.monaco` is not exposed, and the editor instance is not reachable from the
`.monaco-editor` node's React fiber — a bounded search of props, state and the
hook chain found nothing. So you cannot relax its options. Work with it instead.

## Do not type into `textarea.inputarea`

It is hidden, and it only mirrors the text near the cursor. You can neither read
nor fill it directly.

## Typing: press Delete after every opener

**After typing any of `{ [ ( " ' \``, press `Delete`.**

Monaco auto-closes the pair. Inline pairs overtype cleanly, so short expressions
survive — but once a **newline** separates them, a typed `}` no longer overtypes
and merely adds another. That is what turns a 12-line query into one with four
stray closing braces, which then fails validation somewhere unrelated.

A forward `Delete` is safe because typing always happens at the end of the
buffer: the only thing to the cursor's right is the closer Monaco just inserted.

## Pasting: a synthetic ClipboardEvent, when the text is long

For anything substantial, skip typing. Expand the editor, click `.view-lines`,
select all, then dispatch a `ClipboardEvent('paste')` carrying a `DataTransfer`
with your text. This is also the only reliable way to place text containing
brackets and quotes, and it is what to reach for when a typed attempt has already
mangled the buffer once.

## Reading back: never scrape `.view-line`

**Monaco virtualises lines.** The DOM holds only the viewport, so a correct
12-line query reads back as its last 7 — and a diff against the intended text
then reports a failure that does not exist.

Round-trip through the clipboard instead: select-all, copy,
`navigator.clipboard.readText()`. Complete regardless of scroll. The context needs
`clipboard-read` and `clipboard-write` granted:

```
npx @playwright/mcp@latest --grant-permissions clipboard-read clipboard-write …
```

(The VS Code command already passes these.) In a `run` script:
`await ctx.grantPermissions(['clipboard-read', 'clipboard-write'])`.

## Comparing: ignore whitespace, keep braces

Monaco's auto-indent reflows leading spaces. That is cosmetic in both GraphQL and
JSONata, so compare whitespace-insensitively — but do **not** normalise away
brackets or quotes, because a stray brace is exactly the failure this check
exists to catch.

## The schema builder that eats your JSON

A flow's **MCP Tool Configuration → inputSchema** is a structured *builder* whose
`code` button toggles a Monaco JSON view. Three problems compound:

1. The toggle's state **persists between visits**, so a blind click flips an
   already-open editor back to the builder.
2. Text typed into that view **does not reach the form model**.
3. Saving then writes `null` straight over an existing schema.

Write it over the API:
`updateDataFlow(payload:[{ where:{id}, update:{ mcpToolConfiguration:{…} } }])`.

## The dialog Playwright cannot dismiss

The designer's own "unsaved changes" prompt is a **MUI dialog at z-index 1300**,
not a native one — `browser_handle_dialog` cannot clear it, and it blocks every
click underneath while looking like nothing is wrong. Click its check-icon button.
