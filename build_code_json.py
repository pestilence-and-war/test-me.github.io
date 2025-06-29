import os
import json
import sys
import ast
import textwrap
from datetime import datetime
import re # For basic CSS parsing
import traceback # For detailed error logging

# Attempt to import HTML/CSS parsers, print warnings if not available
try:
    from bs4 import BeautifulSoup
    from bs4 import Comment # Needed to exclude comments
    import lxml # BeautifulSoup backend for speed
    HTML_PARSING_AVAILABLE = True
except ImportError:
    print("Warning: beautifulsoup4 or lxml not found. HTML parsing will be skipped.")
    print("Install with: pip install beautifulsoup4 lxml")
    HTML_PARSING_AVAILABLE = False

# Attempt to import JS parser
try:
    import esprima
    JS_PARSING_AVAILABLE = True
except ImportError:
    print("Warning: esprima library not found. JavaScript parsing within <script> tags will be skipped.")
    print("Install with: pip install esprima")
    JS_PARSING_AVAILABLE = False


# --- Configuration: Define File and Directory Handling ---
# These lists and sets control which files and directories are included,
# excluded, or handled specially during the project scan.
# Place these prominently at the top so a new user can easily find and modify them.

# Define directories to exclude from traversal (os.walk will not enter these).
# This is suitable for dependency folders, build outputs, IDE configs, etc.
# These directories (and their contents) will NOT appear in the 'directory_tree'.
EXCLUDED_DIRS = {
    '__pycache__', '.git', '.svn', '.hg', # Version control and cache
    'node_modules', 'venv', '.venv', '__pypackages__', 'vendor', # Dependency directories
    'dist', 'build', # Build/distribution directories
    '.idea', '.vscode', '__pydevd_remote_debug_server__', # IDE specific directories
    # Add other directories here as needed (e.g., 'logs', 'tmp', 'instance_data')
}

# Define specific filenames to exclude regardless of the directory they are in.
# (These files will be listed in the directory_tree but WILL NOT have an entry
# in the 'files' dictionary, nor will their content be read).
EXCLUDED_FILENAMES = {
    os.path.basename(__file__), # Exclude this script itself by name
    '.env', # Explicitly exclude environment variable files
    # Add other specific filenames here (e.g., 'package-lock.json' if not managed by INCLUDE_CONTENT_FOR_SPECIFIC_FILENAMES)
    'htmx.min.js' # Example, could also be handled by MANAGED_EXTENSIONS
}

# Define file extensions for files that are likely binary or sensitive.
# (These files will be listed in the directory_tree but WILL NOT have an entry
# in the 'files' dictionary, nor will their content be read).
BINARY_EXTENSIONS = {
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.ico', # Images
    '.mp4', '.mp3', '.avi', '.mov', '.webm', # Media
    '.pdf', '.docx', '.xlsx', '.pptx', # Documents
    '.bin', '.exe', '.dll', '.so', '.dylib', '.o', '.a', '.lib', '.class', '.pyc', '.pyd', # Binaries/Compiled
    '.zip', '.tar.gz', '.tgz', '.tar.bz2', '.tbz2', '.rar', '.7z', # Archives
    '.sqlite', '.db', '.sql', # Databases/SQL dumps (often binary or large text dumps)
    '.pem', '.key', '.cer', '.crt', '.pfx', '.p12', # Keys/Certificates
    '.lock', '.tmp', '.bak', '.swp', # Lock/Temp/Backup/Swap files
    '.DS_Store', '.env.enc', # macOS specific / Encrypted files
    # Add other binary or sensitive extensions here
}

# Define file extensions for text files whose *content* should generally be ignored,
# preventing them from having an entry in the 'files' dictionary by default.
# Useful for very large logs, generated code/data, or non-critical configuration files
# whose content isn't needed for understanding the core project code logic.
# Use INCLUDE_CONTENT_FOR_SPECIFIC_FILENAMES to override this for specific important files.
IGNORED_TEXT_EXTENSIONS = {
     '.json', '.jsonl', # Data/Log files (unless specifically in INCLUDE_CONTENT_FOR_SPECIFIC_FILENAMES)
     '.log', '.csv', '.tsv', # Data/Log files
     '.txt', # Generic text files (unless specifically in INCLUDE_CONTENT_FOR_SPECIFIC_FILENAMES)
     '.md', '.markdown', # Markdown (consider parsing if structure is needed, or add to INCLUDE_CONTENT_FOR_SPECIFIC_FILENAMES)
     '.yml', '.yaml', '.toml', '.ini', # Configuration files (consider parsing or adding to INCLUDE_CONTENT_FOR_SPECIFIC_FILENAMES)
     '.gitignore', '.dockerignore', '.eslintignore', # Ignore rules files
     '.editorconfig', '.gitattributes', # Config files
     # Dependency manifests - use INCLUDE_CONTENT_FOR_SPECIFIC_FILENAMES for key ones like requirements.txt or package.json
     'package-lock.json', 'yarn.lock',
     'Gemfile.lock', 'pom.xml', 'build.gradle', # Build/dependency definition files
     # Add other extensions here
}

# Define specific filenames whose *content* SHOULD be included in the 'files' dictionary,
# even if their extension is listed in IGNORED_TEXT_EXTENSIONS.
# This is the "allow list" for content inclusion of otherwise ignored text file types.
INCLUDE_CONTENT_FOR_SPECIFIC_FILENAMES = {
    'requirements.txt',
    'package.json',
    'Gemfile',
    # Add other specific project-critical config/text filenames here
    # e.g., 'main_config.json', 'settings.ini'
}


