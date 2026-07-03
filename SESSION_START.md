Before making any code changes, you must fully understand this project.

## Step 1 – Read Project Documentation

Read the following files in this exact order if they exist:

1. BOOTSTRAP.md
2. CLAUDE.md
3. PROJECT_STATE.md

Then read all documents inside the /docs directory in alphabetical order.

Treat these documents as the authoritative source of truth for the project.

If any documentation conflicts with the implementation, determine whether the code or documentation is newer, explain the discrepancy, and propose how to reconcile it before making changes.

---

## Step 2 – Repository Review

Review the entire repository.

Understand:

- Project architecture
- Technology stack
- Repository layout
- Existing features
- Current implementation status
- Infrastructure
- CI/CD
- Terraform
- MongoDB schema
- API structure
- Authentication
- Deployment strategy

Do not make assumptions.

---

## Step 3 – Bootstrap Missing Documentation

If any required documentation described in BOOTSTRAP.md is missing:

Create it.

If documentation exists but is outdated:

Update it.

Documentation is considered part of the implementation.

Never leave documentation behind.

---

## Step 4 – Repository Assessment

Produce a concise report including:

### Current Architecture

### Current Features

### Missing Features

### Technical Debt

### Security Concerns

### Performance Concerns

### Infrastructure Review

### Documentation Gaps

### Recommended Next Milestone

Do not change code yet.

---

## Step 5 – Create an Execution Plan

Based on BOOTSTRAP.md and the repository, create an implementation roadmap.

Break work into milestones.

Each milestone should contain:

- Goal
- Deliverables
- Estimated effort
- Dependencies
- Risks

Identify the best next milestone to begin.

---

## Step 6 – Wait for Approval

Do NOT begin implementing anything.

Present:

1. Repository assessment
2. Documentation changes you recommend
3. Implementation roadmap
4. First milestone

Wait for my approval before writing or modifying code.

---

## Ongoing Rules

For every future implementation:

- Keep documentation synchronized.
- Update CLAUDE.md when architecture changes.
- Update PROJECT_STATE.md after every meaningful implementation.
- Update ROADMAP.md.
- Update CHANGELOG.md.
- Update DECISIONS.md when architectural decisions are made.
- Update API.md when APIs change.
- Update DATABASE.md when MongoDB changes.
- Update DEPLOYMENT.md when deployment changes.
- Update TERRAFORM.md when infrastructure changes.
- Never allow documentation drift.

Documentation is part of the Definition of Done.

---

## Engineering Principles

Follow the Project Constitution defined in BOOTSTRAP.md.

Prioritize:

- Clean Architecture
- SOLID principles
- Modular design
- Security
- Maintainability
- Testability
- Scalability
- Observability
- Multi-tenancy
- Mobile readiness
- API-first design
- Infrastructure as Code
- CI/CD automation

When in doubt, optimize for long-term maintainability over short-term speed.

Act as a Principal Software Architect responsible for a production SaaS platform.