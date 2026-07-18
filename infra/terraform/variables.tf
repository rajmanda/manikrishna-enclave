variable "project_id" {
  type    = string
  default = "mm-owners-5b8611"
}

variable "project_number" {
  type    = string
  default = "1048909334838"
}

variable "region" {
  type    = string
  default = "asia-south1"
}

variable "github_repo" {
  description = "GitHub repo allowed to deploy via Workload Identity Federation"
  type        = string
  default     = "rajmanda/manikrishna-enclave"
}

variable "domain" {
  type    = string
  default = "community.rajmanda.com"
}

variable "marketing_domain" {
  description = "Public marketing site (Nivaasos) domain, same LB/IP"
  type        = string
  default     = "nivaasos.com"
}

variable "db_name" {
  description = "MongoDB database name for production"
  type        = string
  default     = "communityhub"
}
