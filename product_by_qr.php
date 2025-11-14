<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

require_once 'db_connection.php';

// Get QR code parameter
$qr_code = isset($_GET['qr_code']) ? trim($_GET['qr_code']) : '';

if (empty($qr_code)) {
    http_response_code(400);
    echo json_encode([
        'status' => 'error',
        'message' => 'QR code parameter is required'
    ]);
    exit;
}

try {
    // Query product by QR code or ID
    // Try to match by QR code first, then by ID if QR code doesn't match
    $sql = "SELECT 
                id, 
                name, 
                description, 
                price, 
                cost_price,
                stock, 
                category_id, 
                qr_code,
                date_added,
                date_updated
            FROM inventory 
            WHERE id = ?
            LIMIT 1";
    
    $stmt = $pdo->prepare($sql);
    // Try to parse as integer ID first, otherwise use as-is
    $productId = is_numeric($qr_code) ? intval($qr_code) : $qr_code;
    $stmt->execute([$productId]);
    $product = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$product) {
        http_response_code(404);
        echo json_encode([
            'status' => 'error',
            'message' => 'Product not found'
        ]);
        exit;
    }
    
    // Check if product is out of stock
    if (intval($product['stock']) <= 0) {
        echo json_encode([
            'status' => 'error',
            'message' => 'Product is out of stock',
            'data' => [
                'id' => intval($product['id']),
                'name' => $product['name'],
                'stock' => 0
            ]
        ]);
        exit;
    }
    
    // Format the response
    $formattedProduct = [
        'id' => intval($product['id']),
        'name' => $product['name'],
        'description' => $product['description'] ?? '',
        'price' => floatval($product['price']),
        'cost_price' => floatval($product['cost_price'] ?? 0),
        'costPrice' => floatval($product['cost_price'] ?? 0), // Also include camelCase for compatibility
        'stock' => intval($product['stock']),
        'category_id' => intval($product['category_id'] ?? 0),
        'qr_code_data' => '', // QR code is BLOB, not used as text
        'date_added' => $product['date_added'] ?? '',
        'date_updated' => $product['date_updated'] ?? '',
        'created_at' => $product['date_added'] ?? '', // Alias for compatibility
        'updated_at' => $product['date_updated'] ?? '' // Alias for compatibility
    ];
    
    echo json_encode([
        'status' => 'success',
        'data' => $formattedProduct
    ]);
    
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Database error: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Server error: ' . $e->getMessage()
    ]);
}
?>

