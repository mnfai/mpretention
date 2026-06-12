import { useNavigate } from "react-router-dom";
import { Inbox } from "lucide-react";
import { Card, CardBody } from "@/components/selia/card";
import { Button } from "@/components/selia/button";
import { HistoryTable } from "@/components/history/HistoryTable";
import { useImportHistory } from "@/hooks/useImportHistory";

export default function HistoryPage() {
  const { history, isLoading, deleteBatch } = useImportHistory();
  const navigate = useNavigate();

  if (isLoading) {
    return <div className="text-sm text-muted">Loading…</div>;
  }

  if (history.length === 0) {
    return (
      <Card>
        <CardBody className="flex flex-col items-center gap-3 py-16 text-center">
          <Inbox className="size-12 text-muted" />
          <div className="text-base font-medium">No imports yet</div>
          <Button variant="primary" onClick={() => navigate("/import")}>
            Import Data
          </Button>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody className="p-0">
        <HistoryTable history={history} onDelete={deleteBatch} />
      </CardBody>
    </Card>
  );
}
