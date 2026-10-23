# Signalbound OCI pilot operator runbook

This runbook prepares one Ubuntu 24.04 LTS **aarch64** VM on OCI Ampere A1. It is a deployment plan, not an instruction to apply it now. One Node 24.21.0 process and three locally built C++ executables serve Solo, multiplayer, leaderboard, and `/dashboard`. Nginx 1.24 from Ubuntu 24.04 packages terminates TLS and forwards WebSocket Upgrade. A separately attached ext4 block volume holds SQLite and WAL files. The VM and volume remain one failure domain. The guest leaderboard does not establish durable player identity or prevent collusion.

## Gate and cost review before any apply

Obtain the tenancy and compartment OCIDs, **home region**, availability domain, Ubuntu 24.04 aarch64 image OCID for that region, DNS name, operator public SSH CIDR, public SSH key path, spending ceiling, and explicit deployment authorization. Check current [A1 and block volume free allocation and home-region rules](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm), [Arm image support](https://docs.oracle.com/en-us/iaas/Content/Compute/References/arm.htm), the [region's Ubuntu aarch64 image](https://docs.oracle.com/en-us/iaas/images/ubuntu-2404/index.htm), and the tenancy's [actual limits and usage](https://docs.oracle.com/en-us/iaas/Content/General/service-limits/default.htm). A1 capacity may be unavailable; idle Always Free VMs may be reclaimed. The default plan requests **one A1 Flex VM, 1 OCPU, 6 GB RAM, a 50 GB boot volume, a 50 GB block volume, a public IPv4 address, VCN, subnet, internet gateway, route table, and security group**. Examine tenancy-specific compute, storage, public IP, outbound traffic, backup, and DNS charges and remaining allowance before approval. The attached volume does not protect against an availability-domain failure; export backups off VM.

The Terraform provider is pinned to `oracle/oci` 8.29.0 and its lock file is committed. OCI authentication comes from the operator's standard OCI environment or configuration file, outside the repository. Put values in an ignored `infra/oci/terraform.tfvars`, including `tenancy_ocid`, `compartment_ocid`, `home_region`, `availability_domain`, `image_ocid`, `ssh_source_cidr`, `ssh_public_key_path`, and `public_dns_name`. The pilot fixes `data_mount_path` at `/srv/signalbound/data` because the service, environment file, and mount commands use that path; changing it requires updating those templates together. SSH source must be a restricted IPv4 CIDR, never `0.0.0.0/0`. Oracle's current candidate image is `Canonical-Ubuntu-24.04-aarch64-2026.09.18-0`; verify its region-specific OCID and compatibility with A1 at the gate. Never put private keys, signing keys, passwords, or API tokens in tfvars or cloud-init. Terraform state can contain the public SSH key and OCI identifiers; keep state encrypted and access-controlled outside Git.

Local structure check, with no OCI calls or resource creation:

```sh
cd infra/oci
terraform fmt -check
terraform init -backend=false -input=false
terraform validate
```

At the **later deployment gate only**, after credentials and values are supplied, inspect `terraform plan -out=pilot.tfplan` and `terraform show pilot.tfplan`. Confirm there is one VM and one data volume, expected image/shape/size, SSH CIDR, only 22/80/443 ingress, no app-port ingress, current pricing and quota. Do not run `apply` without the separate authorization. The VM's host firewall must match the security group. `terraform destroy` also deletes the attached data volume and match history; export and verify an off-VM backup before a later authorized destroy.

## Build and release on Arm

The OCI image must be Ubuntu 24.04 LTS aarch64, selected by region-specific OCID at the gate. Cloud-init installs base packages including Ubuntu's security-updated nginx 1.24, `g++`, and `certbot`, and creates the `signalbound` service user. It performs no application deployment and carries no secrets. Record `uname -m`, `nginx -v`, `g++ --version`, and `apt-cache policy nginx` in the deployment log. Node is pinned to 24.21.0 and downloaded as its official Linux Arm64 archive; compare its SHA256 with the official release list:

```sh
cd /tmp
curl -fsSLO https://nodejs.org/dist/v24.21.0/node-v24.21.0-linux-arm64.tar.xz
curl -fsSLO https://nodejs.org/dist/v24.21.0/SHASUMS256.txt
grep ' node-v24.21.0-linux-arm64.tar.xz$' SHASUMS256.txt | sha256sum -c -
sudo tar -xJf node-v24.21.0-linux-arm64.tar.xz -C /opt
sudo mv /opt/node-v24.21.0-linux-arm64 /opt/node-v24.21.0
/opt/node-v24.21.0/bin/node --version
```

In the local phase-6 worktree, record `git rev-parse HEAD`; create a release archive with `git archive HEAD | gzip > signalbound-<commit>.tar.gz`. Transfer it to the VM only after the gate. On the VM, substitute the reviewed commit and archive:

```sh
RELEASE=<commit>
sudo mkdir -p "/srv/signalbound/releases/$RELEASE"
sudo tar -xzf "/tmp/signalbound-$RELEASE.tar.gz" -C "/srv/signalbound/releases/$RELEASE"
sudo chown -R signalbound:signalbound "/srv/signalbound/releases/$RELEASE"
cd "/srv/signalbound/releases/$RELEASE"
sudo -u signalbound /opt/node-v24.21.0/bin/node scripts/start-dashboard.js --check
sudo -u signalbound /opt/node-v24.21.0/bin/node scripts/test-native.js multiplayer
file simulation_cli.exe game_cli.exe multiplayer_cli.exe
```

The `.exe` suffix is historical; Linux executes these locally compiled ELF files. The [Arm CI workflow](../.github/workflows/arm-release-check.yml) repeats the full build and tests on `ubuntu-24.04-arm`; a Windows x86 pass is not Arm evidence. The workflow is not claimed as run until its job reports success.

## Data volume and service

Use `lsblk -f` and OCI attachment details to identify the **new** data device. Confirm it is the 50 GB attached volume before formatting. Set `DEVICE` to that verified device (never guess `/dev/sdb`):

```sh
DEVICE=<verified-new-data-device>
sudo mkfs.ext4 "$DEVICE"
sudo mkdir -p /srv/signalbound/data
UUID=$(sudo blkid -s UUID -o value "$DEVICE")
echo "UUID=$UUID /srv/signalbound/data ext4 defaults,nofail 0 2" | sudo tee -a /etc/fstab
sudo mount /srv/signalbound/data
findmnt /srv/signalbound/data
sudo chown signalbound:signalbound /srv/signalbound/data
sudo chmod 700 /srv/signalbound/data
```

The unit's `RequiresMountsFor` prevents a boot-volume database from silently replacing an unmounted data volume. Copy `deploy/signalbound.service` to `/etc/systemd/system/`. Copy `deploy/signalbound.env.example` to `/etc/signalbound/signalbound.env` (mode 0640, root ownership), replace the example DNS name in both origin variables, and check every value. The server uses stdout/stderr JSON startup logging in journald and never logs bearer tokens or request bodies. `COOKIE_MODE=none` is deliberate: sessions use browser local storage bearer tokens and the app issues no cookies. New cookies would require Secure, HttpOnly, and SameSite attributes.

Activate a verified release by switching the `current` symlink while the service is stopped:

```sh
sudo systemctl stop signalbound || true
sudo ln -sfn "/srv/signalbound/releases/$RELEASE" /srv/signalbound/current.new
sudo mv -Tf /srv/signalbound/current.new /srv/signalbound/current
sudo systemctl daemon-reload
sudo systemctl enable --now signalbound
sudo systemctl status signalbound --no-pager
curl -fsS http://127.0.0.1:3000/api/live
```

Never run a second server process against active rooms. A restart marks active matches **interrupted and unranked** in SQLite; guests reconnect to see the reason and may reopen a lobby within 30 minutes of inactivity. Completed match insertion and active-marker removal share one transaction, preventing duplicate leaderboard awards. Lobby-only rooms expire on restart. Stopping for an upgrade has this same active-match effect; schedule maintenance between matches. If a release fails, `sudo systemctl stop signalbound`, switch `current` to the prior tested release with `ln -sfn` and `mv -Tf` as above, then `sudo systemctl start signalbound`. The database migration is additive; test rollback against a backup before changing schema in a future release.

## HTTP, TLS, WebSocket, and firewall

Create the public DNS A record for the VM's public IP **at the later gate**. Before enabling the host firewall, verify the current SSH connection's source address matches the reviewed CIDR and inspect existing image firewall rules. Then mirror the NSG ingress on Ubuntu:

```sh
SSH_CIDR=<reviewed-trusted-ip/32>
sudo ufw default deny incoming
sudo ufw allow from "$SSH_CIDR" to any port 22 proto tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
sudo ufw status verbose
```

Render `deploy/nginx-bootstrap.conf` with `__DOMAIN__` replaced by the reviewed DNS name, install as `/etc/nginx/sites-available/signalbound`, enable it, remove the default site, run `sudo nginx -t`, and `sudo systemctl reload nginx`. Request a certificate only after DNS resolves:

```sh
DOMAIN=<reviewed-dns-name>
EMAIL=<operator-email>
sudo certbot certonly --webroot -w /var/www/letsencrypt -d "$DOMAIN" --agree-tos --email "$EMAIL" --no-eff-email
```

Render `deploy/nginx-tls.conf` using the same domain, replace the bootstrap site, then `sudo nginx -t && sudo systemctl reload nginx`. Configure renewal with `sudo certbot renew --dry-run` and an nginx reload hook. The proxy preserves Host and Origin, sets `X-Forwarded-Proto: https`, and forwards WebSocket Upgrade. Browser HTTPS automatically selects WSS on the same public origin. Production rejects non-loopback proxy traffic, wrong Host/proto, nonmatching POST Origin, and nonmatching WebSocket Origin. Keep port 3000 on `127.0.0.1`; allow 22 only from `ssh_source_cidr`, and 80/443 publicly in both OCI NSG and host firewall. Check the image's firewall rules before enabling UFW to avoid locking out SSH.

Health and smoke checks:

```sh
curl -fsS "https://$DOMAIN/api/live"
curl -fsS "https://$DOMAIN/api/health"
/opt/node-v24.21.0/bin/node scripts/smoke.js "https://$DOMAIN"
sudo systemctl is-active signalbound nginx
sudo journalctl -u signalbound -n 100 --no-pager
sudo tail -n 100 /var/log/nginx/error.log
```

`/api/live` only confirms the process; `/api/health` executes tiny requests through all three C++ binaries and checks SQLite integrity and write access. It returns booleans, no internal paths. After deployment approval, complete two-device HTTPS/WSS play, refresh, timeout, result, rematch, and restore smoke test. The local repeatable TLS proxy and browser QA commands are in the README.

## Backup, restore, monitoring, shutdown

Back up the live WAL database with Node's SQLite online backup API, verify the snapshot, and transfer it **off the VM**. A raw copy of `matches.sqlite` while it is open is not a valid backup. Example, with a timestamp and space available:

```sh
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
sudo -u signalbound mkdir -p /srv/signalbound/data/backups
cd /srv/signalbound/current
sudo -u signalbound /opt/node-v24.21.0/bin/node scripts/sqlite-backup.js backup /srv/signalbound/data/matches.sqlite "/srv/signalbound/data/backups/$STAMP.sqlite"
sudo -u signalbound /opt/node-v24.21.0/bin/node scripts/sqlite-backup.js verify "/srv/signalbound/data/backups/$STAMP.sqlite"
```

For restore, stop the service, preserve the existing database **and its WAL/SHM** in a dated incident directory, restore to a nonexistent destination, start, and inspect leaderboard and match count. Use a verified off-VM backup if the disk itself failed:

```sh
sudo systemctl stop signalbound
sudo mkdir -p /srv/signalbound/data/incident-$STAMP
sudo mv /srv/signalbound/data/matches.sqlite* /srv/signalbound/data/incident-$STAMP/
cd /srv/signalbound/current
sudo -u signalbound /opt/node-v24.21.0/bin/node scripts/sqlite-backup.js restore "/srv/signalbound/data/backups/$STAMP.sqlite" /srv/signalbound/data/matches.sqlite
sudo systemctl start signalbound
curl -fsS "https://$DOMAIN/api/health"
```

The restore command refuses an existing database or WAL/SHM destination. Test restoration periodically on a separate offline path, as the local automated test does. Monitor `systemctl status`, journald errors, nginx 5xx, `df -h /srv/signalbound/data`, `free -h`, `uptime`, certificate expiry (`certbot certificates`), backup age, and OCI CPU/memory/network/volume alarms. Apply Ubuntu security updates routinely (`sudo apt update && sudo apt upgrade`), inspect reboot requirements, and repeat smoke and two-device checks after restarts. To stop serving, `sudo systemctl stop signalbound nginx`; preserve off-VM backups before any authorized infrastructure destruction.
