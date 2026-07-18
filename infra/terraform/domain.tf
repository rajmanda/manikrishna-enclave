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
  name                  = "communityhub-backend-neg"
  region                = var.region
  network_endpoint_type = "SERVERLESS"

  cloud_run {
    service = google_cloud_run_v2_service.api.name
  }

  lifecycle {
    create_before_destroy = true
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

  # Both app domains share the same routing (frontend + /api/*) during the
  # transition from community.rajmanda.com to community.nivaasos.com.
  host_rule {
    hosts        = [var.domain, var.community_domain]
    path_matcher = "main"
  }

  path_matcher {
    name            = "main"
    default_service = google_compute_backend_service.frontend.id

    path_rule {
      paths   = ["/api/*", "/health", "/healthz", "/docs", "/openapi.json"]
      service = google_compute_backend_service.api.id
    }
  }

  # nivaasos.com → static marketing site only; no /api/* on this host.
  host_rule {
    hosts        = [var.marketing_domain]
    path_matcher = "marketing"
  }

  path_matcher {
    name            = "marketing"
    default_service = google_compute_backend_service.marketing.id
  }
}

resource "google_compute_target_https_proxy" "communityhub" {
  name    = "communityhub-https-proxy"
  url_map = google_compute_url_map.communityhub.id
  # Two independent managed certs (app + marketing): adding a domain to an
  # existing managed cert would force replacement; separate certs keep
  # community.rajmanda.com untouched. SNI picks the right one.
  ssl_certificates = [
    google_compute_managed_ssl_certificate.cert.id,
    google_compute_managed_ssl_certificate.marketing_cert.id,
    google_compute_managed_ssl_certificate.community_cert.id,
  ]
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
