import { Card, CardBody } from "@/components/selia/card";

interface MetricCardProps {
  label: string;
  value: string;
  subtext: string;
}

export function MetricCard({ label, value, subtext }: MetricCardProps) {
  return (
    <Card>
      <CardBody>
        <div className="text-sm text-muted">{label}</div>
        <div className="mt-1 text-2xl font-semibold">{value}</div>
        <div className="mt-1 text-xs text-muted">{subtext}</div>
      </CardBody>
    </Card>
  );
}
