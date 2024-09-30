from flask import Flask, request, redirect, url_for, render_template, flash
import os
import pandas as pd
from modules import tuple_analyzer

app = Flask(__name__)
app.secret_key = "supersecretkey"
app.config["UPLOAD_FOLDER"] = "uploads"
app.config["ALLOWED_EXTENSIONS"] = {"csv"}

# Ensure the upload folder exists
os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)


def allowed_file(filename):
    return (
        "." in filename
        and filename.rsplit(".", 1)[1].lower() in app.config["ALLOWED_EXTENSIONS"]
    )


@app.route("/")
def hello_world():
    return "<h1>Hello from Flask & Docker</h1>"


@app.route("/upload", methods=["GET", "POST"])
def upload_file():
    if request.method == "POST":
        # Check if the post request has the file part
        if "file" not in request.files:
            flash("No file part")
            return redirect(request.url)
        file = request.files["file"]
        # If user does not select file, browser also
        # submit an empty part without filename
        if file.filename == "":
            flash("No selected file")
            return redirect(request.url)
        if file and allowed_file(file.filename):
            filename = file.filename
            file_path = os.path.join(app.config["UPLOAD_FOLDER"], filename)
            file.save(file_path)
            # Process the file
            analysis_result = tuple_analyzer.analyze_dataset(file_path)
            return render_template("result.html", result=analysis_result)
    return render_template("upload.html")


if __name__ == "__main__":
    app.run(debug=True)
