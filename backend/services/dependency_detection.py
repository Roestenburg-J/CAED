import logging

import pandas as pd
import os

from utils.data_utils import create_buckets
from utils.prompting_utils import prompt_gpt

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
                            "columns": {
                                "type": "array",
                                "items": {"type": "number"},
                                "description": "An array of columns that might share a dependency.",
                            },
                            "dependency": {
                                "type": "string",
                                "description": "A description of the dependency between the identified columns.",
                            },
                        },
                        "required": ["columns", "dependency"],
                        "additionalProperties": False,
                    },
                },
            },
            "required": ["output"],
            "additionalProperties": False,
        },
    },
}

system_prompt = """You are a database schema analyst specializing in identifying functional dependencies between columns in relational data.

<task>
You will receive a JSON sample of similar records from a dataset, where columns are identified by numeric index. Your goal is to identify pairs of columns that exhibit a dependency — where the value of one column constrains or determines the value of the other.
</task>

<rules>
1. Output only column pairs that share a dependency. Report each dependency as a separate output entry.
2. If one column participates in multiple dependencies, produce a separate entry for each.
3. Never report a dependency between a column and itself.
4. Never report single-column dependencies.
5. Describe each dependency in terms of what the column values represent — not the column numbers or labels. Focus on meaning and structure.
6. If a structural or syntactic pattern links two columns, describe that pattern explicitly.
7. Before identifying dependencies, first read through all records to understand what each column represents.
</rules>

<dependency_types>

1. Semantic dependency
The meaning of values in one column determines or constrains the meaning of values in another.

Example — country and capital city:
Col 1 (country)           | Col 2 (capital city)
Great Britain             | London
United States of America  | Washington DC
South Africa              | Pretoria
→ Dependency: The capital city in Col 2 is the capital of the country named in Col 1.

2. Syntactic dependency
A structural pattern in one column encodes or determines the content of another.

Example — incident codes and descriptions:
Col 1       | Col 2
FRE-003_a   | Forest fire with damages above $2,000
FLD-001_z   | Floods that destroyed local buildings
ERQ-777_n   | Earthquakes that caused power outages
HUR-008_t   | Hurricanes that were able to breach sea walls
→ Dependency: The three-letter prefix in Col 1 encodes the incident category described in Col 2.

</dependency_types>"""


def dependency_detection(
    dataset: pd.DataFrame, filtered_top_buckets, buckets, directory: str
):
    if not filtered_top_buckets:
        logger.info("No suitable record buckets found for dependency detection; skipping.")
        return

    records = dataset.values.tolist()

    for bucket_index, _ in filtered_top_buckets:
        dynamic_directory = os.path.join(
            directory,
            f"bucket_{bucket_index}",
        )

        os.makedirs(dynamic_directory, exist_ok=True)

        current_bucket_records = [records[i] for i in buckets[bucket_index]]

        dataset_sample = pd.DataFrame(current_bucket_records)
        dataset_sample.columns = range(dataset_sample.shape[1])

        json_sample = dataset_sample.to_json(orient="records", indent=4)

        user_prompt = f"""Analyze the following records and identify all column dependencies:"""

        prompt_gpt(
            system_prompt,
            user_prompt,
            f"bucket_{bucket_index}",
            response_format,
            dynamic_directory,
            dataset_sample,
            json_str=json_sample,
        )