# Define file extensions for files whose *content* should NOT be stored fully,
# but which *should* still have an entry in the 'files' dictionary with metadata.
# Useful for large static assets (like minified JS libraries, bundled CSS) that you want
# the LLM to know exist, but whose source you don't need to manage or diff.
# Their presence in the 'files' dict means they are 'acknowledged'.
MANAGED_EXTENSIONS = {
    '.min.js', '.bundle.js', '.css.map', '.js.map', # Example minified/bundled/map files
    # Add other extensions here for files whose content should be omitted
}

# Define specific filenames that should be 'managed' regardless of extension.
# (These files will have an entry in 'files' but with null content and metadata).
MANAGED_FILENAMES = {
    # Add specific filenames here if needed, e.g., 'large_asset.data'
}


# Define file extensions for files that should be read and parsed for structured information.
# The full content of these files WILL be stored in the JSON, along with the parsed details.
PARSEABLE_CODE_EXTENSIONS = {
    '.py',
    '.html', '.htm',
    '.css'
    # Add other code/markup language extensions here (e.g., '.js', '.jsx', '.ts', '.tsx', '.vue')
    # Note: If a .json file is in INCLUDE_CONTENT_FOR_SPECIFIC_FILENAMES and you want to parse its structure,
    # you could add '.json' here and create a simple parse_json_file function.
}

# --- Helper Functions for Python AST Parsing ---
# These functions require the 'ast' module, which is built into Python.

def get_docstring(node):
    """
    Safely extracts the docstring from a Python AST node (FunctionDef, ClassDef, Module).

    Args:
        node: An AST node object.

    Returns:
        The docstring string, or None if no docstring is found or the node type is not applicable.
    """
    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef, ast.Module)):
        return ast.get_docstring(node)
    return None

def get_signature(node):
    """
    Constructs a string representation of a Python function or method signature
    from its AST node. Includes parameters with annotations and defaults, and return annotation.

    Args:
        node: An AST node of type ast.FunctionDef, ast.AsyncFunctionDef, or ast.Lambda.

    Returns:
        A string representing the signature (e.g., "(self, name: str) -> None"),
        or None if the node type is not a function/method/lambda.
    """
    if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda)):
        return None

    args = []
    unparse_available = sys.version_info >= (3, 9)
    def safe_unparse(n):
        if unparse_available:
            try: return ast.unparse(n).strip()
            except Exception: pass
        if isinstance(n, ast.Name): return n.id
        if isinstance(n, ast.Constant): return repr(n.value)
        return f"<{type(n).__name__}>"

    if hasattr(ast.arguments, 'posonlyargs') and node.args.posonlyargs:
        for arg in node.args.posonlyargs:
            arg_str = arg.arg
            if arg.annotation:
                arg_str += f": {safe_unparse(arg.annotation)}"
            args.append(arg_str)
        args.append('/')

    num_defaults = len(node.args.defaults) if node.args.defaults else 0
    for i, arg in enumerate(node.args.args):
        arg_str = arg.arg
        if arg.annotation:
            arg_str += f": {safe_unparse(arg.annotation)}"
        default_index = i - (len(node.args.args) - num_defaults)
        if default_index >= 0 and default_index < num_defaults and node.args.defaults[default_index] is not None:
             arg_str += f"={safe_unparse(node.args.defaults[default_index])}"
        args.append(arg_str)

    if node.args.vararg:
        arg_str = f"*{node.args.vararg.arg}"
        if node.args.vararg.annotation:
             arg_str += f": {safe_unparse(node.args.vararg.annotation)}"
        args.append(arg_str)

    if hasattr(ast.arguments, 'kwonlyargs') and node.args.kwonlyargs:
        if not node.args.vararg and (node.args.args or (hasattr(ast.arguments, 'posonlyargs') and node.args.posonlyargs)): # Add * if kwonlyargs exist, no *args, but there are other args
             pass # No explicit '*' needed if regular or pos-only args exist, the syntax implies it
        elif not node.args.vararg: # Only kw-only args, or kw-only after pos-only args that ended with /
             args.append('*')

        for i, arg in enumerate(node.args.kwonlyargs):
            arg_str = arg.arg
            if arg.annotation:
                arg_str += f": {safe_unparse(arg.annotation)}"
            if node.args.kw_defaults and i < len(node.args.kw_defaults) and node.args.kw_defaults[i] is not None:
                 arg_str += f"={safe_unparse(node.args.kw_defaults[i])}"
            args.append(arg_str)

    if node.args.kwarg:
        arg_str = f"**{node.args.kwarg.arg}"
        if node.args.kwarg.annotation:
             arg_str += f": {safe_unparse(node.args.kwarg.annotation)}"
        args.append(arg_str)

    signature_str = "(" + ", ".join(args) + ")"
    if node.returns:
        try:
           return_annotation_str = safe_unparse(node.returns)
           if return_annotation_str:
               signature_str += f" -> {return_annotation_str}"
        except Exception:
            pass
    return signature_str


def get_source_segment(source_code, node):
    """
    Extracts the exact source code string for a given Python AST node,
    including any preceding decorators.
    """
    lines = source_code.splitlines(keepends=True)
    source_lines_str = "".join(lines)

    if hasattr(ast, 'get_source_segment'):
        if sys.version_info >= (3, 11):
             try:
                 return ast.get_source_segment(source_lines_str, node, extend_past_eol=True)
             except TypeError:
                  return ast.get_source_segment(source_lines_str, node)
        elif sys.version_info >= (3, 8):
             core_segment = ast.get_source_segment(source_lines_str, node)
             if core_segment is None: return None

             start_lineno_idx = node.lineno - 1
             decorator_start_lineno_idx = start_lineno_idx
             for i in range(start_lineno_idx - 1, -1, -1):
                 line = lines[i].strip()
                 if line.startswith('@'):
                     decorator_start_lineno_idx = i
                 elif line and not line.startswith('#'): # Stop if non-decorator, non-comment
                      break
                 elif not line and i < decorator_start_lineno_idx -1: # Stop on blank line unless it's right before decorators
                      break
             
             end_index = (node.end_lineno if hasattr(node, 'end_lineno') else node.lineno)
             full_segment_lines = lines[decorator_start_lineno_idx : end_index]
             return "".join(full_segment_lines).strip()

    # Fallback for older Python versions (< 3.8)
    start_lineno_idx = node.lineno - 1
    end_lineno_idx = node.end_lineno - 1 if hasattr(node, 'end_lineno') else start_lineno_idx
    
    decorator_start_lineno_idx = start_lineno_idx
    for i in range(start_lineno_idx - 1, -1, -1):
        line = lines[i].strip()
        if line.startswith('@'):
            decorator_start_lineno_idx = i
        elif line and not line.startswith('#'):
             break
        elif not line and i < decorator_start_lineno_idx - 1:
             break
    segment = "".join(lines[decorator_start_lineno_idx : end_lineno_idx + 1])
    return segment.strip()


