-- SentinelBot Database Seeds
-- Sample data for development and testing

-- Insert sample users (passwords are hashed for 'password123')
INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_verified) VALUES 
('550e8400-e29b-41d4-a716-446655440001', 'john.doe@example.com', '$2b$10$rQZ8kHWKtGY5uFQNvQgOHOxGjTgHpjxqrjGjKjGjKjGjKjGjKjGjK', 'John', 'Doe', 'user', true),
('550e8400-e29b-41d4-a716-446655440002', 'jane.smith@example.com', '$2b$10$rQZ8kHWKtGY5uFQNvQgOHOxGjTgHpjxqrjGjKjGjKjGjKjGjKjGjK', 'Jane', 'Smith', 'user', true),
('550e8400-e29b-41d4-a716-446655440003', 'security.analyst@company.com', '$2b$10$rQZ8kHWKtGY5uFQNvQgOHOxGjTgHpjxqrjGjKjGjKjGjKjGjKjGjK', 'Security', 'Analyst', 'user', true);

-- Insert sample scans
INSERT INTO scans (id, user_id, target, scan_type, status, title, description, started_at, completed_at, progress) VALUES 
('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'example.com', 'comprehensive', 'complete', 'Full Security Scan - Example.com', 'Comprehensive security assessment of example.com including port scanning, vulnerability detection, and web application testing.', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour', 100),
('660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', '192.168.1.100', 'nmap', 'complete', 'Network Port Scan', 'Basic port scan to identify open services on internal server.', NOW() - INTERVAL '1 day', NOW() - INTERVAL '23 hours', 100),
('660e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440002', 'testsite.local', 'nikto', 'running', 'Web Vulnerability Scan', 'Web application vulnerability assessment using Nikto scanner.', NOW() - INTERVAL '30 minutes', NULL, 65),
('660e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440002', 'api.example.com', 'sqlmap', 'pending', 'SQL Injection Test', 'Testing API endpoints for SQL injection vulnerabilities.', NULL, NULL, 0);

-- Insert sample scan results
INSERT INTO scan_results (scan_id, vulnerability_type, risk_level, title, description, fix_suggestion, cvss_score, cve_id, affected_component, port, service, raw_output, ai_analysis) VALUES 
('660e8400-e29b-41d4-a716-446655440001', 'Open Port', 'medium', 'SSH Service Exposed', 'SSH service is running on port 22 and accessible from the internet.', 'Consider restricting SSH access to specific IP ranges or implementing fail2ban for brute force protection.', 5.3, NULL, 'SSH Server', 22, 'ssh', '{"nmap_output": "22/tcp open ssh OpenSSH 8.2p1"}', '{"risk_assessment": "Medium risk due to potential brute force attacks", "recommendations": ["Use key-based authentication", "Disable root login", "Change default port"]}'),
('660e8400-e29b-41d4-a716-446655440001', 'Web Vulnerability', 'high', 'Outdated Apache Version', 'Web server is running an outdated version of Apache with known vulnerabilities.', 'Update Apache to the latest stable version and apply security patches.', 7.5, 'CVE-2021-44228', 'Apache HTTP Server', 80, 'http', '{"nikto_output": "Apache/2.4.29 appears to be outdated"}', '{"risk_assessment": "High risk due to known exploits", "recommendations": ["Immediate update required", "Review security configurations"]}'),
('660e8400-e29b-41d4-a716-446655440001', 'SSL/TLS Issue', 'low', 'Weak SSL Cipher Suites', 'Server supports weak SSL cipher suites that could be exploited.', 'Disable weak cipher suites and enable only strong encryption algorithms.', 3.7, NULL, 'SSL/TLS Configuration', 443, 'https', '{"ssl_scan": "Weak ciphers: RC4, DES"}', '{"risk_assessment": "Low risk but should be addressed", "recommendations": ["Update SSL configuration", "Use modern TLS versions only"]}'),
('660e8400-e29b-41d4-a716-446655440002', 'Network Service', 'info', 'FTP Service Detected', 'FTP service is running on the standard port.', 'If FTP is not required, consider disabling it. If needed, use SFTP instead.', 0.0, NULL, 'FTP Server', 21, 'ftp', '{"nmap_output": "21/tcp open ftp vsftpd 3.0.3"}', '{"risk_assessment": "Informational - service detected", "recommendations": ["Evaluate if FTP is necessary", "Consider SFTP alternative"]}'),
('660e8400-e29b-41d4-a716-446655440002', 'Open Port', 'medium', 'Database Port Exposed', 'MySQL database port is accessible from external networks.', 'Restrict database access to application servers only using firewall rules.', 5.9, NULL, 'MySQL Database', 3306, 'mysql', '{"nmap_output": "3306/tcp open mysql MySQL 8.0.25"}', '{"risk_assessment": "Medium risk - database should not be publicly accessible", "recommendations": ["Implement firewall restrictions", "Use VPN for remote access"]}');

-- Insert sample API keys
INSERT INTO api_keys (user_id, key_name, key_hash, permissions, is_active) VALUES 
('550e8400-e29b-41d4-a716-446655440001', 'CI/CD Pipeline', '$2b$10$apikey1hash', '{"scans": ["read", "create"], "reports": ["read"]}', true),
('550e8400-e29b-41d4-a716-446655440002', 'Monitoring System', '$2b$10$apikey2hash', '{"scans": ["read"]}', true);

-- Insert sample scan reports
INSERT INTO scan_reports (scan_id, report_type, file_path, file_size, expires_at) VALUES 
('660e8400-e29b-41d4-a716-446655440001', 'pdf', '/reports/scan_660e8400_report.pdf', 2048576, NOW() + INTERVAL '30 days'),
('660e8400-e29b-41d4-a716-446655440001', 'csv', '/reports/scan_660e8400_data.csv', 51200, NOW() + INTERVAL '30 days'),
('660e8400-e29b-41d4-a716-446655440002', 'json', '/reports/scan_660e8400_raw.json', 102400, NOW() + INTERVAL '30 days');
