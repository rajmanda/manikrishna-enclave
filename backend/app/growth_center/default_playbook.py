"""Default Hyderabad property-management sales playbook.

Static, hand-written strategy content seeded into the Growth Center database
on first use. Contains NO operational application data — the business context
below was authored as marketing copy, not pulled from any collection.
"""

from typing import Any

from app.growth_center.models import (
    GrowthPersona,
    GrowthPlaybook,
    GrowthTemplate,
    PlaybookSection,
)

DEFAULT_PLAYBOOK_ID = "gpb-default-hyderabad"

# ---------------------------------------------------------------- sections

_MARKET_STRATEGY = """\
## Product

A property-management SaaS portal connecting three groups: property owners,
tenants, and property managers. It gives each side one reliable place to see
maintenance, expenses, invoices, payments, and documents.

## Core value proposition

Transparency, clarity, accountability, and organised records for
property-management operations. The portal replaces fragmented processes —
chaotic WhatsApp threads, disconnected Excel sheets, manual owner updates,
repeated phone calls, unstructured maintenance coordination, manual expense
reporting, difficult NRI owner communication, and delayed monthly reports —
with a single system of record that works *alongside* WhatsApp, not against it.

**Positioning sentence:** "You keep talking to owners on WhatsApp. The portal
makes sure there is always an organised, professional record behind the
conversation."

## Initial target market

- Independent property managers
- Local real estate agencies
- Independent brokers
- Small and medium property-management companies
- Professionals managing NRI-owned properties

**Initial geography:** Hyderabad — Gachibowli, HITEC City, Madhapur, Tarnaka,
Secunderabad, and other areas with significant NRI property ownership.

## Buyer problems to lead with

1. Hours spent preparing manual owner updates every month.
2. Owners repeatedly asking "what happened with the repair?" and "where did my
   money go?".
3. Property information scattered across WhatsApp chats and Excel files.
4. No professional artefact to show a prospective owner during a pitch.
5. No transparent owner portal — NRI owners in the US/UK/Gulf feel out of the
   loop because of time zones.
6. No consistent process for maintenance, expenses, invoices and payments.
7. Staff holding important information inside private chats — it leaves when
   they leave.
8. Hard to scale beyond a small portfolio because everything depends on memory.

## Rules for all copy

- Be practical and specific; no generic SaaS buzzwords.
- Never claim unverified time savings, fabricated customer results, fake
  testimonials, invented pricing, or false urgency.
- Indian English, understandable to non-technical property managers.
- Focus on operational clarity, not replacing people.
- Respect that WhatsApp will continue to be used — the portal is the system of
  record beside it.
"""

