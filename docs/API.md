# SentinelBot API Documentation

## Overview

SentinelBot provides a comprehensive REST API for automated cybersecurity penetration testing. The API allows you to manage scans, view results, generate reports, and integrate with CI/CD pipelines.

**Base URL:** `http://localhost:5000/api`

## Authentication

SentinelBot uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### Token Refresh

Access tokens expire after 15 minutes. Use the refresh token to obtain a new access token:

```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "your-refresh-token"
}
```

## API Endpoints

### Authentication

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123!",
  "firstName": "John",
  "lastName": "Doe"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123!"
}
```

#### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <token>
```

#### Logout
```http
POST /api/auth/logout
Authorization: Bearer <token>
```

### Scans

#### List Scans
```http
GET /api/scans?page=1&limit=10&status=complete&scan_type=nmap
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `status` (optional): Filter by status (pending, running, complete, error)
- `scan_type` (optional): Filter by scan type (nmap, nikto, sqlmap, zap, comprehensive)

#### Create Scan
```http
POST /api/scans
Authorization: Bearer <token>
Content-Type: application/json

{
  "target": "example.com",
  "scanType": "comprehensive",
  "title": "Security Assessment",
  "description": "Comprehensive security scan of example.com",
  "options": {
    "ports": "1-1000",
    "scripts": "vuln"
  }
}
```

#### Get Scan Details
```http
GET /api/scans/{scanId}
Authorization: Bearer <token>
```

#### Update Scan
```http
PUT /api/scans/{scanId}
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Updated Title",
  "description": "Updated description"
}
```

#### Delete Scan
```http
DELETE /api/scans/{scanId}
Authorization: Bearer <token>
```

#### Get Scan Statistics
```http
GET /api/scans/stats
Authorization: Bearer <token>
```

### Reports

#### Download PDF Report
```http
GET /api/reports/{scanId}/pdf
Authorization: Bearer <token>
```

#### Download CSV Report
```http
GET /api/reports/{scanId}/csv
Authorization: Bearer <token>
```

#### Download JSON Report
```http
GET /api/reports/{scanId}/json
Authorization: Bearer <token>
```

#### Get Report Metadata
```http
GET /api/reports/{scanId}/metadata
Authorization: Bearer <token>
```

### Users

#### Get User Profile
```http
GET /api/users/profile
Authorization: Bearer <token>
```

#### Update Profile
```http
PUT /api/users/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "email": "newemail@example.com"
}
```

#### Get User Statistics
```http
GET /api/users/stats
Authorization: Bearer <token>
```

#### List API Keys
```http
GET /api/users/api-keys
Authorization: Bearer <token>
```

#### Create API Key
```http
POST /api/users/api-keys
Authorization: Bearer <token>
Content-Type: application/json

{
  "keyName": "CI/CD Pipeline",
  "permissions": {
    "scans": ["read", "create"],
    "reports": ["read"]
  },
  "expiresAt": "2024-12-31T23:59:59Z"
}
```

#### Revoke API Key
```http
DELETE /api/users/api-keys/{keyId}
Authorization: Bearer <token>
```

## Response Format

All API responses follow this format:

```json
{
  "status": "success|error",
  "data": {
    // Response data
  },
  "message": "Optional message"
}
```

## Error Handling

HTTP status codes indicate the result of the request:

- `200` - Success
- `201` - Created
- `204` - No Content
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `429` - Too Many Requests
- `500` - Internal Server Error

Error responses include details:

```json
{
  "status": "error",
  "message": "Error description",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## Rate Limiting

API endpoints are rate limited:
- General API: 100 requests per 15 minutes
- Authentication: 5 login attempts per minute

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Request limit
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset time

## Scan Types

### Available Scan Types

1. **nmap** - Network port scanning
2. **nikto** - Web vulnerability scanning
3. **sqlmap** - SQL injection testing
4. **zap** - OWASP ZAP web application scanning
5. **comprehensive** - All scan types combined

### Scan Status

- `pending` - Scan queued for execution
- `running` - Scan currently executing
- `complete` - Scan finished successfully
- `error` - Scan failed with error
- `cancelled` - Scan was cancelled

### Risk Levels

Vulnerabilities are classified by risk level:
- `critical` - Immediate action required
- `high` - High priority
- `medium` - Medium priority
- `low` - Low priority
- `info` - Informational

## API Key Authentication

For CI/CD integration, use API key authentication:

```http
GET /api/scans
X-API-Key: your-api-key
```

API keys can be created and managed through the user interface or API endpoints.

## Webhooks (Future Feature)

Configure webhooks to receive notifications when scans complete:

```json
{
  "url": "https://your-app.com/webhook",
  "events": ["scan.completed", "scan.failed"],
  "secret": "webhook-secret"
}
```

## SDK and Libraries

Official SDKs are available for:
- JavaScript/Node.js
- Python
- Go
- PHP

Example usage (JavaScript):

```javascript
import { SentinelBotClient } from '@sentinelbot/sdk';

const client = new SentinelBotClient({
  apiUrl: 'http://localhost:5000/api',
  apiKey: 'your-api-key'
});

const scan = await client.scans.create({
  target: 'example.com',
  scanType: 'comprehensive'
});
```
