import { Ionicons } from "@expo/vector-icons";

import { DEFAULT_LANGUAGE, normalizeSupportedLanguage, type SupportedLanguageCode } from "./locale";

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

export type HelpCenterCopy = {
  screenTitle: string;
  heroEyebrow: string;
  heroTitle: string;
  heroText: string;
  topicNotFoundTitle: string;
  topicNotFoundText: string;
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

type LocalizedHelpTopic = Pick<HelpTopic, "title" | "description" | "sections">;

const HELP_TOPICS_BY_LANGUAGE: Partial<Record<SupportedLanguageCode, Record<HelpTopicKey, LocalizedHelpTopic>>> = {
  de: {
    settings: {
      title: "Einstellungen",
      description: "Verwalte Zahlungsplan, Ersparnisse, Plaene, Erinnerungen und zentrale App-Einstellungen.",
      sections: [
        {
          title: "Was Einstellungen steuert",
          body: "In den Einstellungen lernt die App, wie dein Budget organisiert werden soll und was auf Dashboard und anderen Seiten erscheint.",
          bullets: [
            "Budget verwaltet Zahltag, Zahlungsrhythmus, Strategie und planweite Standardwerte.",
            "Unter Geld liegen aktuelle Ersparnisse und Salden, damit Opferbeitraege und Zielfortschritt synchron bleiben.",
            "Region & Wahrung bestimmt, wie Werte und Daten in der gesamten App angezeigt werden.",
            "Mit Plaenen verwaltest du persoenliche und Event-Plaene, ohne dein Haupt-Dashboard zu verlieren.",
          ],
        },
        {
          title: "Was du zuerst pruefen solltest",
          body: "Wenn ein Gesamtwert oder Zeitraum falsch aussieht, sind die Einstellungen meist die erste Stelle zum Pruefen.",
          bullets: [
            "Pruefe, ob Zahlungsrhythmus und Zahltag zu deiner echten Auszahlung passen.",
            "Halte aktuelle Ersparnisse aktuell, damit Ziele und Opfer-Tipps realistisch bleiben.",
            "Pruefe Benachrichtigungen und Abo-Einstellungen, wenn Erinnerungen oder gesperrte Features nicht passen.",
          ],
        },
      ],
    },
    expenses: {
      title: "Ausgaben",
      description: "Verfolge geplante Rechnungen, erfasse einmalige Ausgaben und markiere Zahlungen in der richtigen Zahlungsperiode.",
      sections: [
        {
          title: "Wie Ausgaben funktioniert",
          body: "Ausgaben gruppiert deine Rechnungen nach Zahlungsperiode, damit du siehst, was faellig ist, was bezahlt wurde und was bis zur naechsten Periode offen bleibt.",
          bullets: [
            "Geplante Ausgaben sind regelmaessige Rechnungen, die du in jedem Zyklus oder Monat erwartest.",
            "Erfasste Ausgaben sammeln extra oder ungeplante Ausgaben innerhalb einer gewaehlten Periode.",
            "Kategorieansichten helfen dir, einen Bereich nach dem anderen schneller abzuarbeiten.",
          ],
        },
        {
          title: "Hilfreiche Tipps",
          body: "Nutze die Ausgaben-Werkzeuge, um kommende Summen sauber und korrekt zu halten.",
          bullets: [
            "Lege nur Faelligkeiten an, die wirklich zur ausgewaehlten Zahlungsperiode gehoeren.",
            "Nutze Schnell bezahlen oder Ausgabendetails, wenn du einen Eintrag markieren willst ohne die ganze Liste neu zu oeffnen.",
            "Beleg-Upload hilft, wenn du Nachweise speichern und die Ausgabenhistorie klarer halten willst.",
          ],
        },
      ],
    },
    income: {
      title: "Einkommen",
      description: "Sieh die Jahresabdeckung deines Einkommens, gehe in eine Zahlungsperiode und verwalte Einkommens-Opferplanung.",
      sections: [
        {
          title: "Wie Einkommen funktioniert",
          body: "Einkommen ist nach denselben Zahlungsperioden-Regeln aufgebaut wie der Rest der App, damit monatliche und verankerte Plaene konsistent bleiben.",
          bullets: [
            "Die Jahresansicht zeigt fehlende Monate oder ungleichmaessige Abdeckung im Jahr.",
            "Die Monatsdetailansicht zeigt, was zu einer gewaehlten Zahlungsperiode gehoert und was zur Verteilung verfuegbar ist.",
            "Opfermodus nutzt aktuelle Salden und Ziele, um Vorschlaege fuer den naechsten Geldfluss zu machen.",
          ],
        },
        {
          title: "Hilfreiche Tipps",
          body: "Wenn Einkommensansichten unklar wirken, pruefe zuerst Rhythmus und Anker.",
          bullets: [
            "Nutze den Hinzufuegen-Flow aus der Jahresansicht, wenn eine Periode komplett ohne Einkommen fehlt.",
            "Nutze die Monatsansicht, wenn du eine einzelne Zahlungsperiode im Detail pruefen willst.",
            "Halte den Zahlungsplan in den Einstellungen aktuell, damit Dashboard und Einkommen synchron bleiben.",
          ],
        },
      ],
    },
    debts: {
      title: "Schulden",
      description: "Verfolge Salden, faellige Betraege und Zahlungsfortschritt fuer Darlehen, Karten und ausgabenbasierte Schulden.",
      sections: [
        {
          title: "Wie Schulden funktioniert",
          body: "Schuldenverwaltung kombiniert Salden, wiederkehrende Zahlungen und Finanzierungsquellen, damit du siehst, wie stark Schulden jede Periode belasten.",
          bullets: [
            "Die Schuldenliste zeigt aktive Salden und was jetzt Aufmerksamkeit braucht.",
            "In Schulden-Details kannst du Zahlungshistorie und schuldenspezifische Regeln ansehen und bearbeiten.",
            "Schulden-Analysen zeigen Tilgungsrichtung und monatlichen Druck ueber die Zeit.",
          ],
        },
        {
          title: "Hilfreiche Tipps",
          body: "Nutze Schulden, um Karten und Kreditbelastung im gleichen Budgetfluss sichtbar zu halten.",
          bullets: [
            "Erfasse Zahlungen direkt, damit das Dashboard faellige Betraege nicht zu hoch zeigt.",
            "Setze die richtige Standard-Zahlungsquelle, wenn eine Schuld meist aus Einkommen oder Karte bezahlt wird.",
            "Pruefe Schulden-Analysen, wenn du Tilgungsfortschritt vergleichen willst statt nur den aktuellen Saldo.",
          ],
        },
      ],
    },
    goals: {
      title: "Ziele",
      description: "Definiere Ziele, verknuepfe aktuelle Salden und projiziere, wie Sparentscheidungen die Ziellinie beeinflussen.",
      sections: [
        {
          title: "Wie Ziele funktioniert",
          body: "Ziele machen Sparziele sichtbar und helfen dem Dashboard zu zeigen, worauf dein Geld hinarbeitet.",
          bullets: [
            "Jedes Ziel kann Zielbetrag, aktuellen Betrag und eine projizierte Zielerreichung verfolgen.",
            "Startseiten-Ziele sind die Ziele, die in der App am haeufigsten hervorgehoben werden.",
            "Die Ziel-Prognose zeigt, wie sich unterschiedliche monatliche Sparraten bis zum Zieljahr auswirken.",
          ],
        },
        {
          title: "Hilfreiche Tipps",
          body: "Ziele funktionieren am besten, wenn Salden und Zielbetraege realistisch bleiben.",
          bullets: [
            "Aktualisiere aktuelle Salden, wenn bereits Geld fuer ein Ziel zur Seite gelegt wurde.",
            "Nutze die Prognose, um verschiedene monatliche Sparbetraege zu testen, bevor du den echten Plan aenderst.",
            "Pinne die wichtigsten Ziele auf die Startseite, damit das Dashboard fokussiert bleibt.",
          ],
        },
      ],
    },
  },
};

const HELP_CENTER_COPY_BY_LANGUAGE: Partial<Record<SupportedLanguageCode, HelpCenterCopy>> = {
  de: {
    screenTitle: "Hilfe",
    heroEyebrow: "BUDGET IN CHECK LEITFADEN",
    heroTitle: "Waehle einen Bereich, um zu verstehen, wie er funktioniert.",
    heroText: "Diese Leitfaeden erklaeren die wichtigsten Teile der App, damit Nutzer schnell verstehen, wofuer jeder Bereich da ist und was als Naechstes sinnvoll ist.",
    topicNotFoundTitle: "Hilfethema nicht gefunden",
    topicNotFoundText: "Gehe zur Hilfe zurueck und waehle eine der verfuegbaren Karten.",
  },
};

const HELP_TOPICS_BY_KEY = Object.fromEntries(
  HELP_TOPICS.map((topic) => [topic.key, topic]),
) as Record<HelpTopicKey, HelpTopic>;

const DEFAULT_HELP_CENTER_COPY: HelpCenterCopy = {
  screenTitle: "Help",
  heroEyebrow: "BUDGET IN CHECK GUIDE",
  heroTitle: "Choose an area to understand how it works.",
  heroText: "These guides explain the main parts of the app so users can quickly understand what each section is for and where to go next.",
  topicNotFoundTitle: "Help topic not found",
  topicNotFoundText: "Go back to the help screen and choose one of the available cards.",
};

function localizeHelpTopic(
  topic: HelpTopic,
  language: string | null | undefined,
): HelpTopic {
  const normalizedLanguage = normalizeSupportedLanguage(language, DEFAULT_LANGUAGE);
  const localizedTopic = HELP_TOPICS_BY_LANGUAGE[normalizedLanguage]?.[topic.key];
  if (!localizedTopic) return topic;

  return {
    ...topic,
    title: localizedTopic.title,
    description: localizedTopic.description,
    sections: localizedTopic.sections,
  };
}

export function getHelpCenterCopy(language: string | null | undefined): HelpCenterCopy {
  const normalizedLanguage = normalizeSupportedLanguage(language, DEFAULT_LANGUAGE);
  return HELP_CENTER_COPY_BY_LANGUAGE[normalizedLanguage] ?? DEFAULT_HELP_CENTER_COPY;
}

export function getHelpTopics(language: string | null | undefined): HelpTopic[] {
  return HELP_TOPICS.map((topic) => localizeHelpTopic(topic, language));
}

export function isHelpTopicKey(value: string | null | undefined): value is HelpTopicKey {
  if (!value) return false;
  return value in HELP_TOPICS_BY_KEY;
}

export function getHelpTopic(value: string | null | undefined, language?: string | null): HelpTopic | null {
  if (!isHelpTopicKey(value)) return null;
  return localizeHelpTopic(HELP_TOPICS_BY_KEY[value], language);
}