import os
import json
import pandas as pd
from collections import defaultdict
from flask import current_app


def process_attribute_output(dataset: pd.DataFrame, directory: str) -> None:
    # Initialize an empty dictionary to store data for each folder
    data_dict = {}

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
        else:
            print(f"Missing files for folder {folder_name}")

    # Convert the dictionary to a DataFrame
    output = pd.DataFrame(data_dict)
    output = output[dataset.columns.str.strip()]  # Strip whitespace from columns
    output = output.astype(int)

    # Ensure the output directory exists
    output_directory = "./data/output/attribute"
    os.makedirs(output_directory, exist_ok=True)

    # Save the output DataFrame to CSV
    output.to_csv(os.path.join(output_directory, "output.csv"), index=False)


def process_dependency_output(filtered_top_buckets):
    # current_app.logger.info(filtered_top_buckets)

    # Initialize a dictionary to hold unique dependencies
    dependencies_dict = defaultdict(set)

    # Assuming you have a list of dynamic directories for each bucket
    for bucket_index, _ in filtered_top_buckets:
        # Construct the directory for the current bucket
        dynamic_directory = os.path.join(
            r"./data/output/dependency/",
            f"bucket_{bucket_index}/output/output.json",
        )

        # Check if the JSON file exists before trying to read it
        if os.path.exists(dynamic_directory):
            with open(dynamic_directory, "r") as json_file:
                try:
                    json_data = json.load(json_file)

                    # Retrieve the annotations and create a list of tuples for dependencies
                    for item in json_data["output"]:
                        columns = item["columns"]
                        # Sort the columns numerically to ensure the order is consistent
                        sorted_columns_tuple = tuple(
                            sorted(columns, key=int)
                        )  # Sort numerically
                        dependency_description = item["dependency"]

                        # Store the dependency description in the set for this tuple of columns
                        dependencies_dict[sorted_columns_tuple].add(
                            dependency_description
                        )

                except json.JSONDecodeError as e:
                    print(f"Error decoding JSON from file {dynamic_directory}: {e}")

                except Exception as e:
                    print(f"Error reading file {dynamic_directory}: {e}")

    # Prepare the final list for DataFrame
    dependencies_list = []
    for columns, descriptions in dependencies_dict.items():

        first_description = next(
            iter(descriptions)
        )  # Extract the first item from the set
        dependencies_list.append(
            {
                "columns": list(columns),  # Convert back to list for the DataFrame
                "dependency": first_description,  # Store only the first description
                # "dependency": list(descriptions),  # Store all descriptions as a list
            }
        )

    # Sort dependencies list first by the first column, then by the second column
    dependencies_list.sort(key=lambda x: (x["columns"][0], x["columns"][1]))

    # Create a DataFrame from the sorted unique dependencies
    dependencies_df = pd.DataFrame(dependencies_list)

    # Save the sorted dependencies DataFrame to a CSV file
    dependencies_df.to_csv("./data/output/dependency/dependencies.csv", index=False)
