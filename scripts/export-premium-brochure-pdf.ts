
#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

interface BrochureConfig {
  title: string;
  subtitle: string;
  company: string;
  version: string;
}

class PremiumBrochurePDFExporter {
  private exportDir = './exports';
  private templatesDir = './exports/templates';

  constructor() {
    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }
    if (!fs.existsSync(this.templatesDir)) {
      fs.mkdirSync(this.templatesDir, { recursive: true });
    }
  }

  async exportBrochereToPDF(): Promise<void> {
    console.log('🎨 Creating Premium Sales Brochure PDF...');
    
    // Read the premium brochure content
    const brochurePath = './SKIPPY_PREMIUM_SALES_BROCHURE.md';
    if (!fs.existsSync(brochurePath)) {
      throw new Error('Premium brochure not found. Please create it first.');
    }

    const brochureContent = fs.readFileSync(brochurePath, 'utf8');
    
    // Create enhanced HTML template with premium styling
    const htmlTemplate = this.createPremiumHTMLTemplate(brochureContent);
    
    // Save HTML file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const htmlPath = path.join(this.exportDir, `skippy-premium-brochure-${timestamp}.html`);
    fs.writeFileSync(htmlPath, htmlTemplate);
    
    console.log(`🎯 Premium HTML created: ${htmlPath}`);
    
    // Create CSS file for styling
    this.createPremiumCSS();
    
    // Convert to PDF using various methods
    await this.convertToPDF(htmlPath, timestamp);
  }

  private createPremiumHTMLTemplate(markdownContent: string): string {
    // Convert markdown to HTML with enhanced formatting
    const htmlContent = this.markdownToHTML(markdownContent);
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SKIPPY - Premium Algorithmic Trading Platform</title>
    <link rel="stylesheet" href="premium-brochure.css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        @media print {
            body { -webkit-print-color-adjust: exact !important; color-adjust: exact !important; }
            .page-break { page-break-before: always; }
            .no-print { display: none !important; }
        }
    </style>
</head>
<body class="premium-document">
    <div class="container">
        <div class="cover-page">
            <div class="hero-gradient"></div>
            <div class="logo-section">
                <div class="logo">SKIPPY</div>
                <div class="tagline">THE FUTURE OF INSTITUTIONAL TRADING</div>
            </div>
            <div class="cover-stats">
                <div class="stat">
                    <div class="stat-number">74.6%</div>
                    <div class="stat-label">AI Intelligence Score</div>
                </div>
                <div class="stat">
                    <div class="stat-number">180+</div>
                    <div class="stat-label">API Endpoints</div>
                </div>
                <div class="stat">
                    <div class="stat-number">Sub-200ms</div>
                    <div class="stat-label">Latency</div>
                </div>
            </div>
        </div>
        
        <div class="page-break"></div>
        
        <div class="content-pages">
            ${htmlContent}
        </div>
        
        <div class="page-break"></div>
        
        <div class="back-cover">
            <div class="contact-section">
                <h2>Experience the Future of Trading</h2>
                <div class="contact-grid">
                    <div class="contact-item">
                        <strong>New York</strong><br>
                        Financial District<br>
                        +1 (555) SKIPPY-AI
                    </div>
                    <div class="contact-item">
                        <strong>London</strong><br>
                        Canary Wharf<br>
                        +44 20 SKIPPY-AI
                    </div>
                    <div class="contact-item">
                        <strong>Singapore</strong><br>
                        Marina Bay<br>
                        +65 SKIPPY-AI
                    </div>
                </div>
                <div class="cta-section">
                    <a href="mailto:institutional@skippy.ai" class="cta-button">
                        Request Private Demo
                    </a>
                </div>
            </div>
        </div>
    </div>
</body>
</html>`;
  }

  private createPremiumCSS(): void {
    const cssContent = `
