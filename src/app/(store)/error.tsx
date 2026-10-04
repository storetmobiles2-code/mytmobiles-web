"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";

export default function StoreError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="container-page py-12">
      <EmptyState icon={<AlertTriangle className="h-7 w-7" />} title="Something went wrong" action={<Button onClick={reset}>Try again</Button>}>
        Please try again. If the problem continues, contact us{error.digest ? ` and mention reference ${error.digest}` : ""}.
      </EmptyState>
    </div>
  );
}
