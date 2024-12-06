from flask import (
    Flask,
    request,
    # redirect,
    # url_for,
    # render_template,
    # flash,
    jsonify,
)
from flask_cors import CORS
import os
import io
import logging
import pandas as pd
import json
from datetime import datetime

# Imports for attribute level error detection
from services.attribute_prompt import attribute_prompt
from utils.accuracy_utils import calculate_metrics, inspect_classification
from utils.data_utils import annotate_errors
from utils.output_utils import process_attribute_output, process_combined_output

from services.dependency_violations import detect_dep_violations
from utils.output_utils import process_dep_violations_output


# Imports for dependency detection
from utils.data_utils import create_buckets
from services.dependency_detection import dependency_detection
from utils.output_utils import process_dependency_output

# Settings utils
from utils.prompting_utils import load_settings as load_detailed_settings

# # from modules import tuple_analyzer
# from backend.modules.AttributeProcessor import attribute_prompt

# # from modules.dependency_detection import
from config import DevelopmentConfig


app = Flask(__name__)
frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
CORS(app, resources={r"/*": {"origins": ["http://localhost:3000", frontend_url]}})
app.config.from_object(DevelopmentConfig)
app.secret_key = "supersecretkey"
# app.config["UPLOAD_FOLDER"] = "uploads"
app.config["ALLOWED_EXTENSIONS"] = {"csv"}
SETTINGS_FILE = "./user_settings/settings.json"

