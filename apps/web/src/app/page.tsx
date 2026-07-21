import { HealthStatus } from "@/widgets/health-status/HealthStatus";

export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-md flex-col gap-6 rounded-lg border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-zinc-900">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Estado de la API</h1>
        <HealthStatus />
      </main>
    </div>
  );
}
