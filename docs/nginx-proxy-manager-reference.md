# Penpot with Nginx Proxy Manager Setup Guide

This guide shows how to host Penpot on a custom domain using Nginx Proxy Manager (NPM) on Google Cloud VM.

## Why Nginx Proxy Manager?

- **Easy web-based UI** - no manual config file editing
- **Automatic SSL certificates** - one-click Let's Encrypt integration
- **Multiple domains/apps** - manage all your proxies in one place
- **WebSocket support** - built-in for apps like Penpot

---

## Prerequisites

- Google Cloud VM with Penpot already running (see [penpot-google-cloud-deployment.md](penpot-google-cloud-deployment.md))
- Domain name pointing to your VM's external IP
- Penpot running on port 9001

---

## Part 1: Clean Up Old Nginx (If Installed)

If you have regular Nginx installed, remove it first:

```bash
sudo systemctl stop nginx
sudo apt-get remove -y nginx nginx-common
sudo rm -rf /etc/nginx
```

---

## Part 2: Install Nginx Proxy Manager

### Step 1: Create Directory and Docker Compose File

```bash
# Create directory
mkdir -p ~/nginx-proxy-manager
cd ~/nginx-proxy-manager
```

```bash
# Create docker-compose.yaml
nano docker-compose.yaml
```

Paste this configuration:
```yaml
version: '3.8'
services:
  app:
    image: 'jc21/nginx-proxy-manager:latest'
    restart: unless-stopped
    ports:
      - '80:80'     # HTTP
      - '81:81'     # Admin Web UI
      - '443:443'   # HTTPS
    volumes:
      - ./data:/data
      - ./letsencrypt:/etc/letsencrypt
```

Save (Ctrl+X, Y, Enter)

### Step 2: Start Nginx Proxy Manager

```bash
docker compose up -d
```

### Step 3: Verify It's Running

```bash
# Check container status
docker compose ps

# Check if ports are listening
sudo ss -tulpn | grep -E ':80|:81|:443'
```

You should see ports 80, 81, and 443 listening.

---

## Part 3: Configure Nginx Proxy Manager (Web UI)

### Step 4: Access Admin Panel

**Open in your browser:**
```
http://YOUR_VM_EXTERNAL_IP:81
```

Example: `http://34.142.163.156:81`

**Default login credentials:**
- Email: `admin@example.com`
- Password: `changeme`

### Step 5: Change Default Credentials

On first login, you'll be prompted to:
1. Enter your email
2. Set a new password
3. Confirm the password

**Important:** Save these credentials securely!

---

## Part 4: Add Penpot Proxy Host

### Step 6: Create Proxy Host for Penpot

1. **Click "Hosts"** in the top menu
2. **Click "Proxy Hosts"**
3. **Click the blue "Add Proxy Host" button**

### Step 7: Configure Details Tab

Fill in these settings:

- **Domain Names:** `rileycode.online` (or your domain)
- **Scheme:** `http`
- **Forward Hostname / IP:** Choose one:
  - `penpot-penpot-frontend-1` (Docker container name) ✅ Recommended
  - OR `localhost`
  - OR `172.17.0.1` (Docker host IP)
- **Forward Port:** `9001`
- **Cache Assets:** ⬜ Unchecked (optional)
- **Block Common Exploits:** ✅ Checked
- **Websockets Support:** ✅ Checked (Important for Penpot!)
- **Access List:** None

### Step 8: Save Configuration

Click the **"Save"** button at the bottom.

### Step 9: Test HTTP Access

Open in your browser:
```
http://rileycode.online
```

You should now see **Penpot** loading!

---

## Part 5: Add SSL Certificate (HTTPS)

### Step 10: Configure SSL

