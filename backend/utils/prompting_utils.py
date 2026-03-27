from typing import Dict, Any, List
import pandas as pd
import os
import time
import json
from flask import current_app

from llm.factory import LLMProviderFactory
from llm.schemas import LLMRequest, Message
from exceptions import ConfigurationError, OutputParsingError


def load_settings():
    settings_path = "./user_settings/settings.json"

    if not os.path.exists(settings_path):
        raise ConfigurationError(
            "Settings file not found. Please create settings.json with the required fields."
        )

    with open(settings_path, "r") as f:
        settings = json.load(f)

    # Backward-compat: if old OpenAI-only keys exist, migrate them
    if "gpt_api" in settings and "openai_api_key" not in settings:
        settings["openai_api_key"] = settings.get("gpt_api", "")
        settings["openai_organization"] = settings.get("gpt_organization", "")
        settings["openai_project"] = settings.get("gpt_project", "")
        settings["model"] = settings.get("gpt_model", "gpt-4o-mini")

    if "model" not in settings:
        raise ConfigurationError("Missing required setting: model")

    return settings


def write_output(
    gpt_output: Dict[str, Any],
    user_prompt: str,
    system_prompt: str,
    prompt_title: str,
    directory: str,
    input_data_dict: pd.DataFrame,
) -> str:

    try:
        # Create the subdirectory for the prompt_title if it doesn't exist
        prompt_directory = os.path.join(
            directory, prompt_title.strip()
        )  # Strip whitespace
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

        current_app.logger.info(
            f"Output and prompt saved in directory: {prompt_directory}"
        )

    except FileNotFoundError as e:
        current_app.logger.error(f"Error: {e}")

    except Exception as e:
        current_app.logger.error(f"An unexpected error occurred: {e}")


def write_prompt_metadata(
    completion_tokens: int,
    prompt_tokens: int,
    total_tokens: int,
    elapsed_time: str,
    directory: str,
    prompt_title: str,
    number_of_batches: int,
) -> None:
    try:

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

        # Write to CSV with try-except block for each mode
        if os.path.exists(prompt_metadata_path):
            current_data.to_csv(
                prompt_metadata_path, mode="a", header=False, index=False
            )
        else:
            current_data.to_csv(
                prompt_metadata_path, mode="w", header=True, index=False
            )

    except Exception as e:
        current_app.logger.error(f"Exception in write_prompt_metadata: {str(e)}")


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

    # Load settings and create provider — raises ConfigurationError on failure
    try:
        settings = load_settings()
        model = settings["model"]
        provider = LLMProviderFactory.create(settings)
    except (ConfigurationError, Exception) as e:
        current_app.logger.error(f"Failed to initialise LLM provider: {e}")
        return

    # Initialize cumulative tracking variables
    total_completion_tokens = 0
    total_prompt_tokens = 0
    total_tokens = 0
    total_batches = 0
    total_elapsed_time = 0
    accumulated_output = (
        '{"output":['  # String to hold the individual records across batches
    )

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
    try:
        for batch in batches:
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

            # Extract and process the batch output
            batch_output = llm_response.content

            # remove first 11 and last 2 chars from batch string (strip {"output":[ prefix and ]} suffix)
            accumulated_output = accumulated_output + batch_output[11:-2] + ","

            # Calculate and accumulate time spent for this batch
            end_time = time.time()
            batch_elapsed_time = end_time - start_time
            total_elapsed_time += batch_elapsed_time

        # Format total time as mm:ss.ms
        minutes = int((total_elapsed_time % 3600) // 60)
        seconds = int(total_elapsed_time % 60)
        milliseconds = int((total_elapsed_time % 1) * 1000)
        formatted_time = f"{minutes:02}:{seconds:02}.{milliseconds:03}"

        accumulated_output = accumulated_output[:-1] + "]}"

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

        return
    except Exception as e:
        current_app.logger.error(f"Error in prompt_gpt: {str(e)}")
        return
