@echo off
REM OfficeFlow Platform Runner Script for Windows
REM This script provides easy commands to manage the OfficeFlow platform

setlocal enabledelayedexpansion

REM Function to print colored output (Windows doesn't support colors easily, so we'll use plain text)
:print_status
echo [INFO] %~1
goto :eof

:print_success
echo [SUCCESS] %~1
goto :eof

:print_warning
echo [WARNING] %~1
goto :eof

:print_error
echo [ERROR] %~1
goto :eof

REM Function to check if command exists
:command_exists
where %1 >nul 2>nul
goto :eof

REM Function to check prerequisites
:check_prerequisites
call :print_status "Checking prerequisites..."

call :command_exists node
if errorlevel 1 (
    call :print_error "Node.js is not installed. Please install Node.js 18+ and try again."
    exit /b 1
)

call :command_exists npm
if errorlevel 1 (
    call :print_error "npm is not installed. Please install npm and try again."
    exit /b 1
)

call :print_success "Prerequisites check passed"
goto :eof

REM Function to install dependencies
:install_deps
call :print_status "Installing dependencies..."
npm install
if errorlevel 1 (
    call :print_error "Failed to install dependencies"
    exit /b 1
)
call :print_success "Dependencies installed"
goto :eof

REM Function to build all services
:build_all
call :print_status "Building all services..."
npm run build
if errorlevel 1 (
    call :print_error "Build failed"
    exit /b 1
)
call :print_success "All services built successfully"
goto :eof

REM Function to run all tests
:test_all
call :print_status "Running all tests..."
npm run test
if errorlevel 1 (
    call :print_error "Tests failed"
    exit /b 1
)
call :print_success "All tests completed"
goto :eof

REM Function to run type checking
:type_check
call :print_status "Running type checking..."
npm run type-check
if errorlevel 1 (
    call :print_error "Type checking failed"
    exit /b 1
)
call :print_success "Type checking completed"
goto :eof

REM Function to start all services in development mode
:dev_all
call :print_status "Starting all services in development mode..."
call :print_warning "This will start all services concurrently. Press Ctrl+C to stop all services."
npm run dev
goto :eof

REM Function to start a specific service
:dev_service
if "%~1"=="" (
    call :print_error "Please specify a service name (ai-service, identity-service, workflow-engine)"
    exit /b 1
)

if not exist "services\%~1" (
    call :print_error "Service '%~1' not found"
    exit /b 1
)

call :print_status "Starting %~1 in development mode..."
cd "services\%~1"
npm run dev
goto :eof

REM Function to run tests for a specific service
:test_service
if "%~1"=="" (
    call :print_error "Please specify a service name (ai-service, identity-service, workflow-engine)"
    exit /b 1
)

if not exist "services\%~1" (
    call :print_error "Service '%~1' not found"
    exit /b 1
)

call :print_status "Running tests for %~1..."
cd "services\%~1"
npm run test
goto :eof

REM Function to clean all build artifacts
:clean_all
call :print_status "Cleaning all build artifacts..."
npm run clean
if errorlevel 1 (
    call :print_error "Clean failed"
    exit /b 1
)
call :print_success "All build artifacts cleaned"
goto :eof

REM Function to format code
:format_code
call :print_status "Formatting code..."
npm run format
if errorlevel 1 (
    call :print_error "Code formatting failed"
    exit /b 1
)
call :print_success "Code formatted"
goto :eof

REM Function to check code formatting
:check_format
call :print_status "Checking code formatting..."
npm run format:check
if errorlevel 1 (
    call :print_error "Code formatting check failed"
    exit /b 1
)
call :print_success "Code formatting check completed"
goto :eof

REM Function to setup the project
:setup
call :print_status "Setting up OfficeFlow platform..."
call :check_prerequisites
if errorlevel 1 exit /b 1
call :install_deps
if errorlevel 1 exit /b 1
call :build_all
if errorlevel 1 exit /b 1
call :test_all
if errorlevel 1 exit /b 1
call :print_success "Setup completed successfully!"
call :print_status "You can now run 'run.bat dev' to start all services"
goto :eof

REM Function to show help
:show_help
echo OfficeFlow Platform Runner
echo.
echo Usage: run.bat [command] [options]
echo.
echo Commands:
echo   setup                    - Complete project setup (install, build, test)
echo   install                  - Install all dependencies
echo   build                    - Build all services
echo   dev                      - Start all services in development mode
echo   dev ^<service^>            - Start specific service in development mode
echo   test                     - Run all tests
echo   test ^<service^>           - Run tests for specific service
echo   type-check               - Run TypeScript type checking
echo   clean                    - Clean all build artifacts
echo   format                   - Format all code
echo   format:check             - Check code formatting
echo   help                     - Show this help message
echo.
echo Services:
echo   ai-service               - AI content generation service
echo   identity-service         - Identity and access management service
echo   workflow-engine          - Core workflow orchestration service
echo.
echo Examples:
echo   run.bat setup            - Setup the entire project
echo   run.bat dev              - Start all services
echo   run.bat dev ai-service   - Start only AI service
echo   run.bat test             - Run all tests
echo   run.bat build            - Build all services
goto :eof

REM Main script logic
if "%1"=="setup" (
    call :setup
) else if "%1"=="install" (
    call :check_prerequisites
    if not errorlevel 1 call :install_deps
) else if "%1"=="build" (
    call :build_all
) else if "%1"=="dev" (
    if not "%2"=="" (
        call :dev_service "%2"
    ) else (
        call :dev_all
    )
) else if "%1"=="test" (
    if not "%2"=="" (
        call :test_service "%2"
    ) else (
        call :test_all
    )
) else if "%1"=="type-check" (
    call :type_check
) else if "%1"=="clean" (
    call :clean_all
) else if "%1"=="format" (
    call :format_code
) else if "%1"=="format:check" (
    call :check_format
) else if "%1"=="help" (
    call :show_help
) else if "%1"=="--help" (
    call :show_help
) else if "%1"=="-h" (
    call :show_help
) else if "%1"=="" (
    call :print_warning "No command specified. Use 'run.bat help' for usage information."
    call :show_help
) else (
    call :print_error "Unknown command: %1"
    call :print_status "Use 'run.bat help' for usage information."
    exit /b 1
)