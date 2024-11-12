from typing import Dict, Any, List
import pandas as pd
import os
from openai import OpenAI
import time
import json
from pydantic import BaseModel
from flask import current_app


def load_settings():
    settings_path = "./user_settings/settings.json"
    required_fields = ["gpt_organization", "gpt_project", "gpt_api", "gpt_model"]

    if not os.path.exists(settings_path):
        raise FileNotFoundError(
            "Settings file not found. Please create settings.json with the required fields."
        )

    with open(settings_path, "r") as f:
        settings = json.load(f)

    # Check if all required fields are present
    for field in required_fields:
        if field not in settings:
            raise ValueError(f"Missing required setting: {field}")

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
        # Create the subdirectory for the pompt_title if it doesn't exist
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


# Write the number of tokens usd, the time to retrieve the output and other metadata to a CSV
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
) -> None:

    class Output(BaseModel):
        output: List[str]

    # Load settings and initialize OpenAI client
    try:
        settings = load_settings()
        gpt_organization = settings["gpt_organization"]
        gpt_project = settings["gpt_project"]
        gpt_api = settings["gpt_api"]
        gpt_model = settings["gpt_model"]
    except (FileNotFoundError, ValueError) as e:
        print(str(e))
        return

    client = OpenAI(
        organization=gpt_organization,
        project=gpt_project,
        api_key=gpt_api,
    )

    # Initialize cumulative tracking variables
    total_completion_tokens = 0
    total_prompt_tokens = 0
    total_tokens = 0
    total_batches = 0
    total_elapsed_time = 0
    accumulated_output = (
        '{"output":['  # List to hold the individual records across batches
    )

    json_data = json.loads(json_str)  # Parse JSON string to Python object
    num_records = len(json_data)  # Determine the number of records

    # Batching logic based on the number of records in json_data
    if num_records <= 200:
        batches = [json_data]  # Single batch if 200 records or fewer
    else:
        batch_size = 200
        batches = [
            json_data[i : i + batch_size] for i in range(0, num_records, batch_size)
        ]

    total_batches = len(batches)
    try:
        for batch in batches:
            start_time = time.time()

            # Convert batch to JSON-like string format for API request
            user_prompt_with_data = f"{user_prompt}\n{json.dumps(batch)}"

            # Call the API for each batch
            completion = client.chat.completions.create(
                model=gpt_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt_with_data},
                ],
                max_tokens=16000,
                response_format=response_format,
            )

            # Extract usage data and completion
            completion_tokens = completion.usage.completion_tokens
            prompt_tokens = completion.usage.prompt_tokens
            total_batch_tokens = completion.usage.total_tokens

            # Accumulate tokens for all batches
            total_completion_tokens += completion_tokens
            total_prompt_tokens += prompt_tokens
            total_tokens += total_batch_tokens

            # Extract and process the batch output
            batch_output = completion.choices[0].message.content

            # remove first 11 and last 2 chars from batch string
            accumulated_output = accumulated_output + batch_output[11:-2]

            # Calculate and accumulate time spent for this batch
            end_time = time.time()
            batch_elapsed_time = end_time - start_time
            total_elapsed_time += batch_elapsed_time

        # Format total time as mm:ss.ms
        minutes = int((total_elapsed_time % 3600) // 60)
        seconds = int(total_elapsed_time % 60)
        milliseconds = int((total_elapsed_time % 1) * 1000)
        formatted_time = f"{minutes:02}:{seconds:02}.{milliseconds:03}"

        accumulated_output = accumulated_output + "]}"

        # Write the accumulated output once all batches are completed
        write_output(
            gpt_output=accumulated_output,  # Write the final wrapped output
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
        print(str(e))
        return
