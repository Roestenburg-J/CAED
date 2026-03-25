import json
import logging
import time
from typing import Dict, List

import pandas as pd

from llm.factory import LLMProviderFactory
from llm.schemas import LLMRequest, Message
from utils.data_utils import create_row_dict
from utils.prompting_utils import load_settings, write_output, write_prompt_metadata
from exceptions import DataValidationError, OutputParsingError

logger = logging.getLogger(__name__)

# ── Violation enumeration response format ──────────────────────────────────────
#
# The LLM receives unique values of col1 and col2 (not paired rows) and returns
# the specific (col1_value, col2_value) combinations that are violations.
# Local code then maps these back to dataset rows without further LLM calls.

violation_enumeration_response_format = {
    "type": "json_schema",
    "json_schema": {
        "name": "violation_enumeration_response",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "pairs": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "pair_id": {
                                "type": "number",
                                "description": "The pair_id matching the input",
                            },
                            "violations": {
                                "type": "array",
                                "description": "Each entry is a (col1_value, col2_value) combination that violates the dependency.",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "col1_value": {
                                            "type": "string",
                                            "description": "The value from col1 in the violating combination",
                                        },
                                        "col2_value": {
                                            "type": "string",
                                            "description": "The value from col2 in the violating combination",
                                        },
                                        "col1_annotation": {
                                            "type": "number",
                                            "enum": [0, 1],
                                            "description": "1 if col1 contains the error, 0 otherwise",
                                        },
                                        "col2_annotation": {
                                            "type": "number",
                                            "enum": [0, 1],
                                            "description": "1 if col2 contains the error, 0 otherwise",
                                        },
                                        "explanation": {
                                            "type": "string",
                                            "description": "Why this combination is a violation",
                                        },
                                        "col1_repair": {
                                            "type": "string",
                                            "description": "Corrected value for col1 if col1 is the error, else empty string",
                                        },
                                        "col2_repair": {
                                            "type": "string",
                                            "description": "Corrected value for col2 if col2 is the error, else empty string",
                                        },
                                    },
                                    "required": [
                                        "col1_value",
                                        "col2_value",
                                        "col1_annotation",
                                        "col2_annotation",
                                        "explanation",
                                        "col1_repair",
                                        "col2_repair",
                                    ],
                                    "additionalProperties": False,
                                },
                            },
                        },
                        "required": ["pair_id", "violations"],
                        "additionalProperties": False,
                    },
                },
            },
            "required": ["pairs"],
            "additionalProperties": False,
        },
    },
}

# ── System prompt ───────────────────────────────────────────────────────────────

system_prompt = """You are a data quality expert specializing in detecting dependency violations in tabular datasets.

<task>
You will receive one or more dependency pairs. For each pair you receive:
- "pair_id": a numeric identifier
- "col1", "col2": the names of the two columns
- "dependency": a description of the functional dependency between the columns
- "col1_unique_values": all unique values present in col1 across the dataset
- "col2_unique_values": all unique values present in col2 across the dataset

Your goal is to identify which specific (col1_value, col2_value) combinations would constitute a dependency violation — without needing to see every row. Return results grouped by pair_id.
</task>

<definitions>
Dependency violation: A combination where one or both values are inconsistent with the other under the stated dependency.
</definitions>

<rules>
1. Use the dependency description as the primary guide.
2. Only return combinations that are violations — omit valid combinations.
3. For each violation, set col1_annotation=1 if col1 contains the error, col2_annotation=1 if col2 contains the error. Both may be 1 if the pair is mutually inconsistent.
4. Empty or null values in either column are never violations.
5. Check string values for misspellings or invalid characters that would cause a syntactic violation. Ignore capitalization differences.
6. For proper nouns (names, brands, places), check for syntactic violations only — not semantic ones.
7. Explanations must be concise and cite specific evidence.
8. For possible_repair, output only the corrected value string — nothing else.
9. Before identifying violations, read the dependency description carefully and identify what valid combinations look like.
10. If you cannot determine violations from the unique value lists alone (e.g. the dependency requires seeing actual row pairings), return an empty violations list for that pair_id.
</rules>

<violation_types>

1. Semantic violation
The meaning of a value contradicts what the dependency requires.

Example — dependency: Col 1 is a US state abbreviation; Col 2 is a ZIP code:
col1_unique: ["AL", "AK", "TX"]
col2_unique: ["35233", "99501", "78201", "35000"]
Violations:
  ("AL", "99501") — ZIP 99501 is in Alaska, not Alabama → col2_annotation=1
  ("TX", "35233") — ZIP 35233 is in Alabama, not Texas → col2_annotation=1

2. Syntactic violation
A structural error in one value breaks the dependency relationship.

Example — dependency: Col 7 is an employment code; Col 10 is its plain-text description:
col1_unique: ["EMP-001-2024", "CON-009-2005", "EMP-00B-8888"]
col2_unique: ["Employee - hired in 2024", "Contract worker - hired in 2005", "Employee - hired in 2018"]
Violations:
  ("EMP-00B-8888", "Employee - hired in 2018") — "8888" is not a valid year → col1_annotation=1

</violation_types>"""

