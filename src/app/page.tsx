"use client";

import { useState, useRef, useEffect } from "react";
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
/*  NLP Helpers (Global + Pakistani + US Real Estate)                 */
/* ------------------------------------------------------------------ */

function detectIntent(text: string): string | null {
  const t = text.toLowerCase();
  if (/\b(rent|lease|renting|tenancy)\b/.test(t)) return "Rent";
  if (/\b(invest|investment|roi|flip|yield|capital\s+gain)\b/.test(t)) return "Invest";
  if (
    /\b(buy|purchase|looking\s+for|find\s+me|book\s+a\s+viewing|viewing|price|tour|visit|interested\s+in)\b/.test(
      t
    )
  ) {
    return "Buy";
  }
  return null;
}

const KNOWN_PROPERTY_KEYWORDS = [
  "villa",
  "house",
  "apartment",
  "condo",
  "flat",
  "penthouse",
  "townhouse",
  "studio",
  "duplex",
  "office",
  "warehouse",
  "bungalow",
  "shop",
  "plot",
  "commercial",
  "retail space",
  "land",
];

function detectPropertyType(text: string): string | null {
  const t = text.toLowerCase();
  const bedroomMatch = t.match(
    /(\d[\s-]?bed(?:room)?[\s-]?(?:villa|house|apartment|condo|flat|penthouse|townhouse|bungalow)?)/
  );
  if (bedroomMatch) {
    return bedroomMatch[0].replace(/\b\w/g, (c) => c.toUpperCase()).replace(/-/g, " ");
  }
  for (const kw of KNOWN_PROPERTY_KEYWORDS) {
    const re = new RegExp(`\\b${kw}(?:s|\\s+propert(?:y|ies))?\\b`, "i");
    if (re.test(t)) return kw.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  if (/\bemaar\b/i.test(t)) {
    return "Luxury Apartment / Villa";
  }
  return null;
}

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
  ["Doha", /\bdoha\b/i],
  ["Riyadh", /\briyadh\b/i],
  /* North America / UK */
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
  ["Texas", /\btexas\b/i],
  ["Florida", /\bflorida\b/i],
  ["California", /\bcalifornia\b/i],
  ["London", /\blondon\b/i],
  ["Toronto", /\btoronto\b/i],
];

const BRAND_QUALIFIERS: [string, RegExp][] = [
  ["Emaar", /\bemaar\b/i],
  ["Bahria Town", /\bbahria(?:\s+town)?\b/i],
  ["DHA", /\bdha\b/i],
];

function detectLocation(text: string, isShortReply: boolean): string | null {
  const found: string[] = [];
  for (const [name, re] of KNOWN_LOCATIONS) {
    if (re.test(text) && !found.includes(name)) found.push(name);
  }
  for (const [brand, re] of BRAND_QUALIFIERS) {
    if (re.test(text) && !found.includes(brand)) {
      if (found.length > 0) {
        const main = found[0];
        found[0] = `${main} (${brand})`;
      } else {
        found.push(brand);
      }
    }
  }
  if (found.length > 0) return found.join(", ");

  const phraseMatch = text.match(
    /\b(?:in|at|near|around|city\s*(?:is)?|location\s*(?:is)?)\s+([A-Za-z]+(?:\s[A-Za-z]+){0,2})/i
  );
  if (phraseMatch) {
    return phraseMatch[1].replace(/\b\w/g, (c) => c.toUpperCase());
  }

  if (isShortReply) {
    const clean = text.trim();
    const words = clean.split(/\s+/);
    if (words.length <= 3 && words.length >= 1 && /^[A-Za-z]/.test(words[0])) {
      return clean.replace(/\b\w/g, (c) => c.toUpperCase());
    }
  }
  return null;
}

