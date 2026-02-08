FROM public.ecr.aws/lambda/python:3.11

# Install ClamAV
RUN yum update -y && \
    yum install -y clamav clamav-lib clamav-update && \
    yum clean all

# Copy the definition files (freshclam)
# We run freshclam once during build to seed the DB
# In production, you might want to update this regularly or mount EFS.
# For this MVP, baked-in definitions are fine.
RUN freshclam

# Install dependencies
COPY requirements.txt .
RUN pip install -r requirements.txt

# Copy function code
COPY lambda_function.py ${LAMBDA_TASK_ROOT}

# Set the CMD to your handler
CMD [ "lambda_function.lambda_handler" ]
