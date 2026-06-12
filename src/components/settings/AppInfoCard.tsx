import { useEffect, useState } from "react";
import { size } from "@tauri-apps/plugin-fs";
import { Copy, Check } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/selia/card";
import { Button } from "@/components/selia/button";
import { getDbFilePath, getTransactionCount } from "@/lib/db";
import { formatNumber } from "@/lib/formatters";

const APP_VERSION = "v1.0.3";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export function AppInfoCard() {
  const [dbPath, setDbPath] = useState("");
  const [dbSize, setDbSize] = useState<number | null>(null);
  const [txCount, setTxCount] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const path = await getDbFilePath();
      setDbPath(path);
      setDbSize(await size(path));
      setTxCount(await getTransactionCount());
    })();
  }, []);

  async function handleCopy() {
    await navigator.clipboard.writeText(dbPath);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>App Info</CardTitle>
      </CardHeader>
      <CardBody className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted">Version</span>
          <span>{APP_VERSION}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted">Database Path</span>
          <div className="flex items-center gap-2 overflow-hidden">
            <code className="truncate rounded bg-code px-2 py-1 text-xs">{dbPath}</code>
            <Button variant="plain" size="xs-icon" onClick={handleCopy}>
              {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted">Database Size</span>
          <span>{dbSize !== null ? formatBytes(dbSize) : "—"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted">Total Transactions</span>
          <span>{formatNumber(txCount)}</span>
        </div>
      </CardBody>
    </Card>
  );
}
