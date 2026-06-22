# Deployment Documentation: Blood Insight AI (Frontend)

This project has been analyzed and prepared for deployment to **Cloudflare Pages** as a static Single Page Application (SPA).

---

## 1. Project Analysis

* **Framework Detected**: Next.js 14 (App Router)
* **Architecture**: The frontend is a static React application that communicates with a FastAPI Python backend (hosted on port 8000 locally or at a configured public API URL).
* **Build Target**: Static HTML Export (`output: 'export'`) in `next.config.js`.

### Key Configuration Changes Made
1. **Static Export Enablement**: Configured `next.config.js` to use `output: 'export'` and disable image optimization since Cloudflare Pages hosts pure static files:
   ```javascript
   output: 'export',
   images: { unoptimized: true }
   ```
2. **Type Error Resolution**: Fixed typing issues in `src/app/reports/[id]/page.tsx` where date elements were mismatching the expected dictionary schema.
3. **Dynamic Route Support**: In a static export, Next.js dynamic pages (like `/reports/[id]`) must be prerendered. 
   - We split the layout into a Server Component entrypoint (`page.tsx`) and a Client Component dashboard (`ReportDashboard.tsx`).
   - We configured `generateStaticParams()` to pre-build paths for report IDs `1` through `100`.
4. **React PDF Client-Only Loading**: Dynamic routes use `@react-pdf/renderer` which contains client-only code and throws errors on the server during Next.js build compilation. We extracted the PDF rendering logic to a client-only component `PDFButton.tsx` and imported it dynamically with `{ ssr: false }`.

---

## 2. Dependencies Installed
* **Wrangler**: Cloudflare CLI tool for deployment.
* **Next-on-Pages**: Cloudflare wrapper (installed locally, but bypassed in favor of native Static Export for reliability on Windows).

---

## 3. How to Deploy

Because the deployment environment is non-interactive, you can deploy the pre-built files using your own Cloudflare account. Follow either of these two paths:

### Path A: Automatic Deploy via Terminal (Interactive Login)
If you have local access to your terminal:
1. Open your terminal in the `frontend` folder:
   ```bash
   cd frontend
   ```
2. Build the production files:
   ```bash
   npm run build
   ```
3. Run the wrangler login command (opens browser authorization):
   ```bash
   npx wrangler login
   ```
4. Deploy the `out` build directory:
   ```bash
   npx wrangler pages deploy out --project-name blood-insight-ai
   ```

### Path B: Deploy via CI/CD or API Token (Non-Interactive)
If deploying via command-line using an API token:
1. Generate a Cloudflare API token with **Cloudflare Pages: Edit** permissions.
2. Run the deployment with the token environment variable:
   ```bash
   # Windows PowerShell
   $env:CLOUDFLARE_API_TOKEN="your-cloudflare-api-token"
   npx wrangler pages deploy out --project-name blood-insight-ai

   # Bash/Mac/Linux
   CLOUDFLARE_API_TOKEN="your-cloudflare-api-token" npx wrangler pages deploy out --project-name blood-insight-ai
   ```

---

## 4. Live URL Reference
Once deployed, Cloudflare will output your production URL:
```
https://blood-insight-ai.pages.dev
```
