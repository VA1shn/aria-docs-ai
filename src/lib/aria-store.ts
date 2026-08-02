/**
 * ARIA client-side session store.
 *
 * Sessions, guided-intake transcripts and generated documents are persisted in
 * localStorage so the whole product flow is explorable without a backend.
 */

export const SECTION_KEYS = [
  "businessGoals",
  "users",
  "features",
  "workflows",
  "businessRules",
  "integrations",
  "reports",
  "nonFunctional",
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

export const SECTION_META: Record<SectionKey, { label: string; hint: string }> = {
  businessGoals: { label: "Business Goals", hint: "Why this project exists" },
  users: { label: "Users & Roles", hint: "Who will use the system" },
  features: { label: "Features", hint: "Core capabilities" },
  workflows: { label: "Workflows", hint: "Step-by-step processes" },
  businessRules: { label: "Business Rules", hint: "Constraints and logic" },
  integrations: { label: "Integrations", hint: "External systems" },
  reports: { label: "Reports & Analytics", hint: "Insights required" },
  nonFunctional: { label: "Non-functional", hint: "Scale, security, SLAs" },
};

export type ChatRole = "assistant" | "user";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  section?: SectionKey;
  createdAt: string;
};

export type SessionStatus = "draft" | "in_progress" | "documents_ready" | "approved";

export type DocKey = "brd" | "srs" | "userStories" | "acceptance" | "clientSummary";

export type Ambiguity = {
  id: string;
  section: SectionKey;
  note: string;
  resolved: boolean;
};

export type Session = {
  id: string;
  clientName: string;
  projectName: string;
  industry: string;
  brief: string;
  attachments: string[];
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  answers: Record<SectionKey, string[]>;
  askedCount: Record<SectionKey, number>;
  docs: Partial<Record<DocKey, string>> | null;
  ambiguities: Ambiguity[];
  approvalNote: string;
};

export const DOC_META: Record<DocKey, { label: string; short: string; description: string }> = {
  brd: {
    label: "Business Requirements Document",
    short: "BRD",
    description: "Objectives, scope, stakeholders and success metrics.",
  },
  srs: {
    label: "Software Requirements Specification",
    short: "SRS",
    description: "Functional and non-functional specification for engineering.",
  },
  userStories: {
    label: "User Stories",
    short: "Stories",
    description: "Backlog-ready stories grouped by epic.",
  },
  acceptance: {
    label: "Acceptance Criteria",
    short: "Criteria",
    description: "Given / When / Then criteria per story.",
  },
  clientSummary: {
    label: "Client Summary",
    short: "Summary",
    description: "Plain-English recap for business stakeholders.",
  },
};

const STORAGE_KEY = "aria.sessions.v1";
const AUTH_KEY = "aria.auth.v1";

const emptyRecord = <T,>(value: () => T) =>
  SECTION_KEYS.reduce(
    (acc, key) => {
      acc[key] = value();
      return acc;
    },
    {} as Record<SectionKey, T>,
  );

export const uid = () => Math.random().toString(36).slice(2, 10);

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function loadSessions(): Session[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = seedSessions();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    return JSON.parse(raw) as Session[];
  } catch {
    return [];
  }
}

