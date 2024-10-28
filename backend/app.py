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
import pandas as pd

from services.attribute_prompt import attribute_prompt
from utils.accuracy_utils import calculate_metrics
from utils.data_utils import annotate_errors
from utils.output_utils import process_attribute_output

# # from modules import tuple_analyzer
# from backend.modules.AttributeProcessor import attribute_prompt

# # from modules.dependency_detection import
from config import DevelopmentConfig


app = Flask(__name__)
app.config.from_object(DevelopmentConfig)
app.secret_key = "supersecretkey"
# app.config["UPLOAD_FOLDER"] = "uploads"
app.config["ALLOWED_EXTENSIONS"] = {"csv"}

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


# @app.route("/detect_dependencies", methods=["POST"])
# def detect_dependencies():
#     try:
#         dataset = pd.read_csv("./uploads/dataset.csv")
#         attribute_prompt(dataset, "./output/attribute")

#         return (
#             jsonify(
#                 {
#                     "message": "Attribute errors detected!",
#                 }
#             ),
#             200,
#         )

#     except Exception as e:
#         return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True)