_FUNNEL_STRATEGY = """\
## Lead magnets / hooks

Low-friction, high-value offers for Hyderabad property managers. Each is
deliberately cheap to deliver and naturally leads into a 15-minute
walkthrough.

### 1. Free property-management workflow audit
- **Target audience:** Independent managers with 10–50 properties.
- **Primary pain point:** Nobody has ever looked at their process end-to-end.
- **Offer:** A 30-minute review of how requests, expenses and owner updates
  flow today, with a one-page written summary of gaps.
- **Call to action:** "Reply AUDIT and I will send three questions to start."
- **Best channel:** LinkedIn / WhatsApp.
- **Why it should work:** It gives value before asking for anything, and the
  gaps it surfaces are exactly what the portal fixes.

### 2. Free NRI owner-reporting template
- **Target audience:** Managers serving NRI owners (Gachibowli, HITEC City,
  Madhapur corridors).
- **Primary pain point:** Every month they hand-assemble updates for owners
  abroad.
- **Offer:** A ready monthly-report template (expenses, maintenance status,
  photos, receipts checklist) they can use immediately — with or without us.
- **Call to action:** "Message TEMPLATE and I'll send it over."
- **Best channel:** Facebook groups / WhatsApp.
- **Why it should work:** Immediate utility; positions us as the people who
  understand NRI reporting; the template mirrors the portal's owner view.

### 3. Free portfolio transparency scorecard
- **Target audience:** Agencies wanting to win more owner mandates.
- **Primary pain point:** They cannot demonstrate professionalism to
  prospective owners.
- **Offer:** A 10-question self-scoring sheet ("Can an owner see every expense
  with a receipt? Y/N…") with a score out of 100.
- **Call to action:** "Take the 3-minute scorecard."
- **Best channel:** LinkedIn.
- **Why it should work:** Scores create curiosity and a natural "how do I
  improve this?" conversation.

### 4. Free 15-minute operational review call
- **Target audience:** Busy managers who won't fill forms.
- **Primary pain point:** Too busy firefighting to evaluate tools.
- **Offer:** A short call reviewing one painful workflow, no slides.
- **Call to action:** "Pick any 15-minute slot this week."
- **Best channel:** WhatsApp after any inbound interaction.
- **Why it should work:** Low commitment, immediately personal.

### 5. Limited pilot programme
- **Target audience:** Qualified prospects post-demo.
- **Primary pain point:** Fear of switching cost and disruption.
- **Offer:** A small number of onboarding slots with hands-on setup support
  for a limited pilot batch.
- **Call to action:** "Shall I reserve one pilot slot for you?"
- **Why it should work:** Honest scarcity (support capacity is genuinely
  limited) with a low-risk trial framing.

### 6. Free sample owner portal
- **Target audience:** Managers sceptical that owners will use software.
- **Primary pain point:** "My owners won't log in."
- **Offer:** A demo portal populated with sample data they can forward to one
  friendly owner for reaction.
- **Call to action:** "Want a sample link to show one of your owners?"
- **Why it should work:** Lets the owner's reaction sell the idea.

### 7. WhatsApp-to-portal migration assessment
- **Target audience:** Managers drowning in group chats.
- **Primary pain point:** Chat history is their only record.
- **Offer:** A short review of what should stay on WhatsApp versus what
  belongs in a system of record, with a simple migration checklist.
- **Call to action:** "Reply MIGRATE for the checklist."
- **Best channel:** WhatsApp / Facebook groups.
- **Why it should work:** Meets them exactly where the pain lives without
  demanding they abandon WhatsApp.

## Qualification framework

Ask conversationally, not as a form:

1. "How many properties or units are you managing at the moment, roughly?"
   *(size / fit)*
2. "How many of your owners are NRIs or based outside Hyderabad?"
   *(pain intensity — remote owners need reporting most)*
3. "How do owner updates happen today — WhatsApp, Excel, monthly email,
   or on request?" *(current process and gap)*
4. "Is it just you, or do you have coordinators/staff handling requests?"
   *(scale and decision authority)*
5. "If a pilot took under an hour to set up, would you want to try it on a
   few properties first?" *(pilot interest and buying temperature)*

A good-fit prospect: 10+ units OR any NRI owners, updates done manually,
decision-maker on the call, open to a pilot.

## Micro-conversion path

Move prospects one small step at a time — never from a comment straight to a
sales pitch:

1. **Social interaction** — they like/comment on a post or group thread.
   → Reply usefully in-thread; no pitch.
2. **Direct message** — continue the same topic 1-to-1, offer a lead magnet
   (template, scorecard, checklist).
3. **Initial qualification** — 2–3 of the questions above, woven into chat.
4. **15-minute portal walkthrough** — position as "have a look, keep the
   ideas even if you don't buy".
5. **Pilot discussion** — only after they've seen the owner view. Propose a
   small pilot on a handful of properties.

Keep every step low-pressure: the prospect should always feel they can stop
without awkwardness, which paradoxically keeps them moving forward.
"""

_PILOT_PRICING = """\
## Pilot and pricing positioning

**Do not quote final pricing in outreach.** Pricing is discussed live, after
the demo, once portfolio size and needs are known. Until then, use these
positions:

- **Pilot-first:** "Start with a small pilot on a few properties. You judge
  the value with your own owners before committing the portfolio."
- **Cost-of-chaos anchor:** Position price against what disorganisation costs
  — hours of manual reporting, a lost NRI owner, a mandate lost to a more
  professional-looking competitor. Do not invent numbers; invite the manager
  to estimate their own.
- **Per-property framing:** When asked "how much per property?", answer that
  pricing scales with portfolio size so small agencies are not subsidising
  large ones, and agree it live rather than quoting a figure in chat.
- **Introductory pilot terms:** Early adopters get hands-on onboarding support
  and input into the roadmap. That support capacity is genuinely limited —
  say so honestly, never manufacture deadlines.
- **No lock-in message:** Their data (properties, expenses, documents) is
  exportable. The exit door is open, which makes entering easier.

**What never to say:** invented discounts, "price goes up next week", fake
"only 2 slots left" (unless literally true), or comparisons that rubbish
WhatsApp/Excel — the prospect built that process and is proud it works at all.
"""

_SECTIONS = [
    PlaybookSection(
        id="gsec-market-strategy",
        key="market-strategy",
        title="Market Strategy",
        body=_MARKET_STRATEGY,
        order=1,
    ),
    PlaybookSection(
        id="gsec-funnel-strategy",
        key="funnel-strategy",
        title="Acquisition Funnel Architecture",
        body=_FUNNEL_STRATEGY,
        order=2,
    ),
    PlaybookSection(
        id="gsec-pilot-pricing",
        key="pilot-pricing",
        title="Pilot & Pricing Positioning",
        body=_PILOT_PRICING,
        order=3,
    ),
]

