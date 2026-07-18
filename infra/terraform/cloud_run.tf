# Both services start on a placeholder image; GitHub Actions owns the image
# from then on (lifecycle ignore_changes), so Terraform manages the service
# shape and CI manages releases.

locals {
  placeholder_image = "us-docker.pkg.dev/cloudrun/container/hello"
}

resource "google_cloud_run_v2_service" "api" {
  name                = "communityhub-backend"
  location            = var.region
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false

  template {
    service_account = google_service_account.api_runtime.email

    scaling {
      # min 1: keeps one instance warm — cold starts were adding seconds
      # for the first visitor (see docs/CHANGELOG 0.5.x latency work).
      min_instance_count = 1
      max_instance_count = 2
    }

    containers {
      image = local.placeholder_image

      env {
        name  = "ENVIRONMENT"
        value = "production"
      }
      env {
        name  = "DB_NAME"
        value = var.db_name
      }
      env {
        name  = "DEV_MODE"
        value = "false"
      }
      env {
        name  = "SEED_ON_START"
        value = "false"
      }
      env {
        name  = "CORS_ORIGINS"
        value = "https://${var.domain}"
      }
      env {
        name  = "GCS_BUCKET"
        value = google_storage_bucket.media.name
      }
      env {
        name = "MONGODB_URI"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.secrets["communityhub-mongodb-uri"].secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "JWT_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.secrets["communityhub-jwt-secret"].secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "GOOGLE_CLIENT_ID"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.secrets["communityhub-google-client-id"].secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "OPENCLAW_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.secrets["communityhub-openclaw-api-key"].secret_id
            version = "latest"
          }
        }
      }
      # Growth Center — isolated super-admin module. DB name uses the
      # backend default ("growth_center"); the URI must point at a
      # dedicated database, never the operational one.
      env {
        name = "GROWTH_CENTER_MONGO_URI"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.secrets["communityhub-growth-center-mongo-uri"].secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "FIRECRAWL_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.secrets["communityhub-firecrawl-api-key"].secret_id
            version = "latest"
          }
        }
      }
    }
  }

  lifecycle {
    ignore_changes = [
      template[0].containers[0].image, # CI deploys images
      client,
      client_version,
    ]
  }

  depends_on = [
    google_project_service.apis,
    google_secret_manager_secret_iam_member.api_access,
  ]
}

resource "google_cloud_run_v2_service" "frontend" {
  name                = "communityhub-frontend"
  location            = var.region
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false

  template {
    service_account = google_service_account.frontend_runtime.email

    scaling {
      min_instance_count = 0
      max_instance_count = 2
    }

    containers {
      image = local.placeholder_image
      # All frontend config is baked at build time (NEXT_PUBLIC_*).
    }
  }

  lifecycle {
    ignore_changes = [
      template[0].containers[0].image,
      client,
      client_version,
    ]
  }

  depends_on = [google_project_service.apis]
}

# Public ingress — the application enforces authentication itself.
resource "google_cloud_run_v2_service_iam_member" "api_public" {
  name     = google_cloud_run_v2_service.api.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "frontend_public" {
  name     = google_cloud_run_v2_service.frontend.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# --- Daily Sandbox Cleanup Cron Job ---

resource "google_cloud_run_v2_job" "cleanup" {
  name                = "communityhub-cleanup-sandboxes"
  location            = var.region
  deletion_protection = false

  template {
    template {
      service_account = google_service_account.api_runtime.email

      containers {
        image = local.placeholder_image
        command = ["python", "-m", "app.cron.cleanup_sandboxes"]

        env {
          name  = "ENVIRONMENT"
          value = "production"
        }
        env {
          name  = "DB_NAME"
          value = var.db_name
        }
        env {
          name = "MONGODB_URI"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.secrets["communityhub-mongodb-uri"].secret_id
              version = "latest"
            }
          }
        }
      }
    }
  }

  lifecycle {
    ignore_changes = [
      template[0].template[0].containers[0].image,
    ]
  }

  depends_on = [
    google_project_service.apis,
    google_secret_manager_secret_iam_member.api_access,
  ]
}

resource "google_cloud_scheduler_job" "cleanup_trigger" {
  name             = "communityhub-cleanup-trigger"
  description      = "Triggers the sandbox cleanup job daily at 2:00 AM UTC"
  schedule         = "0 2 * * *"
  time_zone        = "Etc/UTC"
  attempt_deadline = "320s"

  retry_config {
    retry_count = 1
  }

  http_target {
    http_method = "POST"
    uri         = "https://${var.region}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${var.project_id}/jobs/${google_cloud_run_v2_job.cleanup.name}:run"

    oauth_token {
      service_account_email = google_service_account.scheduler.email
    }
  }

  depends_on = [
    google_cloud_run_v2_job.cleanup,
  ]
}

# --- Daily Database Backup Cron Job (runs at 1:00 AM UTC, before 2:00 AM cleanup) ---

resource "google_cloud_run_v2_job" "backup" {
  name                = "communityhub-db-backup"
  location            = var.region
  deletion_protection = false

  template {
    template {
      service_account = google_service_account.api_runtime.email

      containers {
        image = local.placeholder_image
        command = ["python", "-m", "app.cron.backup_db"]

        env {
          name  = "ENVIRONMENT"
          value = "production"
        }
        env {
          name  = "DB_NAME"
          value = var.db_name
        }
        env {
          name  = "GCS_BACKUP_BUCKET"
          value = google_storage_bucket.backups.name
        }
        env {
          name = "MONGODB_URI"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.secrets["communityhub-mongodb-uri"].secret_id
              version = "latest"
            }
          }
        }
      }
    }
  }

  lifecycle {
    ignore_changes = [
      template[0].template[0].containers[0].image,
    ]
  }

  depends_on = [
    google_project_service.apis,
    google_secret_manager_secret_iam_member.api_access,
    google_storage_bucket.backups,
  ]
}

resource "google_cloud_scheduler_job" "backup_trigger" {
  name             = "communityhub-backup-trigger"
  description      = "Triggers the database backup job daily at 1:00 AM UTC"
  schedule         = "0 1 * * *"
  time_zone        = "Etc/UTC"
  attempt_deadline = "320s"

  retry_config {
    retry_count = 1
  }

  http_target {
    http_method = "POST"
    uri         = "https://${var.region}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${var.project_id}/jobs/${google_cloud_run_v2_job.backup.name}:run"

    oauth_token {
      service_account_email = google_service_account.scheduler.email
    }
  }

  depends_on = [
    google_cloud_run_v2_job.backup,
  ]
}