def parse_python_file(filepath, content):
    """
    Parses a Python file's content to extract structured information.
    """
    file_data = {
        "path": filepath, "type": "python", "imports": [], "classes": {}, "functions": {},
        "start_lineno": 1, "end_lineno": len(content.splitlines()), "full_content": content
    }
    if not content.strip():
        file_data["message"] = "File is empty or contains only whitespace."
        return file_data

    try:
        tree = ast.parse(content)
        module_docstring = get_docstring(tree)
        if module_docstring:
             file_data["docstring"] = module_docstring
    except SyntaxError as e:
        print(f"Syntax error in {filepath}: {e}")
        file_data.update({"type": "python_error", "error": str(e)})
        return file_data
    except Exception as e:
        print(f"Unexpected parsing error in {filepath}: {e}")
        file_data.update({"type": "python_error", "error": str(e)})
        return file_data

    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            try:
                if sys.version_info >= (3, 9):
                     import_str = ast.unparse(node).strip()
                else: # Manual fallback
                    if isinstance(node, ast.Import):
                        names = [n.name + (f" as {n.asname}" if n.asname else "") for n in node.names]
                        import_str = f"import {', '.join(names)}"
                    elif isinstance(node, ast.ImportFrom):
                        module = node.module if node.module else ""
                        names = [n.name + (f" as {n.asname}" if n.asname else "") for n in node.names]
                        level = '.' * node.level if node.level else ''
                        import_str = f"from {level}{module} import {', '.join(names)}"
                file_data["imports"].append(import_str)
            except Exception as e:
                 print(f"Warning: Could not process import node in {filepath}: {ast.dump(node)[:100]}... - {e}")
                 file_data["imports"].append(f"# Error processing import: {ast.dump(node)[:100]}...")

    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            func_name = node.name
            source_seg = get_source_segment(content, node)
            file_data["functions"][func_name] = {
                "type": "function", "name": func_name, "signature": get_signature(node),
                "docstring": get_docstring(node),
                "source_code": textwrap.dedent(source_seg) if source_seg else None,
                "start_lineno": node.lineno,
                "end_lineno": node.end_lineno if hasattr(node, 'end_lineno') else node.lineno
            }
        elif isinstance(node, ast.ClassDef):
            class_name = node.name
            class_source_seg = get_source_segment(content, node)
            class_data = {
                "type": "class", "name": class_name, "docstring": get_docstring(node),
                "methods": {},
                "source_code": textwrap.dedent(class_source_seg) if class_source_seg else None,
                "start_lineno": node.lineno,
                "end_lineno": node.end_lineno if hasattr(node, 'end_lineno') else node.lineno
            }
            for item in node.body:
                 if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    method_name = item.name
                    method_source_seg = get_source_segment(content, item)
                    class_data["methods"][method_name] = {
                        "type": "method", "name": method_name, "signature": get_signature(item),
                        "docstring": get_docstring(item),
                        "source_code": textwrap.dedent(method_source_seg) if method_source_seg else None,
                        "start_lineno": item.lineno,
                        "end_lineno": item.end_lineno if hasattr(item, 'end_lineno') else item.lineno
                    }
            file_data["classes"][class_name] = class_data
    return file_data

# --- Helper Functions for HTML Parsing ---

def _get_element_ancestry(tag, stop_at_tag=None):
    path = []
    for parent in tag.parents:
        if stop_at_tag and parent is stop_at_tag: break
        if parent.name in ['html', 'body'] and parent.parent is None: break
        if parent.name is None: continue
        tag_repr = parent.name
        if parent.get('id'): tag_repr += f"#{parent['id']}"
        classes = parent.get('class')
        if isinstance(classes, list) and classes: tag_repr += f".{'.'.join(classes)}"
        path.append(tag_repr)
    path.reverse()
    return path



