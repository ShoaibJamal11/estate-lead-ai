"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Bot,
  Send,
  RotateCcw,
  Building2,
  Phone,
  MapPin,
  DollarSign,
  User,
  Flame,
  CheckCircle2,
  Wifi,
  ClipboardCopy,
  Sparkles,
  MessageSquare,
  ShieldCheck,
  TrendingUp,
  Home,
  X,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ChatMessage {
  id: string;
  role: "user" | "ai";
  text: string;
}

interface LeadData {
  intent: string;
  propertyType: string;
  location: string;
  budget: string;
  contact: string;
  temperature: string;
}

type ConvoStep = "greeting" | "details" | "contact" | "qualified";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const QUICK_REPLIES = [
  "Looking for a 3-bed villa in Miami under $850k",
  "Do you have commercial properties in Austin?",
  "Book a viewing for tomorrow, my number is 555-0192",
];

const INITIAL_LEAD: LeadData = {
  intent: "Pending",
  propertyType: "—",
  location: "—",
  budget: "—",
  contact: "—",
  temperature: "Waiting",
};

const GREETING_MSG: ChatMessage = {
  id: "ai-0",
  role: "ai",
  text: "Hello! Welcome to **Apex Luxury Realty**. I'm your AI concierge, powered by Llama 3.3. Are you looking to **buy**, **rent**, or **invest** today?",
};

/* ------------------------------------------------------------------ */
/*  NLP-lite helpers (global + Pakistani + US real estate)              */
/* ------------------------------------------------------------------ */

function detectIntent(text: string): string | null {
  const t = text.toLowerCase();
  if (/\b(buy|purchase|looking\s+for|find\s+me|book\s+a\s+viewing|viewing|price)\b/.test(t)) return "Buy";
  if (/\b(rent|lease|renting|tenancy)\b/.test(t)) return "Rent";
  if (/\b(invest|investment|roi|flip|yield|capital\s+gain)\b/.test(t)) return "Invest";
  return null;
}

const KNOWN_PROPERTY_KEYWORDS = [
  "villa", "house", "apartment", "condo", "flat", "penthouse", "townhouse",
  "studio", "duplex", "office", "warehouse", "bungalow", "shop", "plot",
  "commercial", "retail space",
] as const;

