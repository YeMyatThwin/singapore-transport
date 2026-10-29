# Deploy to Google Cloud VM

## Prerequisites
- Google Cloud VM instance running (Ubuntu/Debian recommended)
- SSH access to your VM

## Deployment Steps

### 1. SSH into your Google Cloud VM
```bash
gcloud compute ssh YOUR-VM-NAME --zone=YOUR-ZONE
```

### 2. Install Docker and Docker Compose (if not installed)
```bash
# Update packages
sudo apt-get update

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt-get install docker-compose-plugin

# Log out and back in for group changes to take effect
exit
# SSH back in
gcloud compute ssh YOUR-VM-NAME --zone=YOUR-ZONE
```

### 3. Clone your repository
```bash
git clone https://github.com/YeMyatThwin/singapore-transport.git
cd singapore-transport
```

### 4. Create .env file with your API keys
```bash
nano .env
```

Paste your keys:
```
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
LTA_DATAMALL_API_KEY=your_lta_datamall_api_key_here
PORT=3000
```

Save and exit (Ctrl+X, then Y, then Enter)

### 5. Build and run Docker container
```bash
docker compose up -d
```

### 6. Check if it's running
```bash
docker compose ps
docker compose logs -f
```

### 7. Configure firewall to allow HTTP traffic
```bash
# In Google Cloud Console, add firewall rule:
# - Target: All instances (or specific tags)
# - Source IP ranges: 0.0.0.0/0
# - Protocols and ports: tcp:3000

# Or use gcloud command:
gcloud compute firewall-rules create allow-singapore-transport \
    --allow tcp:3000 \
    --source-ranges 0.0.0.0/0 \
    --description "Allow access to Singapore Transport app"
```

### 8. Access your app
```
http://YOUR-VM-EXTERNAL-IP:3000
```

Find your external IP:
```bash
gcloud compute instances list
```

## Useful Commands

### View logs
```bash
docker compose logs -f
```

### Restart container
```bash
docker compose restart
```

### Stop container
```bash
docker compose down
```

### Update after code changes
```bash
git pull
docker compose down
docker compose up -d --build
```

## Optional: Set up Nginx reverse proxy (for port 80/443)

### Install Nginx
```bash
sudo apt-get install nginx
```

### Configure Nginx
```bash
sudo nano /etc/nginx/sites-available/singapore-transport
```

Paste this configuration:
```nginx
server {
    listen 80;
    server_name YOUR-DOMAIN-OR-IP;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Enable and restart Nginx
```bash
sudo ln -s /etc/nginx/sites-available/singapore-transport /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

Now accessible at: `http://YOUR-VM-EXTERNAL-IP`
