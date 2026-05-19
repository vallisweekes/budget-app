import { Ionicons } from "@expo/vector-icons";

export type HelpTopicKey = "settings" | "expenses" | "income" | "debts" | "goals";

type HelpIconName = keyof typeof Ionicons.glyphMap;

export type HelpTopicSection = {
  title: string;
  body: string;
  bullets: string[];
};

export type HelpTopic = {
  key: HelpTopicKey;
  title: string;
  description: string;
  icon: HelpIconName;
  accentColor: string;
  sections: HelpTopicSection[];
};

export const HELP_TOPICS: HelpTopic[] = [
  {
    key: "settings",
    title: "Settings",
    description: "Manage your pay schedule, savings, plans, reminders, and core app preferences.",
    icon: "settings-outline",
    accentColor: "#7C5CFF",
    sections: [
      {
        title: "What settings controls",
        body: "Settings is where the app learns how to organise your budget and what should appear across the dashboard and other screens.",
        bullets: [
          "Budget lets you manage pay date, pay frequency, strategy, and plan-level defaults.",
          "Money is where current savings and balances live so sacrifice and goal progress stay in sync.",
          "Locale & Currency changes how values and dates are shown across the app.",
          "Plans lets you manage personal and event plans without losing the main dashboard setup.",
        ],
      },
      {
        title: "What to check first",
        body: "If a total or period looks wrong, settings is usually the first place to verify the setup.",
        bullets: [
          "Confirm your pay frequency and anchor/pay date match how you are actually paid.",
          "Keep current savings up to date so goals and sacrifice suggestions stay realistic.",
          "Review notifications and subscription settings if reminders or locked features do not match what you expect.",
        ],
      },
    ],
  },
  {
    key: "expenses",
    title: "Expenses",
    description: "Track planned bills, log one-off spending, and mark payments inside the right pay period.",
    icon: "receipt-outline",
    accentColor: "#F59E0B",
    sections: [
      {
        title: "How expenses works",
        body: "Expenses groups your bills by pay period so you can see what is due, what is paid, and what remains before the next cycle ends.",
        bullets: [
          "Planned expenses are the regular bills you expect every cycle or month.",
          "Logged expenses capture extra or unplanned spending that happened inside a selected period.",
          "Category screens help you work through one spending area at a time and mark items faster.",
        ],
      },
      {
        title: "Helpful tips",
        body: "Use the expense tools to keep upcoming totals clean and accurate.",
        bullets: [
          "Only add due dates that belong to the selected pay period.",
          "Use quick pay or expense detail when you want to mark an item without reopening the full list.",
          "Receipt upload is useful when you want to attach proof and keep spending history clearer.",
        ],
      },
    ],
  },
  {
    key: "income",
    title: "Income",
    description: "See yearly income coverage, drill into a pay period, and manage income sacrifice planning.",
    icon: "wallet-outline",
    accentColor: "#10B981",
    sections: [
      {
        title: "How income works",
        body: "Income is organised around the same pay-period rules as the rest of the app, so monthly and anchored schedules stay aligned.",
        bullets: [
          "The year view helps you spot missing months or uneven coverage across the year.",
          "Income month detail shows what belongs to one selected pay period and what is available to allocate.",
          "Sacrifice mode uses current balances and goals to suggest where money can go next.",
        ],
      },
      {
        title: "Helpful tips",
        body: "If income views feel off, check the schedule and anchor first.",
        bullets: [
          "Use the add flow from year view when a period is missing income completely.",
          "Use the month view when you want to inspect one pay period in detail.",
          "Keep your pay schedule current in settings so dashboard and income stay aligned.",
        ],
      },
    ],
  },
  {
    key: "debts",
    title: "Debts",
    description: "Track balances, due amounts, and payment progress for loans, cards, and expense-backed debt.",
    icon: "card-outline",
    accentColor: "#F43F5E",
    sections: [
      {
        title: "How debts works",
        body: "Debt management combines balances, recurring payments, and funding sources so you can see what pressure debt is putting on each period.",
        bullets: [
          "Debt list shows active balances and what needs attention now.",
          "Debt detail lets you inspect payment history and edit debt-specific rules.",
          "Debt analytics helps you see payoff direction and monthly pressure over time.",
        ],
      },
      {
        title: "Helpful tips",
        body: "Use debts to keep cards and borrowing visible in the same budget flow.",
        bullets: [
          "Record payments as you make them so the dashboard stops overstating what is due.",
          "Set the right default payment source when a debt is usually funded from income or a credit card.",
          "Review debt analytics when you want to compare payoff progress instead of just the current balance.",
        ],
      },
    ],
  },
  {
    key: "goals",
    title: "Goals",
    description: "Define targets, connect current balances, and project how savings decisions affect the finish line.",
    icon: "flag-outline",
    accentColor: "#3B82F6",
    sections: [
      {
        title: "How goals works",
        body: "Goals turn savings targets into visible progress and help the dashboard show what your money is moving toward.",
        bullets: [
          "Each goal can track a target amount, current amount, and projected finish path.",
          "Homepage goals are the ones highlighted most often across the app.",
          "Goals projection shows how monthly savings pace changes the likely result by your target year.",
        ],
      },
      {
        title: "Helpful tips",
        body: "Goals work best when balances and targets stay realistic.",
        bullets: [
          "Update current balances when you already have money set aside for a goal.",
          "Use projection to test different monthly saving amounts before changing your real plan.",
          "Keep the most important goals pinned to the homepage so the dashboard stays focused.",
        ],
      },
    ],
  },
];

const HELP_TOPICS_BY_KEY = Object.fromEntries(
  HELP_TOPICS.map((topic) => [topic.key, topic]),
) as Record<HelpTopicKey, HelpTopic>;

export function isHelpTopicKey(value: string | null | undefined): value is HelpTopicKey {
  if (!value) return false;
  return value in HELP_TOPICS_BY_KEY;
}

export function getHelpTopic(value: string | null | undefined): HelpTopic | null {
  if (!isHelpTopicKey(value)) return null;
  return HELP_TOPICS_BY_KEY[value];
}