<?php

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

header("Content-Type: application/json; charset=UTF-8");
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'status' => 'error',
        'message' => 'Method not allowed. Use POST.'
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_NUMERIC_CHECK);
    exit();
}

require_once 'db_connection.php';

try {
    
    // Get JSON input
    $json = file_get_contents('php://input');
    $data = json_decode($json, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception('Invalid JSON format: ' . json_last_error_msg());
    }
    
    // Validate required fields
    if (!isset($data['items']) || !is_array($data['items']) || empty($data['items'])) {
        throw new Exception('Items array is required and cannot be empty');
    }
    
    if (!isset($data['user_id']) || empty($data['user_id'])) {
        throw new Exception('User ID is required');
    }
    
    $user_id = intval($data['user_id']);
    $global_discount = isset($data['global_discount']) ? floatval($data['global_discount']) : 0;
    $cash_tendered = isset($data['cash_tendered']) ? floatval($data['cash_tendered']) : 0;
    $items = $data['items'];
    
    // Validate global discount range
    if ($global_discount < 0 || $global_discount > 100) {
        throw new Exception('Global discount must be between 0 and 100');
    }
    
    // Validate cash tendered
    if ($cash_tendered < 0) {
        throw new Exception('Cash tendered cannot be negative');
    }
    
    // Start transaction for data integrity
    $pdo->beginTransaction();
    
    try {
        // Calculate subtotal from items
        $subtotal = 0;
        $total_item_discount = 0;
        $new_items_data = [];
        
        // Process each item
        foreach ($items as $item) {
            // Validate item fields
            if (!isset($item['product_id']) || empty($item['product_id'])) {
                throw new Exception('Product ID is required for all items');
            }
            
            if (!isset($item['quantity']) || $item['quantity'] <= 0) {
                throw new Exception('Quantity must be greater than 0 for all items');
            }
            
            if (!isset($item['price']) || $item['price'] < 0) {
                throw new Exception('Price must be non-negative for all items');
            }
            
            $inventory_id = intval($item['product_id']);
            $quantity = intval($item['quantity']);
            $price_each = floatval($item['price']);
            $discount_percent = isset($item['discount']) ? floatval($item['discount']) : 0;
            
            // Validate discount range
            if ($discount_percent < 0 || $discount_percent > 100) {
                throw new Exception('Item discount must be between 0 and 100');
            }
            
            // Check if inventory item exists and has enough stock
            $stmt = $pdo->prepare("SELECT id, stock, name FROM inventory WHERE id = ?");
            $stmt->execute([$inventory_id]);
            $inventory_item = $stmt->fetch();
            
            if (!$inventory_item) {
                throw new Exception("Inventory item with ID $inventory_id not found");
            }
            
            if ($inventory_item['stock'] < $quantity) {
                throw new Exception("Insufficient stock for item: {$inventory_item['name']}. Available: {$inventory_item['stock']}, Requested: $quantity");
            }
            
            // Calculate item total with discount
            $item_subtotal = $price_each * $quantity;
            $item_discount_amount = $item_subtotal * ($discount_percent / 100);
            $item_total = $item_subtotal - $item_discount_amount;
            
            $subtotal += $item_total;
            $total_item_discount += $item_discount_amount;
            
            // Update inventory stock
            $stmt = $pdo->prepare("UPDATE inventory SET stock = stock - ? WHERE id = ?");
            $stmt->execute([$quantity, $inventory_id]);
            
            // Store item data for response
            $new_items_data[] = [
                'quantity' => $quantity,
                'price_each' => $price_each,
                'discount_percent' => $discount_percent,
                'name' => $inventory_item['name']
            ];
        }
        
        // Calculate total with global discount
        $global_discount_amount = $subtotal * ($global_discount / 100);
        $total_amount = $subtotal - $total_item_discount - $global_discount_amount;
        $change_due = $cash_tendered - $total_amount;
        
        // Validate change
        if ($change_due < 0) {
            throw new Exception('Cash tendered is less than the total amount');
        }
        
        // Set timezone to ensure correct time recording
        // You can change this to your server's timezone if needed
        date_default_timezone_set('Asia/Manila'); // Adjust to your timezone
        
        // Get current date and time in the correct timezone
        $current_datetime = date('Y-m-d H:i:s');
        
        // Insert receipt record
        // NOTE: total_amount and change_due are generated columns and cannot be inserted directly
        // They will automatically calculate when we insert the base columns:
        // - total_amount = subtotal - total_item_discount - cart_discount_amount
        // - change_due = cash_tendered - total_amount
        $stmt = $pdo->prepare("
            INSERT INTO receipt 
            (subtotal, total_item_discount, cart_discount, cart_discount_amount, cash_tendered, date_issued) 
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            round($subtotal, 2),
            round($total_item_discount, 2),
            $global_discount,
            round($global_discount_amount, 2),
            round($cash_tendered, 2),
            $current_datetime
        ]);
        
        error_log("Inserted receipt with base columns. Generated columns (total_amount, change_due) should calculate automatically.");
        
        // Get the inserted receipt ID
        $receipt_id = $pdo->lastInsertId();
        
        // Insert receipt items FIRST (before updating receipt)
        // This ensures generated columns can see the receipt_items when calculating
        foreach ($items as $item) {
            $inventory_id = intval($item['product_id']);
            $quantity = intval($item['quantity']);
            $price_each = floatval($item['price']);
            $discount_percent = isset($item['discount']) ? floatval($item['discount']) : 0;
            
            $stmt = $pdo->prepare("
                INSERT INTO receipt_items 
                (receipt_id, inventory_id, quantity, price_each, discount_percent) 
                VALUES (?, ?, ?, ?, ?)
            ");
            $stmt->execute([$receipt_id, $inventory_id, $quantity, $price_each, $discount_percent]);
        }
        
        // Now update the receipt to ensure all columns are set correctly
        // This triggers the generated columns to recalculate
        $calculated_total = $subtotal - $total_item_discount - $global_discount_amount;
        $calculated_change_due = $cash_tendered - $calculated_total;
        
        // Update receipt with all calculated values
        // This ensures generated columns (total_amount, change_due) can calculate correctly
        // Use the same datetime to maintain consistency
        $stmt = $pdo->prepare("
            UPDATE receipt 
            SET 
                subtotal = ?,
                total_item_discount = ?,
                cart_discount = ?,
                cart_discount_amount = ?,
                cash_tendered = ?,
                date_issued = ?
            WHERE receipt_id = ?
        ");
        $stmt->execute([
            round($subtotal, 2),
            round($total_item_discount, 2),
            $global_discount,
            round($global_discount_amount, 2),
            round($cash_tendered, 2),
            $current_datetime,
            $receipt_id
        ]);
        
        // Fetch the updated receipt to get the calculated change_due and total_amount
        // This ensures we get the values calculated by the database (generated columns)
        $stmt = $pdo->prepare("SELECT change_due, total_amount, subtotal, total_item_discount, cart_discount_amount, cash_tendered FROM receipt WHERE receipt_id = ?");
        $stmt->execute([$receipt_id]);
        $inserted_receipt = $stmt->fetch();
        
        // Use database-calculated values
        $total_amount = isset($inserted_receipt['total_amount']) ? floatval($inserted_receipt['total_amount']) : $calculated_total;
        $change_due = isset($inserted_receipt['change_due']) ? floatval($inserted_receipt['change_due']) : ($cash_tendered - $total_amount);
        
        // NOTE: total_amount and change_due are generated columns and cannot be updated directly
        // If the database values don't match our calculations, use calculated values (they're always correct)
        if (empty($total_amount) || $total_amount == 0 || abs($total_amount - $calculated_total) > 0.01) {
            error_log("Warning: Database total_amount ($total_amount) doesn't match calculated ($calculated_total). Using calculated value.");
            error_log("This suggests the generated column formula may be incorrect in the database schema.");
            $total_amount = $calculated_total;
            $change_due = $calculated_change_due;
        }
        
        // Verify change_due calculation
        // If change_due doesn't match calculated value, use calculated value
        if (abs($change_due - $calculated_change_due) > 0.01) {
            error_log("Warning: Database change_due ($change_due) doesn't match calculated ($calculated_change_due). Using calculated value.");
            $change_due = $calculated_change_due;
        }
        
        // Commit transaction
        $pdo->commit();
        
        // Return success response
        // IMPORTANT: Always use calculated values in response to ensure accuracy
        // even if database generated columns haven't calculated correctly
        echo json_encode([
            'status' => 'success',
            'message' => 'Purchase completed successfully',
            'data' => [
                'receipt_id' => $receipt_id,
                'subtotal' => round($subtotal, 2),
                'total_item_discount' => round($total_item_discount, 2),
                'global_discount' => $global_discount,
                'cart_discount_amount' => round($global_discount_amount, 2),
                'total_amount' => round($calculated_total, 2), // Always use calculated value
                'cash_tendered' => round($cash_tendered, 2),
                'change_due' => round($calculated_change_due, 2), // Always use calculated value
                'items' => $new_items_data,
                'date_issued' => $current_datetime
            ]
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_NUMERIC_CHECK);
        
    } catch (Exception $e) {
        // Rollback transaction on error
        $pdo->rollBack();
        throw $e;
    }
    
} catch (PDOException $e) {
    // Database error
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Database error: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_NUMERIC_CHECK);
    
} catch (Exception $e) {
    // General error
    http_response_code(400);
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_NUMERIC_CHECK);
}
?>

