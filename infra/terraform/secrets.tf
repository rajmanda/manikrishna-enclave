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

resource "google_secret_manager_secret_iam_member" "api_access" {
  for_each  = google_secret_manager_secret.secrets
  secret_id = each.value.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.api_runtime.email}"
}