function detectPropertyType(text: string): string | null {
  const t = text.toLowerCase();
  /* "3 bed villa", "2-bedroom apartment", etc. */
  const bedroomMatch = t.match(
    /(\d[\s-]?bed(?:room)?[\s-]?(?:villa|house|apartment|condo|flat|penthouse|townhouse|bungalow)?)/
  );
  if (bedroomMatch) {
    return bedroomMatch[0].replace(/\b\w/g, (c) => c.toUpperCase()).replace(/-/g, " ");
  }
  /* standalone property keywords */
  for (const kw of KNOWN_PROPERTY_KEYWORDS) {
    const re = new RegExp(`\\b${kw}(?:s|\\s+propert(?:y|ies))?\\b`, "i");
    if (re.test(t)) return kw.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return null;
}

/* --- Location ---------------------------------------------------- */

const KNOWN_LOCATIONS: [string, RegExp][] = [
  /* Pakistan / South Asia */
  ["Karachi", /\bkarachi\b/i],
  ["Lahore", /\blahore\b/i],
  ["Islamabad", /\bislamabad\b/i],
  ["Rawalpindi", /\brawalpindi\b/i],
  ["Faisalabad", /\bfaisalabad\b/i],
  ["Peshawar", /\bpeshawar\b/i],
  ["Multan", /\bmultan\b/i],
  ["DHA", /\bdha\b/i],
  ["Bahria Town", /\bbahria(?:\s+town)?\b/i],
  ["Clifton", /\bclifton\b/i],
  ["Gulshan", /\bgulshan\b/i],
  ["Defence", /\bdefen[cs]e\b/i],
  /* Middle East */
  ["Dubai", /\bdubai\b/i],
  ["Abu Dhabi", /\babu\s*dhabi\b/i],
  /* North America */
  ["Miami", /\bmiami\b/i],
  ["Austin", /\baustin\b/i],
  ["Dallas", /\bdallas\b/i],
  ["Houston", /\bhouston\b/i],
  ["New York", /\bnew\s*york\b/i],
  ["Los Angeles", /\blos\s*angeles\b/i],
  ["Chicago", /\bchicago\b/i],
  ["Seattle", /\bseattle\b/i],
  ["San Francisco", /\bsan\s*francisco\b/i],
  ["San Diego", /\bsan\s*diego\b/i],
  ["Denver", /\bdenver\b/i],
  ["Boston", /\bboston\b/i],
  ["Atlanta", /\batlanta\b/i],
  ["Tampa", /\btampa\b/i],
  ["Orlando", /\borlando\b/i],
  ["Las Vegas", /\blas\s*vegas\b/i],
  ["Nashville", /\bnashville\b/i],
  ["Charlotte", /\bcharlotte\b/i],
  ["Portland", /\bportland\b/i],
  ["Phoenix", /\bphoenix\b/i],
  /* US states (fallback) */
  ["Texas", /\btexas\b/i],
  ["Florida", /\bflorida\b/i],
  ["California", /\bcalifornia\b/i],
  /* Other international */
  ["London", /\blondon\b/i],
  ["Toronto", /\btoronto\b/i],
];

/* Developer / brand names that double as location qualifiers */
const BRAND_QUALIFIERS: [string, RegExp][] = [
  ["Emaar", /\bemaar\b/i],
  ["Bahria Town", /\bbahria(?:\s+town)?\b/i],
  ["DHA", /\bdha\b/i],
];

function detectLocation(text: string, isShortReply: boolean): string | null {
  const found: string[] = [];

  /* 1. Match known cities / areas */
  for (const [name, re] of KNOWN_LOCATIONS) {
    if (re.test(text) && !found.includes(name)) found.push(name);
  }

  /* 2. Append brand qualifiers that aren't already the main city */
  for (const [brand, re] of BRAND_QUALIFIERS) {
    if (re.test(text) && !found.includes(brand)) {
      /* If we already have a city, nest the brand: "Karachi (Emaar)" */
      if (found.length > 0) {
        const main = found[0];
        found[0] = `${main} (${brand})`;
      } else {
        found.push(brand);
      }
    }
  }

  if (found.length > 0) return found.join(", ");

  /* 3. Natural phrase: "in [Location]", "at [Location]", "city is [Location]" */
  const phraseMatch = text.match(
    /\b(?:in|at|near|around|city\s+is|location\s*(?:is)?)\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+){0,2})/
  );
  if (phraseMatch) return phraseMatch[1];

  /* 4. Short reply heuristic: if the bot just asked for a city and the user
        sends a 1–3 word reply, treat the whole thing as a location. */
  if (isShortReply) {
    const words = text.trim().split(/\s+/);
    if (words.length <= 3 && words.length >= 1 && /^[A-Za-z]/.test(words[0])) {
      return text
        .trim()
        .replace(/\b\w/g, (c) => c.toUpperCase());
    }
  }

  return null;
}

/* --- Emaar special case: also set property type if not already set -- */
function applyEmaarHeuristic(
  text: string,
  lead: LeadData
): { location: string | null; propertyType: string | null } {
  const t = text.toLowerCase();
  let location: string | null = null;
  let propertyType: string | null = null;

  if (/\bemaar\b/i.test(t)) {
    /* Try to pair Emaar with a city already detected */
    const city = detectLocation(text.replace(/emaar/i, "").trim(), false);
    location = city ? `${city} (Emaar)` : "Emaar";
    if (lead.propertyType === "—") {
      propertyType = "Luxury Apartment / Villa";
    }
  }
  return { location, propertyType };
}

/* --- Budget (USD + PKR + Crore / Lakh) ----------------------------- */

