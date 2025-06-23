-- SentinelBot Database Schema
-- PostgreSQL Database Schema for Cybersecurity Pentest Platform

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE scan_status AS ENUM ('pending', 'running', 'complete', 'error', 'cancelled');
CREATE TYPE risk_level AS ENUM ('info', 'low', 'medium', 'high', 'critical');
CREATE TYPE scan_type AS ENUM ('nmap', 'nikto', 'sqlmap', 'zap', 'comprehensive');

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE
);

-- Scans table
CREATE TABLE scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target VARCHAR(255) NOT NULL,
    scan_type scan_type NOT NULL DEFAULT 'comprehensive',
    status scan_status DEFAULT 'pending',
    title VARCHAR(255),
    description TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    error_message TEXT,
    scan_options JSONB DEFAULT '{}',
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100)
);

-- Scan results table
CREATE TABLE scan_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    vulnerability_type VARCHAR(255) NOT NULL,
    risk_level risk_level NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    fix_suggestion TEXT,
    cvss_score DECIMAL(3,1) CHECK (cvss_score >= 0 AND cvss_score <= 10),
    cve_id VARCHAR(50),
    affected_component VARCHAR(255),
    port INTEGER,
    service VARCHAR(100),
    raw_output JSONB,
    ai_analysis JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Refresh tokens table for JWT authentication
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_revoked BOOLEAN DEFAULT false
);

-- API keys table for CI/CD integrations
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_name VARCHAR(100) NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    permissions JSONB DEFAULT '{"scans": ["read", "create"]}',
    last_used TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Scan reports table
CREATE TABLE scan_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    report_type VARCHAR(50) NOT NULL, -- 'pdf', 'csv', 'json', 'xml'
    file_path VARCHAR(500),
    file_size INTEGER,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);

CREATE INDEX idx_scans_user_id ON scans(user_id);
CREATE INDEX idx_scans_status ON scans(status);
CREATE INDEX idx_scans_created_at ON scans(created_at);
CREATE INDEX idx_scans_target ON scans(target);

CREATE INDEX idx_scan_results_scan_id ON scan_results(scan_id);
CREATE INDEX idx_scan_results_risk_level ON scan_results(risk_level);
CREATE INDEX idx_scan_results_vulnerability_type ON scan_results(vulnerability_type);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_is_active ON api_keys(is_active);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scans_updated_at BEFORE UPDATE ON scans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scan_results_updated_at BEFORE UPDATE ON scan_results
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default admin user (password: admin123 - change in production!)
INSERT INTO users (email, password_hash, first_name, last_name, role, is_verified) VALUES 
('admin@sentinelbot.com', '$2b$10$rQZ8kHWKtGY5uFQNvQgOHOxGjTgHpjxqrjGjKjGjKjGjKjGjKjGjK', 'Admin', 'User', 'admin', true);

-- Create views for common queries
CREATE VIEW scan_summary AS
SELECT 
    s.id,
    s.target,
    s.scan_type,
    s.status,
    s.created_at,
    s.completed_at,
    COUNT(sr.id) as total_vulnerabilities,
    COUNT(CASE WHEN sr.risk_level = 'critical' THEN 1 END) as critical_count,
    COUNT(CASE WHEN sr.risk_level = 'high' THEN 1 END) as high_count,
    COUNT(CASE WHEN sr.risk_level = 'medium' THEN 1 END) as medium_count,
    COUNT(CASE WHEN sr.risk_level = 'low' THEN 1 END) as low_count,
    COUNT(CASE WHEN sr.risk_level = 'info' THEN 1 END) as info_count
FROM scans s
LEFT JOIN scan_results sr ON s.id = sr.scan_id
GROUP BY s.id, s.target, s.scan_type, s.status, s.created_at, s.completed_at;
