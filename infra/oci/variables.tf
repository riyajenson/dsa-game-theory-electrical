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
}
variable "ssh_public_key_path" {
  type        = string
  description = "Path to the operator's existing public SSH key; never commit the key or tfvars."
}
variable "public_dns_name" {
  type = string
}
variable "data_mount_path" {
  type    = string
  default = "/srv/signalbound/data"
}
variable "volume_gb" {
  type    = number
  default = 50
  validation {
    condition     = var.volume_gb >= 50
    error_message = "OCI block volumes must be at least 50 GB."
  }
}
