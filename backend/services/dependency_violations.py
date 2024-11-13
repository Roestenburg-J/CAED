import pandas as pd
from collections import defaultdict
import ast
from flask import current_app

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

system_prompt = """Task:
You are given data from two columns in a dataset that are said to have a dependency on each other. You must detect violations in this dependency.
You are also given a description of the dependency that you must use to help identify violations.

Instructions:
For the possible repair provide the repair value, the column in which the violation occurred, the index, and an explanation for why it is considered an error.
Do not check for language usage errors.
Strings should be checked for misspellings of invalid/nonsensical characters that could cause violations.
Ignore capitalization when checking for misspellings.
Values that describe empty entries are not considered errors.
Two columns can both have values that indicate empty values, this is not considered an error.
When detecting violations, a valid proof needs to be supplied in the violation for why it is an error. 
When determining semantic dependencies and external knowledge is needed to prove the violation provide a short reference.
For proper nouns only check for syntactic dependency violations.
Explanations need to be concise.

Examples:
Dependency violations could be either semantic or syntactic violations. Use the dependency description to determine the violation.

1. Semantic Dependency
- The meaning of a value is not correct concerning dependent values considering the identified dependency.
Example:
Col 1 and Col 2 have a dependency between each other indicated by the name of a company (Col 1), and the primary market in which they operate (Col 2).
Col 1           , Col 2
McDonald's      , Fast food
Baseball*       , Asset Management
Wallmart        , Retail
Apple           , Consumer Technology
Google          , Food Wholesaler*

Baseball* is an error because it does not seem like the name of a company.
Food Wholesaler* is an error because Google is a Technology company and not a Food Wholesaler.

2. Syntactic dependency
- A syntactic dependency violation occurs when the syntax of an entry causes a violation of a dependency
Example:
Col 7 and Col 10 have a dependency. Col 7 is a list of codes describing the employment of people with the year they were hired. Col 10 is a textual description of the codes.
Col 7           , Col 10
EMP-001-2024    , Employee - hired in 2024
CON-009-2005    , Contract worker - hired in 2005
EMP-00B-8888*   , Employee - hired in 2018 
CON-976-2013    , Employee - hired in 2013*

EMP-00B-8888* is an error because it contains an invalid year date at the end of the entry.
Employee - hired in 2013* in an error because its corresponding code, which is valid indicates that it should be a contract worker.
"""


def detect_dep_violations(
    dependencies_df: pd.DataFrame, dataset: pd.DataFrame, directory: str
):
    # Group the dependencies by the first index
    grouped_dependencies = defaultdict(list)

    for _, row in dependencies_df.iterrows():

        first_index = row["column_1"]  # Get the first index from the new structure
        grouped_dependencies[first_index].append(row)  # Group by first index

    # Now process each group of dependencies based on the first index
    for first_index, dependencies in grouped_dependencies.items():

        selected_columns = [
            dataset.columns[first_index]
        ]  # Keep this if first_index is always an integer index

        for dep in dependencies:
            columns = [dep["column_1_name"], dep["column_2_name"]]
            dependency_description = dep["dependency"]

            # Select the column names directly since `columns` already has the names
            selected_column_names = columns

            # Verify that the selected columns actually exist in `dataset`
            missing_columns = [
                col for col in selected_column_names if col not in dataset.columns
            ]
            if missing_columns:
                raise ValueError(f"Columns not found in dataset: {missing_columns}")

            # Select the columns by name
            selected_columns = dataset[selected_column_names]

            # Check for duplicates
            if selected_columns.drop_duplicates().shape[0] < dataset.shape[0]:
                # Create the unique row dictionary using the previously defined create_row_dict function
                row_dict, unique_rows = create_row_dict(selected_columns)

                # Update the columns for unique rows
                unique_rows.columns = [
                    str(dataset.columns.get_loc(columns[0])),  # Column 1 index
                    str(dataset.columns.get_loc(columns[1])),  # Column 2 index
                    "index",
                ]

                json_sample = unique_rows.to_json(orient="records", indent=4)
                # current_app.logger.info(json_sample)

                # Prepare the user prompt with dependency and unique rows
                user_prompt = f"""Input:
  The dependency identified in this table is defined as follows:
  {dependency_description}

  The following is a formatted table with the unique data to be checked.
  """

                # Uncomment this to send the prompt to the GPT system
                prompt_gpt(
                    system_prompt,
                    user_prompt,
                    f"{columns[0]}, {columns[1]}",
                    response_format,
                    directory,
                    row_dict,
                    json_str=json_sample,
                )
