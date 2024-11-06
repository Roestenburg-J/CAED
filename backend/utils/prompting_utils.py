from typing import Dict, Any
import pandas as pd
import os
from openai import OpenAI
import time
import json
from pydantic import BaseModel


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
) -> None:

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

        print(f"Output and prompt saved in directory: {prompt_directory}")

    except FileNotFoundError as e:
        print(f"Error: {e}")

    except Exception as e:
        print(f"An unexpected error occurred: {e}")


# Write the number of tokens usd, the time to retrieve the output and other metadata to a CSV
def write_prompt_metadata(
    completion_tokens: int,
    prompt_tokens: int,
    total_tokens: int,
    elapsed_time: str,
    directory: str,
    prompt_title: str,
) -> None:
    current_data = pd.DataFrame(
        [
            {
                "completion_tokens": completion_tokens,
                "prompt_tokens": prompt_tokens,
                "total_tokens": total_tokens,
                "elapsed_time": elapsed_time,
                "prompt_name": prompt_title,
            }
        ]
    )

    prompt_metadata_path = os.path.join(directory, "prompt_metadata.csv")

    # Check if the file exists to determine whether to write the header
    if os.path.exists(prompt_metadata_path):
        current_data.to_csv(prompt_metadata_path, mode="a", header=False, index=False)
    else:
        current_data.to_csv(prompt_metadata_path, mode="w", header=True, index=False)

    print("Processing complete. Results and token/time data have been saved.")


# Define the pompt of the GPT, providing one system prompt, a user prompt, and the expected schema for the output
def prompt_gpt(
    system_prompt: str,
    user_prompt: str,
    prompt_title: str,
    response_format: dict[str],
    output_directory: str,
    input_data_dict: pd.DataFrame,
) -> None:

    class Output(BaseModel):
        output: list[str]

    # gpt_organization: str,
    # gpt_project: str,
    # gpt_api: str,
    # gpt_model: str,

    try:
        settings = load_settings()
        gpt_organization = settings["gpt_organization"]
        gpt_project = settings["gpt_project"]
        gpt_api = settings["gpt_api"]
        gpt_model = settings["gpt_model"]
    except (FileNotFoundError, ValueError) as e:
        print(str(e))
        return 0, 0, 0, f"Error: {str(e)}"

    # Define output format with Pydantic
    class Output(BaseModel):
        output: list[str]

    # Initialize OpenAI client with loaded settings
    client = OpenAI(
        organization=gpt_organization,
        project=gpt_project,
        api_key=gpt_api,
    )
    try:
        start_time = time.time()

        completion = client.chat.completions.create(
            model=gpt_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=16000,
            response_format=response_format,
        )

        completion_tokens = completion.usage.completion_tokens
        prompt_tokens = completion.usage.prompt_tokens
        total_tokens = completion.usage.total_tokens

        gpt_output = completion.choices[0].message.content

        end_time = time.time()
        elapsed_time = end_time - start_time
        # Calculate hours, minutes, seconds, and milliseconds

        minutes = int((elapsed_time % 3600) // 60)
        seconds = int(elapsed_time % 60)
        milliseconds = int((elapsed_time % 1) * 1000)

        # Format the output as mm:ss.ms
        formatted_time = f"{minutes:02}:{seconds:02}.{milliseconds:03}"

        # Write the output of the prompting
        write_output(
            gpt_output=gpt_output,
            user_prompt=user_prompt,
            system_prompt=system_prompt,
            prompt_title=prompt_title,
            directory=output_directory,
            input_data_dict=input_data_dict,
        )

        # Write the prompt metadata
        write_prompt_metadata(
            completion_tokens=completion_tokens,
            prompt_tokens=prompt_tokens,
            total_tokens=total_tokens,
            elapsed_time=formatted_time,
            directory=output_directory,
            prompt_title=prompt_title,
        )
    except Exception as e:
        # Return zeros and the error message in case of an exception
        print(str(e))
        return 0, 0, 0, f"Error: {str(e)}"
