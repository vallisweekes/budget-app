import { normalizeLanguageCode } from "@/lib/constants/locales";
import type { RecapTip } from "@/lib/expenses/insights";

function localizeGermanTip(tip: RecapTip): RecapTip {
  const { title, detail } = tip;

  if (title === "You're on track") {
    return {
      ...tip,
      title: "Du bist auf Kurs",
      detail: "Die Rechnungen der letzten Periode wurden gedeckt. Halte Erinnerungen oder Autopay aktiv und baue weiter einen kleinen Puffer fur den nachsten Zyklus auf.",
    };
  }

  if (title === "Many bills are due before payday") {
    return {
      ...tip,
      title: "Viele Rechnungen sind vor dem Zahltag fallig",
      detail: "Viele deiner Rechnungen fallen vor deinen Zahltag. Wenn moglich, verschiebe Falligkeitstage direkt nach dem Zahltag oder richte am Zahltag einen festen Rechnungs-Puffer ein.",
    };
  }

  if (title === "You often pay partially") {
    return {
      ...tip,
      title: "Du zahlst oft nur teilweise",
      detail: "Wenn Teilzahlungen oft vorkommen, teile grosse Rechnungen besser in 2 Zahlungen auf (Zahltag + Monatsmitte), damit sie sich nicht am Falligkeitstag stauen.",
    };
  }

  if (title === "Prioritize overdue bills first") {
    const match = /^Start with anything overdue\. Even partial payments help reduce late fees\. Remaining overdue: (.+)\.$/u.exec(detail);
    if (match) {
      return {
        ...tip,
        title: "Uberfallige Rechnungen zuerst bezahlen",
        detail: `Beginne mit allem, was uberfallig ist. Schon Teilzahlungen helfen, Mahngebuhren zu senken. Noch uberfallig: ${match[1]}.`,
      };
    }
  }

  if (title === "Pay on payday (or the day after)") {
    return {
      ...tip,
      title: "Zahle am Zahltag (oder einen Tag danach)",
      detail: "Plane Rechnungszahlungen moglichst direkt nach deinem Zahltag, damit das Geld nicht versehentlich fur anderes ausgegeben wird.",
    };
  }

  if (title === "Add reminders + autopay for the basics") {
    return {
      ...tip,
      title: "Erinnerungen und Autopay fur das Wichtigste einschalten",
      detail: "Aktiviere Erinnerungen 3 Tage vor Falligkeit und am Tag selbst. Nutze Autopay fur Miete, Hypothek oder Nebenkosten, wenn moglich.",
    };
  }

  if (title === "Build a tiny ‘bills buffer’") {
    return {
      ...tip,
      title: "Baue einen kleinen Rechnungs-Puffer auf",
      detail: "Schon ein kleiner Puffer (zum Beispiel 25-50) hilft, damit eine unerwartete Ausgabe nicht direkt zu einer verpassten Rechnung fuhrt.",
    };
  }

  if (title === "Use higher-income months to catch up") {
    const match = /^(.+) looks stronger after bills \(about (.+) more than this month\)\. If you can, consider paying an extra ~(.+) toward overdue\/missed bills then\.$/u.exec(detail);
    if (match) {
      return {
        ...tip,
        title: "Nutze starkere Einkommensmonate zum Aufholen",
        detail: `${match[1]} sieht nach Rechnungen starker aus (etwa ${match[2]} mehr als in diesem Monat). Wenn moglich, zahle dann etwa ${match[3]} extra auf uberfallige oder verpasste Rechnungen.`,
      };
    }
  }

  if (title === "Watch for tight months ahead") {
    const match = /^(.+) projects a negative gap after bills\. Consider pre-paying 1–2 smaller bills in the prior month or trimming discretionary spend early\.$/u.exec(detail);
    if (match) {
      return {
        ...tip,
        title: "Achte auf knappe Monate voraus",
        detail: `${match[1]} zeigt nach Rechnungen eine negative Lucke. Uberlege, 1-2 kleinere Rechnungen im Vormonat vorzuzahlen oder freiwillige Ausgaben fruh zu reduzieren.`,
      };
    }
  }

  if (title === "Set your payday") {
    return {
      ...tip,
      title: "Lege deinen Zahltag fest",
      detail: "Trage deinen Zahltag in den Einstellungen ein, damit wir deinen Plan und deine Erinnerungen richtig timen konnen.",
    };
  }

  if (title === "Start with the minimums") {
    const amountMatch = /^Plan your monthly debt minimums first \(about (.+) total\), then budget what’s left\.$/u.exec(detail);
    return {
      ...tip,
      title: "Beginne mit den Mindestzahlungen",
      detail: amountMatch
        ? `Plane zuerst deine monatlichen Schulden-Mindestzahlungen (insgesamt etwa ${amountMatch[1]}), und budgetiere dann den Rest.`
        : "Plane zuerst deine monatlichen Schulden-Mindestzahlungen und budgetiere dann den Rest.",
    };
  }

  if (title === "Save something small") {
    return {
      ...tip,
      title: "Spare mit einem kleinen Betrag",
      detail: "Schon 10-20 pro Woche summieren sich. Starte mit einem kleinen Sparbetrag und passe ihn spater an.",
    };
  }

  if (title === "Build a small buffer") {
    return {
      ...tip,
      title: "Baue einen kleinen Puffer auf",
      detail: "Starte deinen Notfallpuffer mit einem kleinen monatlichen Betrag, damit unerwartete Kosten deinen Plan nicht durcheinanderbringen.",
    };
  }

  if (title === "Invest consistently") {
    return {
      ...tip,
      title: "Investiere regelmassig",
      detail: "Eine konstante monatliche Anlagegewohnheit ist wichtiger als gross zu starten. Wahle einen Betrag, den du langfristig halten kannst.",
    };
  }

  if (title === "Check your monthly bills") {
    const match = /^Make sure (.+) are in your plan with the right amounts\.$/u.exec(detail);
    return {
      ...tip,
      title: "Prufe deine monatlichen Rechnungen",
      detail: match
        ? `Stelle sicher, dass ${match[1]} mit den richtigen Betragen in deinem Plan enthalten sind.`
        : "Stelle sicher, dass deine wichtigsten Rechnungen mit den richtigen Betragen in deinem Plan enthalten sind.",
    };
  }

  if (title === "Start simple") {
    return {
      ...tip,
      title: "Starte einfach",
      detail: "Fuge Einkommen hinzu, trage deine wichtigsten Rechnungen ein und protokolliere dann eine Woche lang Ausgaben, um deinen Plan zu scharfen.",
    };
  }

  if (title === "Add income next") {
    return {
      ...tip,
      title: "Als Nachstes Einkommen hinzufugen",
      detail: "Deine Rechnungen sind schon erfasst. Fuge jetzt dein Einkommen hinzu, damit du wirklich siehst, was nach den Fixkosten ubrigt bleibt.",
    };
  }

  if (title === "Add your main bills") {
    return {
      ...tip,
      title: "Trage deine wichtigsten Rechnungen ein",
      detail: "Dein Einkommen ist schon erfasst. Trage jetzt deine festen Rechnungen ein, damit du wirklich siehst, was zum Ausgeben frei ist.",
    };
  }

  if (title === "Track spending for a week") {
    return {
      ...tip,
      title: "Verfolge eine Woche lang deine Ausgaben",
      detail: "Dein Einkommen und deine wichtigsten Rechnungen sind schon eingetragen. Erfasse jetzt eine Woche lang Alltagsausgaben, um die einfachsten Sparhebel zu finden.",
    };
  }

  if (title === "Card is over its credit limit") {
    const match = /^(.+) looks over limit \(available (.+) on a (.+) limit\)\. Consider paying it down to avoid fees \/ declined payments\.$/u.exec(detail);
    if (match) {
      return {
        ...tip,
        title: "Karte ist uber dem Kreditlimit",
        detail: `${match[1]} liegt offenbar uber dem Limit (verfugbar ${match[2]} bei einem Limit von ${match[3]}). Eine Teilruckzahlung kann helfen, Gebuhren oder abgelehnte Zahlungen zu vermeiden.`,
      };
    }
  }

  if (title === "Pay your card before upcoming charges") {
    const match = /^(.+) has only (.+) available, but you have (.+) planned to be charged to it \(via other debt payments\)\. Paying the card down first helps avoid going over limit \/ missed payments\.$/u.exec(detail);
    if (match) {
      return {
        ...tip,
        title: "Bezahle deine Karte vor den nachsten Belastungen",
        detail: `${match[1]} hat nur noch ${match[2]} verfugbar, aber es sind ${match[3]} an geplanten Belastungen dafur vorgesehen. Eine fruhere Zahlung hilft, Uberziehungen oder verpasste Zahlungen zu vermeiden.`,
      };
    }
  }

  if (title === "Cover minimum payments first") {
    const match = /^(.+) is planned at (.+) but the minimum is (.+)\. Paying at least the minimum helps avoid fees and credit damage\.$/u.exec(detail);
    if (match) {
      return {
        ...tip,
        title: "Mindestzahlungen zuerst absichern",
        detail: `Fur ${match[1]} sind ${match[2]} eingeplant, aber das Minimum liegt bei ${match[3]}. Mindestens den Mindestbetrag zu zahlen hilft, Gebuhren und Bonitatsschaden zu vermeiden.`,
      };
    }
  }

  if (title === "Add APR to get smarter debt tips") {
    return {
      ...tip,
      title: "APR hinterlegen fur bessere Schulden-Tipps",
      detail: "Wenn du die Zinssatze fur deine Schulden eintragst, kann die App eine Avalanche-Strategie empfehlen und zeigen, welche Ruckzahlung am meisten Zinsen spart.",
    };
  }

  if (title === "Avalanche: prioritize the highest APR") {
    const match = /^(.+) has the highest APR \((.+)\)\. Consider paying any extra on that first while keeping minimums on the rest\.$/u.exec(detail);
    if (match) {
      return {
        ...tip,
        title: "Avalanche: hochsten APR zuerst angehen",
        detail: `${match[1]} hat den hochsten APR (${match[2]}). Lege zusatzliche Zahlungen zuerst darauf, wahrend du bei den anderen die Mindestzahlungen beibehaltst.`,
      };
    }
  }

  if (title === "Quick win: close a small balance") {
    const match = /^(.+) is close to paid off \((.+) left\)\. Clearing it can free up (.+)\/month to roll into the next debt\.$/u.exec(detail);
    if (match) {
      return {
        ...tip,
        title: "Schneller Erfolg: kleine Restschuld schliessen",
        detail: `${match[1]} ist fast abbezahlt (${match[2]} offen). Wenn du sie schliesst, kannst du ${match[3]} pro Monat fur die nachste Schuld freimachen.`,
      };
    }
  }

  if (title === "Debt payments are a big chunk of income") {
    const match = /^Your planned debt payments are about (.+) of income \((.+)\/(.+)\)\. If this feels tight, try reducing variable spending or temporarily pausing non-essential goals to protect minimum payments\.$/u.exec(detail);
    if (match) {
      return {
        ...tip,
        title: "Schuldenzahlungen machen einen grossen Teil deines Einkommens aus",
        detail: `Deine geplanten Schuldenzahlungen liegen bei etwa ${match[1]} deines Einkommens (${match[2]}/${match[3]}). Wenn das eng wird, reduziere variable Ausgaben oder pausiere vorubergehend nicht essenzielle Ziele, um Mindestzahlungen zu schutzen.`,
      };
    }
  }

  if (title === "Set a monthly payment plan") {
    const match = /^You have (.+) in debt balance but no monthly debt amounts set\. Add planned payments so the budget can reserve cash for debt\.$/u.exec(detail);
    if (match) {
      return {
        ...tip,
        title: "Lege einen monatlichen Schuldenplan fest",
        detail: `Du hast ${match[1]} an Schulden, aber noch keine monatlichen Schuldzahlungen eingetragen. Fuge geplante Zahlungen hinzu, damit das Budget dafur Geld reservieren kann.`,
      };
    }
  }

  if (title === "Total debt across plans") {
    const match = /^Across all your plans you have about (.+) outstanding\. Consider prioritising the highest-interest \/ highest-balance debt first\.$/u.exec(detail);
    if (match) {
      return {
        ...tip,
        title: "Gesamtschulden uber alle Plane",
        detail: `Uber alle deine Plane hinweg hast du etwa ${match[1]} offen. Uberlege, zuerst die Schuld mit dem hochsten Zins oder dem hochsten Saldo zu priorisieren.`,
      };
    }
  }

  if (title === "Bills due within 7 days") {
    const match = /^Across all plans you have (.+) bill\(s\) due within 7 days \(≈ (.+) remaining\)\.$/u.exec(detail);
    if (match) {
      return {
        ...tip,
        title: "Rechnungen innerhalb von 7 Tagen fallig",
        detail: `Uber alle Plane hinweg sind ${match[1]} Rechnung(en) in den nachsten 7 Tagen fallig (noch etwa ${match[2]} offen).`,
      };
    }
  }

  if (title === "Bills due soon") {
    const match = /^Across all plans you have (.+) bill\(s\) due within 30 days \(≈ (.+) remaining\)\.$/u.exec(detail);
    if (match) {
      return {
        ...tip,
        title: "Rechnungen bald fallig",
        detail: `Uber alle Plane hinweg sind ${match[1]} Rechnung(en) in den nachsten 30 Tagen fallig (noch etwa ${match[2]} offen).`,
      };
    }
  }

  if (/^You often miss /u.test(title)) {
    const titleMatch = /^You often miss (.+)$/u.exec(title);
    const detailMatch = /^(.+) was missed (\d+) times in your recent history\. Consider autopay \(if available\) or a recurring reminder 3 days before the due date\.$/u.exec(detail);
    if (titleMatch && detailMatch) {
      return {
        ...tip,
        title: `${titleMatch[1]} verpasst du oft`,
        detail: `${detailMatch[1]} wurde in deiner letzten Historie ${detailMatch[2]} Mal verpasst. Wenn moglich, nutze Autopay oder eine wiederkehrende Erinnerung 3 Tage vor Falligkeit.`,
      };
    }
  }

  return tip;
}

export function localizeRecapTips(tips: RecapTip[] | null | undefined, language: string | null | undefined): RecapTip[] {
  const normalizedLanguage = normalizeLanguageCode(language, "en");
  if (!Array.isArray(tips) || tips.length === 0) return [];
  if (normalizedLanguage !== "de") return tips;
  return tips.map(localizeGermanTip);
}