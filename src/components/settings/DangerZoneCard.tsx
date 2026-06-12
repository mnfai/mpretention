import { useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { copyFile } from "@tauri-apps/plugin-fs";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/selia/card";
import { Button } from "@/components/selia/button";
import { Input } from "@/components/selia/input";
import { Separator } from "@/components/selia/separator";
import { closeDb, getDb, getDbFilePath, resetDatabase } from "@/lib/db";

const DB_FILTER = [{ name: "SQLite Database", extensions: ["db"] }];

export function DangerZoneCard() {
  const [resetInput, setResetInput] = useState("");

  async function handleBackup() {
    const dbPath = await getDbFilePath();
    const dest = await save({ defaultPath: "mpretention-backup.db", filters: DB_FILTER });
    if (!dest) return;
    await copyFile(dbPath, dest);
  }

  async function handleRestore() {
    const selected = await open({ multiple: false, filters: DB_FILTER });
    if (!selected) return;
    const dbPath = await getDbFilePath();
    await closeDb();
    await copyFile(selected, dbPath);
    await getDb();
    window.location.reload();
  }

  async function handleReset() {
    await resetDatabase();
    window.location.reload();
  }

  return (
    <Card className="ring-2 ring-dashed ring-danger/50">
      <CardHeader>
        <CardTitle className="text-danger">Danger Zone</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium">Backup Database</div>
            <div className="text-xs text-muted">Save a copy of the current database file.</div>
          </div>
          <Button variant="outline" onClick={handleBackup}>
            Backup
          </Button>
        </div>

        <Separator />

        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium">Restore Database</div>
            <div className="text-xs text-muted">Replace the current database with a backup file.</div>
          </div>
          <Button variant="outline" onClick={handleRestore}>
            Restore
          </Button>
        </div>

        <Separator />

        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium">Reset Database</div>
            <div className="text-xs text-muted">
              Permanently delete all transactions and import history. Type "RESET" to confirm.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={resetInput}
              onChange={(e) => setResetInput(e.target.value)}
              placeholder="RESET"
              className="w-28"
            />
            <Button variant="danger" disabled={resetInput !== "RESET"} onClick={handleReset}>
              Reset DB
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
