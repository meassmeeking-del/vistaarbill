import { createFileRoute } from "@tanstack/react-router";
import { POSApp } from "@/components/pos/POSApp";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return <POSApp />;
}
