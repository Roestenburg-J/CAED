from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    average_precision_score,
    confusion_matrix,
)
import pandas as pd


# # true_dataset is the dataset calculated by comparing the dirty with the clean dataset
# def calculate_metrics(true_dataset: pd.DataFrame, pred_dataset: pd.DataFrame):
#     # Flatten the dataframes to 1D arrays
#     y_true = true_dataset.values.flatten()
#     y_pred = pred_dataset.values.flatten()

#     # Accuracy
#     accuracy = accuracy_score(y_true, y_pred)

#     # Precision
#     precision = precision_score(y_true, y_pred)

#     # Recall
#     recall = recall_score(y_true, y_pred)

#     f_score = f1_score(y_true, y_pred)

#     return accuracy, precision, recall, f_score


def calculate_metrics(true_dataset: pd.DataFrame, pred_dataset: pd.DataFrame):
    # Flatten the dataframes to 1D arrays
    y_true = true_dataset.values.flatten()
    y_pred = pred_dataset.values.flatten()

    # Basic metrics
    accuracy = accuracy_score(y_true, y_pred)
    precision = precision_score(y_true, y_pred)
    recall = recall_score(y_true, y_pred)
    f1 = f1_score(y_true, y_pred)

    # Class-specific accuracy
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred).ravel()
    class_0_accuracy = tn / (tn + fp)  # Accuracy for class 0
    class_1_accuracy = tp / (tp + fn)  # Accuracy for class 1

    # AUC scores
    roc_auc = roc_auc_score(y_true, y_pred)
    pr_auc = average_precision_score(y_true, y_pred)

    # Count of 1s in true and predicted labels
    true_positives_count = sum(y_true == 1)  # Total 1s in true labels
    predicted_positives_count = tp  # Total 1s in predictions

    return {
        "accuracy": float(accuracy),
        "precision": float(precision),
        "recall": float(recall),
        "f1_score": float(f1),
        "class_0_accuracy": float(class_0_accuracy),
        "class_1_accuracy": float(class_1_accuracy),
        "roc_auc": float(roc_auc),
        "pr_auc": float(pr_auc),
        "true_positives_count": int(true_positives_count),
        "predicted_positives_count": int(predicted_positives_count),
    }


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
    true_positive_df = true_positive_df.reset_index(drop=True)  # Remove index

    # False positive calculation
    fp = calc == 3
    false_positive_df = input_dataset[fp].astype(str)
    false_positive_df = false_positive_df.replace(to_replace="nan", value=0)
    false_positive_df = false_positive_df.reset_index(drop=True)  # Remove index

    # False negative calculation
    fn = calc == 2
    false_negative_df = input_dataset[fn].astype(str)
    false_negative_df = false_negative_df.replace(to_replace="nan", value=0)
    false_negative_df = false_negative_df.reset_index(drop=True)  # Remove index

    return true_positive_df, false_positive_df, false_negative_df
