
#!/bin/bash
# Deployment Script for AWS EC2

echo "Starting Deployment..."

# 1. Pull Latest Code
git pull
if [ $? -ne 0 ]; then
    echo "Git Pull Failed!"
    exit 1
fi
echo "✅ Code Pulled."

# 2. Update Python Dependencies
source venv/bin/activate
pip install -r backend/requirements.txt
echo "✅ Python Dependencies Updated."

# 3. Rebuild Frontend
npm install
npm run build
sudo cp -r dist/* /var/www/html/
echo "✅ Frontend Rebuilt & Copied."

# 4. Restart Services
sudo systemctl restart backend.service
sudo systemctl restart nginx
echo "✅ Services Restarted."

echo "🚀 Deployment Complete!"
