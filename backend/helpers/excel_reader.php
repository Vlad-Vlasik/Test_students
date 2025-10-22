<?php
use PhpOffice\PhpSpreadsheet\IOFactory;

/**
 * Читає питання з Excel, ідентифікує правильні відповіді за символом '+'
 * * @param string $filePath Шлях до файлу Excel.
 * @return array Масив питань.
 */
function readQuestionsFromExcel($filePath) {
    if (!file_exists($filePath)) {
        error_log("Excel file not found at: " . $filePath);
        return [];
    }
    
    try {
        $spreadsheet = IOFactory::load($filePath);
    } catch (\PhpOffice\PhpSpreadsheet\Reader\Exception $e) {
        error_log("Excel Read Error: " . $e->getMessage());
        return [];
    }
    
    $sheet = $spreadsheet->getActiveSheet();
    $questions = [];
    $row = 2; 

    while(true) {
        $questionText = trim($sheet->getCell("A$row")->getValue());
        if(empty($questionText)) break;

        $options = [];
        $correctAnswerIndex = null;

        // Починаємо з колонки 2 (B) до 5 (E) для варіантів
        for ($col = 2; $col <= 5; $col++) { 
            $option = trim($sheet->getCellByColumnAndRow($col, $row)->getValue());
            if (empty($option)) continue;

            $currentIndex = $col - 2; 

            if (strpos($option, '+') === 0) {
                $option = substr($option, 1); // Видаляємо знак '+'
                $correctAnswerIndex = $currentIndex; 
            }
            $options[] = $option;
        }

        $questions[] = [
            'text' => $questionText,
            'options' => $options,
            'correct_index' => $correctAnswerIndex
        ];
        $row++;
    }
    return $questions;
}