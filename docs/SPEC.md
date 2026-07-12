# Specifications

> Working title. Naming is open — the spec uses "PaceKeeper" as a placeholder throughout.
> 

**Document purpose:** This spec defines the problem, the user, the positioning, and the exact scope of the version shipping by July 15. It deliberately contains no technical decisions — stack, schema, and API contracts live in the technical design document that follows. A separate Vision & Roadmap section at the end captures everything intentionally deferred.

**One-line pitch:** Set a goal and a date. PaceKeeper builds your study plan, quizzes you daily, and tells you the truth about whether you're on track.

---

## 1. The Problem

Self-directed learners — distance-learning students, certification candidates, language learners, interview preppers — study without any of the infrastructure that keeps institutional learners on track. There is no professor quizzing them, no cohort creating social pressure, no scheduled assessments forcing recall. They consume material (lecture videos, notes, textbooks) and review it by re-reading, which research consistently shows creates an illusion of mastery: recognition feels like knowledge, but recall — producing the answer from nothing, which is what the exam demands — was never practiced.

The result is a familiar failure pattern. The learner studies steadily for weeks, feels prepared, and discovers in the final days (or in the exam hall) that entire topics never actually stuck. By the time the gap is visible, there is no time left to close it.

Two evidence-backed techniques solve the retention half of this problem: active recall and spaced repetition. But the tools that implement them fail this user in a second, subtler way — none of them understand **deadlines**. Anki will happily schedule a review for three weeks after your exam date. No existing tool answers the question the self-learner actually has, which is not "what should I review today?" but:

**"Will I be ready by the date that matters — and if not, what do I do about it right now?"**

### 1.1 Why existing tools fail

Each major alternative solves an adjacent problem and leaves this one open. The gap is not features; it is the organizing principle.

- **Anki** implements spaced repetition well but is card-shaped, deadline-blind, and analytically silent. It cannot tell you whether you will be ready by a date, and its scheduling never compresses or triages as time runs out. Its UX also has a notoriously steep learning curve.
- **Quizlet** is built for classroom memorization sets — shared decks, term-definition pairs. It has no concept of a personal goal, a plan, or readiness over time.
- **NotebookLM** is a source-understanding tool. It is excellent at "what does this document say?" — chat, summaries, even one-off quizzes. But everything in it is session-scoped: it has no memory of what you got wrong last week, no schedule, no concept of time, and no stake in whether you retain anything. It answers "do I understand this?" PaceKeeper answers "will I still know it on October 20?"
- **Notion / notes apps** store material. Storage is not retention.

### 1.2 The opinionated take

Existing tools optimize for *reviewing content*. PaceKeeper optimizes for *readiness by a date*. The first-class objects are not cards — they are a goal, its deadline, and the learner's measured strength per topic. Everything the product does (what to study today, how intensely to schedule reviews, what to cut when time runs short) derives from one continuously recomputed question: *given what this learner knows and how many days remain, will they make it?*

This is also what makes PaceKeeper an **accountability partner** rather than a flashcard app. It notices when you slip, recalibrates honestly, and — when you are too far behind to cover everything — tells you the truth and proposes what is worth saving, instead of letting you fail silently.

---

## 2. The User

### 2.1 Primary persona

**The self-directed learner with a date.** Representative example: a distance-learning computer science student preparing for an end-of-term exam. They study alone, primarily from lecture videos and their own structured notes. They are motivated but unsupervised; their failure mode is not laziness but *unmeasured drift* — skipped days that compound invisibly, and weak topics that never get flagged because nothing tests them.

The persona generalizes to anyone whose learning has a deadline: certification candidates (AWS, CFA, driving theory), language learners with a trip or test coming, developers prepping for interviews.

### 2.2 Job-to-be-done

*"When I have studied a topic, I want the system to quiz me at the right moments and tell me honestly which topics are weak and whether I am on pace — so that I walk into the exam knowing exactly where I stand, with no surprises."*

### 2.3 What the user is hiring PaceKeeper to replace

They are firing three things at once: re-reading (their current retention method), their own guilt-based scheduling (their current accountability method), and gut feel (their current readiness assessment). PaceKeeper replaces all three with practice, a plan, and a number.

---

## 3. Product Principles

