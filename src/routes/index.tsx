import { createFileRoute } from "@tanstack/react-router";
import { POSApp } from "@/components/pos/POSApp";
import { AuthGate } from "@/components/AuthGate";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <AuthGate>
      <POSApp />
    </AuthGate>
  );
}
