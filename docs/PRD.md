# PRODUCT REQUIREMENTS DOCUMENT (PRD)

# Project Name

CommunityHub

Initial Customer:
Mani Krishna Enclave

This software should NOT be hardcoded specifically for Mani Krishna Enclave.

The application should be designed as a multi-community SaaS platform so that in the future multiple apartment communities can use the same application under different organizations.

Mani Krishna Enclave will be the first customer.

---

# Vision

Build a modern Community Management Platform that replaces WhatsApp groups, Excel sheets, manual invoices and paper records.

The platform should allow property managers, apartment owners and tenants to collaborate in one place.

Think of it as:

Property Management +
HOA Portal +
Invoice System +
Maintenance Tracking +
Document Management +
Community Collaboration

---

# Existing Infrastructure

The application must use my existing infrastructure.

Hosting:
Google Cloud Platform

Deployment:
Cloud Run

Database:
MongoDB Atlas

Authentication:
Google OAuth

Storage:
Google Cloud Storage

Secrets:
Google Secret Manager

Domain:
rajmanda.com

Application URL:

community.rajmanda.com

---

# Technology Stack

Frontend

Next.js
React
TypeScript
TailwindCSS

Backend

FastAPI

Database

MongoDB Atlas

Authentication

Google OAuth

Deployment

Docker
Cloud Run

Storage

Google Cloud Storage

PDF generation

Server side

Charts

Recharts

---

# Design Philosophy

The application must be

Minimal

Fast

Responsive

Professional

Mobile First

Easy for non-technical apartment owners.

No unnecessary complexity.

---

# Multi Tenant Architecture

The platform must support multiple communities.

Community

↓

Buildings

↓

Apartments

↓

Owners

↓

Tenants

↓

Invoices

↓

Payments

↓

Maintenance

↓

Documents

Each community is completely isolated.

---

# User Roles

Super Admin

Platform administrator

Property Manager

Example:
Vishnu

Community Admin

Apartment Owner

Tenant

Vendor

Auditor (Read Only)

Every page must use Role Based Access Control.

---

# Dashboard

Each role gets a different dashboard.

Owner Dashboard

Show

Outstanding balance

Invoices

Payment history

Upcoming maintenance

Announcements

Open work orders

Community expenses

Reserve fund

Recent documents

Community notices

Upcoming meetings

Quick buttons

Pay invoice

Report issue

Download statement

Message Vishnu

---

Property Manager Dashboard

Show

Outstanding collections

Invoices due

Payments received

Open work orders

Vendor activity

Monthly expenses

Budget

Reserve fund

Pending approvals

Community notices

Upcoming maintenance

Charts

Cash Flow

Collection %

Expenses

Reserve Fund

Outstanding Amount

---

Community Dashboard

This page is visible to every owner.

This is the "HOA Page".

It should feel like a private community portal.

Sections

Community Financial Summary

Current Month Income

Current Month Expenses

Outstanding Dues

Reserve Fund

Expense Breakdown

Expense Categories

Electricity

Water

Watchman

Lift

Generator

Repairs

Garden

Cleaning

Miscellaneous

Every expense should have

Vendor

Receipt

Invoice

Amount

Paid Date

Split Details

Attachment

---

# Work Orders

One of the most important modules.

Every owner can view all common-area work orders.

Examples

Lift Repair

Bore Motor

Generator Service

Water Tank Cleaning

Painting

Roof Leakage

Garden Maintenance

Each work order contains

Title

Description

Priority

Status

Photos

Videos

Estimate

Final Cost

Assigned Vendor

Assigned To

Timeline

Owner comments

Documents

Stages

Reported

Estimate Received

Owner Approval

In Progress

Inspection

Completed

Closed

Owners should receive notifications whenever status changes.

---

# Maintenance Requests

Owners can create maintenance requests.

Private requests

Only owner and Vishnu can see.

Community requests

Visible to everyone.

Example

Street light not working

Lift noise

Parking issue

Security concern

---

# Community Feed

Instead of WhatsApp.

Like Facebook timeline.

Owners can post

Announcements

Questions

Suggestions

Photos

Videos

Comments

Pinned posts

Reactions

Attachments

---

# Polls

Owners can vote.

Examples

Approve Lift Replacement

Approve New Watchman

Increase Monthly Maintenance

Approve Budget

Each vote

Open Date

Close Date

Percentage

Comments

Results

---

# Meeting Minutes

Store

Agenda

Discussion

Attendance

PDF

Audio

Video

Resolutions

Searchable.

---

# Vendor Management

Maintain

Electricians

Plumbers

Lift Vendor

Generator Vendor

