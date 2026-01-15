const fs = require('fs');
const { marked } = require('marked');

// Read the markdown file
const mdContent = fs.readFileSync('使用者安裝手冊.md', 'utf8');

// Convert to HTML
const htmlContent = marked(mdContent);

// Create a complete HTML document with styling
const fullHtml = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AutoScan 安裝使用手冊</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft JhengHei', Arial, sans-serif;
            line-height: 1.6;
            max-width: 900px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 { 
            color: #2c3e50;
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
        }
        h2 { 
            color: #34495e;
            margin-top: 30px;
            border-bottom: 2px solid #ecf0f1;
            padding-bottom: 8px;
        }
        h3 { 
            color: #7f8c8d;
        }
        code {
            background: #f8f8f8;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Consolas', 'Monaco', monospace;
        }
        pre {
            background: #2c3e50;
            color: #ecf0f1;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
        }
        pre code {
            background: transparent;
            color: inherit;
        }
        table {
            border-collapse: collapse;
            width: 100%;
            margin: 20px 0;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
        }
        th {
            background-color: #3498db;
            color: white;
        }
        tr:nth-child(even) {
            background-color: #f9f9f9;
        }
        blockquote {
            border-left: 4px solid #3498db;
            margin: 20px 0;
            padding: 10px 20px;
            background: #f8f9fa;
        }
        .tip, .important, .caution, .note, .warning {
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
            border-left: 4px solid;
        }
        .tip {
            background: #d4edda;
            border-color: #28a745;
        }
        .important {
            background: #fff3cd;
            border-color: #ffc107;
        }
        .caution {
            background: #f8d7da;
            border-color: #dc3545;
        }
        ul, ol {
            margin: 10px 0;
            padding-left: 30px;
        }
        li {
            margin: 5px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        ${htmlContent}
    </div>
</body>
</html>`;

// Write the HTML file
fs.writeFileSync('使用者安裝手冊.html', fullHtml, 'utf8');

console.log('✅ 成功將 MD 轉換為 HTML！');
console.log('📄 輸出檔案：使用者安裝手冊.html');
