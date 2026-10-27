# Penpot Deployment on Google Cloud Platform

## Overview
This guide shows how to deploy Penpot on Google Cloud using a Compute Engine VM (similar to a VPS). This is the most straightforward approach that uses your existing Docker Compose setup.

## Prerequisites
- Google Cloud account (get $300 free credits for new users)
- Web browser (Chrome, Firefox, Safari, etc.)
- Your existing `docker-compose.yaml` knowledge

---

d## Part 1: Google Cloud Setup (Web Console)

### Step 1: Access Google Cloud Console

1. Go to **https://console.cloud.google.com**
2. Sign in with your Google account
3. Accept terms of service if prompted

### Step 2: Select or Create Project

1. Click the **project dropdown** at the top of the page (next to "Google Cloud")
2. If you already have the `mofilabs` project:
   - Select it from the list
3. If you need to create a new project:
   - Click **NEW PROJECT**
   - Enter project name (e.g., `mofilabs` or `penpot-hosting`)
   - Click **CREATE**
   - Wait for project creation (takes ~30 seconds)
   - Select your new project from the dropdown

### Step 3: Enable Required APIs

1. In the search bar at the top, type **"Compute Engine"**
2. Click on **Compute Engine API**
3. Click **ENABLE** (this may take a minute)
4. Wait for it to finish enabling

> **Note:** The Compute Engine API is all you need to get started. Other APIs will be enabled automatically as needed.

---

## Part 2: Create a VM Instance for Penpot

### Step 4: Create the VM (Web Console)

1. **Navigate to VM Instances:**
   - In the left sidebar, click **≡ Menu** → **Compute Engine** → **VM instances**
   - Or search for "VM instances" in the top search bar
   - Click **CREATE INSTANCE**

2. **Configure the instance:**

   **Basic Settings:**
   - **Name:** `penpot-server`
   - **Region:** `us-central1` (Iowa) - or choose closest to you
   - **Zone:** `us-central1-a`

   **Machine Configuration:**
   - **Series:** E2
   - **Machine type:** 
     - **Recommended:** `e2-standard-2` (2 vCPU, 8GB RAM) - ~$50/month
     - **Minimum:** `e2-medium` (2 vCPU, 4GB RAM) - ~$25/month

   **OS and storage:**
   - Click **CHANGE**
   - **Operating system:** Ubuntu
   - **Version:** Ubuntu 22.04 LTS
   - **Boot disk type:** Standard persistent disk
   - **Size:** 50 GB
   - Click **SELECT**

   **Firewall:**
   - ✅ Check **Allow HTTP traffic**
   - ✅ Check **Allow HTTPS traffic**

3. **Click CREATE** at the bottom

4. **Wait ~1-2 minutes** for the VM to be created

### Step 5: Configure Firewall Rules (Web Console)

**Allow Penpot Port (9001):**

1. In the left sidebar: **≡ Menu** → **VPC network** → **Firewall**
2. Click **CREATE FIREWALL RULE**
3. Configure:
   - **Name:** `allow-penpot`
   - **Description:** `Allow Penpot on port 9001`
   - **Logs:** Off
   - **Network:** default
   - **Priority:** 1000
   - **Direction:** Ingress
   - **Action on match:** Allow
   - **Targets:** Specified target tags
   - **Target tags:** `http-server`
   - **Source filter:** IPv4 ranges
   - **Source IPv4 ranges:** `0.0.0.0/0`
   - **Protocols and ports:**
     - ✅ Specified protocols and ports
     - **TCP:** `9001`
4. Click **CREATE**

**Allow Mailcatcher Port (1080) - Optional:**

1. Click **CREATE FIREWALL RULE** again
2. Configure:
   - **Name:** `allow-mailcatcher`
   - **Description:** `Allow Mailcatcher on port 1080`
   - **Network:** default
   - **Priority:** 1000
   - **Direction:** Ingress
   - **Action on match:** Allow
   - **Targets:** Specified target tags
   - **Target tags:** `http-server`
   - **Source filter:** IPv4 ranges
   - **Source IPv4 ranges:** `0.0.0.0/0`
   - **Protocols and ports:**
     - ✅ Specified protocols and ports
     - **TCP:** `1080`
3. Click **CREATE**

---

## Part 3: Deploy Penpot on the VM

### Step 6: Connect to Your VM (Web Console)

1. Go back to **Compute Engine** → **VM instances**
2. Find your `penpot-server` instance
3. Click the **SSH** button next to it
4. A new browser window will open with a terminal connection
5. Wait for the connection to establish (~10 seconds)