def parse_javascript_content(js_code: str, html_filepath: str = None) -> dict:
    """
    Parses JavaScript code to extract functions and addEventListener calls
    using a manual recursive walk to access parent nodes.
    html_filepath is optional, for context in error messages.
    """
    if not JS_PARSING_AVAILABLE:
        return {"error": "JavaScript parsing skipped: esprima not installed.", "source_file_context": html_filepath}
    if not js_code.strip():
        return {"message": "Script content is empty or whitespace.", "source_file_context": html_filepath}

    functions_found = []
    event_listeners_found = []

    def get_source_from_js_node(node, code_str):
        if hasattr(node, 'range') and isinstance(node.range, list) and len(node.range) == 2:
            start_idx, end_idx = node.range
            return code_str[start_idx:end_idx]
        elif hasattr(node, 'loc') and node.loc and \
             hasattr(node.loc, 'start') and hasattr(node.loc.start, 'index') and \
             hasattr(node.loc, 'end') and hasattr(node.loc.end, 'index'):
            start_idx = node.loc.start.index
            end_idx = node.loc.end.index
            return code_str[start_idx:end_idx]
        return "/* Source unavailable */"

    def custom_js_walk(node, parent_node=None):
        if node is None or not hasattr(node, 'type'): # Ensure it's a valid AST node
            return

        # --- Main Logic for Identifying JS Constructs ---
        if node.type == esprima.Syntax.FunctionDeclaration:
            func_name = node.id.name if hasattr(node, 'id') and node.id else None
            source_code = get_source_from_js_node(node, js_code)
            functions_found.append({
                "type": "function_declaration", "name": func_name, "source_code": source_code,
                "start_lineno": node.loc.start.line, "end_lineno": node.loc.end.line
            })
        elif node.type in [esprima.Syntax.FunctionExpression, esprima.Syntax.ArrowFunctionExpression]:
            func_name = None
            if parent_node:
                if parent_node.type == esprima.Syntax.VariableDeclarator and \
                   node == getattr(parent_node, 'init', None) and \
                   hasattr(parent_node, 'id') and getattr(parent_node.id, 'type', None) == esprima.Syntax.Identifier:
                    func_name = parent_node.id.name
                elif parent_node.type == esprima.Syntax.MethodDefinition and \
                     node == getattr(parent_node, 'value', None) and \
                     hasattr(parent_node, 'key') and getattr(parent_node.key, 'type', None) == esprima.Syntax.Identifier:
                    func_name = parent_node.key.name
                elif parent_node.type == esprima.Syntax.Property and \
                     node == getattr(parent_node, 'value', None) and \
                     hasattr(parent_node, 'key'): # Key could be Identifier or Literal
                    if getattr(parent_node.key, 'type', None) == esprima.Syntax.Identifier:
                         func_name = parent_node.key.name
                    # If key is Literal (e.g. "myFunc": function(){}), func_name remains None or could be parent_node.key.value
            source_code = get_source_from_js_node(node, js_code)
            functions_found.append({
                "type": "function_expression" if node.type == esprima.Syntax.FunctionExpression else "arrow_function_expression",
                "name": func_name, "source_code": source_code,
                "start_lineno": node.loc.start.line, "end_lineno": node.loc.end.line
            })
        elif node.type == esprima.Syntax.CallExpression and \
           hasattr(node.callee, 'type') and node.callee.type == esprima.Syntax.MemberExpression and \
           hasattr(node.callee, 'property') and getattr(node.callee.property, 'type', None) == esprima.Syntax.Identifier and \
           node.callee.property.name == 'addEventListener' and \
           hasattr(node, 'arguments') and len(node.arguments) >= 2:
            
            target_source = get_source_from_js_node(node.callee.object, js_code)
            event_arg = node.arguments[0]
            event_type = event_arg.value if hasattr(event_arg, 'value') and event_arg.type == esprima.Syntax.Literal else "<??>"
            handler_arg = node.arguments[1]
            handler_source = get_source_from_js_node(handler_arg, js_code)
            handler_name = handler_arg.name if hasattr(handler_arg, 'name') and handler_arg.type == esprima.Syntax.Identifier else None
            full_call_source = get_source_from_js_node(node, js_code)

            event_listeners_found.append({
                "target": target_source, "event_type": event_type,
                "handler_source": handler_source, "handler_type": handler_arg.type, "handler_name": handler_name,
                "source_code": full_call_source,
                "start_lineno": node.loc.start.line, "end_lineno": node.loc.end.line
            })

        # --- Recursive Traversal of Children ---
        child_prop_names = []
        node_type = node.type
        if node_type in [esprima.Syntax.Program, esprima.Syntax.BlockStatement, esprima.Syntax.ClassBody]: child_prop_names.append('body')
        elif node_type == esprima.Syntax.ExpressionStatement: child_prop_names.append('expression')
        elif node_type == esprima.Syntax.IfStatement: child_prop_names.extend(['test', 'consequent', 'alternate'])
        elif node_type == esprima.Syntax.LabeledStatement: child_prop_names.append('body')
        elif node_type == esprima.Syntax.WithStatement: child_prop_names.extend(['object', 'body'])
        elif node_type == esprima.Syntax.SwitchStatement: child_prop_names.extend(['discriminant', 'cases'])
        elif node_type in [esprima.Syntax.ReturnStatement, esprima.Syntax.ThrowStatement, esprima.Syntax.YieldExpression, esprima.Syntax.AwaitExpression, esprima.Syntax.SpreadElement, esprima.Syntax.UnaryExpression, esprima.Syntax.UpdateExpression]: child_prop_names.append('argument')
        elif node_type == esprima.Syntax.TryStatement: child_prop_names.extend(['block', 'handler', 'finalizer'])
        elif node_type == esprima.Syntax.CatchClause: child_prop_names.extend(['param', 'body'])
        elif node_type in [esprima.Syntax.WhileStatement, esprima.Syntax.DoWhileStatement]: child_prop_names.extend(['test', 'body'])
        elif node_type == esprima.Syntax.ForStatement: child_prop_names.extend(['init', 'test', 'update', 'body'])
        elif node_type in [esprima.Syntax.ForInStatement, esprima.Syntax.ForOfStatement]: child_prop_names.extend(['left', 'right', 'body'])
        elif node_type in [esprima.Syntax.FunctionDeclaration, esprima.Syntax.FunctionExpression, esprima.Syntax.ArrowFunctionExpression]:
            if hasattr(node, 'id') and node.id: child_prop_names.append('id')
            if hasattr(node, 'params'): child_prop_names.append('params')
            if hasattr(node, 'body'): child_prop_names.append('body')
        elif node_type == esprima.Syntax.VariableDeclaration: child_prop_names.append('declarations')
        elif node_type == esprima.Syntax.VariableDeclarator: child_prop_names.extend(['id', 'init'])
        elif node_type in [esprima.Syntax.ArrayExpression, esprima.Syntax.ArrayPattern]: child_prop_names.append('elements')
        elif node_type in [esprima.Syntax.ObjectExpression, esprima.Syntax.ObjectPattern]: child_prop_names.append('properties')
        elif node_type == esprima.Syntax.Property: child_prop_names.extend(['key', 'value'])
        elif node_type == esprima.Syntax.SequenceExpression: child_prop_names.append('expressions')
        elif node_type in [esprima.Syntax.BinaryExpression, esprima.Syntax.LogicalExpression, esprima.Syntax.AssignmentExpression]: child_prop_names.extend(['left', 'right'])
        elif node_type == esprima.Syntax.ConditionalExpression: child_prop_names.extend(['test', 'consequent', 'alternate'])
        elif node_type in [esprima.Syntax.CallExpression, esprima.Syntax.NewExpression]: child_prop_names.extend(['callee', 'arguments'])
        elif node_type == esprima.Syntax.MemberExpression: child_prop_names.extend(['object', 'property'])
        elif node_type == esprima.Syntax.SwitchCase: child_prop_names.extend(['test', 'consequent'])
        elif node_type == esprima.Syntax.TemplateLiteral: child_prop_names.extend(['quasis', 'expressions'])
        elif node_type == esprima.Syntax.TaggedTemplateExpression: child_prop_names.extend(['tag', 'quasi'])
        elif node_type in [esprima.Syntax.ClassDeclaration, esprima.Syntax.ClassExpression]:
            if hasattr(node, 'id') and node.id: child_prop_names.append('id')
            if hasattr(node, 'superClass') and node.superClass: child_prop_names.append('superClass')
            child_prop_names.append('body')
        elif node_type == esprima.Syntax.MethodDefinition: child_prop_names.extend(['key', 'value'])
        elif node_type == esprima.Syntax.ImportDeclaration: child_prop_names.extend(['specifiers', 'source'])
        elif node_type in [esprima.Syntax.ExportNamedDeclaration, esprima.Syntax.ExportDefaultDeclaration]:
            if hasattr(node, 'declaration'): child_prop_names.append('declaration')
            if hasattr(node, 'specifiers'): child_prop_names.append('specifiers')
            if hasattr(node, 'source'): child_prop_names.append('source')
        elif node_type == esprima.Syntax.ExportAllDeclaration: child_prop_names.append('source')

        for prop_name in child_prop_names:
            child_value = getattr(node, prop_name, None)
            if child_value is None:
                continue
            if isinstance(child_value, list):
                for item in child_value:
                    custom_js_walk(item, node)
            else:
                custom_js_walk(child_value, node)

    try:
        tree = esprima.parseScript(js_code, {"loc": True, "range": True, "comment": False, "tokens": False})
        custom_js_walk(tree)

        return {
            "functions": functions_found,
            "event_listeners": event_listeners_found,
            "source_file_context": html_filepath # Also add context on success
        }
    except esprima.Error as e:
        error_message = getattr(e, 'message', str(e))
        line_num_str = str(getattr(e, 'lineNumber', 'N/A'))
        col_num_str = str(getattr(e, 'column', 'N/A'))
        
        context_msg = f" in inline script of '{html_filepath}'" if html_filepath else ""
        
        if f"(line {line_num_str}, column {col_num_str})" in error_message:
             print(f"JavaScript Parse Error{context_msg}: {error_message}")
        else:
             print(f"JavaScript Parse Error{context_msg}: {error_message} (line {line_num_str}, column {col_num_str})")
        
        return {
            "error": f"JavaScript syntax error{context_msg}: {error_message}",
            "full_content_on_error": js_code,
            "source_file_context": html_filepath
        }
    except Exception as e:
        context_msg = f" in inline script of '{html_filepath}'" if html_filepath else ""
        print(f"Unexpected JavaScript parsing error{context_msg}: {e}")
        # import traceback
        # print(traceback.format_exc()) # Uncomment for full traceback during debugging
        return {
            "error": f"Unexpected JavaScript parsing error{context_msg}: {str(e)}",
            "full_content_on_error": js_code,
            "source_file_context": html_filepath
        }


