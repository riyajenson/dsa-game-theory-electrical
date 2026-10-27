resource "oci_core_vcn" "pilot" {
  compartment_id = var.compartment_ocid
  cidr_blocks    = ["10.42.0.0/16"]
  display_name   = "signalbound-pilot"
  dns_label      = "signalbound"
}

resource "oci_core_internet_gateway" "pilot" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.pilot.id
  display_name   = "signalbound-internet"
  enabled        = true
}

resource "oci_core_route_table" "public" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.pilot.id
  display_name   = "signalbound-public"
  route_rules {
    network_entity_id = oci_core_internet_gateway.pilot.id
    destination       = "0.0.0.0/0"
    destination_type  = "CIDR_BLOCK"
  }
}

resource "oci_core_security_list" "empty" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.pilot.id
  display_name   = "signalbound-empty-security-list"
}

resource "oci_core_subnet" "public" {
  compartment_id    = var.compartment_ocid
  vcn_id            = oci_core_vcn.pilot.id
  cidr_block        = "10.42.1.0/24"
  display_name      = "signalbound-public"
  dns_label         = "public"
  route_table_id    = oci_core_route_table.public.id
  security_list_ids = [oci_core_security_list.empty.id]
}

resource "oci_core_network_security_group" "web" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.pilot.id
  display_name   = "signalbound-web"
}

resource "oci_core_network_security_group_security_rule" "ingress" {
  for_each                  = { ssh = 22, http = 80, https = 443 }
  network_security_group_id = oci_core_network_security_group.web.id
  direction                 = "INGRESS"
  protocol                  = "6"
  source_type               = "CIDR_BLOCK"
  source                    = each.key == "ssh" ? var.ssh_source_cidr : "0.0.0.0/0"
  tcp_options {
    destination_port_range {
      min = each.value
      max = each.value
    }
  }
}

resource "oci_core_network_security_group_security_rule" "egress" {
  network_security_group_id = oci_core_network_security_group.web.id
  direction                 = "EGRESS"
  protocol                  = "all"
  destination_type          = "CIDR_BLOCK"
  destination               = "0.0.0.0/0"
}

resource "oci_core_instance" "app" {
  compartment_id      = var.compartment_ocid
  availability_domain = var.availability_domain
  display_name        = "signalbound-pilot"
  shape               = var.shape
  shape_config {
    ocpus         = var.ocpus
    memory_in_gbs = var.memory_gb
  }
  source_details {
    source_type             = "image"
    source_id               = var.image_ocid
    boot_volume_size_in_gbs = 50
  }
  create_vnic_details {
    subnet_id        = oci_core_subnet.public.id
    nsg_ids          = [oci_core_network_security_group.web.id]
    assign_public_ip = true
  }
  metadata = {
    ssh_authorized_keys = file(var.ssh_public_key_path)
    user_data           = base64encode(file("${path.module}/cloud-init.yaml"))
  }
}

resource "oci_core_volume" "data" {
  compartment_id      = var.compartment_ocid
  availability_domain = var.availability_domain
  display_name        = "signalbound-data"
  size_in_gbs         = var.volume_gb
}

resource "oci_core_volume_attachment" "data" {
  attachment_type = "paravirtualized"
  instance_id     = oci_core_instance.app.id
  volume_id       = oci_core_volume.data.id
}

output "public_ip" {
  value = oci_core_instance.app.public_ip
}
output "dns_name_to_configure" {
  value = var.public_dns_name
}
output "data_volume_id" {
  value = oci_core_volume.data.id
}
output "data_mount_path" {
  value = var.data_mount_path
}
