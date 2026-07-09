# Secret containers only — versions (the actual values) are added out of band
# with `gcloud secrets versions add`, keeping real values out of Terraform
# state and out of the repository.
#
# Names are prefixed "communityhub-" because this GCP project is shared with
# other applications (e.g. estatio-*).

locals {
  secrets = [
    "communityhub-mongodb-uri",
    "communityhub-jwt-secret",
    "communityhub-google-client-id",
    "communityhub-openclaw-api-key",
  ]
}

resource "google_secret_manager_secret" "secrets" {
  for_each  = toset(local.secrets)
  secret_id = each.value

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis]
}

resource google_secret_manager_secret_iam_member api_access {
  for_each  = google_secret_manager_secret.secrets
  secret_id = each.value.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.api_runtime.email}"
}

# Automatically generate a cryptographically secure 48-character hex API key
resource "random_id" "openclaw_api_key" {
  byte_length = 24
}

# Automatically upload the generated key value to Google Secret Manager
resource "google_secret_manager_secret_version" "openclaw_api_key_version" {
  secret      = google_secret_manager_secret.secrets["communityhub-openclaw-api-key"].id
  secret_data = random_id.openclaw_api_key.hex
}

