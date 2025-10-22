<?php
// submit_test.php
session_start();
header('Content-Type: application/json');

$input = json_decode(file_get_contents('php://input'), true);

$test_id = $input['test_id'] ?? null;
$answers = $input['answers'] ?? [];
$total_violations = $input['total_violations'] ?? 0;
$forced_submit = $input['forced_submit'] ?? false;

if (!$test_id || !isset($_SESSION['tests'][$test_id])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid or expired test session.']);
    exit;
}

$test_data = $_SESSION['tests'][$test_id];
$questions = $test_data['questions'];
$max_violations = $test_data['max_violations'];
$total_questions = count($questions);

// --- 1. Оцінювання ---
$correct_count = 0;
foreach ($answers as $qID => $selectedAnswerIndex) {
    $qIndex = intval(substr($qID, 1)); 

    if (!isset($questions[$qIndex])) continue;
    $question = $questions[$qIndex];
    
    // Порівнюємо вибраний індекс (рядок) з правильним індексом (ціле число)
    // PHP виконує м'яке порівняння, але приведемо до типу int для надійності
    if (intval($selectedAnswerIndex) === $question['correct_index']) {
        $correct_count++;
    } 
}


// --- 2. Конвертація Оцінки та Логіка Списування ---
$raw_score_percent = $correct_count / max($total_questions, 1);
$score_12 = 1;
$message = '';

if ($total_violations > $max_violations || $forced_submit) {
    // Анулювання
    $score_12 = ($raw_score_percent > 0.5) ? 2 : 1; 
    $message = 'Тест анульовано через спробу списування.';
} else {
    // Лінійна конвертація: 1 + (11 * %_правильних)
    $score_12 = ceil(1 + 11 * $raw_score_percent); 
    if ($score_12 > 12) $score_12 = 12;

    // Генерація повідомлення
    if ($score_12 >= 10) {
        $message = 'Вітаємо! Відмінний результат.';
    } elseif ($score_12 >= 7) {
        $message = 'Добре зроблено. Ви показали достатній рівень знань.';
    } else {
        $message = 'Тест зараховано, але потрібна додаткова підготовка.';
    }
}


// --- 3. Mock Збереження Результату ---
if (!isset($_SESSION['results'])) $_SESSION['results'] = [];
$_SESSION['results'][$test_id] = [
    'name' => $test_data['name'] ?? 'N/A',
    'studentClass' => $test_data['studentClass'] ?? 'N/A',
    'score_12' => $score_12,
    'correct_count' => $correct_count,
    'total_violations' => $total_violations,
    'message' => $message
];

// --- 4. Output JSON ---
echo json_encode([
    'score_12' => $score_12,
    'correct_count' => $correct_count,
    'message' => $message,
    'total_questions' => $total_questions 
]);
?>