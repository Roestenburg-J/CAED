from flask import (
    Flask,
    request,
    jsonify,
)
from flask_cors import CORS
import os
import logging
import pandas as pd
import json
import uuid as uuid_lib
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

from config import DevelopmentConfig


app = Flask(__name__)
frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
CORS(app, resources={r"/*": {"origins": ["http://localhost:3000", frontend_url]}})
app.config.from_object(DevelopmentConfig)
app.secret_key = "supersecretkey"
app.config["ALLOWED_EXTENSIONS"] = {"csv"}
SETTINGS_FILE = "./user_settings/settings.json"
DATA_DIR = "./data"

# Set up logging
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]",
)
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.DEBUG)
formatter = logging.Formatter(
    "%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]"
)
console_handler.setFormatter(formatter)
app.logger.addHandler(console_handler)


# ---------------------------------------------------------------------------
# Manifest helpers
# ---------------------------------------------------------------------------

def write_manifest(dataset_dir, manifest):
    with open(os.path.join(dataset_dir, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=4)


def read_manifest(dataset_dir):
    path = os.path.join(dataset_dir, "manifest.json")
    if not os.path.exists(path):
        return None
    with open(path, "r") as f:
        return json.load(f)


def update_manifest_analysis(dataset_dir, analysis_type, status):
    manifest = read_manifest(dataset_dir)
    if manifest is None:
        return
    manifest["analyses"][analysis_type] = status
    write_manifest(dataset_dir, manifest)


def _make_legacy_manifest(folder, folder_path):
    """Auto-generate and persist a manifest.json for a pre-manifest dataset directory."""
    parts = folder.rsplit("_", 2)
    if len(parts) == 3:
        name = parts[0]
        ts_str = f"{parts[1]}_{parts[2]}"
        try:
            created_at = datetime.strptime(ts_str, "%Y%m%d_%H%M%S").isoformat()
        except ValueError:
            created_at = datetime.fromtimestamp(os.path.getmtime(folder_path)).isoformat()
    else:
        name = folder
        created_at = datetime.fromtimestamp(os.path.getmtime(folder_path)).isoformat()

    dataset_type = (
        "evaluation" if os.path.exists(os.path.join(folder_path, "clean.csv")) else "detection"
    )

    model = None
    model_file = os.path.join(folder_path, "gpt_model.txt")
    if os.path.exists(model_file):
        with open(model_file, "r") as f:
            model = f.read().strip()

    manifest = {
        "id": folder,
        "name": name,
        "created_at": created_at,
        "type": dataset_type,
        "provider": None,
        "model": model,
        "analyses": {
            "attribute": "complete" if os.path.exists(os.path.join(folder_path, "attribute")) else "pending",
            "dependency": "complete" if os.path.exists(os.path.join(folder_path, "dependency")) else "pending",
            "dep_violations": "complete" if os.path.exists(os.path.join(folder_path, "dependency_violations")) else "pending",
            "consolidated": "complete" if os.path.exists(os.path.join(folder_path, "consolidated_error_annotations.csv")) else "pending",
        },
    }
    write_manifest(folder_path, manifest)
    return manifest


def _get_dataset_dir(dataset_id):
    return os.path.join(DATA_DIR, dataset_id)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

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

    file_ext = os.path.splitext(file.filename)[1].lower()

    if file_ext not in [".csv", ".xls", ".xlsx", ".json"]:
        return (
            jsonify({"error": "Unsupported file format. Please upload a CSV, Excel, or JSON file"}),
            400,
        )

    try:
        if file_ext == ".csv":
            df = pd.read_csv(file)
        elif file_ext in [".xls", ".xlsx"]:
            df = pd.read_excel(file)
        elif file_ext == ".json":
            df = pd.read_json(file)

        dataset_id = str(uuid_lib.uuid4())
        dataset_dir = _get_dataset_dir(dataset_id)
        os.makedirs(dataset_dir, exist_ok=True)

        settings = load_detailed_settings()
        model = settings.get("model", settings.get("gpt_model", "unknown"))
        provider = settings.get("provider", "openai")

        manifest = {
            "id": dataset_id,
            "name": dataset_name,
            "created_at": datetime.now().isoformat(),
            "type": "detection",
            "provider": provider,
            "model": model,
            "analyses": {
                "attribute": "pending",
                "dependency": "pending",
                "dep_violations": "pending",
                "consolidated": "pending",
            },
        }
        write_manifest(dataset_dir, manifest)

        csv_file_path = os.path.join(dataset_dir, "dirty.csv")
        df.to_csv(csv_file_path, index=False)

        return (
            jsonify(
                {
                    "message": "File successfully uploaded",
                    "path": csv_file_path,
                    "dataset_id": dataset_id,
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
        dataset_id = request.form.get("dataset_id", None)
        if not dataset_id:
            return jsonify({"error": "'dataset_id' parameter is required"}), 400

        dataset_dir = _get_dataset_dir(dataset_id)
        csv_file_path = os.path.join(dataset_dir, "dirty.csv")
        attribute_dir = os.path.join(dataset_dir, "attribute")

        dataset = pd.read_csv(csv_file_path)

        attribute_prompt(dataset, attribute_dir)
        process_attribute_output(dataset, attribute_dir)

        update_manifest_analysis(dataset_dir, "attribute", "complete")

        annotated_output = pd.read_csv(os.path.join(attribute_dir, "output.csv"))
        prompt_metadata = pd.read_csv(os.path.join(attribute_dir, "prompt_metadata.csv"))
        column_summary = pd.read_csv(os.path.join(attribute_dir, "column_summary.csv"))

        schema = [{"index": idx, "name": col} for idx, col in enumerate(dataset.columns)]

        return (
            jsonify(
                {
                    "message": "Attribute errors detected!",
                    "annotated_output": annotated_output.to_dict(orient="records"),
                    "prompt_metadata": prompt_metadata.to_dict(orient="records"),
                    "column_summary": column_summary.to_dict(orient="records"),
                    "dataset_schema": schema,
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
        dataset_id = request.form.get("dataset_id", None)
        if not dataset_id:
            return jsonify({"error": "'dataset_id' parameter is required"}), 400

        dataset_dir = _get_dataset_dir(dataset_id)
        csv_file_path = os.path.join(dataset_dir, "dirty.csv")
        dependency_dir = os.path.join(dataset_dir, "dependency")

        dataset = pd.read_csv(csv_file_path)

        settings = load_detailed_settings()
        minhash_threshold = float(settings.get("minhash_dependency_threshold", settings.get("minhash_threshold", 0.5)))
        minhash_num_perm = int(settings.get("minhash_dependency_num_perm", settings.get("minhash_num_perm", 128)))
        filtered_top_buckets, buckets = create_buckets(dataset, threshold=minhash_threshold, num_perm=minhash_num_perm)
        dependency_detection(dataset, filtered_top_buckets, buckets, dependency_dir)
        process_dependency_output(filtered_top_buckets, dataset, dependency_dir)

        update_manifest_analysis(dataset_dir, "dependency", "complete")

        dependency_output = pd.read_csv(os.path.join(dependency_dir, "output.csv"))
        prompt_metadata = pd.read_csv(os.path.join(dependency_dir, "prompt_metadata.csv"))

        schema = [{"index": idx, "name": col} for idx, col in enumerate(dataset.columns)]

        return (
            jsonify(
                {
                    "message": "Dependencies detected!",
                    "dependencies": dependency_output.to_dict(orient="records"),
                    "prompt_metadata": prompt_metadata.to_dict(orient="records"),
                    "dataset_schema": schema,
                }
            ),
            200,
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/detect-dependency-violations", methods=["POST"])
def detect_dependency_violations():
    try:
        dataset_id = request.form.get("dataset_id", None)
        if not dataset_id:
            return jsonify({"error": "'dataset_id' parameter is required"}), 400

        dataset_dir = _get_dataset_dir(dataset_id)
        csv_file_path = os.path.join(dataset_dir, "dirty.csv")
        dep_viol_dir = os.path.join(dataset_dir, "dependency_violations")
        dependency_output_path = os.path.join(dataset_dir, "dependency", "output.csv")

        dataset = pd.read_csv(csv_file_path)
        dependencies = pd.read_csv(dependency_output_path)

        detect_dep_violations(dependencies, dataset, dep_viol_dir)
        process_dep_violations_output(dataset, dep_viol_dir)

        update_manifest_analysis(dataset_dir, "dep_violations", "complete")

        dep_violation_output = pd.read_csv(os.path.join(dep_viol_dir, "output.csv"))
        prompt_metadata = pd.read_csv(os.path.join(dep_viol_dir, "prompt_metadata.csv"))
        column_summary = pd.read_csv(os.path.join(dep_viol_dir, "column_summary.csv"))

        schema = [{"index": idx, "name": col} for idx, col in enumerate(dataset.columns)]

        return (
            jsonify(
                {
                    "message": "Dependency violations detected!",
                    "annotated_output": dep_violation_output.to_dict(orient="records"),
                    "prompt_metadata": prompt_metadata.to_dict(orient="records"),
                    "column_summary": column_summary.to_dict(orient="records"),
                    "dataset_schema": schema,
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
        dataset_id = request.form.get("dataset_id", None)
        if not dataset_id:
            return jsonify({"error": "'dataset_id' parameter is required"}), 400

        dataset_dir = _get_dataset_dir(dataset_id)
        csv_file_path = os.path.join(dataset_dir, "dirty.csv")

        dataset = pd.read_csv(csv_file_path)
        attribute_output = pd.read_csv(os.path.join(dataset_dir, "attribute", "output.csv"))
        dependency_output = pd.read_csv(os.path.join(dataset_dir, "dependency_violations", "output.csv"))

        process_combined_output(attribute_output, dependency_output, dataset_id)

        update_manifest_analysis(dataset_dir, "consolidated", "complete")

        combined_output = pd.read_csv(os.path.join(dataset_dir, "consolidated_error_annotations.csv"))
        schema = [{"index": idx, "name": col} for idx, col in enumerate(dataset.columns)]

        return (
            jsonify(
                {
                    "message": "Combined errors detected!",
                    "annotated_output": combined_output.to_dict(orient="records"),
                    "dataset_schema": schema,
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

    dirty_file_ext = os.path.splitext(dirty_file.filename)[1].lower()
    clean_file_ext = os.path.splitext(clean_file.filename)[1].lower()

    if dirty_file_ext not in [".csv", ".xls", ".xlsx", ".json"] or clean_file_ext not in [
        ".csv", ".xls", ".xlsx", ".json"
    ]:
        return (
            jsonify({"error": "Unsupported file format. Please upload a CSV, Excel, or JSON file"}),
            400,
        )

    try:
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

        if df_clean.shape != df_dirty.shape or not all(df_clean.columns == df_dirty.columns):
            return jsonify({"error": "Uploaded files have different shapes or column names."}), 400

        dataset_id = str(uuid_lib.uuid4())
        dataset_dir = _get_dataset_dir(dataset_id)
        os.makedirs(dataset_dir, exist_ok=True)

        settings = load_detailed_settings()
        model = settings.get("model", settings.get("gpt_model", "unknown"))
        provider = settings.get("provider", "openai")

        manifest = {
            "id": dataset_id,
            "name": dataset_name,
            "created_at": datetime.now().isoformat(),
            "type": "evaluation",
            "provider": provider,
            "model": model,
            "analyses": {
                "attribute": "pending",
                "dependency": "pending",
                "dep_violations": "pending",
                "consolidated": "pending",
            },
        }
        write_manifest(dataset_dir, manifest)

        df_dirty.to_csv(os.path.join(dataset_dir, "dirty.csv"), index=False)
        df_clean.to_csv(os.path.join(dataset_dir, "clean.csv"), index=False)

        return (
            jsonify(
                {
                    "message": "Files successfully uploaded",
                    "dataset_id": dataset_id,
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
        dataset_id = request.form.get("dataset_id", None)
        if not dataset_id:
            return jsonify({"error": "'dataset_id' parameter is required"}), 400

        dataset_dir = _get_dataset_dir(dataset_id)
        csv_dirty_file_path = os.path.join(dataset_dir, "dirty.csv")
        csv_clean_file_path = os.path.join(dataset_dir, "clean.csv")
        attribute_dir = os.path.join(dataset_dir, "attribute")

        dataset_dirty = pd.read_csv(csv_dirty_file_path)
        dataset_clean = pd.read_csv(csv_clean_file_path)

        process_attribute_output(dataset_dirty, attribute_dir)

        annotated_output = pd.read_csv(os.path.join(attribute_dir, "output.csv"))
        prompt_metadata = pd.read_csv(os.path.join(attribute_dir, "prompt_metadata.csv"))
        column_summary = pd.read_csv(os.path.join(attribute_dir, "column_summary.csv"))

        error_annotation = annotate_errors(dataset_clean, dataset_dirty)
        metrics = calculate_metrics(error_annotation, annotated_output)
        true_positive_df, false_positive_df, false_negative_df = inspect_classification(
            error_annotation, annotated_output, dataset_dirty
        )

        true_positive_df.to_csv(os.path.join(attribute_dir, "true_positives.csv"))
        false_positive_df.to_csv(os.path.join(attribute_dir, "false_positives.csv"))
        false_negative_df.to_csv(os.path.join(attribute_dir, "false_negatives.csv"))

        schema = [{"index": idx, "name": col} for idx, col in enumerate(dataset_dirty.columns)]

        return (
            jsonify(
                {
                    "message": "Attribute errors evaluated!",
                    "annotated_output": annotated_output.to_dict(orient="records"),
                    "prompt_metadata": prompt_metadata.to_dict(orient="records"),
                    "column_summary": column_summary.to_dict(orient="records"),
                    "dataset_schema": schema,
                    "dataset_size": dataset_dirty.shape[0],
                    "true_positives": true_positive_df.to_dict(orient="records"),
                    "false_positives": false_positive_df.to_dict(orient="records"),
                    "false_negatives": false_negative_df.to_dict(orient="records"),
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
        dataset_id = request.form.get("dataset_id", None)
        if not dataset_id:
            return jsonify({"error": "'dataset_id' parameter is required"}), 400

        dataset_dir = _get_dataset_dir(dataset_id)
        csv_dirty_file_path = os.path.join(dataset_dir, "dirty.csv")
        csv_clean_file_path = os.path.join(dataset_dir, "clean.csv")
        dep_viol_dir = os.path.join(dataset_dir, "dependency_violations")

        dataset_dirty = pd.read_csv(csv_dirty_file_path)
        dataset_clean = pd.read_csv(csv_clean_file_path)

        process_dep_violations_output(dataset_dirty, dep_viol_dir)

        dep_violation_output = pd.read_csv(os.path.join(dep_viol_dir, "output.csv"))
        prompt_metadata = pd.read_csv(os.path.join(dep_viol_dir, "prompt_metadata.csv"))
        column_summary = pd.read_csv(os.path.join(dep_viol_dir, "column_summary.csv"))

        error_annotation = annotate_errors(dataset_clean, dataset_dirty)
        metrics = calculate_metrics(error_annotation, dep_violation_output)
        true_positive_df, false_positive_df, false_negative_df = inspect_classification(
            error_annotation, dep_violation_output, dataset_dirty
        )

        true_positive_df.to_csv(os.path.join(dep_viol_dir, "true_positives.csv"))
        false_positive_df.to_csv(os.path.join(dep_viol_dir, "false_positives.csv"))
        false_negative_df.to_csv(os.path.join(dep_viol_dir, "false_negatives.csv"))

        schema = [{"index": idx, "name": col} for idx, col in enumerate(dataset_dirty.columns)]

        return (
            jsonify(
                {
                    "message": "Dependency violations evaluated!",
                    "annotated_output": dep_violation_output.to_dict(orient="records"),
                    "prompt_metadata": prompt_metadata.to_dict(orient="records"),
                    "column_summary": column_summary.to_dict(orient="records"),
                    "dataset_schema": schema,
                    "dataset_size": dataset_dirty.shape[0],
                    "true_positives": true_positive_df.to_dict(orient="records"),
                    "false_positives": false_positive_df.to_dict(orient="records"),
                    "false_negatives": false_negative_df.to_dict(orient="records"),
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
        dataset_id = request.form.get("dataset_id", None)
        if not dataset_id:
            return jsonify({"error": "'dataset_id' parameter is required"}), 400

        dataset_dir = _get_dataset_dir(dataset_id)
        csv_dirty_file_path = os.path.join(dataset_dir, "dirty.csv")
        csv_clean_file_path = os.path.join(dataset_dir, "clean.csv")

        dataset_dirty = pd.read_csv(csv_dirty_file_path)
        dataset_clean = pd.read_csv(csv_clean_file_path)

        attribute_output = pd.read_csv(os.path.join(dataset_dir, "attribute", "output.csv"))
        dependency_output = pd.read_csv(os.path.join(dataset_dir, "dependency_violations", "output.csv"))

        process_combined_output(attribute_output, dependency_output, dataset_id)
        combined_output = pd.read_csv(os.path.join(dataset_dir, "consolidated_error_annotations.csv"))

        update_manifest_analysis(dataset_dir, "consolidated", "complete")

        error_annotation = annotate_errors(dataset_clean, dataset_dirty)
        metrics = calculate_metrics(error_annotation, combined_output)
        true_positive_df, false_positive_df, false_negative_df = inspect_classification(
            error_annotation, combined_output, dataset_dirty
        )

        true_positive_df.to_csv(os.path.join(dataset_dir, "true_positives.csv"))
        false_positive_df.to_csv(os.path.join(dataset_dir, "false_positives.csv"))
        false_negative_df.to_csv(os.path.join(dataset_dir, "false_negatives.csv"))

        schema = [{"index": idx, "name": col} for idx, col in enumerate(dataset_dirty.columns)]

        return (
            jsonify(
                {
                    "message": "Combined errors evaluated!",
                    "annotated_output": combined_output.to_dict(orient="records"),
                    "dataset_schema": schema,
                    "true_positives": true_positive_df.to_dict(orient="records"),
                    "false_positives": false_positive_df.to_dict(orient="records"),
                    "false_negatives": false_negative_df.to_dict(orient="records"),
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
        dataset_id = request.args.get("dataset_id", None)
        if not dataset_id:
            return jsonify({"error": "'dataset_id' parameter is required"}), 400

        dataset_dir = _get_dataset_dir(dataset_id)
        csv_dirty_file_path = os.path.join(dataset_dir, "dirty.csv")
        csv_clean_file_path = os.path.join(dataset_dir, "clean.csv")
        attribute_dir = os.path.join(dataset_dir, "attribute")

        dataset_dirty = pd.read_csv(csv_dirty_file_path)
        annotated_output = pd.read_csv(os.path.join(attribute_dir, "output.csv"))
        prompt_metadata = pd.read_csv(os.path.join(attribute_dir, "prompt_metadata.csv"))
        column_summary = pd.read_csv(os.path.join(attribute_dir, "column_summary.csv"))

        schema = [{"index": idx, "name": col} for idx, col in enumerate(dataset_dirty.columns)]

        if not os.path.exists(csv_clean_file_path):
            return (
                jsonify(
                    {
                        "message": "Attribute errors detected!",
                        "annotated_output": annotated_output.to_dict(orient="records"),
                        "prompt_metadata": prompt_metadata.to_dict(orient="records"),
                        "column_summary": column_summary.to_dict(orient="records"),
                        "dataset_schema": schema,
                        "dataset_size": dataset_dirty.shape[0],
                    }
                ),
                200,
            )

        dataset_clean = pd.read_csv(csv_clean_file_path)
        error_annotation = annotate_errors(dataset_clean, dataset_dirty)
        metrics = calculate_metrics(error_annotation, annotated_output)

        true_positive_df = pd.read_csv(os.path.join(attribute_dir, "true_positives.csv")).replace(to_replace="0", value=0)
        false_positive_df = pd.read_csv(os.path.join(attribute_dir, "false_positives.csv")).replace(to_replace="0", value=0)
        false_negative_df = pd.read_csv(os.path.join(attribute_dir, "false_negatives.csv")).replace(to_replace="0", value=0)

        return (
            jsonify(
                {
                    "message": "Attribute errors detected!",
                    "annotated_output": annotated_output.to_dict(orient="records"),
                    "prompt_metadata": prompt_metadata.to_dict(orient="records"),
                    "column_summary": column_summary.to_dict(orient="records"),
                    "dataset_schema": schema,
                    "dataset_size": dataset_dirty.shape[0],
                    "true_positives": true_positive_df.to_dict(orient="records"),
                    "false_positives": false_positive_df.to_dict(orient="records"),
                    "false_negatives": false_negative_df.to_dict(orient="records"),
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
        dataset_id = request.args.get("dataset_id", None)
        if not dataset_id:
            return jsonify({"error": "'dataset_id' parameter is required"}), 400

        dataset_dir = _get_dataset_dir(dataset_id)
        csv_file_path = os.path.join(dataset_dir, "dirty.csv")
        dependency_dir = os.path.join(dataset_dir, "dependency")

        dataset = pd.read_csv(csv_file_path)
        dependency_output = pd.read_csv(os.path.join(dependency_dir, "output.csv"))
        prompt_metadata = pd.read_csv(os.path.join(dependency_dir, "prompt_metadata.csv"))

        schema = [{"index": idx, "name": col} for idx, col in enumerate(dataset.columns)]

        return (
            jsonify(
                {
                    "message": "Dependencies detected!",
                    "dependencies": dependency_output.to_dict(orient="records"),
                    "prompt_metadata": prompt_metadata.to_dict(orient="records"),
                    "dataset_schema": schema,
                }
            ),
            200,
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/get-dependency-violation-errors", methods=["GET"])
def get_dependency_violation_errors():
    try:
        dataset_id = request.args.get("dataset_id", None)
        if not dataset_id:
            return jsonify({"error": "'dataset_id' parameter is required"}), 400

        dataset_dir = _get_dataset_dir(dataset_id)
        csv_dirty_file_path = os.path.join(dataset_dir, "dirty.csv")
        csv_clean_file_path = os.path.join(dataset_dir, "clean.csv")
        dep_viol_dir = os.path.join(dataset_dir, "dependency_violations")

        dataset_dirty = pd.read_csv(csv_dirty_file_path)
        dep_violation_output = pd.read_csv(os.path.join(dep_viol_dir, "output.csv"))
        prompt_metadata = pd.read_csv(os.path.join(dep_viol_dir, "prompt_metadata.csv"))
        column_summary = pd.read_csv(os.path.join(dep_viol_dir, "column_summary.csv"))

        schema = [{"index": idx, "name": col} for idx, col in enumerate(dataset_dirty.columns)]

        if not os.path.exists(csv_clean_file_path):
            return (
                jsonify(
                    {
                        "message": "Dependency violation errors detected!",
                        "annotated_output": dep_violation_output.to_dict(orient="records"),
                        "prompt_metadata": prompt_metadata.to_dict(orient="records"),
                        "column_summary": column_summary.to_dict(orient="records"),
                        "dataset_schema": schema,
                        "dataset_size": dataset_dirty.shape[0],
                    }
                ),
                200,
            )

        dataset_clean = pd.read_csv(csv_clean_file_path)
        error_annotation = annotate_errors(dataset_clean, dataset_dirty)
        metrics = calculate_metrics(error_annotation, dep_violation_output)

        true_positive_df = pd.read_csv(os.path.join(dep_viol_dir, "true_positives.csv")).replace(to_replace="0", value=0)
        false_positive_df = pd.read_csv(os.path.join(dep_viol_dir, "false_positives.csv")).replace(to_replace="0", value=0)
        false_negative_df = pd.read_csv(os.path.join(dep_viol_dir, "false_negatives.csv")).replace(to_replace="0", value=0)

        return (
            jsonify(
                {
                    "message": "Dependency violation errors detected!",
                    "annotated_output": dep_violation_output.to_dict(orient="records"),
                    "prompt_metadata": prompt_metadata.to_dict(orient="records"),
                    "column_summary": column_summary.to_dict(orient="records"),
                    "dataset_schema": schema,
                    "dataset_size": dataset_dirty.shape[0],
                    "true_positives": true_positive_df.to_dict(orient="records"),
                    "false_positives": false_positive_df.to_dict(orient="records"),
                    "false_negatives": false_negative_df.to_dict(orient="records"),
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
        dataset_id = request.args.get("dataset_id", None)
        if not dataset_id:
            return jsonify({"error": "'dataset_id' parameter is required"}), 400

        dataset_dir = _get_dataset_dir(dataset_id)
        csv_dirty_file_path = os.path.join(dataset_dir, "dirty.csv")
        csv_clean_file_path = os.path.join(dataset_dir, "clean.csv")

        dataset_dirty = pd.read_csv(csv_dirty_file_path)
        combined_output = pd.read_csv(os.path.join(dataset_dir, "consolidated_error_annotations.csv"))

        schema = [{"index": idx, "name": col} for idx, col in enumerate(dataset_dirty.columns)]

        if not os.path.exists(csv_clean_file_path):
            return (
                jsonify(
                    {
                        "message": "Combined errors retrieved!",
                        "annotated_output": combined_output.to_dict(orient="records"),
                        "dataset_schema": schema,
                        "dataset_size": dataset_dirty.shape[0],
                    }
                ),
                200,
            )

        dataset_clean = pd.read_csv(csv_clean_file_path)
        error_annotation = annotate_errors(dataset_clean, dataset_dirty)
        metrics = calculate_metrics(error_annotation, combined_output)

        true_positive_df = pd.read_csv(os.path.join(dataset_dir, "true_positives.csv")).replace(to_replace="0", value=0)
        false_positive_df = pd.read_csv(os.path.join(dataset_dir, "false_positives.csv")).replace(to_replace="0", value=0)
        false_negative_df = pd.read_csv(os.path.join(dataset_dir, "false_negatives.csv")).replace(to_replace="0", value=0)

        return (
            jsonify(
                {
                    "message": "Combined errors retrieved!",
                    "annotated_output": combined_output.to_dict(orient="records"),
                    "dataset_schema": schema,
                    "dataset_size": dataset_dirty.shape[0],
                    "true_positives": true_positive_df.to_dict(orient="records"),
                    "false_positives": false_positive_df.to_dict(orient="records"),
                    "false_negatives": false_negative_df.to_dict(orient="records"),
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
        detections = []

        for folder in os.listdir(DATA_DIR):
            folder_path = os.path.join(DATA_DIR, folder)
            if not os.path.isdir(folder_path):
                continue

            manifest = read_manifest(folder_path)
            if manifest is None:
                # Legacy directory — auto-generate and persist manifest
                manifest = _make_legacy_manifest(folder, folder_path)

            analyses = manifest.get("analyses", {})
            detections.append(
                {
                    "dataset_id": manifest["id"],
                    "dataset_name": manifest["name"],
                    "created_at": manifest["created_at"],
                    "type": manifest["type"],
                    "model": manifest.get("model"),
                    "used_attribute": analyses.get("attribute") == "complete",
                    "used_dependency": analyses.get("dependency") == "complete",
                    "used_dependency_violations": analyses.get("dep_violations") == "complete",
                }
            )

        return jsonify(detections), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/get-dataset", methods=["GET"])
def get_dataset():
    try:
        dataset_id = request.args.get("dataset_id", None)
        if not dataset_id:
            return jsonify({"error": "'dataset_id' parameter is required"}), 400

        dataset_dir = _get_dataset_dir(dataset_id)
        csv_dirty_file_path = os.path.join(dataset_dir, "dirty.csv")

        dataset_dirty = pd.read_csv(csv_dirty_file_path)
        dataset_dirty = dataset_dirty.fillna("")

        schema = [{"index": idx, "name": col} for idx, col in enumerate(dataset_dirty.columns)]

        manifest = read_manifest(dataset_dir)
        model_used = manifest.get("model") if manifest else None

        return (
            jsonify(
                {
                    "message": "Dataset retrieved!",
                    "dataset": dataset_dirty.to_dict(orient="records"),
                    "dataset_schema": schema,
                    "dataset_size": dataset_dirty.shape[0],
                    "model": model_used,
                }
            ),
            200,
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------

def load_settings():
    if os.path.exists(SETTINGS_FILE):
        with open(SETTINGS_FILE, "r") as f:
            return json.load(f)
    return {}


def save_settings(data):
    with open(SETTINGS_FILE, "w") as f:
        json.dump(data, f, indent=4)


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
        if request.is_json:
            data = request.json
        else:
            data = request.form.to_dict()

        required_fields = ["provider", "model"]
        if not all(field in data for field in required_fields):
            return jsonify({"error": "Missing required fields"}), 400

        save_settings(data)
        return jsonify({"message": "Settings created successfully"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/settings", methods=["PUT"])
def update_settings():
    try:
        data = request.json
        current_settings = load_settings()
        for key, value in data.items():
            current_settings[key] = value
        save_settings(current_settings)
        return jsonify({"message": "Settings updated successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True)
