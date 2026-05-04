@echo off
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0\.."
set "ROOT=%CD%"
set "WORK_DIR=%TEMP%\clearmind_prepublish"
set "TMP_DIR=%WORK_DIR%\tmp"
set "REPORT_FILE=%WORK_DIR%\prepublish_report.txt"

if exist "%TMP_DIR%" rmdir /s /q "%TMP_DIR%"
if not exist "%WORK_DIR%" mkdir "%WORK_DIR%"
mkdir "%TMP_DIR%" >nul 2>&1

if exist "%REPORT_FILE%" del "%REPORT_FILE%"

set /a FINAL_EXIT=0
set /a TOTAL_CHECKS=4
set /a PASSED_CHECKS=0
set /a FAILED_CHECKS=0

set "DOM_LOG=%TMP_DIR%\dom_scan.txt"
set "DOM_TMP=%TMP_DIR%\dom_scan_raw.txt"
set "JS_LOG=%TMP_DIR%\js_check.txt"
set "JS_TMP=%TMP_DIR%\js_check_raw.txt"
set "JSON_LOG=%TMP_DIR%\json_check.txt"
set "JSON_TMP=%TMP_DIR%\json_check_raw.txt"
set "GIT_LOG=%TMP_DIR%\git_diff_check.txt"
set "GIT_TMP=%TMP_DIR%\git_diff_check_raw.txt"

call :ReportLine "ClearMind pre-publish check"
call :ReportLine "Date: %DATE% %TIME%"
call :BlankLine

call :RunDomScan
call :RunJsSyntaxCheck
call :RunJsonValidation
call :RunGitDiffCheck

call :BlankLine
call :ReportLine "Summary"
call :ReportLine "Passed: !PASSED_CHECKS! / !TOTAL_CHECKS!"
call :ReportLine "Failed: !FAILED_CHECKS! / !TOTAL_CHECKS!"

if !FAILED_CHECKS! gtr 0 (
    call :ReportLine "Result: FAIL"
    echo(
    echo One or more checks failed. See "%REPORT_FILE%" for details.
) else (
    call :ReportLine "Result: PASS"
    echo(
    echo All pre-publish checks passed.
)

echo(
echo Report:
type "%REPORT_FILE%"

if /i not "%~1"=="--nopause" (
    echo(
    echo Press any key to close this window...
    pause >nul
)

if exist "%TMP_DIR%" rmdir /s /q "%TMP_DIR%" >nul 2>&1
endlocal & exit /b %FINAL_EXIT%

:RunDomScan
call :ReportLine "1) Dynamic HTML sink scan"
rg -n -S --glob "!builds/**" --glob "!.git/**" "innerHTML|outerHTML|insertAdjacentHTML|document.write|eval\(|new Function\(" src docs README.md > "%DOM_TMP%" 2>&1
set "RG_EXIT=%errorlevel%"

if "%RG_EXIT%"=="1" (
    call :PassLine "   No risky dynamic HTML sinks found."
) else (
    call :FailLine "   Risky HTML sink usage detected."
    if exist "%DOM_TMP%" (
        type "%DOM_TMP%" > "%DOM_LOG%"
        type "%DOM_LOG%" >> "%REPORT_FILE%"
    ) else (
        call :ReportLine "   (No output captured.)"
    )
)
exit /b 0

:RunJsSyntaxCheck
call :ReportLine "2) JavaScript syntax check"
if exist "%JS_TMP%" del "%JS_TMP%"
set /a JS_FAILS=0

for /r "src" %%F in (*.js) do (
    node --check "%%F" > "%JS_TMP%" 2>&1
    if errorlevel 1 (
        set /a JS_FAILS+=1
        >> "%JS_LOG%" echo [JS] %%F
        type "%JS_TMP%" >> "%JS_LOG%"
    )
)

if !JS_FAILS! EQU 0 (
    call :PassLine "   All JavaScript files parsed successfully."
) else (
    call :FailLine "   JavaScript syntax errors were found in !JS_FAILS! file(s)."
    if exist "%JS_LOG%" type "%JS_LOG%" >> "%REPORT_FILE%"
)
exit /b 0

:RunJsonValidation
call :ReportLine "3) JSON validation"
if exist "%JSON_TMP%" del "%JSON_TMP%"
set /a JSON_FAILS=0

for /r "src" %%F in (*.json) do (
    node -e "try{JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));}catch(e){console.error(e.message);process.exit(1)}" "%%F" > "%JSON_TMP%" 2>&1
    if errorlevel 1 (
        set /a JSON_FAILS+=1
        >> "%JSON_LOG%" echo [JSON] %%F
        type "%JSON_TMP%" >> "%JSON_LOG%"
    )
)

if exist "docs" (
    for /r "docs" %%F in (*.json) do (
        node -e "try{JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));}catch(e){console.error(e.message);process.exit(1)}" "%%F" > "%JSON_TMP%" 2>&1
        if errorlevel 1 (
            set /a JSON_FAILS+=1
            >> "%JSON_LOG%" echo [JSON] %%F
            type "%JSON_TMP%" >> "%JSON_LOG%"
        )
    )
)

if !JSON_FAILS! EQU 0 (
    call :PassLine "   All JSON files are valid."
) else (
    call :FailLine "   JSON errors were found in !JSON_FAILS! file(s)."
    if exist "%JSON_LOG%" type "%JSON_LOG%" >> "%REPORT_FILE%"
)
exit /b 0

:RunGitDiffCheck
call :ReportLine "4) Git diff whitespace check"
git diff --check > "%GIT_TMP%" 2>&1
set "GIT_EXIT=%errorlevel%"

if "%GIT_EXIT%"=="0" (
    call :PassLine "   No whitespace or patch formatting issues found."
) else (
    call :FailLine "   Git diff check reported issues."
    if exist "%GIT_TMP%" (
        type "%GIT_TMP%" > "%GIT_LOG%"
        type "%GIT_LOG%" >> "%REPORT_FILE%"
    )
    set /a FINAL_EXIT=1
)
exit /b 0

:PassLine
set /a PASSED_CHECKS+=1
call :ReportLine "%~1"
exit /b 0

:FailLine
set /a FAILED_CHECKS+=1
set /a FINAL_EXIT=1
call :ReportLine "%~1"
exit /b 0

:ReportLine
echo(%~1
>> "%REPORT_FILE%" echo(%~1
exit /b 0

:BlankLine
echo(
>> "%REPORT_FILE%" echo(
exit /b 0
