<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

require_once 'db_connection.php';

try {
    // Try to join with category table to get category name
    // Table name is 'category' (singular), not 'categories'
    // inventory.category_id -> category.category_id -> category.category (name)
    $products = [];
    
    try {
        // First try with JOIN to get category names
        $sql = "SELECT 
                    i.id, 
                    i.name, 
                    i.description, 
                    i.price, 
                    i.cost_price,
                    i.stock, 
                    i.category_id, 
                    COALESCE(c.category, '') as category,
                    i.qr_code,
                    i.date_added,
                    i.date_updated
                FROM inventory i
                LEFT JOIN category c ON i.category_id = c.category_id
                ORDER BY i.name ASC";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute();
        $products = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (PDOException $joinError) {
        // If JOIN fails, fallback to simple query without JOIN
        // Log the error for debugging but continue with fallback
        error_log("Category JOIN failed: " . $joinError->getMessage());
        
        $sql = "SELECT 
                    id, 
                    name, 
                    description, 
                    price, 
                    cost_price,
                    stock, 
                    category_id, 
                    '' as category,
                    qr_code,
                    date_added,
                    date_updated
                FROM inventory 
                ORDER BY name ASC";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute();
        $products = $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    // Format the response
    $formattedProducts = array_map(function($product) {
        return [
            'id' => intval($product['id']),
            'name' => $product['name'],
            'description' => $product['description'] ?? '',
            'price' => floatval($product['price']),
            'cost_price' => floatval($product['cost_price'] ?? 0),
            'costPrice' => floatval($product['cost_price'] ?? 0), // Also include camelCase for compatibility
            'stock' => intval($product['stock']),
            'category_id' => intval($product['category_id'] ?? 0),
            'category' => $product['category'] ?? '',
            'qr_code_data' => '', // QR code is BLOB, not used as text
            'date_added' => $product['date_added'] ?? '',
            'date_updated' => $product['date_updated'] ?? '',
            'created_at' => $product['date_added'] ?? '', // Alias for compatibility
            'updated_at' => $product['date_updated'] ?? '' // Alias for compatibility
        ];
    }, $products);
    
    echo json_encode([
        'status' => 'success',
        'data' => $formattedProducts,
        'count' => count($formattedProducts)
    ]);
    
} catch (PDOException $e) {
    http_response_code(500);
    error_log("get_inventory.php PDO Error: " . $e->getMessage());
    error_log("Error Code: " . $e->getCode());
    echo json_encode([
        'status' => 'error',
        'message' => 'Database error: ' . $e->getMessage(),
        'error_code' => $e->getCode()
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (Exception $e) {
    http_response_code(500);
    error_log("get_inventory.php General Error: " . $e->getMessage());
    echo json_encode([
        'status' => 'error',
        'message' => 'Server error: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
?>

