variable "tenancy_ocid" {
  type        = string
  description = "OCI tenancy OCID; used for plan review and quota checks."
}
variable "compartment_ocid" {
  type = string
}
variable "home_region" {
  type        = string
  description = "Tenancy home region, where Always Free A1 eligibility applies."
}
variable "availability_domain" {
  type = string
}
variable "image_ocid" {
  type        = string
  description = "Region-specific Ubuntu 24.04 LTS aarch64 platform image OCID, chosen at deployment review."
}
variable "shape" {
  type    = string
  default = "VM.Standard.A1.Flex"
  validation {
    condition     = var.shape == "VM.Standard.A1.Flex"
    error_message = "This pilot is designed for one A1 Flex VM."
  }
}
variable "ocpus" {
  type    = number
  default = 1
}
variable "memory_gb" {
  type    = number
  default = 6
}
variable "ssh_source_cidr" {
  type        = string
  description = "Trusted operator IPv4 CIDR, preferably one /32 address."
  validation {
    condition     = can(cidrnetmask(var.ssh_source_cidr)) && try(cidrnetmask(var.ssh_source_cidr), "") != "0.0.0.0"
    error_message = "Use a restricted trusted IPv4 CIDR for SSH; 0.0.0.0/0 is not allowed."
  }
}
variable "ssh_public_key_path" {
  type        = string
  description = "Path to the operator's existing public SSH key; never commit the key or tfvars."
}
variable "public_dns_name" {
  type = string
}
variable "data_mount_path" {
  type        = string
  description = "Fixed mount path used by the pilot service, environment, and runbook."
  default     = "/srv/signalbound/data"
  validation {
    condition     = var.data_mount_path == "/srv/signalbound/data"
    error_message = "This pilot mounts data at /srv/signalbound/data; update all service and operator templates before changing it."
  }
}
variable "volume_gb" {
  type    = number
  default = 50
  validation {
    condition     = var.volume_gb >= 50
    error_message = "OCI block volumes must be at least 50 GB."
  }
}
