# MPRetention — Build .deb on Home Laptop

**Project Path:** `/home/mnfai/Documents/Claude/MPRetention/mpretention`

---

## Read First
1. `required/CONTEXT.md`
2. `required/PRD/PRD.md`

---

## Environment Check

Before building, verify environment:

```bash
cd /home/mnfai/Documents/Claude/MPRetention/mpretention

# Check Node
node --version   # Must be 18+

# Check Rust
rustc --version  # Must be installed

# Check Tauri CLI
npx tauri --version
```

If Rust not installed:
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env
```

If missing system dependencies (Ubuntu/Debian):
```bash
sudo apt update
sudo apt install -y libwebkit2gtk-4.1-dev libssl-dev libgtk-3-dev \
  libayatana-appindicator3-dev librsvg2-dev patchelf
```

---

## Build Steps

### Step 1 — Install dependencies
```bash
cd /home/mnfai/Documents/Claude/MPRetention/mpretention
npm install
```

### Step 2 — Type check (verify no errors)
```bash
npx tsc --noEmit
```

### Step 3 — Build .deb
```bash
npm run tauri build
```

### Step 4 — Verify output
```bash
ls -lh src-tauri/target/release/bundle/deb/
```

### Step 5 — Copy to easy location
```bash
cp src-tauri/target/release/bundle/deb/MPRetention_*.deb /tmp/mpretention.deb
echo "Build complete: /tmp/mpretention.deb"
```

---

## Expected Output

```
src-tauri/target/release/bundle/deb/MPRetention_1.0.3_amd64.deb
```

File size: ~6-10MB

---

## Common Issues

| Error | Fix |
|---|---|
| `error: linker 'cc' not found` | `sudo apt install build-essential` |
| `webkit2gtk not found` | `sudo apt install libwebkit2gtk-4.1-dev` |
| `EACCES npm error` | `sudo chown -R mnfai:mnfai /home/mnfai/Documents/Claude/MPRetention/mpretention` |
| `rust not found` | `source ~/.cargo/env` then retry |
| `failed to compile` | `rm -rf src-tauri/target` then retry build |

---

## Install on This Machine (Optional)

```bash
sudo dpkg -i /tmp/mpretention.deb
mpretention
```

---

## After Build

Report back:
- [ ] `.deb` file created successfully
- [ ] File size and exact filename
- [ ] Any errors encountered
