import os
import json
import logging
import pandas as pd
from collections import defaultdict

from exceptions import OutputParsingError

logger = logging.getLogger(__name__)


def process_attribute_output(dataset: pd.DataFrame, directory: str) -> None:
    os.makedirs(directory, exist_ok=True)
    # Initialize an empty dictionary to store data for each folder
    data_dict = {}
    error_counts = {}

    # Loop through all subdirectories and files
    for root, dirs, files in os.walk(directory):
        # Get the folder name (which will be the column name)
        folder_name = os.path.basename(root)

        # Skip the root directory itself (attribute_output)
        if root == directory:
            continue

        logger.debug("Processing attribute folder: %s", folder_name)

        annotated_output = None
        dict_data = None

        for file in files:
            if file.endswith(".json"):
                file_path = os.path.join(root, file)

                with open(file_path, "r") as json_file:
                    try:
                        json_data = json.load(json_file)
                        annotations = [
                            item["annotation"] for item in json_data["output"]
                        ]
                        index = [item["index"] for item in json_data["output"]]

                        annotated_output = pd.DataFrame(
                            {"annotation": annotations, "index": index}
                        )

                    except json.JSONDecodeError as e:
                        logger.error(
                            "JSON decode error in %s: %s", file_path, e, exc_info=True
                        )
                        raise OutputParsingError(
                            f"Malformed JSON in attribute output file: {file_path}"
                        ) from e

                    except (KeyError, TypeError) as e:
                        logger.error(
                            "Unexpected structure in %s: %s", file_path, e, exc_info=True
                        )
                        raise OutputParsingError(
                            f"Unexpected structure in attribute output file: {file_path}"
                        ) from e

            elif file == "dict.csv":
                dict_file_path = os.path.join(root, file)
                dict_data = pd.read_csv(dict_file_path)
                dict_data.columns = dict_data.columns.str.strip()

        if annotated_output is not None:
            logger.debug(
                "Annotated shape: %dx%d", annotated_output.shape[0], annotated_output.shape[1]
            )
        else:
            logger.debug("No annotated output found for folder '%s'", folder_name)

        logger.debug("Data dict size: %d", len(data_dict))

        if annotated_output is not None and dict_data is not None:
            annotated_output = annotated_output.drop_duplicates(
                subset="index", keep="first"
            )

            dict_out_merged = pd.merge(
                dict_data,
                annotated_output,
                left_on="unique_index",
                right_on="index",
                how="left",
            )

            dict_out_merged.fillna(0, inplace=True)
            data_dict[folder_name] = dict_out_merged["annotation"]

            # Count errors
            error_counts[folder_name] = (dict_out_merged["annotation"] == 1).sum()

        else:
            logger.warning(
                "Missing output or dict files for folder '%s', skipping.", folder_name
            )

    # Convert the dictionary to a DataFrame for the output annotations
    output = pd.DataFrame(data_dict)
    output = output[dataset.columns.str.strip()]  # Strip whitespace from columns
    output = output.astype(int)

    # Save the output DataFrame to CSV
    output.to_csv(os.path.join(directory, "output.csv"), index=False)

    # Create an error count DataFrame
    error_count_df = pd.DataFrame(
        list(error_counts.items()), columns=["column", "error_count"]
    )
    error_count_df = error_count_df.set_index("column")

    # Save the error count DataFrame to a separate CSV
    error_count_df.to_csv(os.path.join(directory, "column_summary.csv"))


