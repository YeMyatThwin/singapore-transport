# Nginx Proxy Manager Setup Guide

## Problem
Your Docker container is running and accessible internally (`localhost:3000`), but not accessible from external connections even with correct port mapping (`0.0.0.0:3000->3000/tcp`) and firewall rules configured.

## Solution
Use Nginx Proxy Manager as a reverse proxy to route external traffic (port 80) to your Docker container.

## Prerequisites
- Docker container running and healthy
- Nginx Proxy Manager installed and running (accessible on port 81)
- Containers on the same Docker network

## Step-by-Step Setup

### 1. Verify Container is Running
```bash
docker ps
```
Look for your container and confirm port mapping shows `0.0.0.0:3000->3000/tcp`

### 2. Test Internal Access
```bash
curl http://localhost:3000
```
Should return your HTML content. If this fails, fix your app first.

### 3. Connect Containers to Same Network
```bash
# List networks
docker network ls

# Connect your app container to Nginx network
docker network connect nginx-proxy-manager_default singapore-transport-app
```

### 4. Configure Nginx Proxy Manager

#### Access Nginx Proxy Manager
- Open browser: `http://YOUR-VM-IP:81`
- Default credentials (if first time):
  - Email: `admin@example.com`
  - Password: `changeme`

#### Create Proxy Host
1. Go to **Hosts** → **Proxy Hosts**
2. Click **Add Proxy Host**
3. Configure **Details** tab:
   - **Domain Names**: `YOUR-VM-IP` (or your domain)
   - **Scheme**: `http`
   - **Forward Hostname / IP**: `singapore-transport-app` ⚠️ (container name, NOT IP)
   - **Forward Port**: `3000`
   - **Cache Assets**: OFF (optional)
   - **Block Common Exploits**: ON ✓
   - **Websockets Support**: ON ✓
   - **Access List**: Publicly Accessible

4. Click **Save**

### 5. Test External Access
```bash
# From your local machine
curl http://YOUR-VM-IP
```

Or open in browser: `http://YOUR-VM-IP`

## Important Notes

### Why Container Name Instead of IP?
✅ **Correct**: `Forward Hostname: singapore-transport-app`
❌ **Wrong**: `Forward Hostname: 34.143.170.27`

When containers are on the same Docker network, they can communicate using container names. Using the external IP would route traffic outside and back, which doesn't work.

### Network Configuration
Your container must be on the same network as Nginx Proxy Manager:
```bash
# Check container networks
docker inspect singapore-transport-app | grep NetworkMode

# Should show: nginx-proxy-manager_default
```

### Port 80 vs Port 3000
- Port 80: Default HTTP port, accessible externally
- Port 3000: Your app port, now only needs internal access
- Nginx forwards: External:80 → Internal:3000

## Troubleshooting

### "502 Bad Gateway"
- Check container is running: `docker ps`
- Check container logs: `docker logs singapore-transport-app`
- Verify network connection: `docker network inspect nginx-proxy-manager_default`

### "Host not found"
- Confirm you used container name, not IP
- Check spelling: `singapore-transport-app`

### Container Not on Network
```bash
docker network connect nginx-proxy-manager_default singapore-transport-app
```

### Still Can't Access
1. Check firewall allows port 80:
   ```bash
   sudo ufw status
   ```

2. Verify Nginx Proxy Manager is running:
   ```bash
   docker ps | grep nginx-proxy-manager
   ```

3. Check Nginx logs:
   ```bash
   docker logs nginx-proxy-manager
   ```

## Optional: SSL Setup

### Using Let's Encrypt (Free SSL)
1. In Nginx Proxy Manager, edit your proxy host
2. Go to **SSL** tab
3. Select **Request a new SSL Certificate**
4. Enable **Force SSL**
5. Enable **HTTP/2 Support**
6. Enter email address
7. Agree to Let's Encrypt Terms
8. Click **Save**

**Note**: Requires a domain name (doesn't work with IP addresses)

## Docker Compose Reference

If you need to rebuild with network configuration:

```yaml
version: '3.8'

services:
  singapore-transport:
    build: .
    container_name: singapore-transport-app
    ports:
      - "3000:3000"
    environment:
      - GOOGLE_MAPS_API_KEY=${GOOGLE_MAPS_API_KEY}
      - LTA_DATAMALL_API_KEY=${LTA_DATAMALL_API_KEY}
      - PORT=3000
    restart: unless-stopped
    networks:
      - default
      - nginx-proxy-manager_default

networks:
  nginx-proxy-manager_default:
    external: true
```

Then restart:
```bash
docker-compose down
docker-compose up -d
```

## Summary

✅ **What Works**:
- Container on Docker network
- Nginx routes port 80 to container:3000
- External users access on port 80 (standard HTTP)

❌ **What Doesn't Work**:
- Direct access to port 3000 from outside
- Using external IP as forward hostname
- Containers on different networks

## Security Recommendations

1. **Remove Port 3000 Exposure**: Once Nginx is working, you can remove the port mapping:
   ```yaml
   # In docker-compose.yml
   # ports:
   #   - "3000:3000"  # Remove this line
   ```
   
2. **Enable SSL**: Use Let's Encrypt for HTTPS (requires domain)

3. **Set Strong Nginx Password**: Change default admin credentials

4. **Restrict Access**: Use Access Lists in Nginx Proxy Manager for sensitive apps

5. **Keep .env Secure**: Never commit `.env` to git
   ```bash
   # Already in .gitignore and .dockerignore
   .env
   ```
