# TERRAFORM.md

Last updated: 2026-07-03 · **Status: APPLIED** — 33 resources live in
`mm-owners-5b8611` (asia-south1). State: `gs://mm-owners-5b8611-tfstate`
(versioned, created once by hand as the bootstrap step).

Constitution rule: *never create infrastructure manually.* All GCP resources
come from `infra/terraform/`. Run locally: `terraform init && terraform plan`.

## Layout (actual)

```
infra/terraform/
  versions.tf           # google ~>6, GCS state backend
  variables.tf          # project, region, github_repo, domain, db_name
  apis.tf               # run, artifactregistry, secretmanager, iam, sts, compute
  artifact_registry.tf  # docker repo "communityhub"
  iam.tf                # runtime SAs, github-deployer SA, WIF pool+provider
  secrets.tf            # communityhub-{mongodb-uri,jwt-secret,google-client-id}
  cloud_run.tf          # both services (placeholder image; CI owns releases)
  domain.tf             # global HTTPS LB: cert, NEGs, backends, URL map, redirect
  outputs.tf            # urls, lb_ip, wif_provider, deployer SA
```

## Key design points

- **Shared GCP project:** everything is named/prefixed `communityhub-*` —
  never touch `estatio-*` or other unrelated resources.
- **CI owns images:** Cloud Run services ignore `image` changes
  (`lifecycle.ignore_changes`); Terraform manages shape, deploy.yml manages
  releases. Services start from Google's hello placeholder.
- **Secrets:** Terraform creates containers only; values added via
  `gcloud secrets versions add` so they never enter state or the repo.
- **WIF:** GitHub OIDC pool `github/providers/github-oidc`, attribute
  condition restricts to `rajmanda/manikrishna-enclave`; deployer SA has
  run.admin + artifactregistry.writer + serviceAccountUser on runtime SAs.
- **LB instead of domain mapping:** Cloud Run domain mappings are not
  available in asia-south1, so community.rajmanda.com terminates at a global
  external ALB (managed cert) with serverless NEGs; `/api/*` routes to the
  API service → same-origin app+API. LB IP output: `lb_ip` (34.120.210.248).
- `deletion_protection = false` on Cloud Run services so Terraform can
  replace them; protection comes from GCS-versioned state + code review.

## Not in Terraform (deliberate)

- MongoDB Atlas (owner-managed existing cluster).
- Google OAuth client (console-only for external consent screens).
- The tfstate bucket itself (chicken-and-egg bootstrap).

## Known quirks

- First apply hit "domain mappings not allowed in asia-south1" (→ LB) and a
  pre-existing `google-client-id` secret from another app (→ prefix). If a
  Cloud Run create fails mid-apply, `gcloud run services delete` +
  `terraform state rm` + re-apply is cleaner than fighting the taint.

**Policy:** every infrastructure change updates this file and goes through
`terraform plan` before apply.