def process_dependency_output(
    group_labels: list, dataset: pd.DataFrame, directory: str
):
    os.makedirs(directory, exist_ok=True)
    # Initialize a dictionary to hold unique dependencies
    dependencies_dict = defaultdict(set)
    prompt_metadata_list = []

    # Extract column names from the dataset for easy index-to-name mapping
    column_names = dataset.columns.tolist()

    for label in group_labels:
        dynamic_directory = os.path.join(
            directory, f"{label}/{label}/output.json"
        )

        if os.path.exists(dynamic_directory):
            with open(dynamic_directory, "r") as json_file:
                try:
                    json_data = json.load(json_file)

                    for item in json_data["output"]:
                        columns = item["columns"]
                        columns = list(map(int, columns))
                        if len(columns) < 2:
                            continue
                        # Emit one entry per unique pair within a multi-column dependency
                        for i in range(len(columns)):
                            for j in range(i + 1, len(columns)):
                                sorted_columns_tuple = tuple(sorted([columns[i], columns[j]]))
                                dependency_description = item["dependency"]
                                dependencies_dict[sorted_columns_tuple].add(
                                    dependency_description
                                )

                except json.JSONDecodeError as e:
                    logger.error(
                        "JSON decode error in %s: %s", dynamic_directory, e, exc_info=True
                    )
                except (KeyError, TypeError) as e:
                    logger.error(
                        "Unexpected structure in %s: %s", dynamic_directory, e, exc_info=True
                    )

        csv_file_path = os.path.join(
            directory, f"{label}/prompt_metadata.csv"
        )
        if os.path.exists(csv_file_path):
            try:
                csv_df = pd.read_csv(csv_file_path)
                if not csv_df.empty:
                    prompt_metadata_list.append(csv_df.iloc[0].to_dict())
            except Exception as e:
                logger.error(
                    "Error reading CSV file %s: %s", csv_file_path, e, exc_info=True
                )

    # Prepare the final list for DataFrame
    dependencies_list = []
    for columns, descriptions in dependencies_dict.items():
        column_1_index, column_2_index = columns
        column_1_name = column_names[column_1_index]
        column_2_name = column_names[column_2_index]
        first_description = next(iter(descriptions))

        dependencies_list.append(
            {
                "column_1": column_1_index,
                "column_2": column_2_index,
                "column_1_name": column_1_name,
                "column_2_name": column_2_name,
                "dependency": first_description,
            }
        )

    dependencies_list.sort(key=lambda x: (x["column_1"], x["column_2"]))

    dep_columns = ["column_1", "column_2", "column_1_name", "column_2_name", "dependency"]
    dependencies_df = pd.DataFrame(dependencies_list, columns=dep_columns) if dependencies_list else pd.DataFrame(columns=dep_columns)
    dependencies_df.to_csv(f"{directory}/output.csv", index=False)

    meta_columns = ["completion_tokens", "prompt_tokens", "total_tokens", "elapsed_time", "batches", "prompt_name"]
    if prompt_metadata_list:
        prompt_metadata_df = pd.DataFrame(prompt_metadata_list)
    else:
        logger.warning("No prompt metadata found to save for dependency output.")
        prompt_metadata_df = pd.DataFrame(columns=meta_columns)
    prompt_metadata_df.to_csv(f"{directory}/prompt_metadata.csv", index=False)