1. **Edit the proxy host** you just created (click the 3 dots → Edit)
2. **Go to the "SSL" tab**
3. Configure:
   - **SSL Certificate:** Select **"Request a New SSL Certificate"**
   - **Force SSL:** ✅ Checked (redirects HTTP to HTTPS)
   - **HTTP/2 Support:** ✅ Checked
   - **HSTS Enabled:** ✅ Checked (optional, recommended)
   - **HSTS Subdomains:** ⬜ Unchecked (unless needed)
   - **Email Address for Let's Encrypt:** Enter your email
   - **I Agree to the Let's Encrypt Terms of Service:** ✅ Checked

4. **Click "Save"**

Wait 10-30 seconds for the SSL certificate to be issued.

### Step 11: Update Penpot Configuration

Now that you have HTTPS, update Penpot to use the secure URL:

```bash
cd ~/penpot
nano docker-compose.yaml
```

Find the `PENPOT_PUBLIC_URI` line and change it:
```yaml
environment:
  - PENPOT_PUBLIC_URI=https://rileycode.online
```

Save (Ctrl+X, Y, Enter)

### Step 12: Restart Penpot

```bash
docker compose -p penpot -f docker-compose.yaml down
docker compose -p penpot -f docker-compose.yaml up -d
```

### Step 13: Access Penpot via HTTPS

Open in your browser:
```
https://rileycode.online
```

🎉 **Penpot is now running with HTTPS!**

---

## Part 6: Managing Nginx Proxy Manager

### Access Admin Panel Anytime

```
http://YOUR_VM_EXTERNAL_IP:81
```

Or if you've configured it:
```
https://rileycode.online:81
```

### Common Tasks in Web UI

**Add Another Domain/App:**
1. Hosts → Proxy Hosts → Add Proxy Host
2. Configure domain, forward settings, and SSL

**View/Edit Existing Proxy:**
1. Hosts → Proxy Hosts
2. Click 3 dots (•••) → Edit

**Renew SSL Certificate:**
- SSL certificates auto-renew! Check: Hosts → SSL Certificates

**View Logs:**
1. Click on a proxy host
2. Check the logs tab

---

## Part 7: Useful Commands

### Managing Nginx Proxy Manager

```bash
# Go to NPM directory
cd ~/nginx-proxy-manager

# Stop Nginx Proxy Manager
docker compose down

# Start Nginx Proxy Manager
docker compose up -d

# Restart Nginx Proxy Manager
docker compose restart

# View logs
docker compose logs -f

# Update to latest version
docker compose pull
docker compose up -d

# Check status
docker compose ps
```

### Managing Penpot

```bash
# Go to Penpot directory
cd ~/penpot

# Restart Penpot
docker compose -p penpot -f docker-compose.yaml restart

# View Penpot logs
docker compose -p penpot -f docker-compose.yaml logs -f

# Stop Penpot
docker compose -p penpot -f docker-compose.yaml down

# Start Penpot
docker compose -p penpot -f docker-compose.yaml up -d
```

---

## Part 8: Adding Multiple Domains/Apps

You can host multiple applications on the same VM!

**Example: Add another app on a subdomain**

1. In NPM Admin Panel: Hosts → Proxy Hosts → Add Proxy Host
2. Configure:
   - **Domain:** `app2.rileycode.online`
   - **Forward Hostname/IP:** `localhost` (or container name)
   - **Forward Port:** `8080` (or whatever port your app uses)
   - **Websockets:** ✅ If needed
3. SSL Tab: Request New SSL Certificate
4. Save

Now you have:
- `https://rileycode.online` → Penpot (port 9001)
- `https://app2.rileycode.online` → Another app (port 8080)

---

## Part 9: Subdirectory Hosting (Advanced)

If you want to host Penpot at `rileycode.online/penpot` instead of the root:

**Note:** This is more complex and may not work perfectly with Penpot. Root domain hosting is recommended.

1. Edit the Proxy Host
2. Go to **"Advanced"** tab
3. Add this custom config:

