export interface LoginCodeEmailProps {
  code: string;
  appName?: string;
}

export function loginCodeEmailText({ code, appName = "BudgetIn Check" }: LoginCodeEmailProps): string {
  return `Your ${appName} login code is: ${code}

This code expires in 10 minutes.

If you didn't request this code, you can ignore this email.`;
}

export function loginCodeEmailHtml({ code, appName = "BudgetIn Check" }: LoginCodeEmailProps): string {
  const safeCode = String(code ?? "").trim();
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${appName} login code</title>
  </head>
  <body style="margin:0;padding:0;background:#0b1220;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;">
    <div style="max-width:560px;margin:0 auto;padding:28px 16px;">
      <div style="background:#0f172a;border:1px solid rgba(255,255,255,0.10);border-radius:14px;padding:22px;color:#e2e8f0;">
        <div style="font-size:14px;color:#94a3b8;">${appName}</div>
        <h1 style="margin:10px 0 0 0;font-size:18px;line-height:1.3;color:#ffffff;">Your login code</h1>
        <p style="margin:12px 0 0 0;font-size:14px;line-height:1.6;color:#cbd5e1;">Use this 5-digit code to sign in:</p>
        <div style="margin:16px 0 0 0;display:inline-block;padding:12px 14px;border-radius:12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.10);font-size:26px;letter-spacing:6px;font-weight:700;color:#ffffff;">${safeCode}</div>
        <p style="margin:16px 0 0 0;font-size:13px;line-height:1.6;color:#94a3b8;">This code expires in 10 minutes.</p>
        <p style="margin:16px 0 0 0;font-size:13px;line-height:1.6;color:#94a3b8;">If you didn't request this code, you can ignore this email.</p>
      </div>
    </div>
  </body>
</html>`;
}