# ---------------------------------------------------------------- personas

_PERSONAS = [
    GrowthPersona(
        id="gper-independent-pm",
        name="Independent Property Manager",
        description=(
            "Solo operator or 2–3 person team in Hyderabad managing rentals "
            "for individual owners. Runs the business from WhatsApp, phone "
            "calls and an Excel sheet. Personally known to every owner."
        ),
        portfolio_size="10–40 units",
        common_problems=[
            "Owner updates prepared manually every month",
            "Information lives in personal chats and memory",
            "Cannot take a holiday without operations stalling",
            "Looks less professional than larger agencies when pitching owners",
        ],
        buying_motivations=[
            "Win and retain owners by looking professional",
            "Reduce repeated status calls",
            "Standardise operations without hiring",
        ],
        objections=[
            "My process works fine",
            "My owners will not log into an app",
            "No time to enter data",
        ],
    ),
    GrowthPersona(
        id="gper-nri-specialist",
        name="NRI Property Specialist",
        description=(
            "Manager or broker whose clients are mostly NRI owners in the US, "
            "UK and Gulf, with flats in Gachibowli, HITEC City and Madhapur. "
            "Time zones make every update a late-night WhatsApp session."
        ),
        portfolio_size="15–60 units",
        common_problems=[
            "Owners abroad ask for expense proofs and photos repeatedly",
            "Trust deficit — owners cannot see where money goes",
            "Monthly reports delayed or inconsistent",
            "Losing NRI clients to competitors who 'seem more organised'",
        ],
        buying_motivations=[
            "A transparent owner portal that answers questions before they are asked",
            "Retain NRI clients and win referrals in NRI circles",
            "Look professional across time zones without staying up at night",
        ],
        objections=[
            "I do not want the software company contacting my owners",
            "Can this be branded for my agency?",
            "How secure is the information?",
        ],
    ),
    GrowthPersona(
        id="gper-small-agency",
        name="Small Agency Principal",
        description=(
            "Owner of a 5–15 person real-estate agency in Secunderabad or "
            "Tarnaka doing sales, rentals and management. Wants management "
            "revenue to scale, but coordination overhead grows faster than "
            "the portfolio."
        ),
        portfolio_size="40–200 units",
        common_problems=[
            "Staff hold key information in private conversations",
            "No consistent process across coordinators",
            "Already uses accounting software, but it covers money, not operations",
            "Scaling beyond current size feels operationally impossible",
        ],
        buying_motivations=[
            "Standard operating process across the team",
            "Continuity when staff leave",
            "A portfolio-level view for the principal",
        ],
        objections=[
            "My team does not have time to enter all this data",
            "We already use accounting software",
            "How much will this cost per property?",
        ],
    ),
]

# ---------------------------------------------------------------- templates


def _tpl(
    id_: str,
    *,
    template_type: str,
    funnel_stage: str,
    channel: str,
    title: str,
    content: str,
    persona: str = "",
    tags: list[str] | None = None,
) -> GrowthTemplate:
    return GrowthTemplate(
        id=id_,
        playbook_id=DEFAULT_PLAYBOOK_ID,
        template_type=template_type,  # type: ignore[arg-type]
        funnel_stage=funnel_stage,  # type: ignore[arg-type]
        channel=channel,  # type: ignore[arg-type]
        title=title,
        content=content,
        status="draft",
        tags=tags or [],
        target_persona=persona,
        language="en-IN",
    )


