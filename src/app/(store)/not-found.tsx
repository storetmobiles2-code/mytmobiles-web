import { SearchX } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";

export default function NotFound() {
  return (
    <div className="container-page py-12">
      <EmptyState icon={<SearchX className="h-7 w-7" />} title="We couldn't find that page" action={<ButtonLink href="/">Go to homepage</ButtonLink>}>
        The product may have been removed or the link is incorrect. Try searching for it above.
      </EmptyState>
    </div>
  );
}