```nginx
location /penpot/ {
    proxy_pass http://localhost:9001/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Prefix /penpot;
    
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

4. Update Penpot's `PENPOT_PUBLIC_URI` to:
```yaml
- PENPOT_PUBLIC_URI=https://rileycode.online/penpot
```

5. Restart Penpot

---

## Troubleshooting

### Can't access NPM admin panel (port 81)

**Check if firewall allows port 81:**

In Google Cloud Console:
1. Go to **VPC network** → **Firewall**
2. Create rule:
   - **Name:** `allow-npm-admin`
   - **Target tags:** `http-server`
   - **Source IP ranges:** `0.0.0.0/0` (or restrict to your IP)
   - **Protocols/ports:** TCP `81`

**Or check if NPM is running:**
```bash
cd ~/nginx-proxy-manager
docker compose ps
```

### SSL certificate fails to generate

**Common issues:**
1. Domain not pointing to VM IP (check DNS)
2. Ports 80/443 not accessible (check firewall)
3. Domain already has certificate elsewhere

**Check DNS:**
```bash
nslookup rileycode.online
```

Should return your VM's external IP.

**Check if ports are open:**
```bash
sudo ss -tulpn | grep -E ':80|:443'
```

### Penpot shows "Welcome to nginx!" instead of Penpot

You haven't configured a proxy host yet. Follow Part 4 above.

### "502 Bad Gateway" error

**Penpot container is not running:**
```bash
cd ~/penpot
docker compose -p penpot -f docker-compose.yaml ps
```

**Wrong Forward Hostname/IP in proxy settings:**
- Try changing to `localhost` or container name

**Check Penpot logs:**
```bash
cd ~/penpot
docker compose -p penpot -f docker-compose.yaml logs -f
```

### HTTP works but HTTPS doesn't

1. Make sure SSL certificate was successfully issued (check NPM → SSL Certificates)
2. Verify port 443 is open in firewall
3. Check NPM logs: `cd ~/nginx-proxy-manager && docker compose logs`

### Can't login after changing password

**Reset admin password:**
```bash
cd ~/nginx-proxy-manager
docker compose down
rm -rf data/database.sqlite
docker compose up -d
```

This will reset to default credentials: `admin@example.com` / `changeme`

**Note:** This deletes all your proxy configurations!

---

## Backup and Restore

### Backup Nginx Proxy Manager Configuration

```bash
cd ~/nginx-proxy-manager
tar -czf npm-backup-$(date +%Y%m%d).tar.gz data/ letsencrypt/
```

### Restore from Backup

```bash
cd ~/nginx-proxy-manager
docker compose down
tar -xzf npm-backup-YYYYMMDD.tar.gz
docker compose up -d
```

---

## Security Best Practices

1. **Change default admin credentials immediately**
2. **Restrict admin panel access (port 81):**
   - In Google Cloud firewall, limit port 81 to your IP only
   - Or use NPM access lists feature
3. **Keep NPM updated:**
   ```bash
   cd ~/nginx-proxy-manager
   docker compose pull
   docker compose up -d
   ```
4. **Enable Force SSL** on all proxy hosts
5. **Use strong passwords** for NPM admin
6. **Regular backups** of NPM data directory

---

## Port Reference

| Port | Service | Access |
|------|---------|--------|
| 80 | HTTP | Public |
| 443 | HTTPS | Public |
| 81 | NPM Admin | Restricted (your IP only recommended) |
| 9001 | Penpot Direct | Can be blocked once NPM is working |

---

## Cost Estimate

**No additional cost!** Nginx Proxy Manager runs in Docker on your existing VM.

---

## Next Steps

1. ✅ Set up additional domains/subdomains
2. ✅ Configure automatic backups
3. ✅ Set up access lists for private apps
4. ✅ Monitor SSL certificate renewals (automatic)
5. ✅ Add other applications to NPM

---

## Resources

- Nginx Proxy Manager Docs: https://nginxproxymanager.com/guide/
- Nginx Proxy Manager GitHub: https://github.com/NginxProxyManager/nginx-proxy-manager
- Let's Encrypt Docs: https://letsencrypt.org/docs/
- Main Penpot Deployment Guide: [penpot-google-cloud-deployment.md](penpot-google-cloud-deployment.md)
