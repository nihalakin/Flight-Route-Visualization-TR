# FastAPI Authentication Project

A FastAPI-based authentication system with PostgreSQL, JWT tokens, and user registration/login functionality.

## Project Structure

```
/app
  main.py          # FastAPI application entry point
  models.py        # SQLAlchemy models (User)
  database.py      # Database configuration and session management
  routes/
    auth.py        # Authentication routes (register, login)
/templates
  register.html    # User registration page
  login.html       # User login page
```

## Setup Instructions

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Setup PostgreSQL Database

1. Install PostgreSQL if not already installed
2. Create a new database:
   ```sql
   CREATE DATABASE fastapi_db;
   ```
3. Update the `DATABASE_URL` in `.env` file:
   ```
   DATABASE_URL=postgresql://username:password@localhost:5432/fastapi_db
   ```

### 3. Configure Environment Variables

Copy `.env.example` to `.env` and update the values:
```bash
cp .env.example .env
```

Edit `.env` and set:
- `DATABASE_URL`: Your PostgreSQL connection string
- `SECRET_KEY`: A secure random string for JWT token signing

### 4. Run the Application

```bash
# Option 1: Using uvicorn directly
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Option 2: Run main.py directly
python -m app.main
```

The application will be available at:
- Frontend: http://localhost:8000
- API Docs: http://localhost:8000/docs
- Alternative API Docs: http://localhost:8000/redoc

## API Endpoints

### POST /api/register
Register a new user.

**Request Body:**
```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "securepassword123"
}
```

**Response:**
```json
{
  "message": "User registered successfully",
  "user_id": 1,
  "username": "johndoe",
  "email": "john@example.com"
}
```

### POST /api/login
Login and get JWT token.

**Request Body (form-data):**
```
username: john@example.com
password: securepassword123
```

**Response:**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer"
}
```

### GET /api/me
Get current user information (requires authentication).

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "id": 1,
  "username": "johndoe",
  "email": "john@example.com"
}
```

## Frontend Pages

- `/` - Login page (home)
- `/login` - Login page
- `/register` - Registration page

## Features

- ✅ User registration with email validation
- ✅ Password hashing using bcrypt
- ✅ JWT token-based authentication
- ✅ PostgreSQL database with SQLAlchemy ORM
- ✅ Beautiful TailwindCSS-styled frontend
- ✅ Email uniqueness validation
- ✅ Secure password storage

## Security Notes

- Passwords are hashed using bcrypt (passlib)
- JWT tokens expire after 30 minutes
- Email addresses must be unique
- Change the `SECRET_KEY` in production!

## Testing the API

### Using curl:

**Register:**
```bash
curl -X POST "http://localhost:8000/api/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"testpass123"}'
```

**Login:**
```bash
curl -X POST "http://localhost:8000/api/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=test@example.com&password=testpass123"
```

**Get User Info:**
```bash
curl -X GET "http://localhost:8000/api/me" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Troubleshooting

1. **Database Connection Error**: Make sure PostgreSQL is running and the connection string is correct
2. **Module Not Found**: Ensure you're in the project root directory and all dependencies are installed
3. **Port Already in Use**: Change the port in `main.py` or use `--port` flag with uvicorn

