# Fix: Large File Import Hang + Version Display

## Problems
1. Importing large .xlsx files (8MB+) hangs indefinitely on "Reading file..."
2. Version in sidebar shows hardcoded value instead of actual app version

---

## Fix 1: Large File Import Hang

### Diagnosis
First, find the upload/step2 component:
```bash
find src -name "*.tsx" | xargs grep -l "Reading file\|readFile\|FileReader\|parseImport" 2>/dev/null
```

Then check how file reading currently works in that component.

### The Fix
The file must be read using Tauri's fs plugin (Rust-backed), NOT the browser
FileReader API or SheetJS directly from a File object.

Replace any `FileReader` or `file.arrayBuffer()` approach with:

```typescript
import { readFile } from "@tauri-apps/plugin-fs";
import { open } from "@tauri-apps/plugin-dialog";

// When user clicks to select file:
const paths = await open({
  multiple: true,
  filters: [{ name: "Excel", extensions: ["xlsx"] }],
});

if (!paths) return;
const filePaths = Array.isArray(paths) ? paths : [paths];

for (const filePath of filePaths) {
  setStatus("Reading file...");
  const bytes = await readFile(filePath); // Uint8Array, Rust-backed
  const fileName = filePath.split("/").pop() || filePath;
  const file = new File([bytes], fileName);
  await parseImportFile(file); // existing parse logic
}
```

For drag and drop, use Tauri's drag drop event (already may be implemented):
```typescript
import { getCurrentWebview } from "@tauri-apps/api/webview";

getCurrentWebview().onDragDropEvent((event) => {
  if (event.payload.type === "drop") {
    const paths = event.payload.paths.filter(p => p.endsWith(".xlsx"));
    // process each path with readFile() as above
  }
});
```

### Verify permissions in `src-tauri/capabilities/default.json`
Must include:
```json
"fs:allow-read-all",
"dialog:allow-open"
```

---

## Fix 2: Version Display in Sidebar

### Find the component
```bash
grep -rn "v1\.\|version" src/ --include="*.tsx" | grep -v "node_modules" | head -20
```

### Replace hardcoded version with dynamic Tauri version

```typescript
import { getVersion } from "@tauri-apps/api/app";
import { useEffect, useState } from "react";

const [appVersion, setAppVersion] = useState("...");

useEffect(() => {
  getVersion().then(v => setAppVersion(v));
}, []);

// In JSX replace hardcoded "v1.0.x" with:
<span>v{appVersion}</span>
```

---

## Version Bump
- `package.json`: bump to `1.0.6`
- `src-tauri/tauri.conf.json`: bump to `1.0.6`

## Build
```bash
npx tsc --noEmit
npm run tauri build
```

## Verification
1. Open app → sidebar shows `v1.0.6`
2. Import large TikTok existing DB file (8MB+) → completes within 30 seconds, no hang
3. Proceeds to Step 3 Mapping Preview normally
