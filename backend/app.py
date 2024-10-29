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
import io
import logging
import pandas as pd
from datetime import datetime

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

    dataset_name = request.form.get("dataset_name", None)
    if not dataset_name:
        return jsonify({"error": "Dataset name is required"}), 400

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
        # Convert to DataFrame based on file extension
        if file_ext == ".csv":
            df = pd.read_csv(file)
        elif file_ext in [".xls", ".xlsx"]:
            df = pd.read_excel(file)
        elif file_ext == ".json":
            df = pd.read_json(file)

        # Create a directory for the dataset if it doesn't exist
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        dataset_dir = os.path.join("./data", f"{dataset_name}_{timestamp}")
        os.makedirs(dataset_dir, exist_ok=True)

        # Create a timestamped file path
        csv_file_path = os.path.join(dataset_dir, "dirty.csv")

        # Save the file
        df.to_csv(csv_file_path, index=False)

        return (
            jsonify(
                {
                    "message": "File successfully uploaded",
                    "path": csv_file_path,
                    "timestamp": timestamp,
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


from flask import Flask, jsonify, request
import pandas as pd
import os
import io

app = Flask(__name__)


@app.route("/detect-attribute-errors", methods=["POST"])
def detect_attribute_errors():
    try:
        # Get the dataset name and timestamp from the query parameters
        dataset_name = request.form.get("dataset_name", None)
        timestamp = request.form.get("timestamp", None)

        # Validate that both parameters are provided
        if not dataset_name or not timestamp:
            return (
                jsonify(
                    {
                        "error": "Both 'dataset_name' and 'timestamp' parameters are required"
                    }
                ),
                400,
            )

        # Construct the file path using the dataset name and timestamp
        dataset_folder = f"{dataset_name}_{timestamp}"
        csv_file_path = os.path.join("./data", dataset_folder, "dirty.csv")

        # Load the dataset
        dataset = pd.read_csv(csv_file_path)

        # Process the dataset (these functions should be defined elsewhere in your code)
        attribute_prompt(dataset, f"./data/{dataset_name}_{timestamp}/attribute")
        process_attribute_output(
            dataset, f"./data/{dataset_name}_{timestamp}/attribute"
        )

        # Load the output
        annotated_output = pd.read_csv(f"./data/{dataset_folder}/attribute/output.csv")
        prompt_metadata = pd.read_csv(
            f"./data/{dataset_folder}/attribute/prompt_metadata.csv"
        )
        # Convert the output to JSON format
        annotated_output_json = annotated_output.to_dict(orient="records")
        prompt_metadata_json = prompt_metadata.to_dict(orient="records")

        return (
            jsonify(
                {
                    "message": "Attribute errors detected!",
                    "annotated_output": annotated_output_json,  # Include annotated output in the response
                    "prompt_metadata": prompt_metadata_json,
                }
            ),
            200,
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run()


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


@app.route("/detect-dependencies", methods=["POST"])
def detect_dependencies():
    try:

        dataset_name = request.form.get("dataset_name", None)
        timestamp = request.form.get("timestamp", None)

        # Validate that both parameters are provided
        if not dataset_name or not timestamp:
            return (
                jsonify(
                    {"error": "Both 'name' and 'timestamp' parameters are required"}
                ),
                400,
            )

        # Construct the file path using the dataset name and timestamp
        dataset_folder = f"{dataset_name}_{timestamp}"
        csv_file_path = os.path.join("./data", dataset_folder, "dirty.csv")
        directory = f"./data/{dataset_name}_{timestamp}/dependency"

        # Load the dataset
        dataset = pd.read_csv(csv_file_path)

        filtered_top_buckets, buckets = create_buckets(dataset)
        # dependency_detection(dataset, filtered_top_buckets, buckets, directory)
        process_dependency_output(filtered_top_buckets, directory)

        # Load the output
        dependecy_output = pd.read_csv(f"./data/{dataset_folder}/dependency/output.csv")
        prompt_metadata = pd.read_csv(
            f"./data/{dataset_folder}/dependency/prompt_metadata.csv"
        )
        # Convert the output to JSON format
        dependecy_output_json = dependecy_output.to_dict(orient="records")
        prompt_metadata_json = prompt_metadata.to_dict(orient="records")

        return (
            jsonify(
                {
                    "message": "Dependencies detected!",
                    "dependencies": dependecy_output_json,
                    "prompt_metadata": prompt_metadata_json,
                }
            ),
            200,
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500


from services.dependency_violations import detect_dep_violations
from utils.output_utils import process_dep_violations_output


@app.route("/detect-dependency-violations", methods=["POST"])
def detect_dependency_violations():
    try:

        dataset_name = request.form.get("dataset_name", None)
        timestamp = request.form.get("timestamp", None)

        # Validate that both parameters are provided
        if not dataset_name or not timestamp:
            return (
                jsonify(
                    {"error": "Both 'name' and 'timestamp' parameters are required"}
                ),
                400,
            )

        # Construct the file path using the dataset name and timestamp
        dataset_folder = f"{dataset_name}_{timestamp}"
        csv_file_path = os.path.join("./data", dataset_folder, "dirty.csv")
        directory = f"./data/{dataset_name}_{timestamp}/dependency_violations"

        dataset = pd.read_csv(csv_file_path)

        depedencies = pd.read_csv(f"./data/{dataset_folder}/dependency/output.csv")
        # detect_dep_violations(depedencies, dataset, directory)
        process_dep_violations_output(dataset, directory)

        # Load the output
        dep_violation_output = pd.read_csv(
            f"./data/{dataset_folder}/dependency_violations/output.csv"
        )
        prompt_metadata = pd.read_csv(
            f"./data/{dataset_folder}/dependency_violations/prompt_metadata.csv"
        )
        # Convert the output to JSON format
        dependecy_output_json = dep_violation_output.to_dict(orient="records")
        prompt_metadata_json = prompt_metadata.to_dict(orient="records")

        return (
            jsonify(
                {
                    "message": "Dependency violations detected!",
                    "annotated_output": dependecy_output_json,
                    "prompt_metadata": prompt_metadata_json,
                }
            ),
            200,
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/calculate-dependency-accuracy", methods=["GET"])
def calculate_dependency_accuracy():
    try:
        dataset = pd.read_csv("./data/dataset.csv")
        clean_dataset = pd.read_csv("./data/cleaned_dataset.csv")

        error_annotation = annotate_errors(clean_dataset, dataset)
        output = pd.read_csv("./data/output/dependency_violations/output.csv")

        accuracy, precision, recall, f_score = calculate_metrics(
            error_annotation, output
        )

        # Might move the tp calculation someplace else
        true_positive_df, false_positive_df, false_negative_df = inspect_classification(
            error_annotation, output, dataset
        )

        true_positive_df.to_csv(
            "./data/output/dependency_violations/true_positives.csv"
        )
        false_positive_df.to_csv(
            "./data/output/dependency_violations/false_positives.csv"
        )
        false_negative_df.to_csv(
            "./data/output/dependency_violations/false_negatives.csv"
        )

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


from utils.output_utils import process_combined_output


@app.route("/calculate-overall-accuracy", methods=["GET"])
def calculate_overall_accuracy():
    try:
        dataset = pd.read_csv("./data/dataset.csv")
        clean_dataset = pd.read_csv("./data/cleaned_dataset.csv")

        error_annotation = annotate_errors(clean_dataset, dataset)

        # output = pd.read_csv("./data/output/dependency_violations/output.csv")
        attribute_output = pd.read_csv("./data/output/attribute/output.csv")
        dependency_output = pd.read_csv(
            "./data/output/dependency_violations/output.csv"
        )
        process_combined_output(attribute_output, dependency_output)

        combined_output = pd.read_csv(
            "./data/output/consolidated_error_annotations.csv"
        )

        accuracy, precision, recall, f_score = calculate_metrics(
            error_annotation, combined_output
        )

        # Might move the tp calculation someplace else
        true_positive_df, false_positive_df, false_negative_df = inspect_classification(
            error_annotation, combined_output, dataset
        )

        true_positive_df.to_csv("./data/output/true_positives.csv")
        false_positive_df.to_csv("./data/output/false_positives.csv")
        false_negative_df.to_csv("./data/output/false_negatives.csv")

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


if __name__ == "__main__":
    app.run(debug=True)
