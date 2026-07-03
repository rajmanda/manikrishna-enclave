output "api_url" {
  value = google_cloud_run_v2_service.api.uri
}

output "frontend_url" {
  value = google_cloud_run_v2_service.frontend.uri
}

output "artifact_registry" {
  value = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.communityhub.repository_id}"
}

output "wif_provider" {
  description = "Use as workload_identity_provider in GitHub Actions"
  value       = google_iam_workload_identity_pool_provider.github_oidc.name
}

output "deployer_service_account" {
  value = google_service_account.deployer.email
}

output "lb_ip" {
  description = "Create DNS A record: community.rajmanda.com → this IP"
  value       = google_compute_global_address.lb_ip.address
}