# ── Row budget for grouping pairs into bins ────────────────────────────────────

ROW_BUDGET = 200


# ── Helper functions ───────────────────────────────────────────────────────────

def _group_pairs_into_bins(prepared_pairs: List[Dict], row_budget: int = ROW_BUDGET) -> List[List[Dict]]:
    """Greedily pack dependency pairs into bins where the combined unique value
    count (col1 + col2 unique values) does not exceed row_budget per bin."""
    bins: List[List[Dict]] = []
    current_bin: List[Dict] = []
    current_size = 0

    for pair in prepared_pairs:
        size = len(pair["col1_unique"]) + len(pair["col2_unique"])
        if current_size + size > row_budget and current_bin:
            bins.append(current_bin)
            current_bin = [pair]
            current_size = size
        else:
            current_bin.append(pair)
            current_size += size

    if current_bin:
        bins.append(current_bin)

    return bins


def _enumerate_violations_combined(
    payload: List[Dict],
    directory: str,
) -> Dict[int, List[Dict]]:
    """Make a single LLM call for a bin of pairs using the violation enumeration
    approach. Returns a dict keyed by pair_id → list of violation entries."""
    settings = load_settings()
    model = settings["model"]
    provider = LLMProviderFactory.create(settings)

    user_prompt = (
        "Analyze the following dependency pairs and identify all violating "
        "(col1_value, col2_value) combinations. Return results grouped by pair_id:"
    )
    user_prompt_with_data = f"{user_prompt}\n{json.dumps(payload)}"

    llm_request = LLMRequest(
        model=model,
        messages=[
            Message(role="system", content=system_prompt),
            Message(role="user", content=user_prompt_with_data),
        ],
        max_tokens=16000,
        response_format=violation_enumeration_response_format,
    )

    start_time = time.time()
    llm_response = provider.generate(llm_request)
    elapsed = time.time() - start_time

    try:
        parsed = json.loads(llm_response.content)
    except (json.JSONDecodeError, AttributeError) as e:
        raise OutputParsingError(
            f"LLM returned malformed JSON for violation enumeration: {e}. "
            f"Raw output (first 200 chars): {llm_response.content[:200]}"
        ) from e

    minutes = int((elapsed % 3600) // 60)
    seconds = int(elapsed % 60)
    milliseconds = int((elapsed % 1) * 1000)
    formatted_time = f"{minutes:02}:{seconds:02}.{milliseconds:03}"

    pair_labels = ", ".join(
        p["prompt_title"] for p in payload
        if isinstance(p, dict) and "prompt_title" in p
    ) if payload else f"{len(payload)} pairs"

    write_prompt_metadata(
        completion_tokens=int(llm_response.completion_tokens),
        prompt_tokens=int(llm_response.prompt_tokens),
        total_tokens=int(llm_response.total_tokens),
        elapsed_time=formatted_time,
        directory=directory,
        prompt_title=f"violations: {pair_labels}",
        number_of_batches=1,
    )

    logger.info(
        "Violation enumeration call: %d pairs, %d total tokens, time %s",
        len(payload),
        llm_response.total_tokens,
        formatted_time,
    )

    return {
        result["pair_id"]: result["violations"]
        for result in parsed.get("pairs", [])
    }


def _apply_violations(
    violations: List[Dict],
    unique_rows: pd.DataFrame,
    col1_str: str,
    col2_str: str,
) -> List[Dict]:
    """Map LLM-returned (col1_value, col2_value) violation pairs back to
    unique_row indices. Returns annotation items in the existing output.json format.

    All unique rows — including non-violating ones — are emitted with annotation=0
    so that process_dep_violations_output can merge on unique_index correctly.
    """
    col1_num = int(col1_str)
    col2_num = int(col2_str)

    # Build lookup: (str(col1_value), str(col2_value)) → violation entry
    violation_set: Dict[tuple, Dict] = {}
    for v in violations:
        key = (str(v["col1_value"]), str(v["col2_value"]))
        violation_set[key] = v

    output_items = []
    for _, row in unique_rows.iterrows():
        idx = int(row["index"])
        key = (str(row[col1_str]), str(row[col2_str]))

        if key in violation_set:
            v = violation_set[key]
            if v.get("col1_annotation", 0) == 1:
                output_items.append({
                    "index": idx,
                    "column": col1_num,
                    "annotation": 1,
                    "explanation": v["explanation"],
                    "possible_repair": v.get("col1_repair", ""),
                })
            if v.get("col2_annotation", 0) == 1:
                output_items.append({
                    "index": idx,
                    "column": col2_num,
                    "annotation": 1,
                    "explanation": v["explanation"],
                    "possible_repair": v.get("col2_repair", ""),
                })
            # If neither annotation is 1, still need to emit annotation=0 entries
            if v.get("col1_annotation", 0) == 0 and v.get("col2_annotation", 0) == 0:
                output_items.append({"index": idx, "column": col1_num, "annotation": 0,
                                     "explanation": "", "possible_repair": ""})
                output_items.append({"index": idx, "column": col2_num, "annotation": 0,
                                     "explanation": "", "possible_repair": ""})
        else:
            output_items.append({"index": idx, "column": col1_num, "annotation": 0,
                                 "explanation": "", "possible_repair": ""})
            output_items.append({"index": idx, "column": col2_num, "annotation": 0,
                                 "explanation": "", "possible_repair": ""})

    return output_items


def _dispatch_bin(bin_pairs: List[Dict], directory: str) -> None:
    """Dispatch one bin of dependency pairs using the violation enumeration approach.

    Sends unique col1/col2 value lists (not paired rows) to the LLM, which returns
    the specific (col1_value, col2_value) combinations that are violations.
    Results are mapped back to dataset rows locally without further LLM calls.
    """
    payload = []
    for pair in bin_pairs:
        payload.append({
            "pair_id": pair["pair_id"],
            "col1": pair["col1_name"],
            "col2": pair["col2_name"],
            "dependency": pair["dependency_description"],
            "col1_unique_values": [str(v) for v in pair["col1_unique"]],
            "col2_unique_values": [str(v) for v in pair["col2_unique"]],
            "prompt_title": pair["prompt_title"],
        })

    results_by_pair_id = _enumerate_violations_combined(payload, directory)

    for pair in bin_pairs:
        violations = results_by_pair_id.get(pair["pair_id"], [])
        if not violations:
            logger.info(
                "No violations found for pair_id %d (%s).",
                pair["pair_id"],
                pair["prompt_title"],
            )

        col1_str = str(pair["dataset"].columns.get_loc(pair["col1_name"]))
        col2_str = str(pair["dataset"].columns.get_loc(pair["col2_name"]))

        output_items = _apply_violations(violations, pair["unique_rows"], col1_str, col2_str)
        output_json = json.dumps({"output": output_items})

        write_output(
            gpt_output=output_json,
            user_prompt=f"Violations for dependency: {pair['dependency_description']}",
            system_prompt=system_prompt,
            prompt_title=pair["prompt_title"],
            directory=directory,
            input_data_dict=pair["row_dict"],
        )


# ── Main entry point ───────────────────────────────────────────────────────────

def detect_dep_violations(
    dependencies_df: pd.DataFrame, dataset: pd.DataFrame, directory: str
):
    # ── Phase 1: Prepare all pairs (no LLM calls) ─────────────────────────────
    prepared_pairs: List[Dict] = []

    for _, row in dependencies_df.iterrows():
        columns = [row["column_1_name"], row["column_2_name"]]
        dependency_description = row["dependency"]

        missing_columns = [col for col in columns if col not in dataset.columns]
        if missing_columns:
            raise DataValidationError(f"Columns not found in dataset: {missing_columns}")

        selected_columns = dataset[columns]

        if selected_columns.drop_duplicates().shape[0] < dataset.shape[0]:
            row_dict, unique_rows = create_row_dict(selected_columns)

            col1_str = str(dataset.columns.get_loc(columns[0]))
            col2_str = str(dataset.columns.get_loc(columns[1]))

            unique_rows.columns = [col1_str, col2_str, "index", "count"]

            prepared_pairs.append({
                "pair_id": len(prepared_pairs),
                "col1_name": columns[0],
                "col2_name": columns[1],
                "dependency_description": dependency_description,
                "unique_rows": unique_rows,
                "row_dict": row_dict,
                "prompt_title": f"{columns[0]}, {columns[1]}",
                "col1_unique": dataset[columns[0]].dropna().unique().tolist(),
                "col2_unique": dataset[columns[1]].dropna().unique().tolist(),
                "dataset": dataset,  # needed in _dispatch_bin for get_loc
            })

    if not prepared_pairs:
        logger.info("No dependency pairs with duplicate combinations found; skipping violation detection.")
        return

    logger.info("Prepared %d dependency pairs for violation detection.", len(prepared_pairs))

    # ── Phase 2: Group into bins and dispatch ──────────────────────────────────
    bins = _group_pairs_into_bins(prepared_pairs)

    logger.info(
        "Grouped %d pairs into %d bin(s) (ROW_BUDGET=%d).",
        len(prepared_pairs),
        len(bins),
        ROW_BUDGET,
    )

    for bin_index, bin_pairs in enumerate(bins, start=1):
        logger.info(
            "Dispatching bin %d/%d: %d pair(s).",
            bin_index,
            len(bins),
            len(bin_pairs),
        )
        _dispatch_bin(bin_pairs, directory)
