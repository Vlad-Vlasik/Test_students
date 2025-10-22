<?php
// log_violation.php
session_start();
header('Content-Type: application/json');

$input = json_decode(file_get_contents('php://input'), true);

if (empty($input) || !isset($input['test_id'], $input['student_name'], $input['event_type'])) {
    http_response_code(400); 
    echo json_encode(['error' => 'Missing required data.']);
    exit;
}

$testId = $input['test_id'];
if (!isset($_SESSION['test_logs'][$testId])) {
    $_SESSION['test_logs'][$testId] = [];
}

$logEntry = [
    'timestamp' => date('Y-m-d H:i:s'),
    'test_id' => $testId,
    'student_name' => $input['student_name'],
    'class' => $input['class'] ?? 'N/A', 
    'event_type' => $input['event_type'],
    'violation_count' => $input['violation_count'] ?? 0 
];

$_SESSION['test_logs'][$testId][] = $logEntry;

echo json_encode(['status' => 'logged', 'log_count' => count($_SESSION['test_logs'][$testId])]);

// У реальному проєкті тут має бути запис у Базу Даних!
?>