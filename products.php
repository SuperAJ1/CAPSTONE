<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

require_once 'db_connection.php';

// Get search parameter
$search = isset($_GET['search']) ? trim($_GET['search']) : '';

try {
    // Build query with search functionality
    if (!empty($search)) {
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
                WHERE (name LIKE ? OR description LIKE ?)
                AND stock > 0
                ORDER BY name ASC";
        $searchParam = "%{$search}%";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$searchParam, $searchParam]);
    } else {
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
                WHERE stock > 0
                ORDER BY name ASC";
        $stmt = $pdo->prepare($sql);
        $stmt->execute();
    }
    
    $products = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
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

