# nivaasos.com — public marketing site (marketing/ app). Rides the SAME
# global LB and IP as community.rajmanda.com: its own managed cert (never
# touch communityhub-cert — editing a managed cert's domain list forces
# replacement and would drop the app's TLS while re-provisioning) plus a
# host rule on the shared URL map. community.rajmanda.com routing is
# unchanged.
#
# DNS prerequisite (done 2026-07-19 by owner): A nivaasos.com → lb_ip.
# www.nivaasos.com has no DNS record yet, so it is NOT on the cert; add
# both together later if wanted.

resource "google_cloud_run_v2_service" "marketing" {
  name                = "nivaasos-marketing"
  location            = var.region
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false

  template {
    # Static site — reuses the frontend runtime SA (no permissions needed).
    service_account = google_service_account.frontend_runtime.email

    scaling {
      # Static content behind the LB; cold starts are acceptable.
      min_instance_count = 0
      max_instance_count = 2
    }

    containers {
      image = local.placeholder_image
      # All marketing config is baked at build time (NEXT_PUBLIC_*).
    }
  }

  lifecycle {
    ignore_changes = [
      template[0].containers[0].image, # CI deploys images
      client,
      client_version,
    ]
  }

  depends_on = [google_project_service.apis]
}

resource "google_cloud_run_v2_service_iam_member" "marketing_public" {
  name     = google_cloud_run_v2_service.marketing.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_compute_managed_ssl_certificate" "marketing_cert" {
  name = "nivaasos-cert"

  managed {
    domains = [var.marketing_domain]
  }
}

resource "google_compute_region_network_endpoint_group" "marketing_neg" {
  name                  = "nivaasos-marketing-neg"
  region                = var.region
  network_endpoint_type = "SERVERLESS"

  cloud_run {
    service = google_cloud_run_v2_service.marketing.name
  }
}

resource "google_compute_backend_service" "marketing" {
  name                  = "nivaasos-marketing-backend"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  protocol              = "HTTPS"

  backend {
    group = google_compute_region_network_endpoint_group.marketing_neg.id
  }
}
