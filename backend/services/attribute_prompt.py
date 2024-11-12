import pandas as pd
from utils.prompting_utils import prompt_gpt
from utils.data_utils import create_attribute_dict

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

numeric_prompt = """You are given a list of numeric values with their corresponding index. You have to identify all errors in the list.
"""

text_prompt = """You are given a list of unique values in a column with their corresponding index. You have to find all syntactic errors in the dataset and recommend a possible repair.
A syntactic error occurs when a value does not conform to the structure or domain of correct values. The domain and structure of correct values have to be derived from the values themselves.
A semantic error occurs when a value falls outside of the reasonable context of a column. Use the context description to determine if a value is a semantic error.
You have to annotate an error with a '1' in the output.
For the possible repair only provide the reparied value is output.
You also have to provide a brief explanation referencing the examples a proof for each annotation.
Values denoting empty or null values can be found in any given context, and are considered correct.
Note! Only check for syntactic errors. Do not check for language errors.

Syntactic deviations can be one of the following examples
1. Invalid characters
- Characters appear in values that do not often appear in others or make them uninterpretable
Example 1
1, John = 0
2, Greg = 0
3, Frank15 = 1

Example 2 
15, Apple = 0
16, Pxar = 1
17, Banana = 0

2. Misspelling
- Words that are misspelled. Values that are considered names are less likely to be misspelt.
Example 1
2, Blue = 0
3, Green = 0
4, Orage = 1

Example 2 
67, Reservation for two people near the window = 0
68, Reservatton for five poeple at the entrance = 1
69, Three humans arriving at 9 for drinks = 0
70, A single peersonn at three = 1

3. Pattern non-conformity
- Some values may have a common pattern with certain values deviating from this pattern. There might exist more than one valid pattern in a single attribute.
Possible repairs should attempt to conform with the most prevalent patterns. Removing a pattern does not constitute a soluition.
Example 1
32, 2024/03/12 19:00 = 0
33, 2024-12-31 12:00 = 1
34, 1994/01/13 15:15 = 0
35, 12:00am 3 January 2024 = 1

Example 2
70, Admin123 = 0
71, Bob443 = 0
72, 99Alex = 1
"""


def attribute_prompt(dataset: pd.DataFrame, directory: str) -> str:
    for col in dataset.columns:
        attribute = pd.DataFrame(dataset[col].copy())

        attribute_dict, attribute_unique = create_attribute_dict(attribute, col)

        if attribute[attribute.columns[0]].dtype == object:
            system_prompt = text_prompt
        else:
            system_prompt = numeric_prompt

        attribute_unique.columns = ["value", "index"]
        json_sample = attribute_unique.to_json(orient="records", indent=4)

        user_prompt = f"""Input:"""
        # directory = r"D:\Documents\UU\Thesis\Artifact\CAED\dataset_analyzer\notebook\output\attribute_output"

        prompt_gpt(
            system_prompt,
            user_prompt,
            col,
            response_format,
            directory,
            attribute_dict,
            json_sample,
        )

    return "Attribute level errors detected!"
