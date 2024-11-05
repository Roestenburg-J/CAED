from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
import pandas as pd


# true_dataset is the dataset calculated by comparing the dirty with the clean dataset
def calculate_metrics(true_dataset: pd.DataFrame, pred_dataset: pd.DataFrame):
    # Flatten the dataframes to 1D arrays
    y_true = true_dataset.values.flatten()
    y_pred = pred_dataset.values.flatten()

    # Accuracy
    accuracy = accuracy_score(y_true, y_pred)

    # Precision
    precision = precision_score(y_true, y_pred)

    # Recall
    recall = recall_score(y_true, y_pred)

    f_score = f1_score(y_true, y_pred)

    return accuracy, precision, recall, f_score


def inspect_classification(
    true_dataset: pd.DataFrame, pred_dataset: pd.DataFrame, input_dataset: pd.DataFrame
):
    true_dataset.columns = input_dataset.columns
    pred_dataset.columns = input_dataset.columns

    calc = true_dataset.add(2)
    calc_out = pred_dataset.copy()
    calc_out[calc_out == 0] = -1

    calc = calc.add(calc_out)

    # True positive calculation
    tp = calc == 4
    true_positive_df = input_dataset[tp].astype(str)
    true_positive_df = true_positive_df.replace(to_replace="nan", value=0)

    # False positive calculation
    fp = calc == 3
    false_positve_df = input_dataset[fp].astype(str)
    false_positve_df = false_positve_df.replace(to_replace="nan", value=0)

    # False negative calculation
    fn = calc == 2
    false_negative_df = input_dataset[fn].astype(str)
    false_negative_df = false_negative_df.replace(to_replace="nan", value=0)

    return true_positive_df, false_positve_df, false_negative_df
