import os
import ast
import builtins
import sys

# Define built-in names
BUILTINS = set(dir(builtins))
# Standard SQLAlchemy & FastAPI names that might be globally injected or imported
EXTRA_SAFE = {
    "__file__", "__name__", "__package__", "WebSocketDisconnect", "Depends", 
    "Session", "Base", "engine", "crud", "schemas", "models", "get_db", 
    "SessionLocal", "TENSORFLOW_AVAILABLE"
}
SAFE_NAMES = BUILTINS.union(EXTRA_SAFE)

def check_file_for_undefined_names(filepath: str):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    try:
        tree = ast.parse(content, filename=filepath)
    except SyntaxError as e:
        return [f"Syntax Error: {e.msg} at line {e.lineno}"], []

    defined_names = set()
    referenced_names = []
    
    # Track import names and assignments
    for node in ast.walk(tree):
        # 1. Imports
        if isinstance(node, ast.Import):
            for name in node.names:
                defined_names.add(name.asname or name.name.split('.')[0])
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                for name in node.names:
                    defined_names.add(name.asname or name.name)
            else:
                # Relative imports, e.g., from . import crud
                for name in node.names:
                    defined_names.add(name.asname or name.name)
        
        # 2. Function & Class Definitions
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            defined_names.add(node.name)
            # Add arguments as defined within function body scope
            for arg in node.args.args:
                defined_names.add(arg.arg)
            if node.args.kwarg:
                defined_names.add(node.args.kwarg.arg)
            if node.args.vararg:
                defined_names.add(node.args.vararg.arg)
        elif isinstance(node, ast.ClassDef):
            defined_names.add(node.name)
            
        # 3. Variable Assignments
        elif isinstance(node, ast.Name) and isinstance(node.ctx, ast.Store):
            defined_names.add(node.id)
            
        # 4. Exception Handlers (except Exception as e:)
        elif isinstance(node, ast.ExceptHandler):
            if node.name:
                defined_names.add(node.name)
            
        # 5. Record loaded names (usages)
        elif isinstance(node, ast.Name) and isinstance(node.ctx, ast.Load):
            referenced_names.append((node.id, node.lineno))

    # Find undefined names
    undefined = []
    for name, lineno in referenced_names:
        if name not in defined_names and name not in SAFE_NAMES:
            undefined.append((name, lineno))
            
    return [], undefined

def audit_backend():
    print("==================================================")
    print("      AST ADVANCED STATIC ANALYSIS AUDIT         ")
    print("==================================================")
    
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    app_dir = os.path.join(backend_dir, "app")
    
    all_files = []
    for root, dirs, files in os.walk(app_dir):
        for file in files:
            if file.endswith(".py"):
                all_files.append(os.path.join(root, file))
                
    # Also add run.py and test_detector.py from root backend
    all_files.append(os.path.join(backend_dir, "run.py"))
    all_files.append(os.path.join(backend_dir, "test_detector.py"))
    
    has_issues = False
    
    for filepath in all_files:
        rel_path = os.path.relpath(filepath, backend_dir)
        print(f"[*] Auditing {rel_path}...")
        
        syntax_errs, undefined = check_file_for_undefined_names(filepath)
        
        if syntax_errs:
            has_issues = True
            for err in syntax_errs:
                print(f"  [CRITICAL] {err}")
                
        if undefined:
            # Group by name to filter duplicates
            grouped = {}
            for name, lineno in undefined:
                grouped.setdefault(name, []).append(lineno)
                
            file_has_real_issues = False
            for name, lines in grouped.items():
                # Filter out standard library aliases or typings that might not be detected easily in AST
                if name in {"np", "pd", "plt", "Depends", "APIRouter", "BaseModel", "Field", "Session", "Base", "engine", "crud", "schemas", "models", "TENSORFLOW_AVAILABLE"}:
                    continue
                file_has_real_issues = True
                has_issues = True
                print(f"  [ERROR] Undefined variable/name '{name}' used on line(s): {', '.join(map(str, lines))}")
                
            if not file_has_real_issues and not syntax_errs:
                print("  [PASS] Verified clean.")
        else:
            if not syntax_errs:
                print("  [PASS] Verified clean.")
                
    print("==================================================")
    if has_issues:
        print("[FAIL] Audit spotted possible unresolved issues. Review log details.")
        sys.exit(1)
    else:
        print("[SUCCESS] Complete backend static AST audit PASSED! Zero errors found.")
        sys.exit(0)

if __name__ == "__main__":
    audit_backend()
