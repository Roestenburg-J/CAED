import pandas as pd
from datasketch import MinHash, MinHashLSH


def create_attribute_dict(attribute, column_name: str) -> pd.DataFrame:

    attribute = pd.DataFrame(attribute)
    attribute["original_index"] = attribute.index

    # Retreive unique values
    attribute_unique = pd.DataFrame(
        attribute[column_name].unique(), columns=[column_name]
    )

    # Create an index for unique values
    attribute_unique["unique_index"] = attribute_unique.index

    # Join unique indexs to the original values, creating a dictionary of original index, value, and unique index
    attribute_dict = pd.merge(
        attribute, attribute_unique, on=column_name, how="left", suffixes=("", "_df2")
    )

    attribute_dict.rename(columns={"index_df2": "unique_index"}, inplace=True)

    return attribute_dict, attribute_unique


# Function to create unique row dictionary
def create_row_dict(selected_columns: pd.DataFrame) -> pd.DataFrame:
    # Make a copy to avoid SettingWithCopyWarning
    selected_columns = selected_columns.copy()

    # Store original index
    selected_columns["original_index"] = selected_columns.index
    # Retrieve unique rows by dropping duplicates, ignoring 'original_index'
    unique_rows = (
        selected_columns.drop("original_index", axis=1)
        .drop_duplicates(subset=selected_columns.columns[:-1])
        .reset_index(drop=True)
    )
    unique_rows["unique_index"] = (
        unique_rows.index
    )  # Create unique index for unique rows

    # Merge unique row index back to original data to track the mapping
    row_dict = pd.merge(
        selected_columns,
        unique_rows,
        how="left",
        on=list(
            selected_columns.columns[:-1]
        ),  # Merge on actual data columns, excluding 'original_index' and 'unique_row_index'
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
        raise ValueError("Both dataframes must have the same structure.")

    # Convert both dataframes to strings for datatype-agnostic comparison
    df_fixed_str = df_fixed.astype(str)
    df_with_errors_str = df_with_errors.astype(str)

    # Create the annotation dataframe by comparing the two dataframes
    error_annotation = (df_fixed_str != df_with_errors_str).astype(int)

    return error_annotation


def create_buckets(dataset: pd.DataFrame):

    records = dataset.values.tolist()

    # Create an LSH index with a threshold and number of permutations
    lsh = MinHashLSH(threshold=0.5, num_perm=128)

    # Insert each record into the LSH index
    for i, record in enumerate(records):
        m = MinHash(num_perm=128)
        for feature in record:
            m.update(
                str(feature).encode("utf8")
            )  # Hashing the attributes of the record
        lsh.insert(i, m)

        buckets = []
    visited = set()  # To track records that have already been assigned to a bucket

    # Querying similar records for each record
    for i, record in enumerate(records):
        if i not in visited:  # Only process records that haven't been visited
            # Create MinHash for the current record
            m = MinHash(num_perm=128)
            for feature in record:
                m.update(str(feature).encode("utf8"))

            # Query LSH to get similar records
            similar_records = lsh.query(m)

            # Add the current record and its similar ones as a new bucket
            buckets.append(similar_records)

            # Mark all similar records as visited
            visited.update(similar_records)

    # Calculate the sizes of all buckets
    bucket_sizes = [(i, len(bucket)) for i, bucket in enumerate(buckets)]

    # Sort buckets by size in descending order
    sorted_buckets = sorted(bucket_sizes, key=lambda x: x[1], reverse=True)

    # Retrieve the top 10 buckets
    top_buckets_raw = sorted_buckets[:10]  # Get the top 10 buckets

    # Define a minimum size threshold (e.g., 2)
    min_size_threshold = 2

    # Filter the top buckets based on the minimum size threshold
    filtered_top_buckets = [
        bucket for bucket in top_buckets_raw if bucket[1] >= min_size_threshold
    ]

    return filtered_top_buckets, buckets
