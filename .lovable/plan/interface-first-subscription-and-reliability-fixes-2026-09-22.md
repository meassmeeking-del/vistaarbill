# Interface-first subscription and reliability fixes

## What will change
- After sign-up/sign-in, always show the full VistaarBill customer interface instead of replacing it with the plans screen.
- Without an active plan, keep business actions locked. Tapping a locked tab, product, scanner, checkout, or settings action opens a clear **Buy Plan** popup.
- Keep sign-out/account switching available even while the plan is locked.
- Reuse the current Trial/Monthly payment and pending/rejected status flow inside the popup, so existing payment requests continue working.
- Fix new-account sign-up so email registration is enabled and phone verification state cannot be reused after changing the phone number.
- Improve barcode scanning by preferring the rear camera on phones, avoiding accidental front-camera selection before permission is granted, and showing clearer camera errors.

## Technical details
- Convert the subscription gate from a replacement screen into a lock layer around the existing POS interface, with a controlled payment dialog.
- Prevent locked clicks before they trigger product, billing, scanner, sales, or settings actions.
- Preserve active subscribers' current experience unchanged.
- Keep current account data and subscription records unchanged.
- Validate with the latest build output and browser checks for signed-out and signed-in states where available.
