<?php
// start_test.php
session_start();
header('Content-Type: application/json');

// Вантажимо автозавантажувач Composer (для PhpSpreadsheet та excel_reader.php)
require '../../vendor/autoload.php'; 

// --- 1. Налаштування (Mock Read) ---
$settings = [
    'MODE' => 'BLOCK_PERM',
    'MAX_VIOLATIONS' => 1
];
// В реальному проєкті тут має бути логіка читання settings.txt
$settingsFile = '../../data/settings.txt';
if (file_exists($settingsFile)) {
    $content = file_get_contents($settingsFile);
    if (preg_match('/MODE=([A-Z_]+)/', $content, $m)) {
        $settings['MODE'] = $m[1];
    }
    if (preg_match('/MAX_VIOLATIONS=(\d+)/', $content, $m)) {
        $settings['MAX_VIOLATIONS'] = (int)$m[1];
    }
}


// --- 2. Валідація Вхідних Даних ---
$input = json_decode(file_get_contents('php://input'), true);
$name = trim($input['name'] ?? '');
$studentClass = trim($input['studentClass'] ?? '');

if (!$name || !$studentClass) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing name or class data.']);
    exit;
}

// --- 3. Читання та Рандомізація ---
$excelFilePath = '../../data/questions.xlsx';
$questions = readQuestionsFromExcel($excelFilePath);

if (empty($questions)) {
    http_response_code(500);
    echo json_encode(['error' => 'Could not load questions. Check Excel file and helper.']);
    exit;
}

// 3.1. Рандомізація порядку питань
shuffle($questions);

// 3.2. Рандомізація порядку варіантів відповідей
foreach ($questions as $qIndex => &$q) {
    $opts = $q['options'];
    $originalCorrectIndex = $q['correct_index'];

    $optIndices = range(0, count($opts) - 1);
    shuffle($optIndices);

    $newOptions = [];
    $newCorrectIndex = null;
    
    foreach ($optIndices as $i => $oldIndex) {
        $newOptions[] = $opts[$oldIndex];
        if ($oldIndex === $originalCorrectIndex) {
            $newCorrectIndex = $i;
        }
    }

    $q['options'] = $newOptions;
    $q['correct_index'] = $newCorrectIndex; 
}
unset($q); 

// --- 4. Збереження Сесії ---
$test_id = 'T-' . time() . '-' . bin2hex(random_bytes(3));

$_SESSION['tests'][$test_id] = [
    'name' => $name,
    'studentClass' => $studentClass,
    'questions' => $questions, 
    'mode' => $settings['MODE'],
    'max_violations' => $settings['MAX_VIOLATIONS']
];

// --- 5. Генерація HTML ---
$html = '<form id="quiz-form">';
$html .= '<h2>Тест: ' . $test_id . '</h2>';
$html .= '<div id="quiz-container">';

foreach ($questions as $idx => $q) {
    // qid = q0, q1, q2... 
    $qid = 'q' . $idx; 
    
    $html .= '<div class="question-block">';
    $html .= '<p><strong>' . ($idx + 1) . '. ' . htmlspecialchars($q['text']) . '</strong></p>';
    $html .= '<div class="options">';
    
    foreach ($q['options'] as $optIdx => $opt) {
        // VALUE - це новий індекс (0, 1, 2, 3), який submit_test.php буде порівнювати
        $html .= '<label>';
        $html .= '<input type="radio" name="' . $qid . '" value="' . htmlspecialchars($optIdx) . '" required>';
        $html .= htmlspecialchars($opt);
        $html .= '</label>';
    }
    $html .= '</div></div>';
}

$html .= '</div>';
$html .= '<div class="test-footer">';
$html .= '<p id="violation-counter">Спроб виходу: 0 (Макс: ' . $settings['MAX_VIOLATIONS'] . ')</p>';
$html .= '<button type="submit" id="submit-test-btn">Завершити та Відправити</button>';
$html .= '</div>';
$html .= '</form>';


// --- 6. Output JSON ---
echo json_encode([
    'html_content' => $html,
    'test_id' => $test_id,
    'mode' => $settings['MODE'],
    'max_violations' => $settings['MAX_VIOLATIONS']
]);
?>