def parse_html_file(filepath, content):
    """
    Parses an HTML file's content for structure, forms, links, scripts, styles, etc.
    """
    file_data = {
        "path": filepath, "type": "html", "title": None, "forms": [], "links": [],
        "images": [], "htmx_elements": [], "scripts": [], "inline_styles": [],
        "body_structure_preview": [],
        "start_lineno": 1, "end_lineno": len(content.splitlines()), "full_content": content
    }
    if not content.strip():
        file_data["message"] = "File is empty or contains only whitespace."
        return file_data
    if not HTML_PARSING_AVAILABLE:
        file_data.update({"type": "html_skipped", "message": "HTML parsing skipped: beautifulsoup4 or lxml not installed."})
        return file_data

    try:
        soup = BeautifulSoup(content, 'lxml') # Removed from_encoding
        for comment_node in soup.find_all(string=lambda text: isinstance(text, Comment)):
             comment_node.extract()

        if soup.title and soup.title.string:
            file_data["title"] = soup.title.string.strip()

        for form in soup.find_all('form'):
            form_data = {"id": form.get('id'), "action": form.get('action'), "method": form.get('method'), "inputs": [], "ancestry_path": _get_element_ancestry(form, soup.body)}
            for input_tag in form.select('input, textarea, select'):
                form_data["inputs"].append({
                    "tag": input_tag.name, "type": input_tag.get('type'), "name": input_tag.get('name'),
                    "id": input_tag.get('id'), "value": input_tag.get('value'),
                    "placeholder": input_tag.get('placeholder'), "required": input_tag.get('required') is not None
                })
            file_data["forms"].append(form_data)

        for link in soup.find_all('a'):
            link_data = {"text": link.get_text(strip=True), "href": link.get('href'), "ancestry_path": _get_element_ancestry(link, soup.body)}
            if link_data["text"] or link_data["href"]: file_data["links"].append(link_data)

        for img in soup.find_all('img'):
             img_data = {"src": img.get('src'), "alt": img.get('alt'), "width": img.get('width'), "height": img.get('height'), "ancestry_path": _get_element_ancestry(img, soup.body)}
             if img_data["src"]: file_data["images"].append(img_data)
        
        htmx_attrs_regex = re.compile(r'^hx-.+')
        for element in soup.find_all(lambda tag: any(htmx_attrs_regex.match(attr) for attr in tag.attrs if isinstance(attr, str))):
             file_data["htmx_elements"].append({
                 "tag": element.name, "id": element.get('id'), "classes": element.get('class'),
                 "hx_attributes": {attr: value for attr, value in element.attrs.items() if isinstance(attr, str) and htmx_attrs_regex.match(attr)},
                 "text_snippet": (element.get_text(strip=True)[:100] + "...") if element.get_text(strip=True) else None,
                 "ancestry_path": _get_element_ancestry(element, soup.body)
             })

        for script_tag in soup.find_all('script'):
            start_line_html = script_tag.sourceline if hasattr(script_tag, 'sourceline') and isinstance(script_tag.sourceline, int) else None
            end_line_html = (start_line_html + len(str(script_tag).splitlines()) - 1) if start_line_html is not None else None
            
            script_data = {
                 "src": script_tag.get('src'), "type": script_tag.get('type', 'text/javascript'),
                 "content": None, "parsed_js": None,
                 "start_lineno_html": start_line_html, "end_lineno_html": end_line_html,
                 "ancestry_path": _get_element_ancestry(script_tag, soup.body)
            }
            if script_tag.string:
                 inline_content = script_tag.string.strip()
                 script_data["content"] = inline_content
                 if JS_PARSING_AVAILABLE and inline_content:
                      if script_tag.string:
                        inline_content = script_tag.string.strip()
                        script_data["content"] = inline_content
                        # if JS_PARSING_AVAILABLE and inline_content:
                        #     # ---- ADD DEBUG CODE HERE ----
                        #     if filepath == "templates/base.html": #<-- ADJUST THIS TO YOUR PROBLEMATIC FILE
                        #         print(f"\n--- DEBUG: Inline JS content for {filepath} (HTML script tag starting line: {script_data.get('start_lineno_html', 'N/A')}) ---")
                        #         for i, line_text in enumerate(inline_content.splitlines()):
                        #             print(f"{i+1:04d}: {line_text}")
                        #         print(f"--- END DEBUG FOR {filepath} ---\n")
                      # Pass the HTML filepath for context in case of JS errors
                      script_data["parsed_js"] = parse_javascript_content(inline_content, html_filepath=filepath)
                      if script_data["parsed_js"] and isinstance(script_data["parsed_js"], dict) and start_line_html is not None:
                          for item_list_key in ["functions", "event_listeners"]:
                              for item in script_data["parsed_js"].get(item_list_key, []):
                                  if item.get("start_lineno") is not None: # Original line no from esprima
                                      item["start_lineno_file"] = item["start_lineno"] + start_line_html - 1
                                      item["end_lineno_file"] = item["end_lineno"] + start_line_html - 1
                                  else: # Should not happen if esprima provides loc
                                      item["start_lineno_file"] = None
                                      item["end_lineno_file"] = None
            if script_data.get("src") or script_data.get("content"):
                file_data["scripts"].append(script_data)

        for style_tag in soup.find_all('style'):
             if style_tag.string:
                  start_line_html = style_tag.sourceline if hasattr(style_tag, 'sourceline') and isinstance(style_tag.sourceline, int) else None
                  end_line_html = (start_line_html + len(str(style_tag).splitlines()) - 1) if start_line_html is not None else None
                  file_data["inline_styles"].append({
                      "type": style_tag.get('type', 'text/css'), "content": style_tag.string.strip(),
                      "start_lineno_html": start_line_html, "end_lineno_html": end_line_html,
                      "ancestry_path": _get_element_ancestry(style_tag, soup.body)
                  })

        relevant_selectors_body_children = 'body > div, body > section, body > article, body > main, body > aside, body > nav, body > header, body > footer, body > form, body > ul, body > ol, body > table, body > h1, body > h2, body > h3'
        if soup.body:
            for element in soup.body.select(relevant_selectors_body_children):
                 file_data["body_structure_preview"].append({
                     "tag": element.name, "id": element.get('id'), "classes": element.get('class'),
                     "text_snippet": (element.get_text(strip=True)[:100] + "...") if element.get_text(strip=True) else None,
                     "ancestry_path": _get_element_ancestry(element, soup.body)
                 })
            if not file_data["body_structure_preview"]: # Fallback
                 for element in soup.body.select('div[id], section[id], article[id], nav[id], header[id], footer[id], form[id]'):
                     preview_data = {
                         "tag": element.name, "id": element.get('id'), "classes": element.get('class'),
                         "text_snippet": (element.get_text(strip=True)[:100] + "...") if element.get_text(strip=True) else None,
                         "ancestry_path": _get_element_ancestry(element, soup.body)
                     }
                     if preview_data not in file_data["body_structure_preview"]:
                          file_data["body_structure_preview"].append(preview_data)
    except Exception as e:
        print(f"Error parsing HTML file {filepath}: {e}")
        # print(traceback.format_exc()) # Uncomment for debugging
        file_data.update({"type": "html_error", "error": str(e)})
    return file_data

