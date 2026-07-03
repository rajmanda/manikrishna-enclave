# community.rajmanda.com via a global external HTTPS load balancer.
# (Cloud Run domain mappings are not supported in asia-south1.)
#
# Routing: default → frontend service, /api/* → API service. This puts the
# app and its API on ONE origin, so browser calls are same-origin.
#
# After apply, create a DNS A record:
#   community.rajmanda.com → <output: lb_ip>
# The managed certificate provisions automatically once DNS resolves
# (usually 15–60 minutes).

resource "google_compute_global_address" "lb_ip" {
  name = "communityhub-lb-ip"

  depends_on = [google_project_service.apis]
}

resource "google_compute_managed_ssl_certificate" "cert" {
  name = "communityhub-cert"

  managed {
    domains = [var.domain]
  }
}

resource "google_compute_region_network_endpoint_group" "frontend_neg" {
  name                  = "communityhub-frontend-neg"
  region                = var.region
  network_endpoint_type = "SERVERLESS"

  cloud_run {
    service = google_cloud_run_v2_service.frontend.name
  }
}

resource "google_compute_region_network_endpoint_group" "api_neg" {
  name                  = "communityhub-api-neg"
  region                = var.region
  network_endpoint_type = "SERVERLESS"

  cloud_run {
    service = google_cloud_run_v2_service.api.name
  }
}

resource "google_compute_backend_service" "frontend" {
  name                  = "communityhub-frontend-backend"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  protocol              = "HTTPS"

  backend {
    group = google_compute_region_network_endpoint_group.frontend_neg.id
  }
}

resource "google_compute_backend_service" "api" {
  name                  = "communityhub-api-backend"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  protocol              = "HTTPS"

  backend {
    group = google_compute_region_network_endpoint_group.api_neg.id
  }
}

resource "google_compute_url_map" "communityhub" {
  name            = "communityhub-urlmap"
  default_service = google_compute_backend_service.frontend.id

  host_rule {
    hosts        = [var.domain]
    path_matcher = "main"
  }

  path_matcher {
    name            = "main"
    default_service = google_compute_backend_service.frontend.id

    path_rule {
      paths   = ["/api/*", "/healthz", "/docs", "/openapi.json"]
      service = google_compute_backend_service.api.id
    }
  }
}

resource "google_compute_target_https_proxy" "communityhub" {
  name             = "communityhub-https-proxy"
  url_map          = google_compute_url_map.communityhub.id
  ssl_certificates = [google_compute_managed_ssl_certificate.cert.id]
}

resource "google_compute_global_forwarding_rule" "https" {
  name                  = "communityhub-https"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  ip_address            = google_compute_global_address.lb_ip.address
  port_range            = "443"
  target                = google_compute_target_https_proxy.communityhub.id
}

# HTTP → HTTPS redirect
resource "google_compute_url_map" "http_redirect" {
  name = "communityhub-http-redirect"

  default_url_redirect {
    https_redirect         = true
    redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
    strip_query            = false
  }
}

resource "google_compute_target_http_proxy" "http_redirect" {
  name    = "communityhub-http-proxy"
  url_map = google_compute_url_map.http_redirect.id
}

resource "google_compute_global_forwarding_rule" "http" {
  name                  = "communityhub-http"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  ip_address            = google_compute_global_address.lb_ip.address
  port_range            = "80"
  target                = google_compute_target_http_proxy.http_redirect.id
}
