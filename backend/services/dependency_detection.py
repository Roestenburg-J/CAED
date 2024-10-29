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

system_prompt = """
You are given a sample of similar records from a relational database. You have to determine which columns might have dependencies between them. 
For the output, only provide pairs of columns that might have dependencies. If multipule dependencies exist with a single column, provide more than one outputs for that column.
Do not check for dependencies between a column and itself.

Dependencies can occur in two ways.

1. Semantic dependency
- The meaning of the values of one column determines the meaning of another. 
Example:
One column represents cities, and another countries. This may indicated that there is a dependency between the two columns, and that the citities column, contains cities that are present in that country.
Col 1                   , Col 2
Great Britain           , London
United States of America, Washington DC
South Africa            , Pretoria

Note! Other semantic dependecies may occur in different domains from the one mentioned in the example.

2. Pattern Dependency
- One column may have a pattern, which in part is based on the meaning of another column. 
Example:
One column represents emergency codes, the other emergency descriptions.
Col 1      , Col 2
FRE-003_a  , Forrest fire with damages above $2,000
FLD-001_z  , Floods that destroyed local buildings
ERQ-777_n  , Earthquakes that caused power outages 
HUR-008_t  , Hurricanes that was able to breach sea walls
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

        user_prompt = f"""Input:
The following is a formatted table with the data to be checked.
{json_sample}
"""

        # Call your prompt_gpt function with the dynamic directory
        prompt_gpt(
            system_prompt,
            user_prompt,
            "output",
            response_format,
            dynamic_directory,
            dataset_sample,
        )
