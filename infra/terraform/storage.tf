# Media bucket for receipts, work-order photos and documents (M2+).
# Objects are never public — the API proxies uploads/downloads with RBAC.

resource "google_storage_bucket" "media" {
  name                        = "${var.project_id}-communityhub-media"
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  versioning {
    enabled = true
  }

  depends_on = [google_project_service.apis]
}

resource "google_storage_bucket_iam_member" "api_media_access" {
  bucket = google_storage_bucket.media.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.api_runtime.email}"
}
