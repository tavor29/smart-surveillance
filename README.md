# Smart Surveillance

## Overview
Smart Surveillance is an advanced security system that leverages artificial intelligence and machine learning to monitor environments and alert users about any suspicious activities. The platform can integrate with various hardware devices and provides real-time notifications through a user-friendly interface.

## Features
- **Real-time Monitoring:** Access live feeds from connected cameras.
- **AI-Powered Alerts:** Detect unauthorized movements automatically.
- **Data Storage:** Store and retrieve footage based on events.
- **User Management:** Multi-user support with customizable permissions.
- **Remote Access:** View your surveillance feeds from anywhere.

## Architecture
The system is built on a client-server architecture. The client component is a web-based dashboard, while the server side utilizes Flask for API management, connecting to a database for storage and user authentication.

### Components:
- **Frontend:** React.js for the user interface.
- **Backend:** Flask API for data processing.
- **Database:** PostgreSQL for storing user data and footage.
- **Machine Learning Model:** Custom-trained models for activity detection.

## Installation
1. **Clone the Repository:**
   ```bash
   git clone https://github.com/tavor29/smart-surveillance.git
   cd smart-surveillance
   ```
2. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
3. **Set up the Database:**
   - Create a PostgreSQL database and user.
   - Run migrations to set up the schema:
   ```bash
   flask db upgrade
   ```
4. **Start the Server:**
   ```bash
   flask run
   ```

## Usage
- **Accessing the Dashboard:** Open your web browser and navigate to `http://localhost:5000`.
- **Add Cameras:** Use the admin panel to add new camera feeds.
- **Setting Alerts:** Configure alerts for different activity types through the settings tab.

## Contribution Guidelines
We welcome contributions! To contribute to the project, please follow these steps:
1. Fork the repository.
2. Create a new branch (`git checkout -b feature-branch`).
3. Make your changes and commit them (`git commit -m 'Add feature'`).
4. Push to your branch (`git push origin feature-branch`).
5. Create a pull request describing your changes.

Thank you for your contributions!