function detectBudget(text: string): string | null {
  /* $850k, $1.2M, $500,000 */
  const usd = text.match(
    /\$[\d,]+(?:\.\d+)?\s*[kKmM]?|\b\d[\d,]*(?:\.\d+)?\s*(?:million|mil)\b/i
  );
  if (usd) {
    let raw = usd[0];
    if (/[kK]\s*$/.test(raw)) {
      const n = parseFloat(raw.replace(/[\$,kK\s]/g, ""));
      return "$" + (n * 1_000).toLocaleString();
    }
    if (/[mM]\s*$/.test(raw)) {
      const n = parseFloat(raw.replace(/[\$,mM\s]/g, ""));
      return "$" + (n * 1_000_000).toLocaleString();
    }
    if (/million|mil/i.test(raw)) {
      const n = parseFloat(raw.replace(/[^0-9.]/g, ""));
      return "$" + (n * 1_000_000).toLocaleString();
    }
    if (!raw.startsWith("$")) raw = "$" + raw;
    return raw;
  }

  /* 5 crore, 80 lakh, 250k, 500K, etc. */
  const local = text.match(
    /\b([\d,.]+)\s*(crore|cr|lakh|lac|k)\b/i
  );
  if (local) {
    const n = parseFloat(local[1].replace(/,/g, ""));
    const unit = local[2].toLowerCase();
    if (unit === "crore" || unit === "cr") return `PKR ${(n * 10_000_000).toLocaleString()}`;
    if (unit === "lakh" || unit === "lac") return `PKR ${(n * 100_000).toLocaleString()}`;
    if (unit === "k") return "$" + (n * 1_000).toLocaleString();
  }

  /* "pkr 50000000", "usd 850000" */
  const prefixed = text.match(/\b(pkr|usd|rs\.?)\s*([\d,]+(?:\.\d+)?)/i);
  if (prefixed) {
    const cur = /pkr|rs/i.test(prefixed[1]) ? "PKR" : "$";
    const n = parseFloat(prefixed[2].replace(/,/g, ""));
    return `${cur} ${n.toLocaleString()}`;
  }

  /* Bare large number when context seems budget-related */
  if (/budget|price|cost|afford|range|under|below|around|max/i.test(text)) {
    const bare = text.match(/\b(\d[\d,]{2,})\b/);
    if (bare) {
      const n = parseFloat(bare[1].replace(/,/g, ""));
      if (n >= 1000) return "$" + n.toLocaleString();
    }
  }

  return null;
}

/* --- Contact ------------------------------------------------------- */

function detectPhone(text: string): string | null {
  const m = text.match(
    /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3,4}[-.\s]?\d{4}|\b\d{3}[-.\s]\d{4}\b/
  );
  return m ? m[0] : null;
}

function detectEmail(text: string): string | null {
  const m = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return m ? m[0] : null;
}

/* ------------------------------------------------------------------ */
/*  Conversational state machine (anti-loop, context-aware)            */
/* ------------------------------------------------------------------ */

/** Count how many lead fields are filled (not "—" / "Pending"). */
function filledCount(lead: LeadData): number {
  let n = 0;
  if (lead.intent !== "Pending") n++;
  if (lead.propertyType !== "—") n++;
  if (lead.location !== "—") n++;
  if (lead.budget !== "—") n++;
  if (lead.contact !== "—") n++;
  return n;
}

interface AIResult {
  text: string;
  nextStep: ConvoStep;
}

