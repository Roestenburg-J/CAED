import logging

import pandas as pd
from collections import defaultdict
import ast

from utils.data_utils import create_row_dict
from utils.prompting_utils import prompt_gpt
from exceptions import DataValidationError

logger = logging.getLogger(__name__)

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

system_prompt = """You are a data quality expert specializing in detecting dependency violations in tabular datasets.

<task>
You will receive a JSON list of unique row combinations from two columns that are known to share a dependency. Each entry contains the values from both columns, an "index" identifier, and a "count" indicating how many times this combination appears in the full dataset. You will also receive a description of the dependency.

Your goal is to annotate every row as a violation or not, and propose a repair for each violation.
</task>

<definitions>
Dependency violation: A row where one or both values are inconsistent with the other under the stated dependency.
Count: How many times this row combination appears in the full dataset. Use frequency as context — rare combinations may warrant closer scrutiny, but low count alone is not sufficient evidence of a violation.
</definitions>

<rules>
1. Use the provided dependency description as the primary guide for what constitutes a violation.
2. Annotate every row without exception: annotation 1 = violation, annotation 0 = no violation.
3. Only violations require an explanation. Every explanation must include specific, verifiable evidence or a brief external reference when semantic knowledge is required.
4. For possible_repair, output only the corrected value string — nothing else.
5. Empty or null values in either column are not violations, including when both columns contain empty values simultaneously.
6. Check string values for misspellings or invalid characters that would cause a syntactic violation. Ignore capitalization differences when evaluating misspellings.
7. For proper nouns (names, brands, places), check for syntactic violations only — not semantic ones.
8. Explanations must be concise.
9. Before assessing individual rows, first read the dependency description carefully and identify what valid pairs look like.
</rules>

<violation_types>

1. Semantic violation
The meaning of a value contradicts what the stated dependency requires.

Example — dependency: Col 1 is a company name; Col 2 is its primary market sector:
Col 1         | Col 2
McDonald's    | Fast food            → 0
Baseball*     | Asset Management     → 1  ("Baseball" is not a recognizable company name)
Walmart       | Retail               → 0
Apple         | Consumer Technology  → 0
Google        | Food Wholesaler*     → 1  (Google operates in technology, not food wholesale)

2. Syntactic violation
A structural error in one value breaks the dependency relationship with its paired value.

Example — dependency: Col 7 is an employment code encoding role and hire year; Col 10 is its plain-text description:
Col 7          | Col 10
EMP-001-2024   | Employee - hired in 2024        → 0
CON-009-2005   | Contract worker - hired in 2005  → 0
EMP-00B-8888*  | Employee - hired in 2018         → 1  ("8888" is not a valid year)
CON-976-2013   | Employee - hired in 2013*        → 1  (code indicates contractor but description says Employee)

</violation_types>"""


def detect_dep_violations(
    dependencies_df: pd.DataFrame, dataset: pd.DataFrame, directory: str
):
    # Group the dependencies by the first index
    grouped_dependencies = defaultdict(list)

    for _, row in dependencies_df.iterrows():

        first_index = row["column_1"]  # Get the first index from the new structure
        grouped_dependencies[first_index].append(row)  # Group by first index

    # Process each group of dependencies based on the first index
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
                raise DataValidationError(f"Columns not found in dataset: {missing_columns}")

            # Select the columns by name
            selected_columns = dataset[selected_column_names]

            # Check for duplicates
            if selected_columns.drop_duplicates().shape[0] < dataset.shape[0]:

                row_dict, unique_rows = create_row_dict(selected_columns)

                # Update the columns for unique rows
                unique_rows.columns = [
                    str(dataset.columns.get_loc(columns[0])),  # Column 1 index
                    str(dataset.columns.get_loc(columns[1])),  # Column 2 index
                    "index",
                    "count",
                ]

                json_sample = unique_rows.to_json(orient="records", indent=4)

                user_prompt = f"""The dependency between the two columns is defined as follows:
{dependency_description}

Analyze the following unique row combinations and identify all violations:"""

                prompt_gpt(
                    system_prompt,
                    user_prompt,
                    f"{columns[0]}, {columns[1]}",
                    response_format,
                    directory,
                    row_dict,
                    json_str=json_sample,
                )
