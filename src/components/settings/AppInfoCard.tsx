import { useEffect, useState } from "react";
import { size } from "@tauri-apps/plugin-fs";
import { Copy, Check } from "lucide-react";
import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { IconButton } from "@astryxdesign/core/IconButton";
import { getDbFilePath, getTransactionCount } from "@/lib/db";
import { formatNumber } from "@/lib/formatters";
import { useAppVersion } from "@/hooks/useAppVersion";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <HStack gap={3} justify="between" align="center">
      <Text type="supporting">{label}</Text>
      {typeof children === "string" ? <Text type="body">{children}</Text> : children}
    </HStack>
  );
}

export function AppInfoCard() {
  const appVersion = useAppVersion();
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
      <VStack gap={3}>
        <Heading level={3}>App Info</Heading>
        <InfoRow label="Version">{appVersion ? `v${appVersion}` : "—"}</InfoRow>
        <InfoRow label="Database Path">
          <HStack gap={2} align="center">
            <Text type="code">{dbPath}</Text>
            <IconButton
              label={copied ? "Copied" : "Copy database path"}
              icon={copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
              variant="ghost"
              size="sm"
              onClick={handleCopy}
            />
          </HStack>
        </InfoRow>
        <InfoRow label="Database Size">{dbSize !== null ? formatBytes(dbSize) : "—"}</InfoRow>
        <InfoRow label="Total Transactions">{formatNumber(txCount)}</InfoRow>
      </VStack>
    </Card>
  );
}
