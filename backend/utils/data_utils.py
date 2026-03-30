import logging

import pandas as pd
from datasketch import MinHash, MinHashLSH

from exceptions import DataValidationError

logger = logging.getLogger(__name__)


def create_attribute_dict(attribute, column_name: str) -> pd.DataFrame:

    attribute = pd.DataFrame(attribute)
    attribute["original_index"] = attribute.index

    # Retrieve unique values
    attribute_unique = pd.DataFrame(
        attribute[column_name].unique(), columns=[column_name]
    )

    # Create an index for unique values
    attribute_unique["unique_index"] = attribute_unique.index

    # Add count of how many times each unique value appears in the column
    count_map = attribute[column_name].value_counts()
    attribute_unique["count"] = attribute_unique[column_name].map(count_map)

    # Join unique indices to the original values
    attribute_dict = pd.merge(
        attribute, attribute_unique, on=column_name, how="left", suffixes=("", "_df2")
    )

    attribute_dict.rename(columns={"index_df2": "unique_index"}, inplace=True)

    return attribute_dict, attribute_unique


# Function to create unique row dictionary
def create_row_dict(selected_columns: pd.DataFrame) -> pd.DataFrame:
    if selected_columns.shape[1] < 2:
        raise DataValidationError(
            f"create_row_dict requires at least 2 columns, got {selected_columns.shape[1]}."
        )

    selected_columns = selected_columns.copy()

    # Store original index
    selected_columns["original_index"] = selected_columns.index
    # Retrieve unique rows by dropping duplicates, ignoring 'original_index'
    unique_rows = (
        selected_columns.drop("original_index", axis=1)
        .drop_duplicates(subset=selected_columns.columns[:-1])
        .reset_index(drop=True)
    )
    unique_rows["unique_index"] = unique_rows.index

    # Add count of how many times each unique row combination appears in the dataset
    data_cols = list(selected_columns.columns[:-1])  # all columns except original_index
    counts = selected_columns.groupby(data_cols, sort=False).size().reset_index(name="count")
    unique_rows = unique_rows.merge(counts, on=data_cols, how="left")

    # Merge unique row index back to original data to track the mapping
    row_dict = pd.merge(
        selected_columns,
        unique_rows,
        how="left",
        on=data_cols,
    )

    return row_dict, unique_rows


def generate_attribute_prompt_string(attribute_unique) -> str:
    attribute_delimited = attribute_unique[
        [attribute_unique.columns[1], attribute_unique.columns[0]]
    ]

    if attribute_delimited[attribute_unique.columns[0]].dtype != "int64":
        attribute_delimited.loc[:, attribute_unique.columns[0]] = attribute_delimited[
            attribute_unique.columns[0]
        ].apply(lambda x: x.strip())

    attribute_delimited.loc[:, attribute_unique.columns[0]] = attribute_delimited[
        attribute_unique.columns[0]
    ].apply(lambda x: f"|{x}|")

    attribute_delimited.loc[:, attribute_unique.columns[1]] = attribute_delimited[
        attribute_unique.columns[1]
    ].apply(lambda x: f"[{x}]")

    attribute_unique_string = attribute_delimited.to_csv(
        index=False, header=False, lineterminator="\n", sep=">"
    )

    return attribute_unique_string


def annotate_errors(
    df_fixed: pd.DataFrame, df_with_errors: pd.DataFrame
) -> pd.DataFrame:
    # Check if the dataframes have the same shape and columns after sorting
    if df_fixed.shape != df_with_errors.shape or not all(
        df_fixed.columns == df_with_errors.columns
    ):
        raise DataValidationError("Both dataframes must have the same structure.")

    # Convert both dataframes to strings for datatype-agnostic comparison
    df_fixed_str = df_fixed.astype(str)
    df_with_errors_str = df_with_errors.astype(str)

    # Create the annotation dataframe by comparing the two dataframes
    error_annotation = (df_fixed_str != df_with_errors_str).astype(int)

    return error_annotation


def create_attribute_value_buckets(
    attribute_unique: pd.DataFrame, threshold: float = 0.5, num_perm: int = 128
) -> list:
    """
    Group unique attribute values into buckets of similar values using MinHashLSH.

    Uses character 3-gram shingles to estimate Jaccard similarity between string
    values (useful for detecting misspellings and format variants).

    Returns a list of buckets; each bucket is a list of integer row positions
    (0-based) into attribute_unique.
    """
    value_col = attribute_unique.columns[0]
    values = attribute_unique[value_col].tolist()

    lsh = MinHashLSH(threshold=threshold, num_perm=num_perm)
    minhashes = []

    for i, value in enumerate(values):
        m = MinHash(num_perm=num_perm)
        value_str = str(value)
        # Character 3-gram shingles; fall back to the whole string for short values
        if len(value_str) >= 3:
            shingles = {value_str[j : j + 3] for j in range(len(value_str) - 2)}
        else:
            shingles = {value_str}
        for shingle in shingles:
            m.update(shingle.encode("utf8"))
        minhashes.append(m)
        lsh.insert(i, m)

    buckets = []
    visited = set()

    for i in range(len(values)):
        if i not in visited:
            similar = lsh.query(minhashes[i])
            buckets.append(similar)
            visited.update(similar)

    return buckets


