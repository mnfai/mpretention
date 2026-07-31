import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";

/** Reads the app version from `tauri.conf.json` at runtime. */
export function useAppVersion(): string {
  const [version, setVersion] = useState("");

  useEffect(() => {
    getVersion().then(setVersion);
  }, []);

  return version;
}