These four principles resolve design disagreements throughout the build. When a decision is unclear, the principle wins.

1. **The date is the organizing principle.** Every screen, metric, and scheduling decision exists in service of "ready by the goal date." A feature that does not serve that question does not belong in v1.
2. **AI proposes, the user confirms, the engine is deterministic.** AI is an on-ramp — it drafts plans and questions to solve the cold-start problem. Nothing AI produces enters the system without user review, and once confirmed, everything runs on deterministic logic. The product is fully usable with AI switched off.
3. **Honesty over comfort.** The dashboard never inflates readiness. When the user is behind, the product says so — but always paired with a constructive next move (recalibration or triage), never a dead-end alarm.
4. **The stranger test.** A first-time visitor on the demo account must understand the product and complete the core loop — see today's work, answer questions, watch readiness update — in under 60 seconds, with no manual.

---

## 4. Scope

### 4.1 In scope for v1 (ships July 15)

Each capability below is shipped complete — every state designed, every flow finished — or not at all.

**Goals.** The top-level object. A goal has a name, a goal date, and contains the full learning structure. The homepage lists all goals with their on-track status at a glance.

**Structure: goal → module → topic.** A three-level hierarchy. Modules group related material ("Graph Algorithms"); topics are the atomic unit that questions attach to and readiness is measured against ("Dijkstra's algorithm"). Structure can be created two ways: manually, or by pasting notes / uploading a PDF and letting AI propose a breakdown, which the user edits and confirms before anything is saved.

**The plan.** When a goal has structure and a date, PaceKeeper distributes topics across the available days into a study plan. The plan is visible, editable, and — critically — alive: it recomputes as reality diverges from it (see recalibration).

**Question bank: MCQs and flashcards.** Two question types per topic. MCQs (one correct option among four) are auto-graded and test recognition. Flashcards (prompt → reveal answer → self-rate: got it / partially / missed it) test true recall, which is what exams demand. Questions are created manually or drafted by AI from the user's material; AI drafts always pass through a review-and-approve step before entering the bank.

**The daily loop: the Today view.** The single answer to "what should I do right now?" It combines two things: reviews that are due (spaced repetition, weighted by time remaining and topic weakness) and the day's planned topics. Completing the Today view is the daily unit of accountability.

**Quiz on demand.** At any moment, the user can quiz themselves at any level of the hierarchy — a single topic, a whole module, or the entire goal — independent of the schedule.

**Slip recalibration.** When days are missed, the plan silently redistributes remaining work across remaining days and surfaces the new required pace. This is routine, not an alarm.

**Triage mode.** When the required pace crosses a feasibility threshold — the honest "you will not cover everything" moment — PaceKeeper switches from redistribution to triage: it ranks remaining topics by weakness and weight, proposes a cut-down plan focused on what is most worth saving, and asks the user to confirm. Behind is a state; triage is the constructive response to it.

**The dashboard.** Per-goal. Answers one question above the fold — *on track or not* — supported by: readiness score per topic, weak-point list, days remaining vs. work remaining, and consistency (streak / days active). Readiness is derived from measured performance, never from self-reported confidence or time spent.

**Notes.** One free-form notes field per topic — a scratch corner for the learner's own thinking, autosaved. Deliberately minimal: PaceKeeper is a retention system, not a notes workspace.

**Table stakes.** Real authentication, a seeded demo account, all four view states (loading / empty / error / success) on every screen, responsive down to mobile, keyboard operable, accessible.

### 4.2 Explicitly out of scope for v1

Each item below is deferred with a reason, not forgotten. All appear in the Vision & Roadmap section.

- **External reminders (WhatsApp, Google Calendar, Notion).** Integration-heavy, invisible in a live demo, zero contribution to the core question. The Today view carries the daily accountability unit in v1.
- **Video ingestion / transcription.** A multi-day pipeline (upload, audio extraction, speech-to-text, long-job handling) for one input format. v1 accepts pasted text and PDFs; users watching video lectures paste the transcript, which most platforms expose in one click.
- **Mind maps.** A comprehension tool, not a retention tool — it serves "do I understand?" rather than "will I remember by the date?" It also pulls the product's identity toward NotebookLM's territory rather than away from it.
- **Session-level note history / rich notes workspace.** The moment notes become a workspace, the product starts competing with Notion. One field per topic is the v1 position.

