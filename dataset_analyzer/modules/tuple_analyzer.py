import pandas as pd


def analyze_dataset(file_path):
    # Read the dataset
    df = pd.read_csv(file_path)
    # Perform simple analysis (you can expand this)
    summary = df.describe().to_html()
    return summary
