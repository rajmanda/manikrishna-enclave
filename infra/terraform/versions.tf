terraform {
  required_version = ">= 1.7"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }

  backend "gcs" {
    bucket = "mm-owners-5b8611-tfstate"
    prefix = "communityhub"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}