---

## 5. Workflows

This section describes how the product behaves — the system's side of the story. User-facing flows follow in section 6.

### 5.1 Goal creation and planning

A new goal needs three things: a name, a date, and structure. The user provides the first two directly. For structure, two paths converge on the same outcome:

1. **Manual path.** The user creates modules and topics by hand. Suits learners who already have a syllabus in mind.
2. **AI-assisted path.** The user pastes notes or uploads a PDF. AI proposes a module → topic breakdown and a draft mapping of topics across the days available. The proposal is presented as an editable draft — the user renames, reorders, merges, deletes, and then confirms. Only on confirmation does the structure become real.

Once structure and date exist, the plan is computed: topics distributed across available days, weighted so that heavier modules get proportionally more days and the final stretch before the goal date is reserved for review rather than new material.

### 5.2 Question creation

Questions attach to topics. Two creation paths, one gate:

1. **Manual:** the user writes MCQs or flashcards directly in the question editor.
2. **AI-drafted:** for any topic with source material, AI drafts a batch of questions (MCQs with plausible distractors and explanations; flashcards with model answers). Drafts land in a review queue — the same editor, pre-filled — where the user approves, edits, or discards each one. Nothing unreviewed enters the bank.

### 5.3 The scheduling engine

The engine is deterministic and runs on three inputs: the plan, the question bank, and the learner's attempt history. Its output each day is the Today view. Its behavior:

- Every question carries a per-learner strength that rises with correct/confident answers and falls with misses, decaying over time.
- Review intervals follow spaced-repetition logic, but compressed by time-to-goal-date: the same question is scheduled more aggressively when the date is near than when it is far.
- Topic readiness is an aggregate of question strengths within the topic, surfaced on the dashboard.
- The Today view = due reviews + today's planned new topics, capped at a sane daily volume.

### 5.4 Recalibration and triage

The plan is compared against reality continuously. Three regimes:

1. **On pace:** no intervention. The dashboard shows on-track.
2. **Slipping (recoverable):** missed days cause the remaining topics to be redistributed across remaining days. The Today view grows accordingly; the dashboard shows the new required pace and frames it neutrally ("catch-up pace: X topics/day").
3. **Behind (unrecoverable at current scope):** when required pace crosses the feasibility threshold, PaceKeeper stops pretending. It tells the user plainly that full coverage is no longer realistic, and proposes a triaged plan — remaining topics ranked by a combination of weakness (low readiness) and weight (module importance), with the lowest-value items cut. The user reviews and confirms the triaged plan, exactly as they confirmed the original. The tone throughout is coach, not alarm: the message is always "here is what is still winnable."

### 5.5 Measurement (built in from day one)

The product ships instrumented. Key events — goal created, plan confirmed, questions approved, reviews completed, recalibration triggered, triage accepted, dashboard viewed — are tracked from launch, with a written measurement plan (activation, retention proxy, core-loop health, and behavior at the "behind" moment) defining how post-launch data would drive iteration. No product decisions in v1 depend on this data; the point is that the feedback loop exists before the users do.

---

## 6. User Flows

Each flow below is written as the user experiences it. Every screen involved must handle all four states: loading, empty, error, success.

### 6.1 First-run: from signup to a living plan

1. User signs up (or enters via the demo login) and lands on an empty homepage whose empty state has one job: "Create your first goal."
2. User names the goal and sets the goal date. A visible countdown appears immediately — the date is the product's spine and the UI says so from second one.
3. User chooses a path: "Build structure myself" or "Import from my notes."
4. On the import path: paste text or upload a PDF → a working state with honest progress → AI's proposed breakdown appears as an editable draft (modules, topics, day mapping).
5. User edits the draft — rename, merge, reorder, delete — and confirms. The plan is born.
6. AI offers to draft questions for the first topics; drafts open in the review queue; user approves a starter set.
7. User lands on the dashboard: all topics at unmeasured readiness, plan laid out, Today view pointing at day one. Time from signup to living plan: under five minutes.

### 6.2 The daily loop (the habit)

