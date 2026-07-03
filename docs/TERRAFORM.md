# TERRAFORM.md

Last updated: 2026-07-03 · **Status: not yet written (M1)**

Constitution rule: *never create infrastructure manually.* All GCP resources
come from `infra/terraform/`.

## Planned layout

```
infra/terraform/
  main.tf            # providers, backend (GCS state bucket)
  variables.tf       # project_id, region, env, image tags, domain
  artifact_registry.tf
  cloud_run.tf       # communityhub-api + communityhub-frontend
  secrets.tf         # Secret Manager: MONGODB_URI, JWT_SECRET, GOOGLE_CLIENT_ID
  storage.tf         # GCS bucket for documents/receipts/photos (M2+)
  iam.tf             # runtime SAs (least privilege), WIF for GitHub Actions
  domain.tf          # community.rajmanda.com mapping
  environments/
    staging.tfvars
    production.tfvars
```

## Resources to provision

| Resource | Detail |
|---|---|
| Artifact Registry | docker repo `communityhub` |
| Cloud Run ×2 | min instances 0, max small; env from Secret Manager; unauthenticated ingress (app enforces auth) |
| Secret Manager | one secret per value per environment |
| GCS | `communityhub-<env>-media`, uniform access, no public objects |
| IAM | per-service runtime SAs: api → secretAccessor + GCS objectAdmin (own bucket); deploy SA via Workload Identity Federation |
| Domain mapping | community.rajmanda.com → frontend service |

State: GCS backend bucket (bootstrap manually once, document here), state
per environment via workspaces or separate prefixes.

MongoDB Atlas is managed outside Terraform for now (existing cluster owned by
Raj). Revisit the Atlas Terraform provider only if cluster-level automation
becomes necessary.

**Policy:** every infrastructure change updates this file and goes through
`terraform plan` in CI.
