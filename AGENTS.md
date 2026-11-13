# Architecture decisions

- Keep the customer plan catalog in the shared subscription gate dialog and open it from the POS header when available; this makes plans reachable before activation without adding a separate gated route.
- Keep standalone POS workflows in focused feature components and mount them as tabs in POSApp; this separates workflows while reusing the shared store.