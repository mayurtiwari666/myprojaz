
import boto3
import os
from dotenv import load_dotenv

load_dotenv()

# AWS Config
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)

TABLE_NAME = 'rnd-hub-storage-paths'

def create_table():
    try:
        print(f"Creating table {TABLE_NAME}...")
        table = dynamodb.create_table(
            TableName=TABLE_NAME,
            KeySchema=[
                {'AttributeName': 'path_name', 'KeyType': 'HASH'} # Partition Key
            ],
            AttributeDefinitions=[
                {'AttributeName': 'path_name', 'AttributeType': 'S'}
            ],
            ProvisionedThroughput={
                'ReadCapacityUnits': 5,
                'WriteCapacityUnits': 5
            }
        )
        print("Table creation initiated. Waiting for table to exist...")
        table.meta.client.get_waiter('table_exists').wait(TableName=TABLE_NAME)
        print("Table created successfully!")
    except Exception as e:
        if "ResourceInUseException" in str(e):
            print(f"Table {TABLE_NAME} already exists.")
        else:
            print(f"Error creating table: {e}")

if __name__ == "__main__":
    create_table()
