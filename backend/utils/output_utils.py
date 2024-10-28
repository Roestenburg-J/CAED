import os
import json
import pandas as pd


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
    output.to_csv("./output/attribute_output/output.csv", index=False)
