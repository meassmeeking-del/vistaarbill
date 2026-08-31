import { createFileRoute } from "@tanstack/react-router";
import { POSApp } from "@/components/pos/POSApp";
import { AuthGate } from "@/components/AuthGate";
import { SplashScreen } from "@/components/SplashScreen";
import { SubscriptionGate } from "@/components/pos/SubscriptionGate";

const TITLE = "VistaarBill — Grocery POS & Thermal Billing App";
const DESC =
  "VistaarBill: fast grocery store POS — barcode scan, 58mm thermal bill print, UPI QR payments, stock and sales history. Works offline on mobile.";
const OG_IMAGE =
  "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/7bcd3e6c-fad8-492f-aa9a-aa2c9c0acc32/id-preview-518c7f11--4b1a7006-694c-43a7-93d9-127a335690c7.lovable.app-1777907941323.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://vistaarbill.lovable.app/" },
      { property: "og:image", content: OG_IMAGE },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [{ rel: "canonical", href: "https://vistaarbill.lovable.app/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "VistaarBill",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web, Android, iOS",
          description: DESC,
          url: "https://vistaarbill.lovable.app/",
          offers: {
            "@type": "Offer",
            price: "99",
            priceCurrency: "INR",
          },
        }),
      },
    ],
  }),
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
