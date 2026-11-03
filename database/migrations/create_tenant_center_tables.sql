ALTER TABLE users MODIFY role ENUM('admin','user','tenant') DEFAULT 'user';

CREATE TABLE IF NOT EXISTS tenant_profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  legal_name VARCHAR(100) NULL,
  preferred_name VARCHAR(100) NULL,
  nationality VARCHAR(80) NULL,
  passport_no VARCHAR(80) NULL,
  wechat_id VARCHAR(80) NULL,
  preferred_language VARCHAR(20) DEFAULT 'en',
  move_in_date DATE NULL,
  lease_months INT NULL,
  budget_min INT NULL,
  budget_max INT NULL,
  preferred_districts JSON NULL,
  preferred_metro_lines JSON NULL,
  company_or_school VARCHAR(180) NULL,
  commute_address VARCHAR(255) NULL,
  has_pet TINYINT(1) DEFAULT 0,
  occupants INT DEFAULT 1,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant_profiles_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tenant_demands (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(180) NOT NULL,
  budget_min INT NULL,
  budget_max INT NULL,
  bedrooms INT NULL,
  bathrooms INT NULL,
  preferred_districts JSON NULL,
  preferred_metro_lines JSON NULL,
  move_in_date DATE NULL,
  lease_months INT NULL,
  pet_allowed TINYINT(1) DEFAULT 0,
  occupants INT DEFAULT 1,
  tags JSON NULL,
  description TEXT NULL,
  status ENUM('active','matched','paused','closed') DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant_demands_user (user_id),
  INDEX idx_tenant_demands_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tenant_conversations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  agent_id INT NULL,
  property_id INT NULL,
  source VARCHAR(80) DEFAULT 'tenant_center',
  subject VARCHAR(180) NOT NULL,
  status ENUM('open','pending','closed') DEFAULT 'open',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant_conversations_tenant (tenant_id),
  INDEX idx_tenant_conversations_agent (agent_id),
  INDEX idx_tenant_conversations_property (property_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tenant_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT NOT NULL,
  sender_id INT NOT NULL,
  sender_role ENUM('tenant','agent','admin','system') NOT NULL,
  message_type VARCHAR(30) DEFAULT 'text',
  content TEXT NULL,
  attachments JSON NULL,
  is_read TINYINT(1) DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tenant_messages_conversation (conversation_id),
  INDEX idx_tenant_messages_sender (sender_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rental_applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  agent_id INT NULL,
  property_id INT NULL,
  title VARCHAR(180) DEFAULT '租赁申请',
  move_in_date DATE NULL,
  lease_months INT NULL,
  offered_price DECIMAL(12,2) NULL,
  status ENUM('draft','submitted','reviewing','accepted','rejected','cancelled') DEFAULT 'submitted',
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_rental_applications_tenant (tenant_id),
  INDEX idx_rental_applications_property (property_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rental_contracts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  agent_id INT NULL,
  property_id INT NULL,
  application_id INT NULL,
  title VARCHAR(180) DEFAULT '租赁合同',
  contract_no VARCHAR(80) NULL,
  rent_amount DECIMAL(12,2) NULL,
  deposit_amount DECIMAL(12,2) NULL,
  start_date DATE NULL,
  end_date DATE NULL,
  status ENUM('draft','pending_tenant','pending_agent','signed','active','expired','cancelled') DEFAULT 'draft',
  file_url VARCHAR(500) NULL,
  signed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_rental_contracts_tenant (tenant_id),
  INDEX idx_rental_contracts_property (property_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tenant_bills (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  contract_id INT NULL,
  title VARCHAR(180) NOT NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  bill_type VARCHAR(50) DEFAULT 'rent',
  due_date DATE NULL,
  status ENUM('pending','paid','overdue','cancelled') DEFAULT 'pending',
  paid_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant_bills_tenant (tenant_id),
  INDEX idx_tenant_bills_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tenant_documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  contract_id INT NULL,
  title VARCHAR(180) NOT NULL,
  document_type VARCHAR(60) DEFAULT 'other',
  file_url VARCHAR(500) NULL,
  status ENUM('uploaded','verified','rejected') DEFAULT 'uploaded',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant_documents_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tenant_service_tickets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  contract_id INT NULL,
  property_id INT NULL,
  title VARCHAR(180) NOT NULL,
  category VARCHAR(60) DEFAULT 'maintenance',
  priority ENUM('low','normal','high','urgent') DEFAULT 'normal',
  status ENUM('open','processing','resolved','closed') DEFAULT 'open',
  description TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant_service_tickets_tenant (tenant_id),
  INDEX idx_tenant_service_tickets_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