> **Important:** Steps 7-11 below are ALL done in this SSH browser terminal (on the VM), NOT on your local computer!

### Step 7: Install Docker (in the SSH terminal)

```bash
# Update package list
sudo apt-get update

# Install prerequisites
sudo apt-get install -y ca-certificates curl gnupg lsb-release

# Add Docker's official GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Set up the repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Update package list again
sudo apt-get update

# Install Docker Engine, containerd, and Docker Compose
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Verify
docker --version

# Start Docker service (should auto-start, but just in case)
sudo systemctl start docker
sudo systemctl enable docker

# Add your user to docker group (to run docker without sudo)
sudo usermod -aG docker $USER

# Apply group changes
newgrp docker

# Verify Docker installation
docker --version
docker compose version
```

> **Note:** If you see "permission denied" errors when running docker commands, close the SSH window and reconnect (click SSH button again).

### Step 8: Download Penpot Docker Compose File (in the SSH terminal)

```bash
# Create a directory for Penpot
mkdir -p ~/penpot
cd ~/penpot

# Download docker-compose.yaml
curl -o docker-compose.yaml https://raw.githubusercontent.com/penpot/penpot/main/docker/images/docker-compose.yaml
```

### Step 9: Configure Penpot for Public Access (in the SSH terminal)

You need to edit the `docker-compose.yaml` to set the public URL.

**Get your VM's external IP address:**
1. Go to **Compute Engine** → **VM instances** in another browser tab
2. Find the **External IP** column for `penpot-server`
3. Copy that IP address (e.g., `34.123.45.67`)

**Edit the docker-compose.yaml file:**
```bash
nano docker-compose.yaml
```

Find the `PENPOT_PUBLIC_URI` environment variable and change it:
```yaml
environment:
  - PENPOT_PUBLIC_URI=http://YOUR_VM_EXTERNAL_IP:9001
```

Replace `YOUR_VM_EXTERNAL_IP` with the IP address from the previous command.

**Example:**
```yaml
environment:
  - PENPOT_PUBLIC_URI=http://34.123.45.67:9001
```

Save and exit (Ctrl+X, then Y, then Enter)

### Step 10: Launch Penpot (in the SSH terminal)

```bash
# Start Penpot
docker compose -p penpot -f docker-compose.yaml up -d

# Check if containers are running
docker ps

# View logs
docker compose -p penpot -f docker-compose.yaml logs -f
```

### Step 11: Access Penpot

**On your local computer**, open your browser and go to:
```
http://YOUR_VM_EXTERNAL_IP:9001
```

🎉 **Penpot should now be running!**

> **Note:** You can now close the SSH terminal window. Penpot will continue running on the VM.

---

## Part 4: Useful Commands

### Managing Penpot

> **All commands below must be run in the SSH terminal on the VM**
> 
> To access the SSH terminal: Go to **Compute Engine** → **VM instances** → Click **SSH** button next to `penpot-server`

```bash
# Go to penpot directory
cd ~/penpot

# Stop Penpot
docker compose -p penpot -f docker-compose.yaml down

# Start Penpot
docker compose -p penpot -f docker-compose.yaml up -d

# Restart Penpot
docker compose -p penpot -f docker-compose.yaml restart

# Update Penpot
docker compose -f docker-compose.yaml pull
docker compose -p penpot -f docker-compose.yaml up -d

# View logs
docker compose -p penpot -f docker-compose.yaml logs -f

# Check container status
docker ps
```

### Managing VM (Web Console)

> **All actions below are done in the Google Cloud Console website on your local computer**
> 
> Go to: https://console.cloud.google.com

**Stop VM (saves money when not using):**
1. Go to **Compute Engine** → **VM instances**
2. Check the box next to `penpot-server`
3. Click **STOP** at the top
4. Confirm

**Start VM:**
1. Go to **Compute Engine** → **VM instances**
2. Check the box next to `penpot-server`
3. Click **START/RESUME** at the top

**Get VM external IP:**
1. Go to **Compute Engine** → **VM instances**
2. Look at the **External IP** column

**Delete VM (WARNING: This deletes everything!):**
1. Go to **Compute Engine** → **VM instances**
2. Check the box next to `penpot-server`
3. Click **DELETE** at the top
4. Confirm deletion

---

## Part 5: Optional - Setup Custom Domain

### Step 12: Configure Domain (Optional but Recommended)

