
#!/bin/bash

# Setup Swap (Run as sudo on EC2)
echo "Setting up 4GB Swap Space..."

# Check if swap exists
if grep -q "swapfile" /proc/swaps; then
    echo "Swap ALREADY EXISTS!"
    exit 0
fi

# Allocate 4GB
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Persist
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

echo "Swap Setup Complete (4GB)!"
free -h