# Set up logging
logging.basicConfig(
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

        settings = load_detailed_settings()
        gpt_model = settings["gpt_model"]

        model_file_path = os.path.join(dataset_dir, "gpt_model.txt")
        with open(model_file_path, "w") as model_file:
            model_file.write(gpt_model)

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
                    "dataset_name": dataset_name,
                }
            ),
            200,
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500


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
        column_summary = pd.read_csv(
            f"./data/{dataset_folder}/attribute/column_summary.csv"
        )

        # Convert the output to JSON format
        annotated_output_json = annotated_output.to_dict(orient="records")
        prompt_metadata_json = prompt_metadata.to_dict(orient="records")
        column_summary_json = column_summary.to_dict(orient="records")

        # Extract the dataset schema (column names and indices)
        schema = [
            {"index": idx, "name": col} for idx, col in enumerate(dataset.columns)
        ]

        return (
            jsonify(
                {
                    "message": "Attribute errors detected!",
                    "annotated_output": annotated_output_json,  # Include annotated output in the response
                    "prompt_metadata": prompt_metadata_json,
                    "column_summary": column_summary_json,
                    "dataset_schema": schema,  # Include schema in the response
                    "dataset_size": dataset.shape[0],
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
        dependency_detection(dataset, filtered_top_buckets, buckets, directory)
        process_dependency_output(filtered_top_buckets, dataset, directory)

        # Load the output
        dependecy_output = pd.read_csv(f"./data/{dataset_folder}/dependency/output.csv")
        prompt_metadata = pd.read_csv(
            f"./data/{dataset_folder}/dependency/prompt_metadata.csv"
        )
        # Convert the output to JSON format
        dependecy_output_json = dependecy_output.to_dict(orient="records")
        prompt_metadata_json = prompt_metadata.to_dict(orient="records")

        schema = [
            {"index": idx, "name": col} for idx, col in enumerate(dataset.columns)
        ]

        return (
            jsonify(
                {
                    "message": "Dependencies detected!",
                    "dependencies": dependecy_output_json,
                    "prompt_metadata": prompt_metadata_json,
                    "dataset_schema": schema,  # Include schema in the response
                }
            ),
            200,
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500


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
        detect_dep_violations(depedencies, dataset, directory)
        process_dep_violations_output(dataset, directory)

        # Load the output
        dep_violation_output = pd.read_csv(
            f"./data/{dataset_folder}/dependency_violations/output.csv"
        )
        prompt_metadata = pd.read_csv(
            f"./data/{dataset_folder}/dependency_violations/prompt_metadata.csv"
        )
        column_summary = pd.read_csv(
            f"./data/{dataset_folder}/dependency_violations/column_summary.csv"
        )
        # Convert the output to JSON format
        dependecy_output_json = dep_violation_output.to_dict(orient="records")
        prompt_metadata_json = prompt_metadata.to_dict(orient="records")
        column_summary_json = column_summary.to_dict(orient="records")

        schema = [
            {"index": idx, "name": col} for idx, col in enumerate(dataset.columns)
        ]

        return (
            jsonify(
                {
                    "message": "Dependency violations detected!",
                    "annotated_output": dependecy_output_json,
                    "prompt_metadata": prompt_metadata_json,
                    "column_summary": column_summary_json,
                    "dataset_schema": schema,  # Include schema in the response
                    "dataset_size": dataset.shape[0],
                }
            ),
            200,
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/detect-combined-errors", methods=["POST"])
def detect_combined_errors():
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

        dataset_folder = f"{dataset_name}_{timestamp}"
        csv_file_path = os.path.join("./data", dataset_folder, "dirty.csv")
        directory = f"./data/{dataset_name}_{timestamp}"
        dataset = pd.read_csv(csv_file_path)

        attribute_output = pd.read_csv(f"./data/{dataset_folder}/attribute/output.csv")
        dependency_output = pd.read_csv(
            f"./data/{dataset_folder}/dependency_violations/output.csv"
        )

        process_combined_output(attribute_output, dependency_output, dataset_folder)

        combined_output = pd.read_csv(
            f"./data/{dataset_folder}/consolidated_error_annotations.csv"
        )

        combined_output_json = combined_output.to_dict(orient="records")

        schema = [
            {"index": idx, "name": col} for idx, col in enumerate(dataset.columns)
        ]

        return (
            jsonify(
                {
                    "message": "Combined errors detected!",
                    "annotated_output": combined_output_json,
                    "dataset_schema": schema,  # Include schema in the response
                }
            ),
            200,
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/upload-evaluation-datasets", methods=["POST"])
def upload_evaluation_dataset():
    dataset_name = request.form.get("dataset_name", None)
    if not dataset_name:
        return jsonify({"error": "Dataset name is required"}), 400

    if "dirty_file" not in request.files:
        return jsonify({"error": "No dirty_file part in the request"}), 400

    if "clean_file" not in request.files:
        return jsonify({"error": "No clean_file part in the request"}), 400

    dirty_file = request.files["dirty_file"]
    clean_file = request.files["clean_file"]

    if dirty_file.filename == "":
        return jsonify({"error": "No selected dirty file"}), 400

    if clean_file.filename == "":
        return jsonify({"error": "No selected clean file"}), 400

    # Get the file extension
    dirty_file_ext = os.path.splitext(dirty_file.filename)[1].lower()
    clean_file_ext = os.path.splitext(clean_file.filename)[
        1
    ].lower()  # Note: fixed to use clean_file here

    # Check file extension for validation
    if dirty_file_ext not in [
        ".csv",
        ".xls",
        ".xlsx",
        ".json",
    ] or clean_file_ext not in [".csv", ".xls", ".xlsx", ".json"]:
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
        if dirty_file_ext == ".csv":
            df_dirty = pd.read_csv(dirty_file)
        elif dirty_file_ext in [".xls", ".xlsx"]:
            df_dirty = pd.read_excel(dirty_file)
        elif dirty_file_ext == ".json":
            df_dirty = pd.read_json(dirty_file)

        if clean_file_ext == ".csv":
            df_clean = pd.read_csv(clean_file)
        elif clean_file_ext in [".xls", ".xlsx"]:
            df_clean = pd.read_excel(clean_file)
        elif clean_file_ext == ".json":
            df_clean = pd.read_json(clean_file)

        if df_clean.shape != df_dirty.shape or not all(
            df_clean.columns == df_dirty.columns
        ):
            return (
                jsonify(
                    {"error": "Uploaded files have different shapes or column names."}
                ),
                400,
            )

        # Create a directory for the dataset if it doesn't exist
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        dataset_dir = os.path.join("./data", f"{dataset_name}_{timestamp}")
        os.makedirs(dataset_dir, exist_ok=True)

        settings = load_detailed_settings()
        gpt_model = settings["gpt_model"]

        model_file_path = os.path.join(dataset_dir, "gpt_model.txt")
        with open(model_file_path, "w") as model_file:
            model_file.write(gpt_model)

        # Save the file
        csv_dirty_file_path = os.path.join(dataset_dir, "dirty.csv")
        csv_clean_file_path = os.path.join(dataset_dir, "clean.csv")
        df_dirty.to_csv(csv_dirty_file_path, index=False)
        df_clean.to_csv(csv_clean_file_path, index=False)

        return (
            jsonify(
                {
                    "message": "Files successfully uploaded",
                    "timestamp": timestamp,
                    "dataset_name": dataset_name,
                }
            ),
            200,
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/evaluate-attribute-errors", methods=["POST"])
def evaluate_attribute_errors():
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
        csv_dirty_file_path = os.path.join("./data", dataset_folder, "dirty.csv")
        csv_clean_file_path = os.path.join("./data", dataset_folder, "clean.csv")

        # Load the dataset
        dataset_dirty = pd.read_csv(csv_dirty_file_path)
        dataset_clean = pd.read_csv(csv_clean_file_path)

        # Process the dataset (these functions should be defined elsewhere in your code)
        # attribute_prompt(dataset_dirty, f"./data/{dataset_name}_{timestamp}/attribute")
        process_attribute_output(
            dataset_dirty, f"./data/{dataset_name}_{timestamp}/attribute"
        )

        # Load the output
        annotated_output = pd.read_csv(f"./data/{dataset_folder}/attribute/output.csv")
        # app.logger.info(annotated_output)
        prompt_metadata = pd.read_csv(
            f"./data/{dataset_folder}/attribute/prompt_metadata.csv"
        )
        column_summary = pd.read_csv(
            f"./data/{dataset_folder}/attribute/column_summary.csv"
        )

        # Calculate error annotation
        error_annotation = annotate_errors(dataset_clean, dataset_dirty)

        # Calculate accuracy metrics
        metrics = calculate_metrics(error_annotation, annotated_output)

        # Calculate True Positives, False Positives, False Negatives
        true_positive_df, false_positive_df, false_negative_df = inspect_classification(
            error_annotation, annotated_output, dataset_dirty
        )

        # Save TP, FP, FN
        true_positive_df.to_csv(f"./data/{dataset_folder}/attribute/true_positives.csv")
        false_positive_df.to_csv(
            f"./data/{dataset_folder}/attribute/false_positives.csv"
        )
        false_negative_df.to_csv(
            f"./data/{dataset_folder}/attribute/false_negatives.csv"
        )

        # Convert the output to JSON format
        annotated_output_json = annotated_output.to_dict(orient="records")
        prompt_metadata_json = prompt_metadata.to_dict(orient="records")
        column_summary_json = column_summary.to_dict(orient="records")
        true_positive_json = true_positive_df.to_dict(orient="records")
        false_positive_json = false_positive_df.to_dict(orient="records")
        false_negative_json = false_negative_df.to_dict(orient="records")

        # Extract the dataset schema (column names and indices)
        schema = [
            {"index": idx, "name": col} for idx, col in enumerate(dataset_dirty.columns)
        ]

        return (
            jsonify(
                {
                    "message": "Attribute errors detected!",
                    "annotated_output": annotated_output_json,  # Include annotated output in the response
                    "prompt_metadata": prompt_metadata_json,
                    "column_summary": column_summary_json,
                    "dataset_schema": schema,  # Include schema in the response
                    "dataset_size": dataset_dirty.shape[0],
                    "true_positives": true_positive_json,
                    "false_positives": false_positive_json,
                    "false_negatives": false_negative_json,
                    "metrics": metrics,
                }
            ),
            200,
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/evaluate-dependency-violation-errors", methods=["POST"])
def evaluate_dependecy_violation_errors():
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
        csv_dirty_file_path = os.path.join("./data", dataset_folder, "dirty.csv")
        csv_clean_file_path = os.path.join("./data", dataset_folder, "clean.csv")

        # Load the dataset
        dataset_dirty = pd.read_csv(csv_dirty_file_path)
        dataset_clean = pd.read_csv(csv_clean_file_path)

        directory = f"./data/{dataset_name}_{timestamp}/dependency_violations"

        # Process the dataset (these functions should be defined elsewhere in your code)
        depedencies = pd.read_csv(f"./data/{dataset_folder}/dependency/output.csv")
        # detect_dep_violations(depedencies, dataset_dirty, directory)
        process_dep_violations_output(dataset_dirty, directory)

        # Load the output
        dep_violation_output = pd.read_csv(
            f"./data/{dataset_folder}/dependency_violations/output.csv"
        )
        prompt_metadata = pd.read_csv(
            f"./data/{dataset_folder}/dependency_violations/prompt_metadata.csv"
        )
        column_summary = pd.read_csv(
            f"./data/{dataset_folder}/dependency_violations/column_summary.csv"
        )

        # Calculate error annotation
        error_annotation = annotate_errors(dataset_clean, dataset_dirty)

        # Calculate accuracy metrics
        metrics = calculate_metrics(error_annotation, dep_violation_output)

        # Calculate True Positives, False Positives, False Negatives
        true_positive_df, false_positive_df, false_negative_df = inspect_classification(
            error_annotation, dep_violation_output, dataset_dirty
        )

        # Save TP, FP, FN
        true_positive_df.to_csv(
            f"./data/{dataset_folder}/dependency_violations/true_positives.csv"
        )
        false_positive_df.to_csv(
            f"./data/{dataset_folder}/dependency_violations/false_positives.csv"
        )
        false_negative_df.to_csv(
            f"./data/{dataset_folder}/dependency_violations/false_negatives.csv"
        )

        # Convert the output to JSON format
        annotated_output_json = dep_violation_output.to_dict(orient="records")
        prompt_metadata_json = prompt_metadata.to_dict(orient="records")
        column_summary_json = column_summary.to_dict(orient="records")
        true_positive_json = true_positive_df.to_dict(orient="records")
        false_positive_json = false_positive_df.to_dict(orient="records")
        false_negative_json = false_negative_df.to_dict(orient="records")

        # Extract the dataset schema (column names and indices)
        schema = [
            {"index": idx, "name": col} for idx, col in enumerate(dataset_dirty.columns)
        ]

        return (
            jsonify(
                {
                    "message": "Attribute errors detected!",
                    "annotated_output": annotated_output_json,  # Include annotated output in the response
                    "prompt_metadata": prompt_metadata_json,
                    "column_summary": column_summary_json,
                    "dataset_schema": schema,  # Include schema in the response
                    "dataset_size": dataset_dirty.shape[0],
                    "true_positives": true_positive_json,
                    "false_positives": false_positive_json,
                    "false_negatives": false_negative_json,
                    "metrics": metrics,
                }
            ),
            200,
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/evaluate-combined-errors", methods=["POST"])
def evaluate_combined_errors():
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
        csv_dirty_file_path = os.path.join("./data", dataset_folder, "dirty.csv")
        csv_clean_file_path = os.path.join("./data", dataset_folder, "clean.csv")

        # Load the dataset
        dataset_dirty = pd.read_csv(csv_dirty_file_path)
        dataset_clean = pd.read_csv(csv_clean_file_path)

        attribute_output = pd.read_csv(f"./data/{dataset_folder}/attribute/output.csv")
        dependency_output = pd.read_csv(
            f"./data/{dataset_folder}/dependency_violations/output.csv"
        )

        process_combined_output(attribute_output, dependency_output, dataset_folder)
        combined_output = pd.read_csv(
            f"./data/{dataset_folder}/consolidated_error_annotations.csv"
        )

        # Calculate error annotation
        error_annotation = annotate_errors(dataset_clean, dataset_dirty)

        # Calculate accuracy metrics
        metrics = calculate_metrics(error_annotation, combined_output)

        true_positive_df, false_positive_df, false_negative_df = inspect_classification(
            error_annotation, combined_output, dataset_dirty
        )

        # Save TP, FP, FN
        true_positive_df.to_csv(f"./data/{dataset_folder}/true_positives.csv")
        false_positive_df.to_csv(f"./data/{dataset_folder}/false_positives.csv")
        false_negative_df.to_csv(f"./data/{dataset_folder}/false_negatives.csv")

        # Convert the output to JSON format
        annotated_output_json = combined_output.to_dict(orient="records")
        true_positive_json = true_positive_df.to_dict(orient="records")
        false_positive_json = false_positive_df.to_dict(orient="records")
        false_negative_json = false_negative_df.to_dict(orient="records")

        # Extract the dataset schema (column names and indices)
        schema = [
            {"index": idx, "name": col} for idx, col in enumerate(dataset_dirty.columns)
        ]

        return (
            jsonify(
                {
                    "message": "Attribute errors detected!",
                    "annotated_output": annotated_output_json,  # Include annotated output in the response
                    "dataset_schema": schema,  # Include schema in the response
                    "true_positives": true_positive_json,
                    "false_positives": false_positive_json,
                    "false_negatives": false_negative_json,
                    "metrics": metrics,
                }
            ),
            200,
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/get-attribute-errors", methods=["GET"])
def get_attribute_errors():
    try:
        # Get the dataset name and timestamp from the query parameters
        dataset_name = request.args.get("dataset_name", None)
        timestamp = request.args.get("timestamp", None)

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

        # Construct the file paths using the dataset name and timestamp
        dataset_folder = f"{dataset_name}_{timestamp}"
        csv_dirty_file_path = os.path.join("./data", dataset_folder, "dirty.csv")
        csv_clean_file_path = os.path.join("./data", dataset_folder, "clean.csv")

        # Load the dirty dataset
        dataset_dirty = pd.read_csv(csv_dirty_file_path)

        # Load the output
        annotated_output = pd.read_csv(f"./data/{dataset_folder}/attribute/output.csv")
        prompt_metadata = pd.read_csv(
            f"./data/{dataset_folder}/attribute/prompt_metadata.csv"
        )
        column_summary = pd.read_csv(
            f"./data/{dataset_folder}/attribute/column_summary.csv"
        )

        # Convert the output to JSON format
        annotated_output_json = annotated_output.to_dict(orient="records")
        prompt_metadata_json = prompt_metadata.to_dict(orient="records")
        column_summary_json = column_summary.to_dict(orient="records")

        # Extract the dataset schema (column names and indices)
        schema = [
            {"index": idx, "name": col} for idx, col in enumerate(dataset_dirty.columns)
        ]

        # Check if the clean dataset exists
        if not os.path.exists(csv_clean_file_path):
            # If clean dataset does not exist, return response without TP, FP, FN, and metrics
            return (
                jsonify(
                    {
                        "message": "Attribute errors detected!",
                        "annotated_output": annotated_output_json,  # Include annotated output in the response
                        "prompt_metadata": prompt_metadata_json,
                        "column_summary": column_summary_json,
                        "dataset_schema": schema,  # Include schema in the response
                        "dataset_size": dataset_dirty.shape[0],
                    }
                ),
                200,
            )

        # Load the clean dataset if it exists
        dataset_clean = pd.read_csv(csv_clean_file_path)

        # Calculate error annotation
        error_annotation = annotate_errors(dataset_clean, dataset_dirty)

        # Calculate accuracy metrics
        metrics = calculate_metrics(error_annotation, annotated_output)

        # Save TP, FP, FN
        true_positive_df = pd.read_csv(
            f"./data/{dataset_folder}/attribute/true_positives.csv"
        ).replace(to_replace="0", value=0)
        false_positive_df = pd.read_csv(
            f"./data/{dataset_folder}/attribute/false_positives.csv"
        ).replace(to_replace="0", value=0)
        false_negative_df = pd.read_csv(
            f"./data/{dataset_folder}/attribute/false_negatives.csv"
        ).replace(to_replace="0", value=0)

        # Convert TP, FP, FN to JSON format
        true_positive_json = true_positive_df.to_dict(orient="records")
        false_positive_json = false_positive_df.to_dict(orient="records")
        false_negative_json = false_negative_df.to_dict(orient="records")

        # Return the full response with TP, FP, FN, and metrics if the clean dataset is found
        return (
            jsonify(
                {
                    "message": "Attribute errors detected!",
                    "annotated_output": annotated_output_json,  # Include annotated output in the response
                    "prompt_metadata": prompt_metadata_json,
                    "column_summary": column_summary_json,
                    "dataset_schema": schema,  # Include schema in the response
                    "dataset_size": dataset_dirty.shape[0],
                    "true_positives": true_positive_json,
                    "false_positives": false_positive_json,
                    "false_negatives": false_negative_json,
                    "metrics": metrics,
                }
            ),
            200,
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/get-dependencies", methods=["GET"])
def get_dependencies():
    try:

        dataset_name = request.args.get("dataset_name", None)
        timestamp = request.args.get("timestamp", None)

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

        # Load the output
        dependecy_output = pd.read_csv(f"./data/{dataset_folder}/dependency/output.csv")
        prompt_metadata = pd.read_csv(
            f"./data/{dataset_folder}/dependency/prompt_metadata.csv"
        )
        # Convert the output to JSON format
        dependecy_output_json = dependecy_output.to_dict(orient="records")
        prompt_metadata_json = prompt_metadata.to_dict(orient="records")

        schema = [
            {"index": idx, "name": col} for idx, col in enumerate(dataset.columns)
        ]

        return (
            jsonify(
                {
                    "message": "Dependencies detected!",
                    "dependencies": dependecy_output_json,
                    "prompt_metadata": prompt_metadata_json,
                    "dataset_schema": schema,  # Include schema in the response
                }
            ),
            200,
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/get-dependency-violation-errors", methods=["GET"])
def get_dependency_violation_errors():
    try:
        # Get the dataset name and timestamp from the query parameters
        dataset_name = request.args.get("dataset_name", None)
        timestamp = request.args.get("timestamp", None)

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

        # Construct the file paths using the dataset name and timestamp
        dataset_folder = f"{dataset_name}_{timestamp}"
        csv_dirty_file_path = os.path.join("./data", dataset_folder, "dirty.csv")
        csv_clean_file_path = os.path.join("./data", dataset_folder, "clean.csv")

        # Load the dirty dataset
        dataset_dirty = pd.read_csv(csv_dirty_file_path)

        # Load the output
        dep_violation_output = pd.read_csv(
            f"./data/{dataset_folder}/dependency_violations/output.csv"
        )
        prompt_metadata = pd.read_csv(
            f"./data/{dataset_folder}/dependency_violations/prompt_metadata.csv"
        )
        column_summary = pd.read_csv(
            f"./data/{dataset_folder}/dependency_violations/column_summary.csv"
        )

        # Convert the output to JSON format
        dep_violation_output_json = dep_violation_output.to_dict(orient="records")
        prompt_metadata_json = prompt_metadata.to_dict(orient="records")
        column_summary_json = column_summary.to_dict(orient="records")

        # Extract the dataset schema (column names and indices)
        schema = [
            {"index": idx, "name": col} for idx, col in enumerate(dataset_dirty.columns)
        ]

        # Check if the clean dataset exists
        if not os.path.exists(csv_clean_file_path):
            # If clean dataset does not exist, return response without TP, FP, FN, and metrics
            return (
                jsonify(
                    {
                        "message": "Dependency violation errors detected!",
                        "annotated_output": dep_violation_output_json,  # Include annotated output in the response
                        "prompt_metadata": prompt_metadata_json,
                        "column_summary": column_summary_json,
                        "dataset_schema": schema,  # Include schema in the response
                        "dataset_size": dataset_dirty.shape[0],
                    }
                ),
                200,
            )

        # Load the clean dataset if it exists
        dataset_clean = pd.read_csv(csv_clean_file_path)

        # Calculate error annotation
        error_annotation = annotate_errors(dataset_clean, dataset_dirty)

        # Calculate accuracy metrics
        metrics = calculate_metrics(error_annotation, dep_violation_output)

        # Read TP, FP, FN
        true_positive_df = pd.read_csv(
            f"./data/{dataset_folder}/dependency_violations/true_positives.csv"
        ).replace(to_replace="0", value=0)
        false_positive_df = pd.read_csv(
            f"./data/{dataset_folder}/dependency_violations/false_positives.csv"
        ).replace(to_replace="0", value=0)
        false_negative_df = pd.read_csv(
            f"./data/{dataset_folder}/dependency_violations/false_negatives.csv"
        ).replace(to_replace="0", value=0)

        # Convert TP, FP, FN to JSON format
        true_positive_json = true_positive_df.to_dict(orient="records")
        false_positive_json = false_positive_df.to_dict(orient="records")
        false_negative_json = false_negative_df.to_dict(orient="records")

        # Return the full response with TP, FP, FN, and metrics if the clean dataset is found
        return (
            jsonify(
                {
                    "message": "Dependency violation errors detected!",
                    "annotated_output": dep_violation_output_json,  # Include annotated output in the response
                    "prompt_metadata": prompt_metadata_json,
                    "column_summary": column_summary_json,
                    "dataset_schema": schema,  # Include schema in the response
                    "dataset_size": dataset_dirty.shape[0],
                    "true_positives": true_positive_json,
                    "false_positives": false_positive_json,
                    "false_negatives": false_negative_json,
                    "metrics": metrics,
                }
            ),
            200,
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/get-combined-errors", methods=["GET"])
def get_combined_errors():
    try:
        # Get the dataset name and timestamp from the query parameters
        dataset_name = request.args.get("dataset_name", None)
        timestamp = request.args.get("timestamp", None)

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

        # Construct the file paths using the dataset name and timestamp
        dataset_folder = f"{dataset_name}_{timestamp}"
        csv_dirty_file_path = os.path.join("./data", dataset_folder, "dirty.csv")
        csv_clean_file_path = os.path.join("./data", dataset_folder, "clean.csv")

        # Load the dirty dataset
        dataset_dirty = pd.read_csv(csv_dirty_file_path)

        # Load the output
        combined_output = pd.read_csv(
            f"./data/{dataset_folder}/consolidated_error_annotations.csv"
        )

        # Convert the output to JSON format
        combined_output_json = combined_output.to_dict(orient="records")

        # Extract the dataset schema (column names and indices)
        schema = [
            {"index": idx, "name": col} for idx, col in enumerate(dataset_dirty.columns)
        ]

        # Check if the clean dataset exists
        if not os.path.exists(csv_clean_file_path):
            # If clean dataset does not exist, return response without TP, FP, FN, and metrics
            return (
                jsonify(
                    {
                        "message": "Dependency violation errors detected!",
                        "annotated_output": combined_output_json,  # Include annotated output in the response
                        "dataset_schema": schema,  # Include schema in the response
                        "dataset_size": dataset_dirty.shape[0],
                    }
                ),
                200,
            )

        # Load the clean dataset if it exists
        dataset_clean = pd.read_csv(csv_clean_file_path)

        # Calculate error annotation
        error_annotation = annotate_errors(dataset_clean, dataset_dirty)

        # Calculate accuracy metrics
        metrics = calculate_metrics(error_annotation, combined_output)

        # Read TP, FP, FN
        true_positive_df = pd.read_csv(
            f"./data/{dataset_folder}/true_positives.csv"
        ).replace(to_replace="0", value=0)
        false_positive_df = pd.read_csv(
            f"./data/{dataset_folder}/false_positives.csv"
        ).replace(to_replace="0", value=0)
        false_negative_df = pd.read_csv(
            f"./data/{dataset_folder}/false_negatives.csv"
        ).replace(to_replace="0", value=0)

        # Convert TP, FP, FN to JSON format
        true_positive_json = true_positive_df.to_dict(orient="records")
        false_positive_json = false_positive_df.to_dict(orient="records")
        false_negative_json = false_negative_df.to_dict(orient="records")

        # Return the full response with TP, FP, FN, and metrics if the clean dataset is found
        return (
            jsonify(
                {
                    "message": "Dependency violation errors detected!",
                    "annotated_output": combined_output_json,  # Include annotated output in the response
                    "dataset_schema": schema,  # Include schema in the response
                    "dataset_size": dataset_dirty.shape[0],
                    "true_positives": true_positive_json,
                    "false_positives": false_positive_json,
                    "false_negatives": false_negative_json,
                    "metrics": metrics,
                }
            ),
            200,
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/get-all-detections", methods=["GET"])
def get_all_detections():
    try:
        # Path where datasets are stored
        base_path = "./data"

        # List to store all detections
        detections = []

        # Iterate over each subdirectory in the base path
        for folder in os.listdir(base_path):
            folder_path = os.path.join(base_path, folder)

            # Check if the item is a directory
            if os.path.isdir(folder_path):
                # Split the folder name from the back to handle complex dataset names
                parts = folder.rsplit("_", 2)
                if len(parts) == 3:
                    dataset_name = parts[0]
                    timestamp = f"{parts[1]}_{parts[2]}"

                    # Determine the type based on the presence of "clean.csv"
                    csv_clean_file_path = os.path.join(folder_path, "clean.csv")
                    detection_type = (
                        "evaluation"
                        if os.path.exists(csv_clean_file_path)
                        else "detection"
                    )

                    # Check for the existence of dependency, attribute, and dependency violation folders
                    has_dependency = os.path.exists(
                        os.path.join(folder_path, "dependency")
                    )
                    has_attribute = os.path.exists(
                        os.path.join(folder_path, "attribute")
                    )
                    has_dependency_violations = os.path.exists(
                        os.path.join(folder_path, "dependency_violations")
                    )

                    model_file_path = os.path.join(folder_path, "gpt_model.txt")
                    model_used = None
                    if os.path.exists(model_file_path):
                        with open(model_file_path, "r") as model_file:
                            model_used = model_file.read().strip()

                    # Append the detection info to the list
                    detections.append(
                        {
                            "dataset_name": dataset_name,
                            "timestamp": timestamp,
                            "type": detection_type,
                            "used_dependency": has_dependency,
                            "used_attribute": has_attribute,
                            "used_dependency_violations": has_dependency_violations,
                            "gpt_model": model_used,
                        }
                    )

        # Return the list of detections as a JSON response
        return jsonify(detections), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/get-dataset", methods=["GET"])
def get_dataset():
    try:
        # Get the dataset name and timestamp from the query parameters
        dataset_name = request.args.get("dataset_name", None)
        timestamp = request.args.get("timestamp", None)

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

        # Construct the file paths using the dataset name and timestamp
        dataset_folder = f"{dataset_name}_{timestamp}"
        csv_dirty_file_path = os.path.join("./data", dataset_folder, "dirty.csv")

        # Load the dirty dataset
        dataset_dirty = pd.read_csv(csv_dirty_file_path)
        dataset_dirty = dataset_dirty.fillna("")

        # Extract the dataset schema (column names and indices)
        schema = [
            {"index": idx, "name": col} for idx, col in enumerate(dataset_dirty.columns)
        ]

        # Convert TP, FP, FN to JSON format
        dataset_json = dataset_dirty.to_dict(orient="records")

        # Check for the GPT model file
        model_file_path = os.path.join(f"./data/{dataset_folder}", "gpt_model.txt")
        model_used = None
        if os.path.exists(model_file_path):
            with open(model_file_path, "r") as model_file:
                model_used = model_file.read().strip()

        # Return the full response with TP, FP, FN, and metrics if the clean dataset is found
        return (
            jsonify(
                {
                    "message": "Dataset retrieved!",
                    "dataset": dataset_json,  # Include annotated output in the response
                    "dataset_schema": schema,  # Include schema in the response
                    "dataset_size": dataset_dirty.shape[0],
                    "gpt_model": model_used,  # Include model used in the response
                }
            ),
            200,
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# Helper function to load settings
def load_settings():
    if os.path.exists(SETTINGS_FILE):
        with open(SETTINGS_FILE, "r") as f:
            return json.load(f)
    return {}


# Helper function to save settings
def save_settings(data):
    with open(SETTINGS_FILE, "w") as f:
        json.dump(data, f, indent=4)


# GET request to retrieve settings
@app.route("/settings", methods=["GET"])
def get_settings():
    try:
        settings = load_settings()
        return jsonify(settings), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/settings", methods=["POST"])
def create_settings():
    try:
        # Check if the request contains JSON or form data
        if request.is_json:
            # Load JSON data
            data = request.json
        else:
            # Load form data
            data = request.form.to_dict()

        required_fields = ["gpt_organization", "gpt_project", "gpt_api", "gpt_model"]

        # Check if required fields are present
        if not all(field in data for field in required_fields):
            return jsonify({"error": "Missing required fields"}), 400

        # Save the data to the settings file
        save_settings(data)
        return jsonify({"message": "Settings created successfully"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# PUT request to update settings
@app.route("/settings", methods=["PUT"])
def update_settings():
    try:
        data = request.json
        current_settings = load_settings()

        # Update only fields provided in the request
        for key, value in data.items():
            current_settings[key] = value

        # Save updated settings to file
        save_settings(current_settings)
        return jsonify({"message": "Settings updated successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True)
