<?php
define('EXAGENT_PATH', __DIR__ . '/../../');
require_once __DIR__ . '/../../app/Core/Database.php';

use ExAgent\Core\Database;

try {
    $db = Database::getInstance();
    
    echo "Installing membership tables...\n";
    
    // Disable FK checks
    $db->query("SET FOREIGN_KEY_CHECKS = 0");
    
    $sql = file_get_contents(__DIR__ . '/create_membership_tables.sql');
    
    // Split SQL by semicolon to execute multiple statements
    $statements = array_filter(array_map('trim', explode(';', $sql)));
    
    foreach ($statements as $statement) {
        if (!empty($statement)) {
            $db->query($statement);
        }
    }
    
    // Enable FK checks
    $db->query("SET FOREIGN_KEY_CHECKS = 1");
    
    echo "Membership tables installed successfully!\n";
    
} catch (Exception $e) {
    echo "Error installing tables: " . $e->getMessage() . "\n";
    exit(1);
}