_TEMPLATES: list[GrowthTemplate] = [
    # ---------------- Step 1: first contact ----------------
    _tpl(
        "gtpl-fc-facebook",
        template_type="first_contact",
        funnel_stage="first_contact",
        channel="facebook",
        title="First contact — cold Facebook page message",
        persona="Independent Property Manager",
        tags=["step-1"],
        content=(
            "Namaste! I came across your page while looking at property "
            "managers in Hyderabad.\n\n"
            "I work on a portal that helps property managers give owners — "
            "especially NRI owners — a clear view of maintenance, expenses "
            "and payments, so you spend less time preparing manual updates "
            "on WhatsApp.\n\n"
            "You keep using WhatsApp as usual; the portal simply keeps an "
            "organised record behind it that owners can check themselves.\n\n"
            "If useful, I can show you the owner's view in a 15-minute "
            "walkthrough — no obligation. Would this week or next suit you?"
        ),
    ),
    _tpl(
        "gtpl-fc-linkedin",
        template_type="first_contact",
        funnel_stage="first_contact",
        channel="linkedin",
        title="First contact — LinkedIn message",
        persona="Small Agency Principal",
        tags=["step-1"],
        content=(
            "Hello {{name}}, I noticed you manage properties in "
            "{{area}} — impressive portfolio.\n\n"
            "A common frustration I hear from Hyderabad managers is the "
            "monthly grind of owner updates: collecting expenses from chats, "
            "assembling reports, answering the same status questions again "
            "and again — especially for NRI owners.\n\n"
            "I'm building a portal that keeps maintenance, expenses and "
            "payments organised in one place owners can see, while your team "
            "continues on WhatsApp as normal.\n\n"
            "Open to a 15-minute walkthrough of the owner view? Happy to "
            "work around your schedule."
        ),
    ),
    _tpl(
        "gtpl-fc-whatsapp",
        template_type="first_contact",
        funnel_stage="first_contact",
        channel="whatsapp",
        title="First contact — WhatsApp business introduction",
        persona="NRI Property Specialist",
        tags=["step-1"],
        content=(
            "Namaste {{name}} ji, this is {{sender}} from {{company}}.\n\n"
            "We help Hyderabad property managers who look after NRI-owned "
            "flats. Instead of preparing WhatsApp updates and Excel reports "
            "for every owner each month, your owners get a portal where "
            "expenses, maintenance status and receipts are always visible — "
            "and you get your evenings back from US-timezone update calls.\n\n"
            "WhatsApp still works exactly as today; the portal is the "
            "organised record behind it.\n\n"
            "May I show you the owner's view sometime this week? It takes "
            "about 15 minutes."
        ),
    ),
    _tpl(
        "gtpl-fc-group-comment",
        template_type="first_contact",
        funnel_stage="first_contact",
        channel="facebook",
        title="First contact — follow-up to a Hyderabad real-estate group comment",
        persona="Independent Property Manager",
        tags=["step-1"],
        content=(
            "Hi {{name}}, saw your comment in the {{group}} group about "
            "keeping owners updated — it's a very common struggle, "
            "especially with owners abroad.\n\n"
            "I work on a portal built for exactly this: owners see "
            "maintenance, expenses and payment records themselves, so you "
            "are not assembling updates manually or answering the same "
            "question three times.\n\n"
            "If you'd like, I can send a free NRI owner-reporting template "
            "you can use right away — and if it's helpful, show you the "
            "portal in 15 minutes. Just reply TEMPLATE."
        ),
    ),
    # ---------------- Step 2: no-response follow-up ----------------
    _tpl(
        "gtpl-fu-whatsapp",
        template_type="no_response_follow_up",
        funnel_stage="follow_up",
        channel="whatsapp",
        title="No-response follow-up (~48 hours) — WhatsApp",
        tags=["step-2"],
        content=(
            "Hi {{name}} ji, just following up on my earlier message — I "
            "know the days get busy with tenant calls and site visits.\n\n"
            "One thing managers find genuinely useful: when an NRI owner "
            "asks \"what happened with the AC repair?\", the portal already "
            "shows the status, cost and receipt — so that conversation "
            "simply doesn't need to happen.\n\n"
            "If a quick 15-minute walkthrough would help, I'm happy to work "
            "around your timing. And if now isn't right, no problem at all."
        ),
    ),
    _tpl(
        "gtpl-fu-email",
        template_type="no_response_follow_up",
        funnel_stage="follow_up",
        channel="email",
        title="No-response follow-up (~48 hours) — formal email",
        tags=["step-2"],
        content=(
            "Subject: Re: Owner reporting for your managed properties\n\n"
            "Dear {{name}},\n\n"
            "I wrote to you a couple of days ago and understand schedules "
            "are demanding in this line of work, so a brief follow-up.\n\n"
            "One specific point: managers using an owner portal stop "
            "preparing monthly updates by hand — expenses, maintenance "
            "status and receipts are already visible to the owner, in one "
            "organised place.\n\n"
            "If you would like to see how this looks from the owner's side, "
            "I would be glad to arrange a short 15-minute walkthrough at a "
            "time convenient to you.\n\n"
            "Warm regards,\n{{sender}}"
        ),
    ),
    # ---------------- Step 3: demo invitation ----------------
    _tpl(
        "gtpl-demo-whatsapp",
        template_type="demo_invitation",
        funnel_stage="demo",
        channel="whatsapp",
        title="Demo invitation — WhatsApp",
        tags=["step-3"],
        content=(
            "Great — let me show you the portal properly.\n\n"
            "*What you'll see in 15 minutes:*\n"
            "1. The owner's view — what your NRI owners would see: "
            "expenses with receipts, maintenance status, payment history.\n"
            "2. Your side — how a request, expense or invoice gets recorded.\n"
            "3. The monthly picture — what replaces your manual owner update.\n\n"
            "It's a walkthrough, not a sales presentation — no obligation, "
            "and the ideas are yours to keep either way.\n\n"
            "Which suits you better: {{slot_a}} or {{slot_b}}? I'll send a "
            "link, or we can do a simple screen share."
        ),
    ),
    _tpl(
        "gtpl-demo-email",
        template_type="demo_invitation",
        funnel_stage="demo",
        channel="email",
        title="Demo invitation — formal email",
        tags=["step-3"],
        content=(
            "Subject: 15-minute walkthrough — owner portal for your "
            "managed properties\n\n"
            "Dear {{name}},\n\n"
            "Thank you for your interest. I would like to offer a short "
            "walkthrough of the portal, focused on what matters to your "
            "business:\n\n"
            "- The owner's view: expenses with receipts, maintenance "
            "status, and payment records your owners can check themselves\n"
            "- The manager's view: recording requests, expenses and "
            "invoices without changing how you use WhatsApp\n"
            "- The monthly summary that replaces manually prepared updates\n\n"
            "It takes about 15 minutes and carries no obligation. May I "
            "suggest {{slot_a}} or {{slot_b}}? If neither suits, please "
            "propose a time and I will adjust.\n\n"
            "Warm regards,\n{{sender}}"
        ),
    ),
    # ---------------- Step 4: post-demo pitch ----------------
    _tpl(
        "gtpl-postdemo-email",
        template_type="post_demo_pitch",
        funnel_stage="post_demo",
        channel="email",
        title="Post-demo pitch — email",
        tags=["step-4"],
        content=(
            "Subject: Next step — a small pilot on a few of your properties\n\n"
            "Dear {{name}},\n\n"
            "Thank you for your time yesterday. Based on our conversation, "
            "let me address the practical concerns directly:\n\n"
            "*Onboarding:* We set up your first properties together in a "
            "working session — you are not left with empty software.\n\n"
            "*Staff training:* The day-to-day actions are simple (record a "
            "request, attach a receipt). Your coordinators learn it in one "
            "sitting, and we support them during the pilot.\n\n"
            "*Data entry:* Start with current items only — new requests and "
            "this month's expenses. No need to back-fill history.\n\n"
            "*Owner adoption:* Owners receive a view, not work. Most check "
            "it exactly when they would otherwise have called you.\n\n"
            "*Your existing process:* WhatsApp continues as-is. The portal "
            "is the record behind it.\n\n"
            "My suggestion: a pilot on a handful of properties, with "
            "hands-on support from us, so you can judge the owner reaction "
            "with minimal effort. If it earns its place, we extend it to "
            "the portfolio; if not, you have lost very little.\n\n"
            "Shall I send a proposed pilot plan?\n\n"
            "Warm regards,\n{{sender}}"
        ),
    ),
    _tpl(
        "gtpl-postdemo-whatsapp",
        template_type="post_demo_pitch",
        funnel_stage="post_demo",
        channel="whatsapp",
        title="Post-demo pitch — WhatsApp",
        tags=["step-4"],
        content=(
            "Thanks again for your time, {{name}} ji. Sharing a quick "
            "summary of what we discussed:\n\n"
            "• *Setup:* we do the first properties together — about an hour.\n"
            "• *Team:* coordinators learn it in one sitting; we support "
            "them during the pilot.\n"
            "• *Data:* start fresh from this month, no back-filling.\n"
            "• *Owners:* they get a link to view, nothing to install or "
            "learn. WhatsApp continues as today.\n\n"
            "The honest pitch: this makes your agency look more "
            "professional to owners, cuts the repeated status calls, and "
            "gives you a standard process you can scale on.\n\n"
            "Want me to send a small pilot plan for a few properties to "
            "start with?"
        ),
    ),
    # ---------------- Step 5: stalled-close sequence ----------------
    _tpl(
        "gtpl-stall-day3",
        template_type="stalled_close",
        funnel_stage="closing",
        channel="whatsapp",
        title="Stalled close — day 3 after proposal",
        tags=["step-5"],
        content=(
            "Hi {{name}} ji, checking in on the pilot proposal I sent on "
            "{{date}}.\n\n"
            "No rush from my side — I know these decisions sit alongside a "
            "full day of site visits and tenant calls.\n\n"
            "If anything in the proposal is unclear, or you'd like me to "
            "walk one of your colleagues through the portal, I'm happy to "
            "do that. Is there anything holding it up that I can help with?"
        ),
    ),
    _tpl(
        "gtpl-stall-day7",
        template_type="stalled_close",
        funnel_stage="closing",
        channel="whatsapp",
        title="Stalled close — day 7 after proposal",
        tags=["step-5"],
        content=(
            "Hello {{name}} ji, one small practical note on the pilot "
            "proposal.\n\n"
            "We onboard pilot agencies in small batches because each one "
            "gets hands-on setup support from us — that support capacity "
            "is genuinely limited, so I plan slots a few weeks ahead.\n\n"
            "If you'd like to be in the next batch, I can reserve a slot "
            "now and we'll fix the start date at your convenience. If the "
            "timing isn't right this month, tell me and I'll plan "
            "accordingly — no pressure either way."
        ),
    ),
    _tpl(
        "gtpl-stall-final",
        template_type="stalled_close",
        funnel_stage="closing",
        channel="email",
        title="Stalled close — final close-the-loop message",
        tags=["step-5"],
        content=(
            "Subject: Closing the loop on the pilot proposal\n\n"
            "Dear {{name}},\n\n"
            "I don't want to keep filling your inbox, so this is my last "
            "note on the pilot proposal.\n\n"
            "If the timing or fit isn't right, that is completely fine — "
            "a simple \"not now\" helps me close the file, and the "
            "NRI-reporting template and walkthrough ideas remain yours to "
            "use regardless.\n\n"
            "If you would like to revisit it later this year, I would be "
            "glad to pick the conversation back up whenever suits you.\n\n"
            "Thank you for the time you have already given, and my best "
            "wishes for the portfolio.\n\n"
            "Warm regards,\n{{sender}}"
        ),
    ),
]


