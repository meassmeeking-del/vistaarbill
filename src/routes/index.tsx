import { createFileRoute } from "@tanstack/react-router";
import { BallRoadGame } from "@/components/BallRoadGame";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return <BallRoadGame />;
}