def process_dep_violations_output(dataset: pd.DataFrame, directory: str):
    os.makedirs(directory, exist_ok=True)
    # Initialize the DataFrame for annotations with the shape of the dataset, filled with zeros
    annotated_output = pd.DataFrame(0, index=dataset.index, columns=dataset.columns)

    # Extract column names for index-to-name mapping
    column_names = dataset.columns.tolist()

    # Dictionary to store error counts per dependency
    error_counts = {}

    # Loop through all subdirectories and files
    for root, dirs, files in os.walk(directory):
        dependency_name = os.path.basename(root)
        # Skip the root directory itself
        if root == directory:
            continue

        logger.debug("Processing dependency violations folder: %s", dependency_name)

        annotations_data = None
        dict_data = None

        for file in files:
            if file.endswith(".json"):
                file_path = os.path.join(root, file)
                with open(file_path, "r") as json_file:
                    try:
                        json_data = json.load(json_file)
                        annotations = [
                            item["annotation"] for item in json_data["output"]
                        ]
                        indices = [item["index"] for item in json_data["output"]]
                        columns = [item["column"] for item in json_data["output"]]

                        annotations_data = pd.DataFrame(
                            {
                                "annotation": annotations,
                                "index": indices,
                                "column": columns,
                            }
                        )

                    except json.JSONDecodeError as e:
                        logger.error(
                            "JSON decode error in %s: %s", file_path, e, exc_info=True
                        )

            elif file == "dict.csv":
                dict_file_path = os.path.join(root, file)
                try:
                    dict_data = pd.read_csv(dict_file_path)
                    dict_data.columns = dict_data.columns.str.strip()
                except Exception as e:
                    logger.error(
                        "Error reading dict.csv from %s: %s", dict_file_path, e, exc_info=True
                    )

        if annotations_data is not None and dict_data is not None:
            dict_out_merged = pd.merge(
                dict_data,
                annotations_data,
                left_on="unique_index",
                right_on="index",
                how="left",
            )

            dict_out_merged.fillna(0, inplace=True)

            if dependency_name not in error_counts:
                error_counts[dependency_name] = {}

            for _, row in dict_out_merged.iterrows():
                original_index = int(row["original_index"])
                annotation = row["annotation"]
                column = int(row["column"])

                if annotation == 1:
                    col_name = column_names[column]

                    annotated_output.at[original_index, col_name] = annotation

                    if col_name not in error_counts[dependency_name]:
                        error_counts[dependency_name][col_name] = 0
                    error_counts[dependency_name][col_name] += 1

    # Prepare error counts for output
    dependencies_list = []
    for dependency, col_counts in error_counts.items():
        col_names_sorted = sorted(col_counts.keys())

        if len(col_names_sorted) < 2:
            for col_name in column_names:
                if col_name not in col_counts:
                    col_counts[col_name] = 0
            col_names_sorted = sorted(col_counts.keys())[:2]

        col_1_name, col_2_name = col_names_sorted[:2]
        col_1_count = col_counts.get(col_1_name, 0)
        col_2_count = col_counts.get(col_2_name, 0)

        if col_1_count == 0 and col_2_count == 0:
            continue

        dependencies_list.append(
            {
                "column_1_name": col_1_name,
                "column_2_name": col_2_name,
                "column_1_count": col_1_count,
                "column_2_count": col_2_count,
                "dependency": dependency,
            }
        )

    summary_columns = ["column_1_name", "column_2_name", "column_1_count", "column_2_count", "dependency"]
    column_summary_df = pd.DataFrame(dependencies_list, columns=summary_columns) if dependencies_list else pd.DataFrame(columns=summary_columns)

    annotated_output.to_csv(f"{directory}/output.csv", index=False)
    column_summary_df.to_csv(f"{directory}/column_summary.csv", index=False)

    # prompt_metadata.csv is written directly by prompt_gpt (appended per dep call).
    # If no LLM calls were made (e.g. all deps skipped on resume), ensure the file
    # exists with headers so the endpoint can read it without error.
    meta_path = os.path.join(directory, "prompt_metadata.csv")
    if not os.path.exists(meta_path):
        meta_columns = ["completion_tokens", "prompt_tokens", "total_tokens", "elapsed_time", "batches", "prompt_name"]
        logger.warning("No prompt metadata found for dependency violations output — writing empty file.")
        pd.DataFrame(columns=meta_columns).to_csv(meta_path, index=False)


def process_combined_output(
    output_1: pd.DataFrame, output_2: pd.DataFrame, directory: str
):
    # Consolidate annotations: 1 if either dataset marks an error, else 0
    consolidated_data = pd.DataFrame(0, index=output_1.index, columns=output_1.columns)

    for col in output_1.columns:
        for index in output_1.index:
            error_1 = output_1.at[index, col]
            error_2 = output_2.at[index, col] if index < len(output_2) else 0

            if error_1 == 1 or error_2 == 1:
                consolidated_data.at[index, col] = 1
            else:
                consolidated_data.at[index, col] = 0

    # Save to CSV — directory here is the full dataset directory path
    consolidated_data.to_csv(
        os.path.join(directory, "consolidated_error_annotations.csv"), index=False
    )