function getAIResponse(
  lead: LeadData,
  step: ConvoStep,
  userTurns: number,
  lastAiText: string,
  justFilledFields: string[],
): AIResult {
  /* ---------- helpers ---------- */
  const filled = filledCount(lead);
  const missingCore: string[] = [];
  if (lead.location === "—") missingCore.push("preferred city or area");
  if (lead.budget === "—") missingCore.push("budget range");
  if (lead.propertyType === "—") missingCore.push("type of property");

  const needContact = lead.contact === "—";
  const acknowledge = justFilledFields
    .map((f) => {
      if (f === "location") return `**${lead.location}**`;
      if (f === "budget") return `budget of **${lead.budget}**`;
      if (f === "propertyType") return `**${lead.propertyType}**`;
      if (f === "intent") return `looking to **${lead.intent}**`;
      return null;
    })
    .filter(Boolean);

  const ack = acknowledge.length > 0 ? `Got it — ${acknowledge.join(", ")}! ` : "";

  /* ---------- qualified (contact captured) ---------- */
  if (lead.contact !== "—") {
    return {
      text: `${ack}Perfect! I've locked in your preferences and forwarded your **VIP profile** to our senior agent. Expect a call or WhatsApp message shortly! 🏡✨`,
      nextStep: "qualified",
    };
  }

  /* ---------- enough info OR 3+ turns → ask for contact ---------- */
  if (filled >= 3 || userTurns >= 3) {
    const summary: string[] = [];
    if (lead.propertyType !== "—") summary.push(`a **${lead.propertyType}**`);
    if (lead.location !== "—") summary.push(`in **${lead.location}**`);
    if (lead.budget !== "—") summary.push(`around **${lead.budget}**`);

    const variants = [
      `${ack}Excellent! ${summary.length > 0 ? `I've noted ${summary.join(", ")}. ` : ""}To send you our curated VIP list and schedule a **private viewing**, could you share your **phone number** or **email**?`,
      `${ack}Wonderful — ${summary.length > 0 ? `${summary.join(", ")} is a fantastic choice. ` : ""}I just need your **phone number** to connect you with our top agent!`,
      `${ack}Great profile so far! ${summary.length > 0 ? `(${summary.join(", ")}) ` : ""}Please share your **contact number** so our senior agent can reach out with exclusive listings. 📲`,
    ];
    const text = pickNonRepeat(variants, lastAiText);
    return { text, nextStep: "contact" };
  }

  /* ---------- greeting / early turns → gather details ---------- */
  if (missingCore.length === 0) {
    /* All core filled but no contact yet */
    const text = `${ack}I've got everything I need. Just drop your **phone number** or **email** and I'll connect you with a VIP agent right away!`;
    return { text, nextStep: "contact" };
  }

  /* Some core fields missing */
  const ask = missingCore.slice(0, 2).join("** and **");
  const variants = [
    `${ack}To find your perfect match, could you share your **${ask}**?`,
    `${ack}Almost there! I just need your **${ask}** to pull up the best options for you.`,
    `${ack}Thanks for the details! What's your **${ask}**?`,
  ];
  const text = pickNonRepeat(variants, lastAiText);
  return { text, nextStep: step === "greeting" ? "details" : step };
}

/** Pick a response that differs from the last AI message to prevent loops. */
function pickNonRepeat(variants: string[], lastAiText: string): string {
  const different = variants.filter((v) => v !== lastAiText);
  return different.length > 0 ? different[0] : variants[0];
}

/* ------------------------------------------------------------------ */
/*  Progress calculation                                               */
/* ------------------------------------------------------------------ */

function calcProgress(lead: LeadData): number {
  let score = 0;
  if (lead.intent !== "Pending") score += 20;
  if (lead.propertyType !== "—") score += 15;
  if (lead.location !== "—") score += 20;
  if (lead.budget !== "—") score += 20;
  if (lead.contact !== "—") score += 25;
  return Math.min(score, 100);
}

function tempLabel(progress: number): string {
  if (progress >= 100) return "🔥 Hot VIP Lead";
  if (progress >= 75) return "Warm Lead";
  if (progress >= 35) return "Warming Up";
  return "Waiting";
}

/* ------------------------------------------------------------------ */
/*  Simple Markdown-ish bold renderer                                  */
/* ------------------------------------------------------------------ */

