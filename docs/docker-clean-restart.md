# Docker Clean and Restart Guide

This guide shows how to completely clean and restart Docker on your Linux VM via SSH on Google Cloud Console.

## Prerequisites
- SSH access to your VM (click **SSH** button in Google Cloud Console → **Compute Engine** → **VM instances**)

---

## Complete Docker Clean (Removes Everything)

**Step-by-step commands:**

```bash
# Stop all running containers
docker stop $(docker ps -aq)

# Remove all containers
docker rm $(docker ps -aq)

# Remove all images
docker rmi $(docker images -q)

# Remove all volumes (WARNING: deletes all data!)
docker volume rm $(docker volume ls -q)

# Remove all networks (except defaults)
docker network prune -f

# Clean everything else
docker system prune -a --volumes -f
```

---

## Quick One-Line Clean

**Single command to stop and clean everything:**

```bash
docker stop $(docker ps -aq) 2>/dev/null; docker system prune -a --volumes -f
```

---

## Restart Penpot After Cleaning

**After cleaning Docker, restart Penpot:**

```bash
cd ~/penpot
docker compose -p penpot -f docker-compose.yaml up -d
```

**Check if containers are running:**

```bash
docker ps
```

**View logs:**

```bash
docker compose -p penpot -f docker-compose.yaml logs -f
```

---

## Clean Restart Penpot Only (Without Full Docker Clean)

If you only want to restart Penpot with a fresh database (without deleting all Docker images):

```bash
# Stop Penpot and remove volumes
cd ~/penpot
docker compose -p penpot -f docker-compose.yaml down -v

# Pull latest images (optional)
docker compose -p penpot -f docker-compose.yaml pull

# Start Penpot fresh
docker compose -p penpot -f docker-compose.yaml up -d
```

> **Note:** The `-v` flag removes volumes, giving you a completely fresh database.

---

## Partial Clean Options

### Remove stopped containers only
```bash
docker container prune -f
```

### Remove unused images only
```bash
docker image prune -a -f
```

### Remove unused volumes only
```bash
docker volume prune -f
```

### Remove unused networks only
```bash
docker network prune -f
```

---

## Verify Clean State

**Check what's left:**

```bash
# List all containers (should be empty after full clean)
docker ps -a

# List all images (should be empty after full clean)
docker images

# List all volumes (should be empty after full clean)
docker volume ls

# Check disk usage
docker system df
```

---

## Common Scenarios

### Scenario 1: Penpot isn't working, need fresh start
```bash
cd ~/penpot
docker compose -p penpot -f docker-compose.yaml down -v
docker compose -p penpot -f docker-compose.yaml up -d
```

### Scenario 2: VM running out of disk space
```bash
# Clean unused Docker resources
docker system prune -a --volumes -f

# Check disk usage
df -h
docker system df
```

### Scenario 3: Complete reset - delete everything and start over
```bash
# Stop and remove all Docker resources
docker stop $(docker ps -aq) 2>/dev/null
docker system prune -a --volumes -f

# Restart Penpot from scratch
cd ~/penpot
docker compose -p penpot -f docker-compose.yaml up -d
```

### Scenario 4: Update Penpot to latest version
```bash
cd ~/penpot
docker compose -p penpot -f docker-compose.yaml down
docker compose -p penpot -f docker-compose.yaml pull
docker compose -p penpot -f docker-compose.yaml up -d
```

---

## Important Warnings

⚠️ **Data Loss Warning:**
- Using `-v` or `docker volume rm` will **permanently delete all data** including:
  - Penpot database (all projects, users, files)
  - PostgreSQL data
  - Any uploaded assets
- Make sure to backup important data before running these commands!

⚠️ **System-wide Impact:**
- These commands affect **all Docker containers and images** on the VM, not just Penpot
- If you're running other applications in Docker, they will also be affected

---

## Troubleshooting

### Command shows "No stopped containers" or similar
This is normal - it just means there's nothing to clean in that category.

### Permission denied errors
Add `sudo` before the command:
```bash
sudo docker system prune -a --volumes -f
```

### Can't delete running container
Stop it first:
```bash
docker stop CONTAINER_ID
docker rm CONTAINER_ID
```

### Docker daemon not running
```bash
sudo systemctl start docker
sudo systemctl enable docker
```

---

## Disk Space Check

**Before cleaning:**
```bash
# Check system disk usage
df -h

# Check Docker disk usage
docker system df
```

**After cleaning:**
```bash
# Verify space was freed
df -h
docker system df
```

---

## Resources

- Docker Cleanup Documentation: https://docs.docker.com/config/pruning/
- Docker System Commands: https://docs.docker.com/engine/reference/commandline/system/
- Main Deployment Guide: See [penpot-google-cloud-deployment.md](penpot-google-cloud-deployment.md)
