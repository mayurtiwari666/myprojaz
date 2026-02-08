#!/bin/bash
set -e

# Configuration
REGION="us-east-1"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REPO_NAME="rnd-hub-av"
FUNCTION_NAME="rnd-hub-antivirus"
IMAGE_TAG="latest"
ECR_URI="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${REPO_NAME}:${IMAGE_TAG}"

echo "--- Deploying Antivirus Lambda ($REGION) ---"
echo "Account: $ACCOUNT_ID"

# 1. Create ECR Repo (if not exists)
echo "1. Checking ECR Repository..."
aws ecr describe-repositories --repository-names ${REPO_NAME} --region ${REGION} > /dev/null 2>&1 || \
    aws ecr create-repository --repository-name ${REPO_NAME} --region ${REGION}

# 2. Login to ECR
echo "2. Logging into ECR..."
aws ecr get-login-password --region ${REGION} | docker login --username AWS --password-stdin ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com

# 3. Build Docker Image
echo "3. Building Docker Image (This takes time...)"
# Use linux/amd64 and --provenance=false to produce a standard Docker V2 image for Lambda
docker build --platform linux/amd64 --provenance=false -t ${REPO_NAME} ./lambda/antivirus

# 4. Tag and Push
echo "4. Pushing to ECR..."
docker tag ${REPO_NAME}:latest ${ECR_URI}
docker push ${ECR_URI}

# 5. Create/Update Lambda
echo "5. Updating Lambda Function..."

# Check if function exists
if aws lambda get-function --function-name ${FUNCTION_NAME} --region ${REGION} > /dev/null 2>&1; then
    echo "   Function exists. Updating Code..."
    aws lambda update-function-code --function-name ${FUNCTION_NAME} --image-uri ${ECR_URI} --region ${REGION} > /dev/null
else
    echo "   Function does not exist. Creating..."
    # We need a Role ARN. Typically you'd create one.
    # For simplicity, we ask the user for it or try to find an existing one.
    # Let's try to find an existing Execution Role or ask user to create one manualy first?
    # Better: Use the 'LabRole' if this is a learner lab, or recreate logic.
    # Actually, let's just fail nicely and ask user if role is missing.
    ROLE_ARN=$(aws iam list-roles --query "Roles[?contains(RoleName, 'Lambda')].Arn" --output text | head -n 1)
    
    if [ -z "$ROLE_ARN" ]; then
        echo "❌ Error: Could not find an IAM Role for Lambda. Please create one with S3 Access."
        exit 1
    fi
    
    echo "   Using Role: $ROLE_ARN"
    aws lambda create-function \
        --function-name ${FUNCTION_NAME} \
        --package-type Image \
        --code ImageUri=${ECR_URI} \
        --role ${ROLE_ARN} \
        --timeout 300 \
        --memory-size 2048 \
        --region ${REGION}
fi

echo "✅ Deployment Complete!"
echo "👉 Go to AWS Console -> Lambda -> $FUNCTION_NAME -> Configuration -> Triggers"
echo "👉 Add S3 Trigger for bucket: rnd-hub-files-0202"
