import json
import logging
import os
import random

import pandas as pd

from utils.data_utils import create_buckets
from utils.prompting_utils import prompt_gpt, load_settings

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


def _group_buckets_by_tokens(
    sampled_bucket_data: list,
    max_batch_tokens: int,
) -> list:
    """
    Group (bucket_index, sampled_records) pairs into batches so that each
    batch's combined JSON payload stays within *max_batch_tokens* tokens
    (estimated as ``len(json.dumps(batch)) // 4``).

    Returns a list of groups; each group is a list of
    (bucket_index, sampled_records) tuples.
    """
    groups = []
    current_group = []
    current_tokens = 0

    for bucket_index, sampled_records in sampled_bucket_data:
        bucket_tokens = len(json.dumps(sampled_records)) // 4

        # Single bucket already exceeds the ceiling — emit it alone.
        if bucket_tokens >= max_batch_tokens:
            if current_group:
                groups.append(current_group)
                current_group = []
                current_tokens = 0
            groups.append([(bucket_index, sampled_records)])
            continue

        # Adding this bucket would exceed the ceiling — flush first.
        if current_tokens + bucket_tokens > max_batch_tokens and current_group:
            groups.append(current_group)
            current_group = []
            current_tokens = 0

        current_group.append((bucket_index, sampled_records))
        current_tokens += bucket_tokens

    if current_group:
        groups.append(current_group)

    return groups


def dependency_detection(
    dataset: pd.DataFrame, filtered_top_buckets, buckets, directory: str
) -> list:
    """
    Detect column dependencies across MinHash buckets and return the list of
    group labels written to *directory*.

    Changes versus the previous implementation
    -------------------------------------------
    * Each bucket is **randomly sampled** to at most ``max_dependency_bucket_rows``
      rows before being sent to the LLM.
    * Multiple buckets are **merged into a single prompt** when their combined
      token estimate fits within ``max_batch_tokens``, reducing the total number
      of LLM calls from one-per-bucket to one-per-merged-group.
    """
    if not filtered_top_buckets:
        logger.info("No suitable record buckets found for dependency detection; skipping.")
        return []

    settings = load_settings()
    max_batch_tokens = int(settings.get("max_batch_tokens", 3000))
    max_rows_per_bucket = int(settings.get("max_dependency_bucket_rows", 20))

    records = dataset.values.tolist()

    # ------------------------------------------------------------------
    # Step 1: Sample each bucket and build per-bucket JSON record lists.
    # ------------------------------------------------------------------
    sampled_bucket_data = []
    for bucket_index, _ in filtered_top_buckets:
        bucket_row_indices = buckets[bucket_index]

        if len(bucket_row_indices) > max_rows_per_bucket:
            sampled_indices = random.sample(bucket_row_indices, max_rows_per_bucket)
        else:
            sampled_indices = list(bucket_row_indices)

        sampled_rows = [records[i] for i in sampled_indices]
        sampled_df = pd.DataFrame(sampled_rows)
        sampled_df.columns = range(sampled_df.shape[1])
        sampled_records = json.loads(sampled_df.to_json(orient="records"))
        sampled_bucket_data.append((bucket_index, sampled_records))

    logger.debug(
        "dependency_detection: %d buckets sampled (max %d rows each)",
        len(sampled_bucket_data), max_rows_per_bucket,
    )

    # ------------------------------------------------------------------
    # Step 2: Group buckets so each group fits within the token budget.
    # ------------------------------------------------------------------
    groups = _group_buckets_by_tokens(sampled_bucket_data, max_batch_tokens)

    logger.debug(
        "dependency_detection: %d buckets merged into %d groups (budget %d tokens)",
        len(sampled_bucket_data), len(groups), max_batch_tokens,
    )

    # ------------------------------------------------------------------
    # Step 3: One LLM call per group.
    # ------------------------------------------------------------------
    group_labels = []
    for group_idx, group in enumerate(groups):
        combined_records = []
        for _, sampled_records in group:
            combined_records.extend(sampled_records)

        group_label = f"group_{group_idx}"
        group_labels.append(group_label)
        group_dir = os.path.join(directory, group_label)
        os.makedirs(group_dir, exist_ok=True)

        combined_json = json.dumps(combined_records)
        dataset_sample = pd.DataFrame(combined_records)
        if not dataset_sample.empty:
            dataset_sample.columns = range(dataset_sample.shape[1])

        user_prompt = "Analyze the following records and identify all column dependencies:"

        prompt_gpt(
            system_prompt,
            user_prompt,
            group_label,
            response_format,
            group_dir,
            dataset_sample,
            json_str=combined_json,
        )

    return group_labels