function saveSessions(sessions: Session[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  emit();
}

export function getSession(id: string): Session | undefined {
  return loadSessions().find((s) => s.id === id);
}

export function createSession(input: {
  clientName: string;
  projectName: string;
  industry: string;
  brief: string;
  attachments: string[];
}): Session {
  const now = new Date().toISOString();
  const session: Session = {
    id: uid(),
    ...input,
    status: "in_progress",
    createdAt: now,
    updatedAt: now,
    messages: [],
    answers: emptyRecord<string[]>(() => []),
    askedCount: emptyRecord<number>(() => 0),
    docs: null,
    ambiguities: [],
    approvalNote: "",
  };
  const first = nextQuestion(session);
  if (first) session.messages.push(first);
  saveSessions([session, ...loadSessions()]);
  return session;
}

export function updateSession(id: string, patch: (session: Session) => Session) {
  const sessions = loadSessions().map((s) =>
    s.id === id ? { ...patch(s), updatedAt: new Date().toISOString() } : s,
  );
  saveSessions(sessions);
}

export function deleteSession(id: string) {
  saveSessions(loadSessions().filter((s) => s.id !== id));
}

/* ------------------------------------------------------------------ */
/* Guided intake engine                                                */
/* ------------------------------------------------------------------ */

const QUESTIONS: Record<SectionKey, string[]> = {
  businessGoals: [
    "Let's start with the outcome. **What business problem** should this project solve, and how will success be measured in 6 months?",
    "Which of those goals is the **primary** one if trade-offs are needed?",
  ],
  users: [
    "Who will actually use the system day to day? List the **roles** and roughly how many people are in each.",
    "Do any roles need **restricted access** to data or actions?",
  ],
  features: [
    "What are the **must-have capabilities** for the first release? Think in terms of what a user can do.",
    "Anything explicitly **out of scope** for phase one?",
  ],
  workflows: [
    "Walk me through the **main end-to-end workflow**, step by step, from trigger to completion.",
    "Where does the process need **approvals or handoffs** between roles?",
  ],
  businessRules: [
    "What **rules, validations or calculations** must the system always enforce?",
    "Are there **time-based rules** such as deadlines, escalations or retention periods?",
  ],
  integrations: [
    "Which **existing systems** must this connect to (CRM, ERP, payments, email, SSO)?",
    "For those integrations, is data **read-only, write, or two-way sync**?",
  ],
  reports: [
    "What **reports or dashboards** do stakeholders need, and who consumes them?",
    "Any **export formats** or scheduled deliveries required?",
  ],
  nonFunctional: [
    "Expected **scale**: concurrent users, data volume, and peak periods?",
    "Any **security, compliance, availability or performance** requirements we must design for?",
  ],
};

export const QUESTIONS_PER_SECTION = 2;

export function sectionProgress(session: Session, key: SectionKey) {
  const answered = session.answers[key]?.length ?? 0;
  return Math.min(100, Math.round((answered / QUESTIONS_PER_SECTION) * 100));
}

export function overallProgress(session: Session) {
  const total = SECTION_KEYS.reduce((sum, key) => sum + sectionProgress(session, key), 0);
  return Math.round(total / SECTION_KEYS.length);
}

export function currentSection(session: Session): SectionKey | null {
  return SECTION_KEYS.find((key) => (session.answers[key]?.length ?? 0) < QUESTIONS_PER_SECTION) ?? null;
}

function nextQuestion(session: Session): ChatMessage | null {
  const section = currentSection(session);
  if (!section) return null;
  const index = session.answers[section].length;
  const prompt = QUESTIONS[section][index] ?? QUESTIONS[section][0];
  const intro =
    index === 0
      ? `**${SECTION_META[section].label}** — ${SECTION_META[section].hint}.\n\n`
      : "";
  return {
    id: uid(),
    role: "assistant",
    content: `${intro}${prompt}`,
    section,
    createdAt: new Date().toISOString(),
  };
}

const VAGUE = ["etc", "and so on", "similar", "maybe", "some", "asap", "user friendly", "fast", "flexible"];

/** Records an answer, flags ambiguity and returns the follow-up question. */
export function answerCurrentQuestion(sessionId: string, text: string) {
  updateSession(sessionId, (session) => {
    const section = currentSection(session);
    if (!section) return session;

    const answers = { ...session.answers, [section]: [...session.answers[section], text.trim()] };
    const messages = [
      ...session.messages,
      {
        id: uid(),
        role: "user" as const,
        content: text.trim(),
        section,
        createdAt: new Date().toISOString(),
      },
    ];

    const ambiguities = [...session.ambiguities];
    const lowered = text.toLowerCase();
    const hit = VAGUE.find((word) => lowered.includes(word));
    if (hit || text.trim().length < 40) {
      ambiguities.push({
        id: uid(),
        section,
        note: hit
          ? `Vague wording detected ("${hit}") in ${SECTION_META[section].label} — needs a measurable definition.`
          : `Answer for ${SECTION_META[section].label} is very short and may need more detail.`,
        resolved: false,
      });
    }

    const draft: Session = { ...session, answers, messages, ambiguities };
    const follow = nextQuestion(draft);
    if (follow) {
      draft.messages = [...draft.messages, follow];
    } else {
      draft.messages = [
        ...draft.messages,
        {
          id: uid(),
          role: "assistant",
          content:
            "That covers all eight requirement areas. 🎉\n\nI have enough to draft the **BRD, SRS, user stories, acceptance criteria and client summary**. Generate documents when you're ready.",
          createdAt: new Date().toISOString(),
        },
      ];
    }
    return draft;
  });
}

/* ------------------------------------------------------------------ */
/* Document generation                                                 */
/* ------------------------------------------------------------------ */

const bullets = (items: string[]) =>
  items.length ? items.map((item) => `- ${item}`).join("\n") : "- _Not captured during intake._";

export function buildDocuments(session: Session): Record<DocKey, string> {
  const a = session.answers;
  const header = `# ${session.projectName}\n\n**Client:** ${session.clientName}  \n**Industry:** ${session.industry || "General"}  \n**Prepared by:** ARIA — AI Requirements Intelligence Assistant  \n**Date:** ${new Date().toLocaleDateString()}\n`;

  const brd = `${header}
## 1. Executive Summary

${session.brief || "This document captures the business requirements gathered during the ARIA guided intake session."}

## 2. Business Goals & Success Metrics

${bullets(a.businessGoals)}

## 3. Stakeholders & Users

${bullets(a.users)}

## 4. Scope

### In scope
${bullets(a.features)}

### Key business processes
${bullets(a.workflows)}

## 5. Business Rules

${bullets(a.businessRules)}

## 6. Reporting Requirements

${bullets(a.reports)}

## 7. Assumptions & Open Questions

${session.ambiguities.length ? bullets(session.ambiguities.map((f) => f.note)) : "- No open ambiguities flagged."}
`;

  const srs = `# Software Requirements Specification — ${session.projectName}

## 1. Purpose

Defines functional and non-functional requirements for ${session.projectName} (${session.clientName}).

## 2. Actors

${bullets(a.users)}

## 3. Functional Requirements

${
  a.features.length
    ? a.features
        .flatMap((feature, i) =>
          feature
            .split(/[\n,;]+/)
            .map((f) => f.trim())
            .filter(Boolean)
            .map((f, j) => `**FR-${i + 1}.${j + 1}** The system shall ${f.replace(/^the system (shall|should) /i, "")}.`),
        )
        .join("\n\n")
    : "_No features captured._"
}

## 4. Workflows

${bullets(a.workflows)}

## 5. Business Logic & Validation

${bullets(a.businessRules)}

## 6. Integrations

${bullets(a.integrations)}

## 7. Reporting & Analytics

${bullets(a.reports)}

## 8. Non-functional Requirements

${bullets(a.nonFunctional)}

## 9. Traceability

| Requirement area | Items captured |
| --- | --- |
${SECTION_KEYS.map((key) => `| ${SECTION_META[key].label} | ${a[key].length} |`).join("\n")}
`;

  const stories = `# User Stories — ${session.projectName}

${
  a.features.length
    ? a.features
        .map((feature, i) => {
          const role = (a.users[0] ?? "user").split(/[\n,;]+/)[0]?.trim() || "user";
          return `## Epic ${i + 1}\n\n**US-${i + 1}.1** — As a **${role}**, I want to ${feature
            .replace(/^i want to /i, "")
            .trim()}, so that the business goal "${(a.businessGoals[0] ?? "the desired outcome").slice(0, 90)}" is achieved.\n\n- Priority: ${i === 0 ? "Must have" : "Should have"}\n- Estimate: ${3 + i * 2} points`;
        })
        .join("\n\n")
    : "_No features captured._"
}

## Workflow stories

${a.workflows.map((w, i) => `**US-W${i + 1}** — As a user, I need the workflow "${w.slice(0, 120)}" supported end to end.`).join("\n\n") || "_None captured._"}
`;

  const acceptance = `# Acceptance Criteria — ${session.projectName}

${
  a.features.length
    ? a.features
        .map(
          (feature, i) => `## US-${i + 1}.1

**Given** an authenticated user with the required role  
**When** they use the capability "${feature.slice(0, 100)}"  
**Then** the action completes successfully and is recorded in the audit trail.

**Given** invalid or incomplete input  
**When** the user submits the form  
**Then** inline validation messages are shown and no data is persisted.`,
        )
        .join("\n\n")
    : "_No features captured._"
}

## Rule-based criteria

${a.businessRules.map((rule, i) => `**AC-R${i + 1}** — The system must always enforce: ${rule}`).join("\n\n") || "_None captured._"}

## Non-functional criteria

${a.nonFunctional.map((nf, i) => `**AC-N${i + 1}** — ${nf}`).join("\n\n") || "_None captured._"}
`;

  const clientSummary = `# What we're building for ${session.clientName}

## In plain English

${session.brief || `We are building ${session.projectName}, a solution tailored to ${session.clientName}.`}

## What you told us matters most

${bullets(a.businessGoals)}

## Who will use it

${bullets(a.users)}

## What it will do

${bullets(a.features)}

## How work will flow

${bullets(a.workflows)}

## What it connects to

${bullets(a.integrations)}

## What you'll be able to measure

${bullets(a.reports)}

## Things we still need to confirm

${session.ambiguities.filter((f) => !f.resolved).length ? bullets(session.ambiguities.filter((f) => !f.resolved).map((f) => f.note)) : "- Nothing outstanding — we're ready to proceed."}

---

_Prepared by ARIA on ${new Date().toLocaleDateString()}. Please review and approve so the delivery team can begin._
`;

  return { brd, srs, userStories: stories, acceptance, clientSummary };
}

