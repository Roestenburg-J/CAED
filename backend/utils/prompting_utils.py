from typing import Dict, Any, List
import pandas as pd
import os
import time
import json
import logging

from llm.factory import LLMProviderFactory
from llm.schemas import LLMRequest, Message
from exceptions import ConfigurationError, OutputParsingError

logger = logging.getLogger(__name__)


def load_settings():
    settings_path = "./user_settings/settings.json"

    if not os.path.exists(settings_path):
        raise ConfigurationError(
            "Settings file not found. Please create settings.json with the required fields."
        )

    with open(settings_path, "r") as f:
        settings = json.load(f)

    # Backward-compat: if old OpenAI-only keys exist, migrate them
    if "provider" not in settings and "gpt_api" in settings:
        settings["provider"] = "openai"
        settings["openai_api_key"] = settings.get("gpt_api", "")
        settings["openai_organization"] = settings.get("gpt_organization", "")
        settings["openai_project"] = settings.get("gpt_project", "")
        settings["model"] = settings.get("gpt_model", "gpt-4o-mini")

    required_fields = ["provider", "model"]
    for field in required_fields:
        if field not in settings:
            raise ConfigurationError(f"Missing required setting: {field}")

    return settings


def write_output(
    gpt_output: Dict[str, Any],
    user_prompt: str,
    system_prompt: str,
    prompt_title: str,
    directory: str,
    input_data_dict: pd.DataFrame,
) -> str:
    # Create the subdirectory for the prompt_title if it doesn't exist
    prompt_directory = os.path.join(directory, prompt_title.strip())
    os.makedirs(prompt_directory, exist_ok=True)

    # Define the file paths
    output_text_file = os.path.join(prompt_directory, "output.json")
    user_prompt_text_file = os.path.join(prompt_directory, "user_prompt.txt")
    sys_prompt_text_file = os.path.join(prompt_directory, "system_prompt.txt")
    input_data_dict_file = os.path.join(prompt_directory, "dict.csv")

    # Write the output
    with open(output_text_file, "w") as f:
        f.write(gpt_output)

    # Write the prompt
    with open(user_prompt_text_file, "w") as f:
        f.write(user_prompt)

    with open(sys_prompt_text_file, "w") as f:
        f.write(system_prompt)

    input_data_dict.to_csv(
        input_data_dict_file, index=False, sep=",", lineterminator="\n"
    )

    logger.info("Output and prompt saved in directory: %s", prompt_directory)


def write_prompt_metadata(
    completion_tokens: int,
    prompt_tokens: int,
    total_tokens: int,
    elapsed_time: str,
    directory: str,
    prompt_title: str,
    number_of_batches: int,
) -> None:
    current_data = pd.DataFrame(
        [
            {
                "completion_tokens": completion_tokens,
                "prompt_tokens": prompt_tokens,
                "total_tokens": total_tokens,
                "elapsed_time": elapsed_time,
                "batches": number_of_batches,
                "prompt_name": prompt_title,
            }
        ]
    )

    prompt_metadata_path = os.path.join(directory, "prompt_metadata.csv")

    # Ensure directory exists
    if not os.path.exists(directory):
        os.makedirs(directory, exist_ok=True)

    # Append or create metadata CSV
    if os.path.exists(prompt_metadata_path):
        current_data.to_csv(prompt_metadata_path, mode="a", header=False, index=False)
    else:
        current_data.to_csv(prompt_metadata_path, mode="w", header=True, index=False)


def prompt_gpt(
    system_prompt: str,
    user_prompt: str,
    prompt_title: str,
    response_format: Dict[str, Any],
    output_directory: str,
    input_data_dict: pd.DataFrame,
    json_str: str,  # Expecting a JSON-formatted string with multiple records
    custom_batches: List[List[Dict[str, Any]]] = None,  # Optional MinHash-based batches
) -> None:

    # Load settings and create provider — raises ConfigurationError / LLMError on failure
    settings = load_settings()
    model = settings["model"]
    provider = LLMProviderFactory.create(settings)

    # Initialize cumulative tracking variables
    total_completion_tokens = 0
    total_prompt_tokens = 0
    total_tokens = 0
    total_batches = 0
    total_elapsed_time = 0
    accumulated_items: List[Any] = []  # Collect parsed output items from each batch

    json_data = json.loads(json_str)  # Parse JSON string to Python object
    num_records = len(json_data)  # Determine the number of records

    # Batching logic: use caller-supplied MinHash buckets when available,
    # otherwise fall back to simple count-based splitting.
    if custom_batches is not None:
        batches = [b for b in custom_batches if b]  # drop any empty buckets
    elif num_records <= 200:
        batches = [json_data]  # Single batch if 200 records or fewer
    else:
        batch_size = 100
        batches = [
            json_data[i : i + batch_size] for i in range(0, num_records, batch_size)
        ]

    total_batches = len(batches)

    for batch_index, batch in enumerate(batches, start=1):
        start_time = time.time()

        # Convert batch to JSON-like string format for API request
        user_prompt_with_data = f"{user_prompt}\n{json.dumps(batch)}"

        llm_request = LLMRequest(
            model=model,
            messages=[
                Message(role="system", content=system_prompt),
                Message(role="user", content=user_prompt_with_data),
            ],
            max_tokens=16000,
            response_format=response_format,
        )

        llm_response = provider.generate(llm_request)

        # Accumulate tokens for all batches
        total_completion_tokens += llm_response.completion_tokens
        total_prompt_tokens += llm_response.prompt_tokens
        total_tokens += llm_response.total_tokens

        # Parse JSON output from LLM response — raises OutputParsingError on malformed JSON
        batch_output = llm_response.content
        try:
            parsed_batch = json.loads(batch_output)
            batch_items = parsed_batch.get("output", [])
            accumulated_items.extend(batch_items)
        except (json.JSONDecodeError, AttributeError) as e:
            raise OutputParsingError(
                f"LLM returned malformed JSON for batch {batch_index}/{total_batches}: {e}. "
                f"Raw output (first 200 chars): {batch_output[:200]}"
            ) from e

        logger.debug(
            "Batch %d/%d completed: %d items, tokens used: %d",
            batch_index, total_batches, len(batch_items), llm_response.total_tokens,
        )

        # Calculate and accumulate time spent for this batch
        end_time = time.time()
        total_elapsed_time += end_time - start_time

    # Format total time as mm:ss.ms
    minutes = int((total_elapsed_time % 3600) // 60)
    seconds = int(total_elapsed_time % 60)
    milliseconds = int((total_elapsed_time % 1) * 1000)
    formatted_time = f"{minutes:02}:{seconds:02}.{milliseconds:03}"

    # Build final JSON output from accumulated items list
    accumulated_output = json.dumps({"output": accumulated_items})

    # Write the accumulated output once all batches are completed
    write_output(
        gpt_output=accumulated_output,
        user_prompt=user_prompt,
        system_prompt=system_prompt,
        prompt_title=prompt_title,
        directory=output_directory,
        input_data_dict=input_data_dict,
    )

    # Write metadata after all batches are completed
    write_prompt_metadata(
        completion_tokens=int(total_completion_tokens),
        prompt_tokens=int(total_prompt_tokens),
        total_tokens=int(total_tokens),
        elapsed_time=str(formatted_time),
        directory=str(output_directory),
        prompt_title=str(prompt_title),
        number_of_batches=int(total_batches),
    )

    logger.info(
        "prompt_gpt completed: %d batches, %d total tokens, time %s",
        total_batches, total_tokens, formatted_time,
    )