function detectBudget(text: string): string | null {
  const usd = text.match(
    /\$[\d,]+(?:\.\d+)?\s*[kKmM]?|\b\d[\d,]*(?:\.\d+)?\s*(?:million|mil)\b/i
  );
  if (usd) {
    let raw = usd[0];
    if (/[kK]\s*$/.test(raw)) {
      const n = parseFloat(raw.replace(/[\$,kK\s]/g, ""));
      return "$" + (n * 1000).toLocaleString();
    }
    if (/[mM]\s*$/.test(raw)) {
      const n = parseFloat(raw.replace(/[\$,mM\s]/g, ""));
      return "$" + (n * 1000000).toLocaleString();
    }
    if (/million|mil/i.test(raw)) {
      const n = parseFloat(raw.replace(/[^0-9.]/g, ""));
      return "$" + (n * 1000000).toLocaleString();
    }
    if (!raw.startsWith("$")) raw = "$" + raw;
    return raw;
  }

  const local = text.match(/\b([\d,.]+)\s*(crore|cr|lakh|lac|k)\b/i);
  if (local) {
    const n = parseFloat(local[1].replace(/,/g, ""));
    const unit = local[2].toLowerCase();
    if (unit === "crore" || unit === "cr") return `PKR ${n} Crore`;
    if (unit === "lakh" || unit === "lac") return `PKR ${n} Lakh`;
    if (unit === "k") return "$" + (n * 1000).toLocaleString();
  }

  const prefixed = text.match(/\b(pkr|usd|rs\.?)\s*([\d,]+(?:\.\d+)?)/i);
  if (prefixed) {
    const cur = /pkr|rs/i.test(prefixed[1]) ? "PKR" : "$";
    const n = parseFloat(prefixed[2].replace(/,/g, ""));
    return `${cur} ${n.toLocaleString()}`;
  }

  if (/budget|price|cost|afford|range|under|below|around|max/i.test(text)) {
    const bare = text.match(/\b(\d[\d,]{2,})\b/);
    if (bare) {
      const n = parseFloat(bare[1].replace(/,/g, ""));
      if (n >= 1000) return "$" + n.toLocaleString();
    }
  }
  return null;
}

function detectPhone(text: string): string | null {
  const m = text.match(
    /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3,4}[-.\s]?\d{4}|\b\d{3}[-.\s]\d{4}\b|\b03\d{2}[-.\s]?\d{7}\b/
  );
  return m ? m[0] : null;
}

function detectEmail(text: string): string | null {
  const m = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return m ? m[0] : null;
}

/* ------------------------------------------------------------------ */
/*  Progress Calculation                                              */
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
/*  Anti-Loop Conversational State Machine                             */
/* ------------------------------------------------------------------ */

interface AIResult {
  text: string;
  nextStep: ConvoStep;
}

function pickDifferent(candidates: string[], lastText: string): string {
  const nonRepeat = candidates.filter((c) => c !== lastText);
  if (nonRepeat.length > 0) {
    return nonRepeat[Math.floor(Math.random() * nonRepeat.length)];
  }
  return candidates[0];
}

function generateAIResponse(
  lead: LeadData,
  userTurns: number,
  lastAiText: string,
  justFilled: string[]
): AIResult {
  const hasContact = lead.contact !== "—";
  const hasLocation = lead.location !== "—";
  const hasBudget = lead.budget !== "—";
  const hasProperty = lead.propertyType !== "—";

  /* Acknowledge newly extracted parameters */
  const ackParts: string[] = [];
  if (justFilled.includes("location") && hasLocation) {
    ackParts.push(`looking in **${lead.location}**`);
  }
  if (justFilled.includes("propertyType") && hasProperty) {
    ackParts.push(`a **${lead.propertyType}**`);
  }
  if (justFilled.includes("budget") && hasBudget) {
    ackParts.push(`budget of **${lead.budget}**`);
  }
  if (justFilled.includes("contact") && hasContact) {
    ackParts.push(`your contact number (**${lead.contact}**)`);
  }

  const ack =
    ackParts.length > 0
      ? `Got it — ${ackParts.join(", ")}! `
      : justFilled.length > 0
      ? "Noted! "
      : "";

  /* CASE 1: FULLY QUALIFIED (Contact + at least Location or Budget or 3+ turns) */
  if (hasContact && (hasLocation || hasBudget || userTurns >= 2)) {
    const summaryList: string[] = [];
    if (hasProperty) summaryList.push(`a **${lead.propertyType}**`);
    if (hasLocation) summaryList.push(`in **${lead.location}**`);
    if (hasBudget) summaryList.push(`with a budget around **${lead.budget}**`);

    const summaryText = summaryList.length > 0 ? ` for ${summaryList.join(" ")}` : "";
    const options = [
      `${ack}Perfect! I've locked in your preferences${summaryText} and forwarded your **VIP profile** to our senior agent. Expect a call or WhatsApp on **${lead.contact}** shortly! 🏡✨`,
      `${ack}All set! Your VIP concierge request${summaryText} has been routed directly to our luxury team. We will reach out to you on **${lead.contact}** within the hour! 🌟`,
      `${ack}Excellent! Your property brief${summaryText} is confirmed and synced to our CRM. Our senior advisor will contact you on **${lead.contact}** with off-market listings! 🔑`,
    ];
    return {
      text: pickDifferent(options, lastAiText),
      nextStep: "qualified",
    };
  }

  /* CASE 2: Contact provided, but Location/Budget/Property still missing */
  if (hasContact && !hasLocation && !hasBudget) {
    const options = [
      `${ack}To ensure our senior agent prepares the exact listings for your VIP viewing, which **city/area** and **property type** (e.g. Villa, Apartment, Commercial) are you interested in?`,
      `${ack}Which **city/area** and **property type** should we prepare for your private walkthrough?`,
      `${ack}Could you let me know your preferred **city** and estimated **budget range**?`,
    ];
    return {
      text: pickDifferent(options, lastAiText),
      nextStep: "details",
    };
  }

  /* CASE 3: Has Location, Budget, or Property, but Contact is missing */
  if ((hasLocation && hasBudget) || (hasLocation && hasProperty) || userTurns >= 3) {
    const summaryList: string[] = [];
    if (hasProperty) summaryList.push(`**${lead.propertyType}**`);
    if (hasLocation) summaryList.push(`in **${lead.location}**`);
    if (hasBudget) summaryList.push(`under **${lead.budget}**`);

    const summary = summaryList.length > 0 ? ` for ${summaryList.join(" ")}` : "";
    const options = [
      `${ack}Outstanding choice${summary}! To send you the curated VIP property portfolio and schedule a private tour, what is your **name** and **phone number**?`,
      `${ack}We have exclusive listings${summary}! Could you share your **phone number** or **email** so our senior specialist can send floor plans directly to you?`,
      `${ack}I've pulled up prime matches${summary}. Please share your **contact number** to lock in your VIP access! 📲`,
    ];
    return {
      text: pickDifferent(options, lastAiText),
      nextStep: "contact",
    };
  }

  /* CASE 4: Missing Location specifically */
  if (!hasLocation) {
    const options = [
      `${ack}Which **city or neighborhood** are you targeting (e.g., Karachi, Dubai, Miami, Austin)?`,
      `${ack}What is your preferred **location or area** for this property?`,
      `${ack}Great choice! Could you share your preferred **city/area** and estimated **budget**?`,
    ];
    return {
      text: pickDifferent(options, lastAiText),
      nextStep: "details",
    };
  }

  /* CASE 5: Missing Budget specifically */
  if (!hasBudget) {
    const options = [
      `${ack}What is your estimated **budget range** (in USD, PKR, or Crore)?`,
      `${ack}Could you let me know your approximate **target budget** so I can pull the right tier of properties?`,
      `${ack}What price range or maximum **budget** do you have in mind?`,
    ];
    return {
      text: pickDifferent(options, lastAiText),
      nextStep: "details",
    };
  }

  /* DEFAULT FALLBACK */
  const fallbackOptions = [
    `${ack}Could you share your preferred **location**, **budget**, or **contact number** so I can best assist you?`,
    `${ack}To tailor our luxury listings, please tell me your target **neighborhood** or approximate **budget**.`,
  ];
  return {
    text: pickDifferent(fallbackOptions, lastAiText),
    nextStep: "details",
  };
}

