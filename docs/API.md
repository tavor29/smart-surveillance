# API Documentation

## API Endpoints

### 1. Get User Info
- **Endpoint:** `/api/user`
- **Method:** `GET`
- **Description:** Retrieves the information of the user.
- **Usage Example:**
    ```bash
    curl -X GET http://example.com/api/user
    ```

### 2. Update User Info
- **Endpoint:** `/api/user`
- **Method:** `PUT`
- **Description:** Updates the user information.
- **Usage Example:**
    ```bash
    curl -X PUT -H "Content-Type: application/json" -d '{"name":"New Name"}' http://example.com/api/user
    ```

### 3. Delete User
- **Endpoint:** `/api/user`
- **Method:** `DELETE`
- **Description:** Deletes the user account.
- **Usage Example:**
    ```bash
    curl -X DELETE http://example.com/api/user
    ```

## Conclusion
This document covers the basic usage of the API endpoints available for managing user information.