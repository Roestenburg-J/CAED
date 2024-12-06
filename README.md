# CAED - Context-Aware Error Detection

Detecting erroneous values in datasets remains a challenging and time-consuming task. Different types of errors could occur in each dataset. Errors could either be syntactic, in which case they do not conform to the structure or domain of other values, or semantic, where values are syntactically correct but appear in the wrong context. The variability of the context in which these errors occur makes it hard to design a tool to detect all errors in all contexts. We developed a new tool that leverages the context awareness of Large Language Models (LLMs) to perform context-aware detection of semantic and syntactic errors. By pruning datasets to optimize the size and quality of input, and employing prompt engineering designed for error detection, the tool extends the range of detectable syntactic and semantic errors.

## Installation

To run CAED you can execute the following command at the root of this project:

```bash
docker compose up
```

Be mindful that the next application takes some time to compile, and when loading the pages for the first time they take more time to render client-side components.

The application can be accessed at:

Frontend: [http://localhost:3000/](http://localhost:3000/)

Backend: [http://localhost:5000/](http://localhost:5000/)

## Requirements

Our tool makes use of the OpenAI ChatGPT API to send prompts to a LLM. To use our tool you require an OpenAI account with credit to perform detections. You can also select the model you want to use for detection. You require a stable internet connection for the entire runtime of detections.

> [!NOTE]
> If you choose a model other than `gpt-4o-mini` make sure it supports structured outputs.

After running the tool you can set your credentials with the following command:

```bash
curl -X POST http://localhost:5000/settings \
-H "Content-Type: application/json" \
-d '{
  "gpt_organization": "your_organization",
  "gpt_project": "your_project",
  "gpt_api": "your_api_key",
  "gpt_model": "your_model_name"
}'

```

> [!NOTE]
> Be mindful of the cost of running our tool.

Our tool makes multiple prompts during execution which incur costs for input and output tokens. For reference on the cost of performing detections, we show the average costs for our benchmark datasets. Columns with long strings naturally consume more tokens.
| Dataset | Cost | Rows | Cols |
| -------- | ----- |-----|-----|
| Beers | $0.15 | 2 410 | 11 |
| Flights | $0.09 | 2 376 | 7 |
| Hospital | $0.07 | 1 000 | 20 |
| Movies | $2.53 | 7 390 | 17 |
| Rayyan | $0.13 | 1000 | 10 |

## Usage

CAED has a functional frontend which makes it easy to use. The homepage of the tool allows you to view previous detections (here you will also see the detections we made during the evaluation of our tool), and to make new detections. If you want to evaluate the tool you can click the "Evaluate" button, if you want to detect errors in a dataset you can click the "Detect" button.

![Home screen](https://github.com/Roestenburg-J/CAED/blob/main/resources/home_screen.png?raw=true)

To evaluate the tool you require a ground truth dataset and a dataset with error values. You can upload these datasets by clicking the "UPLOAD DIRTY DATASET", and "UPLOAD CLEAN DATASET" buttons. To detect errors you only have to upload an input dataset. Check the components you want to use, and the system will start to run.

With our tool you can view the error rate per column, the amount of time and tokens used to execute each component, and in the case of evaluation, you can also view Precision, Recall and other useful metrics.

![Evaluate](https://github.com/Roestenburg-J/CAED/blob/main/resources/evaluate.png?raw=true)

When scrolling down, you can browse the dataset. For detection, you can highlight detected errors, and for evaluation, you can highlight true positives, false positives and false negatives.

![Inspect](https://github.com/Roestenburg-J/CAED/blob/main/resources/inspect.png?raw=true)

## Architecture

CAED consists of three distinct tasks that it performs to detect errors. The architecture can be seen below:

![Architecture](https://github.com/Roestenburg-J/CAED/blob/main/resources/architecture.png?raw=true)

1. Attribute Prompting
   CAED samples each of the columns in the dataset prunes them and sends them in a prompt to the LLM

2. Dependency Prompting
   CAED samples blocks of similar rows from the dataset and sends them to the LLM to detect possible dependencies between columns.

3. Dependency Violation Prompting
   CAED selects pairs of columns with dependencies and sends them to the LLM to detect violations

## Open Issues

The frontend component of this application may still have some bugs regarding display or controls.