def _objection(
    id_: str,
    title: str,
    *,
    short: str,
    expanded: str,
    discovery: str,
    proof: str,
    avoid: str,
) -> GrowthTemplate:
    content = (
        f"**Short response:** {short}\n\n"
        f"**Expanded response:** {expanded}\n\n"
        f"**Discovery question:** {discovery}\n\n"
        f"**Suggested proof / demonstration:** {proof}\n\n"
        f"**Mistakes to avoid:** {avoid}\n"
    )
    return _tpl(
        id_,
        template_type="objection_response",
        funnel_stage="objection",
        channel="any",
        title=title,
        content=content,
        tags=["objection"],
    )


_OBJECTIONS: list[GrowthTemplate] = [
    _objection(
        "gtpl-obj-whatsapp-works",
        "Objection: 'Our WhatsApp and Excel process works fine.'",
        short=(
            "It clearly works — you've built a running business on it. The "
            "portal doesn't replace it; it adds the organised record behind "
            "it that owners can see."
        ),
        expanded=(
            "WhatsApp is excellent for conversation and it stays. The gap is "
            "the record: when an owner asks about an expense from March, "
            "someone scrolls chats and opens Excel. The portal keeps every "
            "request, expense and receipt organised by property, so the "
            "answer already exists — and it's what makes your service look "
            "professional to the next owner you pitch."
        ),
        discovery=(
            "When an owner asks about an expense from three months ago, how "
            "long does it take to find the full answer with the receipt?"
        ),
        proof=(
            "Live demo: find a specific expense with its receipt in the "
            "portal in under ten seconds; contrast with scrolling a chat."
        ),
        avoid=(
            "Never rubbish WhatsApp or Excel — the prospect built that "
            "process. Don't argue; agree it works, then show the gap."
        ),
    ),
    _objection(
        "gtpl-obj-owner-login",
        "Objection: 'My owners will not want to log into another application.'",
        short=(
            "They don't have to — but the ones asking you for updates every "
            "week are exactly the ones who will."
        ),
        expanded=(
            "Owners get a view, not work: no data entry, nothing to "
            "maintain. The owners who never call you won't log in — fine. "
            "The NRI owner who messages at midnight asking about the "
            "plumbing bill will, because it answers their question "
            "instantly, in their timezone. And for owners who prefer "
            "WhatsApp, you can still send updates — now backed by an "
            "organised record."
        ),
        discovery=(
            "Which of your owners ask for updates most often? What do they "
            "usually ask about?"
        ),
        proof=(
            "Offer the sample owner portal link they can forward to one "
            "friendly owner and let the owner's reaction decide."
        ),
        avoid=(
            "Don't promise all owners will adopt it. Don't frame it as "
            "mandatory for owners."
        ),
    ),
    _objection(
        "gtpl-obj-cost",
        "Objection: 'How much will this cost per property?'",
        short=(
            "Pricing scales with portfolio size — let's look at your "
            "portfolio on a short call and I'll give you an exact figure, "
            "starting with a small pilot."
        ),
        expanded=(
            "I'd rather give you a precise number for your situation than a "
            "vague range in chat. Pricing depends on portfolio size so "
            "small agencies aren't subsidising large ones. The pilot comes "
            "first anyway — you judge the value on a few properties before "
            "any portfolio-level commitment."
        ),
        discovery=(
            "Roughly how many units are you managing, and how do you charge "
            "your owners today — flat fee or percentage?"
        ),
        proof=(
            "Walk through the pilot structure: small scope, hands-on "
            "support, clear evaluation point."
        ),
        avoid=(
            "Never invent a number on the spot, never quote 'from ₹X' in "
            "writing before qualification, and never dodge twice — if they "
            "ask again, set the pricing call immediately."
        ),
    ),
    _objection(
        "gtpl-obj-data-entry",
        "Objection: 'My team does not have time to enter all this data.'",
        short=(
            "Start from today, not from history — recording a request or "
            "expense takes about as long as typing the WhatsApp message "
            "your team already sends."
        ),
        expanded=(
            "We deliberately don't back-fill history. The pilot starts with "
            "new maintenance requests and this month's expenses only. Each "
            "entry is a short form — often faster than composing the update "
            "message, and it never has to be re-assembled at month end "
            "because the owner report builds itself."
        ),
        discovery=(
            "Who on your team records expenses today, and where do they "
            "note them first — chat, notebook, or Excel?"
        ),
        proof=(
            "Time it live in the demo: record an expense with a receipt "
            "photo in under a minute."
        ),
        avoid=(
            "Don't claim 'no data entry at all' — there is some, and "
            "honesty here builds trust. Don't suggest re-entering "
            "historical records."
        ),
    ),
    _objection(
        "gtpl-obj-small-portfolio",
        "Objection: 'We manage only a small number of properties.'",
        short=(
            "Small portfolios feel the pain differently — every owner "
            "relationship matters more, and looking professional is how "
            "you win the next mandate."
        ),
        expanded=(
            "With a small portfolio, losing one owner hurts, and winning "
            "one new owner is a big step. A transparent portal helps on "
            "both: existing owners see everything and stay, and in a pitch "
            "you show a prospective owner their future portal rather than "
            "promising 'regular WhatsApp updates' like everyone else. The "
            "system also means you can grow without the chaos growing "
            "faster."
        ),
        discovery=(
            "Are you looking to grow the portfolio this year, or keep it "
            "steady and reduce the running effort?"
        ),
        proof=(
            "Show the owner-pitch angle: the sample owner portal as a "
            "sales artefact for winning new mandates."
        ),
        avoid=(
            "Don't dismiss small operators as not-ideal customers, and "
            "don't push portfolio-size-based pricing talk here."
        ),
    ),
    _objection(
        "gtpl-obj-owner-whatsapp",
        "Objection: 'What happens if the owner still prefers WhatsApp?'",
        short=(
            "Then WhatsApp continues — the portal keeps the organised "
            "record behind the conversation."
        ),
        expanded=(
            "The portal isn't a replacement channel; it's the system of "
            "record. You can keep sending the owner WhatsApp updates — but "
            "now they take moments because the information is already "
            "organised, and when a dispute or question about an old expense "
            "comes up, the receipt and history are there. Many owners drift "
            "to checking the portal themselves over time; those who don't "
            "still benefit from you being organised."
        ),
        discovery=(
            "How much of your owner communication is proactive updates "
            "versus owners chasing you with questions?"
        ),
        proof=(
            "Demo the flow: expense recorded once → owner update message "
            "composed from it in seconds."
        ),
        avoid=(
            "Never say owners must move off WhatsApp. Never position the "
            "portal as 'instead of' their communication style."
        ),
    ),
    _objection(
        "gtpl-obj-contact-owners",
        "Objection: 'I do not want the software company contacting my owners.'",
        short=(
            "We never contact your owners. They are your clients — the "
            "portal is your tool, presented under your relationship."
        ),
        expanded=(
            "The owner relationship is your business asset and we treat it "
            "that way: no marketing to your owners, no direct outreach, no "
            "using their details for anything except showing them their own "
            "property information. You control what owners see and when "
            "they are invited."
        ),
        discovery=(
            "Has a vendor overstepped with your clients before? What "
            "happened?"
        ),
        proof=(
            "Show the invitation flow: owners are added and invited by the "
            "manager, not by us. Put the no-contact commitment in writing "
            "in the pilot agreement."
        ),
        avoid=(
            "Don't be vague — this is a trust question and deserves an "
            "absolute answer. Don't mention any future plans that involve "
            "owner outreach."
        ),
    ),
    _objection(
        "gtpl-obj-branding",
        "Objection: 'Can this be branded for my agency?'",
        short=(
            "The portal presents your agency to your owners — your agency "
            "name and identity front and centre in their view."
        ),
        expanded=(
            "Owners experience the portal as your agency's service: your "
            "agency name on their portal and reports. Deeper co-branding "
            "options can be discussed during pilot setup — tell me what "
            "matters most: the login page, reports, or the owner's "
            "day-to-day view?"
        ),
        discovery=(
            "How do you present your brand to owners today — letterhead, "
            "report format, WhatsApp business profile?"
        ),
        proof=(
            "Show where the agency's name appears in the owner view during "
            "the demo."
        ),
        avoid=(
            "Don't promise white-labelling features that don't exist yet — "
            "confirm current capabilities before committing, and put "
            "agreed branding items in the pilot plan."
        ),
    ),
    _objection(
        "gtpl-obj-security",
        "Objection: 'How secure is the information?'",
        short=(
            "Every user signs in with their own verified account, sees only "
            "what their role allows, and every change is logged."
        ),
        expanded=(
            "Access is whitelist-based — only people you add can sign in, "
            "with role-based permissions: owners see their own properties, "
            "not each other's. Every create, edit and delete is recorded in "
            "an audit trail. Data lives in a managed cloud database with "
            "encrypted connections. And your data is exportable — it "
            "remains yours."
        ),
        discovery=(
            "Where does this information live today — personal phones and "
            "laptops? What happens when a staff member leaves?"
        ),
        proof=(
            "Show role-based views side by side (owner vs manager) and the "
            "audit trail in the demo. Offer a written security summary."
        ),
        avoid=(
            "Don't hand-wave with 'bank-grade security' clichés, and don't "
            "overclaim certifications the product doesn't hold."
        ),
    ),
    _objection(
        "gtpl-obj-accounting",
        "Objection: 'We already use accounting software.'",
        short=(
            "Keep it — accounting software tracks your books; this runs "
            "your operations and shows owners their property, which "
            "accounting tools don't do."
        ),
        expanded=(
            "Accounting software answers 'are my accounts correct?' for "
            "you and your CA. It doesn't give an NRI owner a live view of "
            "their flat's maintenance status, doesn't track work orders, "
            "and doesn't organise receipts by property for owner "
            "transparency. The two coexist: operations and owner "
            "transparency here, statutory accounting there."
        ),
        discovery=(
            "What does your accountant use it for, and what do your owners "
            "actually ask to see?"
        ),
        proof=(
            "Demo an owner-facing expense view with receipts and contrast "
            "the purpose with a ledger screen."
        ),
        avoid=(
            "Don't position against their accounting tool or suggest "
            "replacing it. Don't get pulled into an accounting-features "
            "comparison."
        ),
    ),
]


