import pandas as pd
import os

from utils.data_utils import create_buckets
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

system_prompt = """Task:
You are given a sample of similar records from a relational database. You must determine which columns have dependencies between them. 

Instructions:
For the output, only provide pairs of columns that might have dependencies. If multiple dependencies exist with a single column, provide more than one output for that column.
Do not check for dependencies between a column and itself.
Describe the dependency between columns clearly and completely.
Do not attempt to name a column, rather provide a description of its meaning or structure.
If a pattern is found in the data, provide a description.
Do not detect single column dependencies.

Examples:
Dependencies can occur in two ways.

1. Semantic dependency
- The meaning of the values of one column determines the meaning of another. 
Example:
One column represents cities and another country. This may indicate that there is a dependency between the two columns and that the cities column, contains cities that are present in that country.
Col 1                   , Col 2
Great Britain           , London
United States of America, Washington DC
South Africa            , Pretoria

2. Syntactic Dependency
- One column may have a syntactic pattern, which is based on, or determines the meaning of another column. 
Example:
One column represents emergency codes and the other emergency descriptions.
Col 1      , Col 2
FRE-003_a  , Forrest fire with damages above $2,000
FLD-001_z  , Floods that destroyed local buildings
ERQ-777_n  , Earthquakes that caused power outages 
HUR-008_t  , Hurricanes that were able to breach sea walls
"""


def dependency_detection(
    dataset: pd.DataFrame, filtered_top_buckets, buckets, directory: str
):

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

        user_prompt = f"""Input:"""

        # Call your prompt_gpt function with the dynamic directory
        prompt_gpt(
            system_prompt,
            user_prompt,
            f"bucket_{bucket_index}",
            response_format,
            dynamic_directory,
            dataset_sample,
            json_str=json_sample,
        )
