<?php
// Start output buffering to catch any unexpected output
ob_start();

// Suppress HTML error output - we'll handle errors as JSON
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);

// Register shutdown function to catch fatal errors and unexpected output
register_shutdown_function(function() {
    $error = error_get_last();
    if ($error !== NULL && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        // Only send JSON error if headers haven't been sent
        if (!headers_sent()) {
            ob_end_clean();
            header("Content-Type: application/json; charset=UTF-8");
            http_response_code(500);
            echo json_encode([
                'status' => 'error',
                'message' => 'Fatal error: ' . $error['message'] . ' in ' . basename($error['file']) . ' on line ' . $error['line']
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_NUMERIC_CHECK);
        }
        exit();
    }
    
    // Check if there's any unexpected output (only if we haven't already sent JSON)
    if (ob_get_level() > 0) {
        $output = ob_get_contents();
        if (!empty($output) && !empty(trim($output))) {
            // If output doesn't look like JSON, it's probably an error
            $trimmed = trim($output);
            if (substr($trimmed, 0, 1) !== '{' && substr($trimmed, 0, 1) !== '[' && !headers_sent()) {
                ob_end_clean();
                header("Content-Type: application/json; charset=UTF-8");
                http_response_code(500);
                echo json_encode([
                    'status' => 'error',
                    'message' => 'Unexpected server output detected. Please check server logs.',
                    'details' => substr($trimmed, 0, 200) // First 200 chars for debugging
                ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_NUMERIC_CHECK);
                exit();
            }
        }
    }
});

// Set JSON headers first
header("Content-Type: application/json; charset=UTF-8");
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    ob_end_clean();
    http_response_code(200);
    exit();
}

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    ob_end_clean();
    http_response_code(405);
    echo json_encode([
        'status' => 'error',
        'message' => 'Method not allowed. Use POST.'
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_NUMERIC_CHECK);
    exit();
}

// Try to include db_connection.php with error handling
if (!file_exists('db_connection.php')) {
    ob_end_clean();
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Database configuration file not found'
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_NUMERIC_CHECK);
    exit();
}

try {
    require_once 'db_connection.php';
    
    // Check if $pdo is defined
    if (!isset($pdo)) {
        throw new Exception('Database connection not initialized');
    }
} catch (Exception $e) {
    ob_end_clean();
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Database connection failed: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_NUMERIC_CHECK);
    exit();
}

