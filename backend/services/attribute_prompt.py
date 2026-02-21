import json
import pandas as pd
from utils.prompting_utils import prompt_gpt, load_settings
from utils.data_utils import create_attribute_dict, create_attribute_value_buckets

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

numeric_prompt = """No Action required.
"""

text_prompt = """You are a data quality expert specializing in detecting syntactic errors in tabular datasets.

<task>
You will receive a JSON list of unique values from a single column. Each entry contains:
- "index": a unique identifier for the value
- "value": the string value to assess
- "count": how many times this value appears in the full column

Your goal is to annotate every value as an error or not, and propose a repair for each error.
</task>

<definitions>
Syntactic error: A value that does not conform to the structure or domain established by the other values in the column. Derive the expected domain and structure from the values themselves — do not rely on external knowledge.
Count: Use occurrence frequency as context. Rare values may warrant closer scrutiny, but low count alone is not sufficient evidence of an error.
</definitions>

<rules>
1. Annotate every value without exception: annotation 1 = error, annotation 0 = not an error.
2. Only errors require an explanation. Explanations must be concise and cite specific evidence from other values in the input list.
3. For possible_repair, output only the corrected value string — nothing else.
4. Null and empty values are always valid (annotation: 0).
5. Do not flag grammar or language-style errors.
6. For proper nouns (names, brands, places), check for syntactic errors only — not semantic ones.
7. Names may contain non-ASCII characters (e.g. é, ç) — these are valid and must not be flagged.
8. Before assessing individual values, first observe the overall pattern and domain established by the full list.
</rules>

<error_types>

1. Invalid characters
Characters appear in a value that are absent from most others, making the value malformed or uninterpretable in its column context.

Example A — first names:
[1] John → 0
[2] Greg → 0
[3] Frank15 → 1  (digits do not appear in other names)

Example B — product names:
[15] Apple → 0
[16] Pxar → 1  (non-word characters that make the value uninterpretable)
[17] Banana → 0

2. Misspelling
A word is spelled incorrectly. For proper nouns, only flag misspellings where the correct form is unambiguous (e.g. well-known brand or place names). In long strings, check every word.

Example A — colors:
[2] Blue → 0
[3] Green → 0
[4] Orage → 1  (misspelling of "Orange")

Example B — reservation notes:
[67] Reservation for two people near the window → 0
[68] Reservatton for five poeple at the entrance → 1  ("Reservatton", "poeple" are misspelled)
[69] Three humans arriving at 9 for drinks → 0
[70] A single peersonn at three → 1  ("peersonn" is a misspelling of "person")

3. Pattern non-conformity
Values in the column follow a common structural pattern; this value deviates from it. Proposed repairs must conform to the most prevalent pattern. Consistent suffixes (units, percentages) are permitted but must be uniform.

Example A — timestamps:
[32] 2024/03/12 19:00 → 0
[33] 2024-12-31 12:00 → 1  (uses "-" separators; pattern is "YYYY/MM/DD HH:MM")
[34] 1994/01/13 15:15 → 0
[35] 12:00am 3 January 2024 → 1  (completely different format)

Example B — user IDs:
[70] Admin123 → 0
[71] Bob443 → 0
[72] 99Alex → 1  (numeric prefix violates the [Name][Number] pattern)

</error_types>"""


def attribute_prompt(dataset: pd.DataFrame, directory: str) -> str:
    settings = load_settings()
    minhash_threshold = float(settings.get("minhash_attribute_threshold", settings.get("minhash_threshold", 0.5)))
    minhash_num_perm = int(settings.get("minhash_attribute_num_perm", settings.get("minhash_num_perm", 128)))

    for col in dataset.columns:
        attribute = pd.DataFrame(dataset[col].copy())

        attribute_dict, attribute_unique = create_attribute_dict(attribute, col)

        attribute_unique.columns = ["value", "index", "count"]
        json_sample = attribute_unique.to_json(orient="records", indent=4)

        user_prompt = f"""Analyze the following unique values and identify all errors:"""

        if attribute[attribute.columns[0]].dtype == object:
            system_prompt = text_prompt

            # Build MinHash buckets of similar values so each LLM call receives
            # a coherent group rather than an arbitrary slice.
            value_buckets = create_attribute_value_buckets(
                attribute_unique, minhash_threshold, minhash_num_perm
            )
            records = json.loads(json_sample)
            custom_batches = [
                [records[i] for i in bucket]
                for bucket in value_buckets
                if bucket
            ]
        else:
            custom_batches = None
            if (
                attribute[attribute.columns[0]].unique().shape[0]
                == attribute[attribute.columns[0]].shape[0]
            ):
                system_prompt = numeric_prompt
                json_sample = '{"no_records": "empty"}'

        prompt_gpt(
            system_prompt,
            user_prompt,
            col,
            response_format,
            directory,
            attribute_dict,
            json_sample,
            custom_batches=custom_batches,
        )

    return "Attribute level errors detected!"
