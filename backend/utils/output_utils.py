import os
import json
import pandas as pd
from collections import defaultdict
from flask import current_app


def process_attribute_output(dataset: pd.DataFrame, directory: str) -> None:
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

        annotated_output = None
        dict_data = None

        for file in files:
            if file.endswith(".json"):
                # Construct the full file path
                file_path = os.path.join(root, file)

                # Open and load the JSON file
                with open(file_path, "r") as json_file:
                    try:
                        json_data = json.load(json_file)
                        # Retrieve the annotation and index from the json output and create a dataframe
                        annotations = [
                            item["annotation"] for item in json_data["output"]
                        ]
                        index = [item["index"] for item in json_data["output"]]

                        annotated_output = pd.DataFrame(
                            {"annotation": annotations, "index": index}
                        )

                    except json.JSONDecodeError as e:
                        print(f"Error decoding JSON from file {file_path}: {e}")
                    except Exception as e:
                        print(f"Error reading file {file_path}: {e}")

            elif file == "dict.csv":
                dict_file_path = os.path.join(root, file)
                try:
                    dict_data = pd.read_csv(dict_file_path)
                    dict_data.columns = dict_data.columns.str.strip()
                except Exception as e:
                    print(f"Error reading dict.csv from file {dict_file_path}: {e}")

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
            )  # Join unique indices to the original values

            dict_out_merged.fillna(0, inplace=True)
            data_dict[folder_name] = dict_out_merged["annotation"]

            # Count errors (assume error is when annotation == 0)
            error_counts[folder_name] = (dict_out_merged["annotation"] == 1).sum()

        else:
            print(f"Missing files for folder {folder_name}")

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


import json
import os
import pandas as pd
from collections import defaultdict


def process_dependency_output(
    filtered_top_buckets, dataset: pd.DataFrame, directory: str
):
    # Initialize a dictionary to hold unique dependencies
    dependencies_dict = defaultdict(set)
    prompt_metadata_list = []

    # Extract column names from the dataset for easy index-to-name mapping
    column_names = dataset.columns.tolist()

    # Assuming you have a list of dynamic directories for each bucket
    for bucket_index, _ in filtered_top_buckets:
        # Construct the directory for the current bucket
        dynamic_directory = os.path.join(
            directory, f"bucket_{bucket_index}/bucket_{bucket_index}/output.json"
        )

        # Check if the JSON file exists before trying to read it
        if os.path.exists(dynamic_directory):
            with open(dynamic_directory, "r") as json_file:
                try:
                    json_data = json.load(json_file)

                    # Retrieve the annotations and create a list of tuples for dependencies
                    for item in json_data["output"]:
                        columns = item["columns"]
                        # Ensure columns are integers
                        columns = list(map(int, columns))  # Convert all to int
                        # Sort the columns numerically to ensure the order is consistent
                        sorted_columns_tuple = tuple(sorted(columns))
                        dependency_description = item["dependency"]

                        # Store the dependency description in the set for this tuple of columns
                        dependencies_dict[sorted_columns_tuple].add(
                            dependency_description
                        )

                except json.JSONDecodeError as e:
                    print(f"Error decoding JSON from file {dynamic_directory}: {e}")

                except Exception as e:
                    print(f"Error reading file {dynamic_directory}: {e}")

        # Read the prompt_metadata from the CSV file in the current bucket
        csv_file_path = os.path.join(
            directory, f"bucket_{bucket_index}/prompt_metadata.csv"
        )
        if os.path.exists(csv_file_path):
            try:
                # Read the CSV and extract the first row after the header
                csv_df = pd.read_csv(csv_file_path)
                # Check if the DataFrame is not empty
                if not csv_df.empty:
                    # Get the first row as a dictionary and append to the metadata list
                    prompt_metadata_list.append(csv_df.iloc[0].to_dict())
            except Exception as e:
                print(f"Error reading CSV file {csv_file_path}: {e}")

    # Prepare the final list for DataFrame
    dependencies_list = []
    for columns, descriptions in dependencies_dict.items():
        # Convert column indexes to column names
        column_1_index, column_2_index = columns  # Unpack the two columns
        column_1_name = column_names[column_1_index]
        column_2_name = column_names[column_2_index]
        first_description = next(
            iter(descriptions)
        )  # Extract the first item from the set

        dependencies_list.append(
            {
                "column_1": column_1_index,  # First column index
                "column_2": column_2_index,  # Second column index
                "column_1_name": column_1_name,  # First column name
                "column_2_name": column_2_name,  # Second column name
                "dependency": first_description,  # Store only the first description
            }
        )

    # Sort dependencies list first by the first column, then by the second column
    dependencies_list.sort(key=lambda x: (x["column_1"], x["column_2"]))

    # Create a DataFrame from the sorted unique dependencies
    dependencies_df = pd.DataFrame(dependencies_list)

    # Save the sorted dependencies DataFrame to a CSV file
    dependencies_df.to_csv(f"{directory}/output.csv", index=False)

    # Create a DataFrame from the collected prompt metadata
    if prompt_metadata_list:
        prompt_metadata_df = pd.DataFrame(prompt_metadata_list)
        # Save the combined prompt metadata DataFrame to a CSV file
        prompt_metadata_df.to_csv(f"{directory}/prompt_metadata.csv", index=False)
    else:
        print("No prompt metadata found to save.")