# --- Helper Function for Basic CSS Parsing ---

def parse_css_file(filepath, content):
    """
    Performs basic parsing of a CSS file's content to extract rules.
    """
    file_data = {
        "path": filepath, "type": "css", "rules": [],
        "start_lineno": 1, "end_lineno": len(content.splitlines()), "full_content": content
    }
    if not content.strip():
        file_data["message"] = "File is empty or contains only whitespace."
        return file_data

    content_no_comments = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
    rule_pattern = re.compile(r'\s*([^}]*?)\s*{([^}]*)}\s*', re.DOTALL)
    
    for match in rule_pattern.finditer(content): # Iterate on original content for line numbers
         selectors_raw = match.group(1).strip()
         full_rule_text = match.group(0).strip() # The entire matched rule text

         if selectors_raw:
             # Calculate line numbers based on match position in original content
             start_lineno = 1 + content[:match.start()].count('\n')
             end_lineno = start_lineno + full_rule_text.count('\n')
             
             rule_data = {
                "selectors": [s.strip() for s in selectors_raw.split(',') if s.strip()],
                "source_code": full_rule_text,
                "start_lineno": start_lineno,
                "end_lineno": end_lineno
             }
             file_data["rules"].append(rule_data)
    return file_data


# --- Main Directory Processing Function ---