1. User opens PaceKeeper and lands on the Today view: due reviews + today's planned topics, with a completable, finite shape ("14 questions · 2 new topics · ~20 min").
2. User works through the session: MCQs auto-grade with immediate feedback and explanations; flashcards reveal and self-rate.
3. Session ends with a small, honest summary: what strengthened, what stayed weak, streak status.
4. Dashboard reflects the session immediately — readiness bars move. The loop's reward is visible progress toward the date.

### 6.3 Quiz on demand

1. From any module or topic, user hits "Quiz me on this."
2. Scope selector confirms the level (this topic / this module / whole goal) and question count.
3. Same session experience as the daily loop; results feed the same readiness model. Ad-hoc practice is never a separate silo.

### 6.4 The slip (the signature flow)

1. User misses four days. On return, the Today view acknowledges it without guilt-tripping — one line, then the work: the recalibrated session.
2. Dashboard shows the recalibration transparently: "Plan updated — remaining 18 topics across 12 days, new pace 1.5/day."
3. If the miss was deep enough to cross the feasibility threshold, the return moment is different: PaceKeeper presents the triage proposal — "Full coverage is no longer realistic. Here is the plan that saves the most: these 12 topics, prioritized by weakness and weight; these 4 are cut." User adjusts and confirms.
4. The dashboard's on-track verdict updates against the *confirmed triaged plan* — the user is now on pace again, against an honest target. This flow is the product's thesis in miniature: the truth, then a way forward.

### 6.5 Building the bank over time

1. As the user studies new material outside PaceKeeper, they return to a topic, paste fresh notes, and generate another question batch — or write questions manually after a hard concept clicks.
2. The review-and-approve gate is the same every time. The bank grows; the engine absorbs new questions into scheduling automatically.
3. The notes field per topic is always one click away during any session — capture the thought, stay in flow.

### 6.6 Reading the dashboard (the decision surface)

1. User opens the goal dashboard. Above the fold, one verdict: **On track / Catching up / Triage recommended**, with days remaining.
2. Below: readiness per topic (weakest first), the plan's pace vs. actual pace, and consistency.
3. Every weak topic is actionable in one click — "Quiz this now" — so the dashboard is never a report the user merely reads; it is where the next session starts.

---

## 7. Success Criteria for v1

The version is done when all of the following are true, in this order of priority:

1. A stranger on the demo account completes the core loop — see Today, answer questions, watch the dashboard move — in under 60 seconds with zero dead ends.
2. The slip → recalibration → triage flow works end to end and is demonstrable in the demo video.
3. Every screen resolves every one of its four states deliberately; there are no blank flashes, silent failures, or dead-end empty states anywhere.
4. The product is fully usable with AI generation unavailable — manual structure and manual questions carry the entire experience.
5. The builder (a real distance-learning student) would genuinely adopt it for their own next exam. Dogfooding is the final acceptance test.

---

## 8. Vision & Roadmap (post-v1)

v1 is the spine: goal, plan, practice, truth. The vision is a full accountability partner, and each deferred item below extends that identity. They are sequenced by value-to-effort, and each carries the reason it was cut from v1 — the cuts are decisions, not omissions.

1. **External nudges — WhatsApp / calendar integration.** The accountability partner leaves the app: daily session reminders, slip alerts, and weekly readiness digests delivered where the learner already lives. Deferred because integrations are invisible in a reviewed demo and each one is days of OAuth/API work; the Today view carries the daily unit in v1.
2. **Video ingestion.** Paste a lecture URL or upload a recording; PaceKeeper extracts the transcript and feeds the same plan/question pipeline. Deferred because transcription is a heavy pipeline for one input format; "paste the transcript" ships the same promise in v1.
3. **Richer readiness modeling.** Confidence-weighted answers, per-question difficulty, and forgetting-curve fitting per learner — sharpening the same readiness number the dashboard already shows.
4. **Session note history and richer notes.** From one scratch field per topic toward a lightweight learning journal — carefully, without becoming a notes app.
5. **Mind maps / structure visualization.** A comprehension aid layered on the existing hierarchy — valuable, but only once the retention spine is unassailable.
6. **Shared decks and social accountability.** Publish a question bank for a certification; study pacts between friends; leaderboards for cohorts preparing for the same date.

---

*End of specification. The technical design document (stack, data model, API contracts, architecture decisions) follows as a separate document.*