# Custom Company Logos

Place custom logo images in this folder. They are served at `/logos/<filename>` and work on both the web and mobile apps.

## Currently configured overrides

| File       | Company     | Status         |
|------------|-------------|----------------|
| `ee.png`   | EE Mobile   | ⬛ Missing — add file to enable |
| `sky.png`  | Sky TV      | ⬛ Missing — add file to enable (logo.dev returns wrong brand) |
| `apple.png`| Apple       | ⬛ Optional (currently uses logo.dev) |

## How to add a logo

1. Drop the PNG (or SVG) file in this folder.
2. Activate the override in `web-client/lib/expenses/logoResolver.ts` under `CUSTOM_LOGO_URLS`.
   - `ee.co.uk` and `sky.com` are already active — just add `ee.png` and `sky.png`.
   - `apple.com` override is commented out; uncomment it once you add the file.
3. Re-deploy the web-client (or the dev server hot-reloads automatically).

## Recommended image spec

- Format: **PNG** (transparent background preferred) or **SVG**
- Size: **256 × 256 px** or larger square
- Background: transparent so it looks right in both light and dark modes
- The image will be displayed in a **34 × 34 pt circle** on mobile