def merge_buckets_by_tokens(
    buckets: list,
    records: list,
    max_tokens_per_batch: int = 3000,
) -> list:
    """
    Merge small MinHash buckets into larger batches so that each batch's JSON
    payload stays within *max_tokens_per_batch* tokens (estimated as
    ``len(json.dumps(batch)) / 4``).

    This reduces the number of LLM API calls for a column from one-per-bucket
    down to one-per-merged-group without exceeding the chosen token budget.

    Parameters
    ----------
    buckets:
        List of buckets returned by ``create_attribute_value_buckets()``.
        Each bucket is a list of integer row positions into *records*.
    records:
        The full list of record dicts (i.e. the parsed JSON rows for the
        column) so that token size can be estimated from actual content.
    max_tokens_per_batch:
        Soft upper bound on the estimated token count of the user-data
        payload for a single LLM call.  The system prompt and response
        tokens are on top of this.

    Returns
    -------
    List of merged buckets, where each element is a list of row indices
    with a combined token estimate at or below the ceiling.
    """
    import json as _json

    merged: list = []
    current_indices: list = []
    current_tokens: int = 0

    for bucket in buckets:
        if not bucket:
            continue

        bucket_records = [records[i] for i in bucket if i < len(records)]
        if not bucket_records:
            continue

        bucket_tokens = len(_json.dumps(bucket_records)) // 4

        # If this single bucket already exceeds the ceiling, emit it alone.
        if bucket_tokens >= max_tokens_per_batch:
            if current_indices:
                merged.append(current_indices)
                current_indices = []
                current_tokens = 0
            merged.append(list(bucket))
            continue

        # If adding this bucket would exceed the ceiling, flush and start fresh.
        if current_tokens + bucket_tokens > max_tokens_per_batch and current_indices:
            merged.append(current_indices)
            current_indices = []
            current_tokens = 0

        current_indices.extend(bucket)
        current_tokens += bucket_tokens

    if current_indices:
        merged.append(current_indices)

    logger.debug(
        "merge_buckets_by_tokens: %d buckets → %d batches (budget %d tokens/batch)",
        len(buckets), len(merged), max_tokens_per_batch,
    )
    return merged


def create_buckets(dataset: pd.DataFrame, threshold: float = 0.5, num_perm: int = 128, max_cardinality: float = 0.9):
    if dataset.empty:
        raise DataValidationError(
            "Cannot create MinHash buckets from an empty dataset."
        )
    if dataset.shape[0] < 2:
        raise DataValidationError(
            f"Need at least 2 rows for dependency detection, got {dataset.shape[0]}."
        )

    n_rows = dataset.shape[0]
    low_cardinality_cols = [
        col for col in dataset.columns
        if dataset[col].nunique() / n_rows <= max_cardinality
    ]
    if not low_cardinality_cols:
        logger.warning(
            "All columns exceed the cardinality threshold (%.2f) — using full dataset for MinHash.",
            max_cardinality,
        )
        hashing_dataset = dataset
    else:
        excluded = [c for c in dataset.columns if c not in low_cardinality_cols]
        if excluded:
            logger.info("Excluding high-cardinality columns from MinHash hashing: %s", excluded)
        hashing_dataset = dataset[low_cardinality_cols]

    records = hashing_dataset.values.tolist()

    # Create an LSH index with a threshold and number of permutations
    lsh = MinHashLSH(threshold=threshold, num_perm=num_perm)

    buckets = []
    visited = set()

    # Insert each record into the LSH index
    for i, record in enumerate(records):
        m = MinHash(num_perm=num_perm)
        for feature in record:
            m.update(str(feature).encode("utf8"))
        lsh.insert(i, m)

    # Querying similar records for each record
    for i, record in enumerate(records):
        if i not in visited:
            m = MinHash(num_perm=num_perm)
            for feature in record:
                m.update(str(feature).encode("utf8"))

            similar_records = lsh.query(m)
            buckets.append(similar_records)
            visited.update(similar_records)

    # Calculate the sizes of all buckets
    bucket_sizes = [(i, len(bucket)) for i, bucket in enumerate(buckets)]

    # Sort buckets by size in descending order
    sorted_buckets = sorted(bucket_sizes, key=lambda x: x[1], reverse=True)

    # Retrieve the top 10 buckets
    top_buckets_raw = sorted_buckets[:10]

    # Filter the top buckets based on the minimum size threshold
    min_size_threshold = 2
    filtered_top_buckets = [
        bucket for bucket in top_buckets_raw if bucket[1] >= min_size_threshold
    ]

    return filtered_top_buckets, buckets
