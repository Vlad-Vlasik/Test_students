<?php
// log_violation.php
session_start();
header('Content-Type: application/json');

// --- НАЛАШТУВАННЯ ---
$VIOLATIONS_FILE = '../../data/violations.txt';
// !!! Важливо: переконайтеся, що папка /data/ має права на запис !!!

$input = json_decode(file_get_contents('php://input'), true);

if (empty($input) || !isset($input['test_id'], $input['student_name'], $input['event_type'])) {
    http_response_code(400); 
    echo json_encode(['error' => 'Missing required data.']);
    exit;
}

// --- 1. Формування лог-запису ---
$logEntry = [
    date('Y-m-d H:i:s'),
    $input['test_id'],
    $input['student_name'],
    $input['class'] ?? 'N/A', 
    $input['event_type'], // Тип порушення: Tab_Hidden, Test_Blocked_Perm, тощо
    $input['violation_count'] ?? 0 
];

// --- 2. ЗБЕРЕЖЕННЯ ЛОГУ У ФАЙЛ violations.txt ---
$csvLine = implode(';', $logEntry) . "\n";
file_put_contents($VIOLATIONS_FILE, $csvLine, FILE_APPEND | LOCK_EX);

// 3. Також можемо оновити лічильник у сесії (якщо потрібно для внутрішньої логіки)
$testId = $input['test_id'];
if (!isset($_SESSION['test_logs'][$testId])) {
    $_SESSION['test_logs'][$testId] = [];
}
$_SESSION['test_logs'][$testId][] = $logEntry;


// 4. Повернення успішної відповіді
echo json_encode(['status' => 'logged']);
?>