def build_project_structure_json(root_dir=".", output_filename="project_context_structured.json"):
    """
    Walks a directory tree, processes files, and builds a structured JSON.
    """
    project_data = {
        "__metadata__": {
            "root_directory": os.path.abspath(root_dir),
            "generated_time": datetime.now().isoformat(),
            "description": "Structured code context for LLM interaction and project diffing/recreation."
        },
        "files": {},
        "directory_tree": []
    }

    excluded_filenames_set = set(EXCLUDED_FILENAMES)
    managed_filenames_set = set(MANAGED_FILENAMES)
    include_content_filenames_set = set(INCLUDE_CONTENT_FOR_SPECIFIC_FILENAMES) # New set

    # Counters for summary
    excluded_dir_count = 0
    excluded_filename_count = 0
    excluded_binary_ext_count = 0
    excluded_ignored_text_ext_count = 0
    managed_count = 0
    skipped_non_utf8_count = 0
    parsing_error_count = 0
    included_by_allow_list_count = 0 # New counter
    skipped_parsing_setup = {}

    for subdir, dirs, files_in_dir in os.walk(root_dir, followlinks=False):
        original_dirs = list(dirs)
        dirs[:] = [d for d in original_dirs if d not in EXCLUDED_DIRS]
        excluded_dir_count += len(original_dirs) - len(dirs)

        relative_subdir = os.path.relpath(subdir, root_dir).replace("\\", "/")
        if relative_subdir == "." and root_dir == ".":
             if "./" not in project_data["directory_tree"]: project_data["directory_tree"].append("./")
        elif relative_subdir != ".":
             project_data["directory_tree"].append(f"{relative_subdir}/")

        for file_name in files_in_dir:
            filepath = os.path.join(subdir, file_name)
            relative_filepath = os.path.relpath(filepath, root_dir).replace("\\", "/")
            project_data["directory_tree"].append(relative_filepath)

            # 1. Check EXCLUDED_FILENAMES
            if file_name in excluded_filenames_set:
                excluded_filename_count += 1
                continue

            _, file_extension = os.path.splitext(file_name)
            file_extension_lower = file_extension.lower()

            # 2. Check BINARY_EXTENSIONS
            if file_extension_lower in BINARY_EXTENSIONS:
                excluded_binary_ext_count += 1
                continue

            # 3. Check MANAGED_FILENAMES or MANAGED_EXTENSIONS
            if file_name in managed_filenames_set or file_extension_lower in MANAGED_EXTENSIONS:
                 managed_count += 1
                 managed_entry = {
                     "path": relative_filepath, "type": "managed_static",
                     "original_extension": file_extension_lower if file_extension_lower else "none",
                     "message": "Content managed externally or omitted for brevity.",
                     "full_content": None, "start_lineno": 1, "end_lineno": 1
                 }
                 try:
                     with open(filepath, 'rb') as f_bytes:
                         line_count_m = f_bytes.read().count(b'\n') + 1
                         managed_entry["end_lineno"] = max(1, line_count_m)
                 except Exception: pass
                 project_data["files"][relative_filepath] = managed_entry
                 continue

            # --- Try to read and process content ---
            content = None
            file_details = None
            processed_this_file = False # Flag to indicate if file was handled

            # 4. Check INCLUDE_CONTENT_FOR_SPECIFIC_FILENAMES (Allow List)
            if file_name in include_content_filenames_set:
                included_by_allow_list_count +=1
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        content = f.read()
                    line_count = max(1, len(content.splitlines()))

                    if file_extension_lower in PARSEABLE_CODE_EXTENSIONS:
                        if file_extension_lower == '.py': file_details = parse_python_file(relative_filepath, content)
                        elif file_extension_lower in ('.html', '.htm'):
                            if HTML_PARSING_AVAILABLE: file_details = parse_html_file(relative_filepath, content)
                            else:
                                file_details = {"path": relative_filepath, "type": "html_skipped", "message": "HTML parsing skipped: libraries missing.", "full_content": content, "start_lineno": 1, "end_lineno": line_count}
                                skipped_parsing_setup['html'] = skipped_parsing_setup.get('html', 0) + 1
                        elif file_extension_lower == '.css': file_details = parse_css_file(relative_filepath, content)
                        else: # Should not be reached if PARSEABLE_CODE_EXTENSIONS is well-defined
                            file_details = {"path": relative_filepath, "type": "unhandled_parseable_on_allow_list", "full_content": content, "start_lineno": 1, "end_lineno": line_count}
                    else: # Not parseable, but on allow list - store as generic text
                        file_details = {"path": relative_filepath, "type": file_extension_lower[1:] if file_extension_lower else "plaintext", "full_content": content, "start_lineno": 1, "end_lineno": line_count}
                    
                    if file_details.get("type") in ("python_error", "html_error", "css_error"): parsing_error_count += 1
                    project_data["files"][relative_filepath] = file_details
                    processed_this_file = True

                except UnicodeDecodeError:
                    skipped_non_utf8_count += 1
                    # Robust line count for error entry
                    line_count_rb = 1;
                    try:
                        with open(filepath, 'rb') as fb: line_count_rb = max(1, fb.read().count(b'\n') + 1)
                    except Exception: pass
                    project_data["files"][relative_filepath] = {"path": relative_filepath, "type": "skipped_non_utf8", "full_content": "", "start_lineno": 1, "end_lineno": line_count_rb, "message": "File on allow-list skipped due to non-UTF-8 encoding."}
                    processed_this_file = True
                except Exception as e:
                    parsing_error_count +=1 # Count as a form of parsing/processing error
                    line_count_rb = 1;
                    try:
                        with open(filepath, 'rb') as fb: line_count_rb = max(1, fb.read().count(b'\n') + 1)
                    except Exception: pass
                    project_data["files"][relative_filepath] = {"path": relative_filepath, "type": "read_error_on_allow_list", "error": str(e), "full_content": "", "start_lineno": 1, "end_lineno": line_count_rb, "message": f"Error reading allow-listed file: {e}"}
                    processed_this_file = True
            
            if processed_this_file:
                continue # Move to the next file

            # 5. Check IGNORED_TEXT_EXTENSIONS (only if not processed by allow list)
            if file_extension_lower in IGNORED_TEXT_EXTENSIONS:
                excluded_ignored_text_ext_count += 1
                continue

            # 6. Default processing for other text files (parseable or generic)
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                line_count = max(1, len(content.splitlines()))

                if file_extension_lower in PARSEABLE_CODE_EXTENSIONS:
                    if file_extension_lower == '.py': file_details = parse_python_file(relative_filepath, content)
                    elif file_extension_lower in ('.html', '.htm'):
                        if HTML_PARSING_AVAILABLE: file_details = parse_html_file(relative_filepath, content)
                        else:
                            file_details = {"path": relative_filepath, "type": "html_skipped", "message": "HTML parsing skipped: libraries missing.", "full_content": content, "start_lineno": 1, "end_lineno": line_count}
                            skipped_parsing_setup['html'] = skipped_parsing_setup.get('html', 0) + 1
                    elif file_extension_lower == '.css': file_details = parse_css_file(relative_filepath, content)
                    else: # Should not be reached
                         file_details = {"path": relative_filepath, "type": "unhandled_parseable", "full_content": content, "start_lineno": 1, "end_lineno": line_count}
                else: # Generic text file not caught by any other rule
                    file_details = {"path": relative_filepath, "type": file_extension_lower[1:] if file_extension_lower else "plaintext", "full_content": content, "start_lineno": 1, "end_lineno": line_count}

                if file_details.get("type") in ("python_error", "html_error", "css_error"): parsing_error_count += 1
                project_data["files"][relative_filepath] = file_details

            except UnicodeDecodeError:
                skipped_non_utf8_count += 1
                line_count_rb = 1;
                try:
                    with open(filepath, 'rb') as fb: line_count_rb = max(1, fb.read().count(b'\n') + 1)
                except Exception: pass
                project_data["files"][relative_filepath] = {"path": relative_filepath, "type": "skipped_non_utf8", "full_content": "", "start_lineno": 1, "end_lineno": line_count_rb, "message": "File skipped due to non-UTF-8 encoding."}
            except Exception as e:
                parsing_error_count +=1
                line_count_rb = 1;
                try:
                    with open(filepath, 'rb') as fb: line_count_rb = max(1, fb.read().count(b'\n') + 1)
                except Exception: pass
                project_data["files"][relative_filepath] = {"path": relative_filepath, "type": "read_error", "error": str(e), "full_content": "", "start_lineno": 1, "end_lineno": line_count_rb, "message": f"Error reading file: {e}"}

    project_data["directory_tree"].sort()
    try:
        with open(output_filename, 'w', encoding='utf-8') as outfile:
            json.dump(project_data, outfile, indent=2)
        print(f"\nSuccessfully wrote structured project context to '{output_filename}'")
        print(f"Summary of Exclusions/Inclusions:")
        print(f"  - {excluded_dir_count} directories skipped during walk (not in directory_tree).")
        print(f"  - {excluded_filename_count} specific files excluded from 'files' dictionary.")
        print(f"  - {excluded_binary_ext_count} binary files by extension excluded from 'files' dictionary.")
        print(f"  - {included_by_allow_list_count} files had content included via specific filename allow-list.")
        print(f"  - {excluded_ignored_text_ext_count} files by extension had content ignored (not on allow-list).")
        print(f"  - {managed_count} files managed (metadata only, no full content).")
        print(f"Processing Summary:")
        if skipped_non_utf8_count:
            print(f"  - Skipped reading {skipped_non_utf8_count} non-UTF-8 text files (entry added to 'files' with error type).")
        if parsing_error_count:
             print(f"  - Encountered {parsing_error_count} files with syntax, parsing, or read errors (entry added to 'files' with error type).")
        for lang, count in skipped_parsing_setup.items():
             print(f"  - Skipped parsing {count} {lang.upper()} files due to missing libraries (entry added to 'files' with full content).")
        print(f"  - Total files with details/content in 'files' dictionary: {len(project_data['files'])}.")
        print(f"  - Full directory tree recorded: {len(project_data['directory_tree'])} entries (all found files + directories).")
    except Exception as e:
        print(f"Error writing to '{output_filename}': {e}")

if __name__ == "__main__":
    root_directory = sys.argv[1] if len(sys.argv) > 1 else "."
    build_project_structure_json(root_directory)