export function generateDocuments(sessionId: string) {
  updateSession(sessionId, (session) => ({
    ...session,
    docs: buildDocuments(session),
    status: session.status === "approved" ? "approved" : "documents_ready",
  }));
}

/* ------------------------------------------------------------------ */
/* Auth (local demo session)                                           */
/* ------------------------------------------------------------------ */

export type AuthUser = { name: string; email: string };

export function getAuthUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AUTH_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function signIn(email: string, name?: string) {
  const user: AuthUser = {
    email,
    name:
      name ??
      (email.split("@")[0] ?? "user").replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
  };
  window.localStorage.setItem(AUTH_KEY, JSON.stringify(user));
  emit();
  return user;
}

export function signOut() {
  window.localStorage.removeItem(AUTH_KEY);
  emit();
}

/* ------------------------------------------------------------------ */
/* Seed data                                                           */
/* ------------------------------------------------------------------ */

function seedSessions(): Session[] {
  const base = (over: Partial<Session>): Session => {
    const now = new Date().toISOString();
    return {
      id: uid(),
      clientName: "",
      projectName: "",
      industry: "",
      brief: "",
      attachments: [],
      status: "in_progress",
      createdAt: now,
      updatedAt: now,
      messages: [],
      answers: emptyRecord<string[]>(() => []),
      askedCount: emptyRecord<number>(() => 0),
      docs: null,
      ambiguities: [],
      approvalNote: "",
      ...over,
    };
  };

  const complete = base({
    clientName: "Northwind Logistics",
    projectName: "Freight Visibility Portal",
    industry: "Logistics & Supply Chain",
    brief:
      "Northwind wants a customer-facing portal where shippers can track freight in real time, download proof of delivery and raise exceptions without calling support.",
    status: "documents_ready",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    answers: {
      businessGoals: [
        "Cut inbound support calls about shipment status by 40% within two quarters.",
        "Reducing support load is primary; self-service POD download is secondary.",
      ],
      users: [
        "Shipper admins (approx. 400), shipper staff (2,000), Northwind support agents (35), operations managers (12).",
        "Support agents can view all accounts; shipper staff only see their own company's shipments.",
      ],
      features: [
        "Real-time shipment tracking with map and milestone timeline",
        "Proof of delivery download, exception reporting and email notifications",
      ],
      workflows: [
        "Shipment created in TMS, synced to portal, milestones update as scans occur, delivery closes the record and POD becomes available.",
        "Exceptions raised by a shipper route to the assigned support agent for acknowledgement within 4 hours.",
      ],
      businessRules: [
        "A shipment cannot be marked delivered without a captured POD signature or photo.",
        "Exceptions unacknowledged after 4 business hours escalate to the operations manager.",
      ],
      integrations: [
        "Northwind TMS, SAP for invoicing, Azure AD SSO, Twilio for SMS alerts.",
        "TMS is two-way sync; SAP is read-only; SSO is authentication only.",
      ],
      reports: [
        "On-time delivery performance by lane, exception volume by cause, portal adoption per account.",
        "CSV and PDF export, plus a weekly scheduled email to operations managers.",
      ],
      nonFunctional: [
        "1,200 concurrent users at peak, 5 million shipment records, peaks Monday mornings.",
        "SOC 2 alignment, 99.9% availability, sub-second tracking search, data residency in the EU.",
      ],
    },
    ambiguities: [
      {
        id: uid(),
        section: "features",
        note: 'Vague wording detected ("notifications") — confirm channels and trigger events.',
        resolved: false,
      },
      {
        id: uid(),
        section: "reports",
        note: "Confirm whether adoption reporting needs per-user detail or account-level only.",
        resolved: false,
      },
    ],
  });
  complete.docs = buildDocuments(complete);
  complete.messages = [
    {
      id: uid(),
      role: "assistant",
      content:
        "**Business Goals** — Why this project exists.\n\nLet's start with the outcome. **What business problem** should this project solve?",
      section: "businessGoals",
      createdAt: complete.createdAt,
    },
    {
      id: uid(),
      role: "user",
      content: complete.answers.businessGoals[0] ?? "",
      section: "businessGoals",
      createdAt: complete.createdAt,
    },
    {
      id: uid(),
      role: "assistant",
      content:
        "All eight requirement areas are covered. Documents have been generated and are ready for review.",
      createdAt: complete.updatedAt,
    },
  ];

  const inProgress = base({
    clientName: "Meridian Health",
    projectName: "Patient Intake Automation",
    industry: "Healthcare",
    brief:
      "Replace paper intake forms in 12 clinics with a digital pre-visit questionnaire that feeds the EMR.",
    status: "in_progress",
    updatedAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    answers: {
      businessGoals: [
        "Reduce average patient check-in time from 11 minutes to under 4 minutes.",
        "Check-in speed is primary; staff data-entry reduction is secondary.",
      ],
      users: ["Patients, front-desk staff, clinic managers, compliance officer."],
      features: [],
      workflows: [],
      businessRules: [],
      integrations: [],
      reports: [],
      nonFunctional: [],
    },
    messages: [
      {
        id: uid(),
        role: "assistant",
        content:
          "**Users & Roles** — Who will use the system.\n\nDo any roles need **restricted access** to data or actions?",
        section: "users",
        createdAt: new Date().toISOString(),
      },
    ],
  });

  const draft = base({
    clientName: "Volt Retail Group",
    projectName: "Loyalty Programme Revamp",
    industry: "Retail & E-commerce",
    brief: "Tiered loyalty programme with points, rewards and in-store redemption.",
    status: "draft",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 70).toISOString(),
  });

  const approved = base({
    clientName: "Atlas Manufacturing",
    projectName: "Shop-floor Quality Tracker",
    industry: "Manufacturing",
    brief: "Digitise quality inspections on three production lines with defect analytics.",
    status: "approved",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 9).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6).toISOString(),
    answers: {
      businessGoals: ["Cut defect escape rate by 30%.", "Defect reduction is the primary goal."],
      users: ["Line inspectors, quality engineers, plant manager.", "Only engineers can void an inspection."],
      features: ["Digital inspection checklists", "Defect photo capture and analytics dashboard"],
      workflows: ["Inspector opens checklist, records results, defects route to engineer review.", "Engineer approval closes the batch."],
      businessRules: ["A batch cannot ship with an open critical defect.", "Inspections lock 24 hours after submission."],
      integrations: ["MES system, Power BI.", "MES two-way, Power BI read-only."],
      reports: ["Defect Pareto by line and shift.", "PDF export weekly."],
      nonFunctional: ["120 concurrent tablet users.", "Offline capture with sync, 99.5% availability."],
    },
    approvalNote: "Approved by client sponsor on the review call.",
  });
  approved.docs = buildDocuments(approved);

  return [inProgress, complete, draft, approved];
}