try {
    // Get JSON input
    $json = file_get_contents('php://input');
    $data = json_decode($json, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception('Invalid JSON format: ' . json_last_error_msg());
    }
    
    // Validate required fields
    if (!isset($data['transaction_id']) || empty($data['transaction_id'])) {
        throw new Exception('Transaction ID is required');
    }
    
    if (!isset($data['items']) || !is_array($data['items']) || empty($data['items'])) {
        throw new Exception('Items array is required and cannot be empty');
    }
    
    $transaction_id = intval($data['transaction_id']);
    $user_id = isset($data['user_id']) ? intval($data['user_id']) : null;
    $global_discount = isset($data['global_discount']) ? floatval($data['global_discount']) : 0;
    $cash_tendered = isset($data['cash_tendered']) ? floatval($data['cash_tendered']) : 0;
    $additional_payment = isset($data['additional_payment']) ? floatval($data['additional_payment']) : 0;
    $items = $data['items'];
    
    // Validate global discount range
    if ($global_discount < 0 || $global_discount > 100) {
        throw new Exception('Global discount must be between 0 and 100');
    }
    
    // Validate cash tendered
    if ($cash_tendered < 0) {
        throw new Exception('Cash tendered cannot be negative');
    }
    
    // Validate additional payment
    if ($additional_payment < 0) {
        throw new Exception('Additional payment cannot be negative');
    }
    
    // Add additional payment to cash_tendered if provided
    if ($additional_payment > 0) {
        $cash_tendered = $cash_tendered + $additional_payment;
    }
    
    // Declare variables at function scope so they're accessible in catch blocks
    $calculated_total = 0;
    $balance_due = 0;
    $cash_tendered_to_update = $cash_tendered;
    
    // Start transaction for data integrity
    $pdo->beginTransaction();
    
    try {
            // Check if receipt exists
            $stmt = $pdo->prepare("SELECT receipt_id FROM receipt WHERE receipt_id = ?");
            $stmt->execute([$transaction_id]);
            $existing_receipt = $stmt->fetch();
            
            if (!$existing_receipt) {
                throw new Exception('Receipt not found');
            }
            
            // Get old receipt items to restore stock
            $stmt = $pdo->prepare("SELECT inventory_id, quantity FROM receipt_items WHERE receipt_id = ?");
            $stmt->execute([$transaction_id]);
            $old_items = $stmt->fetchAll();
            
            // CRITICAL: Delete sale_items BEFORE deleting receipt_items to avoid foreign key constraint violation
            // sale_items has a foreign key (receipt_item_id) that references receipt_items (item_id)
            // We must delete child records (sale_items) before parent records (receipt_items)
            $stmt = $pdo->prepare("DELETE FROM sale_items WHERE receipt_item_id IN (SELECT item_id FROM receipt_items WHERE receipt_id = ?)");
            $stmt->execute([$transaction_id]);
            
            // Delete sale_summary for this receipt
            $stmt = $pdo->prepare("DELETE FROM sale_summary WHERE receipt_id = ?");
            $stmt->execute([$transaction_id]);
            
            // Restore stock for old items
            foreach ($old_items as $old_item) {
                $stmt = $pdo->prepare("UPDATE inventory SET stock = stock + ? WHERE id = ?");
                $stmt->execute([$old_item['quantity'], $old_item['inventory_id']]);
            }
            
            // Delete old receipt items (now safe since sale_items are already deleted)
            $stmt = $pdo->prepare("DELETE FROM receipt_items WHERE receipt_id = ?");
            $stmt->execute([$transaction_id]);
            
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
                
            // Calculate item values (before discounts)
            $item_subtotal = $price_each * $quantity;
            $item_discount_amount = $item_subtotal * ($discount_percent / 100);
            
            // Add to subtotal (before discounts) and total item discount
            $subtotal += $item_subtotal;
            $total_item_discount += $item_discount_amount;
            
            // Insert receipt item
            $stmt = $pdo->prepare("
                INSERT INTO receipt_items 
                (receipt_id, inventory_id, quantity, price_each, discount_percent) 
                VALUES (?, ?, ?, ?, ?)
            ");
            $stmt->execute([$transaction_id, $inventory_id, $quantity, $price_each, $discount_percent]);
            
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
        
        // Calculate total with discounts
        // Subtotal = sum of all (price * quantity) before discounts
        // Total = subtotal - total_item_discount - global_discount_amount
        $global_discount_amount = $subtotal * ($global_discount / 100);
        $calculated_total = $subtotal - $total_item_discount - $global_discount_amount;
        $calculated_change_due = $cash_tendered - $calculated_total;
        
        // Calculate balance_due if cash_tendered is less than total
        $balance_due = 0;
        $cash_tendered_to_update = $cash_tendered; // Default: use original cash_tendered
        
        if ($calculated_change_due < 0) {
            $balance_due = abs($calculated_change_due);
            // If no additional payment was provided, we need to prevent database constraint violation
            // Set cash_tendered to total_amount so change_due = 0 (avoids negative change_due constraint)
            // The balance_due will be returned to frontend for additional payment
            if ($additional_payment > 0) {
                // Additional payment was provided, use updated cash_tendered (already added above)
                $calculated_change_due = $cash_tendered - $calculated_total;
            } else {
                // No additional payment yet - set cash_tendered to total_amount to avoid constraint violation
                // This makes change_due = 0 in database, but we track balance_due separately
                $cash_tendered_to_update = $calculated_total;
                $calculated_change_due = 0;
            }
        }
        
        // Set timezone to ensure correct time recording (same as complete_purchase.php)
        date_default_timezone_set('Asia/Manila'); // Adjust to your timezone
        
        // Get the original transaction date to preserve it
        $stmt = $pdo->prepare("SELECT date_issued FROM receipt WHERE receipt_id = ?");
        $stmt->execute([$transaction_id]);
        $original_receipt = $stmt->fetch();
        $original_date_issued = $original_receipt ? $original_receipt['date_issued'] : date('Y-m-d H:i:s');
        
        // IMPORTANT: All receipt_items are now inserted (from the loop above)
        // Now update the receipt table with the correct calculated values
        // If total_amount and change_due are generated columns, they should recalculate
        // based on: total_amount = subtotal - total_item_discount - cart_discount_amount
        // and: change_due = cash_tendered - total_amount
        
        // Update receipt base columns only
        // NOTE: total_amount and change_due are generated columns and cannot be updated directly
        // They will automatically recalculate when we update the base columns:
        // - total_amount = subtotal - total_item_discount - cart_discount_amount
        // - change_due = cash_tendered - total_amount
        // Preserve the original date_issued to maintain transaction timestamp
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
            round($cash_tendered_to_update, 2), // Use adjusted cash_tendered to avoid constraint violation
            $original_date_issued, // Preserve original transaction date
            $transaction_id
        ]);
        
        error_log("Updated base columns. Generated columns (total_amount, change_due) should recalculate automatically.");
        
        // CRITICAL: Wait a moment to ensure all database operations are committed
        // This is especially important for generated columns that need to recalculate
        usleep(200000); // 0.2 seconds
        
        // Fetch the updated receipt to get the final calculated values
        // This ensures we get the values calculated by the database (generated columns)
        $stmt = $pdo->prepare("SELECT change_due, total_amount, subtotal, total_item_discount, cart_discount_amount, cash_tendered FROM receipt WHERE receipt_id = ?");
        $stmt->execute([$transaction_id]);
        $updated_receipt = $stmt->fetch();
        
        // Get database values
        $db_total_amount = isset($updated_receipt['total_amount']) ? floatval($updated_receipt['total_amount']) : 0;
        $db_change_due = isset($updated_receipt['change_due']) ? floatval($updated_receipt['change_due']) : 0;
        
        // Verify the values are correct
        $total_mismatch = abs($db_total_amount - $calculated_total) > 0.01;
        $change_mismatch = abs($db_change_due - $calculated_change_due) > 0.01;
        
        error_log("After first update attempt:");
        error_log("  Calculated total: $calculated_total, DB total: $db_total_amount");
        error_log("  Calculated change: $calculated_change_due, DB change: $db_change_due");
        
        if ($total_mismatch || $change_mismatch) {
            error_log("Warning: Values mismatch detected!");
            error_log("  Calculated Total: $calculated_total, DB Total: $db_total_amount");
            error_log("  Calculated Change: $calculated_change_due, DB Change: $db_change_due");
            
            // AGGRESSIVE RETRY: Update base columns again to force generated column recalculation
            error_log("Attempting aggressive retry to force generated column recalculation...");
            
            // Update base columns one more time with exact values
            // This should trigger the generated columns (total_amount, change_due) to recalculate
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
                round($cash_tendered_to_update, 2), // Use adjusted cash_tendered to avoid constraint violation
                $original_date_issued, // Preserve original transaction date
                $transaction_id
            ]);
            
            // Wait and fetch again to check if generated columns recalculated
            usleep(200000); // 0.2 seconds
            $stmt = $pdo->prepare("SELECT total_amount, change_due FROM receipt WHERE receipt_id = ?");
            $stmt->execute([$transaction_id]);
            $recheck = $stmt->fetch();
            
            if ($recheck) {
                $db_total_amount = isset($recheck['total_amount']) ? floatval($recheck['total_amount']) : $db_total_amount;
                $db_change_due = isset($recheck['change_due']) ? floatval($recheck['change_due']) : $db_change_due;
                
                error_log("After aggressive retry - DB Total: $db_total_amount, DB Change: $db_change_due");
                
                // Re-check mismatch after retry
                $total_mismatch = abs($db_total_amount - $calculated_total) > 0.01;
                $change_mismatch = abs($db_change_due - $calculated_change_due) > 0.01;
                
                if ($total_mismatch || $change_mismatch) {
                    error_log("ERROR: Values still don't match after aggressive retry!");
                    error_log("This indicates generated columns have incorrect formulas in the database schema.");
                    error_log("Expected formula: total_amount = subtotal - total_item_discount - cart_discount_amount");
                    error_log("Expected formula: change_due = cash_tendered - total_amount");
                }
            }
        }
        
        // Use calculated values if there's a mismatch (they're always correct)
        // Otherwise use database values (they match our calculations)
        $total_amount = $total_mismatch ? $calculated_total : $db_total_amount;
        $change_due = $change_mismatch ? $calculated_change_due : $db_change_due;
        
        // Debug: Log the final values to help troubleshoot
        error_log("=== FINAL VALUES FOR RECEIPT $transaction_id ===");
        error_log("Subtotal: " . $subtotal);
        error_log("Total Item Discount: " . $total_item_discount);
        error_log("Cart Discount Amount: " . $global_discount_amount);
        error_log("Calculated Total: " . $calculated_total);
        error_log("Final Total Amount (to use): " . $total_amount);
        error_log("Original Cash Tendered: " . ($cash_tendered - $additional_payment));
        error_log("Additional Payment: " . $additional_payment);
        error_log("Cash Tendered to Update: " . $cash_tendered_to_update);
        error_log("Calculated Change Due: " . $calculated_change_due);
        error_log("Balance Due: " . $balance_due);
        error_log("Final Change Due (to use): " . $change_due);
        
        // Check if database values match calculated values
        if (abs($total_amount - $calculated_total) > 0.01 || abs($change_due - $calculated_change_due) > 0.01) {
            error_log("WARNING: Database values don't match calculated values!");
            error_log("This suggests total_amount and/or change_due are generated columns with incorrect formulas.");
            error_log("Please check your database schema and ensure the generated column formulas are:");
            error_log("  total_amount = subtotal - total_item_discount - cart_discount_amount");
            error_log("  change_due = cash_tendered - total_amount");
        }
        error_log("================================================");
        
        // Update sale_items and sale_summary tables
        // Note: sale_items and sale_summary were already deleted earlier (before deleting receipt_items)
        // Now we need to insert new records for the updated receipt_items
        
        // Get all receipt_items for this receipt (including newly inserted ones)
        $stmt = $pdo->prepare("
            SELECT ri.item_id, ri.inventory_id, ri.quantity, ri.price_each, ri.discount_percent, i.cost_price 
            FROM receipt_items ri 
            LEFT JOIN inventory i ON ri.inventory_id = i.id 
            WHERE ri.receipt_id = ?
        ");
        $stmt->execute([$transaction_id]);
        $all_receipt_items = $stmt->fetchAll();
        
        $total_cost_of_goods = 0;
        
        // Insert into sale_items for each receipt_item
        foreach ($all_receipt_items as $receipt_item) {
            $receipt_item_id = $receipt_item['item_id'];
            $inventory_id = $receipt_item['inventory_id'];
            $quantity = intval($receipt_item['quantity']);
            $price_each = floatval($receipt_item['price_each']);
            $discount_percent = isset($receipt_item['discount_percent']) ? floatval($receipt_item['discount_percent']) : 0;
            $cost_price = isset($receipt_item['cost_price']) ? floatval($receipt_item['cost_price']) : 0;
            
            // Calculate actual sell_price after discount (per unit)
            $actual_sell_price_per_unit = $price_each * (1 - ($discount_percent / 100));
            
            // Calculate profit: (actual_sell_price_per_unit - cost_price) * quantity
            // IMPORTANT: This can be negative if selling below cost (sell_price < cost_price)
            // Negative profit means selling at a loss - this should be recorded as negative value
            $profit = ($actual_sell_price_per_unit - $cost_price) * $quantity;
            
            // CRITICAL: Preserve negative values - do NOT use abs(), max(0, ...), or any function that converts negative to positive
            // Negative profit must be recorded as negative in sale_items table
            $profit = round($profit, 2);
            
            // Log negative profit for debugging
            if ($profit < 0) {
                error_log("Negative profit detected: Item ID $inventory_id, Profit: $profit, Sell Price: $actual_sell_price_per_unit, Cost Price: $cost_price, Quantity: $quantity");
            }
            
            $total_cost_of_goods += $cost_price * $quantity;
            
            $stmt = $pdo->prepare("
                INSERT INTO sale_items 
                (receipt_item_id, inventory_id, quantity, sell_price, cost_price, profit) 
                VALUES (?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $receipt_item_id,
                $inventory_id,
                $quantity,
                round($actual_sell_price_per_unit, 2), // Store the discounted price per unit
                round($cost_price, 2),
                $profit // IMPORTANT: Can be negative - preserves negative profit when selling below cost
            ]);
        }
        
        // Calculate values for sale_summary
        $gross_amount = round($subtotal, 2); // Subtotal before discounts
        $discount_amount = round($total_item_discount + $global_discount_amount, 2); // Total discounts
        $net_sales = round($total_amount, 2); // Final total after all discounts
        $cost_of_goods = round($total_cost_of_goods, 2); // Total cost of all items
        $profit = round($net_sales - $cost_of_goods, 2); // Net profit
        
        // Insert into sale_summary table
        $stmt = $pdo->prepare("
            INSERT INTO sale_summary 
            (receipt_id, gross_amount, discount_amount, net_sales, cost_of_goods, profit, created_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $transaction_id,
            $gross_amount,
            $discount_amount,
            $net_sales,
            $cost_of_goods,
            $profit,
            $original_date_issued
        ]);
        
        // Commit transaction
        $pdo->commit();
        
        // Return success response
        // IMPORTANT: Always use calculated values in response to ensure accuracy
        // even if database generated columns haven't updated yet
        $response_data = [
            'receipt_id' => $transaction_id,
            'subtotal' => round($subtotal, 2),
            'total_item_discount' => round($total_item_discount, 2),
            'global_discount' => $global_discount,
            'cart_discount_amount' => round($global_discount_amount, 2),
            'total_amount' => round($calculated_total, 2), // Always use calculated value
            'cash_tendered' => round($cash_tendered, 2), // Return the actual cash_tendered (including additional payment if any)
            'change_due' => round($calculated_change_due, 2), // Always use calculated value
            'items' => $new_items_data,
            'date_issued' => $original_date_issued
        ];
        
        // Include balance_due if additional payment is required
        if ($balance_due > 0 && $additional_payment == 0) {
            $response_data['balance_due'] = round($balance_due, 2);
            $response_data['requires_additional_payment'] = true;
        } else {
            $response_data['requires_additional_payment'] = false;
        }
        
        echo json_encode([
            'status' => 'success',
            'message' => 'Receipt updated successfully',
            'data' => $response_data
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_NUMERIC_CHECK);
        
    } catch (Exception $e) {
        // Rollback transaction on error
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
        
    } catch (PDOException $e) {
        // Rollback transaction on database error
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        
        // Check if error is related to cash_tendered constraint
        $errorMessage = $e->getMessage();
        if (stripos($errorMessage, 'cash tendered') !== false || 
            stripos($errorMessage, 'change_due') !== false ||
            stripos($errorMessage, 'less than') !== false) {
            
            // This is likely a constraint violation for insufficient cash
            // We need to calculate the new total from the items we tried to update
            // The variables $calculated_total and $cash_tendered should still be available
            if (isset($calculated_total) && isset($cash_tendered)) {
                $original_cash = $cash_tendered - $additional_payment;
                $balance_due = $calculated_total - $original_cash;
                
                if ($balance_due > 0) {
                    // Return success with balance_due instead of error
                    echo json_encode([
                        'status' => 'success',
                        'message' => 'Receipt update requires additional payment',
                        'data' => [
                            'receipt_id' => $transaction_id,
                            'balance_due' => round($balance_due, 2),
                            'requires_additional_payment' => true,
                            'total_amount' => round($calculated_total, 2),
                            'cash_tendered' => round($original_cash, 2)
                        ]
                    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_NUMERIC_CHECK);
                    return;
                }
            }
        }
        
        // Database error
        http_response_code(500);
        echo json_encode([
            'status' => 'error',
            'message' => 'Database error: ' . $errorMessage
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_NUMERIC_CHECK);
        
    } catch (Exception $e) {
        // Rollback transaction on general error
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        
        // Check if error message indicates insufficient cash
        $errorMessage = $e->getMessage();
        if (stripos($errorMessage, 'cash tendered') !== false && 
            stripos($errorMessage, 'less than') !== false) {
            
            // Try to calculate balance_due from the data we attempted to update
            // Since we calculated it earlier, we can use those values
            if (isset($calculated_total) && isset($cash_tendered)) {
                $balance_due = $calculated_total - ($cash_tendered - $additional_payment);
                if ($balance_due > 0) {
                    echo json_encode([
                        'status' => 'success',
                        'message' => 'Receipt update requires additional payment',
                        'data' => [
                            'receipt_id' => $transaction_id,
                            'balance_due' => round($balance_due, 2),
                            'requires_additional_payment' => true,
                            'total_amount' => round($calculated_total, 2),
                            'cash_tendered' => round($cash_tendered - $additional_payment, 2)
                        ]
                    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_NUMERIC_CHECK);
                    return;
                }
            }
        }
        
        // General error
        http_response_code(400);
        echo json_encode([
            'status' => 'error',
            'message' => $errorMessage
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_NUMERIC_CHECK);
    }
    ?>

