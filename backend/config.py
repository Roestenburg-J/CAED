# config.py
import os


class Config:
    BASE_DIR = os.path.abspath(os.path.dirname(__file__))
    OUTPUT_DIRECTORY = os.path.join(BASE_DIR, "output")
    ATTRIBUTE_OUTPUT_DIR = os.path.join(OUTPUT_DIRECTORY, "attribute")


class DevelopmentConfig(Config):
    DEBUG = True


class ProductionConfig(Config):
    DEBUG = False
