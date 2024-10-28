FROM python:3.9-slim

WORKDIR /app

# Copy only the requirements file to leverage Docker cache for dependencies
COPY requirements.txt /app/requirements.txt

# Install dependencies, leveraging the cache if requirements.txt hasn't changed
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . /app

EXPOSE 5000

# Set FLASK_APP if necessary
ENV FLASK_APP=app.py

# Run the Flask app
CMD ["flask", "run", "--host=0.0.0.0"]

