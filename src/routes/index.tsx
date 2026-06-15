import { createFileRoute } from "@tanstack/react-router";
import { POSApp } from "@/components/pos/POSApp";
import { AuthGate } from "@/components/AuthGate";
import { SplashScreen } from "@/components/SplashScreen";
import { SubscriptionGate } from "@/components/pos/SubscriptionGate";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <SplashScreen>
      <AuthGate>
        <SubscriptionGate>
          <POSApp />
        </SubscriptionGate>
      </AuthGate>
    </SplashScreen>
  );
}