function renderBold(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function EstateLead() {
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING_MSG]);
  const [input, setInput] = useState("");
  const [lead, setLead] = useState<LeadData>(INITIAL_LEAD);
  const [step, setStep] = useState<ConvoStep>("greeting");
  const [typing, setTyping] = useState(false);
  const [progress, setProgress] = useState(0);
  const [toast, setToast] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [highlightField, setHighlightField] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [timestamp, setTimestamp] = useState("—");
  const [userTurns, setUserTurns] = useState(0);
  const [lastAiText, setLastAiText] = useState("");

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* keep timestamp in sync (avoids hydration mismatch from Date) */
  useEffect(() => {
    setTimestamp(new Date().toISOString());
  }, [messages]);

  /* auto-scroll */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  /* progress tracker */
  useEffect(() => {
    setProgress(calcProgress(lead));
  }, [lead]);

  /* highlight reset */
  useEffect(() => {
    if (highlightField) {
      const t = setTimeout(() => setHighlightField(null), 1200);
      return () => clearTimeout(t);
    }
  }, [highlightField]);

  /* toast auto-hide */
  useEffect(() => {
    if (toast) {
      requestAnimationFrame(() => setToastVisible(true));
      const t = setTimeout(() => {
        setToastVisible(false);
        setTimeout(() => setToast(false), 300);
      }, 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const handleSend = useCallback(
    (text?: string) => {
      const msg = (text ?? input).trim();
      if (!msg) return;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        text: msg,
      };
      setMessages((prev) => [...prev, userMsg]);
      if (!text) setInput("");

      const turnNum = userTurns + 1;
      setUserTurns(turnNum);

      /* -- determine if this is a short reply to a location question -- */
      const isShortReply =
        msg.trim().split(/\s+/).length <= 3 &&
        (step === "details" || step === "greeting") &&
        lead.location === "—";

      /* -- extract data -- */
      const newLead = { ...lead };
      const justFilled: string[] = [];

      const intent = detectIntent(msg);
      if (intent && newLead.intent === "Pending") {
        newLead.intent = intent;
        justFilled.push("intent");
      }
      /* Default intent to Buy for viewing / property / price mentions */
      if (newLead.intent === "Pending" && /\b(book|viewing|property|price|villa|house|apartment|plot|condo)\b/i.test(msg)) {
        newLead.intent = "Buy";
        justFilled.push("intent");
      }

      const pt = detectPropertyType(msg);
      if (pt && newLead.propertyType === "—") {
        newLead.propertyType = pt;
        justFilled.push("propertyType");
      }

      /* Emaar heuristic */
      if (/\bemaar\b/i.test(msg)) {
        const emaar = applyEmaarHeuristic(msg, newLead);
        if (emaar.location && newLead.location === "—") {
          newLead.location = emaar.location;
          justFilled.push("location");
        }
        if (emaar.propertyType && newLead.propertyType === "—") {
          newLead.propertyType = emaar.propertyType;
          justFilled.push("propertyType");
        }
      }

      /* Normal location detection (skip if Emaar already set it) */
      if (newLead.location === "—") {
        const loc = detectLocation(msg, isShortReply);
        if (loc) {
          newLead.location = loc;
          justFilled.push("location");
        }
      }

      const bud = detectBudget(msg);
      if (bud && newLead.budget === "—") {
        newLead.budget = bud;
        justFilled.push("budget");
      }

      const phone = detectPhone(msg);
      const email = detectEmail(msg);
      if ((phone || email) && newLead.contact === "—") {
        newLead.contact = phone ?? email ?? "—";
        justFilled.push("contact");
      }

      newLead.temperature = tempLabel(calcProgress(newLead));
      setLead(newLead);
      if (justFilled.length > 0) setHighlightField(justFilled[justFilled.length - 1]);

      /* -- AI response with typing delay -- */
      setTyping(true);
      setTimeout(() => {
        const { text: aiText, nextStep } = getAIResponse(newLead, step, turnNum, lastAiText, justFilled);
        setStep(nextStep);
        setLastAiText(aiText);
        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: "ai",
          text: aiText,
        };
        setMessages((prev) => [...prev, aiMsg]);
        setTyping(false);

        /* fire toast when contact captured */
        if (newLead.contact !== "—" && lead.contact === "—") {
          setToast(true);
        }

        /* Also attempt webhook (non-blocking, won't break demo if route missing) */
        if (newLead.contact !== "—" && lead.contact === "—") {
          fetch("/api/webhook", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              timestamp,
              source: "EstateLead AI",
              lead: newLead,
            }),
          }).catch(() => {
            /* silently ignore – demo mode */
          });
        }

        inputRef.current?.focus();
      }, 600 + Math.random() * 400);
    },
    [input, lead, step, userTurns, lastAiText, timestamp]
  );

  const handleReset = () => {
    setMessages([GREETING_MSG]);
    setInput("");
    setLead(INITIAL_LEAD);
    setStep("greeting");
    setTyping(false);
    setProgress(0);
    setToast(false);
    setToastVisible(false);
    setHighlightField(null);
    setCopied(false);
    setUserTurns(0);
    setLastAiText("");
  };

  const webhookPayload = JSON.stringify(
    {
      timestamp,
      source: "EstateLead AI → n8n Webhook",
      destination: "Google Sheets CRM",
      lead: {
        intent: lead.intent,
        property_type: lead.propertyType,
        location: lead.location,
        budget: lead.budget,
        contact: lead.contact,
        temperature: lead.temperature,
        qualification: progress >= 100 ? "QUALIFIED" : `${progress}%`,
      },
    },
    null,
    2
  );

  const handleCopy = () => {
    navigator.clipboard.writeText(webhookPayload).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  /* ---------------------------------------------------------------- */
  /*  Field highlight helper                                           */
  /* ---------------------------------------------------------------- */

  const fieldClass = (field: string) =>
    `transition-all duration-500 ${
      highlightField === field
        ? "bg-emerald-500/20 ring-1 ring-emerald-400/60 scale-[1.02]"
        : ""
    }`;

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="flex flex-1 flex-col min-h-screen bg-slate-950 text-slate-200 font-sans relative overflow-hidden">
      {/* ===== ambient glow ===== */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-emerald-500/10 blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-indigo-500/10 blur-[120px]" />
      </div>

      {/* ===== HEADER ===== */}
      <header className="relative z-10 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/60 bg-slate-900/70 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-indigo-500 shadow-lg shadow-emerald-500/20">
            <Home className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white sm:text-lg">
              EstateLead AI
            </h1>
            <p className="hidden text-[11px] leading-tight text-slate-400 sm:block">
              Automated 24/7 Property Concierge &amp; CRM Sync
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.15)]">
            <Wifi className="h-3 w-3 animate-pulse" />
            System Online&ensp;•&ensp;n8n + Llama&nbsp;3.3 Active
          </span>
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-700 hover:text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Demo
          </button>
        </div>
      </header>

      {/* ===== MAIN GRID ===== */}
      <main className="relative z-10 flex flex-1 flex-col gap-4 overflow-hidden p-4 lg:grid lg:grid-cols-12 lg:gap-5 lg:p-5">
        {/* ---------- LEFT COLUMN : CHAT ---------- */}
        <section className="flex flex-col overflow-hidden rounded-2xl border border-slate-800/60 bg-slate-900/80 backdrop-blur-xl lg:col-span-7">
          {/* chat header */}
          <div className="flex items-center gap-3 border-b border-slate-800/50 px-5 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/20">
              <MessageSquare className="h-4 w-4 text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">
                Apex Luxury Realty
              </p>
              <p className="text-[11px] text-slate-400">
                AI Property Concierge
              </p>
            </div>
            <span className="ml-auto flex items-center gap-1 text-[10px] text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>
          </div>

          {/* quick replies */}
          <div className="flex flex-wrap gap-2 border-b border-slate-800/30 px-4 py-2.5">
            {QUICK_REPLIES.map((qr) => (
              <button
                key={qr}
                onClick={() => handleSend(qr)}
                disabled={typing}
                className="rounded-full border border-slate-700/60 bg-slate-800/50 px-3 py-1 text-[11px] text-slate-300 transition hover:border-indigo-500/50 hover:bg-indigo-500/10 hover:text-indigo-300 disabled:opacity-40"
              >
                {qr}
              </button>
            ))}
          </div>

          {/* messages */}
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-700">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.role === "ai" && (
                  <div className="mr-2 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-indigo-500">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "rounded-br-md bg-indigo-600 text-white"
                      : "rounded-bl-md bg-slate-800/80 text-slate-200"
                  }`}
                >
                  {renderBold(m.text)}
                </div>
              </div>
            ))}

            {/* typing indicator */}
            {typing && (
              <div className="flex items-start gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-indigo-500">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-slate-800/80 px-4 py-3">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:0ms]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* input bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2 border-t border-slate-800/50 px-4 py-3"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              disabled={typing}
              className="flex-1 rounded-xl border border-slate-700/50 bg-slate-800/60 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 disabled:opacity-40"
            />
            <button
              type="submit"
              disabled={typing || !input.trim()}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-500 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </section>

        {/* ---------- RIGHT COLUMN : CRM PANEL ---------- */}
        <aside className="flex flex-col gap-4 overflow-y-auto lg:col-span-5">
          {/* CARD 1 — Qualification */}
          <div className="rounded-2xl border border-slate-800/60 bg-slate-900/80 p-5 backdrop-blur-xl">
            <div className="mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-white">
                Lead Qualification Status
              </h2>
            </div>
            <div className="relative h-3 overflow-hidden rounded-full bg-slate-800">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-500 to-indigo-500 transition-all duration-700 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-slate-400">{progress}% Complete</span>
              {progress >= 100 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  Qualified
                </span>
              ) : (
                <span className="text-slate-500">Gathering info…</span>
              )}
            </div>
          </div>

          {/* CARD 2 — Extracted Data */}
          <div className="rounded-2xl border border-slate-800/60 bg-slate-900/80 p-5 backdrop-blur-xl">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-400" />
              <h2 className="text-sm font-semibold text-white">
                Real-Time Extracted Lead Data
              </h2>
            </div>
            <div className="space-y-2.5">
              {(
                [
                  ["intent", "Intent", <ShieldCheck key="i" className="h-4 w-4 text-emerald-400" />, lead.intent],
                  ["propertyType", "Property Type", <Building2 key="p" className="h-4 w-4 text-indigo-400" />, lead.propertyType],
                  ["location", "Location", <MapPin key="l" className="h-4 w-4 text-rose-400" />, lead.location],
                  ["budget", "Budget", <DollarSign key="b" className="h-4 w-4 text-amber-400" />, lead.budget],
                  ["contact", "Contact", <Phone key="c" className="h-4 w-4 text-sky-400" />, lead.contact],
                  [
                    "temperature",
                    "Lead Temperature",
                    <Flame key="t" className="h-4 w-4 text-orange-400" />,
                    lead.temperature,
                  ],
                ] as [string, string, React.ReactNode, string][]
              ).map(([field, label, icon, value]) => (
                <div
                  key={field}
                  className={`flex items-center justify-between rounded-xl bg-slate-800/50 px-3.5 py-2.5 ${fieldClass(field)}`}
                >
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    {icon}
                    {label}
                  </div>
                  <span
                    className={`text-xs font-medium ${
                      value === "—" || value === "Pending" || value === "Waiting"
                        ? "text-slate-500"
                        : value === "🔥 Hot VIP Lead"
                          ? "text-orange-400"
                          : "text-white"
                    }`}
                  >
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* CARD 3 — Webhook Payload */}
          <div className="rounded-2xl border border-slate-800/60 bg-slate-900/80 p-5 backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-emerald-400" />
                <h2 className="text-sm font-semibold text-white">
                  n8n / Google Sheets Webhook Payload
                </h2>
              </div>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 rounded-lg border border-slate-700/50 bg-slate-800/60 px-2 py-1 text-[10px] text-slate-400 transition hover:text-white"
              >
                <ClipboardCopy className="h-3 w-3" />
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <pre
              suppressHydrationWarning
              className="max-h-60 overflow-auto rounded-xl bg-slate-950 p-4 text-[11px] leading-relaxed text-emerald-300 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-700"
            >
              {webhookPayload}
            </pre>
          </div>
        </aside>
      </main>

      {/* ===== TOAST ===== */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-slate-900/95 px-5 py-3.5 shadow-2xl shadow-emerald-500/10 backdrop-blur-xl transition-all duration-300 ${
            toastVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">
              Webhook Triggered
            </p>
            <p className="text-[11px] text-slate-400">
              Row Added to Google Sheets ✅
            </p>
          </div>
          <button
            onClick={() => {
              setToastVisible(false);
              setTimeout(() => setToast(false), 300);
            }}
            className="ml-2 text-slate-500 transition hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