If you have a domain name (e.g., `penpot.yourdomain.com`):

1. **Reserve a Static IP (Web Console):**
   - Go to **≡ Menu** → **VPC network** → **IP addresses**
   - Click **RESERVE EXTERNAL STATIC ADDRESS**
   - Configure:
     - **Name:** `penpot-ip`
     - **Network Service Tier:** Premium
     - **IP version:** IPv4
     - **Type:** Regional
     - **Region:** `us-central1` (same as your VM)
     - **Attached to:** None (for now)
   - Click **RESERVE**
   - **Copy the IP address** that was created

2. **Attach Static IP to VM:**
   - Go to **Compute Engine** → **VM instances**
   - Click on `penpot-server` to view details
   - Click **EDIT** at the top
   - Scroll down to **Network interfaces**
   - Click the **default** network interface to expand
   - Under **External IPv4 address**, select the `penpot-ip` you just created
   - Click **DONE**
   - Scroll to bottom and click **SAVE**

3. **Configure DNS:**
   - Go to your domain registrar (GoDaddy, Namecheap, etc.)
   - Add an A record pointing to your static IP
   - Example: `penpot.yourdomain.com` → `34.123.45.67`

4. **Update docker-compose.yaml:**
```yaml
environment:
  - PENPOT_PUBLIC_URI=http://penpot.yourdomain.com:9001
```

4. **Restart Penpot:**
```bash
docker compose -p penpot -f docker-compose.yaml down
docker compose -p penpot -f docker-compose.yaml up -d
```

---

## Part 6: Setup HTTPS/SSL (Recommended for Production)

### Step 13: Install and Configure SSL Certificate

**Install Certbot:**
```bash
# SSH into VM (click SSH button in web console)

# Install Certbot
sudo apt-get update
sudo apt-get install -y certbot

# Install Nginx as reverse proxy
sudo apt-get install -y nginx
```

**Configure Nginx:**
```bash
sudo nano /etc/nginx/sites-available/penpot
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name penpot.yourdomain.com;

    location / {
        proxy_pass http://localhost:9001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Enable site and get SSL:**
```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/penpot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Get SSL certificate
sudo certbot --nginx -d penpot.yourdomain.com
```

**Update docker-compose.yaml:**
```yaml
environment:
  - PENPOT_PUBLIC_URI=https://penpot.yourdomain.com
```

**Restart Penpot:**
```bash
cd ~/penpot
docker compose -p penpot -f docker-compose.yaml down
docker compose -p penpot -f docker-compose.yaml up -d
```

Now access Penpot at: `https://penpot.yourdomain.com`

---

## Cost Estimate

**Google Cloud Costs (approximate):**
- **e2-medium** (2 vCPU, 4GB RAM): ~$25/month
- **e2-standard-2** (2 vCPU, 8GB RAM): ~$50/month (recommended)
- **50GB storage:** ~$2/month
- **Static IP:** ~$3/month (if using)
- **Egress (data transfer):** Usually minimal for small teams

**Total:** ~$27-55/month depending on machine type

**Free tier note:** New Google Cloud users get $300 free credits for 90 days!

---

## Troubleshooting

### Can't access Penpot
```bash
# In SSH terminal: Check if containers are running
docker ps

# Check logs
docker compose -p penpot -f docker-compose.yaml logs
```

**In Web Console:**
- Verify firewall rules: **VPC network** → **Firewall** → check `allow-penpot` exists
- Check VM external IP: **Compute Engine** → **VM instances** → look at External IP column
- Make sure VM is running: Status should show green checkmark

### Container won't start
```bash
# Check Docker service
sudo systemctl status docker

# Restart Docker
sudo systemctl restart docker

# Check disk space
df -h

# View detailed logs
docker compose -p penpot -f docker-compose.yaml logs -f penpot-frontend
docker compose -p penpot -f docker-compose.yaml logs -f penpot-backend
```

### Out of memory
- Upgrade to larger machine type (e2-standard-2 or e2-standard-4)
- Add swap space

---

## Next Steps

1. ✅ Create your first Penpot account (first user becomes admin)
2. ✅ Configure email settings (optional)
3. ✅ Set up regular backups of PostgreSQL database
4. ✅ Configure automatic SSL renewal (certbot does this automatically)
5. ✅ Set up monitoring/alerts

## Resources

- Penpot Documentation: https://help.penpot.app
- Google Cloud Console: https://console.cloud.google.com
- Google Cloud Documentation: https://cloud.google.com/docs
