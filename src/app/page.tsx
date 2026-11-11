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
/*  NLP-lite helpers                                                   */
/* ------------------------------------------------------------------ */

function detectIntent(text: string): string | null {
  const t = text.toLowerCase();
  if (/\b(buy|purchase|looking for|find me)\b/.test(t)) return "Buy";
  if (/\b(rent|lease|renting)\b/.test(t)) return "Rent";
  if (/\b(invest|investment|roi|flip)\b/.test(t)) return "Invest";
  return null;
}

function detectPropertyType(text: string): string | null {
  const t = text.toLowerCase();
  const match = t.match(
    /(\d[\s-]?bed(?:room)?[\s-]?(?:villa|house|apartment|condo|flat|penthouse|townhouse)?|villa|house|apartment|condo|commercial\s*(?:propert(?:y|ies))?|penthouse|townhouse|flat|studio|duplex|office|warehouse|retail\s*space)/
  );
  if (match) {
    return match[0]
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .replace(/-/g, " ");
  }
  return null;
}

function detectLocation(text: string): string | null {
  const cities = [
    "Miami",
    "Austin",
    "New York",
    "Los Angeles",
    "Chicago",
    "Houston",
    "Phoenix",
    "San Diego",
    "Dallas",
    "Denver",
    "Seattle",
    "Boston",
    "Atlanta",
    "San Francisco",
    "Tampa",
    "Orlando",
    "Las Vegas",
    "Nashville",
    "Charlotte",
    "Portland",
    "Dubai",
    "London",
    "Toronto",
  ];
  const t = text.toLowerCase();
  for (const city of cities) {
    if (t.includes(city.toLowerCase())) return city;
  }
  const areaMatch = text.match(/\bin\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)/);
  if (areaMatch) return areaMatch[1];
  return null;
}

function detectBudget(text: string): string | null {
  const m = text.match(
    /\$[\d,]+(?:\.\d+)?[kKmM]?|\b\d{2,3}[kK]\b|\b\d[\d,]*(?:\.\d+)?\s*(?:million|mil|k)\b/i
  );
  if (m) {
    let raw = m[0];
    if (/\d+[kK]$/.test(raw)) {
      const num = parseInt(raw.replace(/[kK$,]/g, ""), 10);
      raw = "$" + (num * 1000).toLocaleString();
    } else if (/million|mil/i.test(raw)) {
      const num = parseFloat(raw.replace(/[^0-9.]/g, ""));
      raw = "$" + (num * 1_000_000).toLocaleString();
    }
    if (!raw.startsWith("$")) raw = "$" + raw;
    return raw;
  }
  return null;
}

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
/*  Conversational state machine                                       */
/* ------------------------------------------------------------------ */

function getAIResponse(lead: LeadData, step: ConvoStep): { text: string; nextStep: ConvoStep } {
  switch (step) {
    case "greeting": {
      const parts: string[] = [];
      if (lead.intent !== "Pending") parts.push(`**${lead.intent}**`);
      if (lead.propertyType !== "—") parts.push(`a **${lead.propertyType}**`);
      if (lead.location !== "—") parts.push(`in **${lead.location}**`);
      if (lead.budget !== "—") parts.push(`with a budget around **${lead.budget}**`);

      const hasDetailGap =
        lead.location === "—" || lead.budget === "—" || lead.propertyType === "—";

      if (parts.length > 0 && !hasDetailGap) {
        return {
          text: `Excellent taste! I see you're interested in ${parts.join(", ")}. To send you our curated VIP property list and schedule a private tour, could you share your **name** and **phone number**?`,
          nextStep: "contact",
        };
      }
      if (parts.length > 0) {
        const missing: string[] = [];
        if (lead.budget === "—") missing.push("estimated budget");
        if (lead.location === "—") missing.push("preferred city or neighborhood");
        if (lead.propertyType === "—") missing.push("property type");
        return {
          text: `Great choice — ${parts.join(", ")}! Could you also let me know your **${missing.join("** and **")}**?`,
          nextStep: "details",
        };
      }
      return {
        text: "I'd love to help! Could you tell me what **type of property** you're looking for, your **preferred city**, and your **budget range**?",
        nextStep: "details",
      };
    }

    case "details": {
      const hasDetailGap =
        lead.location === "—" || lead.budget === "—" || lead.propertyType === "—";
      if (hasDetailGap) {
        const missing: string[] = [];
        if (lead.budget === "—") missing.push("estimated budget");
        if (lead.location === "—") missing.push("preferred city");
        if (lead.propertyType === "—") missing.push("property type");
        return {
          text: `Thanks for the details! Could you also share your **${missing.join("** and **")}** so I can find the perfect match?`,
          nextStep: "details",
        };
      }
      if (lead.contact !== "—") {
        return {
          text: `Perfect! I've locked in your preferences and forwarded your **VIP profile** to our senior agent. Expect a call or WhatsApp message shortly! 🏡✨`,
          nextStep: "qualified",
        };
      }
      return {
        text: `Wonderful! I have some stunning options for you. To send you the curated VIP list and schedule a **private viewing**, could you share your **name** and **phone number**?`,
        nextStep: "contact",
      };
    }

    case "contact": {
      if (lead.contact !== "—") {
        return {
          text: `Perfect! I've locked in your preferences and forwarded your **VIP profile** to our senior agent. Expect a call or WhatsApp message shortly! 🏡✨`,
          nextStep: "qualified",
        };
      }
      return {
        text: `I just need your **phone number** or **email** to finalize your VIP profile and connect you with our top agent.`,
        nextStep: "contact",
      };
    }

    case "qualified":
      return {
        text: `Your VIP profile is active! Our agent will be reaching out soon. Is there anything else I can help you with?`,
        nextStep: "qualified",
      };
  }
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

      /* -- extract data -- */
      const newLead = { ...lead };
      let justHighlighted: string | null = null;

      const intent = detectIntent(msg);
      if (intent && newLead.intent === "Pending") {
        newLead.intent = intent;
        justHighlighted = "intent";
      }

      const pt = detectPropertyType(msg);
      if (pt && newLead.propertyType === "—") {
        newLead.propertyType = pt;
        justHighlighted = "propertyType";
      }

      const loc = detectLocation(msg);
      if (loc && newLead.location === "—") {
        newLead.location = loc;
        justHighlighted = "location";
      }

      const bud = detectBudget(msg);
      if (bud && newLead.budget === "—") {
        newLead.budget = bud;
        justHighlighted = "budget";
      }

      const phone = detectPhone(msg);
      const email = detectEmail(msg);
      if ((phone || email) && newLead.contact === "—") {
        newLead.contact = phone ?? email ?? "—";
        justHighlighted = "contact";
      }

      newLead.temperature = tempLabel(calcProgress(newLead));
      setLead(newLead);
      if (justHighlighted) setHighlightField(justHighlighted);

      /* -- AI response with typing delay -- */
      setTyping(true);
      setTimeout(() => {
        const { text: aiText, nextStep } = getAIResponse(newLead, step);
        setStep(nextStep);
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
    [input, lead, step]
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
