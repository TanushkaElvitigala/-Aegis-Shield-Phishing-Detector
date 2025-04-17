from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import pandas as pd
import re
import tldextract
import validators  # Adding URL validator library

# Initialize Flask app and enable CORS
app = Flask(__name__)

# Enable CORS (Cross-Origin Resource Sharing) for the Flask application
# This allows the API to be accessed from different origins/domains
CORS(app, resources={r"/*": {"origins": "*"}})

# Load pre-trained machine learning models for URL and email classification
url_model = joblib.load("./models/random_forest_model.pkl")  # Load URL classification model
email_model = joblib.load("./models/sgd_classifier_pipeline.pkl")  # Load email classification model

# Define the API key for authentication
API_KEY = 'e2e6c7065b31b339dd8966a3f70d8318b4896723895fd8e9079ec05bc77ce702' # Extra API key :- ' e2e6c7065b31b339dd8966a3f70d8318b4896723895fd8e9079ec05bc77ce702'

# API endpoint to retrieve the API key
@app.route('/get_api_key', methods=['GET'])
def get_api_key():
    return jsonify({'api_key': API_KEY})

# Function to validate URL format and structure
def is_valid_url(url):
    # Check if URL is empty
    if not url:
        return False, "URL cannot be empty"
    
    # Check if URL starts with 'http://', 'https://', or 'www'
    if not (url.startswith('http://') or url.startswith('https://') or url.startswith('www')):
        return False, "URL must start with http:// or https://."
    
    # Validate URL structure using tldextract library
    try:
        parts = tldextract.extract(url)
        if not all([parts.domain, parts.suffix]):
            return False, "Invalid URL structure"
            
        return True, ""
    except Exception:
        return False, "Invalid URL format"

# Function to validate email content
def is_valid_email_content(email_text):
    # Check if email content is empty
    if not email_text:
        return False, "Email content cannot be empty"
    
    # Remove whitespace and check if email content is at least 150 characters long
    cleaned_text = email_text.strip()
    if len(cleaned_text) < 150:
        return False, f"Email content must be at least 150 characters long. (current length: {len(cleaned_text)})"
    
    return True, ""

# Function to extract features from the URL for classification
def extract_url_features(url):
    features = {}
    features['url_length'] = len(url)  # Length of the URL
    features['num_dots'] = url.count('.')  # Number of dots in the URL
    features['num_hyphens'] = url.count('-')  # Number of hyphens in the URL
    features['num_underscores'] = url.count('_')  # Number of underscores in the URL
    features['num_digits'] = sum(c.isdigit() for c in url)  # Number of digits in the URL
    features['num_special_chars'] = len(re.findall(r'[^A-Za-z0-9]', url))  # Number of special characters in the URL
    
    ext = tldextract.extract(url)
    features['domain_length'] = len(ext.domain)  # Length of the domain part of the URL
    features['subdomain_length'] = len(ext.subdomain)  # Length of the subdomain part of the URL
    features['path_length'] = len(url.split('/', 3)[-1]) if '/' in url else 0  # Length of the path part of the URL
    
    return features

# API endpoint to predict if a URL is phishing or safe
@app.route("/predict/url", methods=['POST'])
def predict_url():
    try:
        # Get JSON data from the request and handle potential parsing errors
        try:
            data = request.get_json(force=True)
        except Exception:
            return jsonify({"error": "Invalid JSON format"}), 400

        # Extract URL from the JSON data and validate its presence
        url = data.get("url")
        if not url:
            return jsonify({"error": "No URL provided"}), 400 # Return an error if no URL is provided

        # Validate URL format using the is_valid_url function
        is_valid, error_message = is_valid_url(url)
        if not is_valid:
            return jsonify({"error": error_message}), 400 

        # Extract features from the URL and make a prediction using the pre-trained model
        features = extract_url_features(url) # Extract features from the URL
        features_df = pd.DataFrame([features]) # Convert features to a pandas DataFrame
        prediction = url_model.predict(features_df) # Make a prediction using the URL classification model
        result = "Phishing" if prediction[0] == 1 else "Safe" # Decode the prediction result
        
        # Return the prediction result as JSON
        return jsonify({
            "url": url,
            "prediction": result,
            "status": "success"
        })
    
    except Exception as e:
        # Handle any exceptions and return an error message
        return jsonify({"error": f"Processing error: {str(e)}"}), 500 # Return an error message if an exception occurs

# API endpoint to predict if an email is phishing or safe
@app.route("/predict/email", methods=["POST"])
def predict_email():
    try:
        # Handle both form data and JSON input for email text
        email_text = None
        if request.is_json:
            email_text = request.json.get("email_text")
        else:
            email_text = request.form.get("email_text")

        # Validate the presence of email text
        if email_text is None:
            return jsonify({"error": "No email text provided"}), 400 # Return an error if no email text is provided

        # Validate email content using the is_valid_email_content function
        is_valid, error_message = is_valid_email_content(email_text)
        if not is_valid:
            return jsonify({"error": error_message}), 400

        # Make a prediction using the pre-trained email classification model
        prediction = email_model.predict([email_text])[0] # Make a prediction using the email classification model
        label = "Safe Email" if prediction == 1 else "Phishing Email" # Decode the prediction result
        
        # Return the prediction result as JSON
        return jsonify({
            "prediction": label,
            "status": "success"
        })
    
    except Exception as e:
        # Handle any exceptions and return an error message
        return jsonify({"error": f"Processing error: {str(e)}"}), 500

# Run the Flask app if the script is executed directly
if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0', port=5000)