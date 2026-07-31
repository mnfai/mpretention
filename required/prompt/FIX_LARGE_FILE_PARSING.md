# Fix: Large File (.xlsx) Reading Hangs on Upload Step

## Problem

When importing large `.xlsx` files (8MB+, 30k+ rows), the app hangs
indefinitely on Step 2 "Reading file..." because the entire file is parsed
in the frontend (WebView/JavaScript), which cannot handle large files.

## Fix: Move File Parsing to Tauri Rust Backend

Instead of reading the file in JavaScript (Step2UploadFiles component),
pass the **file path** to a Tauri command that reads and parses it in Rust,
then returns the parsed data to the frontend.

---

## Implementation

### 1. Add Rust dependencies in `src-tauri/Cargo.toml`

```toml
[dependencies]
calamine = "0.24"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

### 2. Add Tauri command in `src-tauri/src/lib.rs`

```rust
use calamine::{open_workbook, Reader, Xlsx};
use serde_json::{json, Value};
use std::collections::HashMap;

#[tauri::command]
fn parse_xlsx(path: String) -> Result<Value, String> {
    let mut workbook: Xlsx<_> = open_workbook(&path)
        .map_err(|e| format!("Failed to open file: {}", e))?;

    let sheet_name = workbook.sheet_names()[0].clone();
    let range = workbook
        .worksheet_range(&sheet_name)
        .map_err(|e| format!("Failed to read sheet: {}", e))?;

    let mut rows: Vec<Vec<Value>> = Vec::new();
    for row in range.rows() {
        let cells: Vec<Value> = row.iter().map(|cell| {
            match cell {
                calamine::Data::String(s) => json!(s),
                calamine::Data::Float(f) => json!(f),
                calamine::Data::Int(i) => json!(i),
                calamine::Data::Bool(b) => json!(b),
                calamine::Data::DateTime(dt) => json!(dt.as_f64()),
                _ => Value::Null,
            }
        }).collect();
        rows.push(cells);
    }

    Ok(json!({
        "sheetName": sheet_name,
        "rows": rows
    }))
}
```

Register the command in the builder:
```rust
.invoke_handler(tauri::generate_handler![parse_xlsx, /* existing commands */])
```

### 3. Update `src/components/import/Step2UploadFiles.tsx`

Instead of using `FileReader` + SheetJS to parse in frontend, use the file
path to call the Tauri command:

```typescript
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

// When user selects file:
const filePath = await open({
  filters: [{ name: "Excel", extensions: ["xlsx"] }],
  multiple: false,
});

if (filePath) {
  setLoading(true);
  try {
    const result = await invoke("parse_xlsx", { path: filePath });
    // result contains { sheetName, rows }
    // Pass to Step 3 as before
  } catch (err) {
    setError(String(err));
  } finally {
    setLoading(false);
  }
}
```

### 4. Update `src-tauri/capabilities/default.json`

Add dialog plugin permission:
```json
{
  "permissions": [
    "dialog:allow-open",
    "fs:allow-read-all"
  ]
}
```

---

## Important Notes

- The existing SheetJS parsing logic in `src/lib/importer.ts` must be
  adapted to accept the data format returned by the Rust backend
- The `detectFileProfile` function needs to receive headers + sample rows
  in the same format as before
- Keep the existing frontend parsing as fallback for small files (<2MB)
- Progress indicator should show row count as Rust streams data back

## Simpler Alternative (if Rust approach is too complex)

Move only the **file reading** to backend, keep parsing in frontend:

```typescript
// Read file as base64 via Tauri fs plugin
import { readFile } from "@tauri-apps/plugin-fs";
const contents = await readFile(filePath);
// Then parse with SheetJS as before
const wb = XLSX.read(contents, { type: "array" });
```

This avoids the browser File API limitation while keeping existing
SheetJS parsing logic intact.

**Try the simpler alternative first.**

---

## Version Bump
`src-tauri/tauri.conf.json`: `1.0.4` → `1.0.5`
`package.json`: `1.0.4` → `1.0.5`

## Verification

1. Import file 8MB+ TikTok existing DB
2. Must complete Step 2 without hanging
3. Proceed to Step 3 Mapping Preview normally
4. Import completes successfully
