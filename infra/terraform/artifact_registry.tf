resource "google_artifact_registry_repository" "communityhub" {
  repository_id = "communityhub"
  location      = var.region
  format        = "DOCKER"
  description   = "CommunityHub container images (api, frontend)"

  depends_on = [google_project_service.apis]
}
