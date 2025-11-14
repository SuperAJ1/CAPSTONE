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

// Check if database connection is available
if (!isset($pdo) || $pdo === null) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Database connection failed'
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
    if (!isset($data['items']) || !is_array($data['items']) || empty($data['items'])) {
        throw new Exception('Items array is required and cannot be empty');
    }
    
    if (!isset($data['user_id']) || empty($data['user_id'])) {
        throw new Exception('User ID is required');
    }
    
    $user_id = intval($data['user_id']);
    $global_discount = isset($data['global_discount']) ? floatval($data['global_discount']) : 0;
    $cash_tendered = isset($data['cash_tendered']) ? floatval($data['cash_tendered']) : 0;
    $custom_total_amount = isset($data['total_amount']) ? floatval($data['total_amount']) : null;
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
        
        // Calculate total with global discount or use custom total amount if provided
        // Round subtotal and total_item_discount to avoid floating-point precision issues
        $rounded_subtotal = round($subtotal, 2);
        $rounded_total_item_discount = round($total_item_discount, 2);
        $calculated_subtotal_after_item_discount = $rounded_subtotal - $rounded_total_item_discount;
        $calculated_subtotal_after_item_discount = round($calculated_subtotal_after_item_discount, 2);
        
        // Round custom_total_amount if provided
        $rounded_custom_total_amount = $custom_total_amount !== null ? round($custom_total_amount, 2) : null;
        
        if ($rounded_custom_total_amount !== null && $rounded_custom_total_amount >= 0 && abs($rounded_custom_total_amount - $calculated_subtotal_after_item_discount) > 0.01) {
            // Use custom total amount from frontend (user edited total)
            // Calculate cart_discount_amount needed to achieve this total
            // Formula: total_amount = subtotal - total_item_discount - cart_discount_amount
            // So: cart_discount_amount = subtotal - total_item_discount - total_amount
            $global_discount_amount = $calculated_subtotal_after_item_discount - $rounded_custom_total_amount;
            $global_discount_amount = round($global_discount_amount, 2);
            
            // Allow total to exceed subtotal (removed validation)
            // If total is higher than subtotal, global_discount_amount will be negative (representing additional charges/fees)
            // This is now allowed for cases where extra charges need to be added
            
            // Validate: total should not be negative
            if ($rounded_custom_total_amount < 0) {
                throw new Exception('Custom total amount cannot be negative');
            }
            
            $total_amount = $rounded_custom_total_amount;
            
            // Calculate the equivalent global_discount percentage for display
            // If global_discount_amount is negative (additional charges), set cart_discount to 0
            // The additional charges will be stored in cart_discount_amount (negative value)
            if ($global_discount_amount < 0) {
                // Additional charges case: set cart_discount to 0, store negative amount in cart_discount_amount
                $global_discount = 0;
            } else if ($rounded_subtotal > 0) {
                // Normal discount case: calculate percentage
                $global_discount = round(($global_discount_amount / $rounded_subtotal) * 100, 2);
            } else {
                $global_discount = 0;
            }
        } else {
            // Use normal calculation with global discount
            // Round values to avoid floating-point precision issues
            $global_discount_amount = round($rounded_subtotal * ($global_discount / 100), 2);
            $total_amount = $calculated_subtotal_after_item_discount - $global_discount_amount;
            $total_amount = round($total_amount, 2);
        }
        
        // Ensure total_amount is rounded to 2 decimal places
        $total_amount = round($total_amount, 2);
        
        // Round cash_tendered to 2 decimal places to avoid floating-point precision issues
        $rounded_cash_tendered = round($cash_tendered, 2);
        
        $change_due = $rounded_cash_tendered - $total_amount;
        
        // Validate change with tolerance for floating-point precision (allow up to 0.01 difference)
        // This handles cases where floating-point arithmetic causes tiny differences
        // If change_due is between -0.01 and 0, it's likely due to precision and we allow it
        if ($change_due < -0.01) {
            throw new Exception('Cash tendered is less than the total amount');
        }
        
        // Ensure change_due is not negative (set to 0 if it's between -0.01 and 0 due to precision)
        if ($change_due < 0) {
            $change_due = 0;
        }
        
        // Round change_due to 2 decimal places
        $change_due = round($change_due, 2);
        
        // Round global_discount_amount for database insertion
        $rounded_cart_discount_amount = round($global_discount_amount, 2);
        
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
            $rounded_subtotal,  // Already rounded to 2 decimal places
            $rounded_total_item_discount,  // Already rounded to 2 decimal places
            round($global_discount, 2),
            $rounded_cart_discount_amount,  // Already rounded to 2 decimal places
            $rounded_cash_tendered,  // Already rounded to 2 decimal places
            $current_datetime
        ]);
        
        // Log for debugging (suppress errors if logging fails)
        @error_log("Inserted receipt with base columns. Generated columns (total_amount, change_due) should calculate automatically.");
        
        // Get the inserted receipt ID
        $receipt_id = $pdo->lastInsertId();
        
        // Insert receipt items FIRST (before updating receipt)
        // This ensures generated columns can see the receipt_items when calculating
        $receipt_item_ids = []; // Store receipt_item_id for each item
        $total_cost_of_goods = 0; // Track total cost for sale_summary
        
        foreach ($items as $item) {
            $inventory_id = intval($item['product_id']);
            $quantity = intval($item['quantity']);
            $price_each = floatval($item['price']);
            $discount_percent = isset($item['discount']) ? floatval($item['discount']) : 0;
            
            // Get cost_price from inventory
            $stmt = $pdo->prepare("SELECT cost_price FROM inventory WHERE id = ?");
            $stmt->execute([$inventory_id]);
            $inventory_data = $stmt->fetch();
            $cost_price = isset($inventory_data['cost_price']) ? floatval($inventory_data['cost_price']) : 0;
            
            $stmt = $pdo->prepare("
                INSERT INTO receipt_items 
                (receipt_id, inventory_id, quantity, price_each, discount_percent) 
                VALUES (?, ?, ?, ?, ?)
            ");
            $stmt->execute([$receipt_id, $inventory_id, $quantity, $price_each, $discount_percent]);
            
            // Get the inserted receipt_item_id
            $receipt_item_id = $pdo->lastInsertId();
            // Calculate actual sell_price after discount
            $item_subtotal = $price_each * $quantity;
            $item_discount_amount = $item_subtotal * ($discount_percent / 100);
            $actual_sell_price_per_unit = $price_each * (1 - ($discount_percent / 100));
            
            $receipt_item_ids[] = [
                'receipt_item_id' => $receipt_item_id,
                'inventory_id' => $inventory_id,
                'quantity' => $quantity,
                'sell_price' => $actual_sell_price_per_unit, // Price per unit after discount
                'cost_price' => $cost_price,
                'discount_percent' => $discount_percent
            ];
            
            // Calculate cost of goods for this item
            $total_cost_of_goods += $cost_price * $quantity;
        }
        
        // Now update the receipt to ensure all columns are set correctly
        // This triggers the generated columns to recalculate
        // Use the total_amount we calculated (which may be custom from frontend)
        $calculated_total = $total_amount; // Already rounded to 2 decimal places
        $calculated_change_due = $change_due; // Already rounded to 2 decimal places
        
        // Update receipt with all calculated values
        // Note: total_amount is a generated column, so we can't update it directly
        // Instead, we set cart_discount_amount correctly so the database calculates the right total_amount
        // Formula: total_amount = subtotal - total_item_discount - cart_discount_amount (generated column)
        // All values are already rounded to 2 decimal places above
        // $rounded_cart_discount_amount is already defined above before INSERT statement
        
        // Verify the calculation: subtotal - total_item_discount - cart_discount_amount should equal total_amount
        $expected_total = $rounded_subtotal - $rounded_total_item_discount - $rounded_cart_discount_amount;
        $expected_total = round($expected_total, 2);
        
        // Log for debugging (suppress errors if logging fails)
        @error_log("Receipt calculation - Subtotal: $rounded_subtotal, Item Discount: $rounded_total_item_discount, Cart Discount: $rounded_cart_discount_amount");
        @error_log("Expected total_amount: $expected_total, Calculated total: $calculated_total, Custom total: " . ($custom_total_amount ?? 'null'));
        
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
            $rounded_subtotal,
            $rounded_total_item_discount,
            round($global_discount, 2),
            $rounded_cart_discount_amount,
            $rounded_cash_tendered,
            $current_datetime,
            $receipt_id
        ]);
        
        // Fetch the updated receipt to get the calculated change_due and total_amount
        // This ensures we get the values calculated by the database (generated columns)
        $stmt = $pdo->prepare("SELECT change_due, total_amount, subtotal, total_item_discount, cart_discount_amount, cash_tendered FROM receipt WHERE receipt_id = ?");
        $stmt->execute([$receipt_id]);
        $inserted_receipt = $stmt->fetch();
        
        // Use database-calculated values
        $db_total_amount = isset($inserted_receipt['total_amount']) ? floatval($inserted_receipt['total_amount']) : null;
        $db_change_due = isset($inserted_receipt['change_due']) ? floatval($inserted_receipt['change_due']) : null;
        
        // Log database values (suppress errors if logging fails)
        @error_log("Database total_amount: $db_total_amount, Expected: $expected_total, Calculated: $calculated_total");
        
        // If custom total was provided, prioritize it over database calculated value
        if ($custom_total_amount !== null && $custom_total_amount >= 0) {
            $total_amount = round($custom_total_amount, 2);
            $change_due = round($cash_tendered - $total_amount, 2);
            @error_log("Using custom total_amount: $total_amount");
        } else {
            // Use database value if available and close to expected, otherwise use calculated
            if ($db_total_amount !== null && abs($db_total_amount - $expected_total) < 0.01) {
                $total_amount = round($db_total_amount, 2);
                $change_due = $db_change_due !== null ? round($db_change_due, 2) : $calculated_change_due;
            } else {
                $total_amount = $calculated_total;
                $change_due = $calculated_change_due;
                if ($db_total_amount !== null) {
                    @error_log("Warning: Database total_amount ($db_total_amount) doesn't match expected ($expected_total). Using calculated value ($calculated_total).");
                }
            }
        }
        
        // Calculate additional charges if total > subtotal after item discounts
        $calculated_subtotal_after_item_discount = $subtotal - $total_item_discount;
        $additional_charges = 0;
        if ($total_amount > $calculated_subtotal_after_item_discount) {
            $additional_charges = $total_amount - $calculated_subtotal_after_item_discount;
        }
        
        // Calculate total sell price for proportional distribution of additional charges
        $total_sell_price = 0;
        foreach ($receipt_item_ids as $item_data) {
            $sell_price_per_unit = floatval($item_data['sell_price']);
            $quantity = intval($item_data['quantity']);
            $total_sell_price += $sell_price_per_unit * $quantity;
        }
        
        $total_profit_from_items = 0; // Sum of all sale_items profits
        
        // Insert into sale_items table (one record per receipt_item)
        foreach ($receipt_item_ids as $item_data) {
            $sell_price_per_unit = floatval($item_data['sell_price']); // Price per unit after discount
            $cost_price = floatval($item_data['cost_price']);
            $quantity = intval($item_data['quantity']);
            
            // Calculate base profit: (actual_sell_price_per_unit - cost_price) * quantity
            // IMPORTANT: This can be negative if selling below cost (sell_price < cost_price)
            // Negative profit means selling at a loss - this should be recorded as negative value
            $base_profit = ($sell_price_per_unit - $cost_price) * $quantity;
            
            // Distribute additional charges proportionally based on item's contribution to total sell price
            $item_sell_price_total = $sell_price_per_unit * $quantity;
            $additional_charges_share = 0;
            if ($additional_charges > 0 && $total_sell_price > 0) {
                // Calculate proportional share: (item_sell_price / total_sell_price) * additional_charges
                $additional_charges_share = ($item_sell_price_total / $total_sell_price) * $additional_charges;
            }
            
            // Total profit = base profit + additional charges share
            $profit = $base_profit + $additional_charges_share;
            
            // CRITICAL: Preserve negative values - do NOT use abs(), max(0, ...), or any function that converts negative to positive
            // Negative profit must be recorded as negative in sale_items table
            $profit = round($profit, 2);
            
            // Accumulate profit for sale_summary
            $total_profit_from_items += $profit;
            
            // Log negative profit for debugging
            if ($profit < 0) {
                error_log("Negative profit detected: Item ID {$item_data['inventory_id']}, Profit: $profit, Sell Price: $sell_price_per_unit, Cost Price: $cost_price, Quantity: $quantity");
            }
            
            $stmt = $pdo->prepare("
                INSERT INTO sale_items 
                (receipt_item_id, inventory_id, quantity, sell_price, cost_price, profit) 
                VALUES (?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $item_data['receipt_item_id'],
                $item_data['inventory_id'],
                $quantity,
                round($sell_price_per_unit, 2), // Store the discounted price per unit
                round($cost_price, 2),
                $profit // IMPORTANT: Can be negative - preserves negative profit when selling below cost
            ]);
        }
        
        // Calculate values for sale_summary
        $gross_amount = round($subtotal, 2); // Subtotal before discounts
        $discount_amount = round($total_item_discount + $global_discount_amount, 2); // Total discounts (can be negative if additional charges)
        $net_sales = round($total_amount, 2); // Final total after all discounts/charges
        $cost_of_goods = round($total_cost_of_goods, 2); // Total cost of all items
        
        // Calculate profit: net_sales - cost_of_goods
        // When total > subtotal (additional charges), profit should include those additional charges
        // This ensures profit = (total amount received) - (total cost of goods)
        // Formula: profit = net_sales - cost_of_goods
        // When total exceeds subtotal, the additional charges are part of net_sales, so profit increases accordingly
        $profit = round($net_sales - $cost_of_goods, 2);
        
        // Insert into sale_summary table (one record per receipt)
        $stmt = $pdo->prepare("
            INSERT INTO sale_summary 
            (receipt_id, gross_amount, discount_amount, net_sales, cost_of_goods, profit, created_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $receipt_id,
            $gross_amount,
            $discount_amount,
            $net_sales,
            $cost_of_goods,
            $profit,
            $current_datetime
        ]);
        
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


