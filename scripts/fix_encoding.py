# -*- coding: utf-8 -*-
import codecs

# Read with UTF-8 encoding
try:
    with codecs.open('index.html', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Check if config-manager.js is already added
    if 'config-manager.js' not in content:
        # Add config-manager.js before app.js
        content = content.replace(
            '  <script src="app.js"></script>',
            '  <script src="config-manager.js"></script>\n  <script src="app.js"></script>'
        )
    
    # Write back with UTF-8 encoding (with BOM to ensure Windows compatibility)
    with codecs.open('index.html', 'w', encoding='utf-8-sig') as f:
        f.write(content)
    
    print("✅ index.html fixed successfully with UTF-8 encoding!")
    
except Exception as e:
    print(f"❌ Error: {e}")
