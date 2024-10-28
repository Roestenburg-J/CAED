import pandas as pd


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
