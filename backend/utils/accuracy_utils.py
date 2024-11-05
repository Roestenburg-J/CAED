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


# import pandas as pd


import pandas as pd


def inspect_classification(true_dataset, pred_dataset, input_dataset):
    # Align the columns of the true and predicted datasets with the input dataset
    true_dataset.columns = input_dataset.columns
    pred_dataset.columns = input_dataset.columns

    # Calculate the adjusted values for true and predicted datasets
    calc = true_dataset.add(2)
    calc_out = pred_dataset
    calc_out[calc_out == 0] = -1

    # Combine the calculated values
    calc = calc.add(calc_out)

    # True positive calculation
    tp = calc == 4
    true_positive_df = input_dataset[tp].fillna(0).infer_objects()

    # False positive calculation
    fp = calc == 3
    false_positive_df = input_dataset[fp].fillna(0).infer_objects()

    # False negative calculation
    fn = calc == 2
    false_negative_df = input_dataset[fn].fillna(0).infer_objects()

    return true_positive_df, false_positive_df, false_negative_df