def default_playbook() -> GrowthPlaybook:
    return GrowthPlaybook(
        id=DEFAULT_PLAYBOOK_ID,
        title="Hyderabad Property-Manager Acquisition Playbook",
        description=(
            "Default B2B sales playbook for acquiring independent property "
            "managers, agencies and NRI-property specialists in Hyderabad. "
            "Covers funnel strategy, outreach sequences, objection handling "
            "and pilot positioning."
        ),
        target_market=(
            "Independent property managers, local real-estate agencies, "
            "brokers, and SMB property-management companies serving "
            "NRI-owned properties"
        ),
        target_personas=[p.name for p in _PERSONAS],
        geography=[
            "Hyderabad",
            "Gachibowli",
            "HITEC City",
            "Madhapur",
            "Tarnaka",
            "Secunderabad",
        ],
        status="draft",
        sections=_SECTIONS,
        tags=["default", "hyderabad", "nri", "b2b"],
    )


async def seed_default_playbook(db: Any, actor_id: str = "") -> bool:
    """Idempotently seed the default playbook, templates and personas into
    the Growth Center database. Returns True if anything was inserted."""
    if await db.growth_playbooks.find_one({"id": DEFAULT_PLAYBOOK_ID}):
        return False

    playbook = default_playbook()
    playbook.created_by = actor_id
    await db.growth_playbooks.insert_one(playbook.model_dump())

    for tpl in [*_TEMPLATES, *_OBJECTIONS]:
        doc = tpl.model_dump()
        doc["created_by"] = actor_id
        await db.growth_templates.insert_one(doc)

    for persona in _PERSONAS:
        await db.growth_personas.insert_one(persona.model_dump())

    return True
