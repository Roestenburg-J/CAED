# CAED - Context-Aware Error Detection

Detecting erroneous values in datasets remains a challenging and time-consuming task. Different types of errors could occur in each dataset. Errors could either be syntactic, in which case they do not conform to the structure or domain of other values, or semantic, where values are syntactically correct but appear in the wrong context. The variability of the context in which these errors occur makes it hard to design a tool to detect all errors in all contexts. We developed a new tool that leverages the context awareness of Large Language Models (LLMs) to perform context-aware detection of semantic and syntactic errors. By pruning datasets to optimize the size and quality of input, and employing prompt engineering designed for error detection, the tool extends the range of detectable syntactic and semantic errors.

## Installation

To run CAED you can execute the following command in the root of this project:

```bash
docker compose up
```

Be mindfull that the next application takes some time to compile, and when loading the pages for the first time they take more time to render client side components.

The application can be accessed at:
Frontend: [http://localhost:3000/]
Backend: [http://localhost:5000/]

## Usage

CAED has a functional frontend which makes it easy to use. The homepage of the tool allows you to view previous detections (here you will also see the detections we made during the evaluation of our tool), and to make new detections. If you want to evaluate the tool you can click the "Evaluate" button, if you want to detect errors in a dataset you can click the "Detect" button.
