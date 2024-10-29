import pandas as pd
from collections import defaultdict
import ast


from utils.data_utils import create_row_dict
from utils.prompting_utils import prompt_gpt

response_format = {
    "type": "json_schema",
    "json_schema": {
        "name": "math_response",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "output": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "explanation": {
                                "type": "string",
                                "description": "The explanation for why a value is considered an error",
                            },
                            "index": {
                                "type": "number",
                                "description": "The index in the list where the value occurs",
                            },
                            "column": {
                                "type": "number",
                                "description": "The column where the violation occured",
                            },
                            "annotation": {
                                "type": "number",
                                "description": "The annotation denoting whether a value is an error or not",
                                "enum": [1, 0],
                            },
                            "possible_repair": {"type": "string"},
                        },
                        "required": [
                            "explanation",
                            "index",
                            "annotation",
                            "possible_repair",
                            "column",
                        ],
                        "additionalProperties": False,
                    },
                },
            },
            "required": ["output"],
            "additionalProperties": False,
        },
    },
}

system_prompt = """You are given data from columns in a dataset that is said to have a dependency between each other. You have to detect violations in this dependency.

You are also given a description of the dependency that you can use to help you identify violations.

For the possible repair provide only the repair value. The error value and column is the value that is abnormal and that causes the violation.

Dependecy violations could be either semantic or syntactic violations. Use the dependency description to determine the violation. Do not check for language usage errors.

"""


def detect_dep_violations(
    dependencies_df: pd.DataFrame, dataset: pd.DataFrame, directory: str
):
    # Group the dependencies by the first index
    grouped_dependencies = defaultdict(list)

    for _, row in dependencies_df.iterrows():
        if isinstance(row["columns"], str):
            row["columns"] = ast.literal_eval(
                row["columns"]
            )  # Safely parse string to tuple

        first_index = row["columns"][0]  # Get the first index of the pair
        grouped_dependencies[first_index].append(row)  # Group by first index

    # Now process each group of dependencies based on the first index
    for first_index, dependencies in grouped_dependencies.items():

        selected_columns = [
            dataset.columns[first_index]
        ]  # Select columns based on the first index

        for dep in dependencies:
            columns = dep["columns"]
            dependency_description = dep["dependency"]
            try:
                selected_column_names = [dataset.columns[i] for i in columns]
            except IndexError:
                raise ValueError(
                    f"Column index out of range in dataset for columns: {columns}"
                )

            # Select the columns by name
            selected_columns = dataset[selected_column_names]

            # Check if there are duplicates
            if selected_columns.drop_duplicates().shape[0] < dataset.shape[0]:
                # Create the unique row dictionary using the previously defined create_row_dict function
                row_dict, unique_rows = create_row_dict(selected_columns)

                # Prepare the data to prompt for each unique row combination
                # data_columns = unique_rows.drop("original_index", axis=1)

                unique_rows.columns = [
                    str(columns[0]),
                    str(columns[1]),
                    "index",
                ]

                json_sample = unique_rows.to_json(orient="records", indent=4)

                # Prepare the user prompt with dependency and unique rows
                user_prompt = f"""Input:
  The dependency identified in this table is defined as follows:
  {dependency_description}

  The following is a formatted table with the unique data to be checked.
  {json_sample}
  """

                # Uncomment this to send the prompt to the GPT system
                prompt_gpt(
                    system_prompt,
                    user_prompt,
                    str(columns),
                    response_format,
                    directory,
                    row_dict,
                )