/* Premium Brochure Styling */
:root {
    --primary-gold: #FFD700;
    --primary-blue: #0066CC;
    --dark-blue: #002244;
    --light-gray: #F8F9FA;
    --medium-gray: #6C757D;
    --success-green: #28A745;
    --gradient-primary: linear-gradient(135deg, #0066CC, #004499);
    --gradient-gold: linear-gradient(135deg, #FFD700, #FFA500);
    --shadow-premium: 0 10px 40px rgba(0, 34, 68, 0.15);
}

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body.premium-document {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    line-height: 1.6;
    color: var(--dark-blue);
    background: white;
    font-size: 11pt;
}

.container {
    max-width: 210mm;
    margin: 0 auto;
    background: white;
}

/* Cover Page */
.cover-page {
    height: 297mm;
    background: var(--gradient-primary);
    color: white;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    position: relative;
    overflow: hidden;
}

.hero-gradient {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: 
        radial-gradient(circle at 20% 30%, rgba(255, 215, 0, 0.2) 0%, transparent 50%),
        radial-gradient(circle at 80% 70%, rgba(255, 255, 255, 0.1) 0%, transparent 50%);
}

.logo-section {
    text-align: center;
    z-index: 2;
    margin-bottom: 60px;
}

.logo {
    font-size: 72pt;
    font-weight: 900;
    letter-spacing: -2px;
    background: var(--gradient-gold);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin-bottom: 20px;
}

.tagline {
    font-size: 18pt;
    font-weight: 300;
    letter-spacing: 3px;
    opacity: 0.9;
}

.cover-stats {
    display: flex;
    justify-content: space-around;
    width: 100%;
    max-width: 600px;
    z-index: 2;
}

.stat {
    text-align: center;
}

.stat-number {
    font-size: 36pt;
    font-weight: 700;
    color: var(--primary-gold);
}

.stat-label {
    font-size: 12pt;
    font-weight: 400;
    opacity: 0.8;
    margin-top: 10px;
}

/* Content Pages */
.content-pages {
    padding: 40px;
    line-height: 1.7;
}

h1 {
    font-size: 28pt;
    font-weight: 800;
    color: var(--dark-blue);
    margin-bottom: 20px;
    background: var(--gradient-primary);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

h2 {
    font-size: 20pt;
    font-weight: 700;
    color: var(--dark-blue);
    margin: 30px 0 15px 0;
    border-bottom: 3px solid var(--primary-gold);
    padding-bottom: 5px;
}

h3 {
    font-size: 16pt;
    font-weight: 600;
    color: var(--primary-blue);
    margin: 25px 0 10px 0;
}

/* Code blocks and metrics */
pre, code {
    font-family: 'JetBrains Mono', Monaco, 'Courier New', monospace;
    background: var(--light-gray);
    border: 1px solid #E9ECEF;
    border-radius: 8px;
    padding: 15px;
    margin: 15px 0;
    font-size: 9pt;
    line-height: 1.5;
    overflow-x: auto;
}

/* Performance boxes */
.performance-box {
    background: linear-gradient(135deg, #F8F9FA, #E9ECEF);
    border: 2px solid var(--primary-gold);
    border-radius: 12px;
    padding: 20px;
    margin: 20px 0;
    box-shadow: var(--shadow-premium);
}

/* Tables */
table {
    width: 100%;
    border-collapse: collapse;
    margin: 20px 0;
    font-size: 10pt;
}

th, td {
    padding: 10px;
    text-align: left;
    border-bottom: 1px solid #E9ECEF;
}

th {
    background: var(--gradient-primary);
    color: white;
    font-weight: 600;
}

tr:nth-child(even) {
    background: var(--light-gray);
}

/* Lists */
ul, ol {
    margin: 15px 0;
    padding-left: 25px;
}

li {
    margin: 8px 0;
}

/* Checkmarks and bullet points */
li:before {
    content: "✅ ";
    margin-right: 8px;
}

/* Emphasis */
strong {
    color: var(--dark-blue);
    font-weight: 700;
}

em {
    color: var(--primary-blue);
    font-style: italic;
}

/* Back Cover */
.back-cover {
    height: 297mm;
    background: var(--dark-blue);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 60px;
}

.contact-section {
    text-align: center;
    width: 100%;
}

.contact-section h2 {
    font-size: 32pt;
    color: var(--primary-gold);
    margin-bottom: 40px;
    border: none;
}

.contact-grid {
    display: flex;
    justify-content: space-around;
    margin: 40px 0;
    flex-wrap: wrap;
}

.contact-item {
    font-size: 12pt;
    line-height: 1.8;
    margin: 20px;
}

.cta-section {
    margin-top: 60px;
}

.cta-button {
    display: inline-block;
    background: var(--gradient-gold);
    color: var(--dark-blue);
    padding: 20px 40px;
    font-size: 16pt;
    font-weight: 700;
    text-decoration: none;
    border-radius: 50px;
    box-shadow: var(--shadow-premium);
    transition: transform 0.3s ease;
}

.cta-button:hover {
    transform: translateY(-2px);
}

/* Print optimizations */
@media print {
    .container {
        margin: 0;
        max-width: none;
    }
    
    .page-break {
        page-break-before: always;
    }
    
    body {
        font-size: 10pt;
    }
    
    h1 { font-size: 24pt; }
    h2 { font-size: 18pt; }
    h3 { font-size: 14pt; }
}

/* Responsive adjustments */
@media (max-width: 768px) {
    .cover-stats {
        flex-direction: column;
        gap: 30px;
    }
    
    .contact-grid {
        flex-direction: column;
        align-items: center;
    }
    
    .content-pages {
        padding: 20px;
    }
}
`;

    const cssPath = path.join(this.exportDir, 'premium-brochure.css');
    fs.writeFileSync(cssPath, cssContent);
    console.log(`🎨 Premium CSS created: ${cssPath}`);
  }

  private markdownToHTML(markdown: string): string {
    // Basic markdown to HTML conversion with enhanced formatting
    return markdown
      // Headers
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      
      // Code blocks
      .replace(/```([\s\S]*?)```/gim, '<pre><code>$1</code></pre>')
      .replace(/`([^`]+)`/gim, '<code>$1</code>')
      
      // Bold and italic
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      
      // Lists
      .replace(/^\* (.*$)/gim, '<li>$1</li>')
      .replace(/^- (.*$)/gim, '<li>$1</li>')
      .replace(/^\+ (.*$)/gim, '<li>$1</li>')
      
      // Wrap consecutive list items in ul tags
      .replace(/(<li>.*<\/li>)/gims, '<ul>$1</ul>')
      
      // Line breaks
      .replace(/\n\n/gim, '</p><p>')
      .replace(/\n/gim, '<br>')
      
      // Wrap in paragraphs
      .replace(/^(?!<[hup])(.+)$/gim, '<p>$1</p>')
      
      // Clean up
      .replace(/<p><\/p>/gim, '')
      .replace(/<p>(<[hul])/gim, '$1')
      .replace(/(<\/[hul]>)<\/p>/gim, '$1');
  }

  private async convertToPDF(htmlPath: string, timestamp: string): Promise<void> {
    const pdfPath = path.join(this.exportDir, `skippy-premium-brochure-${timestamp}.pdf`);
    
    // Try multiple PDF conversion methods
    const conversionMethods = [
      // Method 1: wkhtmltopdf (best quality)
      () => {
        try {
          execSync(`wkhtmltopdf --page-size A4 --orientation Portrait --margin-top 0 --margin-bottom 0 --margin-left 0 --margin-right 0 --enable-local-file-access "${htmlPath}" "${pdfPath}"`);
          return true;
        } catch {
          return false;
        }
      },
      
      // Method 2: puppeteer via npx
      () => {
        try {
          execSync(`npx puppeteer-pdf "${htmlPath}" "${pdfPath}" --format A4 --printBackground`);
          return true;
        } catch {
          return false;
        }
      },
      
      // Method 3: pandoc
      () => {
        try {
          execSync(`pandoc "${htmlPath}" -o "${pdfPath}" --pdf-engine=wkhtmltopdf --css="${path.join(this.exportDir, 'premium-brochure.css')}"`);
          return true;
        } catch {
          return false;
        }
      }
    ];

    let success = false;
    for (const method of conversionMethods) {
      if (method()) {
        success = true;
        break;
      }
    }

    if (success) {
      console.log(`📊 Premium PDF brochure generated: ${pdfPath}`);
      console.log(`🎯 File size: ${this.getFileSize(pdfPath)}`);
    } else {
      console.log('⚠️  PDF conversion requires additional tools. HTML version is available.');
      console.log('📄 To convert manually, use one of these commands:');
      console.log(`   wkhtmltopdf "${htmlPath}" "${pdfPath}"`);
      console.log(`   npx puppeteer-pdf "${htmlPath}" "${pdfPath}"`);
      console.log(`   pandoc "${htmlPath}" -o "${pdfPath}"`);
    }
  }

  private getFileSize(filePath: string): string {
    try {
      const stats = fs.statSync(filePath);
      const fileSizeInBytes = stats.size;
      if (fileSizeInBytes < 1024) return `${fileSizeInBytes} B`;
      if (fileSizeInBytes < 1024 * 1024) return `${(fileSizeInBytes / 1024).toFixed(2)} KB`;
      return `${(fileSizeInBytes / (1024 * 1024)).toFixed(2)} MB`;
    } catch {
      return 'Unknown';
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const exporter = new PremiumBrochurePDFExporter();
  exporter.exportBrochereToPDF().catch(console.error);
}

export { PremiumBrochurePDFExporter };
