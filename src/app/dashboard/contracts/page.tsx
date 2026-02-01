import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ContractsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Contracts</h1>
        <p className="text-muted-foreground">
          Create proposals and contracts, send for e-signature. View and sign as client.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
          <CardDescription>
            Templates, document generation, e-signature, and PDF storage. Phase 2 in PRD.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border-2 border-dashed border-muted bg-muted/30 p-8 text-center text-muted-foreground">
            Contracts module is planned.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