def process_dep_violations_output(dataset: pd.DataFrame, directory):
    # Assuming the original DataFrame structure is known
    original_dataframe = dataset

    # Initialize the DataFrame with zeros, same shape as original dataframe
    annotated_output = pd.DataFrame(
        0, index=original_dataframe.index, columns=original_dataframe.columns
    )

    # Dictionary to store error counts per dependency (folder name) and per column
    error_counts = {}

    # Loop through all subdirectories and files
    for root, dirs, files in os.walk(directory):
        # Get the folder name (acting as the dependency identifier)
        dependency_name = os.path.basename(root)

        # Skip the root directory itself (attribute_output)
        if root == directory:
            continue

        # Variables to store JSON and dictionary data
        annotations_data = None
        dict_data = None

        for file in files:
            if file.endswith(".json"):
                # Construct the full file path for JSON
                file_path = os.path.join(root, file)

                # Open and load the JSON file
                with open(file_path, "r") as json_file:
                    try:
                        json_data = json.load(json_file)

                        # Retrieve the annotation, index, and column from the JSON output
                        annotations = [
                            item["annotation"] for item in json_data["output"]
                        ]
                        indices = [item["index"] for item in json_data["output"]]
                        columns = [item["column"] for item in json_data["output"]]

                        # Create a DataFrame for the JSON annotations
                        annotations_data = pd.DataFrame(
                            {
                                "annotation": annotations,
                                "index": indices,
                                "column": columns,
                            }
                        )

                    except json.JSONDecodeError as e:
                        print(f"Error decoding JSON from file {file_path}: {e}")
                    except Exception as e:
                        print(f"Error reading file {file_path}: {e}")

            elif file == "dict.csv":
                # Construct the full file path for dict.csv
                dict_file_path = os.path.join(root, file)
                try:
                    # Read the dict.csv file into a DataFrame
                    dict_data = pd.read_csv(dict_file_path)
                    dict_data.columns = dict_data.columns.str.strip()

                except Exception as e:
                    print(f"Error reading dict.csv from file {dict_file_path}: {e}")

        # Ensure both annotation data and dictionary data are available
        if annotations_data is not None and dict_data is not None:
            # Merge the annotation data (based on the index) with the dictionary data (unique_index mapping)
            dict_out_merged = pd.merge(
                dict_data,
                annotations_data,
                left_on="unique_index",  # Use the unique index from dict.csv
                right_on="index",  # Match with index in the annotation data
                how="left",
            )

            # Replace NaN annotations with 0
            dict_out_merged.fillna(0, inplace=True)

            # Initialize error count for this dependency if not already present
            if dependency_name not in error_counts:
                error_counts[dependency_name] = {
                    col: 0 for col in original_dataframe.columns
                }

            # Process the detailed annotation matching to the original dataframe
            for _, row in dict_out_merged.iterrows():
                original_index = int(
                    row["original_index"]
                )  # Ensure original index is an integer
                annotation = row["annotation"]
                column = int(row["column"])  # Ensure the column is integer

                if annotation == 1:  # Only proceed if there's an error annotation
                    # Update the annotated_output DataFrame at the specific cell
                    col_name = original_dataframe.columns[
                        column
                    ]  # Get column name based on column index
                    annotated_output.at[original_index, col_name] = annotation

                    # Increment error count for this column in the dependency
                    error_counts[dependency_name][col_name] += 1

        else:
            print(f"Missing files for folder {dependency_name}")

    # Save the annotated DataFrame to CSV
    annotated_output.to_csv(f"{directory}/output.csv", index=False)

    # Convert error counts to a DataFrame for saving
    error_count_df = (
        pd.DataFrame.from_dict(error_counts, orient="index").fillna(0).astype(int)
    )
    error_count_df.index.name = "Dependency"

    # Save the error count DataFrame to a separate CSV
    error_count_df.to_csv(f"{directory}/column_summary.csv")


def process_combined_output(
    output_1: pd.DataFrame, output_2: pd.DataFrame, directory: str
):
    # Ensure both datasets have the same structure (columns and index)
    # Initialize a consolidated DataFrame with the same shape as the original datasets
    consolidated_data = pd.DataFrame(0, index=output_1.index, columns=output_1.columns)

    # Loop through the indices and columns to consolidate annotations in place
    for col in output_1.columns:
        for index in output_1.index:
            # Check if the current index has an error in dataset 1
            error_1 = output_1.at[index, col]
            error_2 = (
                output_2.at[index, col] if index < len(output_2) else 0
            )  # Handle cases where index exceeds

            # Logic to consolidate annotations
            if error_1 == 1 or error_2 == 1:  # If either dataset has an error
                consolidated_data.at[index, col] = 1  # Mark as error
            else:
                consolidated_data.at[index, col] = 0  # No error

    # Save to CSV
    consolidated_data.to_csv(
        f"./data/{directory}/consolidated_error_annotations.csv", index=False
    )
