import { useState } from "react";
import { format } from "date-fns";
import { open, save, message } from "@tauri-apps/plugin-dialog";
import { copyFile, exists, remove } from "@tauri-apps/plugin-fs";
import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { Button } from "@astryxdesign/core/Button";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Divider } from "@astryxdesign/core/Divider";
import { backupDatabaseTo, closeDb, getDb, getDbFilePath, resetDatabase } from "@/lib/db";

const DB_FILTER = [{ name: "SQLite Database", extensions: ["db"] }];

export function DangerZoneCard() {
  const [resetInput, setResetInput] = useState("");

  async function handleBackup() {
    const dest = await save({
      defaultPath: `MP Retention Backup - ${format(new Date(), "yyyy-MM-dd")}.db`,
      filters: DB_FILTER,
    });
    if (!dest) return;
    try {
      // VACUUM INTO refuses to overwrite; the save dialog already confirmed replacing it.
      if (await exists(dest)) await remove(dest);
      await backupDatabaseTo(dest);
      await message("Backup saved.", { kind: "info" });
    } catch (err) {
      await message(`Backup failed: ${err}`, { kind: "error" });
    }
  }

  async function handleRestore() {
    const selected = await open({ multiple: false, filters: DB_FILTER });
    if (!selected) return;
    const dbPath = await getDbFilePath();
    try {
      await closeDb();
      // Leftover WAL/SHM files belong to the old database; never replay them onto the backup.
      for (const suffix of ["-wal", "-shm"]) {
        if (await exists(dbPath + suffix)) await remove(dbPath + suffix);
      }
      await copyFile(selected, dbPath);
      await getDb();
      window.location.reload();
    } catch (err) {
      await message(`Restore failed: ${err}`, { kind: "error" });
    }
  }

  async function handleReset() {
    await resetDatabase();
    window.location.reload();
  }

  return (
    <Card variant="red">
      <VStack gap={4}>
        <Heading level={3}>Danger Zone</Heading>

        <HStack gap={4} justify="between" align="center">
          <VStack gap={0.5}>
            <Text type="label">Backup Database</Text>
            <Text type="supporting">Save a consistent snapshot of the current database.</Text>
          </VStack>
          <Button label="Backup" variant="secondary" onClick={handleBackup} />
        </HStack>

        <Divider />

        <HStack gap={4} justify="between" align="center">
          <VStack gap={0.5}>
            <Text type="label">Restore Database</Text>
            <Text type="supporting">Replace the current database with a backup file.</Text>
          </VStack>
          <Button label="Restore" variant="secondary" onClick={handleRestore} />
        </HStack>

        <Divider />

        <HStack gap={4} justify="between" align="center">
          <VStack gap={0.5}>
            <Text type="label">Reset Database</Text>
            <Text type="supporting">
              Permanently delete all transactions, customers and import history. Type "RESET" to confirm.
            </Text>
          </VStack>
          <HStack gap={2} align="center">
            <TextInput
              label="Confirm reset"
              isLabelHidden
              value={resetInput}
              onChange={setResetInput}
              size="sm"
            />
            <Button
              label="Reset DB"
              variant="destructive"
              isDisabled={resetInput !== "RESET"}
              onClick={handleReset}
            />
          </HStack>
        </HStack>
      </VStack>
    </Card>
  );
}
