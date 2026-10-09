CREATE TABLE IF NOT EXISTS accounts (
    id VARCHAR(100) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'agent',
    password VARCHAR(255),
    created_at BIGINT,
    provider VARCHAR(50),
    email_verified BOOLEAN DEFAULT FALSE,
    approver BOOLEAN DEFAULT FALSE,
    approved BOOLEAN DEFAULT FALSE,
    approval_token VARCHAR(255),
    active BOOLEAN DEFAULT TRUE,
    session_token VARCHAR(255),
    session_tokens JSON,
    display_mode VARCHAR(20),
    parent_admin_email VARCHAR(255),
    assigned_service_ids JSON,
    assigned_counter_ids JSON
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pending_otps (
    email VARCHAR(255) PRIMARY KEY,
    payload JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    token VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    created_at BIGINT,
    expires_at BIGINT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS services (
    id VARCHAR(100) PRIMARY KEY,
    owner_email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    prefix VARCHAR(10),
    color VARCHAR(50),
    active BOOLEAN DEFAULT TRUE,
    image LONGTEXT,
    INDEX idx_owner (owner_email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS counters (
    id VARCHAR(100) PRIMARY KEY,
    owner_email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    service_ids JSON,
    status VARCHAR(50) DEFAULT 'closed',
    current_ticket_id VARCHAR(100),
    INDEX idx_owner (owner_email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tickets (
    id VARCHAR(100) PRIMARY KEY,
    owner_email VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'waiting',
    created_date BIGINT,
    number VARCHAR(50),
    code VARCHAR(50),
    service_id VARCHAR(100),
    category VARCHAR(100),
    INDEX idx_owner (owner_email),
    INDEX idx_status (status),
    INDEX idx_service (service_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;