from flask import (
    Flask,
    request,
    # redirect,
    # url_for,
    # render_template,
    # flash,
    jsonify,
)
import os
import logging
import pandas as pd

# Imports for attribute level error detection
from services.attribute_prompt import attribute_prompt
from utils.accuracy_utils import calculate_metrics, inspect_classification
from utils.data_utils import annotate_errors
from utils.output_utils import process_attribute_output

# Imports for dependency detection
from utils.data_utils import create_buckets
from services.dependency_detection import dependency_detection
from utils.output_utils import process_dependency_output

# # from modules import tuple_analyzer
# from backend.modules.AttributeProcessor import attribute_prompt

# # from modules.dependency_detection import
from config import DevelopmentConfig


app = Flask(__name__)
app.config.from_object(DevelopmentConfig)
app.secret_key = "supersecretkey"
# app.config["UPLOAD_FOLDER"] = "uploads"
app.config["ALLOWED_EXTENSIONS"] = {"csv"}

# Set up logging
logging.basicConfig(
    filename="app.log",  # Log file location
    level=logging.DEBUG,  # Log level (use DEBUG for verbose output)
    format="%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]",
)

# Optionally, log to both file and console
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.DEBUG)
formatter = logging.Formatter(
    "%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]"
)
console_handler.setFormatter(formatter)
app.logger.addHandler(console_handler)

# Ensure the upload folder exists
# os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)


def allowed_file(filename):
    return (
        "." in filename
        and filename.rsplit(".", 1)[1].lower() in app.config["ALLOWED_EXTENSIONS"]
    )


@app.route("/")
def hello_world():
    return "<h1>Hello from Flask & Docker</h1>"


@app.route("/upload-dataset", methods=["POST"])
def upload_dataset():
    if "file" not in request.files:
        return jsonify({"error": "No file part in the request"}), 400

    file = request.files["file"]

    if file.filename == "":
        return jsonify({"error": "No selected file"}), 400

    # Get the file extension
    file_ext = os.path.splitext(file.filename)[1].lower()

    # Check file extension for validation
    if file_ext not in [".csv", ".xls", ".xlsx", ".json"]:
        return (
            jsonify(
                {
                    "error": "Unsupported file format. Please upload a CSV, Excel, or JSON file"
                }
            ),
            400,
        )

    try:
        # Convert to DataFrame and then to CSV if necessary
        if file_ext == ".csv":
            df = pd.read_csv(file)  # Directly read CSV
        elif file_ext in [".xls", ".xlsx"]:
            df = pd.read_excel(file)  # Convert Excel to DataFrame
        elif file_ext == ".json":
            df = pd.read_json(file)  # Convert JSON to DataFrame

        # Save as CSV to a specified path, or you could send it back as a response
        csv_file_path = os.path.join("./data", "dataset.csv")
        df.to_csv(csv_file_path, index=False)

        return (
            jsonify(
                {
                    "message": "File successfully uploaded",
                    "path": csv_file_path,
                }
            ),
            200,
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/upload-clean-dataset", methods=["POST"])
def upload_clean_dataset():
    if "file" not in request.files:
        return jsonify({"error": "No file part in the request"}), 400

    file = request.files["file"]

    if file.filename == "":
        return jsonify({"error": "No selected file"}), 400

    # Get the file extension
    file_ext = os.path.splitext(file.filename)[1].lower()

    # Check file extension for validation
    if file_ext not in [".csv", ".xls", ".xlsx", ".json"]:
        return (
            jsonify(
                {
                    "error": "Unsupported file format. Please upload a CSV, Excel, or JSON file"
                }
            ),
            400,
        )

    try:
        # Convert to DataFrame and then to CSV if necessary
        if file_ext == ".csv":
            df = pd.read_csv(file)  # Directly read CSV
        elif file_ext in [".xls", ".xlsx"]:
            df = pd.read_excel(file)  # Convert Excel to DataFrame
        elif file_ext == ".json":
            df = pd.read_json(file)  # Convert JSON to DataFrame

        # Save as CSV to a specified path, or you could send it back as a response
        csv_file_path = os.path.join("./data", "cleaned_dataset.csv")
        df.to_csv(csv_file_path, index=False)

        return (
            jsonify(
                {
                    "message": "File successfully uploaded",
                    "path": csv_file_path,
                }
            ),
            200,
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/detect-attribute-errors", methods=["GET"])
def detect_attribute_errors():
    try:
        dataset = pd.read_csv("./data/dataset.csv")
        attribute_prompt(dataset, "./data/output/attribute")
        process_attribute_output(dataset, "./data/output/attribute")

        return (
            jsonify(
                {
                    "message": "Attribute errors detected!",
                }
            ),
            200,
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/calculate-accuracy", methods=["GET"])
def calculate_accuracy():
    try:
        dataset = pd.read_csv("./data/dataset.csv")
        clean_dataset = pd.read_csv("./data/cleaned_dataset.csv")

        error_annotation = annotate_errors(clean_dataset, dataset)
        output = pd.read_csv("./data/output/attribute/output.csv")

        accuracy, precision, recall, f_score = calculate_metrics(
            error_annotation, output
        )

        # Might move the tp calculation someplace else
        true_positive_df, false_positive_df, false_negative_df = inspect_classification(
            error_annotation, output, dataset
        )

        true_positive_df.to_csv("./data/output/attribute/true_positives.csv")
        false_positive_df.to_csv("./data/output/attribute/false_positives.csv")
        false_negative_df.to_csv("./data/output/attribute/false_negatives.csv")

        return (
            jsonify(
                {
                    "accuracy": accuracy,
                    "precision": precision,
                    "recall": recall,
                    "f_score": f_score,
                }
            ),
            200,
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/detect-dependencies", methods=["GET"])
def detect_dependencies():
    try:
        dataset = pd.read_csv("./data/dataset.csv")

        filtered_top_buckets, buckets = create_buckets(dataset)
        # dependency_detection(dataset, filtered_top_buckets, buckets)
        process_dependency_output(filtered_top_buckets)

        return (
            jsonify(
                {
                    "message": "Dependencies detected!",
                }
            ),
            200,
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True)
