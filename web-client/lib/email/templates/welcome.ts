export interface WelcomeEmailProps {
  name?: string;
  appUrl?: string;
}

export function welcomeEmailHtml({
  name,
  appUrl = process.env.APP_URL ?? "https://budgetin.app",
}: WelcomeEmailProps = {}): string {
  const greeting = name ? `Hi ${name},` : "Hi there,";

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Welcome to BudgetIn</title>
    <style>
      body {
        margin: 0;
        padding: 0;
        background-color: #f4f5f7;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
          Helvetica, Arial, sans-serif;
        color: #1a1a2e;
      }
      .wrapper {
        max-width: 580px;
        margin: 40px auto;
        background: #ffffff;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
      }
      .header {
        background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
        padding: 40px 40px 32px;
        text-align: center;
      }
      .header h1 {
        margin: 0;
        color: #ffffff;
        font-size: 28px;
        font-weight: 700;
        letter-spacing: -0.5px;
      }
      .header p.tagline {
        margin: 8px 0 0;
        color: rgba(255, 255, 255, 0.85);
        font-size: 14px;
      }
      .body {
        padding: 36px 40px;
      }
      .body p {
        margin: 0 0 16px;
        font-size: 15px;
        line-height: 1.7;
        color: #374151;
      }
      .cta-wrapper {
        text-align: center;
        margin: 32px 0;
      }
      .cta-btn {
        display: inline-block;
        background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
        color: #ffffff !important;
        text-decoration: none;
        padding: 14px 36px;
        border-radius: 8px;
        font-size: 15px;
        font-weight: 600;
        letter-spacing: 0.2px;
      }
      .divider {
        border: none;
        border-top: 1px solid #e5e7eb;
        margin: 28px 0;
      }
      .features {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-bottom: 24px;
      }
      .feature-item {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        font-size: 14px;
        color: #4b5563;
        line-height: 1.6;
      }
      .feature-icon {
        font-size: 18px;
        flex-shrink: 0;
      }
      .footer {
        background: #f9fafb;
        padding: 20px 40px;
        text-align: center;
        font-size: 12px;
        color: #9ca3af;
        border-top: 1px solid #e5e7eb;
      }
      .footer a {
        color: #6366f1;
        text-decoration: none;
      }
    </style>
  </head>
  <body>
    <div class="wrapper">
      <!-- Header -->
      <div class="header">
        <h1>💸 BudgetIn</h1>
        <p class="tagline">Your smart personal finance companion</p>
      </div>

      <!-- Body -->
      <div class="body">
        <p>${greeting}</p>
        <p>
          Welcome to <strong>BudgetIn</strong> — we're excited to have you on
          board! Take control of your money, track your spending, plan ahead,
          and reach your financial goals.
        </p>

        <!-- Feature highlights -->
        <div class="features">
          <div class="feature-item">
            <span class="feature-icon">📊</span>
            <span><strong>Smart Budgets</strong> — Build flexible monthly and multi-year budget plans.</span>
          </div>
          <div class="feature-item">
            <span class="feature-icon">🎯</span>
            <span><strong>Goals</strong> — Set savings targets and watch your progress in real time.</span>
          </div>
          <div class="feature-item">
            <span class="feature-icon">💳</span>
            <span><strong>Expense Tracking</strong> — Log and categorise every purchase automatically.</span>
          </div>
          <div class="feature-item">
            <span class="feature-icon">📈</span>
            <span><strong>Spending Insights</strong> — AI-powered analysis of where your money goes.</span>
          </div>
        </div>

        <hr class="divider" />

        <p>Ready to get started?</p>

        <div class="cta-wrapper">
          <a href="${appUrl}/dashboard" class="cta-btn">Go to My Dashboard →</a>
        </div>

        <p style="font-size:13px; color:#9ca3af;">
          If you didn't create a BudgetIn account, you can safely ignore this
          email.
        </p>
      </div>

      <!-- Footer -->
      <div class="footer">
        <p>
          © ${new Date().getFullYear()} BudgetIn · All rights reserved<br />
          <a href="${appUrl}">budgetin.app</a>
        </p>
      </div>
    </div>
  </body>
</html>`;
}

export function welcomeEmailText({
  name,
  appUrl = process.env.APP_URL ?? "https://budgetin.app",
}: WelcomeEmailProps = {}): string {
  const greeting = name ? `Hi ${name},` : "Hi there,";
  return `${greeting}

Welcome to BudgetIn — your smart personal finance companion!

Here's what you can do:
- Build flexible monthly and multi-year budgets
- Set savings goals and track progress
- Log and categorise every purchase
- Get AI-powered spending insights

Get started: ${appUrl}/dashboard

If you didn't create a BudgetIn account, you can safely ignore this email.

© ${new Date().getFullYear()} BudgetIn
`;
}
