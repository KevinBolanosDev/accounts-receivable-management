import { SkeletonCardList } from "@/shared/ui/skeletons";
import { Skeleton } from "@/shared/ui/skeleton";

export default function ClientLoading() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-2/3" />
      </div>
      <SkeletonCardList rows={2} />
    </main>
  );
}
