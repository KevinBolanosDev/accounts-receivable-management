import { HealthStatus } from "@/widgets/health-status/HealthStatus";

export default function Home() {
  return (
    <div className="bg-background flex flex-1 items-center justify-center">
      <main className="border-border bg-card flex w-full max-w-md flex-col gap-6 rounded-lg border p-8">
        <h1 className="text-h3">Estado de la API</h1>
        <HealthStatus />
      </main>
    </div>
  );
}
