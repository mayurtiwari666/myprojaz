import boto3
from backend.config import settings

def create_activity_table():
    dynamodb = boto3.client('dynamodb', region_name=settings.AWS_REGION)
    table_name = "rnd-hub-activity"
    
    try:
        dynamodb.create_table(
            TableName=table_name,
            KeySchema=[
                {'AttributeName': 'event_id', 'KeyType': 'HASH'},  # Partition Key
                {'AttributeName': 'timestamp', 'KeyType': 'RANGE'} # Sort Key
            ],
            AttributeDefinitions=[
                {'AttributeName': 'event_id', 'AttributeType': 'S'},
                {'AttributeName': 'timestamp', 'AttributeType': 'S'}
            ],
            ProvisionedThroughput={
                'ReadCapacityUnits': 5,
                'WriteCapacityUnits': 5
            }
        )
        print(f"Table {table_name} creating...")
        waiter = dynamodb.get_waiter('table_exists')
        waiter.wait(TableName=table_name)
        print(f"Table {table_name} created successfully.")
    except dynamodb.exceptions.ResourceInUseException:
        print(f"Table {table_name} already exists.")
    except Exception as e:
        print(f"Error creating table: {e}")

if __name__ == "__main__":
    create_activity_table()