/* ------------------------------------------------------------------ */
/*  Bold Text Renderer                                                */
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
  const [typing, setTyping] = useState(false);
  const [progress, setProgress] = useState(0);
  const [toast, setToast] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [highlightField, setHighlightField] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [timestamp, setTimestamp] = useState("—");

  /* Mutable state refs guarantee zero stale closures */
  const leadRef = useRef<LeadData>(INITIAL_LEAD);
  const userTurnsRef = useRef(0);
  const lastAiTextRef = useRef("");

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimestamp(new Date().toISOString());
  }, [messages]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  useEffect(() => {
    setProgress(calcProgress(lead));
  }, [lead]);

  useEffect(() => {
    if (highlightField) {
      const t = setTimeout(() => setHighlightField(null), 1200);
      return () => clearTimeout(t);
    }
  }, [highlightField]);

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

  function handleSend(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || typing) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: msg,
    };
    setMessages((prev) => [...prev, userMsg]);
    if (!text) setInput("");

    const currentLead = leadRef.current;
    const turnNum = userTurnsRef.current + 1;
    userTurnsRef.current = turnNum;

    const isShortReply =
      msg.trim().split(/\s+/).length <= 3 && currentLead.location === "—";

    /* Lead Extraction */
    const newLead: LeadData = { ...currentLead };
    const justFilled: string[] = [];

    const intent = detectIntent(msg);
    if (intent && newLead.intent === "Pending") {
      newLead.intent = intent;
      justFilled.push("intent");
    }
    if (
      newLead.intent === "Pending" &&
      /\b(book|viewing|property|price|villa|house|apartment|plot|condo|commercial)\b/i.test(
        msg
      )
    ) {
      newLead.intent = "Buy";
      justFilled.push("intent");
    }

    const pt = detectPropertyType(msg);
    if (pt && newLead.propertyType === "—") {
      newLead.propertyType = pt;
      justFilled.push("propertyType");
    }

    const loc = detectLocation(msg, isShortReply);
    if (loc && newLead.location === "—") {
      newLead.location = loc;
      justFilled.push("location");
      if (newLead.propertyType === "—" && /\bemaar\b/i.test(msg)) {
        newLead.propertyType = "Luxury Apartment / Villa";
        justFilled.push("propertyType");
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

    /* Commit to ref and React state */
    leadRef.current = newLead;
    setLead(newLead);
    if (justFilled.length > 0) {
      setHighlightField(justFilled[justFilled.length - 1]);
    }

    /* AI Response Animation */
    setTyping(true);
    const prevContact = currentLead.contact;
    const savedLastAi = lastAiTextRef.current;

    setTimeout(() => {
      const aiResult = generateAIResponse(
        newLead,
        turnNum,
        savedLastAi,
        justFilled
      );
      lastAiTextRef.current = aiResult.text;

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: "ai",
        text: aiResult.text,
      };
      setMessages((prev) => [...prev, aiMsg]);
      setTyping(false);

      /* Trigger webhook toast when contact is captured */
      if (newLead.contact !== "—" && prevContact === "—") {
        setToast(true);

        /* Asynchronous webhook payload dispatch */
        fetch("/api/webhook", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            timestamp: new Date().toISOString(),
            source: "EstateLead AI",
            lead: newLead,
          }),
        }).catch(() => {
          /* Demo mode resilience */
        });
      }

      inputRef.current?.focus();
    }, 600 + Math.random() * 300);
  }

  function handleReset() {
    setMessages([GREETING_MSG]);
    setInput("");
    setLead(INITIAL_LEAD);
    setTyping(false);
    setProgress(0);
    setToast(false);
    setToastVisible(false);
    setHighlightField(null);
    setCopied(false);
    leadRef.current = INITIAL_LEAD;
    userTurnsRef.current = 0;
    lastAiTextRef.current = "";
  }

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

  const fieldClass = (field: string) =>
    `transition-all duration-500 ${
      highlightField === field
        ? "bg-emerald-500/20 ring-1 ring-emerald-400/60 scale-[1.02]"
        : ""
    }`;

  return (
    <div className="flex flex-1 flex-col min-h-screen bg-slate-950 text-slate-200 font-sans relative overflow-hidden">
      {/* Ambient decorative glow */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-emerald-500/10 blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-indigo-500/10 blur-[120px]" />
      </div>

      {/* Top Header Bar */}
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

      {/* Main Grid Layout */}
      <main className="relative z-10 flex flex-1 flex-col gap-4 overflow-hidden p-4 lg:grid lg:grid-cols-12 lg:gap-5 lg:p-5">
        {/* Left Column: Interactive Chat (7 cols) */}
        <section className="flex flex-col overflow-hidden rounded-2xl border border-slate-800/60 bg-slate-900/80 backdrop-blur-xl lg:col-span-7">
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

          {/* Quick-reply starters */}
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

          {/* Message List */}
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-700">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${
                  m.role === "user" ? "justify-end" : "justify-start"
                }`}
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

          {/* Chat Input Bar */}
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
              placeholder="Type your property requirements..."
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

        {/* Right Column: CRM Payload & Lead Inspector (5 cols) */}
        <aside className="flex flex-col gap-4 overflow-y-auto lg:col-span-5">
          {/* Card 1: Lead Qualification Status */}
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
                  100% Qualified
                </span>
              ) : (
                <span className="text-slate-500">Gathering information…</span>
              )}
            </div>
          </div>

          {/* Card 2: Real-Time Extracted Lead Data */}
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
                  [
                    "intent",
                    "Intent",
                    <ShieldCheck key="i" className="h-4 w-4 text-emerald-400" />,
                    lead.intent,
                  ],
                  [
                    "propertyType",
                    "Property Type",
                    <Building2 key="p" className="h-4 w-4 text-indigo-400" />,
                    lead.propertyType,
                  ],
                  [
                    "location",
                    "Location",
                    <MapPin key="l" className="h-4 w-4 text-rose-400" />,
                    lead.location,
                  ],
                  [
                    "budget",
                    "Budget",
                    <DollarSign key="b" className="h-4 w-4 text-amber-400" />,
                    lead.budget,
                  ],
                  [
                    "contact",
                    "Client Phone / Contact",
                    <Phone key="c" className="h-4 w-4 text-sky-400" />,
                    lead.contact,
                  ],
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
                  className={`flex items-center justify-between rounded-xl bg-slate-800/50 px-3.5 py-2.5 ${fieldClass(
                    field
                  )}`}
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

          {/* Card 3: Webhook JSON Payload */}
          <div className="rounded-2xl border border-slate-800/60 bg-slate-900/80 p-5 backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-emerald-400" />
                <h2 className="text-sm font-semibold text-white">
                  Live n8n / Google Sheets Webhook Payload
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

      {/* Webhook Confirmation Toast */}
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