Cleaning

Painter

Security

Gardener

Store

Contracts

Insurance

Invoices

Phone

GST

AMC Dates

Performance Rating

---

# Documents

Community documents

Society Rules

Insurance

Water Bills

Electric Bills

Audit Reports

AGM Minutes

Building Plans

Contracts

Searchable.

Version controlled.

---

# Reserve Fund

Maintain

Opening Balance

Monthly Contributions

Expenses

Investments

Current Balance

Graphs

History

---

# Financial Module

Invoices

Payments

Credits

Late Fees

Statements

Receipts

Recurring Charges

Bulk Invoice Generation

PDF Download

CSV Export

---

# Reporting

Monthly

Quarterly

Yearly

Collection Report

Expense Report

Cash Flow

Reserve Fund

Vendor Spend

Outstanding Dues

Owner Ledger

Apartment Ledger

Audit Report

---

# Notifications

Email

Google Push

In App

Later

WhatsApp

---

# Search

Global search.

Search anything.

Apartment

Owner

Vendor

Invoice

Work Order

Document

Notice

Minutes

Expense

---

# Security

Google OAuth only.

Whitelist users.

Unknown users cannot login.

Role Based Access Control.

Audit Log

Every modification should be logged.

---

# Future AI Features

Meeting Summary

Invoice OCR

Receipt OCR

Vendor Recommendation

Predictive Maintenance

Expense Forecast

Automatic Monthly Reports

Voice Search

AI Chat Assistant

---

# Initial Community Data

Community

Mani Krishna Enclave

10 Apartments

Apartment Owners

101 - M.V. Shanmukha Datta

102 - Pasupuleti Ramesh Babu & Anjali

201 - B.O. Dharani Kumar

202 - Vani Padma Sri Manda

301 - Bhupendra Krishna Sangam

302 - Subhasri Lakshmi Sangam

401 - Kanamatha Reddy & Vani Kanyakaparameswari

402 - Vijayaram Sri Venkata Manda & Bhargavi Manda

501 - Prof. Dr. Ramakrishna Manda, MS & Smt. Ratnamamba Manda

502 - Rajaram Sri Venkata Manda & Sushma Manda

Property Manager

Vishnu

---

# Development Strategy

Do NOT build everything at once.

Work in phases.

Phase 1

Authentication

Community creation

Owner management

Apartment management

Dashboards

Navigation

Role Based Access

MongoDB schema

Cloud Run deployment

Phase 2

Invoices

Payments

Statements

Expenses

Reserve Fund

Phase 3

Work Orders

Maintenance

Vendor Management

Community Feed

Phase 4

Meeting Minutes

Documents

Polls

Reports

Notifications

Phase 5

AI Features

Mobile App

WhatsApp Integration

Voice Assistant

---

# Mobile App Readiness Enhancement

Design the backend as API-first so a mobile app can be added later without redesigning the system.

Future mobile app should support:

- Owner push notifications
- Vishnu uploading work-order photos from phone
- Owners reporting common-area issues with photos/videos
- Poll voting from mobile
- Invoice/payment reminders
- Community announcements
- Maintenance status updates

Do not build the mobile app in Phase 1, but design all APIs and data models so React Native or Flutter can be added later.

---

# CI/CD and Infrastructure as Code

The application must be production-ready with automated deployment.

Use:

- GitHub Actions for CI/CD
- Terraform for Google Cloud infrastructure
- Docker for containerization
- Google Cloud Run for app hosting
- Google Artifact Registry for Docker images
- Google Secret Manager for secrets
- Google Cloud Storage for document/receipt storage
- MongoDB Atlas for database

CI/CD requirements:

- On push to main branch, run tests
- Build Docker image
- Push image to Google Artifact Registry
- Deploy to Cloud Run
- Use environment-based deployment: dev, staging, production
- Store all secrets in Google Secret Manager
- Do not commit secrets to GitHub
- Terraform should provision:
  - Cloud Run services
  - Artifact Registry
  - Secret Manager entries
  - Cloud Storage buckets
  - IAM roles
  - Domain mapping for community.rajmanda.com

Deployment domain:

community.rajmanda.com

The final project should include:

- /frontend
- /backend
- /infra/terraform
- /.github/workflows
- docker-compose.yml
- README.md
- DEPLOYMENT.md
- ARCHITECTURE.md

---

Act as a Senior Product Architect, Senior UX Designer and Senior Full Stack Engineer.

Produce production-quality code with clean architecture, modular design, reusable components, comprehensive documentation, Docker support, CI/CD readiness, and an API-first architecture. Do not use mock data beyond the initial seed data for Mani Krishna Enclave.