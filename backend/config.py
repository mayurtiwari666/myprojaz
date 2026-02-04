from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    AWS_REGION: str = "us-east-1"
    S3_BUCKET_NAME: str = "rnd-hub-files-0202"
    DYNAMODB_TABLE: str = "rnd-hub-metadata"
    COGNITO_USER_POOL_ID: str = "us-east-1_VT82bTVEX"
    COGNITO_CLIENT_ID: str = "2mhovll3csgcqmg8uj6le5ffhd"

    # Secondary Account for Textract OCR
    AWS_TEXTRACT_ACCESS_KEY_ID: str = ""
    AWS_TEXTRACT_SECRET_ACCESS_KEY: str = ""
    AWS_TEXTRACT_REGION: str = "us-west-2"

    class Config:
        env_file = ".env"

settings = Settings()
