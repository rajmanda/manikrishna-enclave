# BOOTSTRAP.md

# Project Constitution

These principles are immutable unless explicitly approved by the project
owner.

1.  **Documentation First** -- Every significant code change must be
    reflected in documentation.
2.  **API First** -- All business logic is exposed through versioned
    APIs.
3.  **Security First** -- Least privilege, RBAC, OAuth, secret
    management, and audit logging are mandatory.
4.  **Infrastructure as Code** -- All cloud resources are provisioned
    with Terraform.
5.  **CI/CD by Default** -- All deployments occur through GitHub
    Actions.
6.  **Cloud Native** -- Deploy on Google Cloud Run using Docker.
7.  **Multi-Tenant by Design** -- Never hard-code Mani Krishna Enclave.
    It is the seed customer.
8.  **Mobile Ready** -- Backend must support future React Native /
    Flutter apps.
9.  **Production Quality** -- No demo code in production branches.
10. **Backward Compatibility** -- Avoid breaking API/database changes
    without approval.

------------------------------------------------------------------------

# Project Overview

**Product:** CommunityHub

CommunityHub is a SaaS platform for apartment associations, HOAs and
property managers.

Initial deployment: - Community: Mani Krishna Enclave - Property
Manager: Vishnu

Long-term goal: Support thousands of communities under one multi-tenant
platform.

------------------------------------------------------------------------

# Technology Stack

## Frontend

-   Next.js
-   React
-   TypeScript
-   TailwindCSS

## Backend

-   FastAPI

## Database

-   MongoDB Atlas

## Authentication

-   Google OAuth (whitelisted users)

## Infrastructure

-   Google Cloud Run
-   Google Cloud Storage
-   Google Secret Manager
-   Artifact Registry
-   Terraform
-   GitHub Actions

Domain: community.rajmanda.com

------------------------------------------------------------------------

# Repository Structure

    frontend/
    backend/
    infra/
      terraform/
    docs/
    .github/workflows/

------------------------------------------------------------------------

# Required Documentation

Maintain these files:

-   CLAUDE.md
-   PROJECT_STATE.md

Inside docs/

-   PRD.md
-   PRODUCT_STRATEGY.md
-   AI_AGENT_GUIDE.md
-   ARCHITECTURE.md
-   DATABASE.md
-   API.md
-   ROADMAP.md
-   FEATURES.md
-   DEPLOYMENT.md
-   TERRAFORM.md
-   SECURITY.md
-   TESTING.md
-   CHANGELOG.md
-   DECISIONS.md
-   CONTRIBUTING.md
-   ENVIRONMENT.md
-   OPERATIONS.md
-   MONITORING.md
-   PRODUCTION_READINESS.md

------------------------------------------------------------------------

# CLAUDE.md Responsibilities

Every Claude Code session must:

1.  Read CLAUDE.md.
2.  Read PROJECT_STATE.md.
3.  Read ROADMAP.md.
4.  Read CHANGELOG.md.
5.  Read DECISIONS.md.
6.  Update documentation whenever code changes.

------------------------------------------------------------------------

# PROJECT_STATE.md

Maintain:

-   Current version
-   Current milestone
-   Current sprint
-   Current branch
-   Last completed feature
-   Current feature
-   Next priority
-   Known issues
-   Deployment status
-   Database version
-   Infrastructure version
-   Last deployment
-   Open decisions

------------------------------------------------------------------------

# Multi-Tenant Model

Community → Buildings → Apartments → Owners → Tenants → Vendors →
Invoices → Payments → Work Orders → Documents

------------------------------------------------------------------------

# User Roles

-   Super Admin
-   Property Manager
-   Community Admin
-   Owner
-   Tenant
-   Vendor
-   Auditor

------------------------------------------------------------------------

# Core Modules

-   Authentication
-   Community Dashboard
-   HOA Dashboard
-   Invoices
-   Payments
-   Common Expenses
-   Reserve Fund
-   Work Orders
-   Maintenance
-   Vendor Management
-   Community Feed
-   Polls
-   Documents
-   Meeting Minutes
-   Reports
-   Notifications

------------------------------------------------------------------------

# Community Dashboard

Display:

-   Income
-   Expenses
-   Reserve Fund
-   Outstanding Dues
-   Open Work Orders
-   Notices
-   Upcoming Meetings
-   Expense Breakdown
-   Recent Documents

------------------------------------------------------------------------

# Work Orders

Lifecycle:

Reported → Estimate → Approval → In Progress → Inspection → Completed →
Closed

Support:

-   Photos
-   Videos
-   Comments
-   Vendor
-   Timeline
-   Cost
-   Attachments

------------------------------------------------------------------------

# CI/CD

GitHub Actions pipeline:

-   Lint
-   Unit Tests
-   Integration Tests
-   Docker Build
-   Push to Artifact Registry
-   Terraform Plan
-   Terraform Apply
-   Deploy Cloud Run
-   Health Check
-   Rollback

------------------------------------------------------------------------

# Terraform

Provision:

-   Cloud Run
-   Artifact Registry
-   Secret Manager
-   Cloud Storage
-   IAM
-   Domain Mapping

Never create infrastructure manually.

------------------------------------------------------------------------

# Security

-   Google OAuth
-   Email whitelist
-   RBAC
-   Audit Logs
-   HTTPS
-   Secret Manager
-   No secrets in repository

------------------------------------------------------------------------

# Documentation Policy

Every meaningful code change updates:

-   CLAUDE.md
-   PROJECT_STATE.md
-   ROADMAP.md
-   CHANGELOG.md
-   DECISIONS.md

------------------------------------------------------------------------

# Product Strategy

Maintain docs/PRODUCT_STRATEGY.md including:

-   Vision
-   Mission
-   Customer Personas
-   Competitor Analysis
-   Pricing
-   GTM Strategy
-   Monetization
-   Roadmap
-   Success Metrics

------------------------------------------------------------------------

# AI Agent Guide

Maintain docs/AI_AGENT_GUIDE.md

It defines:

-   Coding standards
-   Architecture rules
-   Documentation policy
-   Testing requirements
-   Definition of Done
-   Pull Request checklist

------------------------------------------------------------------------

# Development Roadmap

## Phase 1

-   Auth
-   Apartments
-   Owners
-   Dashboards
-   RBAC

## Phase 2

-   Invoices
-   Payments
-   Statements
-   Common Expenses

## Phase 3

-   Work Orders
-   Vendors
-   Maintenance

## Phase 4

-   Documents
-   Polls
-   Reports
-   Notifications

## Phase 5

-   AI
-   Mobile Apps
-   WhatsApp
-   OCR
-   Predictive Maintenance

------------------------------------------------------------------------

# Definition of Done

A feature is complete only when:

-   Code implemented
-   Tests pass
-   Documentation updated
-   API documented
-   Database documented
-   Terraform updated (if needed)
-   CI passes
-   Ready for production

------------------------------------------------------------------------

# Final Principle

Treat this repository like a commercial SaaS platform.

Optimize for maintainability, scalability, security, observability,
documentation, and long-term evolution.
